/**
 * brief/model/schema_test.ts
 *
 * schema.json がコードとずれていないことを守る。
 *
 *   deno test -A
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { dirname, fromFileUrl, join } from "@std/path";
import { buildSchema, schemaJson } from "./schema.ts";

const REPO = dirname(dirname(fromFileUrl(import.meta.url)));
const OUT  = join(REPO, "schema.json");

const EXPECTED = [
  "BriefCache", "Distro", "OpenCode", "Wsl", "Python", "Lexicon",
  "Section", "PanelKind", "PanelRow", "SectionData",
  "EnvInfo", "RecapInfo", "NextInfo", "LexiconInfo", "IssueInfo",
  "BriefModel", "LoadOptions", "ToolEntry", "ToolPaths",
];

Deno.test("schema.json が存在する", () => {
  assert(Deno.statSync(OUT).isFile);
});

Deno.test("definitions が 19 個ある", () => {
  const s = buildSchema() as { definitions: Record<string, unknown> };
  assertEquals(Object.keys(s.definitions).length, 19);
});

Deno.test("期待した定義がすべて揃っている", () => {
  const s = buildSchema() as { definitions: Record<string, unknown> };
  for (const k of EXPECTED) assertExists(s.definitions[k], `definitions.${k} が無い`);
});

Deno.test("$schema は draft 2020-12", () => {
  assertEquals(buildSchema().$schema, "https://json-schema.org/draft/2020-12/schema");
});

Deno.test("コミット済みの schema.json は最新（漂移していない）", async () => {
  assertEquals(
    await Deno.readTextFile(OUT),
    schemaJson(),
    "schema.json が古い。`deno task schema` で再生成してください",
  );
});

Deno.test("生成結果は冪等（2 回呼んでも同じ）", () => {
  assertEquals(schemaJson(), schemaJson());
});

Deno.test("BriefModel の $ref が definitions を指す", () => {
  const s = buildSchema() as { $ref: string };
  assertEquals(s.$ref, "#/definitions/BriefModel");
});

Deno.test("Section は 5 値", () => {
  const s = buildSchema() as { definitions: Record<string, { enum?: string[] }> };
  assertEquals(
    s.definitions.Section!.enum,
    ["env", "recap", "next", "lexicon", "issue"],
  );
});

Deno.test("全セクション型が id/label/lines を持つ", () => {
  const s = buildSchema() as {
    definitions: Record<string, { required?: string[]; properties?: Record<string, unknown> }>;
  };
  for (const n of ["EnvInfo", "RecapInfo", "NextInfo", "LexiconInfo", "IssueInfo"]) {
    const req = s.definitions[n]!.required!;
    for (const k of ["id", "label", "lines"]) {
      assert(req.includes(k), `${n} が required に ${k} を持たない`);
    }
    assert(s.definitions[n]!.properties!.lines, `${n} が lines を持たない`);
  }
});

Deno.test("各セクションの id は literal で固定される", () => {
  const s = buildSchema() as {
    definitions: Record<string, { properties?: Record<string, { const?: unknown }> }>;
  };
  const want: Record<string, string> = {
    EnvInfo: "env",
    RecapInfo: "recap",
    NextInfo: "next",
    LexiconInfo: "lexicon",
    IssueInfo: "issue",
  };
  for (const [n, v] of Object.entries(want)) {
    assertEquals(s.definitions[n]!.properties!.id!.const, v, `${n}.id が ${v} でない`);
  }
});

Deno.test("RecapInfo は file/date/heads/body/lines を持つ", () => {
  const s = buildSchema() as { definitions: Record<string, { required?: string[] }> };
  assertEquals(
    s.definitions.RecapInfo!.required,
    ["id", "label", "lines", "file", "date", "heads", "body"],
  );
});

Deno.test("IssueInfo.source は md/jsonl/none", () => {
  const s = buildSchema() as {
    definitions: Record<string, { properties?: Record<string, { enum?: string[] }> }>;
  };
  assertEquals(s.definitions.IssueInfo!.properties!.source.enum, ["md", "jsonl", "none"]);
});

Deno.test("BriefModel は 5 セクション + today + hhmm", () => {
  const s = buildSchema() as { definitions: Record<string, { required?: string[] }> };
  assertEquals(
    s.definitions.BriefModel!.required,
    ["env", "recap", "next", "lexicon", "issue", "today", "hhmm"],
  );
});

Deno.test("today は yyyy-MM-dd パターンを持つ", () => {
  const s = buildSchema() as {
    definitions: Record<string, { properties?: Record<string, { pattern?: string }> }>;
  };
  const p = s.definitions.BriefModel!.properties!.today;
  assertEquals(p.pattern, "^\\d{4}-\\d{2}-\\d{2}$");
});

Deno.test("hhmm は HH:mm パターンを持つ", () => {
  const s = buildSchema() as {
    definitions: Record<string, { properties?: Record<string, { pattern?: string }> }>;
  };
  assertEquals(s.definitions.BriefModel!.properties!.hhmm.pattern, "^\\d{2}:\\d{2}$");
});

Deno.test("ToolEntry.status は ready/planned", () => {
  const s = buildSchema() as {
    definitions: Record<string, { properties?: Record<string, { enum?: string[] }> }>;
  };
  assertEquals(s.definitions.ToolEntry!.properties!.status.enum, ["ready", "planned"]);
});

Deno.test("Date は現れない（JSON Schema で表現できないため）", () => {
  const json = schemaJson();
  assert(!json.includes('"format": "date-time"'), "date-time が含まれている");
});