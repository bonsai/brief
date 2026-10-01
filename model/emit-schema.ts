/**
 * brief/model/emit-schema.ts
 *
 * schema.json を書き出す。手で編集するな（`deno task schema` で再生成）。
 *
 *   deno task schema
 *   deno task schema --check    # 差分だけ確認（CI 用）
 */

import { schemaJson } from "./schema.ts";
import { dirname, fromFileUrl, join } from "@std/path";

const OUT = join(dirname(dirname(fromFileUrl(import.meta.url))), "schema.json");
const json = schemaJson();

if (Deno.args.includes("--check")) {
  let cur = "";
  try { cur = await Deno.readTextFile(OUT); } catch { /* 無い */ }
  if (cur === json) {
    console.log("schema.json: 最新");
  } else {
    console.error("schema.json: 古い。`deno task schema` で再生成してください");
    Deno.exit(1);
  }
} else {
  await Deno.writeTextFile(OUT, json);
  const n = Object.keys(JSON.parse(json).definitions).length;
  console.log(`schema.json を書き出しました（${n} definitions）`);
}