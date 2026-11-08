#!/usr/bin/env bash
# このプラグインをプロファイルに link: で入れる。
#
# プロファイル名は PROFILE で変える。既定は web。
#     PROFILE=<profile> bash scripts/install-web.sh
#
# 実測では dsh plugin add だけで反映し、host の再起動は要らなかった。動いている
# host が add を吸収して、配信されるページの bundle 一覧に client.js が現れる。
# ブラウザを1回リロードすれば足りる。現れない場合のみ、起動している dsh web
# プロセスをいつも通り一度再起動する。その場合は走っている会話も一緒に止まるので、
# 必ずユーザーへ予告して手で行う。
#
# lib/client.js を直す変更は再起動もページリロードも要らない。
# dsh-client-hmr がバンドルを約 500ms で熱交換する。
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${PROFILE:-web}"
NAME="dsh-mediaplayer-plugin"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"

echo "== dsh plugin --profile $PROFILE add link:$REPO =="
dsh plugin --profile "$PROFILE" add "link:$REPO"

echo
echo "== 導入後の bundles =="
if [ -f "$DSH_HOME/profiles/$PROFILE/package.json" ]; then
  PROFILE_DIR="$DSH_HOME/profiles/$PROFILE" python3 -c "
import json, os
p = os.path.join(os.environ['PROFILE_DIR'], 'package.json')
print(json.load(open(p))['dsh']['profile']['bundles'])
"
else
  echo "$DSH_HOME/profiles/$PROFILE/package.json がありません。PROFILE を確かめてください"
  exit 1
fi

cat <<EOS

次:
  1. 上の bundles に $NAME が入っているかを見る。登録はそれで通っている。
     動いている DSH が実際に配信しているかはページで確かめられる。
       curl -s <DSH の URL>/ | grep -o '$NAME/client\.js&rev=[a-f0-9]*'
  2. ブラウザを1回リロードする。
  3. 右 Sidebar を Files タブで開き、音声・動画ファイルを選ぶ。
  4. 出ないときだけ dsh web プロセスを再起動する。
     ★ 走っている会話も一緒に止まる。手で実行するのが安全。
  5. 取り消すなら:
       dsh plugin --profile $PROFILE remove $NAME
EOS
