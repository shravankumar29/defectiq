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
    d = df.copy()
    date_min, date_max = d["timestamp"].min(), d["timestamp"].max()
    span_days = int((date_max - date_min).days) + 1 if pd.notnull(date_min) and pd.notnull(date_max) else 1

    if span_days > 180:
        d["date"] = d["timestamp"].dt.to_period("M").astype(str)
    elif span_days >= 30:
        d["date"] = d["timestamp"].dt.to_period("W").astype(str)
    else:
        d["date"] = d["timestamp"].dt.date.astype(str)

    agg = d.groupby("date", sort=True).agg(
        units=("units_inspected", "sum"),
        defects=("defect_count", "sum"),
    ).reset_index()
    agg["defect_rate"] = agg["defects"] / agg["units"].replace(0, 1)

    r = agg["defect_rate"].to_numpy()
    n = len(r)
    ema = ewma(r) if n > 0 else np.array([])

    z = np.full(n, 0.0)
    b_win = max(2, min(baseline_window_days, max(2, n // 2)))
    for i in range(b_win, n):
        win = r[max(0, i - b_win) : i]
        mu, sd = win.mean(), win.std(ddof=1) if len(win) > 1 else 0.0
        if sd > 0:
            z[i] = (r[i] - mu) / sd

    series = agg.copy()
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
    b_win = max(2, min(baseline_window_days, max(2, n // 2)))
    if n < b_win + 1:
        series_out = series.copy()
        series_out["cusum_pos"] = 0.0
        series_out["cusum_neg"] = 0.0
        series_out["cusum_flag"] = 0
        series_out["z_score"] = 0.0
        return None, series_out

    # baseline stats from trailing window at each point (causal, online)
    plus, minus = np.zeros(n), np.zeros(n)
    zvals = np.full(n, np.nan)
    for i in range(b_win, n):
        win = r[max(0, i - b_win) : i]
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


def generate_trend_interpretation(series: pd.DataFrame, cp: dict, df: pd.DataFrame) -> str:
    if series.empty:
        return "Insufficient data for trend interpretation."

    r = series["defect_rate"].to_numpy()
    n = len(r)
    if n < 2:
        return "Inspection volume is uniform across the observation window."

    half = max(1, n // 2)
    first_half_avg = r[:half].mean()
    second_half_avg = r[half:].mean()

    dates = series["date"].tolist()
    max_idx = int(np.argmax(r))
    peak_date = dates[max_idx]
    peak_rate = r[max_idx] * 100

    if cp is not None:
        return (
            f"A change-point was detected on {cp['date']} (CUSUM shift score {cp['cusum_value']:.1f}). "
            f"Defect rate shifted from {cp['before_rate']*100:.2f}% prior to {cp['after_rate']*100:.2f}% following the shift. "
            f"The peak defect rate of {peak_rate:.2f}% occurred on {peak_date}."
        )

    if second_half_avg > first_half_avg * 1.15:
        return (
            f"Defect rates increased during the latter portion of the observation window (second-half average {second_half_avg*100:.2f}% vs first-half average {first_half_avg*100:.2f}%). "
            f"The peak defect rate of {peak_rate:.2f}% occurred on {peak_date}."
        )
    elif first_half_avg > second_half_avg * 1.15:
        return (
            f"Defect rates decreased over the observation window (first-half average {first_half_avg*100:.2f}% vs second-half average {second_half_avg*100:.2f}%). "
            f"The highest historical defect rate of {peak_rate:.2f}% occurred on {peak_date}."
        )
    else:
        return (
            f"Defect rates remained stable across the observation window (average {r.mean()*100:.2f}%). "
            f"Minor variation peaked at {peak_rate:.2f}% on {peak_date}."
        )

