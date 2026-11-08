# dsh-mediaplayer-plugin

DSH の右 Sidebar で音声・動画ファイルを再生するクライアントプラグイン。Files タブでファイルを選ぶと、そのプレビュー枠に再生器が出ます。

ビルドは不要で、依存もありません。`lib/client.js` をブラウザがそのまま実行します。

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

## 必要もの

- DSH `0.2.1-rc.5` 以上（`package.json` の `engines.dsh` に同じ範囲を書いています）
- Web を起動する DSH profile。このプラグインは `dsh.client.platform` が `web` なので、ブラウザで開く DSH でのみ materialize します。TUI やネイティブの carrier には入りません
- `dsh plugin` が内部で pnpm を使うため、pnpm が必要です
- 検証用の音声・動画を作るには ffmpeg と ffprobe が必要です（プラグインの実行には要りません）

## 導入

`<profile>` はあなたが `dsh web` として起動している profile 名です。既定は `web` で、`$DSH_HOME/profiles` の下の名前と一致します。

```sh
git clone https://github.com/NagasakaH/dsh-mediaplayer-plugin.git
cd dsh-mediaplayer-plugin
dsh plugin --profile <profile> add "link:$(pwd)"
```

`link:` を使うのが要点です。`file:` はスナップショットコピーになり、後の編集が反映されません。公開されている npm パッケージとしては配信していないので、`add` にはローカルパスを渡します。

同じことを `scripts/install-web.sh` でもできます。`PROFILE` 環境変数で profile 名を替えられます。

```sh
bash scripts/install-web.sh
PROFILE=<profile> bash scripts/install-web.sh
```

取り消すには次の1行です。

```sh
dsh plugin --profile <profile> remove dsh-mediaplayer-plugin
```

## 導入できたかの確認

`$DSH_HOME/profiles/<profile>/package.json`（既定は `~/.dsh/profiles/<profile>/package.json`）の `dsh.profile.bundles` に `dsh-mediaplayer-plugin` が入っていれば、登録は通っています。`scripts/install-web.sh` はその1行を表示します。

動いている DSH がバンドルを実際に配信しているかは、ページの bundle 一覧に出るかで見ます。`<DSH の URL>` はブラウザで開いている DSH のアドレスです。

```sh
curl -s <DSH の URL>/ | grep -o 'dsh-mediaplayer-plugin/client\.js&rev=[a-f0-9]*'
```

1行でも出れば、その URL を直接取得して 200 と中身も確かめられます。ここまで出ていればブラウザを1回リロードするだけで反映します。

`dsh plugin add` だけで反映し、host の再起動は要らないことを実測しています。ホストが profile の変更を拾わない実行形態の場合のみ、起動している `dsh web` プロセスをいつも通り一度止めて起動し直してください。再起動は走っている会話も一緒に止めます。どの起動方法でも手順は同じで、そのプロセスを再起動するだけです。

以降 `lib/client.js` だけ直す変更は、再起動もリロードも要りません。`dsh-client-hmr` がバンドルを約 500 ms で熱交換します。

## 動作確認

1. `bash tests/make-fixtures.sh` で検証用の音声・動画を作る。
2. 右 Sidebar を Files タブで開き、`fixtures/tone.mp3` を選ぶ。音声再生器が出る。
3. `fixtures/clip.mp4` を選ぶ。動画が枠の幅いっぱいに収まって再生できる。
4. `fixtures/big.mp4`（44.50 MiB）を選ぶ。再生せず、サイズと 20 MB の上限が表示される。

作られるファイルの一覧と大きさと既知の制約は [fixtures/README.md](fixtures/README.md) に書いています。

## 再生できる拡張子

音: `mp3` `wav` `ogg` `oga` `opus` `m4a` `aac` `flac`
動画: `mp4` `m4v` `mov` `webm`

`mkv` と `avi` は登録しません。ブラウザが再生できない形式だからです。登録しないほうが既存の「プレビュー非対応」表示として正しく出ます。

## 20 MB の上限

