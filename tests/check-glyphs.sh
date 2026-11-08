#!/usr/bin/env bash
# 日本語の文章に中国語簡体字のコードポイントが混ざっていないか確かめる。
#
# lib/client.js の zh 辞書は中国語の UI 文案なので、簡体字が正しい。日本の字形に
# 直してはいけません。ここを通すには zh の辞書ブロックだけを落としてから調べます。
# 同じ罠に次回がかからないよう、検査のほうで除外します。
#
# 使う: bash tests/check-glyphs.sh
set -uo pipefail
cd "$(dirname "$0")/.."

CHECKER="${CN_GLYPH_CHECKER}"
status=0

if [ ! -f "$CHECKER" ]; then
  echo "$CHECKER がありません"
  exit 1
fi

targets=(README.md lib/index.js cordis.patch.yml tests/check-independence.mjs tests/check-glyphs.sh fixtures/README.md)
for file in "${targets[@]}"; do
  if [ -f "$file" ]; then
    "$CHECKER" "$file" >/dev/null 2>&1 || { status=1; echo "NG: $file"; "$CHECKER" "$file"; }
  fi
done

if [ -f lib/client.js ]; then
  tmp="$(mktemp)"
  # const zh = { ... }; のブロックだけ落としてから日本語部分を見る。
  sed '/const zh = {/,/^[[:space:]]*};$/d' lib/client.js > "$tmp"
  "$CHECKER" "$tmp" >/dev/null 2>&1 || { status=1; echo "NG: lib/client.js（zh 辞書を除く部分）"; "$CHECKER" "$tmp"; }
  rm -f "$tmp"
fi

if [ "$status" -eq 0 ]; then
  echo "日本の字形: 合格"
fi
exit "$status"
