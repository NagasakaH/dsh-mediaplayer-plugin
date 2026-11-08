#!/usr/bin/env bash
# 検証用の音声・動画を作る。すべて ffmpeg の合成信号なので、実写素材は不要。
# 再生経路の上限（/api/file の 20 MiB、readBytes の 32 MiB）を跨ぐサイズを意図的に混ぜる。
#
#     ./tests/make-fixtures.sh
set -euo pipefail
cd "$(dirname "$0")/.."

for tool in ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool が見つかりません。この検査はプラグインの実行に必要ありません"
    exit 1
  fi
done

mkdir -p fixtures

ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=440:duration=3" fixtures/tone.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=660:duration=3" -c:a libmp3lame -b:a 128k fixtures/tone.mp3
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=523:duration=4" -c:a libopus fixtures/tone.ogg
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc=size=320x240:rate=15:duration=4" \
  -f lavfi -i "sine=frequency=440:duration=4" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -c:a aac -shortest fixtures/clip.mp4
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=navy:size=320x240:rate=15:duration=3" \
  -c:v libvpx-vp9 -b:v 400k -an fixtures/clip.webm
# 20 MiB と 32 MiB の両方を越える大きさを目指す。testsrc だけでは圧縮が良すぎて
# 目標ビットレートを使いきれないので、ノイズを足して実写なみの情報量にする。
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc=size=1280x720:rate=30:duration=60,noise=alls=40:allf=t" \
  -f lavfi -i "sine=frequency=440:duration=60" \
  -c:v libx264 -preset ultrafast -b:v 6000k -pix_fmt yuv420p -movflags +faststart -c:a aac -shortest fixtures/big.mp4

echo
printf '%-14s %12s  %s\n' ファイル  bytes  符号形
for file in fixtures/tone.wav fixtures/tone.mp3 fixtures/tone.ogg fixtures/clip.mp4 fixtures/clip.webm fixtures/big.mp4; do
  bytes="$(wc -c <"$file" | tr -d ' ')"
  codecs="$(ffprobe -hide_banner -loglevel error -show_entries stream=codec_name -of csv=p=0 "$file" | tr '\n' '/' | sed 's:/$::')"
  printf '%-14s %12s  %s\n' "$(basename "$file")" "$bytes" "$codecs"
done
