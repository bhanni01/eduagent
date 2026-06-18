import json
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import chromadb
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# ─── Paths ────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(dotenv_path=ROOT / ".env")

DB_PATH = str(ROOT / "students.db")
CHROMA_PATH = str(ROOT / "chroma_db")
COLLECTION_NAME = "syllabus"

# ─── Shared state (loaded once on startup) ───────────────────────────────────

class _State:
    oai: OpenAI = None
    collection = None
    embed_model: SentenceTransformer = None

_s = _State()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Startup] Connecting to OpenAI ...")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not found — check .env in project root")
    _s.oai = OpenAI(api_key=api_key)

    print("[Startup] Loading ChromaDB syllabus ...")
    chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
    _s.collection = chroma_client.get_collection(COLLECTION_NAME)
    print(f"[Startup] Syllabus: {_s.collection.count()} chunks loaded")

    print("[Startup] Loading embedding model (all-MiniLM-L6-v2) ...")
    _s.embed_model = SentenceTransformer("all-MiniLM-L6-v2")

    print("[Startup] Initialising SQLite ...")
    _init_db()

    print("[Startup] Ready — http://localhost:8000")
    yield

# ─── SQLite ───────────────────────────────────────────────────────────────────

def _get_conn() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def _init_db():
    conn = _get_conn()
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS students (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            name                TEXT    NOT NULL,
            grade               INTEGER NOT NULL,
            fees_due            REAL    NOT NULL,
            attendance_percent  REAL    NOT NULL,
            homework_done       INTEGER NOT NULL,
            homework_total      INTEGER NOT NULL,
            class_performance   TEXT    NOT NULL
        )
    """)
    conn.commit()
    c.execute("SELECT COUNT(*) FROM students")
    if c.fetchone()[0] == 0:
        seed = [
            ("Ram",  6, 2500.0, 87.5, 18, 20, "Good"),
            ("Sita", 7,    0.0, 95.0, 20, 20, "Excellent"),
            ("Hari", 5, 1200.0, 72.0, 14, 20, "Needs Improvement"),
        ]
        c.executemany(
            "INSERT INTO students (name,grade,fees_due,attendance_percent,"
            "homework_done,homework_total,class_performance) VALUES (?,?,?,?,?,?,?)",
            seed,
        )
        conn.commit()
        print("[DB] Seeded 3 students: Ram, Sita, Hari")
    else:
        print("[DB] Student records already exist")
    conn.close()

def _fetch_student(name: str):
    conn = _get_conn()
    c = conn.cursor()
    c.execute(
        "SELECT name,grade,fees_due,attendance_percent,homework_done,homework_total,class_performance "
        "FROM students WHERE LOWER(name)=LOWER(?)",
        (name.strip(),),
    )
    row = c.fetchone()
    conn.close()
    return row

# ─── Semantic search ──────────────────────────────────────────────────────────

# L2 distance above this = query is outside the syllabus scope.
# all-MiniLM-L6-v2: same-topic ≈ 0.3–0.7, related ≈ 0.7–1.1, unrelated ≈ 1.2+
RELEVANCE_THRESHOLD = 1.3

OFF_TOPIC_REPLY = (
    "That topic isn't covered in your Grade 6 Science syllabus. "
    "Please ask your teacher about it! 📚"
)

def _semantic_search(query: str, n: int = 3) -> dict:
    """Returns documents, best L2 distance, and a relevance flag."""
    embedding = _s.embed_model.encode([query])[0].tolist()
    results = _s.collection.query(
        query_embeddings=[embedding],
        n_results=n,
        include=["documents", "distances"],
    )
    docs  = results["documents"][0]
    dists = results["distances"][0]
    best  = min(dists) if dists else 9999.0
    print(f"[Search] query={repr(query[:60])} best_dist={best:.3f} relevant={best < RELEVANCE_THRESHOLD}")
    return {"docs": docs, "best_distance": best, "relevant": best < RELEVANCE_THRESHOLD}

# ─── Tool schemas ─────────────────────────────────────────────────────────────

PARENT_TOOLS = [
    {"type": "function", "function": {
        "name": "get_student_info",
        "description": "Get complete info for a student: grade, fees, attendance, homework, performance.",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
    }},
    {"type": "function", "function": {
        "name": "get_fees_status",
        "description": "Check how much school fees a student owes and whether fully paid.",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
    }},
    {"type": "function", "function": {
        "name": "get_attendance",
        "description": "Get a student's attendance percentage for the current term.",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
    }},
    {"type": "function", "function": {
        "name": "get_homework_status",
        "description": "Get homework assignments completed vs total assigned.",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]},
    }},
]

STUDENT_TOOLS = [
    {"type": "function", "function": {
        "name": "search_syllabus",
        "description": "Search the Grade 6 science syllabus for relevant content. Always call before answering a science question.",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    }},
]

# ─── Tool executors ───────────────────────────────────────────────────────────

_NOT_FOUND = {"error": "Student not found. Available: Ram, Sita, Hari."}

def _exec_parent(fn_name: str, fn_args: dict) -> dict:
    row = _fetch_student(fn_args.get("name", ""))
    if not row:
        return _NOT_FOUND
    name_db, grade, fees_due, attendance, hw_done, hw_total, performance = row

    if fn_name == "get_student_info":
        return {
            "name": name_db, "grade": grade,
            "fees_due_npr": fees_due, "fees_fully_paid": fees_due == 0.0,
            "attendance_percent": attendance,
            "homework_done": hw_done, "homework_total": hw_total,
            "class_performance": performance,
        }
    if fn_name == "get_fees_status":
        return {"name": name_db, "fees_due_npr": fees_due, "fully_paid": fees_due == 0.0}
    if fn_name == "get_attendance":
        return {"name": name_db, "attendance_percent": attendance}
    if fn_name == "get_homework_status":
        pct = round(hw_done / hw_total * 100, 1) if hw_total else 0
        return {"name": name_db, "homework_done": hw_done, "homework_total": hw_total, "completion_percent": pct}
    return {"error": f"Unknown tool: {fn_name}"}

def _exec_student(fn_name: str, fn_args: dict) -> dict:
    if fn_name == "search_syllabus":
        result = _semantic_search(fn_args.get("query", ""))
        if not result["relevant"]:
            # Sentinel value — caught by _agent_turn before GPT sees it
            return {"__off_topic__": True}
        return {"syllabus_content": "\n\n".join(result["docs"])}
    return {"error": f"Unknown tool: {fn_name}"}


def _is_off_topic(fn_name: str, tool_result: dict) -> bool:
    """Short-circuit condition: student asked about something not in the syllabus."""
    return fn_name == "search_syllabus" and tool_result.get("__off_topic__") is True

# ─── Agentic loop ─────────────────────────────────────────────────────────────

def _agent_turn(
    history: list,
    tools: list,
    executor,
    short_circuit=None,   # callable(fn_name, result) → bool
    **kwargs,
) -> tuple[str, list[str]]:
    """
    Agentic tool-call loop.  If `short_circuit(fn_name, result)` returns True
    for any tool result, stop immediately and return OFF_TOPIC_REPLY without
    giving GPT a chance to answer from its own knowledge.
    """
    tools_called: list[str] = []
    while True:
        response = _s.oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=history,
            tools=tools,
            tool_choice="auto",
            **kwargs,
        )
        msg = response.choices[0].message
        finish = response.choices[0].finish_reason

        assistant_entry: dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
        if msg.tool_calls:
            assistant_entry["tool_calls"] = [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ]
        history.append(assistant_entry)

        if finish == "tool_calls":
            for tc in msg.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)
                tools_called.append(fn_name)
                result = executor(fn_name, fn_args)

                # Hard gate: backend returns canned message, GPT never sees result
                if short_circuit and short_circuit(fn_name, result):
                    return OFF_TOPIC_REPLY, tools_called

                history.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result),
                })
        else:
            return (msg.content or "").strip(), tools_called

# ─── System prompts ───────────────────────────────────────────────────────────

PARENT_SYSTEM = (
    "You are a helpful school assistant for parents of Nepali school students. "
    "Use the available tools to look up student data whenever asked. "
    "Respond warmly in plain English — 2 to 4 sentences, constructive and encouraging. "
    "Available students: Ram (Grade 6), Sita (Grade 7), Hari (Grade 5). "
    "If a student is not found, say so and list the available names."
)

STUDENT_SYSTEM = (
    "You are EduBot, a science tutor for Nepali school students in Grade 4-7.\n\n"
    "YOUR ONLY KNOWLEDGE SOURCE is what search_syllabus returns. "
    "You do not have any other knowledge.\n\n"
    "STRICT RULES — NO EXCEPTIONS:\n"
    "1. ALWAYS call search_syllabus before answering ANY question.\n"
    "2. Answer ONLY using the text returned by search_syllabus. "
    "Do NOT add anything from your own knowledge, training data, or general science facts.\n"
    "3. NEVER say 'however', 'but I can tell you', 'from my knowledge', "
    "or anything that supplements the retrieved text.\n"
    "4. Use very simple English for a 10-12 year old. Max 4 sentences.\n"
    "5. Nepali-life examples are welcome when they appear in the retrieved content.\n"
    "6. Be encouraging and friendly — but remain strictly on-topic."
)

# ─── FastAPI app ──────────────────────────────────────────────────────────────

app = FastAPI(title="EduAgent Nepal API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic models ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []

class ChatResponse(BaseModel):
    answer: str
    tool_called: str | None = None

class StudentData(BaseModel):
    name: str
    grade: int
    fees_due: float
    attendance_percent: float
    homework_done: int
    homework_total: int
    class_performance: str

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/chat/student", response_model=ChatResponse)
def chat_student(req: ChatRequest):
    history = [{"role": "system", "content": STUDENT_SYSTEM}]
    history += [{"role": m["role"], "content": m["content"]} for m in req.history]
    history.append({"role": "user", "content": req.message})
    answer, tools = _agent_turn(
        history, STUDENT_TOOLS, _exec_student,
        short_circuit=_is_off_topic,
        temperature=0.2, max_tokens=350,
    )
    return ChatResponse(answer=answer, tool_called=tools[-1] if tools else None)

@app.post("/api/chat/parent", response_model=ChatResponse)
def chat_parent(req: ChatRequest):
    history = [{"role": "system", "content": PARENT_SYSTEM}]
    history += [{"role": m["role"], "content": m["content"]} for m in req.history]
    history.append({"role": "user", "content": req.message})
    answer, tools = _agent_turn(history, PARENT_TOOLS, _exec_parent, temperature=0, max_tokens=250)
    return ChatResponse(answer=answer, tool_called=tools[-1] if tools else None)

@app.get("/api/parent/student/{name}", response_model=StudentData)
def get_student_data(name: str):
    row = _fetch_student(name)
    if not row:
        raise HTTPException(status_code=404, detail=f"Student '{name}' not found. Try: Ram, Sita, Hari")
    name_db, grade, fees_due, attendance, hw_done, hw_total, performance = row
    return StudentData(
        name=name_db, grade=grade, fees_due=fees_due,
        attendance_percent=attendance, homework_done=hw_done,
        homework_total=hw_total, class_performance=performance,
    )

@app.get("/api/parent/student/{name}/summary")
def get_student_summary(name: str):
    row = _fetch_student(name)
    if not row:
        raise HTTPException(status_code=404, detail=f"Student '{name}' not found")
    name_db, grade, fees_due, attendance, hw_done, hw_total, performance = row
    prompt = (
        f"{name_db} is a Grade {grade} student. "
        f"Fees outstanding: NPR {fees_due}. Attendance: {attendance}%. "
        f"Homework: {hw_done}/{hw_total} completed. Performance: {performance}. "
        "Write exactly 2 warm, constructive sentences for the parent."
    )
    resp = _s.oai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100,
        temperature=0.4,
    )
    return {"summary": resp.choices[0].message.content.strip()}
