# 検証用素材

プレイヤーの再生を確認する音声・動画を入れる場所です。`npm run fixtures` が `ffmpeg` の合成信号から作り直します。素材は生成物として追いません。

| ファイル | 大きさ | 検証したいこと |
|---|---|---|
| `tone.wav` | 0.25 MiB | 非圧縮 PCM。`<audio>` が素の波形を再生できるか |
| `tone.mp3` | 0.05 MiB | `audio/mpeg` が付くか |
| `tone.ogg` | 0.04 MiB | Opus をコンテナした Ogg。拡張子と実体の対応 |
| `clip.mp4` | 0.05 MiB | `moov` が `mdat` より前の faststart。Range 無し再生とシーク |
| `clip.webm` | 1.6 KiB | VP9。Chromium 系の再生可否 |
| `big.mp4` | 44.50 MiB | 上限越え。`/api/file` が 413 を返したときの画面 |

`/api/file` は 20 MiB、`readBytes` の完全読みは 32 MiB が既定の上限です。`big.mp4` はその両方の外側にいます。`testsrc` だけでは圧縮が良すぎて目標ビットレートを使いきれないため、ノイズを加えて実写なみの情報量にしています。
