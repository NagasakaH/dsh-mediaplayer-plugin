// dsh-mediaplayer-plugin が他のプラグインから独立を保っているか機械的に確かめる。
//
// dsh-tts-plugin は発話専用の別プラグイン。このプレイヤーが navigator.mediaSession や
// localStorage に触れると、そちらの読み上げ制御を壊す。文言で決まりを書いても
// 次の編集で破られるので、破れたら通らない検査にする。
//
// 使う: node tests/check-independence.mjs   （npm run check と同じ）

import { readFile } from "node:fs/promises";

const TARGET = "lib/client.js";
const problems = [];

// コメントを除いた本文だけを見る。コメントに触れないと書くために
// mediaSession という語が出ただけで落ちるのは、検査の誤検出である。
function stripComments(source) {
  let out = "";
  let state = "code";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (ch === "/" && next === "/") {
        state = "line";
        out += "  ";
        i += 2;
      } else if (ch === "/" && next === "*") {
        state = "block";
        out += "  ";
        i += 2;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        state = { '"': "dquote", "'": "squote", "`": "template" }[ch];
        out += ch;
        i += 1;
      } else {
        out += ch;
        i += 1;
      }
      continue;
    }
    if (state === "line") {
      if (ch === "\n") {
        state = "code";
        out += "\n";
      } else out += " ";
      i += 1;
      continue;
    }
    if (state === "block") {
      if (ch === "*" && next === "/") {
        state = "code";
        out += "  ";
        i += 2;
      } else {
        out += ch === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }
    // 文字列リテラルの中はコメントではない。終端まで写す。
    const closer = { dquote: '"', squote: "'", template: "`" }[state];
    if (ch === "\\") {
      out += ch + (next ?? "");
      i += 2;
    } else if (ch === closer) {
      state = "code";
      out += ch;
      i += 1;
    } else if (state !== "template" && ch === "\n") {
      state = "code";
      out += ch;
      i += 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function report(source, pattern, why) {
  const re = new RegExp(pattern, "g");
  let match = re.exec(source);
  while (match !== null) {
    problems.push(`${lineOf(source, match.index)}: ${why}\n    ${match[0]}`);
    match = re.exec(source);
  }
}

const source = await readFile(TARGET, "utf8").catch(() => {
  problems.push(`${TARGET} がありません`);
  return "";
});
const body = stripComments(source);

// 他のプラグインが所有している状態。
report(body, "navigator\\.mediaSession|MediaMetadata|setActionHandler", "発話プラグインの所有する mediaSession に触れています");
report(body, "localStorage|sessionStorage|indexedDB|document\\.cookie", "永続化しています。v1 は設定を持ちません");
report(body, "dsh-tts|voice-tts|voiceTts|__dshVoiceTts", "dsh-tts-plugin の名前が出ています");

// JS にファイルバイトを取り込む経路。src に URL を向けてブラウザに取らせる。
report(body, "fetch\\(|XMLHttpRequest|EventSource|readBytes|createObjectURL|new Blob|FileReader", "JS がファイルバイトを取りにいく経路です");

// 他の要素を探さない。自分で作った要素だけ操作する。
report(body, "querySelectorAll|getElementsByTagName|getElementsByClassName", "他の要素を探しています");

// window はバンドルの登録に 1 回だけ。
const loads = body.match(/window\.__ModuleLoader__\.load/g) ?? [];
if (loads.length !== 1) problems.push(`window.__ModuleLoader__.load が ${loads.length} 回です。1回でなければバンドルが二重登録されます`);
for (const match of body.matchAll(/window\.[A-Za-z_$][\w$]*/g)) {
  if (match[0] !== "window.__ModuleLoader__") problems.push(`${lineOf(body, match.index)}: window に状態を置いています: ${match[0]}`);
}

// 拡張子は1枚の表だけが出所。重複と Chromium が再生できない形式を弾く。
const FORBIDDEN = ["mkv", "avi", "wmv", "flv", "mts", "3gp"];
const suffixes = ["AUDIO_SUFFIXES", "VIDEO_SUFFIXES"].flatMap((name) => {
  const at = body.indexOf(`const ${name}`);
  if (at < 0) {
    problems.push(`拡張子の表 ${name} が見つかりません`);
    return [];
  }
  const open = body.indexOf("[", at);
  let depth = 0;
  for (let i = open; i < body.length; i += 1) {
    if (body[i] === "[") depth += 1;
    else if (body[i] === "]" && --depth === 0) return [...body.slice(open, i).matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]);
  }
  problems.push(`${name} の閉じ bracket がありません`);
  return [];
});

const dupe = suffixes.filter((x, i) => suffixes.indexOf(x) !== i);
if (dupe.length) problems.push(`拡張子が重複しています: ${dupe.join(", ")}`);
for (const bad of FORBIDDEN) if (suffixes.includes(bad)) problems.push(`${bad} が入っています。Chromium が再生できないので登録しないほうが既存の非対応表示として正しく出ます`);
if (!suffixes.length) problems.push("再生できる拡張子が1つもありません");

if (problems.length) {
  console.log(`検出 ${problems.length} 件`);
  for (const problem of problems) console.log(`NG: ${problem}`);
  process.exit(1);
}
console.log(`ok: 拡張子 ${suffixes.length} 個 ${suffixes.join(" ")}`);
console.log("独立性と副作用の範囲: 合格");
