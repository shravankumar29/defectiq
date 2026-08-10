"""
DefectIQ synthetic data generator.

Generates ~20,000 inspection records over 90 days with four deliberately
embedded patterns (per the build doc §12):
  A: Machine M04 + Shift C + Temperature > 78°C -> Surface defect rate ~4x
  B: Machine M02 + high vibration -> Dimensional defect rate ~2.5-3x
  C: Batches B15-B18 -> elevated Contamination (bad raw-material lot)
  D: plant-wide step-change starting day 60, amplified on M04
Background noise stays in the ~1.5-2.5% defect-rate range.
"""

import numpy as np
import pandas as pd

BASELINE_RATE = 0.020
DAY_60_SHIFT = 0.012  # plant-wide additive lift after day 60
M04_EXTRA = 0.030     # extra additive lift for M04 after day 60


def _batch_list(rng: np.random.Generator, n=40):
    return [f"B{i:02d}" for i in range(1, n + 1)]


def generate_inspections(
    n_records: int = 20000,
    days: int = 90,
    seed: int = 42,
) -> pd.DataFrame:
    rng = np.random.Generator(np.random.PCG64(seed))

    start = pd.Timestamp("2026-03-01")
    end = start + pd.Timedelta(days=days - 1)

    # --- base dimension draws ---
    timestamps = np.sort(rng.uniform(start.value // 10**9, end.value // 10**9, n_records))
    timestamps = pd.to_datetime(timestamps, unit="s")
    day_of_study = (timestamps - start).days.to_numpy()

    machines = rng.choice(["M01", "M02", "M03", "M04", "M05"], n_records)
    shifts = rng.choice(["A", "B", "C"], n_records)
    batches = rng.choice(_batch_list(rng), n_records)
    units_inspected = rng.integers(40, 120, n_records)

    # --- process parameters (normal per machine, with embedded anomalies) ---
    is_m04 = machines == "M04"
    is_m02 = machines == "M02"
    temp_mean = np.where(is_m04, 76.0, 70.0)
    temperature = rng.normal(temp_mean, 5.0)
    pressure = rng.normal(4.2, 0.35)
    speed = rng.normal(120.0, 12.0)
    vib_mean = np.where(is_m02, 0.72, 0.42)
    vibration = rng.normal(vib_mean, 0.12)
    humidity = rng.normal(55.0, 6.0)

    # clamp parameters to plausible ranges
    temperature = np.clip(temperature, 55, 95)
    pressure = np.clip(pressure, 3.0, 6.0)
    vibration = np.clip(vibration, 0.05, 1.2)
    humidity = np.clip(humidity, 30, 80)

    high_temp = temperature > 78.0
    high_vib = vibration > np.percentile(vibration, 90)

    # --- defect probability build-up ---
    p = np.full(n_records, BASELINE_RATE)

    # Pattern A: M04 x Shift C x high temperature -> Surface
    pattern_a = is_m04 & (shifts == "C") & high_temp
    p += np.where(pattern_a, 0.055, 0.0)

    # Pattern B: M02 x high vibration -> Dimensional
    pattern_b = is_m02 & high_vib
    p += np.where(pattern_b, 0.040, 0.0)

    # Pattern C: batches B15-B18 -> Contamination
    bad_lot = np.isin(batches, ["B15", "B16", "B17", "B18"])
    p += np.where(bad_lot, 0.028, 0.0)

    # Pattern D: plant-wide step-change day 60+
    after_d60 = day_of_study >= 60
    p += np.where(after_d60, DAY_60_SHIFT, 0.0)
    p += np.where(after_d60 & is_m04, M04_EXTRA, 0.0)

    p = np.clip(p, 0.0, 0.55)

    # --- defect sampling ---
    defect_count = rng.binomial(units_inspected, p)
    is_defective = defect_count > 0

    # --- defect type assignment ---
    defect_types = np.full(n_records, "Other", dtype=object)
    d_idx = np.where(is_defective)[0]
    for i in d_idx:
        weights = {
            "Surface": 0.30,
            "Dimensional": 0.24,
            "Contamination": 0.18,
            "Alignment": 0.15,
            "Other": 0.13,
        }
        if pattern_a[i]:
            weights["Surface"] = 0.75
            weights["Dimensional"] = 0.05
            weights["Other"] = 0.05
        elif pattern_b[i]:
            weights["Dimensional"] = 0.72
            weights["Surface"] = 0.06
        elif bad_lot[i]:
            weights["Contamination"] = 0.70
            weights["Other"] = 0.06
        probs = list(weights.values())
        probs = [x / sum(probs) for x in probs]
        defect_types[i] = rng.choice(list(weights.keys()), p=probs)

    df = pd.DataFrame(
        {
            "inspection_id": [f"INS-{i+1:06d}" for i in range(n_records)],
            "timestamp": timestamps,
            "machine_id": machines,
            "batch_id": batches,
            "shift": shifts,
            "defect_type": defect_types,
            "defect_count": defect_count,
            "units_inspected": units_inspected,
            "temperature": np.round(temperature, 1),
            "pressure": np.round(pressure, 2),
            "speed": np.round(speed, 1),
            "vibration": np.round(vibration, 3),
            "humidity": np.round(humidity, 1),
        }
    )
    return df


REQUIRED_COLUMNS = [
    "inspection_id",
    "timestamp",
    "machine_id",
    "batch_id",
    "shift",
    "defect_type",
    "defect_count",
    "units_inspected",
    "temperature",
    "pressure",
    "speed",
    "vibration",
    "humidity",
]


def validate_and_clean(df: pd.DataFrame):
    """Validate schema/dtypes, clean, add derived features and data quality audit."""
    df = df.copy()

    records_initial = len(df)
    cols_initial = len(df.columns)
    null_count_initial = int(df.isna().sum().sum())
    dup_count_initial = int(df.duplicated().sum()) if "inspection_id" not in df.columns else int(df.duplicated(subset=["inspection_id"]).sum())
    invalid_dates_count = int(pd.to_datetime(df["timestamp"], errors="coerce").isna().sum()) if "timestamp" in df.columns else 0
    invalid_numerics = 0
    if "defect_count" in df.columns:
        invalid_numerics += int(pd.to_numeric(df["defect_count"], errors="coerce").isna().sum())
    if "units_inspected" in df.columns:
        invalid_numerics += int(pd.to_numeric(df["units_inspected"], errors="coerce").isna().sum())

    # Auto-generate inspection_id if missing
    if "inspection_id" not in df.columns:
        df["inspection_id"] = [f"INS-{i+1:06d}" for i in range(len(df))]

    # Fill default process parameters and fields if missing
    defaults = {
        "units_inspected": 100,
        "temperature": 70.0,
        "pressure": 4.2,
        "speed": 120.0,
        "vibration": 0.45,
        "humidity": 55.0,
        "shift": "Shift A",
        "batch_id": "B01",
        "machine_id": "M01",
        "defect_type": "Unknown / Unclassified",
        "defect_count": 0
    }
    for col, default_val in defaults.items():
        if col not in df.columns:
            df[col] = default_val

    missing = [c for c in ["timestamp", "machine_id", "batch_id", "shift", "defect_type", "defect_count"] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df["inspection_id"] = df["inspection_id"].astype(str)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    for c in REQUIRED_COLUMNS[2:7]:
        if c in df.columns:
            df[c] = df[c].astype(str)
    df["defect_count"] = pd.to_numeric(df["defect_count"], errors="coerce").fillna(0)
    df["units_inspected"] = pd.to_numeric(df["units_inspected"], errors="coerce").fillna(100)
    for c in REQUIRED_COLUMNS[8:]:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(defaults.get(c, 0.0))

    df = df.dropna(subset=["timestamp", "machine_id"])
    df = df[df["units_inspected"] > 0]
    df = df.drop_duplicates(subset="inspection_id", keep="first")
    df["defect_count"] = np.clip(df["defect_count"], 0, df["units_inspected"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    # parameter buckets (90th-percentile bucketing for pattern mining)
    for param in ["temperature", "pressure", "speed", "vibration", "humidity"]:
        if param in df.columns:
            thr = df[param].quantile(0.9)
            df[f"{param}_bucket"] = np.where(df[param] > thr, f">{thr:g}", f"<={thr:g}")

    # Compile data quality audit dictionary
    df.attrs["data_quality"] = {
        "records_loaded": records_initial,
        "valid_records_retained": len(df),
        "columns_recognized": cols_initial,
        "missing_values": null_count_initial,
        "duplicate_records": dup_count_initial,
        "invalid_dates": invalid_dates_count,
        "invalid_numeric_values": invalid_numerics,
        "detected_machines": sorted(df["machine_id"].unique().tolist()),
        "detected_shifts": sorted(df["shift"].unique().tolist()),
        "detected_batches": sorted(df["batch_id"].unique().tolist())[:25],
        "total_batches_count": len(df["batch_id"].unique()),
        "detected_defect_categories": sorted(df["defect_type"].unique().tolist()),
    }

    return df



if __name__ == "__main__":
    df = generate_inspections()
    df = validate_and_clean(df)
    print(f"rows={len(df)}  defect_rate={df.defect_count.sum()/df.units_inspected.sum():.4f}")
    print(df.groupby("machine_id").apply(lambda g: g.defect_count.sum() / g.units_inspected.sum(), include_groups=False))
