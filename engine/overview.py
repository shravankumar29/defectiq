"""
DefectIQ executive overview aggregations.
"""

import pandas as pd


def kpi_cards(df, alerts_count=0, highest_risk_machine=None, highest_risk_shift=None):
    total_inspections = int(len(df))
    total_defects = int(df["defect_count"].sum())
    total_units = int(df["units_inspected"].sum())
    rate = total_defects / total_units if total_units else 0.0
    date_min, date_max = df["timestamp"].min(), df["timestamp"].max()

    # highest-risk machine
    by_machine = df.groupby("machine_id").apply(
        lambda g: g["defect_count"].sum() / g["units_inspected"].sum(), include_groups=False)
    hrm = by_machine.idxmax() if highest_risk_machine is None else highest_risk_machine

    by_shift = df.groupby("shift").apply(
        lambda g: g["defect_count"].sum() / g["units_inspected"].sum(), include_groups=False)
    hrs = by_shift.idxmax() if highest_risk_shift is None else highest_risk_shift

    # last-30 vs prior window comparison
    d30 = df[df["timestamp"] >= date_max - pd.Timedelta(days=30)]
    prior = df[df["timestamp"] < date_max - pd.Timedelta(days=30)]
    rate_30 = (d30["defect_count"].sum() / d30["units_inspected"].sum()) if len(d30) else rate
    rate_prior = (prior["defect_count"].sum() / prior["units_inspected"].sum()) if len(prior) else rate
    delta_pp = (rate_30 - rate_prior) * 100 if rate_prior > 0 else 0.0

    return {
        "total_inspections": total_inspections,
        "total_defects": total_defects,
        "defect_rate_pct": round(rate * 100, 2),
        "defect_rate_30d_pct": round(rate_30 * 100, 2),
        "delta_pp_30d": round(delta_pp, 2),
        "date_range": [str(date_min.date()), str(date_max.date())],
        "highest_risk_machine": str(hrm),
        "highest_risk_machine_rate_pct": round(float(by_machine[hrm]) * 100, 2),
        "highest_risk_shift": str(hrs),
        "highest_risk_shift_rate_pct": round(float(by_shift[hrs]) * 100, 2),
        "active_alerts": alerts_count,
        "machine_comparison": {str(k): round(float(v) * 100, 2) for k, v in by_machine.items()},
        "shift_comparison": {str(k): round(float(v) * 100, 2) for k, v in by_shift.items()},
    }


def pareto_top5(df, n=5):
    counts = df["defect_type"].value_counts().head(n)
    total = counts.sum()
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


def machine_shift_heatmap(df):
    agg = df.groupby(["machine_id", "shift"]).apply(
        lambda g: g["defect_count"].sum() / g["units_inspected"].sum(), include_groups=False
    ).reset_index(name="defect_rate")
    agg["defect_rate_pct"] = (agg["defect_rate"] * 100).round(2)
    return agg[["machine_id", "shift", "defect_rate_pct"]].to_dict("records")


def machine_trends(df):
    d = df.copy()
    d["date"] = d["timestamp"].dt.date
    agg = d.groupby(["date", "machine_id"]).agg(units=("units_inspected", "sum"), defects=("defect_count", "sum")).reset_index()
    agg["defect_rate_pct"] = (agg["defects"] / agg["units"] * 100).round(2)
    out = {}
    for mach, g in agg.groupby("machine_id"):
        out[str(mach)] = [{"date": str(r["date"]), "defect_rate_pct": float(r["defect_rate_pct"])} for _, r in g.iterrows()]
    return out


def shift_trends(df):
    d = df.copy()
    d["date"] = d["timestamp"].dt.date
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
    agg = df.groupby("batch_id").agg(
        defects=("defect_count", "sum"), units=("units_inspected", "sum"),
        machines=("machine_id", lambda s: sorted(s.unique().tolist())[:3]),
        date_min=("timestamp", "min"), date_max=("timestamp", "max"),
    ).reset_index()
    agg["defect_rate_pct"] = (agg["defects"] / agg["units"] * 100).round(2)
    overall = df["defect_count"].sum() / df["units_inspected"].sum()
    agg["flagged"] = (agg["defect_rate_pct"] > overall * 100 * 1.3).astype(int)
    agg["date_range"] = agg["date_min"].dt.strftime("%Y-%m-%d") + " → " + agg["date_max"].dt.strftime("%Y-%m-%d")
    out = agg.sort_values("defect_rate_pct", ascending=False)
    return {
        "global_rate_pct": round(overall * 100, 2),
        "batches": out[["batch_id", "defect_rate_pct", "defects", "units", "flagged", "date_range", "machines"]].to_dict("records"),
    }
