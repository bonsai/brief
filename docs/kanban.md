# kanban

残務の台帳。**正本は各項目の「場所」**。ここは状況の要約で、仕様は持たない。

- 更新: 2026-10-01
- 関連: `brief` = https://github.com/bonsai/brief ／ 道具台帳 = `Documents/PowerShell/tools.ps1`

---

## 進行中

| # | 内容 | 場所 |
|---|---|---|
| — | （なし） | |

---

## 優先度高

| # | 内容 | 場所 / 備考 |
|---|---|---|
| 1 | **ランチャーのリストが3重複**。`launchers.ps1` の数字キー（0-9・10項目ハードコード）、`menu.ps1` の F12（オントロジ7件＋opencode系10件ハードコード）、`tools.ps1` の台帳（10項目・正本）。全部 `tools.ps1` 参照に寄せる | `Documents/PowerShell/launchers.ps1:17-26`, `menu.ps1:95` |
| 2 | **`prd.md` が「セクションは 4 つ」のまま**。unify で 5 つ（`issue` 追加）になったのに未更新 | `brief/prd.md:52` |
| 3 | **`mdt` の起動が遅い**。WSL の DrvFs（`/mnt/c`）上の ELF なので `test -x` だけで **9.7秒**。WSL ネイティブ（`~/` 配下）に `cargo build --release` すれば桁違いに速い | `/mnt/c/Users/0501JP/sotsusei/md-tui/target/release/mdt` |
| 4 | **`brief -Tui` / `b` の実地確認**。`. $PROFILE` 後に TUI・F12 menu・`tool` を人が操作して確認する（CI では raw mode が無いため未検証） | 対話セッションで要手動 |

---

## 優先度中

| # | 内容 | 場所 / 備考 |
|---|---|---|
| 5 | **PS1 と Deno で文言が二重管理**。`brief.ps1` の `Show-StartupBrief` と `controller/brief.ts` の `buildPanel` が同じ内容を Independentlyに組み立てている。片方だけ直すとずれる | `Documents/PowerShell/brief.ps1:330-420`, `brief/controller/brief.ts` |
| 6 | **`tools.ps1` が `Get-BriefWidth` を借りている**。tools は brief に依存してしまう。文字幅表を独立させるか、brief 由来と明記する | `tools.ps1:221,229` |
| 7 | **`ToolPaths.Skills` が未使用**。`word-ontology` が `skills/` にあるため残しているが、読み手が無い。削除するか使うか決める | `tools.ps1:27` |
| 8 | **`tools/brief` が nested repo**。`opencode/skills` repo の内側に別の git repo がある。親 repo が見る `?? tools/` をどうするか（ignore / submodule / 切り出し） | `~/.config/opencode/tools/brief/.git` |
| 9 | **schema.json に PowerShell 側の型を反映**。`ToolStatusReady/Planned` の定数セットと `BriefSections` が未記載。`ToolEntry.plan` は任意にしたが実際の台帳と要確認 | `brief/model/schema.ts` |

---

## 計画中（未実装・`tool` の planned 3件）

| # | 内容 | 場所 |
|---|---|---|
| 10 | `brainstorm` — 発散思考キャニスタ。SKILL.md を書いて skill 登録 | `tools.ps1` の planned セクション |
| 11 | `goal` — 目標の宣言・進捗・達成判定。`~/.journal/goal.md` に置き brief から読む | 同上 |
| 12 | `dev-env` — 開発環境の一覧。`settings.json` を読み path / version を表示。**`env` は GNU coreutils の `env.exe` をそのまま残す**（名前が衝突するので別名） | 同上 |

---

## 完了（2026-10-01）

- brief を `skills/brief` → `tools/brief` へ移動、参照 4 箇所を修正
- PowerShell 側を単一ファイル `brief.ps1` へ統合（7ファイル → 1）
- 関数名と alias 名の衝突を解消（`Brief` → `Invoke-Brief`）
- controller 層新設。view の重複（cache → 行の翻訳）を潰した
- 5 セクションの型を対称化（`env` / `recap` / `issue` が `string[]` / `interface` / `number` だった）
- `RecapSchema` の二重定義を削除
- 型定義を JSON Schema で生成（`schema.json` 19 definitions、`deno task schema`）
- `tool` コマンドと道具オントロジ（7色）を作る
- menu（F12）をビューポート化。バッファ超過で `SetCursorPosition` が例外になるのを修正
- `brief -Tui` に縦スクロール追加（`↑↓ k j PgUp PgDn g G`）
- 枠の揺れの真因（`▶ ■ ✅` の文字幅表欠落）を修正
- tests: Deno 77 / PowerShell 173 = **250 PASS / 0 FAIL**

---

## メモ（再発しないため）

- PowerShell の `enum` は **int 専用**。文字列 backing はできない → 定数セット + validator で契約する
- PowerShell の `@(1,2,)` は**末尾カンマで構文エラー**（JS/Python と逆）
- PowerShell の `"文字列" + $(if ...)` は**配列化する**。テキストを先に変数へ切り出す
- PowerShell の名前解決は**大文字小文字を区別しない**。関数名と alias 名を分ける
- PowerShell の `f $x` は**関数呼び出しと解釈されない**。`f ($x)` とする
- `[Console]::SetCursorPosition` の上限は `WindowHeight` ではなく **`BufferHeight`**
- `toISOString()` は **UTC**。JST 0:00-9:00 で日付がずれる → ローカル表記で組み立てる
- Deno の `z.date()` は **JSON Schema で表現不可** → string にする
- `▶ ■ ✅ ❓ ⬆ ← →` は `0x2E80` 未満のブロックにあり、CJK 用の文字幅表だけでは 1 幅扱いになる
- DrvFs（`/mnt/c`）上の Linux バイナリは**起動に数秒〜十数秒**かかる。ネイティブ配置が速い