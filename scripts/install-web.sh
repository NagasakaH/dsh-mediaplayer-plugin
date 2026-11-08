#!/usr/bin/env bash
# web プロファイルにこのプラグインを link: で入れる。
#
# 初回の導入だけ dsh web の再起動が要る。host 側の lib/index.js を初めて読むためです。
# 再起動すると今この会話を含めて host が死ぬ。実行前に必ず声をかけてください:
#     dsh を起動し直す（やり方は環境による）
#     tail -40 dsh-web.log
#
# 以降 lib/client.js だけ直す変更は再起動もページリロードも要らない。
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
  1. bundles に dsh-mediaplayer-plugin が入っていたら、host を一度だけ再起動する。
       dsh を起動し直す（やり方は環境による）
     ★ この会話も一緒に終わる。手で実行するのが安全。
  2. 右 Sidebar を Files タブ（既定 Mod+P）で開き、音声・動画ファイルを選ぶ。
  3. 取り消すなら:
       dsh plugin --profile web remove dsh-mediaplayer-plugin
EOS
