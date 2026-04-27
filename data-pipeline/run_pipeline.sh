#!/bin/bash
# 租金查詢平台 — 資料 Pipeline
# 每週自動：下載 → 處理 → 爬蟲 → 上傳
set -e

PIPELINE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$PIPELINE_DIR")"
VENV_PYTHON="/Users/terry/procurement-bot/venv/bin/python"
LOG_FILE="$PIPELINE_DIR/pipeline.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "===== Pipeline 開始 ====="

# Step 1: 下載並處理實價登錄
log "[1/4] 下載實價登錄資料..."
cd "$PIPELINE_DIR"
$VENV_PYTHON 01_download_and_process.py >> "$LOG_FILE" 2>&1

# Step 2: 產生補充資料
log "[2/4] 產生補充資料..."
$VENV_PYTHON 02_generate_supplementary.py >> "$LOG_FILE" 2>&1

# Step 3: 爬 591 租屋
log "[3/4] 爬取 591 租屋資料..."
$VENV_PYTHON 03_crawl_591.py >> "$LOG_FILE" 2>&1

# Step 4: 捷運空屋率
log "[4/4] 處理捷運站空屋率..."
$VENV_PYTHON 04_mrt_vacancy.py >> "$LOG_FILE" 2>&1

# Step 5: Git push → Vercel 自動部署
log "[Deploy] Git push..."
cd "$PROJECT_DIR"
git add public/data/
if git diff --cached --quiet; then
    log "[Deploy] 資料沒有變更，跳過"
else
    git commit -m "data: auto-update $(date '+%Y-%m-%d')"
    git push origin master
    log "[Deploy] 已推送到 GitHub，Vercel 自動部署中"
fi

log "===== Pipeline 完成 ====="
