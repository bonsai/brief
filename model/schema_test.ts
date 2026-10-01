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
  "Section", "PanelKind", "PanelRow", "RecapInfo", "BriefModel",
  "LoadOptions", "ToolEntry", "ToolPaths",
];

Deno.test("schema.json が存在する", () => {
  assert(Deno.statSync(OUT).isFile);
});

Deno.test("definitions が 14 個ある", () => {
  const s = buildSchema() as { definitions: Record<string, unknown> };
  assertEquals(Object.keys(s.definitions).length, 14);
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

Deno.test("Section は 4 値", () => {
  const s = buildSchema() as { definitions: Record<string, { enum?: string[] }> };
  assertEquals(s.definitions.Section!.enum, ["env", "recap", "next", "lexicon"]);
});

Deno.test("PanelKind は 4 値", () => {
  const s = buildSchema() as { definitions: Record<string, { enum?: string[] }> };
  assertEquals(s.definitions.PanelKind!.enum, ["head", "sec", "txt", "gap"]);
});

Deno.test("RecapInfo は file/date/heads/lines の 4 つ", () => {
  const s = buildSchema() as { definitions: Record<string, { required?: string[] }> };
  assertEquals(s.definitions.RecapInfo!.required, ["file", "date", "heads", "lines"]);
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