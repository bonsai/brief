/**
 * brief/controller/brief_test.ts
 *
 * 表示内容の正本を守る。view が何を並べても文言はここで決まる。
 *
 *   deno test -A
 */

import { assert, assertEquals } from "@std/assert";
import {
  SECTIONS,
  SECTION_LABELS,
  buildPanel,
  buildSection,
  envSection,
  headerLine,
  lexiconSection,
  loadIssueCount,
  loadModel,
  loadRecap,
  localDate,
  localTime,
  nextSection,
  parseRecap,
  toolLine,
  wslLine,
  type BriefModel,
} from "./brief.ts";

const AT = "2026-10-01T09:53:00+09:00";

function model(over: Partial<BriefModel> = {}): BriefModel {
  return {
    cache: {},
    today: "2026-10-01",
    hhmm: "09:53",
    recap: { file: null, date: null, heads: [], lines: ["日報がまだ無いよ"] },
    issueCount: 0,
    ...over,
  };
}

// ==========================================================
// Sections
// ==========================================================

Deno.test("SECTIONS は 4 つ且つ label を持つ", () => {
  assertEquals(SECTIONS.length, 4);
  for (const s of SECTIONS) assert(SECTION_LABELS[s], `label 無し: ${s}`);
});

Deno.test("cache 空でも env は壊れない", () => {
  const out = envSection({});
  assertEquals(out.length, 3);
  assert(out[0]!.includes("未取得"), out[0]);
  assert(out[2]!.includes("未取得"), out[2]);
});

Deno.test("toolLine は python / opencode を並べる", () => {
  const l = toolLine({
    python: { at: AT, version: "Python 3.13.14" },
    opencode: { at: AT, latest: "1.18.34", installed: "1.18.34" },
  });
  assert(l.includes("python 3.13.14"), l);
  assert(l.includes("opencode 1.18.34"), l);
});

Deno.test("wslLine は Running と Stopped を ▶■ で表す", () => {
  const l = wslLine({
    wsl: {
      at: AT,
      distros: [{ name: "Ubuntu", state: "Running" }, { name: "docker", state: "Stopped" }],
    },
  });
  assert(l.includes("Ubuntu ▶"), l);
  assert(l.includes("docker ■"), l);
});

Deno.test("wslLine は distro が空でも未取得を出す", () => {
  assert(wslLine({ wsl: { at: AT, distros: [] } }).includes("未取得"));
});

Deno.test("nextSection: opencode に新版がある", () => {
  const out = nextSection(
    model({ cache: { opencode: { at: AT, latest: "2.0.0", installed: "1.18.34" } } }),
  );
  assert(out[0]!.includes("1.18.34 → 2.0.0"), out[0]);
  assert(out[1]!.includes("opencode upgrade"), out[1]);
});

Deno.test("nextSection: opencode は最新", () => {
  const out = nextSection(
    model({ cache: { opencode: { at: AT, latest: "1.18.34", installed: "1.18.34" } } }),
  );
  assert(out[0]!.includes("は最新"), out[0]);
});

Deno.test("nextSection: opencode 未取得", () => {
  const out = nextSection(model());
  assert(out[0]!.includes("未取得"), out[0]);
});

Deno.test("nextSection: lexicon due > 0", () => {
  const out = nextSection(
    model({ cache: { due: { date: "2026-10-01", stamp: "s", total: 160, due: 12, next: null } } }),
  );
  assert(out.some((l) => l.includes("due 12 / 160")), out.join("|"));
});

Deno.test("nextSection: lexicon due 0 は次回を出す", () => {
  const out = nextSection(
    model({ cache: { due: { date: "2026-10-01", stamp: "s", total: 160, due: 0, next: "2026-10-02" } } }),
  );
  assert(out.some((l) => l.includes("次は 2026-10-02")), out.join("|"));
});

Deno.test("nextSection: 今日の日報が無いとき文を切り替え", () => {
  const noRecap = nextSection(model());
  assert(noRecap.some((l) => l.includes("日報が無い")), noRecap.join("|"));

  const withRecap = nextSection(
    model({ recap: { file: "f", date: "2026-10-01", heads: ["h"], lines: ["x"] } }),
  );
  assert(withRecap.some((l) => l.includes("日報 OK")), withRecap.join("|"));
});

Deno.test("lexiconSection は cache 無しでも壊れない", () => {
  assert(lexiconSection({})[0]!.includes("未取得"));
});

Deno.test("lexiconSection は due > 0 でコマンドを出す", () => {
  const out = lexiconSection({
    due: { date: "2026-10-01", stamp: "s", total: 160, due: 5, next: null },
  });
  assert(out.some((l) => l.includes("wo --count 10")), out.join("|"));
});

// ==========================================================
// buildSection — 4 セクションすべてが string[] を返す
// ==========================================================

Deno.test("buildSection は全セクションで空でない配列を返す", () => {
  const m = model();
  for (const s of SECTIONS) {
    const out = buildSection(m, s);
    assert(Array.isArray(out), `${s} が配列でない`);
    assert(out.length > 0, `${s} が空`);
    for (const l of out) assertEquals(typeof l, "string");
  }
});

// ==========================================================
// Panel
// ==========================================================

Deno.test("buildPanel の行はすべて kind/text を持つ", () => {
  for (const r of buildPanel(model())) {
    assert(["head", "sec", "txt", "gap"].includes(r.kind), r.kind);
    assertEquals(typeof r.text, "string");
  }
});

Deno.test("buildPanel は head が 1 つだけ", () => {
  assertEquals(buildPanel(model()).filter((r) => r.kind === "head").length, 1);
});

