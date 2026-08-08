"""
DefectIQ API bridge — runs the Python engine via a small FastAPI server
and exposes results as JSON for the Node/Express tRPC layer.

The analysis state (dataset, computed results) is cached in this process so
the ~20k-row pipeline (pattern mining is the heavy part) runs only once per
dataset change.
"""

import base64
import io
import json
import os
import sys
import time
import threading

# Engine imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.synthetic_generator import generate_inspections, validate_and_clean
from engine.trends import compute_daily_trend, cusum_detection, before_after_panel
from engine.pattern_engine import mine_patterns
from engine.contribution import contribution_ranking, mutual_information_ranking, decision_tree_splits
from engine.clustering import cluster_kmeans, cluster_dbscan
from engine.recommendations import generate_recommendations
from engine.evidence import build_evidence
from engine.overview import (kpi_cards, pareto_top5, machine_shift_heatmap,
                             machine_trends, shift_trends, machine_defect_breakdown,
                             shift_defect_heatmap, batch_table)
from engine.copilot import build_analysis_context, ask_copilot
from engine.report import (build_pdf_html, render_pdf_bytes, build_csv_export,
                           exec_summary_from_context)

_state = {
    "df": None,
    "results": None,
    "busy": False,
    "error": None,
    "lock": threading.Lock(),
}


def _compute_all(df):
    kpis = kpi_cards(df)

    trend = compute_daily_trend(df)
    cp, series = cusum_detection(trend)
    change_points = [cp] if cp else []
    ba = before_after_panel(df, cp["date"], group_col="machine_id") if cp else None

    patterns = mine_patterns(df)
    recs = generate_recommendations(patterns)
    evidence = {p["pattern_id"]: build_evidence(p, r)
                for p, r in zip(patterns, [next((x for x in recs if x["pattern_id"] == p["pattern_id"]), None) for p in patterns])}
    evidence = {str(pid): e for pid, e in evidence.items()
                if e is not None and pid is not None and str(pid).strip() not in ("", "nan", "None", "null")}

    defect_types = sorted(df["defect_type"].value_counts().index.tolist())
    contrib = {dt: contribution_ranking(df, dt) for dt in defect_types}
    mi = {dt: mutual_information_ranking(df, dt) for dt in defect_types}
    dtree = {dt: decision_tree_splits(df, dt) for dt in defect_types}

    km = cluster_kmeans(df)
    db = cluster_dbscan(df)

    overview = {
        "kpis": kpis,
        "pareto": pareto_top5(df),
        "heatmap": machine_shift_heatmap(df),
        "machine_trends": machine_trends(df),
        "shift_trends": shift_trends(df),
        "machine_breakdown": machine_defect_breakdown(df),
        "shift_breakdown": shift_defect_heatmap(df),
        "batch": batch_table(df),
    }
    series_out = series.copy()
    series_out["date"] = series_out["date"].astype(str)
    series_out["defect_rate_pct"] = (series_out["defect_rate"] * 100).round(3)

    return {
        "kpis": kpis,
        "overview": overview,
        "trend_series": series_out.to_dict("records"),
        "change_points": change_points,
        "before_after": ba,
        "patterns": patterns[:60],
        "recommendations": recs,
        "evidence": evidence,
        "contribution": contrib,
        "mutual_information": mi,
        "decision_tree": dtree,
        "clustering_kmeans": km,
        "clustering_dbscan": db,
        "defect_types": defect_types,
    }


def run_analysis(df=None, generate=False):
    """Run (or re-run) the full pipeline. Thread-safe."""
    with _state["lock"]:
        if df is not None:
            _state["df"] = df
            _state["results"] = None
        if _state["results"] is None and _state["df"] is not None:
            _state["busy"] = True
            try:
                _state["results"] = _compute_all(_state["df"])
                _state["error"] = None
            except Exception as exc:  # noqa
                _state["error"] = str(exc)
                raise
            finally:
                _state["busy"] = False
        return _state["results"]


