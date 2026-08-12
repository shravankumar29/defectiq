"""
DefectIQ clustering: KMeans on scaled numeric process features with PCA 2D
visualization, cluster profile cards, and a DBSCAN anomaly view.
"""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score


NUM_FEATURES = ["defect_rate", "temperature", "pressure", "speed", "vibration", "humidity"]


def _build_features(df, window_days=7):
    """Batch 7-day windows or machine/shift groups into feature vectors."""
    window = df["timestamp"].dt.floor(f"{window_days}D")
    min_g = 1 if len(df) < 50 else 5
    rows = []
    
    # Precompute defect rate, etc by grouping
    g_agg = df.groupby([window, "machine_id", "shift"]).agg(
        units_inspected=("units_inspected", "sum"),
        defect_count=("defect_count", "sum"),
        temperature=("temperature", "mean") if "temperature" in df.columns else ("units_inspected", lambda x: 25.0),
        pressure=("pressure", "mean") if "pressure" in df.columns else ("units_inspected", lambda x: 1.0),
        speed=("speed", "mean") if "speed" in df.columns else ("units_inspected", lambda x: 100.0),
        vibration=("vibration", "mean") if "vibration" in df.columns else ("units_inspected", lambda x: 0.5),
        humidity=("humidity", "mean") if "humidity" in df.columns else ("units_inspected", lambda x: 50.0),
        count=("units_inspected", "size")
    ).reset_index()
    
    # Filter small groups
    g_agg = g_agg[g_agg["count"] >= min_g].copy()
    
    g_agg["defect_rate"] = g_agg["defect_count"] / g_agg["units_inspected"].clip(lower=1)
    g_agg["window"] = g_agg["timestamp"].dt.date.astype(str)
    
    # Ensure columns match expected
    g_agg = g_agg.rename(columns={"units_inspected": "units", "defect_count": "defects"})
    
    return g_agg


def _get_shared_features(df):
    """Helper to return feature matrix and PCA projection so we can share it."""
    feat = _build_features(df)
    if len(feat) < 3:
        return None, None, None, None
    X = feat[NUM_FEATURES].to_numpy()
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)
    
    pca = PCA(n_components=2, random_state=42)
    proj = pca.fit_transform(Xs)
    feat["pc1"] = proj[:, 0]
    feat["pc2"] = proj[:, 1]
    
    return feat, Xs, proj, pca


def cluster_kmeans(df=None, precomputed=None, k_range=(3, 5)):
    if precomputed is not None:
        feat, Xs, proj, pca = precomputed
    else:
        res = _get_shared_features(df)
        if res[0] is None:
            return None
        feat, Xs, proj, pca = res

    best_k, best_sil = 3, -1
    sils = {}
    for k in range(k_range[0], k_range[1] + 1):
        if k >= len(feat):
            continue
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        labels = km.fit_predict(Xs)
        s = silhouette_score(Xs, labels)
        sils[k] = round(float(s), 3)
        if s > best_sil:
            best_sil, best_k = s, k

    km = KMeans(n_clusters=best_k, n_init=10, random_state=42)
    labels = km.fit_predict(Xs)
    feat["cluster"] = labels

    global_means = feat[NUM_FEATURES].mean().to_dict()
    profiles = []
    for c in range(best_k):
        cg = feat[feat["cluster"] == c]
        if len(cg) == 0:
            continue
        dr = float(cg["defect_rate"].mean())
        gdr = float(global_means["defect_rate"])
        prof = {
            "cluster_id": int(c),
            "name": None,
            "records": int(len(cg)),
            "avg_defect_rate_pct": round(dr * 100, 2),
            "defect_rate_vs_global": round((dr - gdr) * 100, 2),
            "defect_rate_vs_global_pp": round((dr - gdr) * 100, 2),
            "defect_rate_vs_global_ratio": round(dr / gdr, 2) if gdr > 0 else None,
            "machines": sorted(cg["machine_id"].value_counts().head(2).index.tolist()),
            "shifts": sorted(cg["shift"].value_counts().head(2).index.tolist()),
            "params": {k: round(float(cg[k].mean()), 1) for k in NUM_FEATURES[1:]},
            "param_means": {k: round(float(cg[k].mean()), 1) for k in NUM_FEATURES[1:]},
        }
        labels_list = ["Stable Operation", "Elevated Defects", "High-Parameter Regime",
                       "Anomalous Conditions", "Mixed"]
        prof["name"] = labels_list[c % len(labels_list)]
        if dr > 1.5 * gdr:
            prof["name"] = "Hot & Defective"
        elif dr < 0.7 * gdr:
            prof["name"] = "Stable Operation"
        profiles.append(prof)

    points = []
    for _, r in feat.iterrows():
        points.append({
            "window": r["window"],
            "machine_id": r["machine_id"],
            "shift": r["shift"],
            "pc1": round(float(r["pc1"]), 3),
            "pc2": round(float(r["pc2"]), 3),
            "cluster": int(r["cluster"]),
            "defect_rate_pct": round(float(r["defect_rate"]) * 100, 2),
            "variance_explained": [round(float(v) * 100, 1) for v in pca.explained_variance_ratio_],
        })

    return {
        "best_k": int(best_k),
        "silhouette_scores": sils,
        "profiles": profiles,
        "points": points,
    }


def cluster_dbscan(df=None, precomputed=None, eps=0.9, min_samples=5):
    """Secondary anomaly-cluster view."""
    if precomputed is not None:
        feat, Xs, proj, pca = precomputed
        if feat is None or len(feat) < 15:
            return None
    else:
        res = _get_shared_features(df)
        if res[0] is None or len(res[0]) < 15:
            return None
        feat, Xs, proj, pca = res
        
    db = DBSCAN(eps=eps, min_samples=min_samples).fit(Xs)
    labels = db.labels_
    n_noise = int((labels == -1).sum())
    feat["cluster"] = labels
    
    points = []
    for i, (_, r) in enumerate(feat.iterrows()):
        points.append({
            "window": r["window"],
            "machine_id": r["machine_id"],
            "shift": r["shift"],
            "pc1": round(float(proj[i, 0]), 3),
            "pc2": round(float(proj[i, 1]), 3),
            "cluster": int(labels[i]),
            "defect_rate_pct": round(float(r["defect_rate"]) * 100, 2),
        })
    return {
        "n_clusters": int(len(set(labels)) - (1 if -1 in labels else 0)),
        "n_outliers": n_noise,
        "eps": eps,
        "points": points,
    }

def cluster_both(df):
    """Helper to run both clustering models sharing the same feature matrix."""
    precomputed = _get_shared_features(df)
    if precomputed[0] is None:
        return None, None
    km = cluster_kmeans(precomputed=precomputed)
    db = cluster_dbscan(precomputed=precomputed)
    return km, db
