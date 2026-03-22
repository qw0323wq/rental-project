"""
591 租屋網 Playwright 爬蟲
從搜尋結果頁抓取各區域的當前掛牌租金資料。
只讀取搜尋結果列表，不進入個別物件頁面。

使用方式：
  pip install playwright
  playwright install chromium
  python 03_crawl_591.py
"""

import json
import random
import time
import re
from pathlib import Path
from datetime import datetime

# 輸出路徑
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
OUTPUT_FILE = OUTPUT_DIR / "rental_591.json"

# 591 縣市代碼對照
REGIONS = {
    1: "台北市",
    3: "新北市",
    6: "桃園市",
    5: "新竹市",
    4: "新竹縣",
    2: "基隆市",
    10: "台中市",
    8: "苗栗縣",
    14: "彰化縣",
    11: "南投縣",
    15: "雲林縣",
    17: "台南市",
    12: "嘉義市",
    16: "嘉義縣",
    19: "高雄市",
    13: "屏東縣",
    9: "宜蘭縣",
    18: "花蓮縣",
    20: "台東縣",
    21: "澎湖縣",
    22: "金門縣",
    23: "連江縣",
}

# 只爬主要城市（減少請求量）
TARGET_REGIONS = [1, 3, 6, 10, 17, 19]  # 六都
# TARGET_REGIONS = list(REGIONS.keys())  # 全部縣市（需更多時間）

# 每區最多爬幾頁
MAX_PAGES_PER_REGION = 3
# 每頁約 30 筆

# 隨機延遲範圍（秒）
MIN_DELAY = 5
MAX_DELAY = 12


def random_delay():
    """模擬人類瀏覽的隨機延遲"""
    delay = random.uniform(MIN_DELAY, MAX_DELAY)
    time.sleep(delay)


def parse_rent(text: str) -> int | None:
    """解析租金文字，如 '12,000' → 12000"""
    if not text:
        return None
    nums = re.sub(r"[^\d]", "", text)
    return int(nums) if nums else None


def parse_area(text: str) -> float | None:
    """解析坪數文字，如 '12.5坪' → 12.5"""
    if not text:
        return None
    match = re.search(r"([\d.]+)", text)
    return float(match.group(1)) if match else None


def crawl_591():
    """主要爬蟲邏輯"""
    # 延遲 import，讓沒裝 playwright 的環境不會直接報錯
    from playwright.sync_api import sync_playwright

    all_data: dict = {
        "crawl_date": datetime.now().strftime("%Y-%m-%d"),
        "source": "591租屋網",
        "data_type": "asking_price",
        "note": "此為當前掛牌問價，非成交價。資料僅供參考。",
        "cities": {},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="zh-TW",
        )

        page = context.new_page()

        # 先訪問首頁建立 session
        print("開啟 591 首頁...")
        page.goto("https://rent.591.com.tw/", wait_until="networkidle", timeout=30000)
        random_delay()

        for region_id in TARGET_REGIONS:
            city_name = REGIONS[region_id]
            print(f"\n{'='*50}")
            print(f"爬取 {city_name}（region={region_id}）")
            print(f"{'='*50}")

            city_listings: list[dict] = []

            for page_num in range(MAX_PAGES_PER_REGION):
                first_row = page_num * 30
                url = (
                    f"https://rent.591.com.tw/list"
                    f"?region={region_id}"
                    f"&kind=0"
                    f"&order=posttime"
                    f"&orderType=desc"
                    f"&firstRow={first_row}"
                )

                print(f"  第 {page_num + 1} 頁：{url}")

                try:
                    page.goto(url, wait_until="networkidle", timeout=30000)
                except Exception as e:
                    print(f"  [WARN] 頁面載入超時: {e}")
                    try:
                        page.wait_for_timeout(5000)
                    except Exception:
                        pass

                # 等待列表渲染
                try:
                    page.wait_for_selector(
                        "[class*='item'], [class*='listInfo'], [class*='rent-item'], section",
                        timeout=10000,
                    )
                except Exception:
                    print("  [WARN] 找不到列表元素，可能頁面結構改變")

                # 抓取物件卡片
                listings = extract_listings(page)

                if not listings:
                    print(f"  第 {page_num + 1} 頁無資料，停止")
                    break

                print(f"  抓到 {len(listings)} 筆")
                city_listings.extend(listings)
                random_delay()

            # 統計此城市
            if city_listings:
                city_stats = aggregate_city(city_name, city_listings)
                all_data["cities"][city_name] = city_stats
                print(f"\n  {city_name} 共 {len(city_listings)} 筆")
                if city_stats.get("median_rent"):
                    print(f"  中位數問價：${city_stats['median_rent']:,}/月")

        browser.close()

    # 寫入 JSON
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)

    total = sum(c.get("total_count", 0) for c in all_data["cities"].values())
    print(f"\n{'='*50}")
    print(f"完成！共 {total} 筆，{len(all_data['cities'])} 個城市")
    print(f"輸出：{OUTPUT_FILE}")
    print(f"{'='*50}")


