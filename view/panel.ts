/**
 * brief/view/panel.ts
 *
 * PS1 版 Write-BriefPanel/Write-BriefRow/Get-BriefWidth の TypeScript 移植。
 * Deno の stdout に直接書く（外部依存なし）。
 */

// ----------------------------------------------------------
// ANSI color helpers
// ----------------------------------------------------------

const ANSI = {
  reset:       "\x1b[0m",
  darkMagenta: "\x1b[35m",
  magenta:     "\x1b[95m",
  cyan:        "\x1b[96m",
  gray:        "\x1b[90m",
  darkGray:    "\x1b[2;37m",
} as const;

function color(code: string, text: string): string {
  return `${code}${text}${ANSI.reset}`;
}

// ----------------------------------------------------------
// Line types
// ----------------------------------------------------------

export type LineKind = "head" | "sec" | "txt" | "gap";

export interface BriefLine {
  kind: LineKind;
  text: string;
}

export function head(text: string): BriefLine { return { kind: "head", text }; }
export function sec(text: string):  BriefLine { return { kind: "sec",  text }; }
export function txt(text: string):  BriefLine { return { kind: "txt",  text }; }
export function gap():              BriefLine { return { kind: "gap",  text: "" }; }

// ----------------------------------------------------------
// Display width（CJK / emoji = 2, ASCII = 1）
// ----------------------------------------------------------

export function displayWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (
      (c >= 0x1100  && c <= 0x115F)  ||  // Hangul Jamo
      (c >= 0x2E80  && c <= 0x303E)  ||  // CJK Radicals
      (c >= 0x3041  && c <= 0x33FF)  ||  // Hiragana〜CJK Compatibility
      (c >= 0x3400  && c <= 0x4DBF)  ||  // CJK Unified Ideographs Extension A
      (c >= 0x4E00  && c <= 0x9FFF)  ||  // CJK Unified Ideographs
      (c >= 0xA000  && c <= 0xA4CF)  ||  // Yi
      (c >= 0xAC00  && c <= 0xD7A3)  ||  // Hangul Syllables
      (c >= 0xF900  && c <= 0xFAFF)  ||  // CJK Compatibility Ideographs
      (c >= 0xFE30  && c <= 0xFE6F)  ||  // CJK Compatibility Forms
      (c >= 0xFF00  && c <= 0xFF60)  ||  // Fullwidth Forms
      (c >= 0xFFE0  && c <= 0xFFE6)  ||  // Fullwidth Signs
      (c >= 0x1F300 && c <= 0x1FAFF) ||  // Emoji
      // --- ここが欠けると ▶ ■ ✅ ❓ ⬆ などが 1 幅扱いになり枠が崩れる ---
      (c >= 0x2190 && c <= 0x21FF) ||    // Arrows  ← → ↑ ↓
      (c >= 0x25A0 && c <= 0x25FF) ||    // Geometric Shapes  ■ ▲ ▶
      (c >= 0x2600 && c <= 0x27BF) ||    // Misc Symbols / Dingbats  ✅ ❓ ☀
      (c >= 0x2B00 && c <= 0x2BFF) ||    // Misc Symbols and Arrows  ⬆
      (c >= 0x2E80 && c <= 0x2EFF)       // CJK 補助記号
    ) {
      w += 2;
    } else if (
      // 結合文字・VS16 は幅 0
      (c >= 0xFE00 && c <= 0xFE0F) ||
      (c >= 0x0300 && c <= 0x036F) ||
      (c >= 0x200B && c <= 0x200F)
    ) {
      w += 0;
    } else {
      w += 1;
    }
  }
  return w;
}

// ----------------------------------------------------------
// Wrap / truncate — 枠の安定に直結するので公開してテストする
// ----------------------------------------------------------

