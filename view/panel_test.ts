/**
 * brief/view/panel_test.ts
 *
 * 表示幅と折り返し・truncate のテスト。
 * ここが壊れると枠が崩れるので、重Courtに守る。
 *
 *   deno test -A
 */

import { assertEquals } from "@std/assert";
import { displayWidth, truncateToWidth, wrapText } from "./panel.ts";

Deno.test("ASCII は 1 文字 = 1 幅", () => {
  assertEquals(displayWidth("hello"), 5);
});

Deno.test("全角漢字は 2 幅", () => {
  assertEquals(displayWidth("学習"), 4);
});

Deno.test("ひらがな・カタカナは 2 幅", () => {
  assertEquals(displayWidth("あア"), 4);
});

Deno.test("絵文字は 2 幅", () => {
  assertEquals(displayWidth("▶"), 2);
  assertEquals(displayWidth("🌸"), 2);
});

Deno.test("中黒は 1 幅（ANSI 表に無い）", () => {
  assertEquals(displayWidth("·"), 1);
});

Deno.test("混在テキスト", () => {
  // "  ·  " = space2 + 中黒1 + space2 = 5
  assertEquals(displayWidth("  ·  "), 5);
});

Deno.test("truncateToWidth は幅を超える分を落とす", () => {
  assertEquals(truncateToWidth("abcdefgh", 5), "abcde");
  assertEquals(truncateToWidth("abc", 10), "abc");
});

Deno.test("truncateToWidth は全角を割らない", () => {
  // 学(2) + 学(2) = 4。次の 習 を足すと 6 > 5 なので落在ここで止める。
  assertEquals(truncateToWidth("学学習", 5), "学学");
  assertEquals(truncateToWidth("学学習", 6), "学学習");
  assertEquals(truncateToWidth("学学習", 3), "学");
});

Deno.test("wrapText は指定幅で折り返す", () => {
  const out = wrapText("aaa bbb ccc ddd", 7);
  assertEquals(out.length > 1, true);
  for (const line of out) {
    if (displayWidth(line) > 7) {
      throw new Error(`幅超過: "${line}" (${displayWidth(line)})`);
    }
  }
});

Deno.test("wrapText は長い語を強制分割する", () => {
  const out = wrapText("x".repeat(25), 10);
  assertEquals(out.length >= 3, true);
});

Deno.test("wrapText は空文字で 1 行", () => {
  assertEquals(wrapText("", 10).length, 1);
});