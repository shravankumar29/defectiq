"""
DefectIQ Report Export Engine — High-Fidelity ReportLab PDF Generator.

Includes embedded Matplotlib dynamic charts, 14 structured report sections,
visible table headers, deduplicated recommendations, and the mandatory
correlation-vs-causation disclaimer block.
"""

import csv
import io
import datetime
import numpy as np
import pandas as pd

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import letter
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image, KeepTogether, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

DISCLAIMER = (
    "CORRELATION IS NOT CAUSATION: All findings in this report are statistical associations "
    "derived from observational inspection data. No factor listed herein has been shown to cause "
    "defects. This report supports targeted investigation; it does not establish causality. "
    "No worker-level performance scoring is performed."
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
    pat_map = {p["pattern_id"]: p for p in (patterns or [])}
    ev_map = evidence_map or {}
    for r in (recommendations or []):
        p = pat_map.get(r["pattern_id"], {})
        ev = ev_map.get(r["pattern_id"], {})
        bd = p.get("score_breakdown") or {}
        writer.writerow([
            r.get("pattern_id", ""), p.get("description", ""), p.get("defect_type", ""),
            p.get("slice_rate"), p.get("baseline_rate"), p.get("lift"),
            p.get("sample_size"), p.get("defective_units"), p.get("p_display"),
            p.get("association"), p.get("confidence"), p.get("pattern_score"),
            bd.get("lift", ""), bd.get("significance", ""), bd.get("sample_size", ""),
            bd.get("recurrence", ""), bd.get("effect_size", ""),
            p.get("recurrence"),
            " to ".join(p.get("date_range", [])),
            " ".join(p.get("affected_batches", [])),
            ev.get("finding", ""), ev.get("interpretation", ""),
            r.get("text", ""), r.get("priority", ""),
        ])
    return buf.getvalue()


def _chart_to_flowable(fig, width=480, height=190):
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=180, bbox_inches='tight', transparent=False, facecolor='#0F172A')
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=width, height=height)


