import math
import pandas as pd
import numpy as np

NO_DEFECT_LABELS = {"no defect", "nodefect", "no_defect", "pass", "ok", "no defective", "none", "good"}


def calc_confidence_interval(defects: int, units: int, confidence: float = 0.95):
    """
    Wilson score interval for binomial proportion (defect rate).
    Returns (rate_pct, ci_lower_pct, ci_upper_pct).
    """
    if units <= 0:
        return 0.0, 0.0, 0.0
    p = defects / units
    z = 1.96  # 95% CI multiplier
    denom = 1 + (z**2) / units
    center = (p + (z**2) / (2 * units)) / denom
    spread = (z * math.sqrt(max(0.0, p * (1 - p) + (z**2) / (4 * units))) / math.sqrt(units)) / denom
    lower = max(0.0, center - spread) * 100
    upper = min(1.0, center + spread) * 100
    return round(p * 100, 2), round(lower, 2), round(upper, 2)


def kpi_cards(df, alerts_count=0, highest_risk_machine=None, highest_risk_shift=None):
    inspection_records = int(len(df))
    defective_units = int(df["defect_count"].sum())
    units_inspected = int(df["units_inspected"].sum())
    rate_pct, ci_low, ci_high = calc_confidence_interval(defective_units, units_inspected)

    # Ensure timestamp is datetime
    ts = pd.to_datetime(df["timestamp"], errors="coerce")
    date_min, date_max = ts.min(), ts.max()

    # machine aggregation
    by_machine_defects = df.groupby("machine_id")["defect_count"].sum()
    by_machine_units = df.groupby("machine_id")["units_inspected"].sum()
    by_machine_rate = {}
    by_machine_ci = {}
    for m in by_machine_units.index:
        d_cnt = int(by_machine_defects.get(m, 0))
        u_cnt = int(by_machine_units.get(m, 0))
        r_val, low_val, high_val = calc_confidence_interval(d_cnt, u_cnt)
        by_machine_rate[str(m)] = r_val
        by_machine_ci[str(m)] = {
            "defect_rate_pct": r_val,
            "ci_lower": low_val,
            "ci_upper": high_val,
            "defects": d_cnt,
            "units": u_cnt,
        }

    if len(by_machine_rate) > 0:
        hrm = max(by_machine_rate.keys(), key=lambda k: by_machine_rate[k]) if highest_risk_machine is None else str(highest_risk_machine)
        hrm_rate = by_machine_rate.get(hrm, 0.0)
    else:
        hrm = "N/A"
        hrm_rate = 0.0

    # shift aggregation
    by_shift_defects = df.groupby("shift")["defect_count"].sum()
    by_shift_units = df.groupby("shift")["units_inspected"].sum()
    by_shift_rate = {}
    by_shift_ci = {}
    for s in by_shift_units.index:
        d_cnt = int(by_shift_defects.get(s, 0))
        u_cnt = int(by_shift_units.get(s, 0))
        r_val, low_val, high_val = calc_confidence_interval(d_cnt, u_cnt)
        by_shift_rate[str(s)] = r_val
        by_shift_ci[str(s)] = {
            "defect_rate_pct": r_val,
            "ci_lower": low_val,
            "ci_upper": high_val,
            "defects": d_cnt,
            "units": u_cnt,
        }

    if len(by_shift_rate) > 0:
        hrs = max(by_shift_rate.keys(), key=lambda k: by_shift_rate[k]) if highest_risk_shift is None else str(highest_risk_shift)
        hrs_rate = by_shift_rate.get(hrs, 0.0)
    else:
        hrs = "N/A"
        hrs_rate = 0.0

    # Historical baseline comparison: set has_prior_period = True ONLY if prior period with data exists!
    has_prior_period = False
    delta_pp = None
    rate_30 = rate_pct
    if pd.notnull(date_max) and pd.notnull(date_min):
        cutoff = date_max - pd.Timedelta(days=30)
        d30 = df[ts >= cutoff]
        prior = df[ts < cutoff]
        if len(prior) > 0 and prior["units_inspected"].sum() > 0:
            rate_30 = (d30["defect_count"].sum() / d30["units_inspected"].sum() * 100) if len(d30) and d30["units_inspected"].sum() > 0 else rate_pct
            rate_prior = (prior["defect_count"].sum() / prior["units_inspected"].sum() * 100)
            delta_pp = round(rate_30 - rate_prior, 2)
            has_prior_period = True

    days_span = int((date_max - date_min).days) + 1 if pd.notnull(date_min) and pd.notnull(date_max) else 1

    min_str = str(date_min.date()) if pd.notnull(date_min) else "N/A"
    max_str = str(date_max.date()) if pd.notnull(date_max) else "N/A"

    return {
        "inspection_records": inspection_records,
        "total_inspections": inspection_records, # backwards compatibility
        "units_inspected": units_inspected,
        "total_units": units_inspected,
        "defective_units": defective_units,
        "total_defects": defective_units,
        "defect_rate_pct": rate_pct,
        "ci_lower": ci_low,
        "ci_upper": ci_high,
        "has_prior_period": has_prior_period,
        "delta_pp_30d": delta_pp,
        "date_range": [min_str, max_str],
        "days_span": days_span,
        "highest_risk_machine": str(hrm),
        "highest_risk_machine_rate_pct": hrm_rate,
        "highest_risk_shift": str(hrs),
        "highest_risk_shift_rate_pct": hrs_rate,
        "active_alerts": alerts_count,
        "machine_comparison": by_machine_rate,
        "machine_ci": by_machine_ci,
        "shift_comparison": by_shift_rate,
        "shift_ci": by_shift_ci,
    }


