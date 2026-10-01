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
| `brief -Tui` / `b` | `view/tui.tsx`（Ink 5） | セクション切替 + 縦スクロール |

## Setup

```bash
git clone https://github.com/bonsai/brief
cd brief
cp settings.example.json settings.json   # 自分のパスに直す
```

`settings.json` が無ければ既定値（`$HOME/.startup/brief-cache.json` 等）で動くので、
必需ではない。

## 使い方

```bash
deno task brief      # Deno 版パネル
deno task tui        # TUI
deno task validate   # キャッシュ検証
deno task check      # 型チェック
deno task test       # テスト
deno task verify     # check + test
```

TUI のキー:

| キー | 動作 |
|---|---|
| `Tab` / `l` / `→` | 次のセクション |
| `h` / `←` | 前のセクション |
| `↑` `↓` / `k` `j` | 縦スクロール |
| `PgUp` / `PgDn` | 1 画面スクロール |
| `g` / `G` | 先頭 / 末尾 |
| `q` / `Ctrl-C` | 終了 |

PowerShell 版は `Documents/PowerShell/brief.ps1` に単一ファイルで存在する（本リポジトリ外）。
`brief -Help` で全オプション。

## 構成

三層。**controller が表示内容の正本**。

```
model/       データと設定
   ↓
controller/  ★ cache を「何かの行」に翻訳する
   ↓
view/        並べ方と描画だけ
```

```
brief/
├── deno.json                タスク定義
├── settings.example.json    設定の正本のひな形
├── model/
│   ├── paths.ts             settings.json 解決 + FALLBACK + ~ 展開
│   ├── cache.ts             BriefCacheSchema（zod）
│   ├── validate.ts          キャッシュ検証
│   └── *_test.ts
├── controller/
│   ├── brief.ts             ★ 表示内容の正本（文言はここだけで決める）
│   └── brief_test.ts
└── view/
    ├── panel.ts             displayWidth / wrapText / renderPanel
    ├── render.ts            Deno 版パネル
    ├── tui.tsx              Ink 版 TUI
    └── panel_test.ts
```

view が2つあるためcontroller を置いています。
文言を view に書くと片方だけ直る状態になるので。

```bash
# 分離が完了しているかの確認（空ならOK）
grep -E 'opencode|due|wsl|distros' view/render.ts view/tui.tsx view/panel.ts
```

## 原則

1. **パスはハードコードしない。** `settings.json` だけが正本
2. **文言は controller に書く。** view は並べ方だけ
3. **遅い probe はバックグラウンド。** TTL 付きキャッシュに書いてから読む
4. **枠は揺らさない。** 文字幅表（`panel.ts` / `Get-BriefWidth`）をテストで守る
5. **テスト同梱。** ロジックは `_test.ts` / `.test.ps1` で守る

## 詳細

設計判断と既知の罠は [docs/prd.md](./docs/prd.md) を参照。
残務は [docs/kanban.md](./docs/kanban.md)（GitHub Issues と同期）。

## License

MIT