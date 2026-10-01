# PRD — brief

起動時に「今日の環境・進捗・次の一手」を1画面で出す。新鮮で支配的なブリーフ。

---

## 1. 解決する問題

朝の PC 起動時に、次の情報を **1 コマンド** で、手を動かさずに集めたい。

- ツールバージョン（pwsh / node / npm / python / opencode）の今
- WSL ディストリビューションの稼働状況
- opencode にアップデートがあるか
- 復習すべき英単語が due が何個あるか
- 今日の日報はあるか
- Issue Type Ledger に Issue が何件あるか

把它们放进一个画面，并且不让这个画面本身成为启动的负担。

---

## 2. 形态

三面。全部 `brief` から到達する。

| 面 | 呼び出し | 実装 | 特徴 |
|---|---|---|---|
| パネル | `brief` | PowerShell (`Get-BriefWidth` / `Write-BriefPanel`) | 起動時に自動描画。非対話なら描かない |
| Deno | `brief -Deno` | Deno + `view/render.ts` | 依存ゼロ。高速・クロスプラットフォーム |
| TUI | `brief -Tui` / `b` | Deno + Ink 5 (`view/tui.tsx`) | セクション切替 + 縦スクロール |

### 2.1 パネル（TUI でない方）

```
╭──────────────────────────────────────────╮
│ 🌸 good morning, soubi!  2026-10-01 09:53 │
│ 🧩 env                                    │
│    pwsh 7.6.6 · node 26.1.0 · npm 11.13.0│
│    wsl    Ubuntu ▶  ·  docker-desktop ■  │
│ 📓 recap  2026-10-01                     │
│    セッション 09:53                       │
│ 🎯 next                                   │
│    ✅  opencode 1.18.34 は最新            │
│    🌱  復習 due 0 / 160 語                │
│    📔  今日の日報 OK（2026-10-01）         │
│    🧩  Issue Type Ledger: IT-001〜IT-007  │
╰ brief / brief -Help で全オプション ──────╯
```

### 2.2 TUI

セクションは 4 つ。`env` / `recap` / `next` / `lexicon`。

- `recap` は journal 配下の最新 `recap-*.md` を**実際に読んで**表示する
- 内容が窓を超えるときは縦スクロールする（`↑↓` / `k j` / `PgUp` `PgDn` / `g` `G`）
- ビューポートの高さは端末 `rows` から逆算する。枠は**固定幅**で揺らさない

| キー | 動作 |
|---|---|
| `Tab` / `l` / `→` | 次のセクション |
| `h` / `←` | 前のセクション |
| `↑` `↓` / `k` `j` | 縦スクロール |
| `PgUp` / `PgDn` | 1 画面スクロール |
| `g` / `G` | 先頭 / 末尾 |
| `q` / `Ctrl-C` | 終了 |

---

## 3. 架构

### 3.1 原則

1. **パスはハードコードしない。** `settings.json` だけが正本。PowerShell 版も Deno 版もここだけを読む
2. **表示内容は controller 層が正本。** view は「並べ方」だけを決める。文言を view に書かない
3. **実装は PowerShell 側は単一ファイル**（`Documents/PowerShell/brief.ps1`）。cache / data / view / refresh worker すべて therein
4. **エイリアス登録は別。** 実装とは分離し、`Register-BriefAliases` にまとめる
5. **テスト同梱。** ロジックは必ず `_test.ts` / `.test.ps1` で守る

### 3.2 三層

```
model/       データと設定。cache の schema、設定の解決
   ↓
controller/  表示内容の正本。cache を「何かの行」に翻訳する
   ↓
view/        並べ方と描画だけ。panel.ts / render.ts / tui.tsx
```

**controller を置いた理由**: view が 2 つ（`render.ts` と `tui.tsx`）あり、
cache → 行の翻訳ロジックが両方に複製されていた。実際には文言まで食い違っていた
（`wsl  ` と `wsl    `、`📔 今日の日報` と `🧩 Issue Type Ledger` が片方にしか無い）。
片方だけ直すと片方が壊れる状態だった。