DSH のファイル配信（`/api/file`）は 1 ファイルの大きさを 20 MB（`ctx.attachments.imageLimits.maxImageBytes`）で切り、超えると 413 を返します。HTTP Range も読みません。そのため 20 MB を超えるファイルは再生できません。ファイルサイズが分かっていれば読み込み前に、分からなければ受信に失敗したときに理由を表示します。

スマホで撮った長い動画は容易に超えます。大きなファイルをシーク付きで再生するには Range 対応の配信ルートをプラグイン側にもう1本作り込む必要があり、それは host 側のコードです。今回は作りません。

上限を変えたい場合は `ctx.attachments.imageLimits.maxImageBytes` を上げる側を直します。`lib/client.js` の `MAX_PLAYABLE_BYTES` はその表示用の写しです。

## 仕組み

登録するものは3つだけです。他のプラグインに対する副作用もこれ以外は持ちません。

| 登録 | 内容 |
| --- | --- |
| `ctx.documentPreviews` | 拡張子と読み込み方式 `renderer` を教える。`renderer` は body が自分で読み込みを宣言する方式で、共有リーダーの 32 MiB 制約を避けるために選びました |
| `sidebar.right.tab.document` | `key` を登録 id と同じにした body。枠に合わせるところ |
| `ctx.locale` | 辞書。組み込み locale は `zh` と `en` の2つで、日本語は language pack が要るため今回の範囲外です |

ファイルの絶対パスと版は `props.useResource(props.resourceAddress)` から取ります。`useResource` は全ての slot の props に付く標準 hook で、プロトコルは型引数だけなので第1引数はアドレスそのものです。同じアドレスを読む UI と状態を共有します。

## 他のプラグインからの独立

発話系のプラグインなど、他のプラグインと共有するものは何もありません。`navigator.mediaSession`、`localStorage`、`window` 上の状態、他の `<audio>` 要素への干渉はいずれも行っていません。`navigator.mediaSession` を上書きすると、それを所有しているプラグインのロック画面制御が壊れます。この独立性は文言ではなく検査にしています。

```sh
npm run check
```

`node tests/check-independence.mjs` が通さないのは、`navigator.mediaSession`、`localStorage`、`window` 上の状態、`fetch` などの JS 側受信、`querySelectorAll` などよその要素を触る操作です。コメントを除いて本文だけを見るので、触れないと書くために語名が出ただけでは落ちません。

`bash tests/check-glyphs.sh` は日本語文案を調べます。`lib/client.js` の `zh` 辞書は中国語の UI 文案なので簡体字が正しく、日本の字形に直してはいけません。

## 開発

リポジトリの形はこれだけです。ビルドも package の install も要りません。

```
lib/client.js            ブラウザ側。window.__ModuleLoader__.load を1回呼ぶ
lib/index.js             host 側。空の apply だけ。cordis の Loader 行の見出し
cordis.patch.yml         profile に入る1行の Loader 行
scripts/install-web.sh   profile への登録
tests/                   検査と検証用ファイル生成
```

`lib/client.js` を直したら次を通します。

```sh
node --check lib/client.js && npm run check
```

## 再生できないとき

- ドロップダウンに項目が出ない。profile の bundles に入っていないか、ブラウザが古いバンドルを使っています。前の節の確認コマンドとリロードを確かめます
- `Media player` は出るのに再生器が出ない。その拡張子が表にないか、ブラウザがその符号形を再生できません。`mov` は中身が H.264 / AAC でないと失敗します
- 上限より小さいのに「サーバーから取得できませんでした」が出る。`/api/file` の認証が通っていない可能性が高いです。同じブラウザでテキストファイルのプレビューが見られるか確かめてください
- 20 MB 超のファイル。意図した動作で、理由の表示が出ます

## 既知の制約

- 20 MB 超は再生できません。
- 日本語のラベルは出しません。文案は `zh` と `en` の登録です。
- ブラウザが再生できる符号形しか再生できません。再生はブラウザ任せで、このプラグインは変換しません。
- ファイルのバイトを JavaScript に取り込まないため、波形表示や再生位置の保存はしていません。
