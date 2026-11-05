#!/usr/bin/env python3
"""
Generate SQL INSERT statements from Community_Resource_PRM.xlsx.

Usage:
  python3 supabase/generate_prm_import.py

Output:
  supabase/prm_import_data.sql  — paste into Supabase SQL Editor to import all leads.

Run AFTER executing prm_schema.sql in Supabase.
"""

import pandas as pd
import math
import os
import sys
from datetime import datetime

XLSX_PATH = os.path.expanduser("~/Downloads/Community_Resource_PRM.xlsx")
OUT_PATH  = os.path.join(os.path.dirname(__file__), "prm_import_data.sql")

COLUMN_MAP = {
    "Record ID":             "record_id",
    "Organization Name":     "org_name",
    "DBA / Alternate Name":  "dba_name",
    "Source Document":       "source_doc",
    "Street Address":        "street_address",
    "City":                  "city",
    "State":                 "state",
    "Zip Code":              "zip",
    "County":                "county",
    "Service Area / Region": "service_area",
    "CoC / BOS Status":      "coc_status",
    "CoC Name":              "coc_name",
    "CoC County Class":      "coc_county_class",
    "Primary Contact Name":  "contact_name",
    "Title / Role":          "contact_title",
    "Main Phone":            "main_phone",
    "Direct Phone":          "direct_phone",
    "Email":                 "email",
    "Website":               "website",
    "Facebook":              "facebook",
    "Instagram":             "instagram",
    "Primary Category":      "primary_category",
    "Sub-Category":          "sub_category",
    "Service Tags":          "service_tags",
    "Population Served":     "population_served",
    "Eligibility Notes":     "eligibility_notes",
    "Hours of Operation":    "hours",
    "Fees / Cost":           "fees",
    "Referral Required":     "referral_required",
    "Intake Process":        "intake_process",
    "Required Documents":    "required_docs",
    "Date Added":            "date_added",
    "Date Last Verified":    "date_last_verified",
    "Contact Info Valid":    "contact_info_valid",
    "Last Contact Date":     "last_contact_date",
    "Last Contact Method":   "last_contact_method",
    "Follow-Up Notes":       "follow_up_notes",
    "Next Follow-Up Date":   "next_follow_up_date",
    "Partnership Status":    "partnership_status",
    "Relationship Owner":    "relationship_owner",
    "Priority":              "priority",
    "Duplicate Flag":        "duplicate_flag",
    "Duplicate Of (Rec ID)": "duplicate_of",
    "Verified Active":       "verified_active",
    "Data Quality Flag":     "data_quality_flag",
    "Issues / Notes":        "issues_notes",
    "TSE INVITE":            "tse_invite_contact",
}

BOOL_COLS  = {"referral_required", "duplicate_flag"}
DATE_COLS  = {"date_added", "date_last_verified", "last_contact_date",
              "next_follow_up_date"}
TEXT_DEFAULTS = {
    "partnership_status":  "Prospect",
    "priority":            "Medium",
    "contact_info_valid":  "Needs Verification",
    "verified_active":     "Unverified",
    "state":               "GA",
}

def esc(val):
    """Escape a string value for SQL."""
    if val is None:
        return "NULL"
    s = str(val).strip()
    if s == "" or s.lower() in ("nan", "none", "nat"):
        return "NULL"
    s = s.replace("'", "''")
    return f"'{s}'"

