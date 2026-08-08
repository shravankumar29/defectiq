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
    """Batch 7-day windows into feature vectors."""
    d = df.copy()
    d["window"] = d["timestamp"].dt.floor(f"{window_days}D")
    rows = []
    for (w, mach, shift), g in d.groupby(["window", "machine_id", "shift"]):
        if len(g) < 10:
            continue
        rows.append({
            "window": str(w.date()),
            "machine_id": mach,
            "shift": shift,
            "defect_rate": g["defect_count"].sum() / g["units_inspected"].sum(),
            "temperature": g["temperature"].mean(),
            "pressure": g["pressure"].mean(),
            "speed": g["speed"].mean(),
            "vibration": g["vibration"].mean(),
            "humidity": g["humidity"].mean(),
            "units": int(g["units_inspected"].sum()),
            "defects": int(g["defect_count"].sum()),
        })
    return pd.DataFrame(rows)


def cluster_kmeans(df, k_range=(3, 5)):
    feat = _build_features(df)
    if len(feat) < 15:
        return None
    X = feat[NUM_FEATURES].to_numpy()
    scaler = StandardScaler()
    Xs = scaler.fit_transform(X)

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
    centroids = km.cluster_centers_

    pca = PCA(n_components=2, random_state=42)
    proj = pca.fit_transform(Xs)
    feat["pc1"] = proj[:, 0]
    feat["pc2"] = proj[:, 1]

    global_means = feat[NUM_FEATURES].mean().to_dict()
    profiles = []
    for c in range(best_k):
        cg = feat[feat["cluster"] == c]
        dr = float(cg["defect_rate"].mean())
        gdr = float(global_means["defect_rate"])
        prof = {
            "cluster_id": int(c),
            "name": None,
            "records": int(len(cg)),
            "avg_defect_rate_pct": round(dr * 100, 2),
            "defect_rate_vs_global": round(dr / gdr, 2) if gdr > 0 else None,
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


def cluster_dbscan(df, eps=0.9, min_samples=5):
    """Secondary anomaly-cluster view."""
    feat = _build_features(df)
    if len(feat) < 15:
        return None
    scaler = StandardScaler()
    Xs = scaler.fit_transform(feat[NUM_FEATURES].to_numpy())
    db = DBSCAN(eps=eps, min_samples=min_samples).fit(Xs)
    labels = db.labels_
    n_noise = int((labels == -1).sum())
    feat["cluster"] = labels
    pca = PCA(n_components=2, random_state=42)
    proj = pca.fit_transform(Xs)
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
