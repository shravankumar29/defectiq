"""
DefectIQ contribution / root-cause ranking.

For a selected defect type: ranked factor table with lift + chi-square
(scipy) + mutual information + shallow decision-tree cross-check (max_depth=3).
"""

import re
import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency
from sklearn.feature_selection import mutual_info_classif
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder

from .pattern_engine import _bucket_columns, _slice_mask, WEIGHTS, _norm_lift, _norm_significance, _norm_sample, _norm_effect


LIFT_HIGH, LIFT_MOD = 3.0, 1.5
P_SIG, P_HIGH = 0.05, 0.01


def _factor_group(name):
    if name == "machine_id":
        return "Machine"
    if name == "shift":
        return "Shift"
    if name == "batch_id":
        return "Batch"
    if name.endswith("_bucket"):
        return name[:-7].title()
    return name.title()


def contribution_ranking(df, defect_type, min_sample=30):
    global_rate = df["defect_count"].sum() / df["units_inspected"].sum()
    target = df[df["defect_type"] == defect_type]
    target_units = int(target["units_inspected"].sum())
    target_def = int(target["defect_count"].sum())

    rows = []
    for col in _bucket_columns(df):
        vals = df[col].unique()
        if len(vals) > 40:
            continue  # too granular for per-category lift (e.g. inspection id)
        for v in vals:
            mask = (df[col].astype(str) == str(v)).to_numpy()
            n = int(mask.sum())
            if n < min_sample:
                continue
            g = df[mask]
            tg = g[g["defect_type"] == defect_type]
            r_in = tg["defect_count"].sum() / tg["units_inspected"].sum() if tg["units_inspected"].sum() > 0 else 0.0
            r_out = (target_units - int(tg["units_inspected"].sum()))
            r_out = (target_def - int(tg["defect_count"].sum())) / r_out if r_out > 0 else global_rate
            lift = r_in / r_out if r_out > 0 else None
            if lift is None or lift < 1.0:
                continue
            def_in = int(tg["defect_count"].sum())
            tot_in = int(tg["units_inspected"].sum())
            def_out = target_def - def_in
            tot_out = target_units - tot_in
            if min(def_in, tot_in - def_in, def_out, tot_out) < 1:
                continue
            chi2, p, _, _ = chi2_contingency([[def_in, tot_in - def_in], [def_out, tot_out]], correction=True)
            assoc = "High" if (lift >= LIFT_HIGH and p < P_HIGH) else (
                "Moderate" if (lift >= LIFT_MOD and p < P_SIG) else "Low")
            rows.append({
                "factor": _factor_group(col),
                "factor_value": str(v),
                "association": assoc,
                "defect_rate_in": round(r_in * 100, 2),
                "baseline_rate": round(r_out * 100, 2),
                "lift": round(lift, 2),
                "sample_size": n,
                "p_value": round(float(p), 4),
                "p_display": "<0.001" if p < 0.001 else f"{p:.3f}",
            })

    rows.sort(key=lambda r: (-r["lift"], r["p_value"]))
    return {
        "defect_type": defect_type,
        "baseline_rate": round(global_rate * 100, 2),
        "target_units": target_units,
        "target_defects": target_def,
        "target_rate": round(target_def / target_units * 100, 2),
        "factors": rows[:25],
    }


def mutual_information_ranking(df, defect_type):
    """Aggregate MI between factor columns and defect/no-defect for the type."""
    d = df.copy()
    if len(d) < 2:
        return []
    d["is_target"] = (d["defect_type"] == defect_type).astype(int)
    feat_cols = ["machine_id", "shift", "batch_id"]
    buckets = [c for c in d.columns if c.endswith("_bucket")]
    feat_cols += [c[:-7] for c in buckets]  # use raw param columns for MI
    feat_cols = [c for c in feat_cols if c in d.columns]

    enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    X = enc.fit_transform(d[feat_cols].astype(str))
    y = d["is_target"].to_numpy()
    mi = mutual_info_classif(X, y, random_state=42)
    order = np.argsort(-mi)
    out = []
    for idx in order:
        out.append({"factor": feat_cols[idx], "mutual_information": round(float(mi[idx]), 4)})
    return out


def decision_tree_splits(df, defect_type, max_depth=3):
    """Shallow decision tree as a cross-check; returns top splits with normalized importances (summing to ~100%)."""
    d = df.copy()
    if len(d) < 2:
        return {
            "max_depth": max_depth,
            "tree_features": [],
            "feature_importances_pct": {},
            "top_splits": [],
        }
    d["is_defective"] = (d["defect_count"] > 0).astype(int)
    d["is_target"] = (d["defect_type"] == defect_type).astype(int)

    enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    cats = ["machine_id", "shift", "batch_id"]
    num = ["temperature", "pressure", "speed", "vibration", "humidity"]
    X_cat = enc.fit_transform(d[cats].astype(str))
    X_num = d[num].fillna(d[num].median()).to_numpy()
    X = np.hstack([X_cat, X_num])
    y = d["is_target"].to_numpy()

    tree = DecisionTreeClassifier(max_depth=max_depth, min_samples_leaf=50, random_state=42)
    tree.fit(X, y)

    features = cats + num
    node_map = {int(i): name for i, name in enumerate(features)}
    
    # Calculate Gini gain per split node
    total_samples = tree.tree_.weighted_n_node_samples[0]
    raw_gains = []
    
    def walk(node):
        left, right = tree.tree_.children_left[node], tree.tree_.children_right[node]
        if left == -1:
            return
        feat = int(tree.tree_.feature[node])
        thr = float(tree.tree_.threshold[node])
        
        n_node = tree.tree_.weighted_n_node_samples[node]
        imp_node = tree.tree_.impurity[node]
        n_left = tree.tree_.weighted_n_node_samples[left]
        imp_left = tree.tree_.impurity[left]
        n_right = tree.tree_.weighted_n_node_samples[right]
        imp_right = tree.tree_.impurity[right]
        
        gain = (n_node * imp_node - n_left * imp_left - n_right * imp_right) / total_samples
        raw_gains.append({
            "node": node,
            "feature": node_map[feat],
            "threshold": round(thr, 3),
            "gain": max(0.0, float(gain))
        })
        walk(left)
        walk(right)

    walk(0)
    total_gain = sum(g["gain"] for g in raw_gains) if raw_gains else 1.0
    if total_gain <= 0:
        total_gain = 1.0

    splits = []
    for g in raw_gains:
        importance_pct = round((g["gain"] / total_gain) * 100, 1)
        splits.append({
            "feature": g["feature"],
            "threshold": g["threshold"],
            "importance": round(g["gain"] / total_gain, 4), # normalized float 0..1
            "importance_pct": importance_pct # normalized percentage 0..100%
        })

    splits.sort(key=lambda s: -s["importance"])

    # Global feature importances normalized to 100%
    feature_importances = {
        feat: round(float(imp) * 100, 1)
        for feat, imp in zip(features, tree.feature_importances_)
    }

    return {
        "max_depth": max_depth,
        "tree_features": features,
        "feature_importances_pct": feature_importances,
        "top_splits": splits[:6],
    }
