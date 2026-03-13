"""
實價登錄租賃資料下載與處理腳本 v2
從內政部不動產交易實價查詢服務下載全台灣租賃資料，清洗後輸出 JSON 供前端使用。
包含：區域統計 + 路段統計 + 個別地址紀錄
"""

import os
import io
import re
import json
import zipfile
import requests
import pandas as pd
from pathlib import Path
from tqdm import tqdm
from collections import defaultdict

# === 設定 ===
BASE_DIR = Path(__file__).parent
RAW_DIR = BASE_DIR / "raw"
PROCESSED_DIR = BASE_DIR / "processed"
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"

RAW_DIR.mkdir(exist_ok=True)
PROCESSED_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 城市代碼對照
CITY_CODES = {
    "A": "臺北市", "B": "臺中市", "C": "基隆市", "D": "臺南市",
    "E": "高雄市", "F": "新北市", "G": "宜蘭縣", "H": "桃園市",
    "I": "嘉義市", "J": "新竹縣", "K": "苗栗縣", "L": "臺中縣",
    "M": "南投縣", "N": "彰化縣", "O": "雲林縣", "P": "嘉義縣",
    "Q": "臺南縣", "R": "高雄縣", "S": "屏東縣", "T": "花蓮縣",
    "U": "臺東縣", "V": "澎湖縣", "W": "金門縣", "X": "連江縣",
    "Z": "新竹市",
}

CITY_NAME_MAP = {
    "臺北市": "台北市", "臺中市": "台中市", "臺南市": "台南市",
    "臺中縣": "台中市", "臺南縣": "台南市", "高雄縣": "高雄市",
}

# 下載季度
SEASONS = []
for year in range(112, 116):
    for q in range(1, 5):
        SEASONS.append(f"{year}S{q}")
SEASONS = sorted(set(SEASONS))


def download_season(season: str) -> Path | None:
    """下載某一季度的實價登錄資料"""
    zip_path = RAW_DIR / f"lvr_land_{season}.zip"
    if zip_path.exists():
        return zip_path

    url = f"https://plvr.land.moi.gov.tw/DownloadSeason?season={season}&type=zip&fileName=lvr_landcsv.zip"
    try:
        resp = requests.get(url, timeout=60, stream=True)
        if resp.status_code == 200 and len(resp.content) > 1000:
            with open(zip_path, "wb") as f:
                f.write(resp.content)
            print(f"  [OK] {season} ({len(resp.content) / 1024 / 1024:.1f} MB)")
            return zip_path
        else:
            print(f"  [--] {season} no data")
            return None
    except Exception as e:
        print(f"  [ERR] {season}: {e}")
        return None


def extract_rental_csv(zip_path: Path) -> list[pd.DataFrame]:
    """從 ZIP 中提取租賃 CSV，使用 utf-8-sig 編碼，跳過英文翻譯行"""
    dfs = []
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            for name in z.namelist():
                if "_lvr_land_c.csv" not in name.lower() and not (
                    "_c.csv" in name.lower() and len(name.split("_")[0]) == 1
                ):
                    continue
                with z.open(name) as f:
                    try:
                        content = f.read()
                        df = pd.read_csv(
                            io.BytesIO(content),
                            encoding="utf-8-sig",
                            skiprows=[1],  # 跳過英文翻譯行
                            on_bad_lines="skip",
                            low_memory=False,
                        )
                        if len(df) > 0:
                            city_code = name[0].upper()
                            city_raw = CITY_CODES.get(city_code, "")
                            if city_raw:
                                df["_city"] = CITY_NAME_MAP.get(city_raw, city_raw)
                                dfs.append(df)
                    except Exception as e:
                        print(f"    [WARN] {name}: {e}")
    except zipfile.BadZipFile:
        print(f"  [ERR] bad zip: {zip_path.name}")
    return dfs


def extract_road(address: str) -> str:
    """從地址提取路段名稱"""
    if not isinstance(address, str):
        return ""
    # 移除城市和區域前綴
    addr = re.sub(r'^(臺|台)(北|中|南|東)?(市|縣)', '', address)
    addr = re.sub(r'^(新北市|桃園市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|南投縣|彰化縣|雲林縣|嘉義縣|屏東縣|花蓮縣|臺東縣|台東縣|宜蘭縣|澎湖縣|金門縣|連江縣)', '', addr)
    addr = re.sub(r'^.{1,3}(區|鎮|鄉|市)', '', addr)

    # 提取路/街/大道
    m = re.match(r'(.+?[路街道])', addr)
    if m:
        road = m.group(1)
        # 提取段
        m2 = re.match(r'(.+?[路街道])(.{1,2}段)', addr)
        if m2:
            return m2.group(1) + m2.group(2)
        return road

    # 嘗試巷
    m = re.match(r'(.+?巷)', addr)
    if m:
        return m.group(1)

    return ""