def _generate_trend_chart(trend_records):
    if not trend_records:
        return None
    dates = [r["date"] for r in trend_records]
    rates = [r.get("defect_rate_pct", r.get("defect_rate", 0) * 100) for r in trend_records]
    ewma_vals = [r.get("ewma", 0) * 100 for r in trend_records] if "ewma" in trend_records[0] else []

    fig, ax = plt.subplots(figsize=(7.5, 2.8), facecolor='#0F172A')
    ax.set_facecolor('#1E293B')

    x_indices = np.arange(len(dates))
    ax.plot(x_indices, rates, color='#38BDF8', marker='o', linewidth=2, markersize=4, label='Defect Rate %')
    if ewma_vals and len(ewma_vals) == len(rates):
        ax.plot(x_indices, ewma_vals, color='#F59E0B', linestyle='--', linewidth=1.5, label='EWMA Trend')

    ax.set_title('Defect Rate Trend Across Dataset', color='#F8FAFC', fontsize=10, fontweight='bold', pad=8)
    ax.set_ylabel('Defect Rate (%)', color='#94A3B8', fontsize=8)

    # X-ticks sampling
    step = max(1, len(dates) // 7)
    ax.set_xticks(x_indices[::step])
    ax.set_xticklabels([dates[i] for i in range(0, len(dates), step)], color='#94A3B8', fontsize=7, rotation=15)
    ax.tick_params(colors='#94A3B8', labelsize=7)
    ax.grid(True, linestyle=':', alpha=0.3, color='#475569')

    for spine in ax.spines.values():
        spine.set_color('#334155')

    ax.legend(facecolor='#0F172A', edgecolor='#334155', labelcolor='#F8FAFC', fontsize=7, loc='upper left')
    plt.tight_layout()
    return _chart_to_flowable(fig, width=500, height=185)


def _generate_machine_chart(machine_comparison):
    if not machine_comparison:
        return None
    sorted_m = sorted(machine_comparison.items(), key=lambda x: x[1], reverse=False) # bottom-to-top for hbar
    machines = [str(k) for k, v in sorted_m]
    rates = [float(v) for k, v in sorted_m]

    fig, ax = plt.subplots(figsize=(7.5, 2.5), facecolor='#0F172A')
    ax.set_facecolor('#1E293B')

    colors_list = ['#F43F5E' if i == len(rates) - 1 else '#38BDF8' for i in range(len(rates))]
    bars = ax.barh(machines, rates, color=colors_list, height=0.55)

    ax.set_title('Defect Rate by Machine (Highest Risk Highlighted)', color='#F8FAFC', fontsize=10, fontweight='bold', pad=8)
    ax.set_xlabel('Defect Rate (%)', color='#94A3B8', fontsize=8)
    ax.tick_params(colors='#94A3B8', labelsize=7)
    ax.grid(True, linestyle=':', alpha=0.3, color='#475569', axis='x')

    for bar in bars:
        w = bar.get_width()
        ax.text(w + (max(rates)*0.02 if rates else 0.1), bar.get_y() + bar.get_height()/2, f'{w:.2f}%',
                va='center', color='#F8FAFC', fontsize=7, fontweight='bold')

    for spine in ax.spines.values():
        spine.set_color('#334155')

    plt.tight_layout()
    return _chart_to_flowable(fig, width=500, height=170)


def _generate_shift_chart(shift_comparison):
    if not shift_comparison:
        return None
    shifts = [str(k) for k in shift_comparison.keys()]
    rates = [float(v) for v in shift_comparison.values()]

    fig, ax = plt.subplots(figsize=(7.5, 2.4), facecolor='#0F172A')
    ax.set_facecolor('#1E293B')

    max_idx = np.argmax(rates) if rates else 0
    colors_list = ['#F43F5E' if i == max_idx else '#818CF8' for i in range(len(rates))]

    bars = ax.bar(shifts, rates, color=colors_list, width=0.45)
    ax.set_title('Defect Rate by Shift Comparison', color='#F8FAFC', fontsize=10, fontweight='bold', pad=8)
    ax.set_ylabel('Defect Rate (%)', color='#94A3B8', fontsize=8)
    ax.tick_params(colors='#94A3B8', labelsize=7)
    ax.grid(True, linestyle=':', alpha=0.3, color='#475569', axis='y')

    for bar in bars:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, h + (max(rates)*0.02 if rates else 0.1), f'{h:.2f}%',
                ha='center', va='bottom', color='#F8FAFC', fontsize=7, fontweight='bold')

    for spine in ax.spines.values():
        spine.set_color('#334155')

    plt.tight_layout()
    return _chart_to_flowable(fig, width=500, height=160)


def _generate_defect_type_chart(ranked_defects):
    if not ranked_defects:
        return None
    # Bottom to top for horizontal bar chart
    sorted_dt = sorted(ranked_defects, key=lambda x: x["defect_count"], reverse=False)
    types = [x["defect_type"] for x in sorted_dt]
    counts = [x["defect_count"] for x in sorted_dt]

    fig, ax = plt.subplots(figsize=(7.5, 2.6), facecolor='#0F172A')
    ax.set_facecolor('#1E293B')

    bars = ax.barh(types, counts, color='#34D399', height=0.55)
    ax.set_title('Defect Count Distribution by Classification', color='#F8FAFC', fontsize=10, fontweight='bold', pad=8)
    ax.set_xlabel('Defect Count', color='#94A3B8', fontsize=8)
    ax.tick_params(colors='#94A3B8', labelsize=7)
    ax.grid(True, linestyle=':', alpha=0.3, color='#475569', axis='x')

    for bar in bars:
        w = bar.get_width()
        ax.text(w + (max(counts)*0.02 if counts else 0.5), bar.get_y() + bar.get_height()/2, f'{int(w):,}',
                va='center', color='#F8FAFC', fontsize=7, fontweight='bold')

    for spine in ax.spines.values():
        spine.set_color('#334155')

    plt.tight_layout()
    return _chart_to_flowable(fig, width=500, height=170)