Deno.test("buildPanel の head は日付と時刻を含む", () => {
  const h = buildPanel(model()).find((r) => r.kind === "head")!;
  assertEquals(h.text, headerLine(model()));
  assert(h.text.includes("2026-10-01"), h.text);
  assert(h.text.includes("09:53"), h.text);
});

Deno.test("buildPanel は issueCount が正なら Ledger を出す", () => {
  const none = buildPanel(model({ issueCount: 0 }));
  assert(!none.some((r) => r.text.includes("IT-001")), "0 のときは出さない");

  const some = buildPanel(model({ issueCount: 7 }));
  const row = some.find((r) => r.text.includes("IT-001"));
  assert(row, "Ledger 行が無い");
  assert(row!.text.includes("IT-007"), row!.text);
});

Deno.test("buildPanel の recap 見出しは最大 3 つ", () => {
  const heads = ["a", "b", "c", "d", "e"];
  const rows = buildPanel(
    model({ recap: { file: "f", date: "2026-10-01", heads, lines: ["x"] } }),
  );
  const inPanel = rows.filter((r) => heads.includes(r.text));
  assertEquals(inPanel.length, 3, `実際 ${inPanel.length}`);
});

Deno.test("buildPanel の wsl 行は env セクションにある", () => {
  const rows = buildPanel(
    model({
      cache: { wsl: { at: AT, distros: [{ name: "Ubuntu", state: "Running" }] } },
    }),
  );
  assert(rows.some((r) => r.text.includes("Ubuntu ▶")), "wsl 行が無い");
});

// ==========================================================
// Recap parsing
// ==========================================================

Deno.test("parseRecap は日付と見出しを取り出す", () => {
  const md = [
    "# Recap 2026-10-01",
    "",
    "## セッション 09:53",
    "",
    "- 達成した",
    "",
    "## 新規スキル",
    "",
    "## 未達",
    "",
    "---",
  ].join("\n");
  const r = parseRecap("X\\recap-2026-10-01.md", md);
  assertEquals(r.date, "2026-10-01");
  assert(!r.heads.includes("新規スキル"), "「新規スキル」は除く");
  assert(r.heads.includes("セッション 09:53"), r.heads.join("|"));
  assert(r.heads.includes("未達"), r.heads.join("|"));
});

Deno.test("parseRecap は見出しなしを空で返す", () => {
  const r = parseRecap("X\\recap-2026-10-01.md", "# 見出し 1 段しかない\n");
  assertEquals(r.heads.length, 0);
});

Deno.test("parseRecap の lines は先頭が日付行", () => {
  const r = parseRecap("X\\recap-2026-10-01.md", "## A\n本文\n");
  assert(r.lines[0]!.includes("2026-10-01"), r.lines[0]!);
});

// ==========================================================
// I/O 系 — 壊れていても例外を投げない
// ==========================================================

Deno.test("loadRecap は journal が無ければ空を返す", async () => {
  const r = await loadRecap("Z:/nope/not/here");
  assertEquals(r.file, null);
  assertEquals(r.date, null);
});

Deno.test("loadIssueCount は両方無ければ 0", async () => {
  assertEquals(await loadIssueCount("Z:/a/b.md", "Z:/a/b.jsonl"), 0);
});

Deno.test("loadIssueCount は md の箇条書きを数える", async () => {
  const dir = await Deno.makeTempDir();
  const md = `${dir}/issue-types.md`;
  await Deno.writeTextFile(
    md,
    ["# Issue Types", "", "- IT-001  Something", "- IT-002  Other", ""].join("\n"),
  );
  try {
    assertEquals(await loadIssueCount(md, `${dir}/none.jsonl`), 2);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("loadIssueCount は md を優先し、無ければ jsonl", async () => {
  const dir = await Deno.makeTempDir();
  const md = `${dir}/issue-types.md`;
  const jl = `${dir}/issue-types.jsonl`;
  await Deno.writeTextFile(md, "- IT-001\n- IT-002\n- IT-003\n");
  await Deno.writeTextFile(jl, '{"a":1}\n{"a":2}\n');
  try {
    assertEquals(await loadIssueCount(md, jl), 3, "md が優先される");
    await Deno.remove(md);
    assertEquals(await loadIssueCount(md, jl), 2, "md が無ければ jsonl");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("loadModel は cache をそのまま保持する", async () => {
  const cache = { python: { at: AT, version: "Python 3.13.14" } };
  const m = await loadModel({
    cache,
    journalDir: "Z:/nope",
    issuesMd: "Z:/a.md",
    issuesJsonl: "Z:/a.jsonl",
    now: new Date(AT),
  });
  assertEquals(m.cache, cache);
  assertEquals(m.today, "2026-10-01");
  assertEquals(m.hhmm, "09:53");
  assertEquals(m.issueCount, 0);
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
  assertEquals(m.hhmm, "03:04");
});

Deno.test("localDate は UTC ではなくローカルで日付を返す", () => {
  // JST (UTC+9) の 2026-01-02 00:30 = UTC 2026-01-01 15:30。
  // toISOString() だと 01-01 になるが、正しくは 01-02。
  const jst = new Date(Date.UTC(2026, 0, 1, 15, 30));
  assertEquals(localDate(jst), "2026-01-02");
});

Deno.test("localTime はローカル時刻を返す", () => {
  assertEquals(localTime(new Date(2026, 0, 2, 3, 4)), "03:04");
  assertEquals(localTime(new Date(2026, 0, 2, 23, 59)), "23:59");
  assertEquals(localTime(new Date(2026, 0, 2, 0, 0)), "00:00");
});