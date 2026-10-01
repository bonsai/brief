/**
 * brief/controller/brief.ts
 *
 * 表示内容の正本。view（render.ts / tui.tsx）はここだけを読む。
 * 「cache をeses 何かの行に翻訳する」処理は全部この層に置き、
 * view は「並べ方を決める」ことだけPrayする。
 *
 * 依存は model/ のみ。view/ には依存しない。
 *
 * Usage:
 *   import { loadModel, buildPanel, buildSection } from "../controller/brief.ts";
 *   const m = await loadModel();
 *   printPanel(buildPanel(m), { termWidth });
 */

import { join } from "@std/path";
import type { BriefCache } from "../model/cache.ts";
import { loadSettings } from "../model/paths.ts";

// ==========================================================
// 1. Types
// ==========================================================

export type Section = "env" | "recap" | "next" | "lexicon";

export const SECTIONS: readonly Section[] = ["env", "recap", "next", "lexicon"];

export const SECTION_LABELS: Record<Section, string> = {
  env:     "🧩 env",
  recap:   "📓 recap",
  next:    "🎯 next",
  lexicon: "📚 lexicon",
};

/** パネルの 1 行。描画の都合ではなくドメインの意味で決める。 */
export type PanelKind = "head" | "sec" | "txt" | "gap";
export interface PanelRow {
  kind: PanelKind;
  text: string;
}

export interface RecapInfo {
  /** 見つかったファイル（無ければ null） */
  file: string | null;
  /** ファイル名から取った日付（無ければ null） */
  date: string | null;
  /** 見出し（## のみ。新規スキルは除く） */
  heads: string[];
  /** TUI 用に整形した全文行 */
  lines: string[];
}

export interface BriefModel {
  cache: BriefCache;
  /** yyyy-MM-dd */
  today: string;
  /** HH:mm */
  hhmm: string;
  recap: RecapInfo;
  /** issue-types.md があればその行数。無ければ 0 */
  issueCount: number;
}

// ==========================================================
// 2. Row builders（意味 → 行）
// ==========================================================

export function head(text: string): PanelRow { return { kind: "head", text }; }
export function sec(text: string): PanelRow  { return { kind: "sec",  text }; }
export function txt(text: string): PanelRow  { return { kind: "txt",  text }; }
export function gap(): PanelRow              { return { kind: "gap",  text: "" }; }

const mark = (running: boolean) => (running ? "▶" : "■");

/**
 * ローカル日付の yyyy-MM-dd。
 * `toISOString()` は UTC なので JST の 0:00-9:00 で日付が 1 日ずれる。
 * 「今日の日報」の判定に使うのでローカル表記が必須。
 */
