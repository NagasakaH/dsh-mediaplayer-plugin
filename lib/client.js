// dsh-mediaplayer-plugin — ブラウザ側。workspace の音声・動画を右 Sidebar のプレビュータブで鳴らす。
//
// バイトを JS に取り込まない。<audio>/<video> の src に /api/file の HTTP URL を直接向け、
// 取得も再生もブラウザに任せる（Blob URL も Range endpoint も作らない）。
// 依存は react と react/jsx-runtime の2つだけ。他のプラグインが所有している系統
// （発話側の再生制御、ブラウザ側の永続設定、window 上の状態、よその <audio> 要素）には触れない。

window.__ModuleLoader__.load({
	id: "dsh-mediaplayer-plugin",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const react = require("react");
		const react_jsx_runtime = require("react/jsx-runtime");

		const ID = "dsh-mediaplayer-plugin";
		const NS = "dshMediaPlayer";

		// 1枚の表。登録する拡張子・binaryExtensions・描画する要素はここからだけ出す。
		// mkv と avi は入れていない: Chromium が再生できないので、登録しないほうが
		// 既存の「プレビュー非対応」表示として正しく出る。
		const AUDIO_SUFFIXES = ["mp3", "wav", "ogg", "oga", "opus", "m4a", "aac", "flac"];
		const VIDEO_SUFFIXES = ["mp4", "m4v", "mov", "webm"];
		const PLAYERS = [
			{ element: "audio", extensions: AUDIO_SUFFIXES },
			{ element: "video", extensions: VIDEO_SUFFIXES }
		];
		const EXTENSIONS = PLAYERS.flatMap((player) => player.extensions);
		// 音声も動画も、バイトは読めるテキストではない。
		const BINARY_EXTENSIONS = EXTENSIONS;
		// registry.d.ts の約束（binaryExtensions の全要素は extensions に含まれる）。
		for (const extension of BINARY_EXTENSIONS) {
			if (!EXTENSIONS.includes(extension)) throw new Error(`mediaplayer: "${extension}" が extensions に無い`);
		}

		// /api/file は ctx.attachments.imageLimits.maxImageBytes（通常 20 MiB）超に 413 を返す。
		// サーバーの 413 を待つより先に画面で示すため、同じ上限をこちらでも持つ。
		const MAX_PLAYABLE_BYTES = 20 * 1024 * 1024;

		const zh = {
			"title": "媒体播放",
			"waiting": "正在准备播放…",
			"error.readFailed": "无法读取该文件：{message}",
			"error.tooLarge": "文件为 {size}，超过可播放上限 {limit}",
			"error.noPath": "无法解析该文件在 Host 上的路径",
			"error.unsupported": "暂不支持该格式的播放",
			"error.playFailed": "未能从服务器取得该文件（超过 {limit} 的文件无法取得），或浏览器不支持该编码"
		};
		const en = {
			"title": "Media player",
			"waiting": "Preparing playback…",
			"error.readFailed": "Could not read this file: {message}",
			"error.tooLarge": "The file is {size}, over the {limit} playback limit",
			"error.noPath": "The file's Host path could not be resolved",
			"error.unsupported": "This format cannot be played here",
			"error.playFailed": "The file could not be fetched from the server (files over {limit} are not served), or the browser cannot play this encoding"
		};

		/** ユーザーが読む形に直す。上限と同じ MiB 単位で比べられるように MB まで出す。 */
		function humanBytes(bytes) {
			if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
			if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
			return `${bytes} B`;
		}

		// registry の suffix 規則に合わせる（小文字化し、`\` も区切りとして扱う）。
		function playerFor(path) {
			const name = path.replaceAll("\\", "/").toLowerCase();
			const file = name.slice(name.lastIndexOf("/") + 1);
			return PLAYERS.find((player) => player.extensions.some((extension) => file.endsWith(`.${extension}`)));
		}

		function playUrl(absolutePath, version) {
			// fileMediaUrl と違い v を足す。サーバーは no-store を返すが、要素側が同じ URL を
			// 使い回して書き換え前のファイルを再生し続けるため、version を URL に焼く。
			return new URL(`api/file?path=${encodeURIComponent(absolutePath)}&v=${encodeURIComponent(version)}`, document.baseURI).href;
		}

		/** snapshot だけで決まる6状態。waiting / read-failed / too-large / no-path / unsupported / ready。 */
		function derive(snapshot) {
			if (snapshot.status === "none" || snapshot.status === "loading") return { phase: "waiting" };
			if (snapshot.status === "failed") return { phase: "read-failed", message: snapshot.failure?.message ?? "" };
			const stat = snapshot.value;
			if (stat === void 0) return { phase: "waiting" };
			if (typeof stat.bytes === "number" && stat.bytes > MAX_PLAYABLE_BYTES) return { phase: "too-large", bytes: stat.bytes };
			if (typeof stat.absolutePath !== "string" || stat.absolutePath.length === 0) return { phase: "no-path" };
			const player = playerFor(stat.absolutePath);
			// 表を通らない拡張子は描く要素を決められない。registry とこの表は同じ出所なので通常は来ない。
			if (player === void 0) return { phase: "unsupported" };
			return { phase: "ready", url: playUrl(stat.absolutePath, stat.version), element: player.element, version: stat.version };
		}

		const css = [
			".dshmp_frame{box-sizing:border-box;min-height:100%;font-family:var(--dsw-font,sans-serif);color:var(--dsw-alias-label-primary);flex-direction:column;justify-content:center;align-items:center;gap:12px;padding:16px;display:flex}",
			".dshmp_media{box-sizing:border-box;border-radius:var(--dsw-radius-md,6px);width:100%;display:block}",
			// 縦に引き伸ばさない。余白は黒ではなくテーマ色に溶かす。
			".dshmp_video{height:auto;max-height:70vh;object-fit:contain;background:var(--dsw-alias-bg-layer-1,transparent)}",
			".dshmp_audio{max-width:520px}",
			".dshmp_status{color:var(--dsw-alias-label-secondary);text-align:center;white-space:normal;margin:0;padding:0 10px;font-size:var(--dsh-content-font-size-secondary,13px);line-height:1.6}"
		].join("");
		const tagId = "dsh-mediaplayer-plugin/MediaBody.css";
		if (typeof document !== "undefined" && document.querySelector(`style[data-plugin-css=${JSON.stringify(tagId)}]`) === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = ID;
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		function MediaBody(props) {
			const { content, resourceAddress, t } = props;
			// keyed hook の第1引数は address そのもの。protocol は型引数だけの約束。
			const snapshot = props.useResource(resourceAddress);
			const state = derive(snapshot);
			const request = content.kind === "renderer" ? content : void 0;
			const [failedUrl, setFailedUrl] = react.useState();
			// owner は content をレンダーごとに作り直す場合がある。報告は (revision, phase, version)
			// の組に対して1回だけにして、loaded の連発を防ぐ。
			const reported = react.useRef();
			react.useEffect(() => {
				if (request === void 0) return;
				// waiting と too-large では何も報告しない。ready 以外で loaded を呼ぶと
				// 共有のローディングが早く終わってしまう。
				if (state.phase !== "read-failed" && state.phase !== "no-path" && state.phase !== "unsupported" && state.phase !== "ready") return;
				const key = `${request.revision}|${state.phase}|${state.version ?? ""}`;
				if (reported.current === key) return;
				reported.current = key;
				if (state.phase === "ready") request.loaded(state.version);
				else request.failed();
			}, [request, state.phase, state.version]);
			const frame = (children) => (0, react_jsx_runtime.jsx)("div", { className: "dshmp_frame", children });

			if (state.phase === "waiting") return frame((0, react_jsx_runtime.jsx)("p", { className: "dshmp_status", children: t("waiting") }));
			if (state.phase === "too-large") {
				return frame((0, react_jsx_runtime.jsx)("p", { role: "alert", className: "dshmp_status", children: t("error.tooLarge", { size: humanBytes(state.bytes), limit: humanBytes(MAX_PLAYABLE_BYTES) }) }));
			}
			if (state.phase === "no-path") return frame((0, react_jsx_runtime.jsx)("p", { role: "alert", className: "dshmp_status", children: t("error.noPath") }));
			if (state.phase === "unsupported") return frame((0, react_jsx_runtime.jsx)("p", { role: "alert", className: "dshmp_status", children: t("error.unsupported") }));
			if (state.phase === "read-failed") return frame((0, react_jsx_runtime.jsx)("p", { role: "alert", className: "dshmp_status", children: t("error.readFailed", { message: state.message }) }));
			// HTTP のステータスは要素に届かない（413 でも MEDIA_ERR_SRC_NOT_SUPPORTED）。
			// 取得失敗も不支持の符号もこの1行にまとめる。
			if (failedUrl === state.url) {
				return frame((0, react_jsx_runtime.jsx)("p", { role: "alert", className: "dshmp_status", children: t("error.playFailed", { limit: humanBytes(MAX_PLAYABLE_BYTES) }) }));
			}
			// key に url を入れて、version が動いたら要素ごと作り直す。
			return frame((0, react_jsx_runtime.jsx)(state.element, {
				className: `dshmp_media ${state.element === "video" ? "dshmp_video" : "dshmp_audio"}`,
				src: state.url,
				controls: true,
				preload: "metadata",
				onError: () => {
					setFailedUrl(state.url);
				}
			}, state.url));
		}

		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "mediaplayer: dictionaries");
			ctx.effect(() => ctx.documentPreviews.register({
				id: ID,
				extensions: EXTENSIONS,
				binaryExtensions: BINARY_EXTENSIONS,
				priority: "extension",
				title: () => t("title"),
				loading: "renderer",
				wrap: false
			}), "mediaplayer: metadata");
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: ID,
				locale: NS
			}, MediaBody)), "mediaplayer: body");
		}

		exports.apply = apply;
		exports.inject = ["documentPreviews", "slots", "locale"];
		return module.exports;
	}
});
