// dsh-mediaplayer-plugin — host 側（Node）。
//
// プレイヤーはブラウザだけで動く。host に残る仕事は無く、この apply は cordis の Loader 行が
// パッケージを起動に組み込むための見出しとして空にする（実物
// @deepseek-ai/dsh-client-ui-sidebar-documentpreview/lib/types/index.d.ts と同じ形）。
// /api/file の配信は dsh-api-session-controller が既に持っているので、ここで経路を足さない。
export function apply() {}
