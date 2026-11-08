# dsh-mediaplayer-plugin

DSH の右 Sidebar で音声・動画ファイルを再生するクライアントプラグイン。Files タブ（既定 `Mod+P`）でファイルを選ぶと、そのプレビュー枠に再生器が出ます。

## 動き

ファイルを選ぶと、その拡張子が再生できる種類かを見て、`<audio>` または `<video>` を枠に合わせます。ブラウザ自身の再生コントロールを使い、独自の再生バーは作りません。

再生は URL direct 渡しです。ファイルのバイトを JavaScript に取り込まず、`<audio>` と `<video>` の `src` に DSH のファイル配信 URL を直接向けます。受信はブラウザが行い、シークもブラウザ任せです。

```
Files タブでファイルを選ぶ
  → dsh-resource://file/session/… の値（絶対パスと版）を shared resource から取る
  → api/file?path=…&v=… を組み立てて src に入れる
  → ブラウザが受け取り、再生できる状態になったら loaded を文書 owner に返す
```

`v` はファイルの版です。同じパスのファイルが変わったときに、同じ URL を `<video>` が再利用して古いまま再生し続けるのを防ぎます。サーバーは `Cache-Control: no-store` を返します。

## 再生できる拡張子

音: `mp3` `wav` `ogg` `oga` `opus` `m4a` `aac` `flac`
動画: `mp4` `m4v` `mov` `webm`

`mkv` と `avi` は登録しません。Chromium が再生できないため、登録しないほうが既存の「プレビュー非対応」表示として正しく出ます。

## 20 MB の上限

DSH のファイル配信（`/api/file`）は 1 ファイルの大きさを 20 MB（`ctx.attachments.imageLimits.maxImageBytes`）で切り、超えると 413 を返します。HTTP Range も読みません。そのため 20 MB を超えるファイルは再生できません。ファイルサイズが分かっていれば読み込み前に、分からなければ受信に失敗したときに理由を表示します。

スマホで撮った長い動画は容易に超えます。大きなファイルをシーク付きで再生するには Range 対応の配信ルートをプラグイン側にもう1本作り込む必要があり、それは host 側のコードです。今回は作りません。

## 他のプラグインからの独立

`dsh-tts-plugin`（発話専用）とは完全に別の機能です。共有するものは何もありません。`navigator.mediaSession`、`localStorage`、`window` の状態、他の `<audio>` 要素への干渉はいずれも行っていません。この独立性は文言ではなく検査にしています。

```sh
npm run check
```

`node tests/check-independence.mjs` が禁止しているのは、`navigator.mediaSession`、`localStorage`、`window` 上の状態、`fetch` などの JS 側受信、`querySelectorAll` よその要素を触る操作です。`bash tests/check-glyphs.sh` は日本語文案を調べますが、`lib/client.js` の `zh` 辞書は中国語の UI 文案なので簡体字が正しく、日本の字形に直してはいけません。

## 導入

```sh
bash scripts/install-web.sh
```

これで `dsh web` の再起動は要りませんでした（この機器で実測）。動いている host が `dsh plugin add` だけを吸収して、配信されるページに `dsh-mediaplayer-plugin/client.js&rev=…` が入り、バンドルは 200 を返しました。ブラウザは1回だけリロードします。リロードでも出ない場合のみ、host の再起動を試します。

```sh
dsh を起動し直す（やり方は環境による）
```

再起動すると動いている会話も一緒に止まります。`dsh-client-hmr` は約 500 ms でバンドルを熱交換するので、`lib/client.js` だけ直す変更は再起動もリロードも要りません。`file:` でなく `link:` を使うのは、`file:` がスナップショットコピーになり編集が反映されないためです。

取り消すには:

```sh
dsh plugin --profile web remove dsh-mediaplayer-plugin
```

## 確認

1. `bash tests/make-fixtures.sh` で検証用の音声・動画を作る。
2. 右 Sidebar を Files タブで開き、`fixtures/tone.mp3` を選ぶ。音声再生器が出る。
3. `fixtures/clip.mp4` を選ぶ。動画が枠に収まって再生できる。
4. `fixtures/big.mp4`（44.50 MiB）を選ぶ。再生せず、サイズと 20 MB の上限が表示される。
5. `fixtures/README.md` に作られるファイルの一覧と大きさ、既知の制約を書きます。

## 仕組み

登録するものは3つだけです。他のプラグインに対する副作用もこれ以外は持ちません。

| 登録 | 内容 |
| --- | --- |
| `ctx.documentPreviews` | 拡張子と読み込み方式 `renderer` を教える。`renderer` は body が自分で読み込みを宣言する方式で、共有リーダーの 32 MiB 制約を避けるために選びました |
| `sidebar.right.tab.document` | `key` を登録 id と同じにした body。枠に合わせるところ |
| `ctx.locale` | 辞書。組み込み locale は `zh` と `en` の2つで、日本語は language pack が要るため今回の範囲外です |

ファイルの絶対パスと版は `props.useResource('file', props.resourceAddress)` から取ります。`useResource` は全ての slot の props に付く標準 hook で、同じアドレスを読む UI と状態を共有します。

## 既知の制約

- 20 MB 超は再生できません。
- 日本語のラベルは出しません。文案は `zh` と `en` の登録です。
- Chromium が再生できる符号形しか再生できません。`mov` は中身が H.264 / AAC でないと失敗します。
- ファイルのバイトを JavaScript に取り込まないため、波形表示や再生位置の保存はしていません。