def extract_listings(page) -> list[dict]:
    """從當前頁面提取所有物件卡片資料。

    591 的 DOM 結構可能會改版，這裡用多種 selector 嘗試。
    """
    listings: list[dict] = []

    # 嘗試用 JS 直接從頁面抓取所有租金相關資訊
    items = page.evaluate("""
    () => {
        const results = [];

        // 策略 1：找所有含租金的 section/article/div
        const cards = document.querySelectorAll(
            'section[class*="item"], div[class*="item"], article'
        );

        for (const card of cards) {
            const text = card.innerText || '';
            // 必須包含「元/月」或數字+租金相關文字
            if (!text.includes('元') && !text.includes('月') && !/\\d{1,3},\\d{3}/.test(text)) {
                continue;
            }

            const item = {};

            // 租金：找含有大數字的元素
            const rentMatch = text.match(/(\\d{1,3},\\d{3})/);
            if (rentMatch) {
                item.rent = rentMatch[1];
            }

            // 坪數
            const areaMatch = text.match(/(\\d+\\.?\\d*)\\s*坪/);
            if (areaMatch) {
                item.area = areaMatch[1];
            }

            // 地址/標題：找第一個連結或標題
            const titleEl = card.querySelector('a[href*="detail"], h3, [class*="title"]');
            if (titleEl) {
                item.title = (titleEl.textContent || '').trim().substring(0, 80);
            }

            // 類型：整層/套房/雅房
            const typeMatch = text.match(/(整層住家|獨立套房|分租套房|雅房|整層|套房)/);
            if (typeMatch) {
                item.type = typeMatch[1];
            }

            // 樓層
            const floorMatch = text.match(/(\\d+)\\s*樓/);
            if (floorMatch) {
                item.floor = floorMatch[1];
            }

            // 只保留有租金的
            if (item.rent) {
                results.push(item);
            }
        }

        // 策略 2：如果策略 1 沒抓到，嘗試從整頁文字抓
        if (results.length === 0) {
            const allText = document.body.innerText;
            const rentPattern = /(\\d{1,3},\\d{3})\\s*元/g;
            let match;
            while ((match = rentPattern.exec(allText)) !== null) {
                results.push({ rent: match[1], raw: true });
            }
        }

        return results;
    }
    """)

    for item in items:
        listing: dict = {}
        rent = parse_rent(item.get("rent", ""))
        if rent and 1000 < rent < 200000:
            listing["rent"] = rent
            if item.get("area"):
                listing["area_ping"] = parse_area(item["area"])
            if item.get("title"):
                listing["title"] = item["title"]
            if item.get("type"):
                listing["type"] = item["type"]
            if item.get("floor"):
                listing["floor"] = int(item["floor"])
            listings.append(listing)

    return listings


def aggregate_city(city_name: str, listings: list[dict]) -> dict:
    """將個別物件列表彙總成城市統計"""
    rents = sorted([l["rent"] for l in listings])
    n = len(rents)

    stats: dict = {
        "total_count": n,
        "median_rent": rents[n // 2] if n > 0 else 0,
        "avg_rent": round(sum(rents) / n) if n > 0 else 0,
        "min_rent": rents[0] if n > 0 else 0,
        "max_rent": rents[-1] if n > 0 else 0,
    }

    # 坪數統計
    areas = [l["area_ping"] for l in listings if l.get("area_ping")]
    if areas:
        stats["avg_area_ping"] = round(sum(areas) / len(areas), 1)

    # 按類型分組
    by_type: dict = {}
    for l in listings:
        t = l.get("type", "未分類")
        if t not in by_type:
            by_type[t] = []
        by_type[t].append(l["rent"])

    type_stats: dict = {}
    for t, type_rents in by_type.items():
        sr = sorted(type_rents)
        tn = len(sr)
        type_stats[t] = {
            "count": tn,
            "median_rent": sr[tn // 2],
            "avg_rent": round(sum(sr) / tn),
            "min_rent": sr[0],
            "max_rent": sr[-1],
        }
    if type_stats:
        stats["by_type"] = type_stats

    # 樣本（前 10 筆）
    stats["samples"] = [
        {k: v for k, v in l.items() if v is not None}
        for l in listings[:10]
    ]

    return stats


if __name__ == "__main__":
    crawl_591()
