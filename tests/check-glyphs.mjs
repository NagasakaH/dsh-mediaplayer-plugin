#!/usr/bin/env node
// 日本語の文章に中国語簡体字が混ざっていないか確かめる。
//
// 完全な判定は JIS X 0213 の字体セットを引ける必要があり、Node にはその符号化が
// ありません。ここでは混入する実字形を符号点の表として持ちます。文字リテラルで
// 書くとこの検査が自分の表に引っかかるので、符号点だけを持つ形にしています。
//
// JIS 表を引ける検査器がある場合は、CN_GLYPH_CHECKER にそのパスを渡します。そうすると
// 同じ対象に対してそれも走ります。渡さない場合は上の表だけで判定します。
//
// 使う。ビルドも package の install も要らない。
//     node tests/check-glyphs.mjs
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 日本語の常用表記が別字なので、文章に現れれば混入とみなす。
const ERROR_CODES = new Set([
  0x4e1a, 0x4e1c, 0x4e3a, 0x4e66, 0x4e70, 0x4e8e, 0x4eec, 0x4ef7,
  0x5173, 0x51fb, 0x521b, 0x5220, 0x52a1, 0x52a8, 0x53d1, 0x53d8,
  0x542c, 0x54cd, 0x56fe, 0x5907, 0x590d, 0x5b9e, 0x5bf9, 0x5c9b,
  0x5e94, 0x5f55, 0x6001, 0x62e9, 0x65f6, 0x663e, 0x6682, 0x672f,
  0x6743, 0x6781, 0x68c0, 0x6d4f, 0x73b0, 0x7535, 0x7801, 0x7ecf,
  0x7edc, 0x7f16, 0x89c8, 0x8bb0, 0x8bb8, 0x8bdd, 0x8be5, 0x8bed,
  0x8bef, 0x8bf4, 0x8bf7, 0x8bfb, 0x8d25, 0x8d44, 0x8f66, 0x8fc1,
  0x8fc7, 0x8fd9, 0x8fdb, 0x8fde, 0x9009, 0x9519, 0x957f, 0x95e8,
  0x95ed, 0x95f4, 0x95fb, 0x9875, 0x98ce, 0x98de, 0x9a6c, 0x9a8c,
  0x9c7c, 0x9e1f,
]);
// 日本語の字としても成立するものなので、警告に留める。
const WARN_CODES = new Set([
  0x4e91, 0x65e0, 0x673a, 0x68a6, 0x9633, 0x9634,
]);

const targets = [
	"README.md",
	"fixtures/README.md",
	"lib/index.js",
	"cordis.patch.yml",
	"scripts/install.sh",
	"tests/check-independence.mjs",
	"tests/check-glyphs.mjs",
	"tests/make-fixtures.sh",
];

let errors = 0;
let warns = 0;

function scan(text, label) {
	const lines = text.split("\n");
	for (let i = 0; i < lines.length; i += 1) {
		let col = 0;
		for (const ch of lines[i]) {
			col += 1;
			const code = ch.codePointAt(0);
			const level = ERROR_CODES.has(code) ? "error" : WARN_CODES.has(code) ? "warn" : null;
			if (!level) continue;
			if (level === "error") errors += 1;
			else warns += 1;
			console.log(`${label}:${i + 1}:${col}: [${level}] ${ch} (U+${code.toString(16).toUpperCase()})`);
		}
	}
}

// lib/client.js の zh 辞書は中国語の UI 文案なので簡体字が正しい。日本の字形に
// 直してはいけない。同じ罠に次回がかからないよう、辞書ブロックだけを落としてから
// 見る。regex の崩れで除外が静かに効かなくならないよう、当たらない場合は失敗する。
const clientPath = join(repo, "lib/client.js");
const zhBlock = /\n[ \t]*const zh = \{[\s\S]*?\n[ \t]*\};\n/g;

function clientWithoutZh() {
	const text = readFileSync(clientPath, "utf8");
	const cut = text.replace(zhBlock, "\n");
	if (cut === text) {
		console.error("NG: lib/client.js の zh 辞書が見つからない。この検査の除外規則を直してください");
		process.exit(1);
	}
	return cut;
}

if (existsSync(clientPath)) {
	scan(clientWithoutZh(), "lib/client.js（zh 辞書を除く部分）");
}

const existing = targets.filter((file) => existsSync(join(repo, file)));
for (const file of existing) {
	scan(readFileSync(join(repo, file), "utf8"), file);
}

// JIS 表を引ける検査器があれば、CN_GLYPH_CHECKER でそのパスを渡す。既定では表だけで
// 判定する。既定の場所を推測しないほうが、その場所が無い環境で原因が分かりやすい。
const external = process.env.CN_GLYPH_CHECKER ?? "";
if (external && existsSync(external)) {
	const dir = mkdtempSync(join(tmpdir(), "dshmp-glyphs-"));
	const stripped = join(dir, "client.js");
	writeFileSync(stripped, clientWithoutZh());
	const run = spawnSync(external, [...existing.map((file) => join(repo, file)), stripped], { encoding: "utf8" });
	rmSync(dir, { recursive: true, force: true });
	if (run.status !== 0) {
		errors += 1;
		process.stdout.write(run.stdout ?? "");
	}
	console.log(`JIS 表を引く外部検査器: ${external}`);
} else {
	console.log("JIS 表を引く外部検査器: 無し。上の表での判定");
}

if (errors === 0) {
	console.log(`日本の字形: 合格（警告 ${warns} 件）`);
	process.exit(0);
}
console.error(`日本の字形: NG（${errors} 件、警告 ${warns} 件）`);
process.exit(1);
