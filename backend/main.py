from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader, PdfWriter

import os
import uuid
import pdfplumber
import pandas as pd
import re
import sqlite3
from datetime import datetime
import cv2
import numpy as np
from pdf2image import convert_from_path

try:
    from paddleocr import PPStructureV3
except Exception:
    PPStructureV3 = None

from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.utils import get_column_letter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs")
DB_PATH = os.path.join(BASE_DIR, "app.db")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# =========================
# AI TABLE PARSER (OPTIONAL)
# =========================
AI_PARSER_AVAILABLE = False
ai_parser = None

if PPStructureV3 is not None:
    try:
        ai_parser = PPStructureV3(
            lang="en",
            device="cpu",
            use_doc_orientation_classify=True,
            use_doc_unwarping=True
        )
        AI_PARSER_AVAILABLE = True
        print("AI parser loaded successfully.")
    except Exception as e:
        print("AI parser init failed:", str(e))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            original_file_name TEXT,
            safe_file_name TEXT,
            uploaded_at TEXT,
            status TEXT,
            company_name TEXT,
            company_address TEXT,
            company_city TEXT,
            company_country TEXT,
            buyer_name TEXT,
            buyer_address TEXT,
            buyer_city TEXT,
            buyer_country TEXT,
            invoice_number TEXT,
            invoice_date TEXT,
            incoterms TEXT,
            country_export TEXT,
            country_import TEXT,
            port_of_loading TEXT,
            port_of_discharge TEXT,
            transport_mode TEXT,
            total_line_items INTEGER,
            total_quantity TEXT,
            total_value TEXT,
            total_gross_weight TEXT,
            total_net_weight TEXT,
            total_weight TEXT,
            total_number_of_lines INTEGER,
            origin_verified INTEGER,
            weight_matched INTEGER,
            data_sources INTEGER
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS merged_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT,
            row_index INTEGER,
            row_json TEXT,
            FOREIGN KEY(job_id) REFERENCES jobs(id)
        )
    """)

    conn.commit()
    conn.close()


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def home():
    return {
        "message": "UAE Customs Automation Backend Running",
        "ai_parser_available": AI_PARSER_AVAILABLE
    }


def clean_cell(cell):
    if cell is None:
        return ""
    text = str(cell).replace("\n", " ").replace("\r", " ").strip()
    text = re.sub(r"\s+", " ", text)
    return text


def group_words_into_rows(words, y_tolerance=6):
    rows = []

    for word in sorted(words, key=lambda w: (w["top"], w["x0"])):
        placed = False

        for row in rows:
            if abs(row["top"] - word["top"]) <= y_tolerance:
                row["words"].append(word)
                row["tops"].append(word["top"])
                row["top"] = sum(row["tops"]) / len(row["tops"])
                placed = True
                break

        if not placed:
            rows.append({
                "top": word["top"],
                "tops": [word["top"]],
                "words": [word]
            })

    return rows


def row_to_text_cells(row_words):
    row_words = sorted(row_words, key=lambda w: w["x0"])
    return [w["text"].strip() for w in row_words if w["text"].strip()]


def detect_borderless_columns(words, min_repeats=3, bucket_size=25):
    buckets = {}

    for w in words:
        x = int(w["x0"] // bucket_size) * bucket_size
        buckets[x] = buckets.get(x, 0) + 1

    candidate_x = [x for x, count in buckets.items() if count >= min_repeats]
    candidate_x.sort()

    if len(candidate_x) < 2:
        return []

    merged = [candidate_x[0]]
    for x in candidate_x[1:]:
        if abs(x - merged[-1]) > bucket_size:
            merged.append(x)

    return merged


def assign_words_to_columns(row_words, column_starts):
    row_words = sorted(row_words, key=lambda w: w["x0"])
    cells = [""] * len(column_starts)

    for w in row_words:
        x = w["x0"]
        col_idx = 0

        for i, start in enumerate(column_starts):
            if i == len(column_starts) - 1:
                col_idx = i
                break
            if start <= x < column_starts[i + 1]:
                col_idx = i
                break

        if cells[col_idx]:
            cells[col_idx] += " " + w["text"].strip()
        else:
            cells[col_idx] = w["text"].strip()

    return [c.strip() for c in cells]


def looks_like_borderless_header(row):
    text = " ".join(str(c).lower() for c in row if str(c).strip())
    keywords = ["item", "description", "qty", "quantity", "rate", "price", "amount", "total"]
    matches = sum(1 for k in keywords if k in text)
    return matches >= 2


def extract_borderless_tables_from_page(page):
    words = page.extract_words(
        x_tolerance=2,
        y_tolerance=2,
        keep_blank_chars=False,
        use_text_flow=True
    )

    if not words:
        return []

    rows = group_words_into_rows(words, y_tolerance=5)
    if not rows:
        return []

    column_starts = detect_borderless_columns(words, min_repeats=3, bucket_size=30)
    if len(column_starts) < 2:
        return []

    rebuilt = []
    for row in rows:
        cells = assign_words_to_columns(row["words"], column_starts)

        if any(str(c).strip() for c in cells):
            rebuilt.append(cells)

    cleaned = []
    for row in rebuilt:
        non_empty = sum(1 for c in row if str(c).strip())
        if non_empty >= 2:
            cleaned.append(row)

    if len(cleaned) < 2:
        return []

    header_found = any(looks_like_borderless_header(r) for r in cleaned[:5])
    if not header_found:
        return []

    return cleaned


def normalize_spaces(text):
    return re.sub(r"\s+", " ", str(text)).strip()


def sanitize_filename(name):
    name = os.path.splitext(name)[0]
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r"\s+", "_", name.strip())
    return name


def is_empty_row(row):
    return all(str(cell).strip() == "" for cell in row)


def row_non_empty_count(row):
    return sum(1 for cell in row if str(cell).strip() != "")


def row_text(row):
    return " ".join(str(cell).strip().lower() for cell in row if str(cell).strip() != "")


def parse_number(text):
    if text is None:
        return None
    value = str(text).strip()
    if not value:
        return None

    value = value.replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", value)
    if not match:
        return None

    try:
        return float(match.group())
    except Exception:
        return None


def looks_like_item_header(row):
    text = row_text(row)
    header_keywords = [
        "item", "description", "qty", "quantity", "unit", "price", "rate",
        "amount", "total", "value", "hs code", "origin", "country",
        "gross weight", "net weight", "arabic description"
    ]
    matches = sum(1 for keyword in header_keywords if keyword in text)
    return matches >= 2


def is_total_row(row):
    text = row_text(row)
    total_keywords = [
        "subtotal", "sub total", "grand total", "invoice total",
        "total qty", "total quantity", "total quantities",
        "total gross weight", "total net weight",
        "gross weight total", "net weight total", "net total",
    ]

    if any(keyword in text for keyword in total_keywords):
        return True

    if "total" in text and not looks_like_item_header(row):
        return True

    return False


def is_noise_row(row):
    text = row_text(row)

    noise_keywords = [
        "tel", "telephone", "fax", "email", "www", "website",
        "po box", "p.o. box", "trn", "vat", "customer copy",
        "page ", "bank", "swift", "iban", "beneficiary",
        "signature", "stamp", "authorized signatory",
        "shipper", "consignee"
    ]

    if any(keyword in text for keyword in noise_keywords):
        if not is_total_row(row):
            return True

    return False


def normalize_rows(table):
    cleaned_rows = []

    for row in table:
        row = [clean_cell(cell) for cell in row]

        if is_empty_row(row):
            continue

        if row_non_empty_count(row) < 2 and not is_total_row(row):
            continue

        if is_noise_row(row):
            continue

        cleaned_rows.append(row)

    if not cleaned_rows:
        return []

    max_cols = max(len(row) for row in cleaned_rows)
    normalized = [row + [""] * (max_cols - len(row)) for row in cleaned_rows]

    df = pd.DataFrame(normalized)
    df = df.replace("", pd.NA).dropna(axis=1, how="all").fillna("")

    return df.values.tolist()


def merge_multiline_rows(rows):
    if not rows:
        return rows

    merged = [rows[0]]

    for row in rows[1:]:
        non_empty = row_non_empty_count(row)

        if is_total_row(row):
            merged.append(row)
            continue

        if non_empty <= 2 and merged:
            prev = merged[-1]
            max_len = max(len(prev), len(row))
            prev = prev + [""] * (max_len - len(prev))
            row = row + [""] * (max_len - len(row))

            for i in range(max_len):
                row_val = str(row[i]).strip()
                prev_val = str(prev[i]).strip()
                if row_val:
                    if prev_val:
                        prev[i] = f"{prev[i]} {row[i]}".strip()
                    else:
                        prev[i] = row[i]
            merged[-1] = prev
        else:
            merged.append(row)

    return merged


def score_table(table):
    if not table:
        return 0

    rows = len(table)
    cols = max(len(r) for r in table) if table else 0
    filled = sum(1 for row in table for cell in row if str(cell).strip() != "")

    header_bonus = 0
    total_bonus = 0

    for row in table[:5]:
        if looks_like_item_header(row):
            header_bonus += 20

    for row in table:
        if is_total_row(row):
            total_bonus += 5

    return (rows * 4) + (cols * 3) + filled + header_bonus + total_bonus


def normalize_rotated_pdf(input_pdf_path, output_pdf_path):
    reader = PdfReader(input_pdf_path)
    writer = PdfWriter()

    changed = False

    for page in reader.pages:
        rotation = page.get("/Rotate", 0)
        rotation = int(rotation) if rotation is not None else 0
        rotation = rotation % 360

        if rotation != 0:
            page.rotate(-rotation)
            changed = True

        writer.add_page(page)

    with open(output_pdf_path, "wb") as f:
        writer.write(f)

    return changed


def get_best_pdf_for_extraction(pdf_path):
    normalized_pdf_path = pdf_path.replace(".pdf", "_upright.pdf")

    try:
        changed = normalize_rotated_pdf(pdf_path, normalized_pdf_path)
        if changed and os.path.exists(normalized_pdf_path):
            return normalized_pdf_path
    except Exception:
        pass

    return pdf_path


def extract_all_tables(pdf_path):
    candidate_tables = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()

            for table in tables:
                cleaned = normalize_rows(table)
                if len(cleaned) >= 2:
                    cleaned = merge_multiline_rows(cleaned)
                    score = score_table(cleaned)

                    if score >= 20:
                        candidate_tables.append({
                            "page": page_num,
                            "table": cleaned,
                            "score": score,
                            "method": "lined"
                        })

            borderless = extract_borderless_tables_from_page(page)
            if borderless:
                cleaned = normalize_rows(borderless)
                if len(cleaned) >= 2:
                    cleaned = merge_multiline_rows(cleaned)
                    score = score_table(cleaned) + 10

                    if score >= 20:
                        candidate_tables.append({
                            "page": page_num,
                            "table": cleaned,
                            "score": score,
                            "method": "borderless"
                        })

    return candidate_tables


# =========================
# AI FALLBACK EXTRACTION
# =========================
def rotate_image_by_angle(img, angle):
    if angle == 90:
        return cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    if angle == 180:
        return cv2.rotate(img, cv2.ROTATE_180)
    if angle == 270:
        return cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return img


def html_table_to_list(html):
    try:
        dfs = pd.read_html(html)
        if not dfs:
            return []
        df = dfs[0].fillna("")
        return df.values.tolist()
    except Exception:
        return []


def normalize_ai_table(table):
    if not table:
        return []

    cleaned = []
    for row in table:
        normalized_row = [clean_cell(cell) for cell in row]
        if not is_empty_row(normalized_row):
            cleaned.append(normalized_row)

    if not cleaned:
        return []

    if len(cleaned) >= 2:
        cleaned = merge_multiline_rows(cleaned)

    return normalize_rows(cleaned)


def extract_tables_with_ai(pdf_path):
    if not AI_PARSER_AVAILABLE or ai_parser is None:
        return []

    candidate_tables = []

    try:
        pages = convert_from_path(pdf_path, dpi=300)
    except Exception as e:
        print("AI PDF image conversion failed:", str(e))
        return []

    for page_index, page in enumerate(pages, start=1):
        img = cv2.cvtColor(np.array(page), cv2.COLOR_RGB2BGR)
        best_tables_for_page = []

        for angle in [0, 90, 180, 270]:
            rotated = rotate_image_by_angle(img, angle)

            try:
                result = ai_parser.predict(rotated)
            except Exception:
                try:
                    result = ai_parser(rotated)
                except Exception:
                    continue

            if not result:
                continue

            parsed_blocks = []
            if isinstance(result, list):
                parsed_blocks = result
            else:
                try:
                    parsed_blocks = list(result)
                except Exception:
                    parsed_blocks = []

            for block in parsed_blocks:
                try:
                    block_type = block.get("type", "")
                    if block_type != "table":
                        continue

                    res_data = block.get("res", {})
                    html = ""

                    if isinstance(res_data, dict):
                        html = res_data.get("html", "") or res_data.get("table_html", "")

                    if not html:
                        continue

                    table = html_table_to_list(html)
                    table = normalize_ai_table(table)

                    if len(table) >= 2:
                        score = score_table(table) + 30
                        best_tables_for_page.append({
                            "page": page_index,
                            "table": table,
                            "score": score,
                            "method": f"ai_rot_{angle}"
                        })
                except Exception:
                    continue

        if best_tables_for_page:
            best_tables_for_page = sorted(best_tables_for_page, key=lambda x: x["score"], reverse=True)

            page_selected = []
            seen_signatures = set()

            for item in best_tables_for_page:
                signature = str(item["table"][:3])
                if signature in seen_signatures:
                    continue
                seen_signatures.add(signature)
                page_selected.append(item)
                if len(page_selected) >= 2:
                    break

            candidate_tables.extend(page_selected)

    return candidate_tables


def normalize_header_text(row):
    return tuple(re.sub(r"\s+", " ", str(cell).strip().lower()) for cell in row)


def combine_all_tables(candidate_tables):
    if not candidate_tables:
        return []

    candidate_tables = sorted(candidate_tables, key=lambda x: (x["page"], -x["score"]))

    combined_rows = []
    master_header = None
    seen_headers = set()

    for item in candidate_tables:
        table = item["table"]
        if not table:
            continue

        first_row = table[0]

        if looks_like_item_header(first_row):
            header_key = normalize_header_text(first_row)

            if master_header is None:
                master_header = first_row
                combined_rows.append(first_row)
                seen_headers.add(header_key)

            start_index = 1
        else:
            start_index = 0
            if master_header is None:
                master_header = first_row
                combined_rows.append(first_row)
                start_index = 1

        for row in table[start_index:]:
            if looks_like_item_header(row):
                header_key = normalize_header_text(row)
                if header_key in seen_headers:
                    continue
                seen_headers.add(header_key)
                continue

            combined_rows.append(row)

    if not combined_rows:
        return []

    max_cols = max(len(r) for r in combined_rows)
    normalized = [r + [""] * (max_cols - len(r)) for r in combined_rows]

    unique_rows = []
    seen = set()
    for row in normalized:
        key = tuple(str(c).strip() for c in row)
        if key not in seen:
            seen.add(key)
            unique_rows.append(row)

    return unique_rows


def find_column_index(header_row, keywords):
    for i, cell in enumerate(header_row):
        cell_text = str(cell).strip().lower()
        for keyword in keywords:
            if keyword in cell_text:
                return i
    return None


def find_last_number_in_row(row):
    nums = [parse_number(c) for c in row if parse_number(c) is not None]
    return nums[-1] if nums else None


def to_display_number(value):
    if value in ("", None):
        return ""
    try:
        num = float(value)
        if num.is_integer():
            return str(int(num))
        return f"{num:.2f}"
    except Exception:
        return str(value)


def build_summary(table):
    summary = {
        "Total Line Items": 0,
        "Total Quantity": "",
        "Total Value": "",
        "Total Gross Weight": "",
        "Total Net Weight": "",
        "Total Number of Lines": 0
    }

    if not table:
        return summary

    summary["Total Number of Lines"] = len(table)

    if len(table) < 2:
        return summary

    header = table[0]
    data_rows = table[1:]

    qty_idx = find_column_index(header, ["qty", "quantity"])
    amount_idx = find_column_index(header, ["amount", "value", "line total", "total"])
    gross_idx = find_column_index(header, ["gross weight", "gross wt", "g.w", "gw"])
    net_idx = find_column_index(header, ["net weight", "net wt", "n.w", "nw"])
    origin_idx = find_column_index(header, ["origin", "country"])
    source_idx = find_column_index(header, ["source"])

    line_items = 0
    calc_qty = 0.0
    calc_value = 0.0
    calc_gross = 0.0
    calc_net = 0.0
    origin_verified = 0
    weight_matched = 0
    data_sources = set()

    explicit_qty_total = None
    explicit_value_total = None
    explicit_gross_total = None
    explicit_net_total = None

    for row in data_rows:
        txt = row_text(row)

        if is_total_row(row):
            last_num = find_last_number_in_row(row)

            if ("qty" in txt or "quantity" in txt) and last_num is not None:
                explicit_qty_total = last_num
            elif "gross" in txt and last_num is not None:
                explicit_gross_total = last_num
            elif "net" in txt and last_num is not None:
                explicit_net_total = last_num
            elif ("total" in txt or "amount" in txt or "value" in txt or "subtotal" in txt) and last_num is not None:
                explicit_value_total = last_num

            continue

        if row_non_empty_count(row) >= 2:
            line_items += 1

        if qty_idx is not None and qty_idx < len(row):
            num = parse_number(row[qty_idx])
            if num is not None:
                calc_qty += num

        if amount_idx is not None and amount_idx < len(row):
            num = parse_number(row[amount_idx])
            if num is not None:
                calc_value += num

        if gross_idx is not None and gross_idx < len(row):
            num = parse_number(row[gross_idx])
            if num is not None:
                calc_gross += num

        if net_idx is not None and net_idx < len(row):
            num = parse_number(row[net_idx])
            if num is not None:
                calc_net += num

        if origin_idx is not None and origin_idx < len(row):
            origin_val = str(row[origin_idx]).strip()
            if origin_val and origin_val != "-":
                origin_verified += 1

        if gross_idx is not None and net_idx is not None and gross_idx < len(row) and net_idx < len(row):
            gross_val = str(row[gross_idx]).strip()
            net_val = str(row[net_idx]).strip()
            if gross_val and gross_val != "-" and net_val and net_val != "-":
                weight_matched += 1

        if source_idx is not None and source_idx < len(row):
            source_val = str(row[source_idx]).strip()
            if source_val:
                data_sources.add(source_val)

    summary["Total Line Items"] = line_items
    summary["Total Quantity"] = to_display_number(
        explicit_qty_total if explicit_qty_total is not None else (calc_qty if calc_qty != 0 else "")
    )
    summary["Total Value"] = to_display_number(
        explicit_value_total if explicit_value_total is not None else (calc_value if calc_value != 0 else "")
    )
    summary["Total Gross Weight"] = to_display_number(
        explicit_gross_total if explicit_gross_total is not None else (calc_gross if calc_gross != 0 else "")
    )
    summary["Total Net Weight"] = to_display_number(
        explicit_net_total if explicit_net_total is not None else (calc_net if calc_net != 0 else "")
    )
    summary["Origin Verified Count"] = origin_verified
    summary["Weight Matched Count"] = weight_matched
    summary["Data Sources Count"] = len(data_sources) if data_sources else 1

    return summary


def extract_text_lines(pdf_path, page_limit=2):
    lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages[:page_limit]:
            text = page.extract_text() or ""
            for line in text.split("\n"):
                line = normalize_spaces(line)
                if line:
                    lines.append(line)
    return lines


def extract_company_info(pdf_path):
    company_info = {
        "Company Name": "",
        "Address": "",
        "Phone": "",
        "Email": "",
        "Invoice Number": "",
        "Invoice Date": "",
        "Buyer Name": "",
        "Buyer Address": "",
        "Buyer City": "",
        "Buyer Country": "",
        "Seller City": "",
        "Seller Country": "",
        "Country of Export": "",
        "Country of Import": "",
        "Port of Loading": "",
        "Port of Discharge": "",
        "Transport Mode": "",
        "Incoterms": ""
    }

    with pdfplumber.open(pdf_path) as pdf:
        first_page_text = pdf.pages[0].extract_text() or ""

    lines = [normalize_spaces(line) for line in first_page_text.split("\n") if normalize_spaces(line)]

    for line in lines[:10]:
        if 3 < len(line) < 100:
            if not re.search(r"invoice|date|address|phone|email|tel|fax|buyer|consignee", line, re.I):
                company_info["Company Name"] = line
                break

    address_lines = []
    for line in lines[:20]:
        lower = line.lower()
        if any(word in lower for word in ["street", "road", "building", "dubai", "sharjah", "abu dhabi", "uae", "po box", "box", "rak", "riyadh"]):
            address_lines.append(line)
    company_info["Address"] = ", ".join(address_lines[:3])

    phone_match = re.search(r"(\+?\d[\d\s\-()]{6,}\d)", first_page_text)
    if phone_match:
        company_info["Phone"] = phone_match.group(1).strip()

    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", first_page_text)
    if email_match:
        company_info["Email"] = email_match.group(0)

    inv_match = re.search(r"(invoice\s*(no|number)?[:\-\s]*)([A-Za-z0-9\/\-]+)", first_page_text, re.I)
    if inv_match:
        company_info["Invoice Number"] = inv_match.group(3).strip()

    date_match = re.search(r"(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b)", first_page_text)
    if date_match:
        company_info["Invoice Date"] = date_match.group(1).strip()

    incoterms_match = re.search(r"\b(EXW|FOB|CIF|CFR|DAP|DDP|FCA|CPT|CIP)\b", first_page_text, re.I)
    if incoterms_match:
        company_info["Incoterms"] = incoterms_match.group(1).upper()

    buyer_match = re.search(r"(buyer|consignee|importer)[:\s]*(.+)", first_page_text, re.I)
    if buyer_match:
        company_info["Buyer Name"] = normalize_spaces(buyer_match.group(2))

    lines_all = extract_text_lines(pdf_path, page_limit=2)
    for line in lines_all:
        low = line.lower()

        if not company_info["Buyer Name"] and any(k in low for k in ["buyer", "consignee", "importer"]):
            cleaned = re.sub(r"^(buyer|consignee|importer)\s*[:\-]?\s*", "", line, flags=re.I).strip()
            if cleaned:
                company_info["Buyer Name"] = cleaned

        if not company_info["Port of Loading"] and ("port of loading" in low or "loading port" in low):
            cleaned = re.sub(r"^(port of loading|loading port)\s*[:\-]?\s*", "", line, flags=re.I).strip()
            company_info["Port of Loading"] = cleaned

        if not company_info["Port of Discharge"] and ("port of discharge" in low or "discharge port" in low):
            cleaned = re.sub(r"^(port of discharge|discharge port)\s*[:\-]?\s*", "", line, flags=re.I).strip()
            company_info["Port of Discharge"] = cleaned

        if not company_info["Transport Mode"] and ("transport mode" in low or "mode of transport" in low):
            cleaned = re.sub(r"^(transport mode|mode of transport)\s*[:\-]?\s*", "", line, flags=re.I).strip()
            company_info["Transport Mode"] = cleaned

        if not company_info["Country of Export"] and ("country of export" in low or "export country" in low):
            cleaned = re.sub(r"^(country of export|export country)\s*[:\-]?\s*", "", line, flags=re.I).strip()
            company_info["Country of Export"] = cleaned

        if not company_info["Country of Import"] and ("country of import" in low or "import country" in low):
            cleaned = re.sub(r"^(country of import|import country)\s*[:\-]?\s*", "", line, flags=re.I).strip()
            company_info["Country of Import"] = cleaned

    upper_address = company_info["Address"].upper()
    if "UAE" in upper_address or "DUBAI" in upper_address or "SHARJAH" in upper_address or "RAK" in upper_address:
        company_info["Seller Country"] = "AE"
    if "RIYADH" in " ".join(lines_all).upper():
        company_info["Buyer City"] = "Riyadh"
        company_info["Buyer Country"] = "SA"

    if not company_info["Country of Export"] and company_info["Seller Country"]:
        company_info["Country of Export"] = company_info["Seller Country"]

    if "DUBAI" in upper_address:
        company_info["Seller City"] = "Dubai"
    elif "SHARJAH" in upper_address:
        company_info["Seller City"] = "Sharjah"
    elif "RAK" in upper_address:
        company_info["Seller City"] = "RAK"

    if not company_info["Country of Import"] and company_info["Buyer Country"]:
        company_info["Country of Import"] = company_info["Buyer Country"]

    return company_info


def add_source_column_if_missing(table):
    if not table:
        return table

    header = table[0]
    normalized = [str(h).strip().lower() for h in header]
    if "source" in normalized:
        return table

    new_table = []
    new_header = header + ["Source"]
    new_table.append(new_header)

    for row in table[1:]:
        new_table.append(row + ["CI"])

    return new_table


def is_summary_row(row):
    text = " ".join(str(cell).strip().lower() for cell in row if str(cell).strip())

    summary_keywords = [
        "subtotal",
        "sub total",
        "invoice total",
        "grand total",
        "total amount",
        "net total",
        "final invoice value",
        "discount",
        "less:",
        "total:"
    ]

    return any(keyword in text for keyword in summary_keywords)


def filter_items_only(table):
    if not table:
        return table

    filtered = []

    for i, row in enumerate(table):
        if i == 0:
            filtered.append(row)
            continue

        if is_summary_row(row):
            continue

        filtered.append(row)

    return filtered


def convert_cell_to_number(cell):
    if cell is None:
        return ""

    value = str(cell).strip()
    if value == "":
        return ""

    if re.fullmatch(r"0\d+", value):
        return value

    cleaned = value.replace(",", "")
    cleaned = cleaned.replace("$", "")
    cleaned = cleaned.replace("AED", "")
    cleaned = cleaned.replace("USD", "")
    cleaned = cleaned.replace("SAR", "")
    cleaned = cleaned.strip()

    if re.fullmatch(r"\(\d+(\.\d+)?\)", cleaned):
        cleaned = "-" + cleaned[1:-1]

    if re.fullmatch(r"-?\d+", cleaned):
        try:
            return int(cleaned)
        except Exception:
            return value

    if re.fullmatch(r"-?\d+\.\d+", cleaned):
        try:
            return float(cleaned)
        except Exception:
            return value

    return value


def convert_table_numeric_values(table):
    if not table:
        return table

    converted = []

    for row_index, row in enumerate(table):
        if row_index == 0:
            converted.append(row)
            continue

        converted.append([convert_cell_to_number(cell) for cell in row])

    return converted


def build_preview_rows(table, limit=10):
    if not table:
        return []

    preview = []
    for i, row in enumerate(table):
        preview.append([str(cell) for cell in row])
        if i >= limit:
            break
    return preview


def apply_excel_formatting(excel_path):
    wb = load_workbook(excel_path)

    header_fill = PatternFill(fill_type="solid", fgColor="1F4E78")
    header_font = Font(color="FFFFFF", bold=True)
    sub_header_fill = PatternFill(fill_type="solid", fgColor="D9EAF7")
    bold_font = Font(bold=True)
    thin_border = Border(
        left=Side(style="thin", color="CCCCCC"),
        right=Side(style="thin", color="CCCCCC"),
        top=Side(style="thin", color="CCCCCC"),
        bottom=Side(style="thin", color="CCCCCC"),
    )
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)

    for ws in wb.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                cell.border = thin_border
                cell.alignment = left_align

        if ws.title == "Items":
            if ws.max_row >= 1:
                for cell in ws[1]:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = center_align

            for row in ws.iter_rows(min_row=2):
                row_values = [str(cell.value).strip().lower() if cell.value is not None else "" for cell in row]
                row_text_value = " ".join(v for v in row_values if v)

                if "total" in row_text_value or "subtotal" in row_text_value:
                    for cell in row:
                        cell.fill = sub_header_fill
                        cell.font = bold_font
        else:
            if ws.max_row >= 1:
                for cell in ws[1]:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = center_align

            for row in ws.iter_rows(min_row=2):
                if ws.title in ["Company Info", "Summary"]:
                    if row[0].value:
                        row[0].font = bold_font
                        row[0].fill = sub_header_fill

        for col_idx, col_cells in enumerate(ws.columns, start=1):
            max_length = 0
            for cell in col_cells:
                try:
                    value = str(cell.value) if cell.value is not None else ""
                    max_length = max(max_length, len(value))
                except Exception:
                    pass

            adjusted_width = min(max_length + 3, 40)
            ws.column_dimensions[get_column_letter(col_idx)].width = adjusted_width

        ws.freeze_panes = "A2"

    wb.save(excel_path)


def save_job(job_id, original_file_name, safe_file_name, payload, merged_items):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("DELETE FROM merged_items WHERE job_id = ?", (job_id,))
    cur.execute("DELETE FROM jobs WHERE id = ?", (job_id,))

    cur.execute("""
        INSERT INTO jobs (
            id, original_file_name, safe_file_name, uploaded_at, status,
            company_name, company_address, company_city, company_country,
            buyer_name, buyer_address, buyer_city, buyer_country,
            invoice_number, invoice_date, incoterms,
            country_export, country_import, port_of_loading, port_of_discharge, transport_mode,
            total_line_items, total_quantity, total_value, total_gross_weight, total_net_weight,
            total_weight, total_number_of_lines, origin_verified, weight_matched, data_sources
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job_id,
        original_file_name,
        safe_file_name,
        payload["uploaded_at"],
        payload["status"],
        payload["company_name"],
        payload["company_address"],
        payload["company_city"],
        payload["company_country"],
        payload["buyer_name"],
        payload["buyer_address"],
        payload["buyer_city"],
        payload["buyer_country"],
        payload["invoice_number"],
        payload["invoice_date"],
        payload["incoterms"],
        payload["country_export"],
        payload["country_import"],
        payload["port_of_loading"],
        payload["port_of_discharge"],
        payload["transport_mode"],
        payload["total_line_items"],
        payload["total_quantity"],
        payload["total_value"],
        payload["total_gross_weight"],
        payload["total_net_weight"],
        payload["total_weight"],
        payload["total_number_of_lines"],
        payload["origin_verified"],
        payload["weight_matched"],
        payload["data_sources"],
    ))

    import json
    for idx, row in enumerate(merged_items):
        cur.execute(
            "INSERT INTO merged_items (job_id, row_index, row_json) VALUES (?, ?, ?)",
            (job_id, idx, json.dumps(row))
        )

    conn.commit()
    conn.close()