def load_synthetic(n=20000, seed=42):
    df = generate_inspections(n_records=n, seed=seed)
    df = validate_and_clean(df)
    run_analysis(df=df)
    return {"rows": len(df), "defect_rate_pct": _state["results"]["kpis"]["defect_rate_pct"],
            "date_range": _state["results"]["kpis"]["date_range"]}


def load_uploaded(base64_csv: str) -> dict:
    raw = base64.b64decode(base64_csv)
    import pandas as pd
    from io import BytesIO
    s = raw.decode("utf-8", errors="replace")
    try:
        if s.lstrip()[:4] in ("PK\x03\x04",):
            xls = pd.ExcelFile(BytesIO(raw))
            df = pd.concat(pd.read_excel(f) for f in xls.sheet_names)
        else:
            df = pd.read_csv(BytesIO(raw))
    except Exception as exc:
        raise ValueError(f"Could not parse the uploaded file: {exc}")
    required = {"timestamp", "machine_id", "shift", "batch_id", "defect_type",
                "units_inspected", "defect_count"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Uploaded file is missing required columns: {', '.join(sorted(missing))}. "
            f"Required: {', '.join(sorted(required))}.")
    bad = (df["units_inspected"].le(0).any() or df["defect_count"].lt(0).any()
           or pd.isna(df["defect_count"]).any())
    if bad:
        raise ValueError(
            "Uploaded file contains invalid values: units_inspected must be >0 and "
            "defect_count must be >=0 for every row.")
    df = validate_and_clean(df)
    if len(df) == 0:
        raise ValueError("Uploaded file contains no valid inspection records after cleaning.")
    run_analysis(df=df)
    return {"rows": len(df), "defect_rate_pct": _state["results"]["kpis"]["defect_rate_pct"],
            "date_range": _state["results"]["kpis"]["date_range"]}


def _sanitize(o):
    """Recursively replace float nan/inf with None so JSON serialization
    never raises 'Out of range float values are not JSON compliant'."""
    import math
    if isinstance(o, float):
        if math.isnan(o) or math.isinf(o):
            return None
        return o
    if isinstance(o, dict):
        return {k: _sanitize(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_sanitize(v) for v in o]
    return o


def get_results():
    if _state["results"] is None:
        return None
    return _sanitize(_state["results"])


def get_copilot_answer(question: str) -> dict:
    results = get_results()
    if results is None:
        return {"answer": "No dataset loaded — generate or upload inspection data first.",
                "sources_used": False}
    ctx = build_analysis_context(
        overview=results["overview"],
        patterns=results["patterns"],
        change_points=results["change_points"],
        recommendations=results["recommendations"],
        defect_types=results["defect_types"],
        kpis=results["kpis"],
    )
    return ask_copilot(question, ctx)


def generate_report_pdf() -> bytes:
    results = get_results()
    if results is None:
        raise ValueError("No dataset loaded")
    html = build_pdf_html(
        kpis=results["kpis"],
        patterns=results["patterns"],
        recommendations=results["recommendations"],
        change_points=results["change_points"],
        machine_comparison=results["kpis"]["machine_comparison"],
        shift_comparison=results["kpis"]["shift_comparison"],
        evidence_items=list(results["evidence"].values())[:8],
        executive_summary=exec_summary_from_context(
            results["kpis"], results["patterns"], results["change_points"],
            results["recommendations"]),
    )
    return render_pdf_bytes(html)


def generate_report_csv() -> str:
    results = get_results()
    if results is None:
        raise ValueError("No dataset loaded")
    return build_csv_export(results["patterns"], results["recommendations"], results["evidence"])


def get_state_summary():
    if _state["df"] is None:
        return {"loaded": False}
    r = _state["results"]
    return {
        "loaded": True,
        "rows": len(_state["df"]),
        "busy": _state["busy"],
        "defect_rate_pct": r["kpis"]["defect_rate_pct"] if r else None,
    }
