"""
Unit tests for DefectIQ schema mapping and data normalization engine.
"""

import sys
import os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine.schema_mapper import analyze_schema, normalize_dataframe


def test_exact_and_normalized_matching():
    data = {
        "Inspection Date": ["2026-05-01", "2026-05-02"],
        "Machine ID": ["M01", "M02"],
        "Batch ID": ["B01", "B02"],
        "Shift": ["Shift A", "Shift B"],
        "Defect Type": ["Surface", "Dimensional"],
        "Defect Count": [3, 1]
    }
    df = pd.DataFrame(data)
    analysis = analyze_schema(df)

    assert analysis["can_auto_proceed"] is True
    mappings = {m["original_column"]: m["mapped_field"] for m in analysis["column_mappings"]}
    assert mappings["Inspection Date"] == "timestamp"
    assert mappings["Machine ID"] == "machine_id"
    assert mappings["Batch ID"] == "batch_id"
    assert mappings["Shift"] == "shift"
    assert mappings["Defect Type"] == "defect_type"
    assert mappings["Defect Count"] == "defect_count"


def test_synonym_and_fuzzy_matching():
    data = {
        "Date Time": ["2026-05-01 10:00", "2026-05-01 11:00"],
        "Equipment Code": ["M-101", "M-102"],
        "Lot Number": ["LOT-88", "LOT-89"],
        "Work Shift": ["Turn 1", "Turn 2"],
        "Failure Mode": ["Contamination", "Surface"],
        "NG Qty": [5, 0],
        "Temp_C": [75.5, 78.2],
        "Operator Notes": ["Checked", "OK"]
    }
    df = pd.DataFrame(data)
    analysis = analyze_schema(df)

    mappings = {m["original_column"]: m["mapped_field"] for m in analysis["column_mappings"]}
    assert mappings["Date Time"] == "timestamp"
    assert mappings["Equipment Code"] == "machine_id"
    assert mappings["Lot Number"] == "batch_id"
    assert mappings["Work Shift"] == "shift"
    assert mappings["Failure Mode"] == "defect_type"
    assert mappings["NG Qty"] == "defect_count"
    assert mappings["Temp_C"] == "temperature"
    assert mappings["Operator Notes"] is None  # ignored extra column


def test_field_derivation_and_missing_defaults():
    # Dataset missing defect_count (has total & good) and missing defect_type
    data = {
        "Inspection Timestamp": ["2026-05-01", "2026-05-02"],
        "Machine": ["M01", "M02"],
        "Batch": ["B10", "B11"],
        "Shift": ["A", "B"],
        "Total Units": [100, 200],
        "Good Units": [95, 190]
    }
    df = pd.DataFrame(data)
    analysis = analyze_schema(df)

    # defect_count derived
    derived_fields = [d["field"] for d in analysis["derived_fields"]]
    assert "defect_count" in derived_fields
    assert "defect_type" in derived_fields

    # Apply normalization
    auto_mappings = {m["original_column"]: m["mapped_field"] for m in analysis["column_mappings"] if m["mapped_field"]}
    norm_df = normalize_dataframe(df, auto_mappings)

    assert "defect_count" in norm_df.columns
    assert list(norm_df["defect_count"]) == [5, 10]
    assert "defect_type" in norm_df.columns
    assert all(norm_df["defect_type"] == "Unknown / Unclassified")


def test_end_to_end_normalization():
    data = {
        "Recorded At": ["01/05/2026", "02/05/2026"],
        "Asset No": ["EQ-1", "EQ-2"],
        "Production Lot": ["LOT-1", "LOT-2"],
        "Crew": ["Day", "Night"],
        "Reject Reason": ["Cracked", "Scratched"],
        "Rejects": [2, 4]
    }
    df = pd.DataFrame(data)
    analysis = analyze_schema(df)
    mappings = {m["original_column"]: m["mapped_field"] for m in analysis["column_mappings"] if m["mapped_field"]}
    norm_df = normalize_dataframe(df, mappings)

    required_canonical = ["timestamp", "machine_id", "batch_id", "shift", "defect_type", "defect_count"]
    for col in required_canonical:
        assert col in norm_df.columns, f"Missing normalized column {col}"

    assert list(norm_df["defect_count"]) == [2, 4]
    assert list(norm_df["defect_type"]) == ["Cracked", "Scratched"]


if __name__ == "__main__":
    test_exact_and_normalized_matching()
    test_synonym_and_fuzzy_matching()
    test_field_derivation_and_missing_defaults()
    test_end_to_end_normalization()
    print("ALL SCHEMA MAPPER TESTS PASSED SUCCESSFULLY!")
