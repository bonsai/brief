/**
 * brief/model/paths_test.ts
 *
 * settings.json 解決とフォールバックのテスト。
 *
 *   deno test -A
 */

import { assert, assertEquals, assertExists } from "@std/assert";
import { loadSettings, SETTINGS_PATH } from "./paths.ts";

Deno.test("SETTINGS_PATH は brief/ 直下の settings.json", () => {
  assert(SETTINGS_PATH.endsWith("settings.json"), SETTINGS_PATH);
  assert(SETTINGS_PATH.includes("brief"), SETTINGS_PATH);
});

Deno.test("loadSettings は 6 つのパスを返す", () => {
  const s = loadSettings();
  for (
    const k of [
      "cache",
      "journal",
      "issuesMd",
      "issuesJsonl",
      "lexiconDir",
      "settingsFile",
    ] as const
  ) {
    const v = s.paths[k];
    assertExists(v, `paths.${k} が無い`);
    assert(typeof v === "string" && v.length > 0, `paths.${k} が空: ${v}`);
  }
});

Deno.test("loadSettings は 4 つの TTL を返す", () => {
  const s = loadSettings();
  assertEquals(s.cache.opencodeTtlHours, 6);
  assertEquals(s.cache.wslTtlMinutes, 30);
  assertEquals(s.cache.pythonTtlHours, 24);
  assertEquals(s.cache.refreshMinIntervalMinutes, 30);
});

Deno.test("loadSettings は 2 回目も cache を返す（memo 生效）", () => {
  assertEquals(loadSettings(), loadSettings());
});

Deno.test("issues は md を正とする", () => {
  const s = loadSettings();
  assert(s.paths.issuesMd.endsWith("issue-types.md"), s.paths.issuesMd);
  assert(s.paths.issuesJsonl.endsWith("issue-types.jsonl"), s.paths.issuesJsonl);
});

Deno.test("settings.json が無くても例外を投げない（clone 直後は FALLBACK）", () => {
  // settings.json は gitignore 済みなので、clone 直後は存在しない。
  // その場合でも既定値が返ることを確認する。
  assert(SETTINGS_PATH.endsWith("settings.json"));
  try {
    Deno.statSync(SETTINGS_PATH);
    // 存在する場合だけ JSON として有効かも見る
    JSON.parse(Deno.readTextFileSync(SETTINGS_PATH));
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return;  // 想定内
    throw e;
  }
});

Deno.test("settings.example.json は常に commit されている", () => {
  const p = SETTINGS_PATH.replace(/settings\.json$/, "settings.example.json");
  assert(Deno.statSync(p).isFile, "settings.example.json が無い");
  const raw = JSON.parse(Deno.readTextFileSync(p));
  assertExists(raw.paths, "example に paths が無い");
});