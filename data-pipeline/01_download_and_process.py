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

# 下載季度（動態計算：從 112 年到當前民國年+1，自動涵蓋最新季度）
import time as _time
from datetime import datetime as _datetime

def _build_seasons() -> list[str]:
    """動態產生季度列表，自動包含最新可能有資料的季度。"""
    now = _datetime.now()
    # 民國年 = 西元年 - 1911
    current_roc_year = now.year - 1911
    seasons = []
    for year in range(112, current_roc_year + 2):
        for q in range(1, 5):
            seasons.append(f"{year}S{q}")
    return sorted(set(seasons))

SEASONS = _build_seasons()


def download_season(season: str, max_retries: int = 3) -> Path | None:
    """下載某一季度的實價登錄資料（含 retry 邏輯）"""
    zip_path = RAW_DIR / f"lvr_land_{season}.zip"
    if zip_path.exists():
        return zip_path

    url = f"https://plvr.land.moi.gov.tw/DownloadSeason?season={season}&type=zip&fileName=lvr_landcsv.zip"
    for attempt in range(1, max_retries + 1):
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
            if attempt < max_retries:
                wait = attempt * 5
                print(f"  [RETRY] {season} attempt {attempt}/{max_retries}: {e}, waiting {wait}s...")
                _time.sleep(wait)
            else:
                print(f"  [ERR] {season}: {e} (gave up after {max_retries} attempts)")
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


