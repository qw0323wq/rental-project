# 租金查詢平台 (rental-project)

## 專案架構

```
src/
├── app/
│   ├── page.tsx          # 首頁（搜尋入口 + 縣市概覽卡片）
│   ├── layout.tsx        # 全域 Layout（Tailwind + metadata）
│   └── search/
│       └── page.tsx      # 搜尋結果頁（主要功能頁面）
├── components/
│   ├── RoadSearch.tsx     # 路段快速搜尋（跨縣市全文搜尋）
│   ├── RentChart.tsx      # 各區租金長條圖
│   ├── RentTrendChart.tsx # 歷年租金走勢折線圖
│   ├── RentMap.tsx        # Leaflet 互動地圖（dynamic import, SSR disabled）
│   ├── DistrictTable.tsx  # 各區租金比較表
│   ├── DistrictProfile.tsx# 區域生活機能評分卡
│   ├── LiveabilityScore.tsx # 宜居指數雷達圖
│   ├── SafetyBadge.tsx    # 治安評分徽章
│   ├── StatCard.tsx       # 統計數字卡片（通用）
│   ├── BuildingInfo.tsx   # 建物資訊（屋齡/電梯/管理員/出租型態分布）
│   ├── RoadTable.tsx      # 路段租金比較表
│   ├── RoadDetail.tsx     # 單一路段詳情
│   ├── CpiRentChart.tsx   # CPI 住宅租金指數圖表（指數/年增率/區域比較）
│   ├── SocialHousingCard.tsx # 社會住宅統計（實價/現況/未來規劃）
│   ├── RentPricing.tsx    # 租金定價工具
│   ├── AskingPriceComparison.tsx # 591 開價 vs 實價比較
│   ├── RentalTypeAnalysis.tsx    # 出租型態分析
│   └── SquareEfficiency.tsx      # 坪效分析
├── lib/
│   ├── constants.ts       # 篩選選項常數（出租型態/坪數/租金/樓層）
│   └── coordinates.ts     # 縣市區域座標（地圖用）
├── types/
│   └── index.ts           # 共用 TypeScript 型別定義
public/
└── data/                  # 靜態 JSON 資料檔
    ├── cities.json        # 縣市清單 + 基本統計
    ├── rental_stats.json  # 主資料：各區/路段租金統計
    ├── rent_trends.json   # 歷年租金走勢
    ├── district_profiles.json # 區域生活機能評分
    ├── cpi_rent.json      # CPI 住宅租金指數
    ├── social_housing.json     # 社會住宅總覽
    ├── social_housing_real.json # 社宅實價登錄
    ├── rental_591.json    # 591 開價資料
    ├── records.json       # 原始紀錄
    └── overview.json      # 總覽資料
```

## 技術棧

- **框架**: Next.js 16 (App Router, React 19)
- **樣式**: Tailwind CSS 4
- **圖表**: Recharts 3
- **地圖**: Leaflet + React-Leaflet (client-only, dynamic import)
- **部署**: 靜態 JSON 資料，無後端 API

## 關鍵設計決策

1. **純前端架構**: 所有資料預先處理成靜態 JSON 放在 `public/data/`，不需後端 API
2. **地圖 SSR 禁用**: `RentMap` 使用 `dynamic()` + `ssr: false`，因 Leaflet 需要 `window`
3. **資料粒度**: 支援 縣市 → 區 → 路段 三層鑽取
4. **篩選維度**: 出租型態、房型、坪數、樓層、租金範圍

## :no_entry_sign: 不可修改的約束

- `public/data/*.json` — 資料由 data-pipeline 產生，不要手動修改
- `src/lib/coordinates.ts` — 座標資料手動維護，修改需謹慎驗證
- `src/types/index.ts` — 修改型別會影響所有元件，需全面測試

## 模組間依賴

```
page.tsx (首頁) → RoadSearch
search/page.tsx → 所有 components（主要消費者）
所有 components → types/index.ts, lib/constants.ts
RentMap → lib/coordinates.ts（地圖座標）
SocialHousingCard → lib/constants.ts（RENTAL_TYPE_CONFIG）
```

## 環境變數

目前無環境變數需求（純靜態資料）。

## 開發指令

```bash
npm run dev        # 開發伺服器 http://localhost:3000
npm run build      # 建置
npm run lint       # ESLint 檢查
npm test           # 執行測試（Vitest）
npm run test:watch # 測試 watch 模式
```

## 已完成的規範整改（2026-04-03）

- [x] SocialHousingCard.tsx 拆分為 social-housing/ 模組（6 個檔案）
- [x] CpiRentChart.tsx 拆分為 cpi-rent-chart/ 模組（6 個檔案）
- [x] search/page.tsx 計算邏輯抽到 lib/rental-utils.ts
- [x] Vitest 測試框架 + 14 個 rental-utils 單元測試
- [x] 關鍵邏輯加上 CRITICAL 標記和 JSDoc
