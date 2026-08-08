# Report visual verification notes

Date: 2026-08-08
Source: `/tmp/report.pdf` preview pages 1-5

The PDF report renders successfully with a professional industrial style. The amber correlation-vs-causation disclaimer appears prominently near the top and is visually distinct. The executive summary KPI cards render clearly, and the top detected patterns table is legible.

The report continues across multiple pages with machine analysis, shift analysis, anomalies/change points, and a long recommended-actions section. Recommendation priority colors render, but the recommendations section is too long and dominates later pages, which suggests the final web UI should show a smaller curated set by default and the PDF exporter may need to limit or group recommendations for readability.

Observed strengths:

| Area | Observation |
|---|---|
| Branding | Title and tagline render correctly |
| Disclaimer | Amber banner is clear and prominent |
| KPI section | Values and labels are readable |
| Pattern table | Key fields (ID, defect type, lift, p-value, score) are legible |
| Analysis sections | Machine/shift/anomaly headings render cleanly |

Observed issues to refine later:

| Area | Observation |
|---|---|
| Recommendation list length | Too many rows create a very long appendix-like section |
| Pattern descriptions | Raw factor strings are still technical and should be made more human-readable in UI/export |
| Highest-risk summary | Current synthetic output shows M02 as highest-risk machine overall, while M04 is still the strongest multi-factor pattern; this is analytically acceptable but should be explained in the app narrative |
| Score explanation | PDF should eventually mention the five-signal score composition more explicitly |

Conclusion: PDF generation works and is visually serviceable, but later phases should refine copy formatting and recommendation curation.
