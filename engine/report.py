"""
DefectIQ report export — PDF (weasyprint HTML template) and CSV dumps.
Every report includes the mandatory correlation-vs-causation disclaimer.
"""

import csv
import io
from jinja2 import Environment, Template

DISCLAIMER = (
    "CORRELATION IS NOT CAUSATION: All findings in this report are statistical associations "
    "derived from observational inspection data. No factor listed herein has been shown to cause "
    "defects. This report supports targeted investigation; it does not establish causality. "
    "No worker-level performance assessment is included or implied."
)


def build_csv_export(patterns, recommendations, evidence_map=None):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "pattern_id", "description", "defect_type", "slice_rate_pct", "baseline_rate_pct",
        "lift", "sample_size", "defective_units", "p_value", "association", "confidence",
        "pattern_score", "score_lift", "score_significance", "score_sample_size",
        "score_recurrence", "score_effect_size", "recurrence", "date_range",
        "affected_batches", "finding", "interpretation", "recommendation", "priority",
    ])
    pat_map = {p["pattern_id"]: p for p in patterns}
    ev_map = evidence_map or {}
    for r in recommendations:
        p = pat_map.get(r["pattern_id"], {})
        ev = ev_map.get(r["pattern_id"], {})
        bd = p.get("score_breakdown") or {}
        writer.writerow([
            r["pattern_id"], p.get("description", ""), p.get("defect_type", ""),
            p.get("slice_rate"), p.get("baseline_rate"), p.get("lift"),
            p.get("sample_size"), p.get("defective_units"), p.get("p_display"),
            p.get("association"), p.get("confidence"), p.get("pattern_score"),
            bd.get("lift", ""), bd.get("significance", ""), bd.get("sample_size", ""),
            bd.get("recurrence", ""), bd.get("effect_size", ""),
            p.get("recurrence"),
            " to ".join(p.get("date_range", [])),
            " ".join(p.get("affected_batches", [])),
            ev.get("finding", ""), ev.get("interpretation", ""),
            r["text"], r["priority"],
        ])
    return buf.getvalue()