def pareto_top5(df, n=5):
    # Filter out "No Defect" from defect ranking
    dt_series = df["defect_type"].astype(str)
    real_defects = df[~dt_series.str.lower().isin(NO_DEFECT_LABELS)]
    if len(real_defects) == 0:
        real_defects = df

    counts = real_defects.groupby("defect_type")["defect_count"].sum().sort_values(ascending=False).head(n)
    total = counts.sum() if counts.sum() > 0 else 1
    cum = 0.0
    rows = []
    for name, c in counts.items():
        cum += c
        rows.append({
            "defect_type": str(name),
            "count": int(c),
            "pct": round(c / total * 100, 1),
            "cumulative_pct": round(cum / total * 100, 1),
        })
    return rows


def defect_type_analysis(df):
    dt_series = df["defect_type"].astype(str)
    all_types = dt_series.unique().tolist()
    
    total_defects_sum = int(df["defect_count"].sum())
    total_units_sum = int(df["units_inspected"].sum())

    type_stats = []
    for dt in all_types:
        sub = df[dt_series == dt]
        c_defects = int(sub["defect_count"].sum())
        c_units = int(sub["units_inspected"].sum())
        c_rows = len(sub)
        is_no_defect = dt.lower().strip() in NO_DEFECT_LABELS
        rate_pct, low_val, high_val = calc_confidence_interval(c_defects, c_units)
        share_pct = round((c_defects / total_defects_sum * 100), 2) if total_defects_sum > 0 else 0.0

        type_stats.append({
            "defect_type": str(dt),
            "defect_count": c_defects,
            "units_inspected": c_units,
            "record_count": c_rows,
            "defect_rate_pct": rate_pct,
            "ci_lower": low_val,
            "ci_upper": high_val,
            "share_of_total_defects_pct": share_pct,
            "is_no_defect": is_no_defect
        })

    # Separate real defects from "No Defect"
    real_defects_stats = [t for t in type_stats if not t["is_no_defect"]]
    no_defect_stats = [t for t in type_stats if t["is_no_defect"]]

    real_defects_stats.sort(key=lambda x: (-x["defect_count"], -x["defect_rate_pct"]))

    dominant_type = real_defects_stats[0]["defect_type"] if real_defects_stats else "N/A"

    machine_x_dt = df.groupby(["machine_id", "defect_type"]).agg(
        defects=("defect_count", "sum"),
        units=("units_inspected", "sum")
    ).reset_index()
    machine_x_dt["defect_rate_pct"] = (machine_x_dt["defects"] / machine_x_dt["units"] * 100).round(2)

    shift_x_dt = df.groupby(["shift", "defect_type"]).agg(
        defects=("defect_count", "sum"),
        units=("units_inspected", "sum")
    ).reset_index()
    shift_x_dt["defect_rate_pct"] = (shift_x_dt["defects"] / shift_x_dt["units"] * 100).round(2)

    batch_x_dt = df.groupby(["batch_id", "defect_type"]).agg(
        defects=("defect_count", "sum"),
        units=("units_inspected", "sum")
    ).reset_index()
    batch_x_dt["defect_rate_pct"] = (batch_x_dt["defects"] / batch_x_dt["units"] * 100).round(2)

    return {
        "dominant_defect_type": dominant_type,
        "ranked_defects": real_defects_stats,
        "no_defect_status": no_defect_stats,
        "machine_x_defect": machine_x_dt.to_dict("records"),
        "shift_x_defect": shift_x_dt.to_dict("records"),
        "batch_x_defect": batch_x_dt.head(20).to_dict("records"),
    }


