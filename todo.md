# DefectIQ Project TODO

## Data & Analytics Engine (Python backend)
- [x] Synthetic data generator (~20,000 records, 90 days, 5 machines, 3 shifts, ~40 batches, 4-5 defect types)
- [x] Embedded Pattern A: M04 + Shift C + Temp > 78°C → Surface defects (~4× baseline)
- [x] Embedded Pattern B: M02 + High Vibration (>90th pct) → Dimensional defects (~2.5-3×)
- [x] Embedded Pattern C: Batches B15-B18 → Contamination (bad lot)
- [x] Embedded Pattern D: plant-wide step-change at day 60, amplified on M04
- [x] CSV/Excel upload with schema validation
- [x] Trend analysis: rolling mean, EWMA
- [x] Change detection: rolling z-score + CUSUM with exact change-point date
- [x] Multi-factor combinatorial pattern mining (depth 1-3, min n=30, parameter bucketing)
- [x] Chi-square significance (scipy) with p-values per pattern
- [x] Pattern Confidence Score = 0.30 lift + 0.25 significance + 0.20 sample size + 0.15 recurrence + 0.10 effect size (0-100)
- [x] Contribution/root-cause ranking: lift + chi-square + mutual information + decision tree (max_depth=3)
- [x] KMeans clustering (k via silhouette 3-5) + PCA 2D scatter + cluster profile cards
- [x] DBSCAN secondary anomaly view
- [x] Evidence builder (slice rate, baseline, lift, n, defective count, window, batches, test + p, confidence label)
- [x] Rule-based recommendation engine with priority tiers (Critical/High/Medium/Low) — never "caused"
- [x] AI copilot grounded in precomputed JSON (LLM narrates only, never computes, causal-language prompt)

## Backend API (Express/tRPC)
- [x] Analysis pipeline as pure Python modules, cache results in-process
- [x] tRPC routes: dataset status, generate synthetic, upload CSV, overview, trends, machines, shifts, batches, patterns, change points, contribution, clustering, copilot chat, report data
- [x] CSV export of patterns/evidence
- [x] PDF report generation (weasyprint/HTML template) with disclaimer

## Frontend Pages
- [x] Industrial theme (slate/charcoal, amber alert accent, severity colors) in index.css
- [x] DashboardLayout sidebar nav (10 sections)
- [x] Executive Overview: KPI cards, 30-day sparkline, top-5 Pareto
- [x] Pattern Discovery: sortable/filterable table, Confidence Score, evidence click-through
- [x] Machine Analysis: comparison bars, per-machine trends, defect breakdown, risk scores
- [x] Shift Analysis: comparison, machine×shift heatmap, trend lines
- [x] Batch Analysis: batch defect-rate table, flagged ranges
- [x] Defect Investigation: select defect type → ranked factor table, evidence, recommendations
- [x] Anomaly Detection: CUSUM control chart, change-point markers, before/after panel
- [x] Clustering: PCA scatter, cluster profile cards, DBSCAN view toggle
- [x] AI Copilot: grounded chat with suggested question chips + Sources footer + causal banner
- [x] Reports: preview + PDF/CSV export
- [x] EvidencePanel component (Finding / Evidence / Interpretation / Recommended investigation)
- [x] CorrelationCausationBanner component (amber, persistent, on every finding/AI answer)
- [x] PatternCard, RecommendationCard, KPICard reusable components

## Quality
- [x] Vitest tests for engine relay routes
- [x] Python unit tests for pattern engine, change detection, contribution (smoke suite)
- [x] Visual verification via screenshots
## Cinematic Landing Page
- [x] DefectIQScene reusable placeholder component (large, full-width, parallax/scroll-interactive props, replaceable later)
- [x] Landing theme: near-black bg, white text, subtle cyan/blue/violet accents, thin glowing outlines, particle layer
- [x] Minimal floating nav: DEFECTIQ left, Product/Intelligence/Data/How It Works center, Import Data right
- [x] Full-screen hero: layered typography (eyebrow, "Manufacturing Data. Decoded.", supporting line), Import CSV/Excel primary, Analyze Demo secondary, "CSV + XLSX supported"
- [x] Problem section: "Factories Generate More Data Than They Can Interpret."
- [x] Intelligence section: "Find The Patterns Humans Miss." + MACHINE+SHIFT+BATCH+PROCESS → DEFECT PATTERN flow
- [x] Pattern insight overlay: M04 + Shift C + Temp >78°C / Surface Defects / 8.4% defect rate / 4.0× baseline
- [x] Evidence section: "Evidence Before Assumptions." + stats + "Association detected. Causation is not established."
- [x] Action section: "Turn Patterns Into Action." with recommended investigations
- [x] AI Copilot floating interaction: question + grounded answer integrated in environment
- [x] Final CTA: "Your Factory Data Already Contains The Clues." + buttons
- [x] Upload dialog: drag-drop CSV/XLSX, Browse Files, Use Demo Dataset, DATASET READY stats, Analyze Dataset
- [x] Scroll-driven scene behavior (placeholder responds to scroll position via props)
- [x] Responsive: desktop immersive, tablet depth, mobile simplified
- [x] Route: landing at "/" (public), app at /app (dashboard behind analysis gating)
- [x] Visual verification + checkpoint
