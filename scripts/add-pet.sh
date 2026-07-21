#!/usr/bin/env bash
# 把一隻 petdex 寵物裝進專案素材庫 src/public/pets/library/<slug>/
# 用法：npm run add-pet <slug>
#   例：npm run add-pet doraemon
# 純 shell、無新 npm 依賴；素材來源為 petdex install 後的 ~/.codex/pets/<slug>/
set -euo pipefail

SLUG="${1:-}"
if [ -z "$SLUG" ]; then
  echo "用法：npm run add-pet <slug>（先用 npx petdex list 找 slug）" >&2
  exit 1
fi

# 專案根 = 本腳本所在目錄的上一層
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$HOME/.codex/pets/$SLUG"
DEST="$ROOT/src/public/pets/library/$SLUG"

echo "→ 透過 petdex 安裝 $SLUG ..."
npx --yes petdex install "$SLUG"

if [ ! -f "$SRC/spritesheet.webp" ] || [ ! -f "$SRC/pet.json" ]; then
  echo "找不到 $SRC/spritesheet.webp 或 pet.json；請確認 slug 正確、或 petdex 安裝位置" >&2
  exit 1
fi

mkdir -p "$DEST"
cp "$SRC/spritesheet.webp" "$DEST/"
cp "$SRC/pet.json" "$DEST/"
echo "✓ 已加入素材庫：$DEST"
echo "  重整 dashboard 後，齒輪面板即可看到並選用 $SLUG"
