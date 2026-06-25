# EduAgent Nepal
AI-powered education platform for Grade 4-7 Nepali students.
Built with FastAPI, React, OpenAI tool use, ChromaDB RAG, and SQLite.

## Features
- Student chatbot restricted to syllabus content via RAG
- Parent dashboard with real-time student data via OpenAI tool use
- Prompt injection defenses and security audit logging

## Stack
Backend: Python, FastAPI, OpenAI, ChromaDB, SQLite
Frontend: React, Tailwind CSS, Recharts

## Current Limitations
### Syllabus Coverage
The official Nepal CDC Grade 4-7 curriculum is not yet available
as a machine-readable English PDF. Two blockers were found during
development:
- The Nepali-language PDFs from lib.moecdc.gov.np use a non-standard
  font encoding that extracts as garbled unicode rather than readable text
- The English versions available online are scanned image PDFs with
  no extractable text layer — pypdf returns ~1 character per page

As a result, the current knowledge base uses the NCERT Grade 6
Science textbook (India's national curriculum), which covers
comparable topics at the same level — photosynthesis, cells,
water cycle, motion, nutrition.

### Planned fixes
- Add OCR support via pytesseract to handle scanned PDFs
- Partner with a Nepali school to obtain digital-native syllabus documents
- Add Nepali language support so students can ask questions in Nepali

## Screenshots
### Home
![Home](screenshots/home.png)

### Student Conversation
![Student Conversation](screenshots/student_conversation.png)

### Parent Conversation
![Parent Conversation](screenshots/parent_conversation.png)

## Run Locally
### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Access
Frontend: http://localhost:5173
Backend API: http://localhost:8000
