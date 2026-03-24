#!/bin/bash
# ==============================================
# 在 Mac 上建立 Claude Code 專案記憶
# 用法：cd rental-project && chmod +x setup-claude-memory.sh && ./setup-claude-memory.sh
# ==============================================

set -e

# 取得專案的絕對路徑
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Claude Code 的記憶路徑格式：把 / 換成 --，前面加 --
# 例如 /Users/terry/rental-project → -Users-terry-rental-project
ENCODED_PATH=$(echo "$PROJECT_DIR" | sed 's|/|--|g' | sed 's|^-|--|')
MEMORY_DIR="$HOME/.claude/projects/${ENCODED_PATH}/memory"

echo "=============================="
echo "  設定 Claude Code 專案記憶"
echo "=============================="
echo "  專案路徑：$PROJECT_DIR"
echo "  記憶路徑：$MEMORY_DIR"
echo ""

mkdir -p "$MEMORY_DIR"

# 寫入主記憶檔
cat > "$MEMORY_DIR/MEMORY.md" << 'MEMEOF'
# 租金行情查詢平台 — 專案記憶

## 專案基本資訊
- **名稱**：租金行情查詢 | 全台租金資料庫
- **GitHub**: github.com/qw0323wq/rental-project
- **線上**: https://rental-project-gamma.vercel.app
- **部署**：Vercel 自動部署（push master 即觸發）
- **資料來源**：內政部實價登錄 2.0 + 租屋網爬蟲

## 使用者
- 張銘瑋，語言：繁體中文，時區：Asia/Taipei
- ETL 跑完後要 `npm run build` 確認再 push

## 技術架構
- **前端**：Next.js 16.1.6 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **地圖**：Leaflet + react-leaflet（熱力圖/標記圖切換）
- **圖表**：Recharts 3.8
- **資料**：靜態 JSON（public/data/），無資料庫
- **ETL**：Python (pandas) 下載政府 ZIP → 清洗 → 統計 → JSON
- **MCP Server**：TypeScript，5 個 tools（list_cities, query_rent, query_social_housing, search_address, get_district_profile）
- **自動更新**：GitHub Actions 每週一排程 + 591 爬蟲

## 關鍵檔案
- `src/app/search/page.tsx` — 主搜尋頁（最大最複雜的檔案）
- `src/components/SocialHousingCard.tsx` — 社宅統計（含出租型態篩選）
- `src/components/RentMap.tsx` — 地圖（熱力圖/標記圖）
- `src/components/RentPricing.tsx` — 租金定價建議工具
- `src/components/CpiRentChart.tsx` — CPI 租金指數圖
- `data-pipeline/01_download_and_process.py` — 主 ETL
- `data-pipeline/02_generate_supplementary.py` — 補充資料 ETL
- `mcp-server/src/index.ts` — MCP Server

## ETL 重點
- CSV 35 欄（112S4+），舊格式 29 欄
- Col 29: 出租型態（整棟出租/獨立套房/分租套房/分租雅房/分層出租）
- Col 34: 租賃住宅服務（社會住宅識別）
- 統計層級：by_type, by_rental_type (含 avg_rooms), by_floor, by_rent_range, roads
- 社宅：housing_service 含 "社會住宅" → 包租轉租/代管

## 搜尋頁 URL 參數
city, district, road, type(房型), rentalType(出租型態), floor, rent, area

## 常用指令
```bash
npm run dev                                    # 本地開發
python3 data-pipeline/01_download_and_process.py  # 跑主 ETL
python3 data-pipeline/02_generate_supplementary.py # 補充資料
npm run build                                  # Build 確認
git push origin master                         # 部署
cd mcp-server && npx tsc                       # 編譯 MCP Server
```
MEMEOF

echo "✅ 記憶檔已建立：$MEMORY_DIR/MEMORY.md"
echo ""
echo "現在在此目錄開 Claude Code，它就會自動載入專案記憶。"
echo "測試：claude 然後問「這個專案是什麼？」"
