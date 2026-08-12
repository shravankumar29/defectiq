"""
DefectIQ API bridge — runs the Python engine via a small FastAPI server
and exposes results as JSON for the Node/Express tRPC layer.

The analysis state (dataset, computed results) is cached in this process so
the ~20k-row pipeline runs only once per dataset change.
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
from engine.trends import compute_daily_trend, cusum_detection, before_after_panel, generate_trend_interpretation
from engine.pattern_engine import mine_patterns
from engine.contribution import contribution_ranking, mutual_information_ranking, decision_tree_splits, _get_shared_investigation_features
from engine.clustering import cluster_both
from engine.recommendations import generate_recommendations
from engine.evidence import build_evidence
from engine.overview import (kpi_cards, pareto_top5, machine_shift_heatmap,
                             machine_trends, shift_trends, machine_defect_breakdown,
                             shift_defect_heatmap, batch_table, defect_type_analysis,
                             machine_analysis_details, shift_analysis_details,
                             process_parameter_analysis)
from engine.copilot import build_analysis_context, ask_copilot
from engine.report import (build_pdf_html, render_pdf_bytes, build_csv_export,
                           exec_summary_from_context)
from engine.schema_mapper import analyze_schema, normalize_dataframe

_state = {
    "df": None,
    "raw_df": None,
    "results": None,
    "patterns_result": None,
    "clustering_result": None,
    "investigation_cache": {},
    "busy": False,
    "error": None,
    "dataset_source": "demo",
    "filename": "Synthetic Demo Dataset",
    "lock": threading.Lock(),
}

def perf_log(name, t0):
    t = int((time.time() - t0) * 1000)
    print(f"[PERF] {name}: {t} ms")
    return time.time()

def compute_core(df):
    t0 = time.time()
    kpis = kpi_cards(df)
    t0 = perf_log("KPI", t0)

    trend = compute_daily_trend(df)
    t0 = perf_log("daily trend", t0)
    
    cp, series = cusum_detection(trend)
    t0 = perf_log("CUSUM", t0)
    
    change_points = [cp] if cp else []
    ba = before_after_panel(df, cp["date"], group_col="machine_id") if cp else None
    t0 = perf_log("before_after", t0)
    
    t_interp = generate_trend_interpretation(series, cp, df)

    dt_analysis = defect_type_analysis(df)
    t0 = perf_log("defect analysis", t0)
    
    mach_analysis = machine_analysis_details(df)
    t0 = perf_log("machine analysis", t0)
    
    sh_analysis = shift_analysis_details(df)
    t0 = perf_log("shift analysis", t0)
    
    param_analysis = process_parameter_analysis(df)
    t0 = perf_log("parameter analysis", t0)

    # Dynamic Executive Summary
    n_rec = kpis["total_inspections"]
    dt_min, dt_max = kpis["date_range"][0], kpis["date_range"][1]
    ov_rate = kpis["defect_rate_pct"]
    hrm = mach_analysis.get("highest_risk_machine")
    hrs = sh_analysis.get("highest_risk_shift")
    dom_dt = dt_analysis.get("dominant_defect_type", "unclassified")

    m_label = str(hrm['machine_id']) if hrm and str(hrm['machine_id']).lower().startswith("machine") else (f"Machine {hrm['machine_id']}" if hrm else "")
    s_label = str(hrs['shift']) if hrs and str(hrs['shift']).lower().startswith("shift") else (f"Shift {hrs['shift']}" if hrs else "")

    hrm_str = f"{m_label} recorded the highest machine defect rate at {hrm['defect_rate_pct']:.2f}%" if hrm else "Machine defect rates were balanced"
    hrs_str = f"{s_label} recorded the highest shift defect rate at {hrs['defect_rate_pct']:.2f}%" if hrs else "Shift defect rates were balanced"

    assoc_str = "Advanced pattern mining will process multi-factor associations in the background."

    active_p = [p for p in param_analysis.values() if p.get("has_data")]
    if active_p:
        best_p = max(active_p, key=lambda x: x.get("lift", 1.0))
        param_str = f"Elevated {best_p['parameter']} (>{best_p['threshold_q90']}) was associated with a {best_p['high_threshold_rate_pct']:.2f}% defect rate ({best_p['lift']:.2f}x lift)."
    else:
        param_str = "Process parameter sensor data was unpopulated in the dataset."

    exec_summary = (
        f"Across {n_rec:,} inspections from {dt_min} to {dt_max}, the overall defect rate was {ov_rate:.2f}%. "
        f"{hrm_str}, while {hrs_str}. {assoc_str} "
        f"{dom_dt.capitalize()} was the dominant defect category. {param_str}"
    )

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

    data_quality = df.attrs.get("data_quality") if hasattr(df, "attrs") else None

    defect_types = sorted(df["defect_type"].value_counts().index.tolist())
    t0 = perf_log("serialization (core)", t0)
    
    return {
        "dataset_source": _state.get("dataset_source", "demo"),
        "filename": _state.get("filename", "Synthetic Demo Dataset"),
        "is_demo": _state.get("dataset_source", "demo") == "demo",
        "data_quality": data_quality,
        "kpis": kpis,
        "overview": overview,
        "trend_series": series_out.to_dict("records"),
        "trend_interpretation": t_interp,
        "executive_summary": exec_summary,
        "defect_type_analysis": dt_analysis,
        "machine_analysis": mach_analysis,
        "shift_analysis": sh_analysis,
        "process_parameter_analysis": param_analysis,
        "change_points": change_points,
        "before_after": ba,
        "defect_types": defect_types,
    }


def run_analysis(df=None, generate=False):
    """Run (or re-run) the full pipeline. Thread-safe."""
    with _state["lock"]:
        if df is not None:
            _state["df"] = df
            _state["results"] = None
            _state["patterns_result"] = None
            _state["clustering_result"] = None
            _state["investigation_cache"] = {}
            
        if _state["results"] is None and _state["df"] is not None:
            _state["busy"] = True
            try:
                t0 = time.time()
                _state["results"] = compute_core(_state["df"])
                perf_log("TOTAL TO DASHBOARD", t0)
                _state["error"] = None
            except Exception as exc:  # noqa
                _state["error"] = str(exc)
                raise
            finally:
                _state["busy"] = False
        return _state["results"]


def get_patterns_lazy():
    with _state["lock"]:
        if _state["patterns_result"] is not None:
            return _state["patterns_result"]
        
        df = _state["df"]
        if df is None:
            raise ValueError("No dataset loaded.")
        
        t0 = time.time()
        df_ml = df.sample(n=25000, random_state=42) if len(df) > 25000 else df
        
        patterns = mine_patterns(df_ml)
        t0 = perf_log("pattern mining", t0)
        
        single_signals = [p for p in patterns if len(p.get("factors", [])) == 1]
        multi_patterns = [p for p in patterns if len(p.get("factors", [])) >= 2]
        
        recs = generate_recommendations(patterns)
        t0 = perf_log("recommendations", t0)
        
        evidence = {p["pattern_id"]: build_evidence(p, r)
                    for p, r in zip(patterns, [next((x for x in recs if x["pattern_id"] == p["pattern_id"]), None) for p in patterns])}
        evidence = {str(pid): e for pid, e in evidence.items()
                    if e is not None and pid is not None and str(pid).strip() not in ("", "nan", "None", "null")}
        t0 = perf_log("evidence", t0)
        
        _state["patterns_result"] = _sanitize({
            "patterns": patterns[:60],
            "single_factor_signals": single_signals[:30],
            "multi_factor_patterns": multi_patterns[:30],
            "recommendations": recs,
            "evidence": evidence
        })
        return _state["patterns_result"]


def get_clustering_lazy():
    with _state["lock"]:
        if _state["clustering_result"] is not None:
            return _state["clustering_result"]
        
        df = _state["df"]
        if df is None:
            raise ValueError("No dataset loaded.")
        
        t0 = time.time()
        df_ml = df.sample(n=25000, random_state=42) if len(df) > 25000 else df
        
        km, db = cluster_both(df_ml)
        t0 = perf_log("Clustering Pipeline", t0)
        
        _state["clustering_result"] = _sanitize({
            "clustering_kmeans": km,
            "clustering_dbscan": db
        })
        return _state["clustering_result"]


def get_investigation_lazy(defect_type: str):
    with _state["lock"]:
        if defect_type in _state["investigation_cache"]:
            return _state["investigation_cache"][defect_type]
            
        df = _state["df"]
        if df is None:
            raise ValueError("No dataset loaded.")
            
        t0 = time.time()
        df_ml = df.sample(n=25000, random_state=42) if len(df) > 25000 else df
        
        contrib = contribution_ranking(df_ml, defect_type)
        t0 = perf_log(f"contribution [{defect_type}]", t0)
        
        precomputed_X = _get_shared_investigation_features(df_ml)
        
        mi = mutual_information_ranking(df_ml, defect_type, precomputed_X=precomputed_X)
        t0 = perf_log(f"mutual information [{defect_type}]", t0)
        
        dtree = decision_tree_splits(df_ml, defect_type, precomputed_X=precomputed_X)
        t0 = perf_log(f"decision tree [{defect_type}]", t0)
        
        result = _sanitize({
            "contribution": contrib,
            "mutual_information": mi,
            "decision_tree": dtree
        })
        _state["investigation_cache"][defect_type] = result
        return result


def load_synthetic(n=20000, seed=42):
    _state["dataset_source"] = "demo"
    _state["filename"] = "Synthetic Demo Dataset"
    df = generate_inspections(n_records=n, seed=seed)
    df = validate_and_clean(df)
    run_analysis(df=df)
    return {
        "rows": len(df),
        "defect_rate_pct": _state["results"]["kpis"]["defect_rate_pct"],
        "date_range": _state["results"]["kpis"]["date_range"],
        "dataset_source": "demo",
        "filename": "Synthetic Demo Dataset",
    }


def _parse_raw_upload(base64_csv: str):
    import pandas as pd
    from io import BytesIO
    import base64
    try:
        t0 = time.time()
        if "," in base64_csv:
            base64_csv = base64_csv.split(",", 1)[1]
        
        base64_csv += "=" * ((4 - len(base64_csv) % 4) % 4)
        raw = base64.b64decode(base64_csv)
        s = raw.decode("utf-8", errors="replace")
        
        if s.lstrip()[:4] in ("PK\x03\x04",):
            xls = pd.ExcelFile(BytesIO(raw))
            df = pd.concat(pd.read_excel(f) for f in xls.sheet_names)
        else:
            try:
                df = pd.read_csv(BytesIO(raw))
            except UnicodeDecodeError:
                df = pd.read_csv(BytesIO(raw), encoding="latin1")
        perf_log("Parsing Upload", t0)
    except Exception as exc:
        raise ValueError(f"Could not parse the uploaded file: {exc}")
    if df is None or len(df) == 0:
        raise ValueError("Uploaded file contains no data rows.")
    return df


def preview_uploaded(base64_csv: str) -> dict:
    """Pre-analyzes uploaded CSV/XLSX to discover columns and map schema."""
    df = _parse_raw_upload(base64_csv)
    _state["raw_df"] = df
    schema_info = analyze_schema(df)
    return schema_info


def confirm_uploaded(base64_csv: str, user_mappings: dict, filename: str = "Uploaded Dataset") -> dict:
    """Applies confirmed mappings, normalizes DataFrame, and executes analytics."""
    if _state["raw_df"] is not None:
        df = _state["raw_df"]
    else:
        df = _parse_raw_upload(base64_csv)
        
    _state["raw_df"] = None # clear cache after use
    normalized_df = normalize_dataframe(df, user_mappings)
    cleaned_df = validate_and_clean(normalized_df)
    if len(cleaned_df) == 0:
        raise ValueError("No valid inspection records remain after normalization.")
    _state["dataset_source"] = "uploaded"
    _state["filename"] = filename
    run_analysis(df=cleaned_df)
    return {
        "rows": len(cleaned_df),
        "defect_rate_pct": _state["results"]["kpis"]["defect_rate_pct"],
        "date_range": _state["results"]["kpis"]["date_range"],
        "dataset_source": "uploaded",
        "filename": filename,
    }


def load_uploaded(base64_csv: str, filename: str = "Uploaded Dataset") -> dict:
    """Legacy auto-upload endpoint: auto-maps and normalizes directly."""
    df = _parse_raw_upload(base64_csv)
    analysis = analyze_schema(df)
    auto_mappings = {
        item["original_column"]: item["mapped_field"]
        for item in analysis["column_mappings"]
        if item["mapped_field"] is not None
    }
    _state["raw_df"] = df
    return confirm_uploaded(base64_csv, auto_mappings, filename=filename)


def _sanitize(o):
    """Recursively replace float nan/inf with None so JSON serialization
    never raises 'Out of range float values are not JSON compliant'."""
    import math
    import numpy as np
    if isinstance(o, (float, np.floating)):
        if math.isnan(o) or math.isinf(o):
            return None
        return float(o)
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
    
    pat_res = _state.get("patterns_result", {})
    
    ctx = build_analysis_context(
        overview=results["overview"],
        patterns=pat_res.get("patterns", []) if pat_res else [],
        change_points=results.get("change_points", []),
        recommendations=pat_res.get("recommendations", []) if pat_res else [],
        defect_types=results.get("defect_types", []),
        kpis=results["kpis"],
        machine_analysis=results.get("machine_analysis"),
        shift_analysis=results.get("shift_analysis"),
    )
    return ask_copilot(question, ctx)


def generate_report_pdf() -> bytes:
    results = get_results()
    if results is None:
        raise ValueError("No dataset loaded")
        
    pat_res = get_patterns_lazy()
    
    return render_pdf_bytes(
        kpis=results["kpis"],
        patterns=pat_res.get("patterns", []),
        recommendations=pat_res.get("recommendations", []),
        change_points=results.get("change_points"),
        machine_comparison=results["kpis"].get("machine_comparison"),
        shift_comparison=results["kpis"].get("shift_comparison"),
        evidence_items=list(pat_res.get("evidence", {}).values())[:8],
        executive_summary=results.get("executive_summary"),
        defect_type_analysis=results.get("defect_type_analysis"),
        machine_analysis=results.get("machine_analysis"),
        shift_analysis=results.get("shift_analysis"),
        process_parameter_analysis=results.get("process_parameter_analysis"),
        single_factor_signals=pat_res.get("single_factor_signals"),
        multi_factor_patterns=pat_res.get("multi_factor_patterns"),
        trend_series=results.get("trend_series"),
        trend_interpretation=results.get("trend_interpretation"),
        filename=_state.get("filename", "Uploaded Dataset"),
        dataset_source=_state.get("dataset_source", "uploaded")
    )


def generate_report_csv() -> str:
    results = get_results()
    if results is None:
        raise ValueError("No dataset loaded")
    pat_res = get_patterns_lazy()
    return build_csv_export(pat_res.get("patterns", []), pat_res.get("recommendations", []), pat_res.get("evidence", {}))


def get_state_summary():
    if _state["df"] is None:
        return {"loaded": False}
    r = _state["results"]
    return {
        "loaded": True,
        "rows": len(_state["df"]),
        "busy": _state["busy"],
        "error": _state.get("error"),
        "defect_rate_pct": r["kpis"]["defect_rate_pct"] if r else None,
        "dataset_source": _state.get("dataset_source", "demo"),
        "filename": _state.get("filename", "Synthetic Demo Dataset"),
        "is_demo": _state.get("dataset_source", "demo") == "demo",
    }