def parse_chinese_floor(value) -> int | None:
    """Parse Chinese floor text into an integer floor number.

    Args:
        value: Raw floor value from column 9, e.g. "三層", "十二層",
               "地下一層", "二", or a plain numeric string.

    Returns:
        Integer floor number (negative for basement), or None when the
        value cannot be parsed.

    Examples:
        >>> parse_chinese_floor("三層")
        3
        >>> parse_chinese_floor("十二層")
        12
        >>> parse_chinese_floor("地下一層")
        -1
        >>> parse_chinese_floor("二十三層")
        23
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text or text in ("nan", ""):
        return None

    # Already a plain integer string
    try:
        return int(text)
    except ValueError:
        pass

    # Detect basement floors ("地下N層" → negative)
    basement = "地下" in text
    # Strip common suffixes so the number-parsing logic works uniformly
    text = text.replace("地下", "").replace("層", "").replace("樓", "").strip()

    # Chinese digit mapping (traditional numerals)
    chinese_digits: dict[str, int] = {
        "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
        "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
    }

    # Try plain numeric again after stripping Chinese characters
    try:
        result = int(text)
        return -result if basement else result
    except ValueError:
        pass

    # Parse Chinese numeral with 十 (tens) logic:
    # "十" alone → 10, "十二" → 12, "二十三" → 23
    if not text:
        return None

    floor_val = 0
    if "十" in text:
        parts = text.split("十")
        tens_part = parts[0]
        units_part = parts[1] if len(parts) > 1 else ""
        tens = chinese_digits.get(tens_part, 1) if tens_part else 1
        units = chinese_digits.get(units_part, 0) if units_part else 0
        floor_val = tens * 10 + units
    elif len(text) == 1:
        floor_val = chinese_digits.get(text, 0)
    else:
        # Multi-character without 十, try character-by-character (e.g. "二三" is unusual but safe)
        accumulated = 0
        for ch in text:
            if ch in chinese_digits:
                accumulated = accumulated * 10 + chinese_digits[ch]
        floor_val = accumulated if accumulated else 0

    if floor_val == 0:
        return None
    return -floor_val if basement else floor_val


def calc_building_age(raw_date) -> int | None:
    """Calculate building age in years from a ROC-format construction date.

    Args:
        raw_date: Construction date string in ROC format, e.g. "0860613"
                  (ROC year 86, month 06, day 13 → 1997).  Values that are
                  empty, zero-padded zeros, or non-numeric return None.

    Returns:
        Building age in years relative to 2026, or None when the date is
        unavailable or invalid.

    Examples:
        >>> calc_building_age("0860613")
        29
        >>> calc_building_age("1100101")
        16
        >>> calc_building_age("")  # returns None
    """
    if raw_date is None:
        return None
    text = str(raw_date).strip()
    if not text or text in ("nan", "0", "00000000"):
        return None
    # Remove any non-digit characters (e.g. slashes)
    digits = re.sub(r"\D", "", text)
    if len(digits) < 3:
        return None
    try:
        # First 3 digits are the ROC year; ROC year + 1911 = Gregorian year
        roc_year = int(digits[:3]) if len(digits) >= 7 else int(digits[:2])
        if roc_year <= 0:
            return None
        gregorian_year = roc_year + 1911
        age = 2026 - gregorian_year
        # Guard against future dates or unrealistically old buildings
        if age < 0 or age > 120:
            return None
        return age
    except (ValueError, IndexError):
        return None


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
    """清洗單一 CSV 的租賃資料。

    Uses column indices instead of column names to avoid encoding issues with
    garbled Chinese column headers.  The expected column layout (35 columns)
    is documented in the module-level comment.

    Args:
        df: Raw DataFrame from a rental _c.csv file with the _city column
            already attached by extract_rental_csv().

    Returns:
        Cleaned DataFrame with all extracted fields, or an empty DataFrame
        when the source data is unusable.
    """
    n_cols = len(df.columns)

    # Minimum required columns: at least up to col 22 (monthly rent)
    if n_cols < 23:
        return pd.DataFrame()

    # The _city column was appended by extract_rental_csv(), so the
    # *original* column count is n_cols - 1.  CSV files from 112S1-112S3
    # have 29 original columns; 112S4+ have 35.  The extended fields
    # (rental_type, has_manager, has_elevator, equipment) live in cols 29-34
    # and must ONLY be read when the file actually has 35 original columns.
    n_original = n_cols - 1  # subtract the injected _city column
    has_extended_cols = n_original >= 35

    result = pd.DataFrame()

    # --- City (injected by extract_rental_csv) ---
    result["city"] = df["_city"]

    # --- Col 0: 鄉鎮市區 (district) ---
    result["district"] = df.iloc[:, 0].astype(str).str.strip()

    # --- Col 2: 土地位置建物門牌 (address) ---
    result["address"] = df.iloc[:, 2].astype(str)

    # --- Col 22: 總額元 (monthly rent) ---
    result["monthly_rent"] = pd.to_numeric(df.iloc[:, 22], errors="coerce")

    # Guard: if all rents are NaN the file is likely malformed
    if result["monthly_rent"].isna().all():
        return pd.DataFrame()

    # --- Col 15: 建物移轉總面積平方公尺 (building area → convert to 坪) ---
    if n_cols > 15:
        area_m2 = pd.to_numeric(df.iloc[:, 15], errors="coerce")
        result["area_ping"] = (area_m2 * 0.3025).round(1)

    # --- Col 11: 建物型態 (building type) ---
    if n_cols > 11:
        result["building_type"] = df.iloc[:, 11].astype(str)

    # --- Col 7: 租賃年月日 (transaction date, ROC format) ---
    if n_cols > 7:
        result["date_raw"] = df.iloc[:, 7].astype(str)

    # --- Col 16: 格局-房 (number of rooms) ---
    if n_cols > 16:
        result["rooms"] = pd.to_numeric(df.iloc[:, 16], errors="coerce")

    # ------------------------------------------------------------------ #
    # NEW FIELDS
    # ------------------------------------------------------------------ #

    # --- Col 29: 出租型態 (rental type) ---
    # Only available in 35-column files (112S4+)
    if has_extended_cols:
        result["rental_type"] = df.iloc[:, 29].astype(str).str.strip()
        result["rental_type"] = result["rental_type"].replace("nan", "")
    else:
        result["rental_type"] = ""

    # --- Col 9: 租賃層次 (floor number, Chinese text) ---
    if n_cols > 9:
        result["floor"] = df.iloc[:, 9].apply(parse_chinese_floor)
    else:
        result["floor"] = None

    # --- Col 10: 總樓層數 (total floors, may be numeric or Chinese) ---
    if n_cols > 10:
        result["total_floors"] = pd.to_numeric(df.iloc[:, 10], errors="coerce")
    else:
        result["total_floors"] = None

    # --- Col 14: 建築完成年月 (construction date → building age) ---
    if n_cols > 14:
        result["building_age"] = df.iloc[:, 14].apply(calc_building_age)
    else:
        result["building_age"] = None

    # --- Col 30: 有無管理員 (has residential manager) ---
    # Only available in 35-column files (112S4+)
    if has_extended_cols:
        result["has_manager"] = df.iloc[:, 30].astype(str).str.strip().map(
            {"有": True, "無": False}
        )
    else:
        result["has_manager"] = None

    # --- Col 32: 有無電梯 (has elevator) ---
    # Only available in 35-column files (112S4+)
    if has_extended_cols:
        result["has_elevator"] = df.iloc[:, 32].astype(str).str.strip().map(
            {"有": True, "無": False}
        )
    else:
        result["has_elevator"] = None

    # --- Col 21: 有無附傢俱 (has furniture) ---
    if n_cols > 21:
        result["has_furniture"] = df.iloc[:, 21].astype(str).str.strip().map(
            {"有": True, "無": False}
        )
    else:
        result["has_furniture"] = None

    # --- Col 12: 主要用途 (main use) ---
    if n_cols > 12:
        result["main_use"] = df.iloc[:, 12].astype(str).str.strip()
        result["main_use"] = result["main_use"].replace("nan", "")
    else:
        result["main_use"] = ""

    # --- Col 33: 附屬設備 (equipment list, comma-separated string) ---
    # Only available in 35-column files (112S4+)
    if has_extended_cols:
        result["equipment"] = df.iloc[:, 33].astype(str).str.strip()
        result["equipment"] = result["equipment"].replace("nan", "")
    else:
        result["equipment"] = ""

    # --- Col 34: 租賃住宅服務 (rental housing service type) ---
    # Identifies social housing: "社會住宅包租轉租", "社會住宅代管"
    # vs general: "一般轉租", "一般代管", "一般包租"
    # Only available in 35-column files (112S4+)
    if has_extended_cols:
        result["housing_service"] = df.iloc[:, 34].astype(str).str.strip()
        result["housing_service"] = result["housing_service"].replace("nan", "")
    else:
        result["housing_service"] = ""

    # --- Col 27: 備註 (notes, may contain social housing program details) ---
    if n_cols > 27:
        result["note"] = df.iloc[:, 27].astype(str).str.strip()
        result["note"] = result["note"].replace("nan", "")
    else:
        result["note"] = ""

    # ------------------------------------------------------------------ #
    # FILTERS
    # ------------------------------------------------------------------ #
    result = result.dropna(subset=["monthly_rent", "district"])
    result = result[result["monthly_rent"] > 1000]
    result = result[result["monthly_rent"] < 200000]
    result = result[result["district"] != "nan"]

    if "area_ping" in result.columns:
        result = result[(result["area_ping"] > 1) | (result["area_ping"].isna())]
        result = result[(result["area_ping"] < 200) | (result["area_ping"].isna())]

    # ------------------------------------------------------------------ #
    # DERIVED FIELDS
    # ------------------------------------------------------------------ #

    # 提取路段
    result["road"] = result["address"].apply(extract_road)

    # 房型分類
    result["room_type"] = result.apply(classify_room_type, axis=1)

    return result


def calc_stats(group: pd.DataFrame) -> dict:
    """計算一組資料的統計。

    Computes core rent statistics plus new building and amenity metrics
    introduced in v2 of the schema.

    Args:
        group: Sub-DataFrame for a city / district / road grouping.

    Returns:
        Dictionary of statistics, or None when the group has fewer than
        two records (insufficient for meaningful aggregates).
    """
    if len(group) < 2:
        return None

    stats: dict = {
        "median_rent": int(group["monthly_rent"].median()),
        "avg_rent": int(group["monthly_rent"].mean()),
        "min_rent": int(group["monthly_rent"].quantile(0.1)),
        "max_rent": int(group["monthly_rent"].quantile(0.9)),
        "sample_count": int(len(group)),
        "avg_area_ping": (
            round(float(group["area_ping"].mean()), 1)
            if "area_ping" in group.columns and group["area_ping"].notna().sum() > 0
            else None
        ),
    }

    # avg_building_age: mean age across rows that have a valid building age
    if "building_age" in group.columns:
        valid_ages = group["building_age"].dropna()
        if len(valid_ages) > 0:
            stats["avg_building_age"] = round(float(valid_ages.mean()), 1)

    # has_manager_ratio: fraction of rows where has_manager is True
    if "has_manager" in group.columns:
        manager_series = group["has_manager"].dropna()
        if len(manager_series) > 0:
            stats["has_manager_ratio"] = round(
                float(manager_series.sum()) / len(manager_series), 3
            )

    # has_elevator_ratio: fraction of rows where has_elevator is True
    if "has_elevator" in group.columns:
        elevator_series = group["has_elevator"].dropna()
        if len(elevator_series) > 0:
            stats["has_elevator_ratio"] = round(
                float(elevator_series.sum()) / len(elevator_series), 3
            )

    return stats


def _rental_type_breakdown(group: pd.DataFrame) -> dict[str, int]:
    """Count records by rental type (出租型態) for a district group.

    Args:
        group: District-level sub-DataFrame.

    Returns:
        Mapping of rental type label to record count, e.g.
        {"整層住家": 120, "獨立套房": 85, "分租套房": 42}.
        Empty rental type strings are omitted.
    """
    if "rental_type" not in group.columns:
        return {}
    counts: dict[str, int] = {}
    for rtype, cnt in group["rental_type"].value_counts().items():
        label = str(rtype).strip()
        if label and label not in ("nan", ""):
            counts[label] = int(cnt)
    return counts


def _floor_distribution(group: pd.DataFrame) -> dict[str, int]:
    """Bucket floor numbers into standard ranges for a district group.

    Ranges: 1-5F, 6-10F, 11-15F, 16F+. Basement (< 1) and unknown floors
    are excluded.

    Args:
        group: District-level sub-DataFrame.

    Returns:
        Mapping of bucket label to record count, e.g.
        {"1-5F": 200, "6-10F": 80, "11-15F": 30, "16F+": 10}.
        Buckets with zero count are omitted.
    """
    if "floor" not in group.columns:
        return {}
    buckets: dict[str, int] = {"1-5F": 0, "6-10F": 0, "11-15F": 0, "16F+": 0}
    for floor_val in group["floor"].dropna():
        f = int(floor_val)
        if f < 1:
            continue
        if f <= 5:
            buckets["1-5F"] += 1
        elif f <= 10:
            buckets["6-10F"] += 1
        elif f <= 15:
            buckets["11-15F"] += 1
        else:
            buckets["16F+"] += 1
    return {k: v for k, v in buckets.items() if v > 0}


def build_statistics(df: pd.DataFrame) -> dict:
    """計算完整統計：城市 > 區域 > 路段。

    Extends the v1 schema with per-district rental_type_breakdown and
    floor_distribution, and propagates the new calc_stats() fields
    (avg_building_age, has_manager_ratio, has_elevator_ratio) at every
    aggregation level.

    Args:
        df: Fully cleaned and concatenated rental DataFrame.

    Returns:
        Nested statistics dictionary keyed by city → districts / summary.
    """
    stats: dict = {}

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
            by_type: dict = {}
            for rtype, rgroup in dist_group.groupby("room_type"):
                ts = calc_stats(rgroup)
                if ts:
                    by_type[str(rtype)] = ts

            # 建物類型：電梯大樓 (住宅大樓 + 華廈 + 辦公商業大樓)
            if "building_type" in dist_group.columns:
                elevator_mask = dist_group["building_type"].str.contains(
                    "有電梯|大樓", na=False
                )
                if elevator_mask.sum() >= 2:
                    ts = calc_stats(dist_group[elevator_mask])
                    if ts:
                        by_type["電梯大樓"] = ts

            if by_type:
                ds["by_type"] = by_type

            # 出租型態統計 (detailed rental types from raw data)
            # 整棟(戶)出租, 獨立套房, 分租套房, 分租雅房, 分層出租
            if "rental_type" in dist_group.columns:
                by_rental_type: dict = {}
                for rtype, rgroup in dist_group.groupby("rental_type"):
                    label = str(rtype).strip()
                    if not label or label in ("nan", ""):
                        continue
                    if len(rgroup) < 2:
                        continue
                    rt_stats = calc_stats(rgroup)
                    if rt_stats:
                        # Add avg_rooms for rental type
                        if "rooms" in rgroup.columns and rgroup["rooms"].notna().sum() > 0:
                            rt_stats["avg_rooms"] = round(
                                float(rgroup["rooms"].mean()), 1
                            )
                        by_rental_type[label] = rt_stats
                if by_rental_type:
                    ds["by_rental_type"] = by_rental_type

            # 個別樓層統計 (for per-floor filter)
            if "floor" in dist_group.columns:
                by_floor: dict = {}
                for floor_num in range(1, 26):
                    mask = dist_group["floor"] == floor_num
                    floor_subset = dist_group[mask]
                    if len(floor_subset) >= 2:
                        fs = calc_stats(floor_subset)
                        if fs:
                            by_floor[str(floor_num)] = fs
                if by_floor:
                    ds["by_floor"] = by_floor

            # 租金範圍統計 (for rent range filter)
            by_rent: dict = {}
            rent_ranges = [
                ("0-5000", 0, 5000),
                ("5000-10000", 5000, 10000),
                ("10000-20000", 10000, 20000),
                ("20000-30000", 20000, 30000),
                ("30000-50000", 30000, 50000),
                ("50000+", 50000, 999999),
            ]
            for label, lo, hi in rent_ranges:
                mask = dist_group["monthly_rent"].between(lo, hi, inclusive="left") if hi < 999999 else (dist_group["monthly_rent"] >= lo)
                rent_subset = dist_group[mask]
                if len(rent_subset) >= 2:
                    rs = calc_stats(rent_subset)
                    if rs:
                        by_rent[label] = rs
            if by_rent:
                ds["by_rent_range"] = by_rent

            # 出租型態分佈
            rtb = _rental_type_breakdown(dist_group)
            if rtb:
                ds["rental_type_breakdown"] = rtb

            # 樓層分佈
            fd = _floor_distribution(dist_group)
            if fd:
                ds["floor_distribution"] = fd

            # 路段統計
            roads: dict = {}
            for road, road_group in dist_group.groupby("road"):
                if not road or road == "" or len(road_group) < 2:
                    continue
                rs = calc_stats(road_group)
                if rs:
                    roads[str(road)] = rs
            if roads:
                # 只保留前 30 條路段（按樣本數排序）
                sorted_roads = sorted(
                    roads.items(), key=lambda x: -x[1]["sample_count"]
                )[:30]
                ds["roads"] = dict(sorted_roads)

            stats[city_key]["districts"][str(district)] = ds

    return stats


def build_records(df: pd.DataFrame) -> list:
    """建立個別紀錄列表（給地圖標記用，每個區取最新 50 筆）。

    Includes all new fields extracted in v2 of clean_data() so that
    map-display and detail panels have full property attributes.

    Args:
        df: Fully cleaned and concatenated rental DataFrame.

    Returns:
        List of record dicts, at most 50 sampled per (city, district) pair.
    """
    records: list = []
    for (city, district), group in df.groupby(["city", "district"]):
        subset = group.nlargest(50, "monthly_rent") if len(group) > 50 else group
        # Actually take a sample, not just highest rent
        if len(group) > 50:
            subset = group.sample(50, random_state=42)
        for _, row in subset.iterrows():
            rec: dict = {
                "city": str(city),
                "district": str(district),
                "address": str(row.get("address", "")),
                "road": str(row.get("road", "")),
                "monthly_rent": int(row["monthly_rent"]),
                "room_type": str(row.get("room_type", "")),
            }

            # Numeric optional fields — only include when non-null
            if pd.notna(row.get("area_ping")):
                rec["area_ping"] = round(float(row["area_ping"]), 1)
            if pd.notna(row.get("floor")):
                rec["floor"] = int(row["floor"])
            if pd.notna(row.get("total_floors")):
                rec["total_floors"] = int(row["total_floors"])
            if pd.notna(row.get("building_age")):
                rec["building_age"] = int(row["building_age"])

            # Boolean optional fields
            if pd.notna(row.get("has_manager")):
                rec["has_manager"] = bool(row["has_manager"])
            if pd.notna(row.get("has_elevator")):
                rec["has_elevator"] = bool(row["has_elevator"])
            if pd.notna(row.get("has_furniture")):
                rec["has_furniture"] = bool(row["has_furniture"])

            # String optional fields — only include when non-empty
            rental_type = str(row.get("rental_type", "")).strip()
            if rental_type and rental_type != "nan":
                rec["rental_type"] = rental_type

            main_use = str(row.get("main_use", "")).strip()
            if main_use and main_use != "nan":
                rec["main_use"] = main_use

            equipment = str(row.get("equipment", "")).strip()
            if equipment and equipment != "nan":
                rec["equipment"] = equipment

            records.append(rec)
    return records


def build_social_housing_stats(df: pd.DataFrame) -> dict:
    """Build statistics for social housing records identified by col 34.

    Social housing records have housing_service values containing "社會住宅".
    These are further categorized into "包租轉租" and "代管" sub-types.

    Args:
        df: Fully cleaned and concatenated rental DataFrame.

    Returns:
        Nested statistics dict keyed by city → districts → by_rental_type,
        with overall stats and sample records.
    """
    # Filter social housing records
    mask = df["housing_service"].str.contains("社會住宅", na=False)
    social_df = df[mask].copy()

    if len(social_df) == 0:
        return {}

    # Derive social housing sub-type: 包租轉租 vs 代管
    social_df["social_type"] = social_df["housing_service"].apply(
        lambda x: "包租轉租" if "包租" in str(x) else "代管" if "代管" in str(x) else "其他"
    )

    stats: dict = {}

    for city, city_group in social_df.groupby("city"):
        city_key = str(city)
        city_stats: dict = {
            "total_count": int(len(city_group)),
            "overall_stats": {},
            "by_social_type": {},
            "districts": {},
        }

        # City-level overall stats
        city_stats["overall_stats"] = {
            "median_rent": int(city_group["monthly_rent"].median()),
            "avg_rent": int(city_group["monthly_rent"].mean()),
            "min_rent": int(city_group["monthly_rent"].quantile(0.1)),
            "max_rent": int(city_group["monthly_rent"].quantile(0.9)),
            "sample_count": int(len(city_group)),
        }
        if "area_ping" in city_group.columns and city_group["area_ping"].notna().sum() > 0:
            city_stats["overall_stats"]["avg_area_ping"] = round(
                float(city_group["area_ping"].mean()), 1
            )

        # City-level by social type (包租轉租 vs 代管)
        for stype, sgroup in city_group.groupby("social_type"):
            if len(sgroup) >= 2:
                city_stats["by_social_type"][str(stype)] = {
                    "count": int(len(sgroup)),
                    "median_rent": int(sgroup["monthly_rent"].median()),
                    "avg_rent": int(sgroup["monthly_rent"].mean()),
                }

        # District-level stats
        for district, dist_group in city_group.groupby("district"):
            if len(dist_group) < 1:
                continue

            dist_stats: dict = {
                "total_count": int(len(dist_group)),
                "median_rent": int(dist_group["monthly_rent"].median()),
                "avg_rent": int(dist_group["monthly_rent"].mean()),
            }

            if dist_group["area_ping"].notna().sum() > 0:
                dist_stats["avg_area_ping"] = round(
                    float(dist_group["area_ping"].mean()), 1
                )

            # By rental type (出租型態): 整棟(戶)出租, 獨立套房, 分租套房, 分租雅房
            by_rental_type: dict = {}
            for rtype, rgroup in dist_group.groupby("rental_type"):
                label = str(rtype).strip()
                if not label or label in ("nan", ""):
                    continue
                rt_stats: dict = {
                    "count": int(len(rgroup)),
                    "median_rent": int(rgroup["monthly_rent"].median()),
                    "avg_rent": int(rgroup["monthly_rent"].mean()),
                }
                if rgroup["area_ping"].notna().sum() > 0:
                    rt_stats["avg_area_ping"] = round(
                        float(rgroup["area_ping"].mean()), 1
                    )
                if "rooms" in rgroup.columns and rgroup["rooms"].notna().sum() > 0:
                    rt_stats["avg_rooms"] = round(float(rgroup["rooms"].mean()), 1)
                # Rent range
                rt_stats["min_rent"] = int(rgroup["monthly_rent"].min())
                rt_stats["max_rent"] = int(rgroup["monthly_rent"].max())
                by_rental_type[label] = rt_stats

            if by_rental_type:
                dist_stats["by_rental_type"] = by_rental_type

            # By social type (包租轉租 vs 代管) within district
            by_social_type: dict = {}
            for stype, sgroup in dist_group.groupby("social_type"):
                if len(sgroup) >= 1:
                    by_social_type[str(stype)] = {
                        "count": int(len(sgroup)),
                        "median_rent": int(sgroup["monthly_rent"].median()),
                        "avg_rent": int(sgroup["monthly_rent"].mean()),
                    }
            if by_social_type:
                dist_stats["by_social_type"] = by_social_type

            # Sample addresses: up to 3 per rental type to ensure coverage
            samples = []
            seen_types: dict[str, int] = {}
            for _, row in dist_group.iterrows():
                rtype = str(row.get("rental_type", ""))
                if rtype in seen_types and seen_types[rtype] >= 3:
                    continue
                seen_types[rtype] = seen_types.get(rtype, 0) + 1
                rec: dict = {
                    "address": str(row.get("address", ""))[:60],
                    "rent": int(row["monthly_rent"]),
                    "rental_type": rtype,
                    "social_type": str(row.get("social_type", "")),
                }
                if pd.notna(row.get("area_ping")):
                    rec["area_ping"] = round(float(row["area_ping"]), 1)
                if pd.notna(row.get("rooms")):
                    rec["rooms"] = int(row["rooms"])
                if pd.notna(row.get("floor")):
                    rec["floor"] = int(row["floor"])
                samples.append(rec)
                if len(samples) >= 15:
                    break
            if samples:
                dist_stats["samples"] = samples

            city_stats["districts"][str(district)] = dist_stats

        stats[city_key] = city_stats

    return stats


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

    # 5. Social housing stats (real data from col 34)
    print("  Building social housing statistics...")
    social_stats = build_social_housing_stats(all_data)
    with open(OUTPUT_DIR / "social_housing_real.json", "w", encoding="utf-8") as f:
        json.dump(social_stats, f, ensure_ascii=False, indent=2)
    social_total = sum(v.get("total_count", 0) for v in social_stats.values())
    print(f"  => {social_total:,} social housing records across {len(social_stats)} cities")

    # 6. CSV backup
    all_data.to_csv(PROCESSED_DIR / "all_rental_data.csv", index=False, encoding="utf-8-sig")

    print(f"\n{'='*60}")
    print(f"  DONE!")
    print(f"  {len(all_data):,} records, {all_data['city'].nunique()} cities")
    print(f"  Social housing: {social_total:,} records")
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
