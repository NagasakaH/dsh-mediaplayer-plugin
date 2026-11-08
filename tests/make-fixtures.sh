#!/usr/bin/env bash
# 検証用の音声・動画を作る。すべて ffmpeg の合成信号なので、実写素材は不要。
# 再生経路の上限（/api/file の 20 MiB、readBytes の 32 MiB）を跨ぐサイズを意図的に混ぜる。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p fixtures

ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=440:duration=3" fixtures/tone.wav
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=660:duration=3" -c:a libmp3lame -b:a 128k fixtures/tone.mp3
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=523:duration=4" -c:a libopus fixtures/tone.ogg
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc=size=320x240:rate=15:duration=4" \
  -f lavfi -i "sine=frequency=440:duration=4" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -c:a aac -shortest fixtures/clip.mp4
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=navy:size=320x240:rate=15:duration=3" \
  -c:v libvpx-vp9 -b:v 400k -an fixtures/clip.webm
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc=size=1280x720:rate=30:duration=60" \
  -f lavfi -i "sine=frequency=440:duration=60" \
  -c:v libx264 -preset ultrafast -b:v 4000k -pix_fmt yuv420p -movflags +faststart -c:a aac -shortest fixtures/big.mp4

ls -la fixtures
