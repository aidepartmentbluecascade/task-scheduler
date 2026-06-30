import os
import json
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import gspread
from gspread.utils import rowcol_to_a1
from google.oauth2.service_account import Credentials
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
import uvicorn

load_dotenv()

# Pakistan Standard Time — fixed UTC+5, no DST.
PK_TZ = timezone(timedelta(hours=5))

# ─── Google Sheets setup ──────────────────────────────────────────────────────

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def get_sheet_client():
    creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        raise RuntimeError("GOOGLE_CREDENTIALS_JSON not set in environment")
    creds = Credentials.from_service_account_info(json.loads(creds_json), scopes=SCOPES)
    return gspread.authorize(creds)


def get_workbook():
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if not sheet_id:
        raise RuntimeError("GOOGLE_SHEET_ID not set in environment")
    return get_sheet_client().open_by_key(sheet_id)


def get_or_create_worksheet(wb, name: str, headers: list[str]):
    try:
        ws = wb.worksheet(name)
    except gspread.exceptions.WorksheetNotFound:
        ws = wb.add_worksheet(title=name, rows=1000, cols=len(headers))
        ws.append_row(headers, value_input_option="RAW")
    return ws


# ─── Sheet config ─────────────────────────────────────────────────────────────

TASKS_SHEET = "Tasks"

# Sheet columns:  A         B       C          D            E
TASK_HEADERS = ["id", "New Task", "Status", "Created At", "Updated At"]

VALID_STATUSES = {"To-Do", "In Progress", "Completed"}


# ─── Pydantic models ──────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    status: str = "To-Do"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


# ─── Helpers ─────────────────────────────────────────────────────────────────

def now_str() -> str:
    return datetime.now(PK_TZ).strftime("%d/%m/%Y %I:%M%p")


def rows_to_dicts(ws) -> list[dict]:
    headers = [h for h in ws.row_values(1) if h]
    return ws.get_all_records(expected_headers=headers)


def find_row(ws, task_id: str) -> int:
    """Return 1-based row index for the given task id, or -1."""
    col = ws.col_values(1)
    for i, v in enumerate(col):
        if v == task_id:
            return i + 1
    return -1


def next_task_id(ws) -> str:
    col = ws.col_values(1)[1:]   # skip header row
    highest = 0
    for v in col:
        v = v.strip()
        if v.upper().startswith("TASK "):
            try:
                n = int(v.split()[-1])
                if n > highest:
                    highest = n
            except ValueError:
                pass
    return f"TASK {highest + 1:03d}"


def set_cell(ws, row: int, col_header: str, value):
    """Write value to the cell at (row, col_header) using RAW input."""
    headers = ws.row_values(1)
    col_idx = headers.index(col_header) + 1
    cell = rowcol_to_a1(row, col_idx)
    ws.update(cell, [[value]], value_input_option="RAW")


def ensure_tasks_sheet(wb):
    """Return the Tasks worksheet, migrating headers if needed."""
    ws = get_or_create_worksheet(wb, TASKS_SHEET, TASK_HEADERS)
    current = ws.row_values(1)
    if current != TASK_HEADERS:
        if ws.col_count < len(TASK_HEADERS):
            ws.add_cols(len(TASK_HEADERS) - ws.col_count)
        ws.update("A1", [TASK_HEADERS], value_input_option="RAW")
    return ws


def wipe_old_sheets(wb):
    """Delete legacy Kanban sheets (Cards, Columns) if they exist."""
    for sheet_name in ("Cards", "Columns"):
        try:
            ws = wb.worksheet(sheet_name)
            wb.del_worksheet(ws)
            print(f"🗑️  Deleted legacy sheet: {sheet_name}")
        except gspread.exceptions.WorksheetNotFound:
            pass


# ─── PostgreSQL helpers ───────────────────────────────────────────────────────

DB_URL = "postgresql://n8n_connection_user:QbPfXanjXKi8aCZteQGwkuFCiUlCV8wd@dpg-d444b62dbo4c73b8k5i0-a.oregon-postgres.render.com:5432/bot_test"

def get_db_conn():
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


# ─── App lifespan ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        wb = get_workbook()
        wipe_old_sheets(wb)
        ensure_tasks_sheet(wb)
        print("✅ Google Sheets initialised (Tasks sheet ready)")
    except Exception as e:
        print(f"⚠️  Sheet init warning: {e}")
    yield


app = FastAPI(title="Task Manager API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
#  AUTH endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/auth/login")
def login(payload: LoginRequest):
    try:
        conn = get_db_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT pm_id, name, email FROM public.project_managers WHERE email = %s AND password = %s",
            (payload.email.strip(), payload.password.strip())
        )
        user = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "pm_id": user["pm_id"],
        "name":  user["name"],
        "email": user["email"],
    }


@app.post("/auth/logout")
def logout():
    # Stateless — client discards the session. Endpoint exists for explicit calls.
    return {"message": "Logged out successfully"}


# ══════════════════════════════════════════════════════════════════════════════
#  TASKS endpoints
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/tasks")
def list_tasks():
    wb = get_workbook()
    ws = ensure_tasks_sheet(wb)
    records = rows_to_dicts(ws)
    return [
        {
            "id":         r["id"],
            "title":      r["New Task"],
            "status":     r["Status"],
            "created_at": r.get("Created At", ""),
            "updated_at": r.get("Updated At", ""),
        }
        for r in records if r.get("id")
    ]


@app.post("/tasks", status_code=201)
def create_task(payload: TaskCreate):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {', '.join(VALID_STATUSES)}")

    wb = get_workbook()
    ws = ensure_tasks_sheet(wb)

    task_id = next_task_id(ws)
    ts = now_str()

    ws.append_row(
        [task_id, payload.title, payload.status, ts, ts],
        value_input_option="RAW",
    )

    return {
        "id":         task_id,
        "title":      payload.title,
        "status":     payload.status,
        "created_at": ts,
        "updated_at": ts,
    }


@app.patch("/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate):
    if payload.status is not None and payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Choose from: {', '.join(VALID_STATUSES)}")

    wb = get_workbook()
    ws = ensure_tasks_sheet(wb)

    row_idx = find_row(ws, task_id)
    if row_idx < 0:
        raise HTTPException(status_code=404, detail="Task not found")

    records = rows_to_dicts(ws)
    current = next((r for r in records if r["id"] == task_id), None)
    if not current:
        raise HTTPException(status_code=404, detail="Task not found")

    ts = now_str()

    if payload.title is not None:
        set_cell(ws, row_idx, "New Task", payload.title)

    if payload.status is not None:
        set_cell(ws, row_idx, "Status", payload.status)

    set_cell(ws, row_idx, "Updated At", ts)

    return {
        "id":         task_id,
        "title":      payload.title if payload.title is not None else current["New Task"],
        "status":     payload.status if payload.status is not None else current["Status"],
        "created_at": current.get("Created At", ""),
        "updated_at": ts,
    }


@app.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: str):
    wb = get_workbook()
    ws = ensure_tasks_sheet(wb)
    row_idx = find_row(ws, task_id)
    if row_idx < 0:
        raise HTTPException(status_code=404, detail="Task not found")
    ws.delete_rows(row_idx)


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": now_str()}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",      # filename: FastAPI instance
        host="0.0.0.0",
        port=8000,
        reload=True
    )
