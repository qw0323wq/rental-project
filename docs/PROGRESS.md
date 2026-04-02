# 租金查詢平台 — 施工日誌

## 2026-04-03

### 規範合規整改（全部完成）
- [x] 建立 CLAUDE.md（專案操作手冊）
- [x] 建立 docs/SPEC.md（產品規格）
- [x] 建立 docs/PROGRESS.md（施工日誌）
- [x] SocialHousingCard.tsx 拆分：862 行 → social-housing/ 模組（6 檔案，最大 392 行）
- [x] CpiRentChart.tsx 拆分：455 行 → cpi-rent-chart/ 模組（6 檔案，最大 105 行）
- [x] search/page.tsx 計算邏輯抽到 lib/rental-utils.ts：520 → 475 行
- [x] 設定 Vitest 測試框架 + 14 個 rental-utils 單元測試
- [x] 補關鍵邏輯 CRITICAL 標記 + JSDoc 文件註解
- [x] Build 驗證通過、測試全部通過
