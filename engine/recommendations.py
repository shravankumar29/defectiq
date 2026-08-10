"""
DefectIQ rule-based action recommendation engine.

Maps (factor type, lift tier, p-value) -> template recommendation + priority.
Language constraint: always "associated with" / "worth investigating"; never "caused".
"""

P_HIGH, P_SIG = 0.01, 0.05
LIFT_HIGH, LIFT_MOD = 3.0, 1.5


def _priority(score):
    if score >= 80:
        return "Critical", "critical"
    if score >= 60:
        return "High", "high"
    if score >= 40:
        return "Medium", "medium"
    return "Low", "low"


def recommend_for_pattern(pattern):
    factors = pattern["factors"]
    lift = pattern["lift"]
    p = pattern["p_value"]
    score = pattern["pattern_score"]
    priority_label, priority_key = _priority(score)

    machine = next((f.split("=")[1] for f in factors if f.startswith("machine_id=")), None)
    shift = next((f.split("=")[1] for f in factors if f.startswith("shift=")), None)
    batch = next((f.split("=")[1] for f in factors if f.startswith("batch_id=")), None)
    param = next((f for f in factors if "bucket" in f), None)
    defect_type = pattern["defect_type"]

    has_machine = machine is not None
    has_shift = shift is not None
    has_batch = batch is not None
    has_param = param is not None

    if lift < LIFT_MOD or p > P_SIG:
        category = "MONITORING"
        text = (
            f"Monitor conditions associated with {pattern['description']}. "
            f"Current evidence (lift {pattern['lift']}x, n={pattern['sample_size']}) "
            "is insufficient for immediate action; continue tracking recurrence across future windows."
        )
    elif has_machine and has_param:
        param_name = param.split("_bucket")[0]
        category = f"PROCESS PARAMETER ({param_name.upper()})"
        text = (
            f"{pattern['description']} is strongly associated with elevated {defect_type} defects "
            f"(lift {pattern['lift']}x). Recommended process checks: verify {param_name} sensor "
            f"calibration and control settings on Machine {machine}"
            + (f", specifically during Shift {shift}" if has_shift else "")
            + ". Compare recent operating logs against reference standards."
        )
    elif has_machine and has_shift:
        category = f"MACHINE / SHIFT INTERACTION ({machine} / Shift {shift})"
        text = (
            f"The Machine {machine} / Shift {shift} combination is associated with elevated "
            f"{defect_type} defects (lift {pattern['lift']}x). Cross-check Machine {machine} operating "
            f"logs specifically during Shift {shift} for setup deviations or handoff anomalies. "
            "Review process adherence records for that combination."
        )
    elif has_machine:
        category = f"MACHINE INSPECTION ({machine})"
        text = (
            f"Machine {machine} is associated with elevated {defect_type} defects (lift {pattern['lift']}x). "
            f"Inspect Machine {machine} for mechanical wear; compare recent calibration logs against "
            "reference specifications, and review maintenance history for the covered period."
        )
    elif has_shift:
        category = f"SHIFT PROCESS REVIEW (Shift {shift})"
        text = (
            f"Shift {shift} is associated with an elevated {defect_type} defect rate "
            f"(lift {pattern['lift']}x). Review process adherence, setup records, and handoff procedures "
            f"during Shift {shift}, and verify material flow consistency across shifts."
        )
    elif has_batch:
        category = f"BATCH QUALITY TRACEABILITY (Batch {batch})"
        text = (
            f"Batch {batch} is associated with elevated {defect_type} defects "
            f"(lift {pattern['lift']}x). Inspect raw-material and setup records for Batch {batch}; "
            "trace supplier lot records and material certificates for the affected window."
        )
    else:
        category = "GENERAL INVESTIGATION"
        text = (
            f"The pattern '{pattern['description']}' is associated with elevated "
            f"{defect_type} defects (lift {pattern['lift']}x). Investigate the listed factors "
            "jointly and verify operating conditions during the affected window."
        )

    return {
        "text": text,
        "category": category,
        "priority": priority_label,
        "priority_key": priority_key,
        "priority_score": score,
        "pattern_id": pattern["pattern_id"],
    }


def generate_recommendations(patterns, max_count=25):
    """Recommendations for patterns with meaningful evidence, deduplicated by category/text."""
    def _meaningful(p):
        return (p.get("lift", 0) >= 1.05) or (p.get("sample_size", 0) <= 50) or (p.get("p_value", 1) < 0.10)

    recs = [recommend_for_pattern(p) for p in patterns if _meaningful(p)]
    
    # Deduplicate recommendations by category/signature to prevent repetition
    seen_signatures = set()
    deduped = []
    for r in recs:
        sig = r["category"]
        if sig not in seen_signatures:
            seen_signatures.add(sig)
            deduped.append(r)
        else:
            # If signature already exists, append unique detail text if distinct
            pass

    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    deduped.sort(key=lambda r: (order.get(r["priority"], 9), -r["priority_score"]))
    return deduped[:max_count]
