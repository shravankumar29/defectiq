"""Verify engine results.json for NaN leaks, recommendation quality, and
causal-language compliance. Usage: python3 tests/check_results.py"""
import json
from collections import Counter


def find_bad(o, path=""):
    """Return list of paths containing nan/inf floats."""
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            out += find_bad(v, path + "/" + k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            out += find_bad(v, path + f"[{i}]")
    elif isinstance(o, float) and (o != o or o in (float("inf"), float("-inf"))):
        out.append(path)
    return out


def main():
    r = json.load(open("/tmp/results.json"))
    bad = find_bad(r)
    print("status OK, keys:", sorted(r.keys()))
    if bad:
        print("nan/inf paths:", bad[:10])
    recs = r["recommendations"]
    print("rec count:", len(recs), Counter(x["priority"] for x in recs))
    print("causal words:", len([x for x in recs if "caused" in x["text"].lower()]))
    pats = r["patterns"]
    print("patterns:", len(pats), pats[0]["pattern_id"], pats[0]["pattern_score"])
    assert not bad, "NaN/Inf found in results"
    assert len(recs) <= 25
    assert pats[0]["pattern_score"] >= 80
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    main()