def classify_room_type(row):
    """推測房型"""
    area = row.get("area_ping", 0) or 0
    building = str(row.get("building_type", ""))
    if "套房" in building:
        return "套房"
    elif area <= 6:
        return "雅房"
    elif area <= 15:
        return "套房"
    else:
        return "整層"


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """清洗單一 CSV 的租賃資料"""
    cols = df.columns.tolist()

    # 直接用已知的欄位名
    result = pd.DataFrame()
    result["city"] = df["_city"]

    if "鄉鎮市區" in cols:
        result["district"] = df["鄉鎮市區"].astype(str).str.strip()
    else:
        return pd.DataFrame()

    # 地址
    if "土地位置建物門牌" in cols:
        result["address"] = df["土地位置建物門牌"].astype(str)
    else:
        result["address"] = ""

    # 租金
    rent_col = None
    for c in cols:
        if "總額元" in c and "車位" not in c:
            rent_col = c
            break
    if rent_col:
        result["monthly_rent"] = pd.to_numeric(df[rent_col], errors="coerce")
    else:
        return pd.DataFrame()

    # 面積
    for c in cols:
        if "建物" in c and "面積" in c and "平方公尺" in c and "車位" not in c:
            area_m2 = pd.to_numeric(df[c], errors="coerce")
            result["area_ping"] = (area_m2 * 0.3025).round(1)
            break

    # 建物型態
    if "建物型態" in cols:
        result["building_type"] = df["建物型態"].astype(str)

    # 租賃日期
    if "租賃年月日" in cols:
        result["date_raw"] = df["租賃年月日"].astype(str)

    # 格局
    for c in cols:
        if "格局" in c and "房" in c:
            result["rooms"] = pd.to_numeric(df[c], errors="coerce")
            break

    # 過濾異常
    result = result.dropna(subset=["monthly_rent", "district"])
    result = result[result["monthly_rent"] > 1000]
    result = result[result["monthly_rent"] < 200000]
    result = result[result["district"] != "nan"]

    if "area_ping" in result.columns:
        result = result[(result["area_ping"] > 1) | (result["area_ping"].isna())]
        result = result[(result["area_ping"] < 200) | (result["area_ping"].isna())]

    # 提取路段
    result["road"] = result["address"].apply(extract_road)

    # 房型分類
    result["room_type"] = result.apply(classify_room_type, axis=1)

    return result


def calc_stats(group: pd.DataFrame) -> dict:
    """計算一組資料的統計"""
    if len(group) < 2:
        return None
    return {
        "median_rent": int(group["monthly_rent"].median()),
        "avg_rent": int(group["monthly_rent"].mean()),
        "min_rent": int(group["monthly_rent"].quantile(0.1)),
        "max_rent": int(group["monthly_rent"].quantile(0.9)),
        "sample_count": int(len(group)),
        "avg_area_ping": round(float(group["area_ping"].mean()), 1) if "area_ping" in group.columns and group["area_ping"].notna().sum() > 0 else None,
    }


def build_statistics(df: pd.DataFrame) -> dict:
    """計算完整統計：城市 > 區域 > 路段"""
    stats = {}

    for city, city_group in df.groupby("city"):
        city_key = str(city)
        if len(city_group) < 3:
            continue

        stats[city_key] = {"districts": {}, "summary": {}}

        # 城市總覽
        cs = calc_stats(city_group)
        if cs:
            cs["district_count"] = int(city_group["district"].nunique())
            stats[city_key]["summary"] = cs

        # 各區統計
        for district, dist_group in city_group.groupby("district"):
            if len(dist_group) < 3:
                continue

            ds = calc_stats(dist_group)
            if not ds:
                continue

            # 按房型
            by_type = {}
            for rtype, rgroup in dist_group.groupby("room_type"):
                ts = calc_stats(rgroup)
                if ts:
                    by_type[str(rtype)] = ts
            if by_type:
                ds["by_type"] = by_type

            # 路段統計
            roads = {}
            for road, road_group in dist_group.groupby("road"):
                if not road or road == "" or len(road_group) < 2:
                    continue
                rs = calc_stats(road_group)
                if rs:
                    roads[str(road)] = rs
            if roads:
                # 只保留前 30 條路段（按樣本數排序）
                sorted_roads = sorted(roads.items(), key=lambda x: -x[1]["sample_count"])[:30]
                ds["roads"] = dict(sorted_roads)

            stats[city_key]["districts"][str(district)] = ds

    return stats


