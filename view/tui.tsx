/**
 * brief/view/tui.tsx
 *
 * Ink ベースの TUI ブリーフ。
 *
 *   Tab / l / →  : 次のセクション
 *   h / ←        : 前のセクション
 *   ↑ ↓ / k j    : 縦スクロール
 *   PgUp / PgDn  : 1 画面スクロール
 *   g / G        : 先頭 / 末尾
 *   q / Ctrl-C   : 終了
 *
 * Usage:
 *   deno run --allow-read --allow-env --allow-sys view/tui.tsx
 */

import { useEffect, useState, type ReactNode } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import { readBriefCache, type BriefCache } from "../model/cache.ts";
import { loadSettings } from "../model/paths.ts";

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

type Section = "env" | "recap" | "next" | "lexicon";
const SECTIONS: Section[] = ["env", "recap", "next", "lexicon"];
const SECTION_LABELS: Record<Section, string> = {
  env:     "🧩 env",
  recap:   "📓 recap",
  next:    "🎯 next",
  lexicon: "📚 lexicon",
};

/**
 * chrome = border(2) + header(2) + tabbar(2) + footer(3)
 * 総高が端末行数を越えないよう、content の高さを逆算する。
 */
const CHROME_ROWS = 9;
const MIN_VIEW_H  = 2;
const MIN_WIDTH   = 40;
const MAX_WIDTH   = 92;

// ----------------------------------------------------------
// Data helpers — 各セクションは「1 行ずつの配列」で返す
// ----------------------------------------------------------

function getEnvLines(cache: BriefCache): string[] {
  const parts: string[] = [];
  if (cache.python)             parts.push(`python ${cache.python.version.replace(/^Python\s*/i, "")}`);
  if (cache.opencode?.installed) parts.push(`opencode ${cache.opencode.installed}`);
  const out: string[] = [
    parts.length ? `tools  ${parts.join("  ·  ")}` : "（キャッシュ未取得 — brief -Refresh）",
    "",
  ];
  if (cache.wsl?.distros?.length) {
    const wslStr = cache.wsl.distros
      .map((d) => `${d.name} ${d.state === "Running" ? "▶" : "■"}`)
      .join("  ·  ");
    out.push(`wsl    ${wslStr}`);
  }
  else {
    out.push("wsl    （未取得）");
  }
  return out;
}

