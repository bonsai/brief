# brief

起動ブリーフ。PC 起動時の「今日の環境・進捗・次の一手」を 1 画面で出す。

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

## 三つの面

| 呼び出し | 実装 | 特徴 |
|---|---|---|
| `brief` | PowerShell パネル | 起動時に自動描画 |
| `brief -Deno` | `view/render.ts` | 依存ゼロ・高速 |
| `brief -Tui` / `b` | `view/tui.tsx`（Ink 5） | 5 セクション + 縦スクロール |

セクションは `env` / `recap` / `next` / `lexicon` / `issue` の 5 つ。`Tab` `l` `→` で切替、
`↑↓` `k j` `PgUp` `PgDn` `g` `G` で縦スクロール、`q` で終了。

## Setup

```bash
git clone https://github.com/bonsai/brief
cd brief
cp settings.example.json settings.json   # 自分のパスに直す
```

`settings.json` が無ければ既定値で動くので必須ではない。
パスは `~` で書ける（`model/paths.ts` が展開する）。**ハードコードしない。**

## 使い方

```bash
deno task brief      # Deno 版パネル
deno task tui        # TUI
deno task validate   # キャッシュ検証
deno task schema     # 型定義（schema.json）を生成
deno task verify     # lint + check + test + schema ドリフト
```

## 構成

```
model/       データと設定
   ↓
controller/  ★ 表示内容の正本（文言はここだけで決める）
   ↓
view/        並べ方と描画だけ
```

view が 2 つあるため controller を置いています。文言を view に書くと片方だけ直る状態になるので。

- 型定義は `schema.json`。`model/cache.ts` の zod から**生成**する（手で編集しない）
- ignore するものの正本は `.gitignore`
- 遅い probe はバックグラウンドで走らせ、TTL 付きキャッシュに書いてから読む

## ドキュメント

| 種類 | 場所 |
|---|---|
| 設計仕様 | [#13](https://github.com/bonsai/brief/issues/13) |
| ローカルパスの現状 | [#14](https://github.com/bonsai/brief/issues/14) |
| 再発しないための記録 | [#15](https://github.com/bonsai/brief/issues/15) |
| 残務・進捗 | [Issues](https://github.com/bonsai/brief/issues) |
| プロジェクト管理の運用 | [#16](https://github.com/bonsai/brief/issues/16) |

**残務の正本は GitHub Issue**。README には残務表を作らない（二重管理になるため）。

## CI

`push` と `pull_request` で `deno task verify` を回す。`schema.json` のドリフトも検出する。

## License

MIT