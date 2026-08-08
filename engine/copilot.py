"""
DefectIQ AI Copilot — grounded LLM orchestration.

The LLM is given ONLY a pre-computed JSON analysis context plus the user's
question. It never computes statistics and must cite numbers verbatim.
Falls back gracefully if the LLM is unavailable.
"""

import json
import os
import sys

SYSTEM_PROMPT = """You are the Defect Intelligence Copilot for DefectIQ.
You will be given a JSON object containing precomputed statistics, patterns,
evidence, and recommendations. Answer the user's question using ONLY this
data. Never invent numbers. Never state that a factor "caused" a defect —
use "associated with" / "likely contributing factor" language only.
If the JSON does not contain enough information to answer, say so explicitly.
Keep answers concise (under 200 words), structured, and always reference the
exact numbers from the JSON. End every answer with a one-line note that
association is not causation. After your answer, list which pattern/evidence
IDs or data sections you used, prefixed by 'Sources:'."""


def build_analysis_context(overview, patterns, change_points, recommendations, defect_types, kpis):
    return {
        "dataset": {
            "total_inspections": kpis["total_inspections"],
            "overall_defect_rate_pct": kpis["defect_rate_pct"],
            "date_range": kpis["date_range"],
        },
        "defect_types": defect_types,
        "kpi_summary": {
            "highest_risk_machine": kpis["highest_risk_machine"],
            "highest_risk_machine_rate_pct": kpis["highest_risk_machine_rate_pct"],
            "highest_risk_shift": kpis["highest_risk_shift"],
            "active_alerts": kpis["active_alerts"],
        },
        "top_patterns": [
            {
                "pattern_id": p["pattern_id"],
                "description": p["description"],
                "defect_type": p["defect_type"],
                "slice_rate_pct": p["slice_rate"],
                "baseline_rate_pct": p["baseline_rate"],
                "lift": p["lift"],
                "sample_size": p["sample_size"],
                "p_value": p["p_display"],
                "score": p["pattern_score"],
            }
            for p in patterns[:10]
        ],
        "change_points": change_points,
        "recommendations": recommendations[:8],
        "disclaimer": "All findings are statistical associations, not causal conclusions.",
    }


def ask_copilot(question: str, context: dict):
    """Call the built-in LLM API with the grounded context. Returns answer + sources."""
    api_url = os.environ.get("BUILT_IN_FORGE_API_URL", "").rstrip("/")
    api_key = os.environ.get("BUILT_IN_FORGE_API_KEY", "")
    if not api_url or not api_key:
        return _fallback(question)

    payload = {
        "model": "gemini-2.5-flash",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Analysis context (JSON):\n```json\n{json.dumps(context, indent=1)}\n```\n\nUser question: {question}"},
        ],
        "max_tokens": 1200,
        "temperature": 0.2,
    }

    try:
        import urllib.request
        req = urllib.request.Request(
            f"{api_url}/v1/chat/completions",
            data=json.dumps(payload).encode(),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
        content = data["choices"][0]["message"]["content"]
        return {"answer": content, "sources_used": True}
    except Exception as exc:  # graceful fallback — never break the demo
        return _fallback(question, str(exc))


def _fallback(question, err=""):
    return {
        "answer": (
            "Copilot is temporarily unavailable — showing computed data only. "
            "The analytics tables on this page contain the same numbers the copilot would cite. "
            "Correlation is not causation: all findings are statistical associations."
        ),
        "sources_used": False,
        "fallback": True,
    }
