import json, urllib.request

BASE = "http://127.0.0.1:3000"

SECRET = "defectiq-internal"
headers = {"X-Engine-Secret": SECRET, "Content-Type": "application/json"}

req = urllib.request.Request(BASE + "/api/trpc/engine.results", headers=headers)
data = json.load(urllib.request.urlopen(req))
res = data["result"]["data"]["json"]

print("PATTERN SAMPLE:")
p = res["patterns"][0]
print(json.dumps({k: v for k, v in p.items() if v is not None}, indent=2)[:2000])

print("\nEVIDENCE SAMPLE:")
evs = res["evidence"]
real_keys = [k for k in evs if k not in ("", "null", "None", "nan")]
if real_keys:
    e = evs[real_keys[0]]
    print(json.dumps(e, indent=2, default=str)[:2500])
print("\nevidence keys sample:", list(evs.keys())[:6])

print("\nRECOMMENDATION SAMPLE:")
print(json.dumps(res["recommendations"][0], indent=2, default=str)[:1500])