@app.post("/upload-pdf/")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")

    file_id = str(uuid.uuid4())
    safe_original_name = sanitize_filename(file.filename)
    uploaded_at = datetime.now().strftime("%d %b %Y, %I:%M %p")

    pdf_path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")
    excel_path = os.path.join(OUTPUT_DIR, f"{file_id}.xlsx")

    with open(pdf_path, "wb") as f:
        f.write(await file.read())

    working_pdf_path = get_best_pdf_for_extraction(pdf_path)

    try:
        candidate_tables = extract_all_tables(working_pdf_path)

        if not candidate_tables:
            print("No tables found with standard extraction. Trying AI parser...")
            candidate_tables = extract_tables_with_ai(working_pdf_path)

        if not candidate_tables:
            raise HTTPException(status_code=400, detail="No usable tables found in the PDF.")

        combined_table = combine_all_tables(candidate_tables)
        if not combined_table:
            raise HTTPException(status_code=400, detail="Could not combine extracted tables.")

        combined_table = add_source_column_if_missing(combined_table)

        company_info = extract_company_info(working_pdf_path)
        summary = build_summary(combined_table)

        combined_table = filter_items_only(combined_table)
        combined_table = convert_table_numeric_values(combined_table)

        items_df = pd.DataFrame(combined_table)
        company_df = pd.DataFrame(list(company_info.items()), columns=["Field", "Value"])
        summary_df = pd.DataFrame(list(summary.items()), columns=["Field", "Value"])

        with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
            items_df.to_excel(writer, sheet_name="Items", index=False, header=False)
            company_df.to_excel(writer, sheet_name="Company Info", index=False)
            summary_df.to_excel(writer, sheet_name="Summary", index=False)

        apply_excel_formatting(excel_path)

        merged_preview = build_preview_rows(combined_table, limit=50)

        response_payload = {
            "id": file_id,
            "message": "PDF processed successfully",
            "excel_file": f"/download-excel/{file_id}?original_name={safe_original_name}",
            "file_name": file.filename,
            "document_code": safe_original_name,
            "uploaded_at": uploaded_at,
            "status": "Processed",
            "company_name": company_info.get("Company Name", ""),
            "company_address": company_info.get("Address", ""),
            "company_city": company_info.get("Seller City", ""),
            "company_country": company_info.get("Seller Country", ""),
            "buyer_name": company_info.get("Buyer Name", ""),
            "buyer_address": company_info.get("Buyer Address", ""),
            "buyer_city": company_info.get("Buyer City", ""),
            "buyer_country": company_info.get("Buyer Country", ""),
            "invoice_number": company_info.get("Invoice Number", ""),
            "invoice_date": company_info.get("Invoice Date", ""),
            "incoterms": company_info.get("Incoterms", ""),
            "country_export": company_info.get("Country of Export", ""),
            "country_import": company_info.get("Country of Import", ""),
            "port_of_loading": company_info.get("Port of Loading", ""),
            "port_of_discharge": company_info.get("Port of Discharge", ""),
            "transport_mode": company_info.get("Transport Mode", ""),
            "total_line_items": summary.get("Total Line Items", 0),
            "total_quantity": summary.get("Total Quantity", ""),
            "total_value": summary.get("Total Value", ""),
            "total_gross_weight": summary.get("Total Gross Weight", ""),
            "total_net_weight": summary.get("Total Net Weight", ""),
            "total_weight": summary.get("Total Gross Weight", "") or summary.get("Total Net Weight", ""),
            "total_number_of_lines": summary.get("Total Number of Lines", 0),
            "origin_verified": summary.get("Origin Verified Count", 0),
            "weight_matched": summary.get("Weight Matched Count", 0),
            "data_sources": summary.get("Data Sources Count", 1),
            "line_items": summary.get("Total Line Items", 0),
            "merged_line_items": merged_preview,
            "ai_parser_available": AI_PARSER_AVAILABLE
        }

        save_job(file_id, file.filename, safe_original_name, response_payload, merged_preview)
        return response_payload

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@app.get("/dashboard-summary")
def dashboard_summary():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) AS cnt FROM jobs")
    total_files = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM jobs WHERE status = 'Processed'")
    successful = cur.fetchone()["cnt"]

    cur.execute("SELECT COUNT(*) AS cnt FROM jobs WHERE status != 'Processed'")
    pending = cur.fetchone()["cnt"]

    cur.execute("SELECT COALESCE(SUM(total_line_items), 0) AS total_items FROM jobs")
    total_items = cur.fetchone()["total_items"]

    cur.execute("""
        SELECT id, original_file_name, uploaded_at, status, total_line_items, total_value
        FROM jobs
        ORDER BY uploaded_at DESC
        LIMIT 10
    """)
    rows = [dict(r) for r in cur.fetchall()]

    conn.close()

    return {
        "processed_today": total_files,
        "successful_extractions": successful,
        "pending_jobs": pending,
        "excel_exports": total_files,
        "total_items": total_items,
        "recent_uploads": rows,
        "ai_parser_available": AI_PARSER_AVAILABLE
    }