次の grep が空なら分離は完了している:

```bash
grep -E 'opencode|due|wsl|distros' view/render.ts view/tui.tsx view/panel.ts
```

### 3.3 ディレクトリ

```
brief/
├── deno.json                  タスク定義（check / test / verify / tui / brief / validate）
├── settings.example.json      設定の正本のひな形（commit される）
├── settings.json              各自の実設定（gitignore）
├── model/
│   ├── paths.ts               settings.json 解決 + FALLBACK + ~ 展開
│   ├── cache.ts               BriefCacheSchema（zod）と read/write helper
│   ├── validate.ts            キャッシュの整合性検証
│   ├── paths_test.ts
│   └── cache_test.ts
├── controller/
│   ├── brief.ts               ★ 表示内容の正本
│   └── brief_test.ts
└── view/
    ├── panel.ts               displayWidth / wrapText / truncateToWidth / renderPanel
    ├── render.ts              Deno 版パネル描画（中身は controller 1 関数）
    ├── tui.tsx                Ink 版 TUI（中身は controller 1 関数）
    └── panel_test.ts
```

PowerShell 版（このリポジトリ外）:

```
Documents/PowerShell/
├── brief.ps1                  単一ファイル（cache / data / view / entrypoint / refresh worker）
└── tests/brief.test.ps1
```

### 3.4 controller の責務

```ts
loadSettings()                 // settings.json を解決
await loadModel({ cache })     // cache / journal / issues を読む
localDate(now) / localTime(now)// ローカル時刻（UTC を使わない）
buildSection(model, section)   // TUI 用：セクション → string[]
buildPanel(model)              // パネル用：1 画面 → PanelRow[]
parseRecap(path, raw)          // recap md を構造化
loadRecap(journalDir)          // 最新の recap を探す
loadIssueCount(md, jsonl)      // md 優先、なければ jsonl
```

`loadModel` は `now` を受け取れる。テストは時刻を固定できる。

### 3.5 設定

`settings.json`（正本）:

```json
{
  "paths": {
    "cache":       "~/.startup/brief-cache.json",
    "journal":     "~/.journal",
    "issuesMd":    "~/.issues/issue-types.md",
    "issuesJsonl": "~/.issues/issue-types.jsonl",
    "lexiconDir":  "~/.config/opencode/skills/genres/learning/word-ontology/ontology",
    "settingsFile": "~/.config/opencode/skills/brief/settings.json"
  },
  "cache": {
    "opencodeTtlHours": 6,
    "wslTtlMinutes": 30,
    "pythonTtlHours": 24,
    "refreshMinIntervalMinutes": 30
  }
}
```

`settings.json` が無ければ既定値で動く（clone 直後はこの状態）。

### 3.6 キャッシュ（TTL）

遅い probe は起動を待たせない。バックグラウンドで走らせてキャッシュに書く。

| 項目 | 取得方法 | TTL |
|---|---|---|
| opencode latest | `npm view opencode-ai version` | 6 時間 |
| WSL distros | `wsl --list --verbose` | 30 分 |
| python | `python3.13 -V` | 24 時間 |

`refreshMinIntervalMinutes` 以内なら刷新しない。起動時は `Start-BriefRefresh` が detached で 1 回だけ投げる。

---

## 4. 表示幅

ボックスの安定は**文字幅表の正しさ**に依存する。以下は幅 2：

