#!/usr/bin/env bash
# web プロファイルにこのプラグインを link: で入れる。
#
# この機器で実測した限り再起動は要らない。動いている host が add だけを吸収して、
# 配信されるページに client.js が現れる。ブラウザを1回リロードすれば足りる。
# 出ない場合のみ host を再起動する。その場合はこの会話も含めて host が死ぬので、
# 必ずユーザーへ予告して手で行う:
#     dsh を起動し直す（やり方は環境による）
#     tail -40 dsh-web.log
#
# lib/client.js を直す変更は再起動もページリロードも要らない。
# dsh-client-hmr がバンドルを約 500ms で熱交換する。
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="${PROFILE:-web}"
NAME="dsh-mediaplayer-plugin"

echo "== 導入前 =="
dsh plugin --profile "$PROFILE" why "$NAME" 2>&1 | head -5 || true

echo
echo "== dsh plugin --profile $PROFILE add link:$REPO =="
dsh plugin --profile "$PROFILE" add "link:$REPO"

echo
echo "== 導入後 =="
python3 -c "
import json, pathlib
p = pathlib.Path.home() / '.dsh/profiles/$PROFILE/package.json'
print(json.load(open(p))['dsh']['profile']['bundles'])
"

cat <<'EOS'

次:
  1. ブラウザを1回リロードする。この機器では add だけでバンドルが配信される
     ことを確かめた（page に client.js&rev= が出て HTTP 200）。
  2. 右 Sidebar を Files タブ（既定 Mod+P）で開き、音声・動画ファイルを選ぶ。
  3. 出ないときだけ host を再起動する。
       dsh を起動し直す（やり方は環境による）
     ★ この会話も一緒に終わる。手で実行するのが安全。
  4. 取り消すなら:
       dsh plugin --profile web remove dsh-mediaplayer-plugin
EOS