def machine_analysis_details(df):
    agg = df.groupby("machine_id").agg(
        defects=("defect_count", "sum"),
        units=("units_inspected", "sum"),
        inspections=("inspection_id", "count") if "inspection_id" in df.columns else ("defect_count", "count")
    ).reset_index()

    machines = []
    for idx, r in agg.iterrows():
        m_id = str(r["machine_id"])
        defects = int(r["defects"])
        units = int(r["units"])
        inspections = int(r["inspections"])
        rate_pct, low_val, high_val = calc_confidence_interval(defects, units)

        machines.append({
            "machine_id": m_id,
            "defect_rate_pct": rate_pct,
            "ci_lower": low_val,
            "ci_upper": high_val,
            "defect_count": defects,
            "units_inspected": units,
            "inspection_count": inspections,
            "display_summary": f"{m_id}: {rate_pct:.2f}% defect rate ({defects:,} defects / {units:,} inspected, n={units:,})"
        })

    machines.sort(key=lambda x: -x["defect_rate_pct"])
    highest_risk = machines[0] if machines else None

    return {
        "highest_risk_machine": highest_risk,
        "machine_rankings": machines
    }


def shift_analysis_details(df):
    agg = df.groupby("shift").agg(
        defects=("defect_count", "sum"),
        units=("units_inspected", "sum"),
        inspections=("defect_count", "count")
    ).reset_index()

    shifts = []
    for idx, r in agg.iterrows():
        s_id = str(r["shift"])
        defects = int(r["defects"])
        units = int(r["units"])
        inspections = int(r["inspections"])
        rate_pct, low_val, high_val = calc_confidence_interval(defects, units)

        shifts.append({
            "shift": s_id,
            "defect_rate_pct": rate_pct,
            "ci_lower": low_val,
            "ci_upper": high_val,
            "defect_count": defects,
            "units_inspected": units,
            "inspection_count": inspections,
            "display_summary": f"{s_id}: {rate_pct:.2f}% defect rate ({defects:,} defects / {units:,} inspected, n={units:,})"
        })

    shifts.sort(key=lambda x: -x["defect_rate_pct"])
    highest_risk = shifts[0] if shifts else None

    return {
        "highest_risk_shift": highest_risk,
        "shift_rankings": shifts
    }


def process_parameter_analysis(df):
    """
    Analyzes numerical process parameters (temperature, pressure, speed, vibration, humidity).
    If a parameter column is missing or unpopulated, returns 'Data unavailable'.
    """
    param_cols = ["temperature", "pressure", "speed", "vibration", "humidity"]
    results = {}

    overall_defect_rate = (df["defect_count"].sum() / df["units_inspected"].sum() * 100) if df["units_inspected"].sum() > 0 else 0.0

    for param in param_cols:
        if param not in df.columns or df[param].dropna().empty:
            results[param] = {
                "parameter": param,
                "status": "Data unavailable",
                "has_data": False
            }
            continue

        valid_df = df.dropna(subset=[param]).copy()
        if len(valid_df) < 5:
            results[param] = {
                "parameter": param,
                "status": "Data unavailable",
                "has_data": False
            }
            continue

        q90 = float(valid_df[param].quantile(0.90))
        high_group = valid_df[valid_df[param] > q90]
        low_group = valid_df[valid_df[param] <= q90]

        high_rate = (high_group["defect_count"].sum() / high_group["units_inspected"].sum() * 100) if high_group["units_inspected"].sum() > 0 else 0.0
        low_rate = (low_group["defect_count"].sum() / low_group["units_inspected"].sum() * 100) if low_group["units_inspected"].sum() > 0 else 0.0

        defects_df = valid_df[valid_df["defect_count"] > 0]
        good_df = valid_df[valid_df["defect_count"] == 0]

        mean_defects = float(defects_df[param].mean()) if len(defects_df) > 0 else float(valid_df[param].mean())
        mean_good = float(good_df[param].mean()) if len(good_df) > 0 else float(valid_df[param].mean())

        lift = (high_rate / low_rate) if low_rate > 0 else (high_rate / overall_defect_rate if overall_defect_rate > 0 else 1.0)

        results[param] = {
            "parameter": param,
            "status": "Available",
            "has_data": True,
            "threshold_q90": round(q90, 2),
            "mean_in_defects": round(mean_defects, 2),
            "mean_in_good": round(mean_good, 2),
            "high_threshold_rate_pct": round(high_rate, 2),
            "baseline_rate_pct": round(low_rate, 2),
            "lift": round(lift, 2),
            "finding": f"{param.capitalize()} > {q90:.2f} is associated with a {high_rate:.2f}% defect rate ({lift:.2f}x lift vs baseline {low_rate:.2f}%)."
        }

    return results


