/**
 * brief/view/render.ts
 *
 * キャッシュ JSON を読んでブリーフパネルを描画する。
 * 表示内容は controller/brief.ts が正本。ここでは並べ方だけを決める。
 *
 * Usage:
 *   deno run --allow-read --allow-env view/render.ts
 *   deno run --allow-read --allow-env view/render.ts --width 100
 */

import { parseArgs } from "@std/cli/parse-args";
import { readBriefCache } from "../model/cache.ts";
import { loadSettings } from "../model/paths.ts";
import { buildPanel, loadModel, type BriefModel } from "../controller/brief.ts";
import { printPanel } from "./panel.ts";

const args      = parseArgs(Deno.args);
const settings  = loadSettings();
const cachePath = (args.path as string | undefined) ?? settings.paths.cache;

function getTermWidth(): number {
  try { return Deno.consoleSize().columns; } catch { return 80; }
}
const termWidth = (args.width as number | undefined) ?? getTermWidth();

// ---- 読むだけ。組み立ては controller ----
const cache = await readBriefCache(cachePath);

let model: BriefModel;
try {
  model = await loadModel({ cache });
} catch {
  // controller が何に失敗しても最低限のモデルで描画する
  const now = new Date();
  model = {
    cache,
    today: now.toISOString().slice(0, 10),
    hhmm: now.toTimeString().slice(0, 5),
    recap: { file: null, date: null, heads: [], lines: [] },
    issueCount: 0,
  };
}

printPanel(buildPanel(model), { termWidth });