import json

d = json.load(open("/tmp/r2.json"))["data"]


def shape(obj, path="", depth=0):
    lines = []
    if depth > 3:
        return lines
    if isinstance(obj, dict):
        for k, v in list(obj.items()):
            lines.append(f"{path}.{k}: {type(v).__name__}" + (f" [{len(v)}]" if isinstance(v, (list, dict)) else ""))
            lines.extend(shape(v, f"{path}.{k}", depth + 1))
    elif isinstance(obj, list) and obj:
        lines.append(f"{path}[0] keys: {list(obj[0].keys()) if isinstance(obj[0], dict) else obj[0]}")
    return lines


for section in ["overview", "machines", "shifts", "batches", "contribution", "mutual_information", "decision_tree", "clustering_kmeans", "clustering_dbscan", "change_points", "patterns", "recommendations", "report"]:
    obj = d.get(section)
    if obj is None:
        print(f"## {section}: MISSING")
        continue
    print(f"## {section}")
    for l in shape(obj, section)[:40]:
        print("  ", l)
    print()

print("TOP KEYS:", sorted(d.keys()))
