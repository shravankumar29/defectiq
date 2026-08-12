"""
DefectIQ engine FastAPI server.

Serves the Python analysis pipeline to the Node/Express frontend layer on
an internal port. The Node server proxies requests here.
"""

import os
import base64
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import engine_api

app = FastAPI(title="DefectIQ Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_SECRET = os.environ.get("ENGINE_SECRET", "defectiq-internal")


class UploadReq(BaseModel):
    csv_base64: str
    secret: str


class ChatReq(BaseModel):
    question: str
    secret: str


class GenReq(BaseModel):
    secret: str
    rows: int = 20000


def _check(secret: str):
    if secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/status")
def status():
    return engine_api.get_state_summary()


@app.post("/generate")
def generate(req: GenReq):
    _check(req.secret)
    res = engine_api.load_synthetic(n=req.rows)
    return res


class ConfirmUploadReq(BaseModel):
    csv_base64: str
    user_mappings: dict
    secret: str


@app.post("/upload")
def upload(req: UploadReq):
    _check(req.secret)
    try:
        res = engine_api.load_uploaded(req.csv_base64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return res


@app.post("/preview_upload")
def preview_upload(req: UploadReq):
    _check(req.secret)
    try:
        res = engine_api.preview_uploaded(req.csv_base64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return res


@app.post("/confirm_upload")
def confirm_upload(req: ConfirmUploadReq):
    _check(req.secret)
    try:
        res = engine_api.confirm_uploaded(req.csv_base64, req.user_mappings)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return res



@app.get("/results")
def results():
    r = engine_api.get_results()
    if r is None:
        raise HTTPException(status_code=404, detail="no dataset loaded")
    return r


@app.get("/patterns")
def get_patterns():
    try:
        return engine_api.get_patterns_lazy()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/clustering")
def get_clustering():
    try:
        return engine_api.get_clustering_lazy()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/investigation/{defect_type}")
def get_investigation(defect_type: str):
    try:
        return engine_api.get_investigation_lazy(defect_type)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/copilot")
def copilot(req: ChatReq):
    _check(req.secret)
    return engine_api.get_copilot_answer(req.question)


@app.get("/report/pdf")
def report_pdf():
    try:
        pdf = engine_api.generate_report_pdf()
        return base64.b64encode(pdf).decode()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/report/csv")
def report_csv():
    try:
        return engine_api.generate_report_csv()
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8901)