async function getRecapLines(journalRoot: string): Promise<string[]> {
  let file: string | null = null;
  try {
    const deno: typeof Deno & {
      readDir: (p: string) => AsyncIterable<{ isDirectory: boolean; name: string }>;
    } = Deno;

    const found: string[] = [];
    const walk = async (dir: string, depth: number) => {
      if (depth > 3) return;
      for await (const e of deno.readDir(dir)) {
        const p = `${dir}\\${e.name}`;
        if (e.isDirectory) await walk(p, depth + 1);
        else if (/^recap-\d{4}-\d{2}-\d{2}\.md$/.test(e.name)) found.push(p);
      }
    };
    await walk(journalRoot, 0);
    if (found.length) {
      found.sort();
      file = found[found.length - 1];
    }
  }
  catch {
    return ["（journal を読めませんでした）"];
  }

  if (!file) return ["日報がまだ無いよ"];

  let raw = "";
  try { raw = await Deno.readTextFile(file); } catch { return ["（日報の読み込みに失敗）"]; }

  const name = file.split("\\").pop()!.replace(/^recap-|\.md$/g, "");
  const out: string[] = [`── ${name} ──`, ""];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trimEnd();
    if (/^#\s/.test(t)) continue;
    if (/^##\s/.test(t)) { out.push("", `▌ ${t.replace(/^##\s*/, "")}`); continue; }
    if (/^---/.test(t)) continue;
    if (!t.trim()) continue;
    out.push(`  ${t.replace(/^[-*]\s+/, "· ")}`);
  }
  return out.length > 2 ? out : [`${name}（本文なし）`];
}

function getNextLines(cache: BriefCache, today: string, recapExists: boolean): string[] {
  const oc = cache.opencode;
  const out: string[] = [];

  if (oc?.installed && oc.latest && oc.installed !== oc.latest) {
    out.push(`⬆️  opencode ${oc.installed} → ${oc.latest}`, "      opencode upgrade");
  }
  else if (oc?.installed) {
    out.push(`✅  opencode ${oc.installed} は最新`);
  }
  else {
    out.push("❓  opencode 未取得（brief -Refresh）");
  }

  if (cache.due) {
    const d = cache.due;
    out.push(
      d.due > 0
        ? `📖  復習 due ${d.due} / ${d.total} 語   wo --count 10`
        : `🌱  復習 due 0 / ${d.total} 語${d.next ? `（次は ${d.next}）` : ""}`,
    );
  }

  out.push(
    recapExists
      ? `📔  今日の日報 OK（${today}）`
      : `📔  今日の日報が無い → 作ろう（journal へ追記）`,
  );

  return out;
}

function getLexiconLines(cache: BriefCache): string[] {
  const d = cache.due;
  if (!d) return ["（lexicon キャッシュ未取得）"];
  return [
    `総語数:   ${d.total}`,
    `due 今日: ${d.due}`,
    `次回:     ${d.next ?? "なし"}`,
    ...(d.due > 0 ? ["", "▶  wo --count 10"] : []),
  ];
}

// ----------------------------------------------------------
// Components
// ----------------------------------------------------------

function TabBar({ active }: { active: Section }): ReactNode {
  return (
    <Box gap={1} marginBottom={1}>
      {SECTIONS.map((s, i) => (
        <Text
          key={i}
          color={s === active ? "magentaBright" : "gray"}
          bold={s === active}
          underline={s === active}
        >
          {SECTION_LABELS[s]}
        </Text>
      ))}
    </Box>
  );
}

// ----------------------------------------------------------
// App
// ----------------------------------------------------------

function App({ cache, journalRoot }: { cache: BriefCache; journalRoot: string }): ReactNode {
  const { exit }    = useApp();
  const { stdout }  = useStdout();

  const [idx, setIdx]     = useState<number>(0);
  const [scroll, setScroll] = useState<number>(0);
  const [size, setSize]   = useState<{ rows: number; cols: number }>({
    rows: stdout?.rows    ?? 24,
    cols: stdout?.columns ?? 80,
  });
  const [recap, setRecap] = useState<string[]>(["（読み込み中…）"]);

  const section = SECTIONS[idx];
  const today   = new Date().toISOString().slice(0, 10);
  const hhmm    = new Date().toTimeString().slice(0, 5);

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      const r = stdout.rows    ?? 24;
      const c = stdout.columns ?? 80;
      // 同じ値なら state を据え置く（再レンダで枠が揺れるのを防ぐ）
      setSize((prev) => (prev.rows === r && prev.cols === c) ? prev : { rows: r, cols: c });
    };
    stdout.on("resize", onResize);
    return () => { stdout.off("resize", onResize); };
  }, [stdout]);

  useEffect(() => {
    let alive = true;
    getRecapLines(journalRoot).then((ls) => { if (alive) setRecap(ls); });
    return () => { alive = false; };
  }, [journalRoot]);

  const recapExists = recap.some((l) => l.includes(today));

  const lines: string[] =
    section === "env"     ? getEnvLines(cache)
    : section === "recap" ? recap
    : section === "next"  ? getNextLines(cache, today, recapExists)
    : getLexiconLines(cache);

  // resize 直後は 0 / undefined が混じるので、常に正の値に丸める
  const cols = size.cols > 0 ? size.cols : 80;
  const rows = size.rows > 0 ? size.rows : 24;

  // Ink の width は border/padding を含む外寸。端末幅を絶対に越えない。
  const width     = Math.max(MIN_WIDTH, Math.min(cols, MAX_WIDTH));
  const viewH     = Math.max(MIN_VIEW_H, rows - CHROME_ROWS);
  const maxScroll = Math.max(0, lines.length - viewH);
  const offset    = Math.min(scroll, maxScroll);
  const visible   = lines.slice(offset, offset + viewH);
  const scrollable = maxScroll > 0;

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) { exit(); return; }

    if (key.tab || input === "l" || key.rightArrow) {
      setIdx((i: number) => (i + 1) % SECTIONS.length);
      setScroll(0);
    }
    if (input === "h" || key.leftArrow) {
      setIdx((i: number) => (i - 1 + SECTIONS.length) % SECTIONS.length);
      setScroll(0);
    }

    if (key.upArrow    || input === "k") setScroll((s: number) => Math.max(0, s - 1));
    if (key.downArrow  || input === "j") setScroll((s: number) => Math.min(maxScroll, s + 1));
    if (key.pageUp)    setScroll((s: number) => Math.max(0, s - viewH));
    if (key.pageDown)  setScroll((s: number) => Math.min(maxScroll, s + viewH));
    if (input === "g") setScroll(0);
    if (input === "G") setScroll(maxScroll);
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} width={width}>
      <Box marginBottom={1}>
        <Text color="magentaBright" bold>
          {`🌸 good morning, soubi!  ${today}  ${hhmm}`}
        </Text>
      </Box>

      <TabBar active={section} />

      <Box height={viewH} flexDirection="column" overflow="hidden">
        {visible.map((l, i) => (
          <Text
            key={offset + i}
            wrap="truncate-end"
            color={l.startsWith("▶") || l.startsWith("▌") ? "cyan" : "gray"}
          >
            {l || " "}
          </Text>
        ))}
      </Box>

      {/* 高さは常に 2 行ぶんの固定枠。セクション切替で枠が揺れないよう、
          スクロール不可のときでも 2 行目を空で埋める。 */}
      <Box marginTop={1} flexDirection="column" height={2}>
        {scrollable
          ? (
            <>
              <Text dimColor wrap="truncate-end">
                {offset > 0 ? "▲ 上に続き  " : ""}
                {offset + viewH < lines.length ? "▼ 下に続き" : ""}
              </Text>
              <Text dimColor wrap="truncate-end">
                {`${offset + 1}-${Math.min(offset + viewH, lines.length)}/${lines.length}`}
                {"  ↑↓/jk  PgUp/PgDn  g/G  Tab/hl  q 終了"}
              </Text>
            </>
          )
          : (
            <>
              <Text dimColor wrap="truncate-end">
                {`全 ${lines.length} 行`}
              </Text>
              <Text dimColor wrap="truncate-end">
                {"↑↓/jk  PgUp/PgDn  g/G  Tab/hl  q 終了"}
              </Text>
            </>
          )}
      </Box>
    </Box>
  );
}

// ----------------------------------------------------------
// Main
// ----------------------------------------------------------

const settings = loadSettings();
const cache = await readBriefCache(settings.paths.cache);

render(<App cache={cache} journalRoot={settings.paths.journal} />);