```
0x1100-0x115F  Hangul Jamo
0x2190-0x21FF  Arrows        ← → ↑ ↓
0x25A0-0x25FF  Geometric     ■ ▲ ▶
0x2600-0x27BF  Misc Symbols  ✅ ❓ ☀
0x2B00-0x2BFF  Misc+Arrows   ⬆
0x2E80-0x2EFF  CJK 補助記号
0x2E80-0x303E  CJK Radicals
0x3041-0x33FF  ひらがな〜CJK 互換
0x3400-0x4DBF  CJK 拡張 A
0x4E00-0x9FFF  CJK 統合漢字
0xA000-0xA4CF  Yi
0xAC00-0xD7A3  Hangul 音節
0xF900-0xFAFF  CJK 互換漢字
0xFE30-0xFE6F  CJK 互換形
0xFF00-0xFF60  全角
0xFFE0-0xFFE6  全角記号
0x1F300-0x1FAFF Emoji
```

幅 0：`0xFE00-0xFE0F`（VS16）/ `0x0300-0x036F`（結合文字）/ `0x200B-0x200F`

**注意**: `·`（U+00B7 中黒）は表に無いので**幅 1**。

この表から 1 つ抜けると padding 計算がずれ、枠が揺れる。`panel_test.ts` が守る。

---

## 5. タスク

```
deno task brief      Deno 版パネル
deno task tui        TUI
deno task validate   キャッシュ検証
deno task check      型チェック（model/ view/ 全体）
deno task test       Deno テスト
deno task verify     check + test
```

PowerShell 側は `brief.ps1 -Test`。

---

## 6. 既知の制約

- `deno task` は `deno.json` のあるディレクトリで実行する必要がある。
  `b` エイリアスは絶対パスで直接起動するので cwd 非依存
- Deno 依存（react / ink）は初回だけ取得が遅い。2 回目以降はキャッシュが効く
- `Documents/brief/` に旧実装の残骸がある。**参照元ゼロの孤児**。未削除
- `prd.md`（このファイル）は新構造に追随している

---

## 7. 設計判断の記録（再発しないため）

### 7.1 PowerShell の罠

**`@()` の末尾カンマは構文エラー**

```powershell
@('txt', 'a'), 'b'),   # ← NG  ',' の後に式がありません
@('txt', 'a'), @('txt','b')   # ← OK（末尾に , を付けない）
```

**`"文字列" + $(if ...)` は配列化する**

```powershell
# NG：右辺が配列になると + が連結になり、@('txt', ...) が 3 要素になる。
#    Panel は $l[1] を読むので 1 文字しか表示されない。
$lines += ,@('txt', "wsl " + $(if ($c) { $a -join ' ' } else { '' }))

# OK：テキストを先に変数へ切り出す
$text = 'wsl '
if ($c) { $text += $a -join ' ' }
$lines += , @('txt', $text)
```

**関数名と alias 名は衝突する**（名前解決は大文字小文字を区別しない）

```powershell
function global:Brief { }          # と
Set-Alias brief -Value Brief       # は自己参照で解決不能
# → 関数名は Invoke-Brief にする
```

**`[Console]::WindowWidth` は非対話で throw する** → `try/catch` で既定値へ

### 7.2 TypeScript の罠

**`wrapText` の強制分割で無限ループ**

継続行インデント（`"  "`）を足すと、1 文字削って 2 文字足すので文字列が伸びる。
インデントは**語境界で切ったときだけ**足す。

**`deno test` は TTY 無しだと `Raw mode is not supported` で落ちる**
Ink を import するテストは無いこと（`tui.tsx` は `_test.ts` ではない）。

### 7.3 文字幅

`▶ ■ ✅ ❓ ⬆ ← →` は `0x2E80` 未満のブロックにある。
CJK 用の表だけでは 1 幅扱いになり padding がずれる → §4 の表を使うこと。

---

## 8. 未来度量

- [ ] `Documents/brief/` の孤児を削除、または `model/env.ts` 等の有用な実装を吸収する
- [ ] `deno task` を cwd 非依存にする（DENO_DIR 経由のラッパースクリプト）
- [ ] `issues` 台帳（`issue-types.md`）の表示を `next` から独立セクションへ
- [ ] TUI の `env` を live probe 化（起動は速いので MITM しない）