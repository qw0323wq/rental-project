#!/bin/bash
# ==============================================
# 租金行情查詢平台 — Mac Mini 環境設定腳本
# 用法：chmod +x setup-mac.sh && ./setup-mac.sh
# ==============================================

set -e

echo "=============================="
echo "  租金行情查詢平台 Mac 設定"
echo "=============================="

# 1. 檢查必要工具
echo ""
echo "[1/5] 檢查環境..."

if ! command -v node &>/dev/null; then
  echo "  ❌ Node.js 未安裝，正在安裝..."
  if command -v brew &>/dev/null; then
    brew install node
  else
    echo "  請先安裝 Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
  fi
fi
echo "  ✅ Node.js $(node -v)"

if ! command -v python3 &>/dev/null; then
  echo "  ❌ Python3 未安裝，正在安裝..."
  brew install python3
fi
echo "  ✅ Python $(python3 --version)"

if ! command -v git &>/dev/null; then
  echo "  ❌ Git 未安裝，正在安裝..."
  brew install git
fi
echo "  ✅ Git $(git --version | head -1)"

# 2. 安裝前端依賴
echo ""
echo "[2/5] 安裝前端依賴..."
npm install

# 3. 安裝 Python ETL 依賴
echo ""
echo "[3/5] 安裝 Python ETL 依賴..."
pip3 install pandas requests tqdm 2>/dev/null || pip install pandas requests tqdm

# 4. 編譯 MCP Server
echo ""
echo "[4/5] 編譯 MCP Server..."
cd mcp-server
npm install
npx tsc
cd ..

# 5. 確認 Build
echo ""
echo "[5/5] 測試 Build..."
npm run build

echo ""
echo "=============================="
echo "  ✅ 設定完成！"
echo "=============================="
echo ""
echo "常用指令："
echo "  npm run dev                    # 開發伺服器 (localhost:3000)"
echo "  npm run build                  # 正式 Build"
echo "  python3 data-pipeline/01_download_and_process.py   # 跑 ETL"
echo "  python3 data-pipeline/02_generate_supplementary.py # 補充資料"
echo "  git push origin master         # 部署到 Vercel"
echo ""
echo "MCP Server："
echo "  在此目錄下開 Claude Code，即可直接查詢租金資料"
echo ""
