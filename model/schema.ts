/**
 * brief/model/schema.ts
 *
 * 型定義の JSON Schema を「生成」する。
 *
 * 手で JSON を書くと必ずコードとずれるので、
 * ここは zod schema を 1 箇所にまとめて JSON Schema に変換する。
 * cache.ts の schema が正本。controller の TS interface も
 * ここに Twin を宣言し、どちらが正か分からない状態を無くす。
 *
 *   deno task schema     # schema.json を書き出す
 */

import { z } from "@zod/zod";
import {
  BriefCacheSchema,
  DistroSchema,
  LexiconSchema,
  OpenCodeSchema,
  PythonSchema,
  WslSchema,
} from "./cache.ts";

// ==========================================================
// controller/brief.ts 相当（ هنا で Twin を宣言する）
// ==========================================================

/** controller: Section */
export const SectionSchema = z.enum(["env", "recap", "next", "lexicon", "issue"]);

/** controller: PanelKind */
export const PanelKindSchema = z.enum(["head", "sec", "txt", "gap"]);

/** controller: PanelRow */
export const PanelRowSchema = z.object({
  kind: PanelKindSchema,
  text: z.string(),
});

/** controller: SectionData — すべてのセクションが持つ最低の契約 */
export const SectionDataSchema = z.object({
  id:    SectionSchema,
  label: z.string(),
  lines: z.array(z.string()),
});

/** controller: EnvInfo */
export const EnvInfoSchema = SectionDataSchema.extend({
  id:       z.literal("env"),
  tools:    z.string(),
  wsl:      z.string(),
  hasCache: z.boolean(),
});

/** controller: RecapInfo */
export const RecapInfoSchema = SectionDataSchema.extend({
  id:    z.literal("recap"),
  file:  z.string().nullable(),
  date:  z.string().nullable(),
  heads: z.array(z.string()),
  body:  z.array(z.string()),
});

/** controller: NextInfo */
export const NextInfoSchema = SectionDataSchema.extend({
  id:       z.literal("next"),
  opencode: z.array(z.string()),
  lexicon:  z.array(z.string()),
  journal:  z.string(),
  issue:    z.array(z.string()),
});

/** controller: LexiconInfo */
export const LexiconInfoSchema = SectionDataSchema.extend({
  id:       z.literal("lexicon"),
  total:    z.number().int().nonnegative(),
  due:      z.number().int().nonnegative(),
  next:     z.string().nullable(),
  hasCache: z.boolean(),
});

/** controller: IssueInfo */
export const IssueInfoSchema = SectionDataSchema.extend({
  id:     z.literal("issue"),
  count:  z.number().int().nonnegative(),
  source: z.enum(["md", "jsonl", "none"]),
  ids:    z.array(z.string()),
});

/** controller: BriefModel — 5 セクションを全部持つ */
export const BriefModelSchema = z.object({
  env:     EnvInfoSchema,
  recap:   RecapInfoSchema,
  next:    NextInfoSchema,
  lexicon: LexiconInfoSchema,
  issue:   IssueInfoSchema,
  today:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hhmm:    z.string().regex(/^\d{2}:\d{2}$/),
});

/** controller: LoadOptions */
export const LoadOptionsSchema = z.object({
  cache:       BriefCacheSchema.optional(),
  journalDir:  z.string().optional(),
  issuesMd:    z.string().optional(),
  issuesJsonl: z.string().optional(),
  // コードは Date だが JSON には無いので、JSON Schema では ISO 文字列で表す
  now:         z.string().optional(),
});

/** controller: ToolEntry 相当 */
export const ToolEntrySchema = z.object({
  id:     z.string(),
  name:   z.string(),
  desc:   z.string(),
  status: z.enum(["ready", "planned"]),
  plan:   z.string().optional(),
});

/** tools.ps1 のパスパス */
export const ToolPathsSchema = z.object({
  journal: z.string(),
  issues:  z.string(),
  deploy:  z.string(),
  brief:   z.string(),
  skills:  z.string(),
});

// ==========================================================
// JSON Schema の組み立て
// ==========================================================

const OPTS = { target: "draft-2020-12", io: "output" } as const;

function def(name: string, schema: z.ZodType): Record<string, unknown> {
  const j = z.toJSONSchema(schema, OPTS) as Record<string, unknown>;
  const { $schema: _drop, ...rest } = j;
  return { title: name, ...rest };
}

/** 単一の JSON Schema 文書を返す。definitions に全型が入る。 */
export function buildSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://bonsai.github.io/brief/schema.json",
    title: "brief",
    description:
      "起動ブリーフの型定義。正本はコード（zod + TS interface）。" +
      "このファイルは `deno task schema` で生成する。手で編集しない。",

    definitions: {
      // ---- cache ----
      BriefCache: def("BriefCache", BriefCacheSchema),
      Distro:     def("Distro", DistroSchema),
      OpenCode:   def("OpenCode", OpenCodeSchema),
      Wsl:        def("Wsl", WslSchema),
      Python:     def("Python", PythonSchema),
      Lexicon:    def("Lexicon", LexiconSchema),

      // ---- controller ----
      Section:     def("Section", SectionSchema),
      PanelKind:   def("PanelKind", PanelKindSchema),
      PanelRow:    def("PanelRow", PanelRowSchema),
      SectionData: def("SectionData", SectionDataSchema),
      EnvInfo:     def("EnvInfo", EnvInfoSchema),
      RecapInfo:   def("RecapInfo", RecapInfoSchema),
      NextInfo:    def("NextInfo", NextInfoSchema),
      LexiconInfo: def("LexiconInfo", LexiconInfoSchema),
      IssueInfo:   def("IssueInfo", IssueInfoSchema),
      BriefModel:  def("BriefModel", BriefModelSchema),
      LoadOptions: def("LoadOptions", LoadOptionsSchema),

      // ---- PowerShell 側 ----
      ToolEntry:  def("ToolEntry", ToolEntrySchema),
      ToolPaths:  def("ToolPaths", ToolPathsSchema),
    },

    $ref: "#/definitions/BriefModel",
  };
}

/** 整形済み JSON（改行 2 スペース）。 */
export function schemaJson(): string {
  return JSON.stringify(buildSchema(), null, 2) + "\n";
}