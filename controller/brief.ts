/**
 * brief/controller/brief.ts
 *
 * 表示内容の正本。view（render.ts / tui.tsx）はここだけを読む。
 * 「cache を何かの行に翻訳する」処理は全部この層に置き、
 * view は「並べ方を決める」ことだけ 담당する。
 *
 * 5 つのセクションは**すべて同じ形**（SectionData 派生）にする。
 * どれかが string[]、どれかが number だと、ここを直しても片方の view が壊れる。
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
// 1. Sections — 全部同じ形
// ==========================================================

export type Section = "env" | "recap" | "next" | "lexicon" | "issue";

export const SECTIONS: readonly Section[] = ["env", "recap", "next", "lexicon", "issue"];

export const SECTION_LABELS: Record<Section, string> = {
  env:     "🧩 env",
  recap:   "📓 recap",
  next:    "🎯 next",
  lexicon: "📚 lexicon",
  issue:   "🧩 issue",
};

/** すべてのセクションが持つ最低の契約。 */
export interface SectionData {
  readonly id: Section;
  readonly label: string;
  /** 表示する行。view はこれだけ読む。 */
  readonly lines: readonly string[];
}

export interface EnvInfo extends SectionData {
  readonly id: "env";
  /** "python 3.13.14  ·  opencode 1.18.34" */
  readonly tools: string;
  /** "Ubuntu ▶  ·  docker-desktop ■"（無ければ空） */
  readonly wsl: string;
  /** cache が読めたか */
  readonly hasCache: boolean;
}

export interface RecapInfo extends SectionData {
  readonly id: "recap";
  readonly file: string | null;
  readonly date: string | null;
  /** ## 見出し（"新規スキル" は除く） */
  readonly heads: readonly string[];
  /** 本文を整形した行（heads とは別の、スクロール用の長い方） */
  readonly body: readonly string[];
}

export interface NextInfo extends SectionData {
  readonly id: "next";
  readonly opencode: readonly string[];
  readonly lexicon: readonly string[];
  readonly journal: string;
  readonly issue: readonly string[];
}

export interface LexiconInfo extends SectionData {
  readonly id: "lexicon";
  readonly total: number;
  readonly due: number;
  readonly next: string | null;
  readonly hasCache: boolean;
}

export interface IssueInfo extends SectionData {
  readonly id: "issue";
  readonly count: number;
  /** どこから読んだか */
  readonly source: "md" | "jsonl" | "none";
  /** IT-001 のように並べた id */
  readonly ids: readonly string[];
}

export type AnySection = EnvInfo | RecapInfo | NextInfo | LexiconInfo | IssueInfo;

// ==========================================================
// 2. Model — 5 セクションを全部持つ
// ==========================================================

export interface BriefModel {
  readonly env: EnvInfo;
  readonly recap: RecapInfo;
  readonly next: NextInfo;
  readonly lexicon: LexiconInfo;
  readonly issue: IssueInfo;
  /** yyyy-MM-dd（ローカル） */
  readonly today: string;
  /** HH:mm（ローカル） */
  readonly hhmm: string;
}

// ==========================================================
// 3. Panel rows — 描画用の行
// ==========================================================

export type PanelKind = "head" | "sec" | "txt" | "gap";
export interface PanelRow {
  kind: PanelKind;
  text: string;
}

export function head(text: string): PanelRow { return { kind: "head", text }; }
export function sec(text: string): PanelRow  { return { kind: "sec",  text }; }
export function txt(text: string): PanelRow  { return { kind: "txt",  text }; }
export function gap(): PanelRow              { return { kind: "gap",  text: "" }; }

// ==========================================================
// 4. Helpers
// ==========================================================

const mark = (running: boolean) => (running ? "▶" : "■");

