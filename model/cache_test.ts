/**
 * brief/model/cache_test.ts
 *
 * BriefCacheSchema のテスト。壊れた cache は空オブジェクトに落ちる。
 *
 *   deno test -A
 */

import { assertEquals } from "@std/assert";
import { BriefCacheSchema } from "./cache.ts";

Deno.test("空オブジェクトは通る", () => {
  assertEquals(BriefCacheSchema.parse({}), {});
});

Deno.test("opencode のみ", () => {
  const v = BriefCacheSchema.parse({
    opencode: { at: "2026-10-01T00:00:00Z", latest: "1.18.34", installed: "1.18.34" },
  });
  assertEquals(v.opencode?.installed, "1.18.34");
});

Deno.test("wsl の distro 配列", () => {
  const v = BriefCacheSchema.parse({
    wsl: {
      at: "2026-10-01T00:00:00Z",
      distros: [
        { name: "Ubuntu", state: "Running" },
        { name: "docker-desktop", state: "Stopped" },
      ],
    },
  });
  assertEquals(v.wsl?.distros.length, 2);
});

Deno.test("due（lexicon）", () => {
  const v = BriefCacheSchema.parse({
    due: { date: "2026-10-01", stamp: "x:1", total: 160, due: 0, next: "2026-10-02" },
  });
  assertEquals(v.due?.total, 160);
});

Deno.test("python", () => {
  const v = BriefCacheSchema.parse({
    python: { at: "2026-10-01T00:00:00Z", version: "Python 3.13.14" },
  });
  assertEquals(v.python?.version, "Python 3.13.14");
});

Deno.test("state が Running/Stopped 以外なら落ちる", () => {
  let threw = false;
  try {
    BriefCacheSchema.parse({
      wsl: { at: "x", distros: [{ name: "a", state: "Sleeping" }] },
    });
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "不正な state が通ってしまった");
});

Deno.test("due に負数は許さない", () => {
  let threw = false;
  try {
    BriefCacheSchema.parse({
      due: { date: "2026-10-01", stamp: "x", total: -1, due: 0, next: null },
    });
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "負の total が通ってしまった");
});

Deno.test("壊れた JSON でも readBriefCache は空を返す", async () => {
  const { readBriefCache } = await import("./cache.ts");
  const tmp = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(tmp, "{ this is not json");
    assertEquals(await readBriefCache(tmp), {});
  } finally {
    await Deno.remove(tmp);
  }
});

Deno.test("ファイルが無い場合も空を返す", async () => {
  const { readBriefCache } = await import("./cache.ts");
  const missing = await Deno.makeTempDir().then((d) => `${d}/nope.json`);
  assertEquals(await readBriefCache(missing), {});
});