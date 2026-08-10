import base64
from engine_api import preview_uploaded

with open('sample_custom_factory_data.csv', 'rb') as f:
    raw = f.read()
    b64 = base64.b64encode(raw).decode('utf-8')

print(preview_uploaded(b64))
