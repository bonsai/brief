/**
 * brief/view/render.ts
 *
 * キャッシュ JSON を読んでブリーフパネルを描画する。
 * PS1 版 Show-StartupBrief の Deno 移植。
 *
 * Usage:
 *   deno run --allow-read --allow-env render.ts
 *   deno run --allow-read --allow-env render.ts --width 100
 */

import { parseArgs } from "@std/cli/parse-args";
import { join } from "@std/path";
import { readBriefCache } from "../model/cache.ts";
import { loadSettings } from "../model/paths.ts";
import { head, sec, txt, gap, printPanel, type BriefLine } from "./panel.ts";

// ----------------------------------------------------------
// Args
// ----------------------------------------------------------

const args       = parseArgs(Deno.args);
const settings   = loadSettings();
const cachePath  = (args.path as string | undefined) ?? settings.paths.cache;
const journalDir = (args.journal as string | undefined) ?? settings.paths.journal;

/** journal 配下を浅く辿ってファイル名を返す */
async function* walk(dir: string, depth: number): AsyncGenerator<{ name: string; path: string }> {
  if (depth > 3) return;
  let entries: AsyncIterable<Deno.DirEntry>;
  try { entries = Deno.readDir(dir); } catch { return; }
  for await (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory) yield* walk(p, depth + 1);
    else yield { name: e.name, path: p };
  }
}

function getTermWidth(): number {
  try { return Deno.consoleSize().columns; } catch { return 80; }
}
const termWidth = (args.width as number | undefined) ?? getTermWidth();

// ----------------------------------------------------------
// Load cache
// ----------------------------------------------------------

const cache = await readBriefCache(cachePath);

// ----------------------------------------------------------
// Build lines
// ----------------------------------------------------------

const now   = new Date();
const today = now.toISOString().slice(0, 10);
const hhmm  = now.toTimeString().slice(0, 5);

const lines: BriefLine[] = [];

lines.push(head(`🌸 good morning, soubi!  ${today}  ${hhmm}`));
lines.push(sec("🧩 env"));

// env line
const toolParts: string[] = [];
// PS1 が書く python は cache.python.version にあるが env には別途取る必要があるため
// ここではキャッシュから読める分だけ表示
if (cache.python)          toolParts.push(`python ${cache.python.version.replace(/^Python\s*/i, "")}`);
if (cache.opencode?.installed) toolParts.push(`opencode ${cache.opencode.installed}`);
if (toolParts.length === 0) toolParts.push("（env キャッシュ未取得 — brief -Refresh を実行）");
lines.push(txt(toolParts.join("  ·  ")));

// wsl line
if (cache.wsl?.distros?.length) {
  const wslParts = cache.wsl.distros.map(
    (d) => `${d.name} ${d.state === "Running" ? "▶" : "■"}`,
  );
  lines.push(txt("wsl  " + wslParts.join("  ·  ")));
}

lines.push(gap());

// recap — journal 配下の最新 recap-*.md を探す
lines.push(sec("📓 recap"));
const recapFiles: string[] = [];
try {
  for await (const e of walk(journalDir, 0)) {
    if (/^recap-\d{4}-\d{2}-\d{2}\.md$/.test(e.name)) recapFiles.push(e.path);
  }
} catch { /* journal 未作成ならそのまま */ }

if (recapFiles.length === 0) {
  lines.push(txt("日報がまだ無いよ"));
}
else {
  recapFiles.sort();
  const latest = recapFiles[recapFiles.length - 1]!;
  lines.push(txt(latest.replace(/^.*recap-|\.md$/g, "")));
  try {
    const heads = (await Deno.readTextFile(latest))
      .split(/\r?\n/)
      .filter((l) => /^##\s/.test(l))
      .map((l) => l.replace(/^##\s*/, "").trim())
      .filter((t) => !/^新規スキル/.test(t))
      .slice(0, 3);
    if (heads.length === 0) lines.push(txt("（見出しなし）"));
    else for (const h of heads) lines.push(txt(h));
  } catch { lines.push(txt("（読み込み失敗）")); }
}

lines.push(gap());

// next
lines.push(sec("🎯 next"));

const oc = cache.opencode;
if (oc?.installed && oc?.latest) {
  if (oc.installed !== oc.latest) {
    lines.push(txt(`⬆️  opencode ${oc.installed} → ${oc.latest}   \`opencode upgrade\``));
  } else {
    lines.push(txt(`✅  opencode ${oc.installed} は最新`));
  }
} else {
  lines.push(txt("❓  opencode の version 未取得（brief -Refresh）"));
}

if (cache.due) {
  const { due, total, next } = cache.due;
  if (due > 0) {
    lines.push(txt(`📖  復習 due ${due} / ${total} 語   \`wo --count 10\``));
  } else {
    lines.push(txt(`🌱  復習 due 0 / ${total} 語${next ? `（次は ${next}）` : ""}`));
  }
}

// ----------------------------------------------------------
// Render
// ----------------------------------------------------------

printPanel(lines, { termWidth });