/**
 * text を幅 maxWidth 以内に折り返した行の配列にする。
 * 語境界で切る。語が幅より長ければ強制分割。
 *
 * 注意: 継続行のインデントを足すのは「語境界で切ったとき」だけ。
 * 強制分割でインデントを足すと文字列が逆に伸びて無限ループになる。
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [""];
  if (maxWidth < 2) return [text];

  const out: string[] = [];
  let rest  = text;
  let avail = maxWidth;

  // 保険：どこかで退化したら强制的に打ち切る
  for (let guard = 0; guard < 1000; guard++) {
    if (displayWidth(rest) <= avail) { out.push(rest); break; }

    let cut = rest.length - 1;
    while (cut > 1 && displayWidth(rest.slice(0, cut)) > avail) cut--;
    if (cut < 1) cut = 1;

    const spaceIdx = rest.lastIndexOf(" ", cut);
    const atWordBoundary = spaceIdx > 0;
    const breakAt = atWordBoundary ? spaceIdx : cut;

    out.push(rest.slice(0, breakAt).trimEnd());

    const tail = rest.slice(breakAt);
    if (tail.length === 0) break;

    if (atWordBoundary) {
      rest  = "  " + tail.trimStart();
      avail = maxWidth - 2;
    } else {
      rest  = tail;          // インデントを足さない＝必ず短くなる
      avail = maxWidth;
    }
  }
  return out;
}

/** text を幅 maxWidth に切り詰める（全角を割らない） */
export function truncateToWidth(text: string, maxWidth: number): string {
  if (displayWidth(text) <= maxWidth) return text;
  let out = "";
  let w = 0;
  for (const ch of text) {
    const cw = displayWidth(ch);
    if (w + cw > maxWidth) break;
    out += ch;
    w += cw;
  }
  return out;
}

// ----------------------------------------------------------
// Row
// ----------------------------------------------------------

function writeRow(text: string, kind: LineKind, inner: number): string {
  const colorCode = kind === "head" ? ANSI.magenta
                  : kind === "sec"  ? ANSI.cyan
                  : ANSI.gray;
  const pad = Math.max(0, inner - 1 - displayWidth(text));
  return (
    color(ANSI.darkMagenta, "│") +
    color(colorCode, " " + text) +
    " ".repeat(pad) +
    color(ANSI.darkMagenta, "│")
  );
}

// ----------------------------------------------------------
// Panel
// ----------------------------------------------------------

export interface PanelOptions {
  /** ターミナル幅（デフォルト 80） */
  termWidth?: number;
  /** フッターテキスト */
  footer?: string;
}

export function renderPanel(lines: BriefLine[], opts: PanelOptions = {}): string {
  const termWidth = opts.termWidth ?? 80;
  const inner     = Math.max(30, Math.min(termWidth, 78) - 4);
  const footer    = opts.footer ?? " brief / brief -Help で全オプション ";

  const rows: string[] = [];

  rows.push(color(ANSI.darkMagenta, "╭" + "─".repeat(inner) + "╮"));

  for (const line of lines) {
    if (line.kind === "gap") {
      rows.push(writeRow("", "txt", inner));
      continue;
    }

    const indent = line.kind === "txt" ? "   " : "";
    const avail  = inner - 1 - displayWidth(indent);

    for (const chunk of wrapText(line.text, avail)) {
      rows.push(writeRow(indent + chunk, line.kind, inner));
    }
  }

  const footPad = Math.max(0, inner - displayWidth(footer));
  rows.push(
    color(ANSI.darkMagenta, "╰") +
    color(ANSI.darkGray, footer) +
    color(ANSI.darkMagenta, "─".repeat(footPad) + "╯"),
  );

  return "\n" + rows.join("\n") + "\n";
}

/** stdout に直接書く convenience wrapper */
export function printPanel(lines: BriefLine[], opts: PanelOptions = {}): void {
  const out = renderPanel(lines, opts);
  Deno.stdout.writeSync(new TextEncoder().encode(out + "\n"));
}
