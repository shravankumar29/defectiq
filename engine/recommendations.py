"""
DefectIQ rule-based action recommendation engine.

Maps (factor type, lift tier, p-value) -> template recommendation + priority.
Language constraint: always "associated with" / "worth investigating";
never "caused".
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
        text = (
            f"Monitor conditions associated with {pattern['description']}. "
            f"Current evidence (lift {pattern['lift']}x, n={pattern['sample_size']}) "
            "is insufficient for immediate action; continue tracking recurrence across future windows."
        )
    elif has_machine and has_param:
        param_name = param.split("_bucket")[0]
        thr = param.split(">", 1)[1] if ">" in param else param
        text = (
            f"{pattern['description']} is strongly associated with elevated {defect_type} defects "
            f"(lift {pattern['lift']}x). Recommended process checks: verify {param_name} sensor "
            f"calibration and {param_name}-control system on {machine}"
            + (f", with particular attention during {shift} shift" if has_shift else "")
            + ". Compare recent calibration logs against reference values."
        )
    elif has_machine and has_shift:
        text = (
            f"The {machine} / {shift} shift combination is associated with elevated "
            f"{defect_type} defects (lift {pattern['lift']}x). Cross-check {machine} operating "
            f"logs specifically during {shift} shift for anomalies, handoff issues, or setup "
            "deviations. Review process adherence records for that combination."
        )
    elif has_machine:
        text = (
            f"{machine} is associated with elevated {defect_type} defects (lift {pattern['lift']}x). "
            f"Inspect {machine} for mechanical wear; compare recent calibration log against "
            "reference, and review maintenance history for the covered period."
        )
    elif has_shift:
        text = (
            f"{shift} shift is associated with an elevated {defect_type} defect rate "
            f"(lift {pattern['lift']}x). Review process adherence and handoff procedures "
            f"during {shift} shift, and check whether staffing or material flows differ "
            "from other shifts."
        )
    elif has_batch:
        text = (
            f"Batch range including {batch} is associated with elevated {defect_type} defects "
            f"(lift {pattern['lift']}x). Quarantine and inspect the flagged batch range for "
            "raw-material or setup issues; trace supplier lot records for the period."
        )
    else:
        text = (
            f"The pattern '{pattern['description']}' is associated with elevated "
            f"{defect_type} defects (lift {pattern['lift']}x). Investigate the listed factors "
            "jointly and verify operating conditions during the affected window."
        )

    return {
        "text": text,
        "priority": priority_label,
        "priority_key": priority_key,
        "priority_score": score,
        "pattern_id": pattern["pattern_id"],
    }


def generate_recommendations(patterns, max_count=25):
    """Recommendations only for patterns with meaningful evidence:
    lift >= 1.3x or p < 0.05 and n >= 100 — trivial patterns are excluded from
    the action list (they still appear in the pattern discovery table)."""
    def _meaningful(p):
        return (p["lift"] >= 1.3 and p["sample_size"] >= 100) or p["p_value"] < 0.05

    recs = [recommend_for_pattern(p) for p in patterns if _meaningful(p)]
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    recs.sort(key=lambda r: (order.get(r["priority"], 9), -r["priority_score"]))
    return recs[:max_count]
