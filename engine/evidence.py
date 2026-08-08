"""
DefectIQ evidence builder — turns a pattern/contribution finding into the
four-part Finding / Evidence / Interpretation / Recommended investigation
structure used by the EvidencePanel component.
"""

from .recommendations import recommend_for_pattern


def build_evidence(pattern, recommendation=None):
    rec = recommendation or recommend_for_pattern(pattern)
    finding = f"{pattern['description']} is associated with elevated {pattern['defect_type']} defects"
    evidence = {
        "slice_rate": f"{pattern['slice_rate']}%",
        "baseline_rate": f"{pattern['baseline_rate']}%",
        "lift": f"{pattern['lift']}x",
        "sample_size": f"n={pattern['sample_size']:,}",
        "defective_units": pattern["defective_units"],
        "date_range": f"{pattern['date_range'][0]} to {pattern['date_range'][1]}",
        "affected_batches": pattern["affected_batches"],
        "affected_shifts": pattern["affected_shifts"],
        "statistical_test": "Chi-square test of independence",
        "p_value": pattern["p_display"],
        "confidence_label": pattern["confidence"],
    }
    interpretation = (
        f"Strong statistical association detected ({pattern['lift']}x baseline rate, "
        f"p={pattern['p_display']}). This analysis does not establish that the listed "
        "factors caused the defects; it identifies conditions co-occurring with higher "
        "defect rates."
        + (" Recurrence across " + str(pattern["recurrence"]) + " of observed windows strengthens the association." if pattern["recurrence"] > 0 else "")
    )
    return {
        "pattern_id": pattern["pattern_id"],
        "score": pattern["pattern_score"],
        "finding": finding,
        "evidence": evidence,
        "interpretation": interpretation,
        "recommendation": rec,
        "disclaimer": "Association is not causation — this evidence supports investigation, not a causal conclusion.",
    }


def build_contribution_evidence(item, baseline_rate, defect_type):
    finding = (
        f"{item['factor']} {item['factor_value']} is associated with elevated "
        f"{defect_type} defects ({item['defect_rate_in']}% vs {item['baseline_rate']}% baseline)"
    )
    return {
        "finding": finding,
        "evidence": {
            "slice_rate": f"{item['defect_rate_in']}%",
            "baseline_rate": f"{item['baseline_rate']}%",
            "lift": f"{item['lift']}x",
            "sample_size": f"n={item['sample_size']:,}",
            "statistical_test": "Chi-square test of independence",
            "p_value": item["p_display"],
            "confidence_label": "High" if item["p_value"] < 0.01 else ("Moderate" if item["p_value"] < 0.05 else "Low"),
        },
        "interpretation": (
            f"Statistical association of {item['lift']}x the baseline rate for this defect type "
            f"(p={item['p_display']}). This does not establish causation."
        ),
        "disclaimer": "Association is not causation — this evidence supports investigation, not a causal conclusion.",
    }
