/**
 * brief/model/cache.ts
 *
 * BriefCache の型定義（正典）と zod schema。
 * PS1 が書くキャッシュ JSON とこの型が一致していることを
 * validate.ts でテストする。
 *
 * Usage:
 *   import { BriefCacheSchema, type BriefCache } from "./cache.ts";
 *   const cache = BriefCacheSchema.parse(JSON.parse(raw));
 */

import { z } from "@zod/zod";

// ----------------------------------------------------------
// Sub-schemas
// ----------------------------------------------------------

const DistroSchema = z.object({
  name:  z.string(),
  state: z.enum(["Running", "Stopped"]),
});

const OpenCodeSchema = z.object({
  at:        z.string(),           // ISO8601
  latest:    z.string().nullable(),
  installed: z.string().nullable(),
});

const WslSchema = z.object({
  at:      z.string(),
  distros: z.array(DistroSchema),
});

/** lexicon — due/total は PS1 の Get-BriefLexicon が cache.due に書く */
const LexiconSchema = z.object({
  date:   z.string(),              // "yyyy-MM-dd"
  stamp:  z.string(),              // mtime+size fingerprint
  total:  z.number().int().nonnegative(),
  due:    z.number().int().nonnegative(),
  next:   z.string().nullable(),   // "yyyy-MM-dd" | null
});

const RecapSchema = z.object({
  file:  z.string(),
  date:  z.string(),               // "yyyy-MM-dd" from filename
  heads: z.array(z.string()),
});

const PythonSchema = z.object({
  at:      z.string(),
  version: z.string(),             // "Python 3.13.14"
});

// ----------------------------------------------------------
// Root schema
// ----------------------------------------------------------

export const BriefCacheSchema = z.object({
  /** opencode の最新版情報（brief-refresh が書く） */
  opencode: OpenCodeSchema.optional(),

  /** WSL distro の稼働状況（brief-refresh が書く） */
  wsl: WslSchema.optional(),

  /** Python バージョン（brief-refresh が書く） */
  python: PythonSchema.optional(),

  /** lexicon due/total（Get-BriefLexicon が書く） */
  due: LexiconSchema.optional(),
});

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

export type Distro      = z.infer<typeof DistroSchema>;
export type OpenCode    = z.infer<typeof OpenCodeSchema>;
export type Wsl         = z.infer<typeof WslSchema>;
export type Lexicon     = z.infer<typeof LexiconSchema>;
export type Recap       = z.infer<typeof RecapSchema>;
export type BriefCache  = z.infer<typeof BriefCacheSchema>;

// ----------------------------------------------------------
// Helper — キャッシュ JSON を安全に読む
// ----------------------------------------------------------

/**
 * ファイルパスを受け取り、BriefCache をパース・返す。
 * 読み取り失敗・スキーマ不一致はすべて空オブジェクトにフォールバック。
 */
export async function readBriefCache(path: string): Promise<BriefCache> {
  try {
    const raw  = await Deno.readTextFile(path);
    const json = JSON.parse(raw);
    return BriefCacheSchema.parse(json);
  } catch {
    return {};
  }
}

/**
 * BriefCache を JSON ファイルに書き出す（tmp → rename で atomic write）。
 */
export async function writeBriefCache(
  path: string,
  cache: BriefCache,
): Promise<void> {
  const tmp = path + ".tmp";
  await Deno.writeTextFile(tmp, JSON.stringify(cache, null, 2));
  await Deno.rename(tmp, path);
}