@app.get("/jobs")
def list_jobs():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, original_file_name, uploaded_at, status, total_line_items, total_value
        FROM jobs
        ORDER BY rowid DESC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


@app.get("/jobs/{job_id}")
def get_job(job_id: str):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
    job = cur.fetchone()
    if not job:
        conn.close()
        raise HTTPException(status_code=404, detail="Job not found.")

    cur.execute("SELECT row_json FROM merged_items WHERE job_id = ? ORDER BY row_index ASC", (job_id,))
    rows = cur.fetchall()

    import json
    merged_items = [json.loads(r["row_json"]) for r in rows]

    conn.close()

    result = dict(job)
    result["merged_line_items"] = merged_items
    result["excel_file"] = f"/download-excel/{job_id}?original_name={result['safe_file_name']}"
    result["ai_parser_available"] = AI_PARSER_AVAILABLE
    return result


@app.get("/download-excel/{file_id}")
def download_excel(file_id: str, original_name: str = "file"):
    excel_path = os.path.join(OUTPUT_DIR, f"{file_id}.xlsx")

    if not os.path.exists(excel_path):
        raise HTTPException(status_code=404, detail="Excel file not found.")

    download_name = f"{sanitize_filename(original_name)}_excel_extracted.xlsx"

    return FileResponse(
        path=excel_path,
        filename=download_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )