"""
DefectIQ multi-factor pattern discovery engine.

Combinatorial slicing (depth 1-3) over {machine, shift, batch, bucketed
parameters} x defect_type, with lift, chi-square significance (scipy),
recurrence across time windows, and the five-signal Pattern Confidence Score.
"""

import itertools
import math
import re
from scipy.stats import chi2_contingency

import numpy as np
import pandas as pd

# Score weights (shown in UI for transparency)
WEIGHTS = {
    "lift": 0.30,
    "significance": 0.25,
    "sample_size": 0.20,
    "recurrence": 0.15,
    "effect_size": 0.10,
}

MIN_SAMPLE = 30
P_SIG = 0.05
P_HIGH = 0.01
LIFT_HIGH = 3.0
LIFT_MOD = 1.5


def _bucket_columns(df: pd.DataFrame):
    """Factor column names used in mining (categorical dims + param buckets)."""
    cat = ["machine_id", "shift", "batch_id"]
    bucket = [c for c in df.columns if c.endswith("_bucket")]
    return cat + bucket


def _factor_key(name, value):
    v = value
    return f"{name}={v}"


def _two_prop_test(def_in, tot_in, def_out, tot_out):
    """Chi-square test of independence (defect x slice) via scipy contingency."""
    n_in_def, n_in_ok = def_in, tot_in - def_in
    n_out_def, n_out_ok = def_out, tot_out - def_out
    table = [[n_in_def, n_in_ok], [n_out_def, n_out_ok]]
    if min(n_in_def, n_in_ok, n_out_def, n_out_ok) < 1:
        return None
    try:
        chi2, p, _, _ = chi2_contingency(table, correction=True)
        return float(p)
    except ValueError:
        return None


def _saturate(x, scale=1.0):
    return 1.0 - math.exp(-x / scale) if x > 0 else 0.0


def _norm_lift(lift, max_lift=8.0):
    """Saturating normalization so huge outliers don't dominate."""
    return min(_saturate(max(lift - 1.0, 0.0), 1.5), 1.0)


def _norm_significance(p):
    return min(1.0 - p, 1.0)


def _norm_sample(n, cap=2000.0):
    return min(_saturate(math.log(max(n, 1) / 30.0), 2.5), 1.0)


def _norm_effect(def_rate_in, def_rate_base):
    """Absolute rate difference, saturating."""
    return min(_saturate(abs(def_rate_in - def_rate_base) * 40.0, 1.0), 1.0)


def _recurrence_optimized(mask, df, week_totals):
    """Optimized recurrence using precomputed weekly totals."""
    in_g = df[mask]
    if "_week_period" not in in_g.columns:
        return 0.0
    
    in_weeks = in_g.groupby("_week_period").agg({
        "units_inspected": "sum",
        "defect_count": "sum",
        "_week_period": "size"
    }).rename(columns={"_week_period": "n_rows"})
    
    wins = 0
    total = 0
    for w, in_data in in_weeks.iterrows():
        if w not in week_totals.index: continue
        wt = week_totals.loc[w]
        if wt["units_inspected"] < 50 or in_data["units_inspected"] < 50:
            continue
        r_slice = in_data["defect_count"] / max(1, in_data["units_inspected"])
        r_base = wt["defect_count"] / max(1, wt["units_inspected"])
        if r_slice > r_base:
            wins += 1
        total += 1
    return wins / total if total > 0 else 0.0


def mine_patterns(df, max_depth=3, min_sample=None, defect_type=None):
    total_units = df["units_inspected"].sum()
    min_units = max(50, int(total_units * 0.005))  # 0.5% of total units
    global_rate = df["defect_count"].sum() / max(1, total_units)
    cols = _bucket_columns(df)

    if "_week_period" not in df.columns:
        df["_week_period"] = df["timestamp"].dt.to_period("W")
        
    week_totals = df.groupby("_week_period").agg({
        "units_inspected": "sum",
        "defect_count": "sum",
        "_week_period": "size"
    }).rename(columns={"_week_period": "n_rows"})

    df_str = {}
    for c in cols:
        if not c.endswith("_bucket"):
            df_str[c] = df[c].astype(str)

    candidates = []
    levels = [[c] for c in cols]
    levels += list(itertools.combinations(cols, 2))
    if max_depth >= 3:
        levels += list(itertools.combinations(cols, 3))

    for combo in levels:
        # For categorical combos, iterate values; for bucket combos one level each
        value_sets = []
        for c in combo:
            if c.endswith("_bucket"):
                value_sets.append([f">{df[c[:-7]].quantile(0.9):g}"])
            else:
                value_sets.append(sorted(df_str[c].unique().tolist()))

        for vals in itertools.product(*value_sets):
            factors = [_factor_key(c, v) for c, v in zip(combo, vals)]
            
            # Optimized masking
            mask = np.ones(len(df), dtype=bool)
            for c, v in zip(combo, vals):
                if c.endswith("_bucket"):
                    mask &= (df[c[:-7]] > float(v[1:])).to_numpy()
                else:
                    mask &= (df_str[c] == v).to_numpy()
            
            in_g = df[mask]
            def_units_in = int(in_g["units_inspected"].sum())
            if def_units_in < min_units:
                continue

            def_in = int(in_g["defect_count"].sum())
            r_in = def_in / max(1, def_units_in)

            out_g = df[~mask]
            def_units_out = int(out_g["units_inspected"].sum())
            if def_units_out < min_units:
                continue
            
            def_out = int(out_g["defect_count"].sum())
            r_out = def_out / max(1, def_units_out)

            lift = r_in / r_out if r_out > 0 else None
            p = _two_prop_test(def_in, int(in_g["units_inspected"].sum()),
                               def_out, int(out_g["units_inspected"].sum()))
            if p is None or lift is None or lift < 1.0:
                continue

            rec = _recurrence_optimized(mask, df, week_totals)
            scores = {
                "lift": _norm_lift(lift),
                "significance": _norm_significance(p),
                "sample_size": _norm_sample(def_units_in),
                "recurrence": rec,
                "effect_size": _norm_effect(r_in, global_rate),
            }
            raw = sum(WEIGHTS[k] * scores[k] for k in WEIGHTS)
            pattern_score = round(min(100, raw * 100))

            if defect_type is not None:
                # restrict to patterns relevant for the selected defect type
                sub = in_g[in_g["defect_type"] == defect_type]
                if sub["units_inspected"].sum() < min_units:
                    continue
                r_in_dt = sub["defect_count"].sum() / max(1, sub["units_inspected"].sum())
                out_dt = out_g[out_g["defect_type"] == defect_type]
                r_out_dt = (out_dt["defect_count"].sum() / max(1, out_dt["units_inspected"].sum())) if out_dt["units_inspected"].sum() >= min_units else global_rate
                lift_dt = r_in_dt / r_out_dt if r_out_dt > 0 else None
                if lift_dt is None or lift_dt < 1.0:
                    continue
                top_dt = sub["defect_type"].value_counts().head(3)
                dominant = str(top_dt.index[0]) if len(top_dt) > 0 else defect_type
            else:
                top_dt = in_g["defect_type"].value_counts().head(3)
                lift_dt = lift
                r_in_dt, r_out_dt = r_in, r_out
                # Determine dominant defect type cleanly
                no_def_set = {"no defect", "nodefect", "no_defect", "pass", "ok", "good"}
                real_dt = [k for k in top_dt.index if str(k).lower().strip() not in no_def_set]

                if real_dt:
                    first_real = str(real_dt[0])
                    first_cnt = top_dt[first_real]
                    tot_dt_cnt = int(top_dt.sum())
                    if (first_cnt / max(1, tot_dt_cnt)) < 0.45 and len(real_dt) > 1:
                        dominant = "Multiple defect types observed"
                    else:
                        dominant = first_real
                else:
                    dominant = str(top_dt.index[0]) if len(top_dt) > 0 else "Multiple defect types observed"

            assoc = "High" if (lift_dt >= LIFT_HIGH and p < P_HIGH) else (
                "Moderate" if (lift_dt >= LIFT_MOD and p < P_SIG) else "Low")
            confidence = "High" if p < P_HIGH else ("Moderate" if p < P_SIG else "Low")

            # Clean formatted description
            desc_parts = []
            for f in factors:
                if "=" in f:
                    k, v = f.split("=", 1)
                    if k == "machine_id":
                        desc_parts.append(f"Machine {v}")
                    elif k == "shift":
                        desc_parts.append(f"Shift {v}")
                    elif k == "batch_id":
                        desc_parts.append(f"Batch {v}")
                    elif k.endswith("_bucket"):
                        param_name = k.replace("_bucket", "").capitalize()
                        desc_parts.append(f"{param_name} {v}")
                    else:
                        desc_parts.append(f"{k.capitalize()} {v}")
                else:
                    desc_parts.append(f)
            desc_str = " + ".join(desc_parts)

            windows = in_g["timestamp"]
            ts_min = str(windows.min().date()) if len(windows) and pd.notnull(windows.min()) else "N/A"
            ts_max = str(windows.max().date()) if len(windows) and pd.notnull(windows.max()) else "N/A"

            def_units_in = int(in_g["units_inspected"].sum())
            p_rate, p_ci_low, p_ci_high = (0.0, 0.0, 0.0)
            if def_units_in > 0:
                p_val_prop = def_in / def_units_in
                z_val = 1.96
                denom_val = 1 + (z_val**2) / def_units_in
                center_val = (p_val_prop + (z_val**2) / (2 * def_units_in)) / denom_val
                spread_val = (z_val * math.sqrt(max(0.0, p_val_prop * (1 - p_val_prop) + (z_val**2) / (4 * def_units_in))) / math.sqrt(def_units_in)) / denom_val
                p_ci_low = round(max(0.0, center_val - spread_val) * 100, 2)
                p_ci_high = round(min(1.0, center_val + spread_val) * 100, 2)

            candidates.append({
                "pattern_id": None,  # assigned after sorting
                "factors": factors,
                "factor_count": len(factors),
                "is_multi_factor": len(factors) >= 2,
                "description": desc_str,
                "defect_type": dominant,
                "top_defect_types": {str(k): int(v) for k, v in top_dt.items()},
                "slice_rate": round(float(r_in_dt) * 100, 2),
                "ci_lower": p_ci_low,
                "ci_upper": p_ci_high,
                "baseline_rate": round(float(r_out_dt) * 100, 2),
                "lift": round(float(lift_dt), 2),
                "effect_size_pp": round((float(r_in_dt) - float(r_out_dt)) * 100, 2),
                "sample_size": def_units_in, # units inspected (n)
                "record_count": int(mask.sum()), # rows in slice
                "units_inspected": def_units_in,
                "defective_units": int(def_in),
                "p_value": round(p, 4),
                "p_display": "<0.001" if p < 0.001 else f"{p:.3f}",
                "association": assoc,
                "confidence": confidence,
                "recurrence": round(rec, 2),
                "pattern_score": pattern_score,
                "score_breakdown": {k: round(v * 100) for k, v in scores.items()},
                "score_methodology": "Pattern score combines effect size, sample size, statistical confidence, recurrence and deviation from baseline.",
                "date_range": [ts_min, ts_max],
                "affected_batches": sorted(in_g["batch_id"].unique().tolist())[:8],
                "affected_shifts": sorted(in_g["shift"].unique().tolist()),
                "affected_machines": sorted(in_g["machine_id"].unique().tolist()),
                "param_stats": {
                    c[:-7]: {
                        "mean_in": round(float(in_g[c[:-7]].mean()), 1) if c[:-7] in df.columns else 0.0,
                        "mean_out": round(float(out_g[c[:-7]].mean()), 1) if c[:-7] in df.columns else 0.0,
                        "threshold": f"> {df[c[:-7]].quantile(0.9):g}" if c[:-7] in df.columns else "N/A",
                    }
                    for c in combo if c.endswith("_bucket")
                },
            })

    # sort by pattern score desc
    candidates.sort(key=lambda x: (-x["pattern_score"], -x["lift"]))
    for i, cand in enumerate(candidates[:60]):
        cand["pattern_id"] = f"P-{i+1:03d}"
    return candidates
