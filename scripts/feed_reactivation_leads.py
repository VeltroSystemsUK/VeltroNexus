"""Import PECR-safe reactivation leads into internal_leads for SME first-touch."""
import csv
import json
import re
import sqlite3
from pathlib import Path

CSV_PATH = Path(r"F:\Shaun\Desktop\Data\output\recoverable_leads_2026-09-01.csv")
DB_PATH = Path(r"F:\Shaun\Desktop\NEXUS\veltro.db")

KEEP_BANDS = {
    "A_INBOX_CONFIRMED",
    "A2_INBOX_CONFIRMED_ROLE_OR_NONAME",
    "B_CATCH_ALL",
    "C_LIVE_SITE_MX_UNTESTED",
}
DROP_NUMBERS = {
    "05175628",
    "10290925",
    "07160588",
    "09197841",
    "09728689",
    "04286163",
    "11453557",
    "08012384",
    "SC471304",
    "06965411",
    "08546526",
    "07032616",
    "09808715",
}
EXCLUDED_SIC_EXACT = {"41100", "92000", "12000", "46350", "47260"}
EXCLUDED_SIC_PREFIXES = ("64", "65", "66", "68", "92", "12", "7010", "99999")
BROKER_NAME_RE = re.compile(
    r"\b(nacfb|fiba|commercial finance brokers?|finance brokers?|loan brokers?|loan packagers?|money brokers?|finance brokerages?|brokerage ltd|brokerage limited)\b",
    re.I,
)
INTRODUCER_NAME_RE = re.compile(
    r"\b(chartered accountants?|accountants?|accountancy|insolvency|turnaround|restructuring|fractional cfo|tax advisers?)\b",
    re.I,
)
PROPERTY_NAME_RE = re.compile(
    r"\b(property\s+(investment|holdings?|developments?)|gambling|casino|bookmaker|tobacco)\b",
    re.I,
)


def digits(sic: str) -> str:
    return re.sub(r"\D", "", sic or "")


def sic_codes(raw: str) -> list[str]:
    parts = re.split(r"[|,;]", raw or "")
    out = []
    for part in parts:
        code = digits(part)
        if code:
            out.append(code)
    return out


def excluded(name: str, codes: list[str]) -> bool:
    if PROPERTY_NAME_RE.search(name or ""):
        return True
    if BROKER_NAME_RE.search(name or ""):
        return True
    if INTRODUCER_NAME_RE.search(name or ""):
        return True
    for code in codes:
        padded = code.zfill(5) if code.isdigit() else code
        if code in EXCLUDED_SIC_EXACT or padded in EXCLUDED_SIC_EXACT:
            return True
        if any(code.startswith(prefix) or padded.startswith(prefix) for prefix in EXCLUDED_SIC_PREFIXES):
            return True
        if code.startswith("64921") or code.startswith("64922") or padded.startswith("64921"):
            return True
        if code.startswith("692") or code.startswith("7022") or padded.startswith("692") or padded.startswith("7022"):
            return True
    return False


def main():
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    existing = {
        str(r[0]).strip().upper()
        for r in cur.execute("SELECT company_number FROM internal_leads WHERE IFNULL(company_number,'') != ''")
    }
    existing_emails = {
        str(r[0]).strip().lower()
        for r in cur.execute("SELECT email FROM internal_leads WHERE IFNULL(email,'') != ''")
    }

    inserted = 0
    skipped = 0
    for row in rows:
        band = row.get("band") or ""
        if band not in KEEP_BANDS:
            skipped += 1
            continue
        number = (row.get("company_number") or "").strip().upper()
        if number.isdigit():
            number = number.zfill(8)
        email = (row.get("contact_email") or "").strip().lower()
        name = (row.get("company_name") or "").strip()
        if not number or not email or not name:
            skipped += 1
            continue
        if number in DROP_NUMBERS or number in existing or email in existing_emails:
            skipped += 1
            continue
        try:
            amount = float(row.get("amount") or 0)
        except ValueError:
            amount = 0.0
        if band == "C_LIVE_SITE_MX_UNTESTED" and amount < 25000:
            skipped += 1
            continue
        codes = sic_codes(row.get("sic") or "")
        if excluded(name, codes):
            skipped += 1
            continue
        first = (row.get("contact_first_name") or "").strip()
        notes = (
            f"Reactivation 2026-09-01 | {band} | historical enquiry £{amount:,.0f} | "
            f"SMTP {row.get('smtp')} | source Data3/CH/email_validated/August retain"
        )
        contacts = json.dumps(
            [{"name": first or name, "role": "Director", "email": email, "linkedinUrl": None, "phone": None}]
        )
        cur.execute(
            """
            INSERT INTO internal_leads (
              company_name, company_number, contact_name, email, status, notes,
              estimated_value, address, website, sic_code, company_type, contacts,
              has_charges, total_charges_count, satisfied_charges_count, possible_duplicate
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,0,0,0)
            """,
            (
                name,
                number,
                first or None,
                email,
                "new",
                notes,
                int(amount) if amount else None,
                (row.get("address") or "").strip() or None,
                (row.get("website") or "").strip() or None,
                codes[0] if codes else None,
                (row.get("legal_form") or "").strip() or None,
                contacts,
            ),
        )
        existing.add(number)
        existing_emails.add(email)
        inserted += 1

    con.commit()
    total = cur.execute("SELECT COUNT(*) FROM internal_leads").fetchone()[0]
    with_email = cur.execute(
        "SELECT COUNT(*) FROM internal_leads WHERE IFNULL(email,'') != ''"
    ).fetchone()[0]
    con.close()
    print(f"inserted={inserted} skipped={skipped} internal_leads={total} with_email={with_email}")


if __name__ == "__main__":
    main()