export function localDate(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** ローカル時刻の HH:mm。 */
export function localTime(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getHours())}:${p(now.getMinutes())}`;
}

/** ツールバージョン行。cache から読める分だけ。 */
export function toolLine(cache: BriefCache): string {
  const parts: string[] = [];
  if (cache.python)             parts.push(`python ${cache.python.version.replace(/^Python\s*/i, "")}`);
  if (cache.opencode?.installed) parts.push(`opencode ${cache.opencode.installed}`);
  return parts.length ? parts.join("  ·  ") : "（env キャッシュ未取得 — brief -Refresh）";
}

/** WSL distro 行。無ければ未取得的意思を表示。 */
export function wslLine(cache: BriefCache): string {
  if (!cache.wsl?.distros?.length) return "wsl    （未取得 — brief -Refresh）";
  return "wsl    " + cache.wsl.distros.map((d) => `${d.name} ${mark(d.state === "Running")}`).join("  ·  ");
}

/** ヘッダ行。 */
export function headerLine(m: BriefModel): string {
  return `🌸 good morning, soubi!  ${m.today}  ${m.hhmm}`;
}

// ==========================================================
// 3. Sections — 各セクションは行の配列を返す
// ==========================================================

export function envSection(cache: BriefCache): string[] {
  return [toolLine(cache), "", wslLine(cache)];
}

/**
 * next セクション。
 * opencode / lexicon / 日報 の 3 グループ。
 */
export function nextSection(m: BriefModel): string[] {
  const { cache, today } = m;
  const oc = cache.opencode;
  const out: string[] = [];

  if (oc?.installed && oc.latest && oc.installed !== oc.latest) {
    out.push(`⬆️  opencode ${oc.installed} → ${oc.latest}`, "      opencode upgrade");
  } else if (oc?.installed) {
    out.push(`✅  opencode ${oc.installed} は最新`);
  } else {
    out.push("❓  opencode の version 未取得（brief -Refresh）");
  }

  if (cache.due) {
    const d = cache.due;
    if (d.due > 0) {
      out.push(`📖  復習 due ${d.due} / ${d.total} 語   wo --count 10`);
    } else {
      out.push(`🌱  復習 due 0 / ${d.total} 語${d.next ? `（次は ${d.next}）` : ""}`);
    }
  }

  out.push(
    m.recap.date === today
      ? `📔  今日の日報 OK（${today}）`
      : "📔  今日の日報が無い → 作ろう（journal へ追記）",
  );

  return out;
}

export function recapSection(m: BriefModel): string[] {
  return m.recap.lines;
}

export function lexiconSection(cache: BriefCache): string[] {
  const d = cache.due;
  if (!d) return ["（lexicon キャッシュ未取得）"];
  return [
    `総語数:   ${d.total}`,
    `due 今日: ${d.due}`,
    `次回:     ${d.next ?? "なし"}`,
    ...(d.due > 0 ? ["", "▶  wo --count 10"] : []),
  ];
}

/** セクション名で行の配列を引く。TUI の正本。 */
export function buildSection(m: BriefModel, section: Section): string[] {
  switch (section) {
    case "env":     return envSection(m.cache);
    case "recap":   return recapSection(m);
    case "next":    return nextSection(m);
    case "lexicon": return lexiconSection(m.cache);
  }
}

// ==========================================================
// 4. Panel — 1 画面分の行（render.ts の正本）
// ==========================================================

export function buildPanel(m: BriefModel): PanelRow[] {
  const { cache } = m;
  const rows: PanelRow[] = [];

  rows.push(head(headerLine(m)));
  rows.push(sec("🧩 env"));
  rows.push(txt(toolLine(cache)));
  rows.push(txt(wslLine(cache)));
  rows.push(gap());

  rows.push(sec(`📓 recap${m.recap.date ? `  ${m.recap.date}` : ""}`));
  if (!m.recap.file) {
    rows.push(txt("日報がまだ無いよ"));
  } else if (m.recap.heads.length === 0) {
    rows.push(txt(`${m.recap.date}（見出しなし）`));
  } else {
    for (const h of m.recap.heads.slice(0, 3)) rows.push(txt(h));
  }
  rows.push(gap());

  rows.push(sec("🎯 next"));
  for (const l of nextSection(m)) rows.push(txt(l));

  if (m.issueCount > 0) {
    rows.push(txt(`🧩  Issue Type Ledger: IT-001〜IT-${String(m.issueCount).padStart(3, "0")}`));
  }

  return rows;
}

// ==========================================================
// 5. Loading — journal と issues を読む
// ==========================================================

const RECAP_RE = /^recap-(\d{4}-\d{2}-\d{2})\.md$/;

/** journal 配下を浅く辿って recap ファイルを探す。 */
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

/** 最新の recap を探す。ファイル名的降順（=日付降順）で最後が最新。 */
export async function findLatestRecap(journalDir: string): Promise<string | null> {
  const found: { name: string; path: string }[] = [];
  for await (const e of walk(journalDir, 0)) {
    if (RECAP_RE.test(e.name)) found.push(e);
  }
  if (!found.length) return null;
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found[found.length - 1]!.path;
}

/** recap ファイルの本文から表示行を作る。 */
export function parseRecap(path: string, raw: string): RecapInfo {
  const date = RECAP_RE.exec(path.split(/[\\/]/).pop() ?? "")?.[1] ?? null;
  const heads: string[] = [];
  const lines: string[] = [`── ${date} ──`, ""];

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trimEnd();
    if (/^#\s/.test(t)) continue;
    if (/^##\s/.test(t)) {
      const h = t.replace(/^##\s*/, "").trim();
      if (!/^新規スキル/.test(h)) heads.push(h);
      lines.push("", `▌ ${h}`);
      continue;
    }
    if (/^---/.test(t) || !t.trim()) continue;
    lines.push(`  ${t.replace(/^[-*]\s+/, "· ")}`);
  }

  return {
    file: path,
    date,
    heads,
    lines: lines.length > 2 ? lines : [`${date}（本文なし）`],
  };
}

/** journal を読む。壊れていても例外を投げない。 */
export async function loadRecap(journalDir: string): Promise<RecapInfo> {
  const EMPTY: RecapInfo = { file: null, date: null, heads: [], lines: ["日報がまだ無いよ"] };
  let path: string | null = null;
  try { path = await findLatestRecap(journalDir); } catch { return EMPTY; }
  if (!path) return EMPTY;
  try {
    return parseRecap(path, await Deno.readTextFile(path));
  } catch {
    return { file: path, date: null, heads: [], lines: ["（日報の読み込みに失敗）"] };
  }
}

/** issue-types.md を数える。無ければ jsonl、それも無ければ 0。 */
export async function loadIssueCount(issuesMd: string, issuesJsonl: string): Promise<number> {
  try {
    const raw = await Deno.readTextFile(issuesMd);
    const bullets = raw.match(/^\s*[-*]\s+IT-\d{3}\b/gm);
    if (bullets?.length) return bullets.length;
    return (raw.match(/\bIT-\d{3}\b/g) ?? []).length;
  } catch { /* md は無いか壊れている */ }

  try {
    const raw = await Deno.readTextFile(issuesJsonl);
    return raw.split(/\r?\n/).filter((l) => l.trim()).length;
  } catch { return 0; }
}

// ==========================================================
// 6. Entry point — 全部まとめて読む
// ==========================================================

export interface LoadOptions {
  cache?: BriefCache;
  journalDir?: string;
  issuesMd?: string;
  issuesJsonl?: string;
  /** テスト用に固定_now を渡せる */
  now?: Date;
}

/**
 * cache / journal / issues を読み、表示に必要な最短のモデルを作る。
 * どこかが壊れていても既定値で埋めて返す（起動を止めない）。
 */
export async function loadModel(opts: LoadOptions = {}): Promise<BriefModel> {
  const s = loadSettings();
  const now = opts.now ?? new Date();
  const journalDir = opts.journalDir ?? s.paths.journal;

  return {
    cache: opts.cache ?? {},
    today: localDate(now),
    hhmm: localTime(now),
    recap: await loadRecap(journalDir),
    issueCount: await loadIssueCount(
      opts.issuesMd ?? s.paths.issuesMd,
      opts.issuesJsonl ?? s.paths.issuesJsonl,
    ),
  };
}