REPORT_TEMPLATE_STR = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: 'Helvetica', 'DejaVu Sans', sans-serif; color: #1a1f2b; font-size: 10pt; line-height: 1.45; }
  h1 { font-size: 20pt; color: #0f172a; margin: 0 0 2pt; }
  h2 { font-size: 13pt; color: #0f172a; border-bottom: 2px solid #f59e0b; padding-bottom: 3pt; margin-top: 16pt; }
  h3 { font-size: 11pt; color: #334155; margin-top: 10pt; }
  .tagline { color: #64748b; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 8.5pt; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 4pt 5pt; }
  td { border-bottom: 1px solid #e2e8f0; padding: 3pt 5pt; }
  tr:nth-child(even) td { background: #f8fafc; }
  .kpi { display: inline-block; width: 22%; border: 1px solid #e2e8f0; border-radius: 6pt; padding: 6pt 8pt; margin: 4pt 1%; vertical-align: top; }
  .kpi .v { font-size: 15pt; font-weight: bold; color: #0f172a; }
  .kpi .l { font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5pt; }
  .disclaimer { background: #fffbeb; border: 1.5pt solid #f59e0b; border-radius: 6pt; padding: 8pt 10pt; margin: 12pt 0; font-size: 9pt; color: #78350f; }
  .prio { font-weight: bold; }
  .critical { color: #dc2626; } .high { color: #ea580c; } .medium { color: #ca8a04; } .low { color: #16a34a; }
  .meta { color: #64748b; font-size: 8.5pt; margin-top: 4pt; }
</style>
</head>
<body>
  <h1>DefectIQ — Quality Intelligence Report</h1>
  <div class="tagline">"Don't just see the defect. Understand it." &nbsp;·&nbsp; Generated {{ generated_at }}</div>
  <div class="meta">Dataset: {{ kpis.total_inspections | format_number }} inspections · {{ kpis.date_range[0] }} → {{ kpis.date_range[1] }}</div>

  <div class="disclaimer"><strong>Correlation ≠ Causation.</strong> {{ disclaimer }}</div>

  <h2>1. Executive Summary</h2>
  <div>
    {% for k in kpi_blocks %}<span class="kpi"><div class="l">{{ k.label }}</div><div class="v">{{ k.value }}</div></span>{% endfor %}
  </div>
  <p>{{ executive_summary }}</p>

  <h2>2. Detected Patterns (top {{ patterns | length }} by Confidence Score)</h2>
  <table>
    <tr><th>ID</th><th>Pattern</th><th>Defect Type</th><th>Slice Rate</th><th>Baseline</th><th>Lift</th><th>n</th><th>p-value</th><th>Score</th></tr>
    {% for p in patterns %}
    <tr><td>{{ p.pattern_id }}</td><td>{{ p.description }}</td><td>{{ p.defect_type }}</td><td>{{ p.slice_rate }}%</td><td>{{ p.baseline_rate }}%</td><td>{{ p.lift }}×</td><td>{{ p.sample_size | format_number }}</td><td>{{ p.p_display }}</td><td>{{ p.pattern_score }}/100</td></tr>
    {% endfor %}
  </table>

  <h2>3. Machine Analysis</h2>
  <table>
    <tr><th>Machine</th><th>Defect Rate</th></tr>
    {% for m, r in machine_comparison.items() %}
    <tr><td>{{ m }}</td><td>{{ r }}%</td></tr>
    {% endfor %}
  </table>

  <h2>4. Shift Analysis</h2>
  <table>
    <tr><th>Shift</th><th>Defect Rate</th></tr>
    {% for s, r in shift_comparison.items() %}
    <tr><td>{{ s }}</td><td>{{ r }}%</td></tr>
    {% endfor %}
  </table>

  <h2>5. Anomalies / Change Points</h2>
  {% if change_points %}
    {% for cp in change_points %}
    <p><strong>{{ cp.date }}</strong> — {{ cp.direction }} shift detected. Rate before: {{ cp.before_rate | fmt_pct }} · after: {{ cp.after_rate | fmt_pct }}.</p>
    {% endfor %}
  {% else %}
    <p>No sustained change points detected in the analysis window.</p>
  {% endif %}

  <h2>6. Recommended Actions</h2>
  <table>
    <tr><th>Priority</th><th>Recommendation</th></tr>
    {% for r in recommendations %}
    <tr><td class="prio {{ r.priority_key }}">{{ r.priority }}</td><td>{{ r.text }}</td></tr>
    {% endfor %}
  </table>

  <h2>7. Evidence Appendix — Top Findings</h2>
  {% for e in evidence_items %}
    <h3>{{ e.pattern_id }} — {{ e.finding }}</h3>
    <table>
      <tr><td>Score</td><td>{{ e.score }}/100</td><td>Defect rate in slice</td><td>{{ e.evidence.slice_rate }}</td></tr>
      <tr><td>Baseline rate</td><td>{{ e.evidence.baseline_rate }}</td><td>Lift</td><td>{{ e.evidence.lift }}</td></tr>
      <tr><td>Sample size</td><td>{{ e.evidence.sample_size }}</td><td>Test / p-value</td><td>{{ e.evidence.statistical_test }}, p={{ e.evidence.p_value }}</td></tr>
      <tr><td>Confidence</td><td>{{ e.evidence.confidence_label }}</td><td>Date range</td><td>{{ e.evidence.date_range }}</td></tr>
    </table>
    <p><em>Interpretation:</em> {{ e.interpretation }}</p>
  {% endfor %}

  <div class="disclaimer"><strong>Correlation ≠ Causation.</strong> {{ disclaimer }}</div>
</body>
</html>
"""

def _fmt_number(n):
    return f"{n:,}"


def _fmt_pct(v):
    return f"{v * 100:.2f}%"


_report_env = Environment()
_report_env.filters["format_number"] = _fmt_number
_report_env.filters["fmt_pct"] = _fmt_pct

REPORT_TEMPLATE = _report_env.from_string(REPORT_TEMPLATE_STR)


def _render(template: Template, **kwargs):
    from datetime import datetime
    kwargs.setdefault("generated_at", datetime.now().strftime("%Y-%m-%d %H:%M"))
    return template.render(**kwargs)


def build_pdf_html(kpis, patterns, recommendations, change_points, machine_comparison, shift_comparison, evidence_items, executive_summary):
    kpi_blocks = [
        {"label": "Total Inspections", "value": _fmt_number(kpis["total_inspections"])},
        {"label": "Defect Rate", "value": f"{kpis['defect_rate_pct']}%"},
        {"label": "Highest-Risk Machine", "value": f"{kpis['highest_risk_machine']} ({kpis['highest_risk_machine_rate_pct']}%)"},
        {"label": "Highest-Risk Shift", "value": f"{kpis['highest_risk_shift']} ({kpis['highest_risk_shift_rate_pct']}%)"},
    ]
    return _render(
        REPORT_TEMPLATE,
        disclaimer=DISCLAIMER,
        kpis=kpis,
        kpi_blocks=kpi_blocks,
        executive_summary=executive_summary,
        patterns=patterns[:15],
        recommendations=recommendations,
        change_points=change_points or [],
        machine_comparison=machine_comparison,
        shift_comparison=shift_comparison,
        evidence_items=evidence_items[:8],
    )


def render_pdf_bytes(html: str) -> bytes:
    from weasyprint import HTML
    return HTML(string=html).write_pdf()


def exec_summary_from_context(kpis, patterns, change_points, recommendations):
    top = patterns[0] if patterns else None
    cp = change_points[0] if change_points else None
    parts = [
        f"Across {kpis['total_inspections']:,} inspections ({kpis['date_range'][0]} to {kpis['date_range'][1]}), "
        f"the plant-wide defect rate was {kpis['defect_rate_pct']}%.",
    ]
    if top:
        parts.append(
            f"The strongest statistically significant pattern (score {top['pattern_score']}/100) associates "
            f"{top['description']} with a {top['slice_rate']}% defect rate versus a {top['baseline_rate']}% baseline "
            f"(lift {top['lift']}x, n={top['sample_size']:,}, p={top['p_display']})."
        )
    if cp:
        parts.append(
            f"A sustained rate shift was detected starting {cp['date']}, with the defect rate moving from "
            f"{cp['before_rate']*100:.2f}% to {cp['after_rate']*100:.2f}%."
        )
    if recommendations:
        parts.append(
            f"The system recommends {len(recommendations)} prioritized process checks, led by a "
            f"{recommendations[0]['priority'].lower()}-priority action."
        )
    parts.append("All findings are statistical associations; no causal claims are made.")
    return " ".join(parts)
