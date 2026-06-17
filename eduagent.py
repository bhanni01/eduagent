#!/Library/Developer/CommandLineTools/usr/bin/python3

import os
import json
import sqlite3
from dotenv import load_dotenv
import chromadb
from sentence_transformers import SentenceTransformer
from openai import OpenAI

load_dotenv()

COLLECTION_NAME = "syllabus"
DB_PATH = "students.db"

# ─── SQLite: schema + seed ────────────────────────────────────────────────────

def init_db():
    print("[DB] Initialising student database ...")
    conn = sqlite3.connect(DB_PATH)
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
        c.executemany("""
            INSERT INTO students
                (name, grade, fees_due, attendance_percent,
                 homework_done, homework_total, class_performance)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, seed)
        conn.commit()
        print("[DB] Seeded 3 students: Ram (Grade 6), Sita (Grade 7), Hari (Grade 5)")
    else:
        print("[DB] Student records already exist — skipping seed")

    return conn


def _fetch_student(conn, name):
    c = conn.cursor()
    c.execute(
        "SELECT name, grade, fees_due, attendance_percent, "
        "homework_done, homework_total, class_performance "
        "FROM students WHERE LOWER(name) = LOWER(?)",
        (name.strip(),),
    )
    return c.fetchone()


# ─── ChromaDB + embeddings ────────────────────────────────────────────────────

def load_syllabus():
    print("[RAG] Loading ChromaDB syllabus collection ...")
    client = chromadb.PersistentClient(path="./chroma_db")
    try:
        collection = client.get_collection(COLLECTION_NAME)
    except Exception:
        print("[RAG] ERROR: Collection not found. Run  python3 ingest.py  first!")
        raise

    print(f"[RAG] Collection loaded  ({collection.count()} chunks)")
    print("[RAG] Loading embedding model ...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("[RAG] Ready!\n")
    return collection, model


def _semantic_search(query, collection, embed_model, n=3):
    embedding = embed_model.encode([query])[0].tolist()
    results = collection.query(query_embeddings=[embedding], n_results=n)
    return "\n\n".join(results["documents"][0])


# ─── Tool schemas (OpenAI function-calling format) ───────────────────────────

PARENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_student_info",
            "description": (
                "Retrieve complete information about a student: grade, fees, "
                "attendance, homework, and class performance."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The student's first name"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_fees_status",
            "description": "Check how much school fees a student owes and whether they are fully paid.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The student's first name"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_attendance",
            "description": "Get a student's attendance percentage for the current term.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The student's first name"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_homework_status",
            "description": "Get the number of homework assignments completed vs total assigned.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "The student's first name"},
                },
                "required": ["name"],
            },
        },
    },
]

STUDENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_syllabus",
            "description": (
                "Search the Grade 6 science syllabus for content relevant to "
                "the student's question. Always call this before answering a "
                "science question."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query based on the student's question",
                    },
                },
                "required": ["query"],
            },
        },
    },
]


# ─── Tool executors ───────────────────────────────────────────────────────────

def make_parent_executor(conn):
    NOT_FOUND = {"error": "Student not found. Available students: Ram, Sita, Hari."}

    def execute(fn_name, fn_args):
        name = fn_args.get("name", "")
        row = _fetch_student(conn, name)
        if not row:
            return NOT_FOUND

        name_db, grade, fees_due, attendance, hw_done, hw_total, performance = row

        if fn_name == "get_student_info":
            return {
                "name": name_db,
                "grade": grade,
                "fees_due_npr": fees_due,
                "fees_fully_paid": fees_due == 0.0,
                "attendance_percent": attendance,
                "homework_done": hw_done,
                "homework_total": hw_total,
                "class_performance": performance,
            }
        if fn_name == "get_fees_status":
            return {
                "name": name_db,
                "fees_due_npr": fees_due,
                "fully_paid": fees_due == 0.0,
            }
        if fn_name == "get_attendance":
            return {
                "name": name_db,
                "attendance_percent": attendance,
            }
        if fn_name == "get_homework_status":
            pct = round(hw_done / hw_total * 100, 1) if hw_total else 0
            return {
                "name": name_db,
                "homework_done": hw_done,
                "homework_total": hw_total,
                "completion_percent": pct,
            }
        return {"error": f"Unknown tool: {fn_name}"}

    return execute


def make_student_executor(collection, embed_model):
    def execute(fn_name, fn_args):
        if fn_name == "search_syllabus":
            query = fn_args.get("query", "")
            chunks = _semantic_search(query, collection, embed_model)
            return {"syllabus_content": chunks}
        return {"error": f"Unknown tool: {fn_name}"}

    return execute


# ─── Agentic loop (shared) ───────────────────────────────────────────────────

def _fmt_args(fn_args):
    """Format tool args as  key='val', key2='val2'  for the status line."""
    return ", ".join(f"{k}={repr(v)}" for k, v in fn_args.items())


def agent_turn(oai, history, tools, executor, **kwargs):
    """
    Run one conversation turn.  May call tools multiple times before returning
    the final text reply.  Mutates `history` in place.
    """
    while True:
        response = oai.chat.completions.create(
            model="gpt-4o-mini",
            messages=history,
            tools=tools,
            tool_choice="auto",
            **kwargs,
        )
        msg = response.choices[0].message
        finish = response.choices[0].finish_reason

        # Append assistant message (content may be None when tool_calls are present)
        assistant_entry = {"role": "assistant", "content": msg.content or ""}
        if msg.tool_calls:
            assistant_entry["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in msg.tool_calls
            ]
        history.append(assistant_entry)

        if finish == "tool_calls":
            for tc in msg.tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments)
                print(f"  [Tool called: {fn_name}({_fmt_args(fn_args)})]")

                result = executor(fn_name, fn_args)
                history.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result),
                })
            # Loop: send tool results back to the model
        else:
            return (msg.content or "").strip()


# ─── System prompts ───────────────────────────────────────────────────────────

PARENT_SYSTEM = (
    "You are a helpful school assistant for parents of Nepali school students.\n"
    "Use the available tools to look up student data whenever a parent asks about "
    "their child's progress, fees, attendance, or homework.\n"
    "Respond in warm, plain English — 2 to 4 sentences. Be constructive and encouraging.\n"
    "Available students: Ram (Grade 6), Sita (Grade 7), Hari (Grade 5).\n"
    "If a student is not found, say so and list the available names."
)

STUDENT_SYSTEM = (
    "You are EduBot, a friendly science tutor for Nepali school students in Grade 4-7.\n"
    "When a student asks a science question, ALWAYS call search_syllabus first to find "
    "relevant content from their textbook, then use that content to answer.\n\n"
    "Rules:\n"
    "- Use very simple, easy English (as if talking to a 10-12 year old).\n"
    "- Keep answers short and clear — 3 to 5 sentences maximum.\n"
    "- Use everyday Nepali-life examples when helpful (rivers, farms, kitchens).\n"
    "- If search_syllabus returns nothing relevant, reply: "
    "\"That's an interesting question! I can only help with topics from your "
    "science syllabus right now. Ask your teacher for more!\"\n"
    "- Never discuss anything unrelated to school science.\n"
    "- Be encouraging, warm, and friendly."
)


# ─── Mode entry points ────────────────────────────────────────────────────────

def student_mode(oai, collection, embed_model):
    print("\n" + "=" * 55)
    print("  Welcome, Student!  I'm EduBot, your science helper.")
    print("  Ask me anything from your Grade 6 Science book.")
    print("  Type  quit  or  exit  to leave.")
    print("=" * 55 + "\n")

    executor = make_student_executor(collection, embed_model)
    history = [{"role": "system", "content": STUDENT_SYSTEM}]

    while True:
        try:
            question = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nEduBot: Goodbye! Keep studying hard!")
            break

        if not question:
            continue
        if question.lower() in ("quit", "exit"):
            print("EduBot: Goodbye! Keep studying hard!")
            break

        history.append({"role": "user", "content": question})
        answer = agent_turn(oai, history, STUDENT_TOOLS, executor, temperature=0.2, max_tokens=350)
        print(f"\nEduBot: {answer}\n")


def parent_mode(oai, conn):
    print("\n" + "=" * 55)
    print("  Welcome, Parent!  Let's check your child's progress.")
    print("  Available students: Ram, Sita, Hari")
    print("  Ask anything — e.g. \"How is Ram doing?\"")
    print("  Type  quit  or  exit  to leave.")
    print("=" * 55 + "\n")

    executor = make_parent_executor(conn)
    history = [{"role": "system", "content": PARENT_SYSTEM}]

    while True:
        try:
            user_input = input("Parent: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit"):
            print("Goodbye!")
            break

        history.append({"role": "user", "content": user_input})
        answer = agent_turn(oai, history, PARENT_TOOLS, executor, temperature=0, max_tokens=250)
        print(f"\nAssistant: {answer}\n")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 55)
    print("   EduAgent Nepal — Starting Up")
    print("=" * 55)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        print("\nERROR: OPENAI_API_KEY not set in .env file.")
        print("  Open .env and replace the placeholder with your real key.")
        return

    oai = OpenAI(api_key=api_key)
    conn = init_db()

    print("\n  Who are you?")
    print("    1  STUDENT")
    print("    2  PARENT")

    while True:
        try:
            choice = input("\nEnter STUDENT or PARENT: ").strip().upper()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if choice in ("STUDENT", "1"):
            try:
                collection, embed_model = load_syllabus()
            except Exception:
                break
            student_mode(oai, collection, embed_model)
            break
        elif choice in ("PARENT", "2"):
            parent_mode(oai, conn)
            break
        else:
            print("  Please type  STUDENT  or  PARENT")

    conn.close()


if __name__ == "__main__":
    main()
