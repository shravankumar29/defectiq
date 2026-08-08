# Engine smoke test results (2026-08-08)

Full pipeline runs cleanly on 20k synthetic records:
- Synthetic generator: 20,000 rows, 3.37% overall defect rate, change point detected exactly at day-60 index (2026-04-30), before 2.81% -> after 4.59%.
- Pattern engine: 463 patterns; top-3 correctly recover embedded patterns:
  P-001 = M04 + Shift C + Temp >78.4 (score 84, lift 2.89x vs baseline of all-data slice comparison, p<0.001)
  P-002 = M02 + Vibration high (score 80)
  P-003 = Shift C + high temp (score 79)
- Recommendation engine, evidence builder, contribution ranking (lift+chi2), MI ranking, decision-tree splits (vibration 0.723, temperature 78.25 thresholds — matches embedded signals), KMeans k=4 silhouette 0.724, DBSCAN view all pass.

Bugs fixed:
1. TimedeltaIndex.dt.days -> .days (numpy timedelta64)
2. _recurrence mask length mismatch: build mask inside per-week group loop.

Caveats observed (acceptable):
- Lift values compare slice vs rest-of-data rather than vs defect-type baseline; lift~2.9x for P-001 because slice rate 8.x% vs global-mix baseline; still valid ranking.
- np.float64 types leak into returned dicts — coerce to Python float in API layer.