/** ローカル日付の yyyy-MM-dd。`toISOString()` は UTC なので使わない。 */
export function localDate(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** ローカル時刻の HH:mm。 */
export function localTime(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getHours())}:${p(now.getMinutes())}`;
}

/** ヘッダ行。 */
export function headerLine(m: BriefModel): string {
  return `🌸 good morning, soubi!  ${m.today}  ${m.hhmm}`;
}

const pad3 = (n: number) => String(n).padStart(3, "0");

// ==========================================================
// 5. Builders — 各セクションのオブジェクトを作る
// ==========================================================

export function buildEnv(cache: BriefCache): EnvInfo {
  const parts: string[] = [];
  if (cache.python)             parts.push(`python ${cache.python.version.replace(/^Python\s*/i, "")}`);
  if (cache.opencode?.installed) parts.push(`opencode ${cache.opencode.installed}`);
  const tools = parts.length ? parts.join("  ·  ") : "（env キャッシュ未取得 — brief -Refresh）";

  const distros = cache.wsl?.distros ?? [];
  const wsl = distros.length
    ? distros.map((d) => `${d.name} ${mark(d.state === "Running")}`).join("  ·  ")
    : "";

  const lines = [`tools  ${tools}`, ""];
  lines.push(wsl ? `wsl    ${wsl}` : "wsl    （未取得 — brief -Refresh）");

  return { id: "env", label: SECTION_LABELS.env, lines, tools, wsl, hasCache: parts.length > 0 };
}

export function buildLexicon(cache: BriefCache): LexiconInfo {
  const d = cache.due;
  if (!d) {
    return {
      id: "lexicon",
      label: SECTION_LABELS.lexicon,
      lines: ["（lexicon キャッシュ未取得）"],
      total: 0,
      due: 0,
      next: null,
      hasCache: false,
    };
  }
  const lines = [
    `総語数:   ${d.total}`,
    `due 今日: ${d.due}`,
    `次回:     ${d.next ?? "なし"}`,
    ...(d.due > 0 ? ["", "▶  wo --count 10"] : []),
  ];
  return {
    id: "lexicon",
    label: SECTION_LABELS.lexicon,
    lines,
    total: d.total,
    due: d.due,
    next: d.next,
    hasCache: true,
  };
}

/** recap の見出しと本文を 1 本のテキストから作る。 */
export function parseRecapBody(date: string | null, raw: string): RecapInfo {
  const heads: string[] = [];
  const body: string[] = [`── ${date} ──`, ""];

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trimEnd();
    if (/^#\s/.test(t)) continue;
    if (/^##\s/.test(t)) {
      const h = t.replace(/^##\s*/, "").trim();
      if (!/^新規スキル/.test(h)) heads.push(h);
      body.push("", `▌ ${h}`);
      continue;
    }
    if (/^---/.test(t) || !t.trim()) continue;
    body.push(`  ${t.replace(/^[-*]\s+/, "· ")}`);
  }

  return {
    id: "recap",
    label: SECTION_LABELS.recap,
    file: null,
    date,
    heads,
    body,
    lines: body.length > 2 ? body : [`${date}（本文なし）`],
  };
}

export function buildNext(
  cache: BriefCache,
  recapDate: string | null,
  today: string,
  issue: IssueInfo,
): NextInfo {
  const oc = cache.opencode;
  const opencode: string[] = [];

  if (oc?.installed && oc.latest && oc.installed !== oc.latest) {
    opencode.push(`⬆️  opencode ${oc.installed} → ${oc.latest}`, "      opencode upgrade");
  } else if (oc?.installed) {
    opencode.push(`✅  opencode ${oc.installed} は最新`);
  } else {
    opencode.push("❓  opencode の version 未取得（brief -Refresh）");
  }

  const lexicon: string[] = [];
  if (cache.due) {
    const d = cache.due;
    lexicon.push(
      d.due > 0
        ? `📖  復習 due ${d.due} / ${d.total} 語   wo --count 10`
        : `🌱  復習 due 0 / ${d.total} 語${d.next ? `（次は ${d.next}）` : ""}`,
    );
  }

  const journal = recapDate === today
    ? `📔  今日の日報 OK（${today}）`
    : "📔  今日の日報が無い → 作ろう（journal へ追記）";

  const issueLines = issue.count > 0
    ? [`🧩  Issue Type Ledger: IT-001〜IT-${pad3(issue.count)}`]
    : [];

  return {
    id: "next",
    label: SECTION_LABELS.next,
    lines: [...opencode, ...lexicon, journal, ...issueLines],
    opencode,
    lexicon,
    journal,
    issue: issueLines,
  };
}

export function buildIssue(count: number, source: IssueInfo["source"], ids: string[]): IssueInfo {
  const lines = count === 0
    ? ["（Issue Type Ledger がまだ無い）"]
    : [
      `件数:   ${count}`,
      `読み元: ${{ md: "issue-types.md", jsonl: "issue-types.jsonl", none: "—" }[source]}`,
      "",
      ...ids.map((id) => `  ${id}`),
    ];

  return { id: "issue", label: SECTION_LABELS.issue, lines, count, source, ids };
}

/** 空の recap。journal が無いときの正本。 */
export function emptyRecap(): RecapInfo {
  return {
    id: "recap",
    label: SECTION_LABELS.recap,
    file: null,
    date: null,
    heads: [],
    body: [],
    lines: ["日報がまだ無いよ"],
  };
}

/**
 * 読み込みが何かの理由で失敗したときのモデル。
 * view 側はこれで 1 行拥有一致できる（fallback を二重に書かない）。
 */
export function emptyModel(now: Date = new Date(), reason = "（読み込み失敗）"): BriefModel {
  const issue = buildIssue(0, "none", []);
  const recap: RecapInfo = { ...emptyRecap(), lines: [reason] };
  return {
    env: {
      id: "env",
      label: SECTION_LABELS.env,
      lines: [reason],
      tools: "",
      wsl: "",
      hasCache: false,
    },
    recap,
    next: {
      id: "next",
      label: SECTION_LABELS.next,
      lines: [reason],
      opencode: [],
      lexicon: [],
      journal: "",
      issue: [],
    },
    lexicon: {
      id: "lexicon",
      label: SECTION_LABELS.lexicon,
      lines: [reason],
      total: 0,
      due: 0,
      next: null,
      hasCache: false,
    },
    issue: { ...issue, lines: [reason] },
    today: localDate(now),
    hhmm: localTime(now),
  };
}

// ==========================================================
// 6. Access
// ==========================================================

export function getSection(m: BriefModel, id: Section): AnySection {
  return m[id];
}

/** TUI 用。セクション名で行の配列を引く。 */
export function buildSection(m: BriefModel, id: Section): readonly string[] {
  return m[id].lines;
}

// ==========================================================
// 7. Panel — 1 画面分の行（render.ts の正本）
// ==========================================================

export function buildPanel(m: BriefModel): PanelRow[] {
  const rows: PanelRow[] = [];

  rows.push(head(headerLine(m)));

  for (const id of ["env", "recap", "next"] as const) {
    const s: AnySection = m[id];
    const suffix = id === "recap" && "date" in s && s.date ? `  ${s.date}` : "";
    rows.push(sec(`${s.label}${suffix}`));

    // recap は全文が長いので、パネルでは見出し 3 つだけ出す（TUI は全文スクロール）
    // journal が無いときは lines（＝案内文）をそのまま出す
    if (id === "recap" && "heads" in s && s.file !== null) {
      if (s.heads.length === 0) rows.push(txt(`${s.date}（見出しなし）`));
      else for (const h of s.heads.slice(0, 3)) rows.push(txt(h));
    } else {
      for (const l of s.lines) rows.push(txt(l));
    }

    if (id !== "next") rows.push(gap());
  }

  return rows;
}

// ==========================================================
// 8. Loading — journal と issues を読む
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

/** 最新の recap を探す。ファイル名の降順（=日付降順）で最後が最新。 */
export async function findLatestRecap(journalDir: string): Promise<string | null> {
  const found: { name: string; path: string }[] = [];
  for await (const e of walk(journalDir, 0)) {
    if (RECAP_RE.test(e.name)) found.push(e);
  }
  if (!found.length) return null;
  found.sort((a, b) => a.name.localeCompare(b.name));
  return found[found.length - 1]!.path;
}

/** journal を読む。壊れていても例外を投げない。 */
export async function loadRecap(journalDir: string): Promise<RecapInfo> {
  const empty = emptyRecap();

  let path: string | null = null;
  try { path = await findLatestRecap(journalDir); } catch { return empty; }
  if (!path) return empty;

  const date = RECAP_RE.exec(path.split(/[\\/]/).pop() ?? "")?.[1] ?? null;
  try {
    const parsed = parseRecapBody(date, await Deno.readTextFile(path));
    return { ...parsed, file: path };
  } catch {
    return { ...empty, file: path, date, lines: ["（日報の読み込みに失敗）"] };
  }
}

/** issue-types.md を数える。無ければ jsonl、それも無ければ 0。 */
export async function loadIssue(
  issuesMd: string,
  issuesJsonl: string,
): Promise<{ count: number; source: IssueInfo["source"]; ids: string[] }> {
  try {
    const raw = await Deno.readTextFile(issuesMd);
    const ids = [...new Set(raw.match(/\bIT-\d{3}\b/g) ?? [])].sort();
    if (ids.length) return { count: ids.length, source: "md", ids };
    return { count: 0, source: "md", ids: [] };
  } catch { /* md は無いか壊れている */ }

  try {
    const raw = await Deno.readTextFile(issuesJsonl);
    const n = raw.split(/\r?\n/).filter((l) => l.trim()).length;
    return { count: n, source: "jsonl", ids: [] };
  } catch { return { count: 0, source: "none", ids: [] }; }
}

// ==========================================================
// 9. Entry point
// ==========================================================

export interface LoadOptions {
  cache?: BriefCache;
  journalDir?: string;
  issuesMd?: string;
  issuesJsonl?: string;
  /** テスト用に時刻を固定できる */
  now?: Date;
}

/**
 * 全部読んで 5 セクションのモデルを返す。
 * どこかが壊れていても既定値で埋めて返す（起動を止めない）。
 */
export async function loadModel(opts: LoadOptions = {}): Promise<BriefModel> {
  const s = loadSettings();
  const now = opts.now ?? new Date();
  const today = localDate(now);

  const cache = opts.cache ?? {};
  const recap = await loadRecap(opts.journalDir ?? s.paths.journal);
  const raw = await loadIssue(
    opts.issuesMd ?? s.paths.issuesMd,
    opts.issuesJsonl ?? s.paths.issuesJsonl,
  );

  return {
    env: buildEnv(cache),
    recap,
    next: buildNext(cache, recap.date, today, buildIssue(raw.count, raw.source, raw.ids)),
    lexicon: buildLexicon(cache),
    issue: buildIssue(raw.count, raw.source, raw.ids),
    today,
    hhmm: localTime(now),
  };
}