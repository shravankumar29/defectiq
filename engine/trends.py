"""
DefectIQ trend & change-detection analytics.

- Daily rolling defect rate + EWMA overlay
- Rolling z-score vs trailing baseline window (|z|>3 flagged)
- CUSUM change-point detection with exact start date
"""

import numpy as np
import pandas as pd


def daily_defect_series(df: pd.DataFrame, group_cols=None) -> pd.DataFrame:
    """Daily defect rate series, optionally per group."""
    d = df.copy()
    d["date"] = d["timestamp"].dt.date
    keys = (["date"] + list(group_cols)) if group_cols else ["date"]
    agg = d.groupby(keys).agg(
        units=("units_inspected", "sum"),
        defects=("defect_count", "sum"),
    )
    agg["defect_rate"] = agg["defects"] / agg["units"]
    return agg.reset_index()


def ewma(rate: np.ndarray, span: float = 7.0) -> np.ndarray:
    s = pd.Series(rate).ewm(span=span, adjust=False)
    return s.mean().to_numpy()


def compute_daily_trend(df: pd.DataFrame, baseline_window_days: int = 14):
    daily = daily_defect_series(df)
    r = daily["defect_rate"].to_numpy()
    n = len(r)
    ema = ewma(r)

    z = np.full(n, np.nan)
    for i in range(baseline_window_days, n):
        win = r[i - baseline_window_days : i]
        mu, sd = win.mean(), win.std(ddof=1)
        if sd > 0:
            z[i] = (r[i] - mu) / sd

    series = daily.copy()
    series["ewma"] = ema
    series["z_score"] = z
    series["spike_flag"] = (np.abs(series["z_score"].to_numpy()) > 3).astype(int)
    return series


def cusum_detection(series: pd.DataFrame, k: float = 0.5, h: float = 5.0,
                    baseline_window_days: int = 14):
    """
    One-sided CUSUM for upward shifts in the daily defect rate.
    Returns the first detected change-point index (None if none).
    k: allowance, h: decision threshold, applied to z-scored deviations.
    """
    r = series["defect_rate"].to_numpy()
    n = len(r)
    if n < baseline_window_days + 5:
        return None, [], []

    # baseline stats from trailing window at each point (causal, online)
    plus, minus = np.zeros(n), np.zeros(n)
    zvals = np.full(n, np.nan)
    for i in range(baseline_window_days, n):
        win = r[i - baseline_window_days : i]
        mu, sd = win.mean(), win.std(ddof=1)
        if sd == 0:
            z = 0.0
        else:
            z = (r[i] - mu) / sd
        zvals[i] = z
        plus[i] = max(0, plus[i - 1] + z - k)
        minus[i] = max(0, minus[i - 1] - z - k)

    flags = (plus > h) | (minus > h)
    change_idx = int(np.argmax(flags)) if flags.any() else None
    series_out = series.copy()
    series_out["cusum_pos"] = plus
    series_out["cusum_neg"] = minus
    series_out["cusum_flag"] = flags.astype(int)
    series_out["z_score"] = zvals

    cp = None
    cp_row = None
    if change_idx is not None and flags[change_idx]:
        cp_row = series_out.iloc[change_idx]
        cp = {
            "date": str(pd.Timestamp(cp_row["date"]).date()),
            "index": change_idx,
            "direction": "up" if plus[change_idx] > h else "down",
            "before_rate": float(r[max(0, change_idx - baseline_window_days) : change_idx].mean()),
            "after_rate": float(r[change_idx:].mean()),
            "cusum_value": float(plus[change_idx] if plus[change_idx] > h else -minus[change_idx]),
        }
    return cp, series_out


def before_after_panel(df: pd.DataFrame, change_date: str, group_col=None):
    """Compare defect rates before vs after a change date, overall & per group."""
    cut = pd.Timestamp(change_date)
    pre = df[df["timestamp"] < cut]
    post = df[df["timestamp"] >= cut]

    def rate_of(x):
        return float(x["defect_count"].sum() / x["units_inspected"].sum())

    panel = {
        "before": {"defect_rate": rate_of(pre), "inspections": int(len(pre)), "defective_units": int(pre["defect_count"].sum())},
        "after": {"defect_rate": rate_of(post), "inspections": int(len(post)), "defective_units": int(post["defect_count"].sum())},
    }
    rel = post_units = pre_units = 1.0
    rel = (panel["after"]["defect_rate"] - panel["before"]["defect_rate"])
    rel_pct = rel / panel["before"]["defect_rate"] * 100 if panel["before"]["defect_rate"] > 0 else 0.0
    panel["absolute_change_pp"] = round(rel * 100, 2)
    panel["relative_change_pct"] = round(rel_pct, 1)

    if group_col:
        per_group = {}
        for g, gdf in df.groupby(group_col):
            gpre, gpost = gdf[gdf["timestamp"] < cut], gdf[gdf["timestamp"] >= cut]
            if len(gpre) >= 10 and len(gpost) >= 10:
                r1, r2 = rate_of(gpre), rate_of(gpost)
                per_group[str(g)] = {
                    "before_rate": round(r1 * 100, 2),
                    "after_rate": round(r2 * 100, 2),
                    "lift": round(r2 / r1, 2) if r1 > 0 else None,
                }
        panel["per_group"] = per_group
    return panel
