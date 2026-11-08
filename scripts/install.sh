#!/usr/bin/env bash
# このプラグインを DSH のプロファイルに入れる。
#
# git clone したらそのまま動くことを狙いにする。実行に要るのは dsh と node だけ。
#
#     ./scripts/install.sh              # profile 名は web
#     ./scripts/install.sh tui          # profile 名を渡す
#     PROFILE=tui ./scripts/install.sh  # 同じことの環境変数形
#     DSH_URL=http://127.0.0.1:3000/ ./scripts/install.sh   # 配信の確認まで行う
#
# profile 名は dsh web として起動しているものの名前。既定は web。実体は
# $DSH_HOME/profiles/<profile> で、$DSH_HOME の既定は ~/.dsh。
#
# 実測では dsh plugin add だけで反映し、host の再起動は要らなかった。動いている
# host が add を吸収して、配信されるページの bundle 一覧に client.js が現れるので、
# ブラウザを1回リロードすれば足りる。現れない場合のみ、起動している dsh プロセスを
# いつも通り一度再起動する。その場合は走っている会話も一緒に止まるので、人に予告して
# から行う。
#
# lib/client.js を直す変更は再起動もページリロードも要らない。dsh-client-hmr が
# バンドルを約 500ms で熱交換する。
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="dsh-mediaplayer-plugin"
PROFILE="${1:-${PROFILE:-web}}"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"

# `DSH_URL=... ./scripts/install.sh` を前に置かずに引数へ渡してしまう人を、実行前に止める。
case "$PROFILE" in
  "" | *=* | *[!A-Za-z0-9._-]*)
    cat >&2 <<'USAGE'
使い方: ./scripts/install.sh [profile]
profile を省略すると web。環境変数 PROFILE でも渡せる。
配信の確認まで行うなら、次のように前に置く。
  DSH_URL=http://127.0.0.1:3000/ ./scripts/install.sh
USAGE
    exit 1
    ;;
esac

if ! command -v dsh >/dev/null 2>&1; then
  echo "dsh コマンドが見つかりません。PATH を確かめてください"
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node コマンドが見つかりません。dsh を動かしている node を PATH に置いてください"
  exit 1
fi
if [ ! -f "$PROFILE_DIR/package.json" ]; then
  echo "$PROFILE_DIR/package.json がありません。profile 名を確かめてください"
  echo "  $DSH_HOME/profiles の下: $(ls -1 "$DSH_HOME/profiles" 2>/dev/null | tr '\n' ' ')"
  exit 1
fi

echo "== dsh plugin --profile $PROFILE add link:$REPO =="
dsh plugin --profile "$PROFILE" add "link:$REPO"

echo
echo "== 導入後の bundles =="
bundles="$(node -e '
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
console.log((pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles || []).join(" "));
' "$PROFILE_DIR/package.json")"
echo "$bundles"
case " $bundles " in
  *" $NAME "*) echo "OK: $NAME が入っています" ;;
  *)
    echo "NG: $NAME が入っていません。$PROFILE_DIR/package.json を確かめてください"
    exit 1
    ;;
esac

if [ -n "${DSH_URL:-}" ]; then
  echo
  echo "== 配信の確認 =="
  hit="$(curl -s --max-time 10 "${DSH_URL%/}/" | grep -o "$NAME/client\.js&rev=[a-f0-9]*" | head -1 || true)"
  if [ -n "$hit" ]; then
    echo "OK: $hit"
    echo "ブラウザを1回リロードすれば反映します"
  else
    echo "NG: $DSH_URL のページに $NAME のバンドルが見当たりません"
    echo "  起動している dsh プロセスをいつも通り一度再起動してください"
    exit 1
  fi
fi

cat <<EOS

次:
  1. ブラウザを1回リロードする。
  2. 右 Sidebar を Files タブで開き、音声・動画ファイルを選ぶ。
  3. 検証用素材が要るときは ./tests/make-fixtures.sh
  4. 取り消すとき:
       dsh plugin --profile $PROFILE remove $NAME
EOS