def to_bool(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    s = str(val).strip().lower()
    if s in ("yes", "true", "1", "y"):
        return "TRUE"
    if s in ("no", "false", "0", "n"):
        return "FALSE"
    return "NULL"

def to_date(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return "NULL"
    if isinstance(val, (datetime, pd.Timestamp)):
        return f"'{val.strftime('%Y-%m-%d')}'"
    s = str(val).strip()
    if s in ("", "nan", "NaT", "None"):
        return "NULL"
    try:
        dt = pd.to_datetime(s)
        return f"'{dt.strftime('%Y-%m-%d')}'"
    except Exception:
        return "NULL"

def read_sheet(xl, sheet_name, has_tse_invite=False):
    try:
        df = pd.read_excel(xl, sheet_name=sheet_name, header=1)
    except Exception as e:
        print(f"  ⚠ Could not read '{sheet_name}': {e}")
        return pd.DataFrame()
    # Drop rows where Record ID is missing or looks like a header repeat
    if "Record ID" not in df.columns:
        return pd.DataFrame()
    df = df[df["Record ID"].notna()].copy()
    df = df[df["Record ID"].astype(str).str.match(r"^TSE-\d+$")].copy()
    return df

def build_row(row, seen_ids):
    vals = {}
    for excel_col, db_col in COLUMN_MAP.items():
        raw = row.get(excel_col)
        if isinstance(raw, float) and math.isnan(raw):
            raw = None

        if db_col in BOOL_COLS:
            vals[db_col] = to_bool(raw)
        elif db_col in DATE_COLS:
            vals[db_col] = to_date(raw)
        elif raw is None:
            default = TEXT_DEFAULTS.get(db_col)
            vals[db_col] = esc(default) if default else "NULL"
        else:
            s = str(raw).strip()
            if s in ("", "nan", "None", "NaT"):
                default = TEXT_DEFAULTS.get(db_col)
                vals[db_col] = esc(default) if default else "NULL"
            else:
                default_checked = TEXT_DEFAULTS.get(db_col)
                vals[db_col] = esc(s) if s else (esc(default_checked) if default_checked else "NULL")

    # Skip if no record_id or org_name
    rid = vals.get("record_id", "NULL")
    if rid == "NULL":
        return None
    # Deduplicate by record_id
    rid_clean = rid.strip("'")
    if rid_clean in seen_ids:
        return None
    seen_ids.add(rid_clean)

    # org_name fallback
    if vals.get("org_name", "NULL") == "NULL":
        vals["org_name"] = "'(Unknown)'"

    cols = ", ".join(vals.keys())
    placeholders = ", ".join(vals.values())
    return f"  ({placeholders})"

def main():
    if not os.path.exists(XLSX_PATH):
        print(f"❌ File not found: {XLSX_PATH}")
        sys.exit(1)

    print(f"Reading {XLSX_PATH}...")
    xl = pd.ExcelFile(XLSX_PATH)

    rows = []
    seen_ids = set()

    for sheet in ["PRM - Provider Tracker", "Call Sheet"]:
        df = read_sheet(xl, sheet)
        if df.empty:
            print(f"  ⚠ '{sheet}' empty or unreadable — skipping")
            continue
        print(f"  {sheet}: {len(df)} records")
        for _, row in df.iterrows():
            sql_row = build_row(row, seen_ids)
            if sql_row:
                rows.append(sql_row)

    # Inactive Contacts → insert as Do Not Contact leads
    try:
        inactive_df = pd.read_excel(xl, sheet_name="Inactive Contacts", header=0)
        inactive_df = inactive_df[inactive_df["Email"].notna()].copy()
        print(f"  Inactive Contacts: {len(inactive_df)} records")
        next_id = max((int(r.strip("'").replace("TSE-", "")) for r in seen_ids
                       if r.startswith("TSE-") and r[4:].isdigit()), default=999) + 1
        for _, row in inactive_df.iterrows():
            rid = f"TSE-{next_id:04d}"
            next_id += 1
            org  = esc(str(row.get("Organization", "")).strip() or "Unknown")
            email = esc(str(row.get("Email", "")).strip())
            bounce = esc(str(row.get("Bounce Reason", "")).strip())
            date_b = to_date(row.get("Date Bounced"))
            date_r = to_date(row.get("Date Removed"))
            rows.append(
                f"  ('{rid}', {org}, NULL, NULL, NULL, NULL, 'GA', NULL, NULL, NULL, NULL, NULL, NULL, "
                f"NULL, NULL, NULL, NULL, {email}, NULL, NULL, NULL, "
                f"NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, "
                f"NULL, NULL, 'Do Not Contact', 'Low', NULL, 'Needs Verification', "
                f"NULL, NULL, NULL, NULL, NULL, NULL, "
                f"FALSE, NULL, 'Unverified', 'Bounced Email', {bounce}, "
                f"NULL, FALSE, NULL, now(), now())"
            )
    except Exception as e:
        print(f"  ⚠ Inactive Contacts: {e}")

    if not rows:
        print("❌ No rows to insert.")
        sys.exit(1)

    # Build SQL
    all_cols = list(COLUMN_MAP.values()) + [
        "promoted_to_directory", "organization_id", "created_at", "updated_at"
    ]

    # For inactive rows we wrote full tuples; for normal rows we need column headers
    # Split normal vs inactive
    # Simpler: write one INSERT per batch using explicit column list for normal rows
    # and a separate raw INSERT for inactive rows.

    # Re-generate cleanly: use only normal rows from build_row (which returns col=val style)
    # Let's redo: store rows as dicts, then render.

    print(f"\nGenerating SQL for {len(rows)} total records...")

    # Re-run properly storing dicts
    rows_dict = []
    seen_ids2 = set()

    for sheet in ["PRM - Provider Tracker", "Call Sheet"]:
        df = read_sheet(xl, sheet)
        if df.empty:
            continue
        for _, row in df.iterrows():
            vals = {}
            for excel_col, db_col in COLUMN_MAP.items():
                raw = row.get(excel_col)
                if isinstance(raw, float) and math.isnan(raw):
                    raw = None
                if db_col in BOOL_COLS:
                    vals[db_col] = to_bool(raw)
                elif db_col in DATE_COLS:
                    vals[db_col] = to_date(raw)
                else:
                    if raw is None:
                        default = TEXT_DEFAULTS.get(db_col)
                        vals[db_col] = esc(default) if default else "NULL"
                    else:
                        s = str(raw).strip()
                        if s in ("", "nan", "None", "NaT"):
                            default = TEXT_DEFAULTS.get(db_col)
                            vals[db_col] = esc(default) if default else "NULL"
                        else:
                            vals[db_col] = esc(s)

            rid = vals.get("record_id", "NULL")
            if rid == "NULL":
                continue
            rid_clean = rid.strip("'")
            if rid_clean in seen_ids2:
                continue
            seen_ids2.add(rid_clean)
            if vals.get("org_name", "NULL") == "NULL":
                vals["org_name"] = "'(Unknown)'"
            vals["promoted_to_directory"] = "FALSE"
            vals["organization_id"] = "NULL"
            vals["created_at"] = "now()"
            vals["updated_at"] = "now()"
            rows_dict.append(vals)

    # Inactive contacts as simple rows
    try:
        inactive_df = pd.read_excel(xl, sheet_name="Inactive Contacts", header=0)
        inactive_df = inactive_df[inactive_df["Email"].notna()].copy()
        next_id = max((int(r.strip("'").replace("TSE-", "")) for r in seen_ids2
                       if r.startswith("TSE-") and r[4:].isdigit()), default=999) + 1
        for _, row in inactive_df.iterrows():
            rid = f"TSE-{next_id:04d}"
            next_id += 1
            d = {k: "NULL" for k in COLUMN_MAP.values()}
            d["record_id"]         = esc(rid)
            d["org_name"]          = esc(str(row.get("Organization", "Unknown")).strip() or "Unknown")
            d["email"]             = esc(str(row.get("Email", "")).strip())
            d["partnership_status"]= "'Do Not Contact'"
            d["priority"]          = "'Low'"
            d["contact_info_valid"]= "'Needs Verification'"
            d["state"]             = "'GA'"
            d["verified_active"]   = "'Unverified'"
            d["data_quality_flag"] = "'Bounced Email'"
            d["issues_notes"]      = esc(str(row.get("Bounce Reason", "")).strip())
            d["duplicate_flag"]    = "FALSE"
            d["promoted_to_directory"] = "FALSE"
            d["organization_id"]   = "NULL"
            d["created_at"]        = "now()"
            d["updated_at"]        = "now()"
            rows_dict.append(d)
    except Exception:
        pass

    # All columns in consistent order
    col_order = list(COLUMN_MAP.values()) + ["promoted_to_directory", "organization_id", "created_at", "updated_at"]

    BATCH = 50
    batches = [rows_dict[i:i+BATCH] for i in range(0, len(rows_dict), BATCH)]

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write("-- PRM Import Data\n")
        f.write(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"-- Records: {len(rows_dict)}\n\n")
        f.write("-- Run this AFTER executing prm_schema.sql\n\n")

        for i, batch in enumerate(batches):
            col_str = ", ".join(col_order)
            f.write(f"INSERT INTO prm_leads ({col_str})\nVALUES\n")
            value_rows = []
            for rd in batch:
                vals_ordered = [rd.get(c, "NULL") for c in col_order]
                value_rows.append("  (" + ", ".join(vals_ordered) + ")")
            f.write(",\n".join(value_rows))
            f.write("\nON CONFLICT (record_id) DO NOTHING;\n\n")

    print(f"✅ Done — {len(rows_dict)} records written to:\n   {OUT_PATH}")
    print("\nNext steps:")
    print("  1. Open Supabase Dashboard → SQL Editor")
    print("  2. Run supabase/prm_schema.sql first")
    print("  3. Then run supabase/prm_import_data.sql")

if __name__ == "__main__":
    main()
