/**
 * brief/controller/brief_test.ts
 *
 * 表示内容の正本を守る。view が何を並べても文言はここで決まる。
 *
 * このテストの重要 Terug: **5 セクションが同じ形**であること。
 * どれかが string[]、どれかが number に戻したら落ちる。
 *
 *   deno test -A
 */

import { assert, assertEquals } from "@std/assert";
import {
  SECTIONS,
  SECTION_LABELS,
  buildEnv,
  buildIssue,
  buildLexicon,
  buildNext,
  buildPanel,
  buildSection,
  emptyModel,
  emptyRecap,
  getSection,
  headerLine,
  loadIssue,
  loadModel,
  loadRecap,
  localDate,
  localTime,
  parseRecapBody,
  type BriefModel,
} from "./brief.ts";

const AT = "2026-10-01T09:53:00+09:00";
const TODAY = "2026-10-01";
const TOMORROW = "2026-10-02";

// ----------------------------------------------------------
// fixture
// ----------------------------------------------------------

function model(over: Partial<BriefModel> = {}): BriefModel {
  const m: BriefModel = {
    env:     buildEnv({}),
    recap:   emptyRecap(),
    next:    buildNext({}, null, TODAY, buildIssue(0, "none", [])),
    lexicon: buildLexicon({}),
    issue:   buildIssue(0, "none", []),
    today:   TODAY,
    hhmm:    "09:53",
  };
  return { ...m, ...over };
}

// ==========================================================
// ★ 対称性（unify の核心）
// ==========================================================

Deno.test("SECTIONS は 5 つ", () => {
  assertEquals(SECTIONS.length, 5);
  for (const s of SECTIONS) assert(SECTION_LABELS[s], `label 無し: ${s}`);
});

Deno.test("全セクションが SectionData と同じ形を持つ", () => {
  const m = model();
  for (const s of SECTIONS) {
    const sec = m[s];
    assertEquals(typeof sec.id, "string", `${s}: id が無い`);
    assertEquals(sec.id, s, `${s}: id が台帳名と不一致`);
    assertEquals(typeof sec.label, "string", `${s}: label が無い`);
    assert(Array.isArray(sec.lines), `${s}: lines が配列でない`);
    assert(sec.lines.length > 0, `${s}: lines が空`);
    for (const l of sec.lines) assertEquals(typeof l, "string", `${s}: lines に string 以外`);
  }
});

Deno.test("env / recap / issue も全部 lines を持つ（gruntelenていない）", () => {
  const m = model({
    issue: buildIssue(7, "md", ["IT-001", "IT-002"]),
  });
  for (const s of ["env", "recap", "issue"] as const) {
    assert(Array.isArray(m[s].lines), `${s} が lines を返さない`);
  }
});

Deno.test("getSection は名前で引ける", () => {
  const m = model();
  assertEquals(getSection(m, "env").id, "env");
  assertEquals(getSection(m, "issue").id, "issue");
});

Deno.test("buildSection は .lines をそのまま返す", () => {
  const m = model();
  for (const s of SECTIONS) {
    assertEquals(buildSection(m, s), m[s].lines);
  }
});

// ==========================================================
// Env
// ==========================================================

Deno.test("env: cache 空でも壊れない", () => {
  const e = buildEnv({});
  assertEquals(e.hasCache, false);
  assertEquals(e.wsl, "");
  assertEquals(e.lines.length, 3);
  assert(e.lines[0]!.includes("未取得"), e.lines[0]!);
  assert(e.lines[2]!.includes("未取得"), e.lines[2]!);
});

Deno.test("env: tools に python と opencode", () => {
  const e = buildEnv({
    python: { at: AT, version: "Python 3.13.14" },
    opencode: { at: AT, latest: "1.18.34", installed: "1.18.34" },
  });
  assertEquals(e.hasCache, true);
  assert(e.tools.includes("python 3.13.14"), e.tools);
  assert(e.tools.includes("opencode 1.18.34"), e.tools);
});

