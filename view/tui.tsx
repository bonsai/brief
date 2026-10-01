/**
 * brief/view/tui.tsx
 *
 * Ink ベースの TUI ブリーフ。
 * 表示内容は controller/brief.ts が正本。ここでは並べ方とキー操作だけ。
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
import { readBriefCache } from "../model/cache.ts";
import { loadSettings } from "../model/paths.ts";
import {
  SECTIONS,
  SECTION_LABELS,
  buildSection,
  emptyModel,
  headerLine,
  loadModel,
  type BriefModel,
  type Section,
} from "../controller/brief.ts";

/**
 * chrome = border(2) + header(2) + tabbar(2) + footer(3)
 * 総高が端末行数を越えないよう、content の高さを逆算する。
 */
const CHROME_ROWS = 9;
const MIN_VIEW_H  = 2;
const MIN_WIDTH   = 40;
const MAX_WIDTH   = 92;

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

function App({ model }: { model: BriefModel }): ReactNode {
  const { exit }   = useApp();
  const { stdout } = useStdout();

  const [idx, setIdx]       = useState<number>(0);
  const [scroll, setScroll] = useState<number>(0);
  const [size, setSize]     = useState<{ rows: number; cols: number }>({
    rows: stdout?.rows    ?? 24,
    cols: stdout?.columns ?? 80,
  });

  const section = SECTIONS[idx]!;

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

  const lines = buildSection(model, section);

  // resize 直後は 0 / undefined が混じるので、常に正の値に丸める
  const cols = size.cols > 0 ? size.cols : 80;
  const rows = size.rows > 0 ? size.rows : 24;

  // Ink の width は border/padding を含む外寸。端末幅を絶対に越えない。
  const width      = Math.max(MIN_WIDTH, Math.min(cols, MAX_WIDTH));
  const viewH      = Math.max(MIN_VIEW_H, rows - CHROME_ROWS);
  const maxScroll  = Math.max(0, lines.length - viewH);
  const offset     = Math.min(scroll, maxScroll);
  const visible    = lines.slice(offset, offset + viewH);
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

    if (key.upArrow   || input === "k") setScroll((s: number) => Math.max(0, s - 1));
    if (key.downArrow || input === "j") setScroll((s: number) => Math.min(maxScroll, s + 1));
    if (key.pageUp)   setScroll((s: number) => Math.max(0, s - viewH));
    if (key.pageDown) setScroll((s: number) => Math.min(maxScroll, s + viewH));
    if (input === "g") setScroll(0);
    if (input === "G") setScroll(maxScroll);
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} width={width}>
      <Box marginBottom={1}>
        <Text color="magentaBright" bold>
          {headerLine(model)}
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
              <Text dimColor wrap="truncate-end">{`全 ${lines.length} 行`}</Text>
              <Text dimColor wrap="truncate-end">↑↓/jk  PgUp/PgDn  g/G  Tab/hl  q 終了</Text>
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
const cache    = await readBriefCache(settings.paths.cache);

let model: BriefModel;
try {
  model = await loadModel({ cache });
} catch {
  model = emptyModel();  // fallback も controller が一箇所
}

render(<App model={model} />);