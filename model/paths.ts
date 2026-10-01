/**
 * brief/model/paths.ts
 *
 * パスの正本。settings.json だけを信頼し、ハードコードしない。
 * PowerShell 版 (brief.ps1) も同じ settings.json を読む。
 *
 * Usage:
 *   import { loadSettings } from "./paths.ts";
 *   const s = loadSettings();
 *   Deno.readTextFile(s.paths.cache);
 */

import { dirname, fromFileUrl, join } from "@std/path";

export type BriefSettings = {
  paths: {
    cache: string;
    journal: string;
    issuesMd: string;
    issuesJsonl: string;
    lexiconDir: string;
    /** settings.json 自身の場所（PowerShell 版の Get-BriefSettings が参照する） */
    settingsFile: string;
  };
  cache: {
    opencodeTtlHours: number;
    wslTtlMinutes: number;
    pythonTtlHours: number;
    refreshMinIntervalMinutes: number;
  };
};

const DENO_DIR = dirname(dirname(fromFileUrl(import.meta.url)));
const HOME     = Deno.env.get("USERPROFILE") ?? Deno.env.get("HOME") ?? ".";

/** settings.json に `~/...` と書かれていたら HOME に展開する */
function expand(p: string): string {
  if (p === "~") return HOME;
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return join(HOME, p.slice(2));
  }
  return p;
}

/**
 * settings.json の実体パス（model/ の 1 つ上 = brief/）。
 * 無ければ既定値。git には settings.example.json しか入っていない。
 */
export const SETTINGS_PATH = join(DENO_DIR, "settings.json");

const FALLBACK: BriefSettings = {
  paths: {
    cache:        join(HOME, ".startup", "brief-cache.json"),
    journal:      join(HOME, ".journal"),
    issuesMd:     join(HOME, ".issues", "issue-types.md"),
    issuesJsonl:  join(HOME, ".issues", "issue-types.jsonl"),
    // lexicon（word-ontology）は tools/ ではなく skills/ にある
    lexiconDir:   join(DENO_DIR, "..", "..", "skills", "genres", "learning", "word-ontology", "ontology"),
    settingsFile: join(DENO_DIR, "settings.json"),
  },
  cache: {
    opencodeTtlHours: 6,
    wslTtlMinutes: 30,
    pythonTtlHours: 24,
    refreshMinIntervalMinutes: 30,
  },
};

let cached: BriefSettings | null = null;

/**
 * settings.json を読む。壊れていれば FALLBACK を返す（起動を止めない）。
 * clone 直後は settings.json が無いので FALLBACK で動く。
 */
export function loadSettings(): BriefSettings {
  if (cached) return cached;
  try {
    const raw = JSON.parse(Deno.readTextFileSync(SETTINGS_PATH));
    const paths: Record<string, string> = { ...FALLBACK.paths };
    for (const [k, v] of Object.entries(raw.paths ?? {})) {
      if (typeof v === "string" && v) paths[k] = expand(v);
    }
    cached = {
      paths: paths as BriefSettings["paths"],
      cache: { ...FALLBACK.cache, ...(raw.cache ?? {}) },
    };
  } catch {
    cached = FALLBACK;
  }
  return cached;
}