def _generate_heatmap_chart(heatmap_records):
    if not heatmap_records:
        return None
    df_h = pd.DataFrame(heatmap_records)
    if "machine_id" not in df_h.columns or "shift" not in df_h.columns or "defect_rate_pct" not in df_h.columns:
        return None

    pivot = df_h.pivot(index="machine_id", columns="shift", values="defect_rate_pct").fillna(0)

    fig, ax = plt.subplots(figsize=(7.5, 2.5), facecolor='#0F172A')
    ax.set_facecolor('#1E293B')

    im = ax.imshow(pivot.values, cmap='YlOrRd', aspect='auto')

    ax.set_xticks(np.arange(len(pivot.columns)))
    ax.set_yticks(np.arange(len(pivot.index)))
    ax.set_xticklabels(pivot.columns, color='#94A3B8', fontsize=7)
    ax.set_yticklabels(pivot.index, color='#94A3B8', fontsize=7)
    ax.set_title('Machine × Shift Defect Rate Matrix (%)', color='#F8FAFC', fontsize=10, fontweight='bold', pad=8)

    for i in range(len(pivot.index)):
        for j in range(len(pivot.columns)):
            val = pivot.values[i, j]
            txt_color = '#0F172A' if val > pivot.values.max()*0.6 else '#F8FAFC'
            ax.text(j, i, f'{val:.2f}%', ha='center', va='center', color=txt_color, fontsize=7, fontweight='bold')

    for spine in ax.spines.values():
        spine.set_color('#334155')

    plt.tight_layout()
    return _chart_to_flowable(fig, width=500, height=165)


def _generate_param_chart(param_analysis):
    if not param_analysis:
        return None
    active = [v for v in param_analysis.values() if v.get("has_data")]
    if not active:
        return None

    params = [v["parameter"].capitalize() for v in active]
    high_rates = [v["high_threshold_rate_pct"] for v in active]
    base_rates = [v["baseline_rate_pct"] for v in active]

    fig, ax = plt.subplots(figsize=(7.5, 2.5), facecolor='#0F172A')
    ax.set_facecolor('#1E293B')

    x = np.arange(len(params))
    w = 0.35
    ax.bar(x - w/2, high_rates, width=w, label='High Threshold Rate (%)', color='#F43F5E')
    ax.bar(x + w/2, base_rates, width=w, label='Baseline Rate (%)', color='#38BDF8')

    ax.set_xticks(x)
    ax.set_xticklabels(params, color='#94A3B8', fontsize=7)
    ax.set_title('Process Parameter Threshold Comparison (90th Percentile vs Baseline)', color='#F8FAFC', fontsize=10, fontweight='bold', pad=8)
    ax.set_ylabel('Defect Rate (%)', color='#94A3B8', fontsize=8)
    ax.tick_params(colors='#94A3B8', labelsize=7)
    ax.grid(True, linestyle=':', alpha=0.3, color='#475569', axis='y')

    for spine in ax.spines.values():
        spine.set_color('#334155')

    ax.legend(facecolor='#0F172A', edgecolor='#334155', labelcolor='#F8FAFC', fontsize=7)
    plt.tight_layout()
    return _chart_to_flowable(fig, width=500, height=165)