Deno.test("env: wsl は ▶ と ■ で表す", () => {
  const e = buildEnv({
    wsl: {
      at: AT,
      distros: [{ name: "Ubuntu", state: "Running" }, { name: "docker", state: "Stopped" }],
    },
  });
  assert(e.wsl.includes("Ubuntu ▶"), e.wsl);
  assert(e.wsl.includes("docker ■"), e.wsl);
});

// ==========================================================
// Recap
// ==========================================================

Deno.test("parseRecapBody: 日付と見出しを取り出す", () => {
  const md = [
    "# Recap 2026-10-01",
    "## セッション 09:53",
    "- 達成した",
    "## 新規スキル",
    "## 未達",
    "---",
  ].join("\n");
  const r = parseRecapBody("2026-10-01", md);
  assertEquals(r.id, "recap");
  assert(!r.heads.includes("新規スキル"), "「新規スキル」は除く");
  assert(r.heads.includes("セッション 09:53"), r.heads.join("|"));
  assert(r.heads.includes("未達"), r.heads.join("|"));
});

Deno.test("parseRecapBody: lines は body と一致する（本文があるとき）", () => {
  const r = parseRecapBody("2026-10-01", "## A\n本文\n");
  assertEquals(r.lines, r.body);
});

Deno.test("parseRecapBody: 本文なしなら 1 行に畳む", () => {
  const r = parseRecapBody("2026-10-01", "# 見出し 1 段しかない\n");
  assertEquals(r.heads.length, 0);
  assertEquals(r.lines.length, 1);
  assert(r.lines[0]!.includes("本文なし"), r.lines[0]!);
});

Deno.test("loadRecap は journal が無ければ空を返す", async () => {
  const r = await loadRecap("Z:/nope/not/here");
  assertEquals(r.file, null);
  assertEquals(r.date, null);
  assertEquals(r.id, "recap");
});

// ==========================================================
// Lexicon
// ==========================================================

Deno.test("lexicon: cache 無しでも壊れない", () => {
  const l = buildLexicon({});
  assertEquals(l.hasCache, false);
  assert(l.lines[0]!.includes("未取得"), l.lines[0]!);
});

Deno.test("lexicon: due > 0 でコマンドを出す", () => {
  const l = buildLexicon({ due: { date: TODAY, stamp: "s", total: 160, due: 5, next: null } });
  assertEquals(l.total, 160);
  assertEquals(l.due, 5);
  assert(l.lines.some((x) => x.includes("wo --count 10")), l.lines.join("|"));
});

// ==========================================================
// Issue
// ==========================================================

Deno.test("issue: 0 件でも lines を持つ", () => {
  const i = buildIssue(0, "none", []);
  assertEquals(i.count, 0);
  assertEquals(i.source, "none");
  assert(Array.isArray(i.lines) && i.lines.length > 0, "lines が空");
});

Deno.test("issue: md からは IT-xxx を拾って 件数にする", () => {
  const i = buildIssue(3, "md", ["IT-001", "IT-002", "IT-003"]);
  assertEquals(i.count, 3);
  assert(i.lines.some((l) => l.includes("件数:   3")), i.lines.join("|"));
  assert(i.lines.some((l) => l.includes("issue-types.md")), i.lines.join("|"));
  assert(i.lines.some((l) => l.includes("IT-003")), i.lines.join("|"));
});

