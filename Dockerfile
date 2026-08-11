# DefectIQ — Node app + Python analysis engine
# Python runtime is needed for the statistical engine (pandas/scipy/sklearn/weasyprint).
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python engine dependencies (virtualenv kept across deploys since only final
# image layers are cached; re-installs on cold builds but fits the budget).
RUN python3 -m venv /opt/defectiq-venv
COPY engine_api.py engine_server.py ./
COPY engine engine/

# Copy full source so vite build artifacts and esbuild externals resolve identically.
COPY . .

RUN /opt/defectiq-venv/bin/pip install --no-cache-dir \
    pandas numpy scipy scikit-learn fastapi uvicorn jinja2 reportlab openpyxl \
    && npm install -g corepack@latest && corepack pnpm install \
    && NODE_ENV=production corepack pnpm run build

ENV NODE_ENV=production
ENV ENGINE_SECRET=defectiq-internal
ENV ENGINE_URL=http://127.0.0.1:8901

# Start Python engine in the background (it binds 127.0.0.1:8901 only), then
# serve the Node app on the managed PORT. Output is kept minimal to avoid the
# dev port-detection regex matching "8901" in this file's comments.
CMD ["sh", "-c", "/opt/defectiq-venv/bin/python engine_server.py > engine.log 2>&1 & sleep 3 && exec node dist/index.js"]
