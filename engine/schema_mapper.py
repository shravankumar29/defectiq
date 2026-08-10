"""
DefectIQ Schema Mapping & Normalization Engine

Multi-stage intelligent schema mapper for manufacturing CSV/XLSX logs.
Maps arbitrary uploaded columns to the DefectIQ canonical schema:

Canonical Required Fields:
  - timestamp
  - machine_id
  - batch_id
  - shift
  - defect_type
  - defect_count

Canonical Optional Fields:
  - units_inspected
  - temperature
  - pressure
  - speed
  - vibration
  - humidity
"""

import re
import math
import datetime
from typing import Dict, List, Any, Optional, Tuple
import pandas as pd
import numpy as np

# Defines internal canonical fields and metadata
CANONICAL_FIELDS = {
    "timestamp": {
        "label": "Timestamp / Date",
        "required": True,
        "description": "Date/time of inspection log",
        "type": "datetime"
    },
    "machine_id": {
        "label": "Machine ID",
        "required": True,
        "description": "Machine, equipment, or asset identifier",
        "type": "categorical"
    },
    "batch_id": {
        "label": "Batch / Lot ID",
        "required": True,
        "description": "Production batch or lot number",
        "type": "categorical"
    },
    "shift": {
        "label": "Shift",
        "required": True,
        "description": "Work shift (e.g. Shift A, Shift 1, Day)",
        "type": "categorical"
    },
    "defect_type": {
        "label": "Defect Type",
        "required": True,
        "description": "Defect classification or failure mode",
        "type": "categorical"
    },
    "defect_count": {
        "label": "Defect Count",
        "required": True,
        "description": "Number of defective units or NG count",
        "type": "numeric"
    },
    "units_inspected": {
        "label": "Units Inspected",
        "required": False,
        "description": "Total units inspected in batch/sample",
        "type": "numeric"
    },
    "temperature": {
        "label": "Temperature (°C)",
        "required": False,
        "description": "Process temperature reading",
        "type": "numeric"
    },
    "pressure": {
        "label": "Pressure (bar)",
        "required": False,
        "description": "Process pressure reading",
        "type": "numeric"
    },
    "speed": {
        "label": "Speed / RPM",
        "required": False,
        "description": "Machine speed or line rate",
        "type": "numeric"
    },
    "vibration": {
        "label": "Vibration Level",
        "required": False,
        "description": "Vibration sensor reading",
        "type": "numeric"
    },
    "humidity": {
        "label": "Humidity (%)",
        "required": False,
        "description": "Ambient or process humidity reading",
        "type": "numeric"
    }
}

