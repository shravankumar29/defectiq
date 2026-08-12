import pandas as pd
import numpy as np
import json
from engine.pattern_engine import mine_patterns, _bucket_columns, _two_prop_test, _norm_lift, _norm_significance, _norm_sample, _norm_effect, _recurrence_optimized

# Generate a synthetic dataset mimicking the user's uploaded dataset
n_records = 5000
np.random.seed(42)

machines = np.random.choice(["M01", "M02", "M03", "M04", "M05"], n_records)
shifts = np.random.choice(["A", "B", "C"], n_records)
batches = [f"B{i:02d}" for i in range(1, 20)]
batch_ids = np.random.choice(batches, n_records)
units_inspected = np.random.randint(40, 120, n_records)
timestamps = pd.to_datetime("2026-03-01") + pd.to_timedelta(np.random.randint(0, 90, n_records), unit="D")

# Overall base rate
p = np.full(n_records, 0.01) # to average out to ~1.55%

# M04 + Shift B anomaly
anomaly_mask = (machines == "M04") & (shifts == "B")
p[anomaly_mask] = 0.09 # 9% defect rate

defect_count = np.random.binomial(units_inspected, p)
defect_types = np.full(n_records, "Other", dtype=object)
is_defective = defect_count > 0

for i in np.where(is_defective)[0]:
    if anomaly_mask[i]:
        defect_types[i] = np.random.choice(["Surface", "Dimensional"], p=[0.8, 0.2])
    else:
        defect_types[i] = np.random.choice(["Surface", "Dimensional", "Contamination", "Other"], p=[0.25, 0.25, 0.25, 0.25])

df = pd.DataFrame({
    "inspection_id": [f"INS-{i+1:06d}" for i in range(n_records)],
    "timestamp": timestamps,
    "machine_id": machines,
    "batch_id": batch_ids,
    "shift": shifts,
    "defect_type": defect_types,
    "defect_count": defect_count,
    "units_inspected": units_inspected,
    "temperature": 70.0,
    "pressure": 4.2,
    "speed": 120.0,
    "vibration": 0.45,
    "humidity": 55.0,
})
# required for bucketing logic
for param in ["temperature", "pressure", "speed", "vibration", "humidity"]:
    thr = df[param].quantile(0.9)
    df[f"{param}_bucket"] = np.where(df[param] > thr, f">{thr:g}", f"<={thr:g}")

df["_week_period"] = df["timestamp"].dt.to_period("W")

# 1. Manually calculate M04 + Shift B to debug why it might fail
mask = anomaly_mask
in_g = df[mask]
def_in = in_g["defect_count"].sum()
r_in = def_in / max(1, in_g["units_inspected"].sum())
print(f"[PATTERN DEBUG]")
print(f"Pattern: Machine M04 + Shift B")
print(f"Units in: {in_g['units_inspected'].sum()}")
print(f"Defects in: {def_in}")
print(f"Pattern rate: {r_in:.4f}")

out_g = df[~mask]
def_out = out_g["defect_count"].sum()
r_out = def_out / max(1, out_g["units_inspected"].sum())
print(f"Global rate (outside): {r_out:.4f}")
print(f"Overall rate: {df['defect_count'].sum() / df['units_inspected'].sum():.4f}")

lift = r_in / r_out if r_out > 0 else 0
print(f"Lift: {lift:.4f}")

p_val = _two_prop_test(def_in, in_g["units_inspected"].sum(), def_out, out_g["units_inspected"].sum())
print(f"p-value: {p_val}")

print(f"Min sample limit: {max(1, min(30, len(df)//4))}")
n_rows = len(in_g)
print(f"Rows in slice: {n_rows}")

# 2. Run mine_patterns
print("\n--- Running mine_patterns ---")
candidates = mine_patterns(df, max_depth=3)
print(f"Total candidates returned by mine_patterns: {len(candidates)}")
for c in candidates:
    if "Machine M04" in c["description"] and "Shift B" in c["description"]:
        print("\nFound Candidate M04 + Shift B in results:")
        print(json.dumps(c, indent=2))
        break
else:
    print("\nCandidate M04 + Shift B NOT FOUND in results!")

