"""Smoke test for the DefectIQ engine: generate data and run the full pipeline."""

import sys
sys.path.insert(0, "/home/ubuntu/defectiq")

from engine.synthetic_generator import generate_inspections, validate_and_clean
from engine.trends import compute_daily_trend, cusum_detection, before_after_panel
from engine.pattern_engine import mine_patterns
from engine.contribution import contribution_ranking, mutual_information_ranking, decision_tree_splits
from engine.clustering import cluster_kmeans, cluster_dbscan
from engine.recommendations import generate_recommendations
from engine.evidence import build_evidence

df = generate_inspections(n_records=20000)
df = validate_and_clean(df)
print(f"rows={len(df)} rate={df.defect_count.sum()/df.units_inspected.sum():.4f}")

trend = compute_daily_trend(df)
cp, series = cusum_detection(trend)
print("change_point:", cp)
if cp:
    panel = before_after_panel(df, cp["date"], group_col="machine_id")
    print("before/after:", panel["before"]["defect_rate"], "->", panel["after"]["defect_rate"])
    print("per_group sample:", list(panel["per_group"].items())[:3])

patterns = mine_patterns(df)
print(f"patterns={len(patterns)} top3: {[(p['pattern_id'], p['pattern_score'], p['description'], p['lift'], p['p_display']) for p in patterns[:3]]}")

recs = generate_recommendations(patterns)
print(f"recommendations={len(recs)} top: {recs[0]['priority']}")
ev = build_evidence(patterns[0])
print("evidence finding:", ev["finding"][:100])

cr = contribution_ranking(df, "Surface")
print(f"contribution rows={len(cr['factors'])} top: {cr['factors'][:2]}")
mi = mutual_information_ranking(df, "Surface")
print("MI top:", mi[:2])
dt = decision_tree_splits(df, "Surface")
print("tree splits:", dt["top_splits"][:2])

km = cluster_kmeans(df)
print(f"kmeans k={km['best_k']} sils={km['silhouette_scores']} profiles={[(p['name'], p['avg_defect_rate_pct']) for p in km['profiles']]}")
db = cluster_dbscan(df)
print(f"dbscan clusters={db['n_clusters']} outliers={db['n_outliers']}")