def machine_shift_heatmap(df):
    agg = df.groupby(["machine_id", "shift"]).apply(
        lambda g: (g["defect_count"].sum() / g["units_inspected"].sum() * 100) if g["units_inspected"].sum() > 0 else 0.0,
        include_groups=False
    ).reset_index(name="defect_rate_pct")
    agg["defect_rate_pct"] = agg["defect_rate_pct"].round(2)
    return agg[["machine_id", "shift", "defect_rate_pct"]].to_dict("records")


def machine_trends(df):
    d = df.copy()
    d["date"] = pd.to_datetime(d["timestamp"], errors="coerce").dt.date
    agg = d.groupby(["date", "machine_id"]).agg(units=("units_inspected", "sum"), defects=("defect_count", "sum")).reset_index()
    agg["defect_rate_pct"] = (agg["defects"] / agg["units"] * 100).round(2)
    out = {}
    for mach, g in agg.groupby("machine_id"):
        out[str(mach)] = [{"date": str(r["date"]), "defect_rate_pct": float(r["defect_rate_pct"])} for _, r in g.iterrows()]
    return out


def shift_trends(df):
    d = df.copy()
    d["date"] = pd.to_datetime(d["timestamp"], errors="coerce").dt.date
    agg = d.groupby(["date", "shift"]).agg(units=("units_inspected", "sum"), defects=("defect_count", "sum")).reset_index()
    agg["defect_rate_pct"] = (agg["defects"] / agg["units"] * 100).round(2)
    out = {}
    for sh, g in agg.groupby("shift"):
        out[str(sh)] = [{"date": str(r["date"]), "defect_rate_pct": float(r["defect_rate_pct"])} for _, r in g.iterrows()]
    return out


def machine_defect_breakdown(df):
    agg = df.groupby(["machine_id", "defect_type"]).agg(
        defects=("defect_count", "sum"), units=("units_inspected", "sum")).reset_index()
    agg["defect_rate_pct"] = (agg["defects"] / agg["units"] * 100).round(2)
    return agg.to_dict("records")


def shift_defect_heatmap(df):
    agg = df.groupby(["shift", "defect_type"]).agg(
        defects=("defect_count", "sum"), units=("units_inspected", "sum")).reset_index()
    agg["defect_rate_pct"] = (agg["defects"] / agg["units"] * 100).round(2)
    return agg.to_dict("records")


def batch_table(df):
    ts = pd.to_datetime(df["timestamp"], errors="coerce")
    agg = df.groupby("batch_id").agg(
        defects=("defect_count", "sum"), units=("units_inspected", "sum"),
        machines=("machine_id", lambda s: sorted(s.unique().tolist())[:3]),
        date_min=("timestamp", "min"), date_max=("timestamp", "max"),
    ).reset_index()
    agg["defect_rate_pct"] = (agg["defects"] / agg["units"] * 100).round(2)
    overall = (df["defect_count"].sum() / df["units_inspected"].sum()) if df["units_inspected"].sum() > 0 else 0.0
    agg["flagged"] = (agg["defect_rate_pct"] > overall * 100 * 1.3).astype(int)

    agg["date_min_str"] = pd.to_datetime(agg["date_min"], errors="coerce").dt.strftime("%Y-%m-%d")
    agg["date_max_str"] = pd.to_datetime(agg["date_max"], errors="coerce").dt.strftime("%Y-%m-%d")
    agg["date_range"] = agg["date_min_str"] + " → " + agg["date_max_str"]

    out = agg.sort_values("defect_rate_pct", ascending=False)
    return {
        "global_rate_pct": round(overall * 100, 2),
        "batches": out[["batch_id", "defect_rate_pct", "defects", "units", "flagged", "date_range", "machines"]].to_dict("records"),
    }