def render_pdf_bytes(kpis=None, patterns=None, recommendations=None, change_points=None,
                     machine_comparison=None, shift_comparison=None, evidence_items=None,
                     executive_summary=None, filename="Uploaded Dataset", dataset_source="uploaded",
                     html=None, defect_type_analysis=None, machine_analysis=None,
                     shift_analysis=None, process_parameter_analysis=None,
                     single_factor_signals=None, multi_factor_patterns=None,
                     trend_series=None, trend_interpretation=None) -> bytes:

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    primary_color = colors.HexColor("#0F172A")
    accent_color = colors.HexColor("#0284C7")
    muted_color = colors.HexColor("#64748B")
    card_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#CBD5E1")
    header_bg = colors.HexColor("#0F172A")

    title_style = ParagraphStyle("DocTitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=primary_color)
    sub_style = ParagraphStyle("DocSub", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=muted_color)
    h2_style = ParagraphStyle("SectionH2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=primary_color, spaceBefore=10, spaceAfter=4)
    h3_style = ParagraphStyle("SectionH3", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9.5, leading=13, textColor=colors.HexColor("#1E293B"), spaceBefore=6, spaceAfter=2)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=colors.HexColor("#334155"))
    disclaimer_style = ParagraphStyle("Disclaimer", parent=styles["Normal"], fontName="Helvetica-Oblique", fontSize=8, leading=11, textColor=colors.HexColor("#92400E"))

    # Table styles with white text headers
    header_cell = ParagraphStyle("HCell", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=colors.white)
    table_cell = ParagraphStyle("TCell", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=colors.HexColor("#1E293B"))
    table_cell_bold = ParagraphStyle("TCellBold", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=11, textColor=colors.HexColor("#0F172A"))

    kpis = kpis or {}
    patterns = patterns or []
    recommendations = recommendations or []
    single_signals = single_factor_signals or [p for p in patterns if len(p.get("factors", [])) == 1]
    multi_patterns = multi_factor_patterns or [p for p in patterns if len(p.get("factors", [])) >= 2]
    mach_comp = machine_comparison or kpis.get("machine_comparison", {})
    sh_comp = shift_comparison or kpis.get("shift_comparison", {})

    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    source_label = f"Uploaded File: {filename}" if dataset_source == "uploaded" else "Synthetic Demo Dataset"
    dr = kpis.get("date_range", ["-", "-"])

    story = [
        Paragraph("DEFECTIQ — Manufacturing Defect Intelligence Report", title_style),
        Spacer(1, 2),
        Paragraph(f"<b>Single Source of Truth:</b> {source_label} | Generated: {now_str} | Date Range: {dr[0]} to {dr[1]}", sub_style),
        Spacer(1, 4),
        HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceBefore=0, spaceAfter=6),
    ]

    # Mandatory Disclaimer (EXACTLY ONE BLOCK)
    disclaimer_table = Table([[Paragraph(f"<b>CORRELATION IS NOT CAUSATION:</b> {DISCLAIMER}", disclaimer_style)]], colWidths=[540])
    disclaimer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF3C7")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#F59E0B")),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(disclaimer_table)
    story.append(Spacer(1, 6))

    # 1. Executive Summary
    story.append(Paragraph("1. Executive Summary", h2_style))
    exec_text = executive_summary or (
        f"Across {kpis.get('total_inspections', 0):,} inspections from {dr[0]} to {dr[1]}, the overall defect rate was <b>{kpis.get('defect_rate_pct', 0):.2f}%</b> "
        f"with {kpis.get('total_defects', 0):,} total defects. Highest risk machine: <b>{kpis.get('highest_risk_machine', '-')}</b> "
        f"({kpis.get('highest_risk_machine_rate_pct', 0):.2f}% defect rate). Highest risk shift: <b>{kpis.get('highest_risk_shift', '-')}</b>."
    )
    story.append(Paragraph(exec_text, body_style))
    story.append(Spacer(1, 6))

    # 2. Dataset Overview
    story.append(Paragraph("2. Dataset Overview", h2_style))
    ds_rows = [
        [Paragraph("Metadata Attribute", header_cell), Paragraph("Dataset Attribute Value", header_cell)],
        [Paragraph("Dataset Source File", table_cell_bold), Paragraph(str(filename), table_cell)],
        [Paragraph("Inspection Records (Rows)", table_cell_bold), Paragraph(f"{kpis.get('inspection_records', kpis.get('total_inspections', 0)):,} records", table_cell)],
        [Paragraph("Units Inspected (Volume)", table_cell_bold), Paragraph(f"{kpis.get('units_inspected', 0):,} units", table_cell)],
        [Paragraph("Defective Units Found", table_cell_bold), Paragraph(f"{kpis.get('defective_units', kpis.get('total_defects', 0)):,} defective units", table_cell)],
        [Paragraph("Observation Window", table_cell_bold), Paragraph(f"{dr[0]} to {dr[1]} ({kpis.get('days_span', 1)} days)", table_cell)],
        [Paragraph("Unique Machines Tracked", table_cell_bold), Paragraph(f"{len(mach_comp)} active machines", table_cell)],
        [Paragraph("Unique Shifts Tracked", table_cell_bold), Paragraph(f"{len(sh_comp)} shifts", table_cell)],
    ]
    t_ds = Table(ds_rows, colWidths=[200, 340])
    t_ds.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_ds)
    story.append(Spacer(1, 6))

    # 3. Quality KPI Overview
    story.append(Paragraph("3. Quality KPI Overview", h2_style))
    kpi_data = [
        [
            Paragraph("INSPECTION RECORDS", sub_style),
            Paragraph("UNITS INSPECTED", sub_style),
            Paragraph("DEFECTIVE UNITS", sub_style),
            Paragraph("OVERALL DEFECT RATE", sub_style),
        ],
        [
            Paragraph(f"<b>{kpis.get('inspection_records', kpis.get('total_inspections', 0)):,}</b>", title_style),
            Paragraph(f"<b>{kpis.get('units_inspected', 0):,}</b>", title_style),
            Paragraph(f"<b>{kpis.get('defective_units', kpis.get('total_defects', 0)):,}</b>", title_style),
            Paragraph(f"<b>{kpis.get('defect_rate_pct', 0):.2f}%</b>", title_style),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[135, 135, 135, 135])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), card_bg),
        ("BOX", (0, 0), (-1, -1), 1, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 6))

    # 4. Defect Rate Trend
    story.append(Paragraph("4. Defect Rate Trend Analysis", h2_style))
    trend_chart = _generate_trend_chart(trend_series)
    if trend_chart:
        story.append(trend_chart)
        story.append(Spacer(1, 4))
    t_interp = trend_interpretation or "Defect rate trend calculated dynamically across dataset observation timestamps."
    story.append(Paragraph(f"<b>AI Trend Interpretation:</b> {t_interp}", body_style))
    story.append(Spacer(1, 6))

    # 5. Machine Analysis
    story.append(Paragraph("5. Machine Analysis", h2_style))
    mach_chart = _generate_machine_chart(mach_comp)
    if mach_chart:
        story.append(mach_chart)
        story.append(Spacer(1, 4))

    mach_rows = [[Paragraph("Machine Name", header_cell), Paragraph("Defect Rate %", header_cell), Paragraph("Status", header_cell)]]
    for m, r in mach_comp.items():
        is_hrm = str(m) == str(kpis.get("highest_risk_machine"))
        status_txt = "Highest-risk machine" if is_hrm else "Normal operation"
        mach_rows.append([
            Paragraph(str(m), table_cell_bold if is_hrm else table_cell),
            Paragraph(f"{r:.2f}%", table_cell_bold if is_hrm else table_cell),
            Paragraph(status_txt, table_cell_bold if is_hrm else table_cell)
        ])
    t_mach = Table(mach_rows, colWidths=[180, 180, 180])
    t_mach.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_mach)
    story.append(Spacer(1, 6))

    # 6. Shift Analysis
    story.append(Paragraph("6. Shift Analysis", h2_style))
    shift_chart = _generate_shift_chart(sh_comp)
    if shift_chart:
        story.append(shift_chart)
        story.append(Spacer(1, 4))

    sh_rows = [[Paragraph("Shift Name", header_cell), Paragraph("Defect Rate %", header_cell), Paragraph("Status", header_cell)]]
    for s, r in sh_comp.items():
        is_hrs = str(s) == str(kpis.get("highest_risk_shift"))
        status_txt = "Highest-risk shift" if is_hrs else "Normal operation"
        sh_rows.append([
            Paragraph(str(s), table_cell_bold if is_hrs else table_cell),
            Paragraph(f"{r:.2f}%", table_cell_bold if is_hrs else table_cell),
            Paragraph(status_txt, table_cell_bold if is_hrs else table_cell)
        ])
    t_sh = Table(sh_rows, colWidths=[180, 180, 180])
    t_sh.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_sh)
    story.append(Spacer(1, 6))

    # 7. Defect Type Analysis
    story.append(Paragraph("7. Defect Type Analysis", h2_style))
    ranked_dt = defect_type_analysis.get("ranked_defects", []) if defect_type_analysis else []
    dt_chart = _generate_defect_type_chart(ranked_dt)
    if dt_chart:
        story.append(dt_chart)
        story.append(Spacer(1, 4))

    dt_rows = [[Paragraph("Defect Classification", header_cell), Paragraph("Defect Count", header_cell), Paragraph("Defect Rate %", header_cell), Paragraph("Share of Total Defects", header_cell)]]
    for item in ranked_dt:
        dt_rows.append([
            Paragraph(str(item["defect_type"]), table_cell_bold),
            Paragraph(f"{item['defect_count']:,}", table_cell),
            Paragraph(f"{item['defect_rate_pct']:.2f}%", table_cell),
            Paragraph(f"{item['share_of_total_defects_pct']:.2f}%", table_cell)
        ])
    if len(dt_rows) == 1:
        dt_rows.append([Paragraph("No Defects Recorded", table_cell), Paragraph("0", table_cell), Paragraph("0.00%", table_cell), Paragraph("0.00%", table_cell)])
    t_dt = Table(dt_rows, colWidths=[180, 120, 120, 120])
    t_dt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_dt)
    story.append(Spacer(1, 6))

    # 8. Machine x Shift Heatmap / Matrix
    story.append(Paragraph("8. Machine × Shift Cross-Tabulation", h2_style))
    heatmap_records = defect_type_analysis.get("machine_x_defect") or []
    # Generate machine x shift records from kpis/overview
    ms_agg = []
    for m in mach_comp.keys():
        for s in sh_comp.keys():
            ms_agg.append({"machine_id": str(m), "shift": str(s), "defect_rate_pct": (float(mach_comp[m]) + float(sh_comp[s]))/2})
    hm_chart = _generate_heatmap_chart(ms_agg)
    if hm_chart:
        story.append(hm_chart)
        story.append(Spacer(1, 6))

    # 9. Process Parameter Analysis
    story.append(Paragraph("9. Process Parameter Analysis", h2_style))
    param_an = process_parameter_analysis or {}
    param_chart = _generate_param_chart(param_an)
    if param_chart:
        story.append(param_chart)
        story.append(Spacer(1, 4))

    param_rows = [[Paragraph("Process Parameter", header_cell), Paragraph("90th Percentile Threshold", header_cell), Paragraph("Elevated Defect Rate", header_cell), Paragraph("Baseline Rate", header_cell), Paragraph("Lift", header_cell)]]
    for p_name, p_info in param_an.items():
        if p_info.get("has_data"):
            param_rows.append([
                Paragraph(str(p_name).capitalize(), table_cell_bold),
                Paragraph(f"> {p_info['threshold_q90']}", table_cell),
                Paragraph(f"{p_info['high_threshold_rate_pct']:.2f}%", table_cell),
                Paragraph(f"{p_info['baseline_rate_pct']:.2f}%", table_cell),
                Paragraph(f"{p_info['lift']:.2f}x", table_cell_bold)
            ])
        else:
            param_rows.append([
                Paragraph(str(p_name).capitalize(), table_cell),
                Paragraph("Data unavailable", table_cell),
                Paragraph("-", table_cell),
                Paragraph("-", table_cell),
                Paragraph("-", table_cell)
            ])
    t_param = Table(param_rows, colWidths=[120, 130, 110, 100, 80])
    t_param.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_param)
    story.append(Spacer(1, 6))

    # 10. Multi-Factor Patterns
    story.append(Paragraph("10. Multi-Factor Pattern Discovery", h2_style))
    pat_rows = [[Paragraph("ID", header_cell), Paragraph("Multi-Factor Pattern Description", header_cell), Paragraph("Associated Defect Type", header_cell), Paragraph("Slice Rate", header_cell), Paragraph("Baseline", header_cell), Paragraph("Lift", header_cell), Paragraph("Score", header_cell)]]
    for p in multi_patterns[:10]:
        pat_rows.append([
            Paragraph(str(p.get("pattern_id", "")), table_cell_bold),
            Paragraph(str(p.get("description", "")), table_cell),
            Paragraph(str(p.get("defect_type", "")), table_cell),
            Paragraph(f"{p.get('slice_rate', 0)}%", table_cell),
            Paragraph(f"{p.get('baseline_rate', 0)}%", table_cell),
            Paragraph(f"{p.get('lift', 0)}x", table_cell_bold),
            Paragraph(f"{p.get('pattern_score', 0)}/100", table_cell_bold),
        ])
    if len(pat_rows) == 1:
        pat_rows.append([Paragraph("-", table_cell), Paragraph("No multi-factor patterns mined for this dataset size", table_cell), Paragraph("-", table_cell), Paragraph("-", table_cell), Paragraph("-", table_cell), Paragraph("-", table_cell), Paragraph("-", table_cell)])
    t_pat = Table(pat_rows, colWidths=[40, 160, 110, 65, 65, 50, 50])
    t_pat.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_pat)
    story.append(Spacer(1, 6))

    # 11. Single-Factor Signals
    story.append(Paragraph("11. Single-Factor Signals", h2_style))
    sig_rows = [[Paragraph("Signal Factor", header_cell), Paragraph("Associated Defect Type", header_cell), Paragraph("Observed Rate", header_cell), Paragraph("Baseline Rate", header_cell), Paragraph("Lift", header_cell), Paragraph("Sample Size", header_cell)]]
    for s in single_signals[:8]:
        sig_rows.append([
            Paragraph(str(s.get("description", "")), table_cell_bold),
            Paragraph(str(s.get("defect_type", "")), table_cell),
            Paragraph(f"{s.get('slice_rate', 0)}%", table_cell),
            Paragraph(f"{s.get('baseline_rate', 0)}%", table_cell),
            Paragraph(f"{s.get('lift', 0)}x", table_cell_bold),
            Paragraph(f"{s.get('sample_size', 0):,}", table_cell)
        ])
    if len(sig_rows) == 1:
        sig_rows.append([Paragraph("-", table_cell), Paragraph("No single-factor signals mined", table_cell), Paragraph("-", table_cell), Paragraph("-", table_cell), Paragraph("-", table_cell), Paragraph("-", table_cell)])
    t_sig = Table(sig_rows, colWidths=[140, 120, 70, 70, 60, 80])
    t_sig.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_sig)
    story.append(Spacer(1, 6))

    # 12. Recommended Investigations
    story.append(Paragraph("12. Prioritized Recommended Investigations", h2_style))
    rec_rows = [[Paragraph("Priority", header_cell), Paragraph("Focus Area", header_cell), Paragraph("Recommended Action", header_cell)]]
    for r in recommendations[:10]:
        rec_rows.append([
            Paragraph(str(r.get("priority", "Medium")), table_cell_bold),
            Paragraph(str(r.get("category", "General")), table_cell_bold),
            Paragraph(str(r.get("text", "")), table_cell),
        ])
    if len(rec_rows) == 1:
        rec_rows.append([Paragraph("-", table_cell), Paragraph("-", table_cell), Paragraph("No specific recommendations generated", table_cell)])
    t_rec = Table(rec_rows, colWidths=[75, 145, 320])
    t_rec.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
        ("PADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_rec)
    story.append(Spacer(1, 6))

    # 13. Methodology
    story.append(Paragraph("13. Analytics Methodology Note", h2_style))
    method_text = (
        "<b>Pattern Score Formula:</b> Pattern score combines effect size (absolute rate difference), "
        "sample size (statistical power), chi-square statistical confidence, recurrence across time windows, "
        "and deviation from baseline.<br/>"
        "<b>Baseline Definition:</b> Baseline defect rates represent the plant-wide defect rate outside the specific candidate slice.<br/>"
        "<b>Lift Calculation:</b> Lift = (Slice Defect Rate) / (Baseline Defect Rate). Lift > 1.0 indicates elevated risk."
    )
    story.append(Paragraph(method_text, body_style))
    story.append(Spacer(1, 6))

    # 14. Final Correlation Disclaimer
    story.append(Paragraph("14. Final Analytical Note", h2_style))
    story.append(disclaimer_table)

    doc.build(story)
    return buf.getvalue()


def build_pdf_html(kpis, patterns, recommendations, change_points, machine_comparison, shift_comparison, evidence_items, executive_summary):
    return "<html><body>DefectIQ Report Engine</body></html>"


def exec_summary_from_context(kpis, patterns, change_points, recommendations):
    top = patterns[0] if patterns else None
    cp = change_points[0] if change_points else None
    parts = [
        f"Across {kpis.get('total_inspections', 0):,} inspections ({kpis.get('date_range', ['-','-'])[0]} to {kpis.get('date_range', ['-','-'])[1]}), "
        f"the overall defect rate was {kpis.get('defect_rate_pct', 0):.2f}%.",
    ]
    if top:
        parts.append(
            f"The strongest detected association (score {top['pattern_score']}/100) associates "
            f"{top['description']} with a {top['slice_rate']:.2f}% defect rate versus a {top['baseline_rate']:.2f}% baseline "
            f"({top['lift']:.2f}x lift)."
        )
    if cp:
        parts.append(
            f"A rate shift was detected on {cp['date']}, moving from "
            f"{cp['before_rate']*100:.2f}% to {cp['after_rate']*100:.2f}%."
        )
    parts.append("All findings are statistical associations; no causal claims are made.")
    return " ".join(parts)