Deno.test("loadIssue: md を優先し、無ければ jsonl、それも無ければ none", async () => {
  const dir = await Deno.makeTempDir();
  const md = `${dir}/issue-types.md`;
  const jl = `${dir}/issue-types.jsonl`;
  await Deno.writeTextFile(md, "- IT-001\n- IT-002\n- IT-003\n");
  await Deno.writeTextFile(jl, '{"a":1}\n{"a":2}\n');
  try {
    const a = await loadIssue(md, jl);
    assertEquals(a.count, 3);
    assertEquals(a.source, "md");
    assertEquals(a.ids, ["IT-001", "IT-002", "IT-003"]);

    await Deno.remove(md);
    const b = await loadIssue(md, jl);
    assertEquals(b.count, 2);
    assertEquals(b.source, "jsonl");

    await Deno.remove(jl);
    const c = await loadIssue(md, jl);
    assertEquals(c.count, 0);
    assertEquals(c.source, "none");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

// ==========================================================
// Next
// ==========================================================

Deno.test("next: opencode に新版がある", () => {
  const n = buildNext(
    { opencode: { at: AT, latest: "2.0.0", installed: "1.18.34" } },
    null, TODAY, buildIssue(0, "none", []),
  );
  assert(n.opencode[0]!.includes("1.18.34 → 2.0.0"), n.opencode[0]!);
  assert(n.opencode[1]!.includes("opencode upgrade"), n.opencode[1]!);
});

Deno.test("next: opencode は最新", () => {
  const n = buildNext(
    { opencode: { at: AT, latest: "1.18.34", installed: "1.18.34" } },
    null, TODAY, buildIssue(0, "none", []),
  );
  assert(n.opencode[0]!.includes("は最新"), n.opencode[0]!);
});

Deno.test("next: opencode 未取得", () => {
  const n = buildNext({}, null, TODAY, buildIssue(0, "none", []));
  assert(n.opencode[0]!.includes("未取得"), n.opencode[0]!);
});

Deno.test("next: 日報の有無で文言が切り替わる", () => {
  const no = buildNext({}, null, TODAY, buildIssue(0, "none", []));
  assert(no.journal.includes("日報が無い"), no.journal);

  const yes = buildNext({}, TODAY, TODAY, buildIssue(0, "none", []));
  assert(yes.journal.includes("日報 OK"), yes.journal);
});

Deno.test("next: issue 件数が Ledger 行になる", () => {
  const n = buildNext({}, null, TODAY, buildIssue(7, "md", []));
  assert(n.issue[0]!.includes("IT-007"), n.issue[0]!);
  assert(n.lines.includes(n.issue[0]!), "lines に issue が混ざっていない");
});

Deno.test("next: issue 0 件なら Ledger を出さない", () => {
  const n = buildNext({}, null, TODAY, buildIssue(0, "none", []));
  assertEquals(n.issue.length, 0);
  assert(!n.lines.some((l) => l.includes("IT-001")), n.lines.join("|"));
});

// ==========================================================
// Panel
// ==========================================================

Deno.test("panel の行はすべて kind/text を持つ", () => {
  for (const r of buildPanel(model())) {
    assert(["head", "sec", "txt", "gap"].includes(r.kind), r.kind);
    assertEquals(typeof r.text, "string");
  }
});

Deno.test("panel の head は 1 つだけ", () => {
  assertEquals(buildPanel(model()).filter((r) => r.kind === "head").length, 1);
});

Deno.test("panel の head は日付と時刻を含む", () => {
  const m = model();
  const h = buildPanel(m).find((r) => r.kind === "head")!;
  assertEquals(h.text, headerLine(m));
  assert(h.text.includes("2026-10-01"), h.text);
  assert(h.text.includes("09:53"), h.text);
});

Deno.test("panel は env / recap / next を出す", () => {
  const rows = buildPanel(model());
  const secs = rows.filter((r) => r.kind === "sec").map((r) => r.text);
  assertEquals(secs.length, 3);
  assert(secs[0]!.includes("env"), secs[0]!);
  assert(secs[1]!.includes("recap"), secs[1]!);
  assert(secs[2]!.includes("next"), secs[2]!);
});

Deno.test("panel の sec 行は section の .lines をそのまま使う", () => {
  const m = model();
  const rows = buildPanel(m);
  // env の直後に env.lines が入る
  const envSecIdx = rows.findIndex((r) => r.kind === "sec" && r.text.includes("env"));
  const following = rows.slice(envSecIdx + 1, envSecIdx + 1 + m.env.lines.length);
  assertEquals(following.map((r) => r.text), [...m.env.lines]);
});

// ==========================================================
// loadModel
// ==========================================================

Deno.test("emptyModel は 5 セクションを全て埋めたひな形を返す", () => {
  const m = emptyModel(new Date(2026, 0, 2, 3, 4));
  for (const s of SECTIONS) {
    assertEquals(m[s].id, s);
    assert(m[s].lines.length > 0, `${s} が空`);
  }
  assertEquals(m.today, "2026-01-02");
  assertEquals(m.hhmm, "03:04");
  // fallback は view 側が「読めたふり」をしないこと
  assertEquals(m.env.hasCache, false);
  assertEquals(m.lexicon.hasCache, false);
  assertEquals(m.issue.count, 0);
  assertEquals(m.issue.source, "none");
  assertEquals(m.recap.file, null);
});

Deno.test("emptyModel は panel にも渡せる（文言が漏れない）", () => {
  const rows = buildPanel(emptyModel());
  assert(rows.length > 0);
  for (const r of rows) assertEquals(typeof r.text, "string");
});

Deno.test("emptyRecap は案内文を 1 行だけ持つ", () => {
  const r = emptyRecap();
  assertEquals(r.file, null);
  assertEquals(r.date, null);
  assertEquals(r.lines.length, 1);
  assertEquals(r.lines[0], "日報がまだ無いよ");
});

Deno.test("loadModel は 5 セクションを埋める", async () => {
  const m = await loadModel({
    cache: {},
    journalDir: "Z:/nope",
    issuesMd: "Z:/a.md",
    issuesJsonl: "Z:/a.jsonl",
    now: new Date(2026, 0, 2, 3, 4),
  });
  for (const s of SECTIONS) {
    assert(m[s], `${s} が無い`);
    assertEquals(m[s].id, s);
    assert(m[s].lines.length > 0, `${s} が空`);
  }
  assertEquals(m.today, "2026-01-02");
  assertEquals(m.hhmm, "03:04");
});

Deno.test("loadModel の today はローカル表記", async () => {
  const m = await loadModel({
    cache: {},
    journalDir: "Z:/nope",
    issuesMd: "Z:/a.md",
    issuesJsonl: "Z:/a.jsonl",
    now: new Date(2026, 0, 2, 3, 4),
  });
  assertEquals(m.today, "2026-01-02");
});

Deno.test("localDate は UTC ではなくローカル", () => {
  // 実行環境の TZ に依存しないよう、Date のローカル時刻から組み立てる。
  // （固定の UTC 値を使うと、CI が UTC のとき localDate とズレて落ちる）
  const d = new Date(2026, 0, 2, 0, 30);      // ローカル 2026-01-02 00:30
  assertEquals(localDate(d), "2026-01-02");

  // 同じ日の 23:59 でも日付が変わらないこと
  const e = new Date(2026, 0, 2, 23, 59);
  assertEquals(localDate(e), "2026-01-02");

  // 月末日→翌月 1 日にまたいでも桁あふれしないこと
  assertEquals(localDate(new Date(2026, 11, 31, 12, 0)), "2026-12-31");
  assertEquals(localDate(new Date(2027, 0, 1, 12, 0)), "2027-01-01");
});

Deno.test("localTime は 2 桁ゼロ埋め", () => {
  assertEquals(localTime(new Date(2026, 0, 2, 3, 4)), "03:04");
  assertEquals(localTime(new Date(2026, 0, 2, 0, 0)), "00:00");
  assertEquals(localTime(new Date(2026, 0, 2, 23, 59)), "23:59");
});

Deno.test("loadModel は cache を各セクションに反映する", async () => {
  const m = await loadModel({
    cache: {
      python: { at: AT, version: "Python 3.13.14" },
      opencode: { at: AT, latest: "2.0.0", installed: "1.18.34" },
      due: { date: TODAY, stamp: "s", total: 160, due: 0, next: TOMORROW },
    },
    journalDir: "Z:/nope",
    issuesMd: "Z:/a.md",
    issuesJsonl: "Z:/a.jsonl",
    now: new Date(AT),
  });
  assertEquals(m.env.hasCache, true);
  assertEquals(m.lexicon.total, 160);
  assertEquals(m.lexicon.next, TOMORROW);
  assert(m.next.opencode[0]!.includes("1.18.34 → 2.0.0"), m.next.opencode[0]!);
});