# Synonym mapping dictionary for Stage 2 (lower & cleaned)
SYNONYMS: Dict[str, List[str]] = {
    "machine_id": [
        "machine", "machineid", "machineno", "machinenumber", "machinecode",
        "machinename", "equipment", "equipmentid", "equipmentno", "equipmentcode",
        "asset", "assetid", "assetno", "line", "lineno", "linenumber", "workstation",
        "station", "stationid", "unitno"
    ],
    "batch_id": [
        "batch", "batchid", "batchno", "batchnumber", "batchcode", "lot",
        "lotid", "lotno", "lotnumber", "productionlot", "lotcode", "workorder", "wono",
        "runid", "jobno", "orderid"
    ],
    "shift": [
        "shift", "shiftname", "shiftid", "workshift", "productionshift",
        "crew", "shiftcode", "team", "turn"
    ],
    "defect_type": [
        "defect", "defecttype", "defectcategory", "defectclass", "defectmode",
        "failuretype", "failuremode", "failurecategory", "faulttype", "qualityissue", "issue",
        "problem", "rejectreason", "rejectionreason", "qualitystatus",
        "inspectionresult", "defectivecode", "errorcode", "category"
    ],
    "defect_count": [
        "defectcount", "defects", "defectsfound", "defectiveunits", "ngcount",
        "ngqty", "ngquantity", "rejectedunits", "rejectedqty", "rejectedquantity", "rejects",
        "rejectcount", "rejections", "totaldefects", "badunits", "failcount",
        "failedunits"
    ],
    "timestamp": [
        "timestamp", "date", "datetime", "time", "inspectiondate", "inspectiontime",
        "inspectiontimestamp", "datelogged", "recordedat", "logdate", "logtime", "recorddate",
        "dateandtime", "createdat"
    ],
    "units_inspected": [
        "unitsinspected", "totalunits", "inspectedunits", "inspected",
        "samplesize", "totalinspected", "qtyinspected", "batchsize", "totalqty",
        "producedqty", "totalproduced", "quantityinspected", "unitsproduced",
        "unitsprocessed", "units", "quantity", "qty"
    ],
    "temperature": [
        "temp", "temperature", "tempc", "tempcelsius", "tempf", "temperaturec", "processtemp",
        "chambertemp", "ambienttemp"
    ],
    "pressure": [
        "pressure", "press", "pressurebar", "syspressure", "linepressure"
    ],
    "speed": [
        "speed", "machinespeed", "linespeed", "rpm", "feedrate", "conveyorspeed"
    ],
    "vibration": [
        "vibration", "vib", "vibrationlevel", "vibmms", "sensorvib"
    ],
    "humidity": [
        "humidity", "hum", "relativehumidity", "rh", "humiditypct"
    ]
}


def _clean_str(s: str) -> str:
    """Normalize string by removing spaces, punctuation, underscores, dashes, lowercase."""
    return re.sub(r'[^a-z0-9]', '', str(s).lower())


def _get_sample_values(series: pd.Series, max_samples: int = 5) -> List[str]:
    """Extract non-null sample values formatted nicely as strings."""
    non_nulls = series.dropna().astype(str).tolist()
    samples = []
    seen = set()
    for v in non_nulls:
        v_str = v.strip()
        if v_str and v_str not in seen and v_str.lower() != 'nan':
            seen.add(v_str)
            samples.append(v_str)
            if len(samples) >= max_samples:
                break
    return samples


def _infer_type_from_samples(samples: List[str]) -> str:
    """Classify column content into timestamp, numeric, or string categorical based on sample values."""
    if not samples:
        return "unknown"
    
    date_count = 0
    num_count = 0
    for val in samples:
        # Check date
        try:
            if re.search(r'\d{4}[-/.]\d{1,2}[-/.]\d{1,2}', val) or re.search(r'\d{1,2}[-/.]\d{1,2}[-/.]\d{4}', val):
                date_count += 1
                continue
            pd.to_datetime(val)
            date_count += 1
            continue
        except Exception:
            pass

        # Check numeric
        cleaned_val = val.replace(',', '')
        try:
            float(cleaned_val)
            num_count += 1
            continue
        except ValueError:
            pass

    if date_count / len(samples) >= 0.7:
        return "datetime"
    if num_count / len(samples) >= 0.7:
        return "numeric"
    return "categorical"


def analyze_schema(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Analyzes DataFrame columns and maps them to DefectIQ canonical schema using multi-stage matching.
    Returns structured mapping result with confidence scores, sample values, and derived field info.
    """
    column_mappings = []
    mapped_canonical_fields = set()
    mapped_orig_cols = set()

    raw_cols = list(df.columns)
    col_samples = {col: _get_sample_values(df[col]) for col in raw_cols}
    col_types = {col: _infer_type_from_samples(col_samples[col]) for col in raw_cols}

    # --- STAGE 1: EXACT MATCH (case-insensitive, normalized) ---
    for col in raw_cols:
        c_clean = _clean_str(col)
        for canon, meta in CANONICAL_FIELDS.items():
            if canon in mapped_canonical_fields:
                continue
            canon_clean = _clean_str(canon)
            if c_clean == canon_clean:
                column_mappings.append({
                    "original_column": col,
                    "mapped_field": canon,
                    "confidence": 0.99,
                    "confidence_label": "HIGH CONFIDENCE",
                    "stage": "EXACT_MATCH",
                    "sample_values": col_samples[col][:4],
                    "reasoning": f"Exact match for canonical field '{canon}'"
                })
                mapped_canonical_fields.add(canon)
                mapped_orig_cols.add(col)
                break

    # --- STAGE 2: SYNONYM / FUZZY MATCH ---
    for col in raw_cols:
        if col in mapped_orig_cols:
            continue
        c_clean = _clean_str(col)
        best_canon = None
        best_score = 0.0
        best_reason = ""

        for canon, synonyms in SYNONYMS.items():
            if canon in mapped_canonical_fields:
                continue
            for syn in synonyms:
                if c_clean == syn:
                    best_canon = canon
                    best_score = 0.96
                    best_reason = f"Matched synonym '{syn}' for '{canon}'"
                    break
                elif len(syn) >= 4 and (c_clean.startswith(syn) or syn.startswith(c_clean)):
                    score = 0.85
                    if score > best_score:
                        best_canon = canon
                        best_score = score
                        best_reason = f"Partial synonym match '{syn}' in '{col}'"


        if best_canon and best_score >= 0.75:
            label = "HIGH CONFIDENCE" if best_score >= 0.90 else "MEDIUM CONFIDENCE"
            column_mappings.append({
                "original_column": col,
                "mapped_field": best_canon,
                "confidence": best_score,
                "confidence_label": label,
                "stage": "SYNONYM_MATCH",
                "sample_values": col_samples[col][:4],
                "reasoning": best_reason
            })
            mapped_canonical_fields.add(best_canon)
            mapped_orig_cols.add(col)

    # --- STAGE 3: VALUE PATTERN & DATA TYPE INFERENCE ---
    for col in raw_cols:
        if col in mapped_orig_cols:
            continue
        samples = col_samples[col]
        inferred_type = col_types[col]

        # Timestamp heuristic
        if "timestamp" not in mapped_canonical_fields and inferred_type == "datetime":
            column_mappings.append({
                "original_column": col,
                "mapped_field": "timestamp",
                "confidence": 0.88,
                "confidence_label": "HIGH CONFIDENCE",
                "stage": "VALUE_INFERENCE",
                "sample_values": samples[:4],
                "reasoning": "Sample values match date/time format"
            })
            mapped_canonical_fields.add("timestamp")
            mapped_orig_cols.add(col)
            continue

        # Machine ID pattern heuristic (e.g. M01, MC-101, Line 1)
        if "machine_id" not in mapped_canonical_fields and samples:
            if any(re.match(r'^(M|MC|MAC|LINE|EQUIP|EQ)[-_]?\d+', s, re.I) for s in samples):
                column_mappings.append({
                    "original_column": col,
                    "mapped_field": "machine_id",
                    "confidence": 0.85,
                    "confidence_label": "MEDIUM CONFIDENCE",
                    "stage": "VALUE_INFERENCE",
                    "sample_values": samples[:4],
                    "reasoning": "Sample values match machine/equipment code patterns"
                })
                mapped_canonical_fields.add("machine_id")
                mapped_orig_cols.add(col)
                continue

        # Batch ID pattern heuristic (e.g. LOT-101, B12, BATCH-9)
        if "batch_id" not in mapped_canonical_fields and samples:
            if any(re.match(r'^(LOT|B|BATCH|WO|JOB)[-_]?\d+', s, re.I) for s in samples):
                column_mappings.append({
                    "original_column": col,
                    "mapped_field": "batch_id",
                    "confidence": 0.85,
                    "confidence_label": "MEDIUM CONFIDENCE",
                    "stage": "VALUE_INFERENCE",
                    "sample_values": samples[:4],
                    "reasoning": "Sample values match batch/lot code patterns"
                })
                mapped_canonical_fields.add("batch_id")
                mapped_orig_cols.add(col)
                continue

        # Defect count heuristic (non-negative integers, low range)
        if "defect_count" not in mapped_canonical_fields and inferred_type == "numeric":
            c_clean = _clean_str(col)
            if not any(k in c_clean for k in ("good", "passed", "ok", "total", "inspected", "sample")):
                try:
                    nums = [float(s.replace(',', '')) for s in samples if s.replace(',', '').replace('.', '', 1).isdigit()]
                    if nums and all(n >= 0 for n in nums) and all(n == int(n) for n in nums):
                        column_mappings.append({
                            "original_column": col,
                            "mapped_field": "defect_count",
                            "confidence": 0.78,
                            "confidence_label": "MEDIUM CONFIDENCE",
                            "stage": "VALUE_INFERENCE",
                            "sample_values": samples[:4],
                            "reasoning": "Sample values are positive integer defect counts"
                        })
                        mapped_canonical_fields.add("defect_count")
                        mapped_orig_cols.add(col)
                        continue
                except Exception:
                    pass


    # --- UNMAPPED / IGNORED EXTRA COLUMNS ---
    for col in raw_cols:
        if col not in mapped_orig_cols:
            column_mappings.append({
                "original_column": col,
                "mapped_field": None,
                "confidence": 0.0,
                "confidence_label": "IGNORED",
                "stage": "EXTRA_COLUMN",
                "sample_values": col_samples[col][:4],
                "reasoning": "Extra non-analytical column; left intact in dataset"
            })

    # --- FIELD DERIVATION CHECK ---
    derived_fields = []
    # Check if defect_count is unmapped but total_units & good_units exist
    if "defect_count" not in mapped_canonical_fields:
        total_col = None
        good_col = None
        for col in raw_cols:
            c_clean = _clean_str(col)
            if c_clean in ("totalunits", "unitsinspected", "totalinspected", "totalqty", "inspected"):
                total_col = col
            if c_clean in ("goodunits", "goodqty", "passed", "passedunits", "okqty", "okcount"):
                good_col = col

        if total_col and good_col:
            derived_fields.append({
                "field": "defect_count",
                "formula": f"{total_col} - {good_col}",
                "reasoning": f"Derived defect_count from ({total_col} - {good_col})"
            })
            mapped_canonical_fields.add("defect_count")

    # Check if defect_type is missing -> default to "Unknown / Unclassified"
    if "defect_type" not in mapped_canonical_fields:
        derived_fields.append({
            "field": "defect_type",
            "formula": "'Unknown / Unclassified'",
            "reasoning": "No defect category column found; set default classification 'Unknown / Unclassified'"
        })
        mapped_canonical_fields.add("defect_type")

    # Determine missing required fields
    required_fields = {k for k, v in CANONICAL_FIELDS.items() if v["required"]}
    missing_required = list(required_fields - mapped_canonical_fields)

    can_auto_proceed = len(missing_required) == 0

    return {
        "total_rows": len(df),
        "total_cols": len(raw_cols),
        "columns_detected": len(raw_cols),
        "columns_used": len([m for m in column_mappings if m["mapped_field"] is not None]),
        "columns_ignored": len([m for m in column_mappings if m["mapped_field"] is None]),
        "column_mappings": column_mappings,
        "derived_fields": derived_fields,
        "missing_required": missing_required,
        "can_auto_proceed": can_auto_proceed,
        "sample_rows": df.head(5).fillna("").astype(str).to_dict("records")
    }


def normalize_dataframe(df: pd.DataFrame, user_mappings: Dict[str, Optional[str]]) -> pd.DataFrame:
    """
    Applies column mappings and normalizes data values to canonical DefectIQ format.
    - Renames mapped columns to canonical field names
    - Derives missing fields (e.g. defect_count, defect_type)
    - Normalizes dates/timestamps into standard format
    - Fills missing values cleanly
    """
    norm_df = df.copy()

    # Apply user/auto column renaming
    rename_dict = {}
    for orig_col, target_field in user_mappings.items():
        if target_field and orig_col in norm_df.columns and target_field in CANONICAL_FIELDS:
            rename_dict[orig_col] = target_field

    norm_df = norm_df.rename(columns=rename_dict)

    # 1. Derive defect_count if missing
    if "defect_count" not in norm_df.columns:
        good_col = next((c for c in norm_df.columns if _clean_str(c) in ("goodunits", "goodqty", "passed", "passedunits", "okqty", "okcount", "good")), None)
        units_col = "units_inspected" if "units_inspected" in norm_df.columns else next((c for c in norm_df.columns if _clean_str(c) in ("totalunits", "unitsinspected", "totalinspected", "totalqty", "inspected")), None)

        if units_col and good_col:
            norm_df["defect_count"] = (pd.to_numeric(norm_df[units_col], errors="coerce").fillna(0) - pd.to_numeric(norm_df[good_col], errors="coerce").fillna(0)).clip(lower=0).astype(int)
        elif "rejected" in norm_df.columns:
            norm_df["defect_count"] = pd.to_numeric(norm_df["rejected"], errors="coerce").fillna(0).clip(lower=0).astype(int)
        else:
            norm_df["defect_count"] = 1  # default row-based defect count if unspecified


    # 2. Handle missing defect_type
    if "defect_type" not in norm_df.columns:
        norm_df["defect_type"] = "Unknown / Unclassified"
    else:
        norm_df["defect_type"] = norm_df["defect_type"].fillna("Unknown / Unclassified").astype(str)

    # 3. Handle default units_inspected
    if "units_inspected" not in norm_df.columns:
        norm_df["units_inspected"] = norm_df["defect_count"].apply(lambda x: max(int(x), 100))

    # 4. Normalize timestamp
    if "timestamp" in norm_df.columns:
        norm_df["timestamp"] = pd.to_datetime(norm_df["timestamp"], errors="coerce").dt.strftime("%Y-%m-%d")
        # Fill any invalid timestamps with sequential dates
        if norm_df["timestamp"].isna().any():
            base_date = datetime.date.today() - datetime.timedelta(days=len(norm_df))
            norm_df["timestamp"] = norm_df["timestamp"].fillna(base_date.strftime("%Y-%m-%d"))
    else:
        # Fallback generated timestamps
        base_date = datetime.date.today() - datetime.timedelta(days=len(norm_df))
        dates = [ (base_date + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(len(norm_df)) ]
        norm_df["timestamp"] = dates

    # 5. Normalize IDs (machine_id, batch_id, shift)
    if "machine_id" not in norm_df.columns:
        norm_df["machine_id"] = "M01"
    else:
        norm_df["machine_id"] = norm_df["machine_id"].fillna("M01").astype(str)

    if "batch_id" not in norm_df.columns:
        norm_df["batch_id"] = "B01"
    else:
        norm_df["batch_id"] = norm_df["batch_id"].fillna("B01").astype(str)

    if "shift" not in norm_df.columns:
        norm_df["shift"] = "Shift A"
    else:
        norm_df["shift"] = norm_df["shift"].fillna("Shift A").astype(str)

    # Clean numeric types
    norm_df["defect_count"] = pd.to_numeric(norm_df["defect_count"], errors="coerce").fillna(0).astype(int)
    norm_df["units_inspected"] = pd.to_numeric(norm_df["units_inspected"], errors="coerce").fillna(100).astype(int)

    # 6. Auto-generate inspection_id if missing
    if "inspection_id" not in norm_df.columns:
        norm_df["inspection_id"] = [f"INS-{i+1:06d}" for i in range(len(norm_df))]

    # 7. Convert process parameters to numeric if present
    for param_col in ["temperature", "pressure", "speed", "vibration", "humidity"]:
        if param_col in norm_df.columns:
            norm_df[param_col] = pd.to_numeric(norm_df[param_col], errors="coerce")

    return norm_df