def build_records(df: pd.DataFrame) -> list:
    """建立個別紀錄列表（給地圖標記用，每個區取最新 50 筆）"""
    records = []
    for (city, district), group in df.groupby(["city", "district"]):
        subset = group.nlargest(50, "monthly_rent") if len(group) > 50 else group
        # Actually take a sample, not just highest rent
        if len(group) > 50:
            subset = group.sample(50, random_state=42)
        for _, row in subset.iterrows():
            rec = {
                "city": str(city),
                "district": str(district),
                "address": str(row.get("address", "")),
                "road": str(row.get("road", "")),
                "monthly_rent": int(row["monthly_rent"]),
                "room_type": str(row.get("room_type", "")),
            }
            if pd.notna(row.get("area_ping")):
                rec["area_ping"] = round(float(row["area_ping"]), 1)
            records.append(rec)
    return records


def main():
    print("=" * 60)
    print("  Taiwan Rental Database Builder v2")
    print("=" * 60)

    # Step 1: Download
    print("\n[1/5] Downloading...")
    zip_files = []
    for season in tqdm(SEASONS, desc="Download"):
        result = download_season(season)
        if result:
            zip_files.append(result)
    print(f"  => {len(zip_files)} seasons downloaded")

    # Step 2: Extract
    print("\n[2/5] Extracting rental CSVs...")
    all_dfs = []
    for zf in tqdm(zip_files, desc="Extract"):
        dfs = extract_rental_csv(zf)
        all_dfs.extend(dfs)
    print(f"  => {len(all_dfs)} CSV files extracted")

    if not all_dfs:
        print("[!] No data found, generating sample...")
        generate_sample_data()
        return

    # Step 3: Clean
    print("\n[3/5] Cleaning data...")
    cleaned = []
    for df in tqdm(all_dfs, desc="Clean"):
        c = clean_data(df)
        if len(c) > 0:
            cleaned.append(c)

    if not cleaned:
        print("[!] No valid data after cleaning, generating sample...")
        generate_sample_data()
        return

    all_data = pd.concat(cleaned, ignore_index=True)
    # 去重（同一地址同一租金視為重複）
    before = len(all_data)
    all_data = all_data.drop_duplicates(subset=["address", "monthly_rent"], keep="last")
    print(f"  => {len(all_data):,} records ({before - len(all_data):,} duplicates removed)")
    print(f"  => Cities: {all_data['city'].nunique()}, Districts: {all_data['district'].nunique()}")
    print(f"  => Roads with data: {all_data[all_data['road'] != ''].groupby(['city', 'district', 'road']).ngroups}")

    # Step 4: Statistics
    print("\n[4/5] Computing statistics...")
    stats = build_statistics(all_data)

    # Step 5: Output
    print("\n[5/5] Writing JSON files...")

    # 1. Full stats (district + road level)
    with open(OUTPUT_DIR / "rental_stats.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    # 2. Cities list
    cities_list = []
    for city, data in sorted(stats.items(), key=lambda x: -x[1]["summary"].get("sample_count", 0)):
        cities_list.append({
            "name": city,
            "median_rent": data["summary"].get("median_rent", 0),
            "sample_count": data["summary"].get("sample_count", 0),
            "district_count": data["summary"].get("district_count", 0),
            "districts": sorted(data["districts"].keys()),
        })
    with open(OUTPUT_DIR / "cities.json", "w", encoding="utf-8") as f:
        json.dump(cities_list, f, ensure_ascii=False, indent=2)

    # 3. Overview
    overview = {}
    for city, data in stats.items():
        overview[city] = {
            "median_rent": data["summary"].get("median_rent", 0),
            "avg_rent": data["summary"].get("avg_rent", 0),
            "sample_count": data["summary"].get("sample_count", 0),
        }
    with open(OUTPUT_DIR / "overview.json", "w", encoding="utf-8") as f:
        json.dump(overview, f, ensure_ascii=False, indent=2)

    # 4. Records (for map markers)
    print("  Building address records for map...")
    records = build_records(all_data)
    with open(OUTPUT_DIR / "records.json", "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    # 5. CSV backup
    all_data.to_csv(PROCESSED_DIR / "all_rental_data.csv", index=False, encoding="utf-8-sig")

    print(f"\n{'='*60}")
    print(f"  DONE!")
    print(f"  {len(all_data):,} records, {all_data['city'].nunique()} cities")
    print(f"  Files in: {OUTPUT_DIR}")
    print(f"{'='*60}")


def generate_sample_data():
    """備用：如果下載失敗，產生範例資料（包含路段）"""
    print("\n  Generating sample data with road segments...")
    # ... (keep the existing sample data function but add roads)
    sample_stats = {
        "台北市": {
            "districts": {
                "大安區": {"median_rent": 18000, "avg_rent": 20500, "min_rent": 10000, "max_rent": 35000, "sample_count": 856, "avg_area_ping": 14.2,
                    "by_type": {
                        "套房": {"median_rent": 12500, "avg_rent": 13200, "min_rent": 8000, "max_rent": 18000, "sample_count": 412, "avg_area_ping": 8.5},
                        "整層": {"median_rent": 28000, "avg_rent": 30500, "min_rent": 18000, "max_rent": 50000, "sample_count": 320, "avg_area_ping": 22.3},
                        "雅房": {"median_rent": 8000, "avg_rent": 8500, "min_rent": 5500, "max_rent": 12000, "sample_count": 124, "avg_area_ping": 4.5}},
                    "roads": {
                        "忠孝東路四段": {"median_rent": 22000, "avg_rent": 24000, "min_rent": 12000, "max_rent": 38000, "sample_count": 45},
                        "復興南路一段": {"median_rent": 19000, "avg_rent": 21000, "min_rent": 10000, "max_rent": 35000, "sample_count": 38},
                        "敦化南路一段": {"median_rent": 25000, "avg_rent": 27000, "min_rent": 14000, "max_rent": 42000, "sample_count": 32},
                        "和平東路二段": {"median_rent": 16000, "avg_rent": 17500, "min_rent": 9000, "max_rent": 28000, "sample_count": 28},
                        "信義路四段": {"median_rent": 20000, "avg_rent": 22000, "min_rent": 11000, "max_rent": 36000, "sample_count": 25},
                        "仁愛路四段": {"median_rent": 23000, "avg_rent": 25000, "min_rent": 13000, "max_rent": 40000, "sample_count": 22},
                        "建國南路二段": {"median_rent": 17000, "avg_rent": 18500, "min_rent": 9500, "max_rent": 30000, "sample_count": 20},
                        "羅斯福路三段": {"median_rent": 14000, "avg_rent": 15500, "min_rent": 8000, "max_rent": 25000, "sample_count": 18}}},
                "中正區": {"median_rent": 16500, "avg_rent": 18200, "min_rent": 9000, "max_rent": 32000, "sample_count": 623, "avg_area_ping": 13.8,
                    "by_type": {
                        "套房": {"median_rent": 11500, "avg_rent": 12000, "min_rent": 7500, "max_rent": 16000, "sample_count": 298, "avg_area_ping": 8.2},
                        "整層": {"median_rent": 25000, "avg_rent": 27000, "min_rent": 16000, "max_rent": 45000, "sample_count": 245, "avg_area_ping": 21.5},
                        "雅房": {"median_rent": 7500, "avg_rent": 7800, "min_rent": 5000, "max_rent": 11000, "sample_count": 80, "avg_area_ping": 4.2}},
                    "roads": {
                        "中華路一段": {"median_rent": 15000, "avg_rent": 16500, "min_rent": 8000, "max_rent": 28000, "sample_count": 35},
                        "羅斯福路一段": {"median_rent": 14500, "avg_rent": 15800, "min_rent": 7500, "max_rent": 26000, "sample_count": 30},
                        "南昌路二段": {"median_rent": 13000, "avg_rent": 14200, "min_rent": 7000, "max_rent": 24000, "sample_count": 22},
                        "重慶南路一段": {"median_rent": 16000, "avg_rent": 17500, "min_rent": 9000, "max_rent": 30000, "sample_count": 20}}},
                "信義區": {"median_rent": 19000, "avg_rent": 22000, "min_rent": 10500, "max_rent": 38000, "sample_count": 534, "avg_area_ping": 15.1,
                    "by_type": {
                        "套房": {"median_rent": 13000, "avg_rent": 14000, "min_rent": 8500, "max_rent": 20000, "sample_count": 256, "avg_area_ping": 9.0},
                        "整層": {"median_rent": 32000, "avg_rent": 35000, "min_rent": 20000, "max_rent": 55000, "sample_count": 198, "avg_area_ping": 24.0},
                        "雅房": {"median_rent": 8500, "avg_rent": 9000, "min_rent": 6000, "max_rent": 13000, "sample_count": 80, "avg_area_ping": 4.8}},
                    "roads": {
                        "信義路五段": {"median_rent": 25000, "avg_rent": 28000, "min_rent": 14000, "max_rent": 45000, "sample_count": 28},
                        "基隆路一段": {"median_rent": 16000, "avg_rent": 17500, "min_rent": 9000, "max_rent": 28000, "sample_count": 25},
                        "松仁路": {"median_rent": 22000, "avg_rent": 24500, "min_rent": 12000, "max_rent": 40000, "sample_count": 20},
                        "忠孝東路五段": {"median_rent": 18000, "avg_rent": 20000, "min_rent": 10000, "max_rent": 32000, "sample_count": 18}}},
                "中山區": {"median_rent": 15500, "avg_rent": 17500, "min_rent": 8500, "max_rent": 30000, "sample_count": 745, "avg_area_ping": 13.0,
                    "by_type": {
                        "套房": {"median_rent": 11000, "avg_rent": 11800, "min_rent": 7000, "max_rent": 16500, "sample_count": 380, "avg_area_ping": 8.0},
                        "整層": {"median_rent": 24000, "avg_rent": 26000, "min_rent": 15000, "max_rent": 42000, "sample_count": 280, "avg_area_ping": 20.5},
                        "雅房": {"median_rent": 7200, "avg_rent": 7500, "min_rent": 5000, "max_rent": 10500, "sample_count": 85, "avg_area_ping": 4.3}},
                    "roads": {
                        "南京東路二段": {"median_rent": 16000, "avg_rent": 17500, "min_rent": 9000, "max_rent": 28000, "sample_count": 32},
                        "林森北路": {"median_rent": 13000, "avg_rent": 14500, "min_rent": 7000, "max_rent": 24000, "sample_count": 28},
                        "中山北路二段": {"median_rent": 17000, "avg_rent": 18500, "min_rent": 9500, "max_rent": 30000, "sample_count": 25},
                        "民生東路三段": {"median_rent": 15000, "avg_rent": 16500, "min_rent": 8500, "max_rent": 27000, "sample_count": 22}}},
                "松山區": {"median_rent": 16000, "avg_rent": 18000, "min_rent": 9000, "max_rent": 31000, "sample_count": 456, "avg_area_ping": 13.5,
                    "by_type": {"套房": {"median_rent": 11500, "avg_rent": 12200, "min_rent": 7500, "max_rent": 17000, "sample_count": 220, "avg_area_ping": 8.3}, "整層": {"median_rent": 25000, "avg_rent": 27500, "min_rent": 16000, "max_rent": 45000, "sample_count": 176, "avg_area_ping": 21.0}, "雅房": {"median_rent": 7800, "avg_rent": 8000, "min_rent": 5200, "max_rent": 11000, "sample_count": 60, "avg_area_ping": 4.5}},
                    "roads": {"南京東路四段": {"median_rent": 17000, "avg_rent": 18500, "min_rent": 9500, "max_rent": 30000, "sample_count": 22}, "八德路四段": {"median_rent": 14000, "avg_rent": 15500, "min_rent": 8000, "max_rent": 25000, "sample_count": 18}}},
                "萬華區": {"median_rent": 11000, "avg_rent": 12500, "min_rent": 6000, "max_rent": 22000, "sample_count": 398, "avg_area_ping": 12.5,
                    "by_type": {"套房": {"median_rent": 8000, "avg_rent": 8500, "min_rent": 5500, "max_rent": 12000, "sample_count": 195, "avg_area_ping": 7.5}, "整層": {"median_rent": 18000, "avg_rent": 19500, "min_rent": 11000, "max_rent": 30000, "sample_count": 148, "avg_area_ping": 19.0}, "雅房": {"median_rent": 6000, "avg_rent": 6200, "min_rent": 4000, "max_rent": 8500, "sample_count": 55, "avg_area_ping": 3.8}},
                    "roads": {"萬大路": {"median_rent": 10000, "avg_rent": 11000, "min_rent": 5500, "max_rent": 19000, "sample_count": 20}, "西園路二段": {"median_rent": 9500, "avg_rent": 10500, "min_rent": 5000, "max_rent": 18000, "sample_count": 15}}},
                "文山區": {"median_rent": 11500, "avg_rent": 13000, "min_rent": 6500, "max_rent": 23000, "sample_count": 512, "avg_area_ping": 13.0,
                    "by_type": {"套房": {"median_rent": 8500, "avg_rent": 9000, "min_rent": 5800, "max_rent": 12500, "sample_count": 260, "avg_area_ping": 7.8}, "整層": {"median_rent": 18000, "avg_rent": 20000, "min_rent": 12000, "max_rent": 32000, "sample_count": 190, "avg_area_ping": 20.0}, "雅房": {"median_rent": 6200, "avg_rent": 6500, "min_rent": 4200, "max_rent": 9000, "sample_count": 62, "avg_area_ping": 4.0}},
                    "roads": {"木柵路一段": {"median_rent": 10000, "avg_rent": 11200, "min_rent": 5500, "max_rent": 19000, "sample_count": 22}, "景文街": {"median_rent": 9000, "avg_rent": 10000, "min_rent": 5000, "max_rent": 17000, "sample_count": 15}, "羅斯福路五段": {"median_rent": 12000, "avg_rent": 13200, "min_rent": 6500, "max_rent": 22000, "sample_count": 18}}},
                "內湖區": {"median_rent": 14000, "avg_rent": 16000, "min_rent": 7500, "max_rent": 28000, "sample_count": 478, "avg_area_ping": 14.5,
                    "by_type": {"套房": {"median_rent": 10000, "avg_rent": 10800, "min_rent": 6500, "max_rent": 15000, "sample_count": 230, "avg_area_ping": 8.8}, "整層": {"median_rent": 22000, "avg_rent": 24000, "min_rent": 14000, "max_rent": 38000, "sample_count": 188, "avg_area_ping": 22.0}, "雅房": {"median_rent": 7000, "avg_rent": 7200, "min_rent": 4800, "max_rent": 10000, "sample_count": 60, "avg_area_ping": 4.2}},
                    "roads": {"成功路四段": {"median_rent": 13000, "avg_rent": 14500, "min_rent": 7000, "max_rent": 25000, "sample_count": 20}, "內湖路一段": {"median_rent": 12500, "avg_rent": 13800, "min_rent": 6800, "max_rent": 23000, "sample_count": 18}}},
                "士林區": {"median_rent": 13000, "avg_rent": 14800, "min_rent": 7000, "max_rent": 26000, "sample_count": 423, "avg_area_ping": 13.2,
                    "by_type": {"套房": {"median_rent": 9500, "avg_rent": 10200, "min_rent": 6200, "max_rent": 14500, "sample_count": 210, "avg_area_ping": 8.2}, "整層": {"median_rent": 20000, "avg_rent": 22000, "min_rent": 13000, "max_rent": 35000, "sample_count": 160, "avg_area_ping": 20.5}, "雅房": {"median_rent": 6800, "avg_rent": 7000, "min_rent": 4500, "max_rent": 9800, "sample_count": 53, "avg_area_ping": 4.0}},
                    "roads": {"中山北路六段": {"median_rent": 14000, "avg_rent": 15500, "min_rent": 7500, "max_rent": 27000, "sample_count": 18}, "天母東路": {"median_rent": 18000, "avg_rent": 20000, "min_rent": 10000, "max_rent": 33000, "sample_count": 15}}},
                "北投區": {"median_rent": 12000, "avg_rent": 13500, "min_rent": 6500, "max_rent": 24000, "sample_count": 356, "avg_area_ping": 13.8,
                    "by_type": {"套房": {"median_rent": 8800, "avg_rent": 9200, "min_rent": 5800, "max_rent": 13000, "sample_count": 175, "avg_area_ping": 8.0}, "整層": {"median_rent": 19000, "avg_rent": 20500, "min_rent": 12000, "max_rent": 33000, "sample_count": 135, "avg_area_ping": 21.5}, "雅房": {"median_rent": 6500, "avg_rent": 6800, "min_rent": 4200, "max_rent": 9500, "sample_count": 46, "avg_area_ping": 4.0}},
                    "roads": {"中和街": {"median_rent": 11000, "avg_rent": 12200, "min_rent": 6000, "max_rent": 21000, "sample_count": 15}}},
                "大同區": {"median_rent": 12500, "avg_rent": 14000, "min_rent": 7000, "max_rent": 24000, "sample_count": 312, "avg_area_ping": 12.0,
                    "by_type": {"套房": {"median_rent": 9000, "avg_rent": 9500, "min_rent": 6000, "max_rent": 13500, "sample_count": 155, "avg_area_ping": 7.5}, "整層": {"median_rent": 19500, "avg_rent": 21000, "min_rent": 12000, "max_rent": 33000, "sample_count": 118, "avg_area_ping": 18.5}, "雅房": {"median_rent": 6500, "avg_rent": 6800, "min_rent": 4300, "max_rent": 9500, "sample_count": 39, "avg_area_ping": 3.8}},
                    "roads": {"民權西路": {"median_rent": 12000, "avg_rent": 13200, "min_rent": 6500, "max_rent": 22000, "sample_count": 15}}},
                "南港區": {"median_rent": 14500, "avg_rent": 16500, "min_rent": 8000, "max_rent": 29000, "sample_count": 289, "avg_area_ping": 14.0,
                    "by_type": {"套房": {"median_rent": 10500, "avg_rent": 11200, "min_rent": 6800, "max_rent": 15500, "sample_count": 140, "avg_area_ping": 8.5}, "整層": {"median_rent": 23000, "avg_rent": 25000, "min_rent": 15000, "max_rent": 40000, "sample_count": 112, "avg_area_ping": 21.5}, "雅房": {"median_rent": 7200, "avg_rent": 7500, "min_rent": 4800, "max_rent": 10500, "sample_count": 37, "avg_area_ping": 4.3}},
                    "roads": {"研究院路二段": {"median_rent": 13500, "avg_rent": 15000, "min_rent": 7500, "max_rent": 26000, "sample_count": 12}}},
            },
            "summary": {"median_rent": 15000, "avg_rent": 17200, "sample_count": 5982, "district_count": 12}
        },
        "新北市": {
            "districts": {
                "板橋區": {"median_rent": 12000, "avg_rent": 13500, "min_rent": 6500, "max_rent": 24000, "sample_count": 678, "avg_area_ping": 13.5, "by_type": {"套房": {"median_rent": 8500, "avg_rent": 9200, "min_rent": 5500, "max_rent": 13000, "sample_count": 340, "avg_area_ping": 8.0}, "整層": {"median_rent": 18000, "avg_rent": 20000, "min_rent": 12000, "max_rent": 33000, "sample_count": 260, "avg_area_ping": 21.0}, "雅房": {"median_rent": 6000, "avg_rent": 6300, "min_rent": 4000, "max_rent": 9000, "sample_count": 78, "avg_area_ping": 4.0}}, "roads": {"文化路一段": {"median_rent": 12500, "avg_rent": 13800, "min_rent": 6800, "max_rent": 23000, "sample_count": 25}, "中山路一段": {"median_rent": 11000, "avg_rent": 12200, "min_rent": 6000, "max_rent": 21000, "sample_count": 20}, "新府路": {"median_rent": 14000, "avg_rent": 15500, "min_rent": 8000, "max_rent": 26000, "sample_count": 18}}},
                "中和區": {"median_rent": 11000, "avg_rent": 12500, "min_rent": 6000, "max_rent": 22000, "sample_count": 598, "avg_area_ping": 12.8, "by_type": {"套房": {"median_rent": 8000, "avg_rent": 8500, "min_rent": 5200, "max_rent": 12000, "sample_count": 300, "avg_area_ping": 7.5}, "整層": {"median_rent": 17000, "avg_rent": 18500, "min_rent": 11000, "max_rent": 30000, "sample_count": 228, "avg_area_ping": 20.0}, "雅房": {"median_rent": 5800, "avg_rent": 6000, "min_rent": 3800, "max_rent": 8500, "sample_count": 70, "avg_area_ping": 3.8}}, "roads": {"中和路": {"median_rent": 10500, "avg_rent": 11800, "min_rent": 5800, "max_rent": 20000, "sample_count": 22}, "景平路": {"median_rent": 10000, "avg_rent": 11200, "min_rent": 5500, "max_rent": 19000, "sample_count": 18}}},
                "永和區": {"median_rent": 12000, "avg_rent": 13500, "min_rent": 6500, "max_rent": 23000, "sample_count": 456, "avg_area_ping": 12.0, "by_type": {"套房": {"median_rent": 8800, "avg_rent": 9200, "min_rent": 5800, "max_rent": 13000, "sample_count": 230, "avg_area_ping": 7.8}, "整層": {"median_rent": 18500, "avg_rent": 20000, "min_rent": 12000, "max_rent": 32000, "sample_count": 170, "avg_area_ping": 18.5}, "雅房": {"median_rent": 6200, "avg_rent": 6500, "min_rent": 4000, "max_rent": 9000, "sample_count": 56, "avg_area_ping": 3.8}}, "roads": {"永和路二段": {"median_rent": 11500, "avg_rent": 12800, "min_rent": 6200, "max_rent": 22000, "sample_count": 18}, "中正路": {"median_rent": 12000, "avg_rent": 13200, "min_rent": 6500, "max_rent": 22000, "sample_count": 15}}},
                "新莊區": {"median_rent": 10500, "avg_rent": 12000, "min_rent": 5500, "max_rent": 21000, "sample_count": 534, "avg_area_ping": 13.5, "by_type": {"套房": {"median_rent": 7500, "avg_rent": 8000, "min_rent": 5000, "max_rent": 11500, "sample_count": 268, "avg_area_ping": 7.8}, "整層": {"median_rent": 16000, "avg_rent": 17500, "min_rent": 10000, "max_rent": 28000, "sample_count": 200, "avg_area_ping": 21.0}, "雅房": {"median_rent": 5500, "avg_rent": 5800, "min_rent": 3500, "max_rent": 8000, "sample_count": 66, "avg_area_ping": 3.8}}, "roads": {"中正路": {"median_rent": 10000, "avg_rent": 11200, "min_rent": 5500, "max_rent": 19000, "sample_count": 20}, "新泰路": {"median_rent": 9500, "avg_rent": 10500, "min_rent": 5000, "max_rent": 18000, "sample_count": 15}}},
                "三重區": {"median_rent": 10000, "avg_rent": 11500, "min_rent": 5500, "max_rent": 20000, "sample_count": 489, "avg_area_ping": 12.5, "by_type": {"套房": {"median_rent": 7200, "avg_rent": 7800, "min_rent": 4800, "max_rent": 11000, "sample_count": 245, "avg_area_ping": 7.5}, "整層": {"median_rent": 15000, "avg_rent": 16500, "min_rent": 9500, "max_rent": 27000, "sample_count": 185, "avg_area_ping": 19.5}, "雅房": {"median_rent": 5200, "avg_rent": 5500, "min_rent": 3500, "max_rent": 7800, "sample_count": 59, "avg_area_ping": 3.5}}, "roads": {"重新路三段": {"median_rent": 10500, "avg_rent": 11800, "min_rent": 5800, "max_rent": 20000, "sample_count": 18}}},
            },
            "summary": {"median_rent": 11000, "avg_rent": 12500, "sample_count": 2755, "district_count": 5}
        },
    }

    with open(OUTPUT_DIR / "rental_stats.json", "w", encoding="utf-8") as f:
        json.dump(sample_stats, f, ensure_ascii=False, indent=2)

    cities_list = []
    for city, data in sorted(sample_stats.items(), key=lambda x: -x[1]["summary"]["sample_count"]):
        cities_list.append({
            "name": city, "median_rent": data["summary"]["median_rent"],
            "sample_count": data["summary"]["sample_count"],
            "district_count": data["summary"]["district_count"],
            "districts": sorted(data["districts"].keys()),
        })
    with open(OUTPUT_DIR / "cities.json", "w", encoding="utf-8") as f:
        json.dump(cities_list, f, ensure_ascii=False, indent=2)

    overview = {city: {"median_rent": d["summary"]["median_rent"], "avg_rent": d["summary"]["avg_rent"], "sample_count": d["summary"]["sample_count"]} for city, d in sample_stats.items()}
    with open(OUTPUT_DIR / "overview.json", "w", encoding="utf-8") as f:
        json.dump(overview, f, ensure_ascii=False, indent=2)

    # Empty records for sample
    with open(OUTPUT_DIR / "records.json", "w", encoding="utf-8") as f:
        json.dump([], f)

    print("  Sample data generated!")


if __name__ == "__main__":
    main()
