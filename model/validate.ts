/**
 * brief/model/validate.ts
 *
 * PS1 が書いた brief-cache.json を BriefCacheSchema で検証する。
 *
 * Usage:
 *   deno run --allow-read validate.ts
 *   deno run --allow-read validate.ts --path C:\custom\cache.json
 */

import { BriefCacheSchema } from "./cache.ts";
import { loadSettings } from "./paths.ts";
import { parseArgs } from "@std/cli/parse-args";

const args = parseArgs(Deno.args);
const cachePath: string =
  (args.path as string | undefined) ?? loadSettings().paths.cache;

console.log(`\n🔍 Validating: ${cachePath}\n`);

let raw: string;
try {
  raw = await Deno.readTextFile(cachePath);
} catch (e) {
  console.error(`❌ ファイルを読めません: ${e}`);
  Deno.exit(1);
}

let json: unknown;
try {
  json = JSON.parse(raw);
} catch (e) {
  console.error(`❌ JSON パース失敗: ${e}`);
  Deno.exit(1);
}

const result = BriefCacheSchema.safeParse(json);

if (result.success) {
  const c = result.data;
  console.log("✅ スキーマ一致\n");

  // opencode
  if (c.opencode) {
    const oc = c.opencode;
    console.log(`  opencode  installed=${oc.installed ?? "null"}  latest=${oc.latest ?? "null"}`);
  } else {
    console.log("  opencode  （未取得）");
  }

  // wsl
  if (c.wsl?.distros?.length) {
    const distros = c.wsl.distros.map((d) => `${d.name}:${d.state}`).join(", ");
    console.log(`  wsl       ${distros}`);
  } else {
    console.log("  wsl       （未取得）");
  }

  // python
  if (c.python) {
    console.log(`  python    ${c.python.version}`);
  } else {
    console.log("  python    （未取得）");
  }

  // lexicon
  if (c.due) {
    console.log(`  lexicon   due=${c.due.due} / total=${c.due.total}  next=${c.due.next ?? "null"}`);
  } else {
    console.log("  lexicon   （未取得）");
  }

  console.log("");
} else {
  console.error("❌ スキーマ不一致:\n");
  for (const issue of result.error.issues) {
    console.error(`  [${issue.path.join(".")}] ${issue.message}`);
  }
  console.log("");
  Deno.exit(1);
}
