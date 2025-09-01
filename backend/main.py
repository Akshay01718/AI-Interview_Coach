from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import sessionmaker, declarative_base
import uuid
import json
import sqlite3
import openai
import re
import os
from dotenv import load_dotenv

# ================= LOAD ENV =================
load_dotenv()  # Load .env file

openai.api_key = os.environ.get("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("OPENAI_API_KEY not set in environment")

# ================= DB SETUP =================
DB_FILE = "interview_sessions.db"
engine = create_engine(f"sqlite:///{DB_FILE}")
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Session(Base):
    __tablename__ = "sessions"
    session_id = Column(String, primary_key=True, index=True)
    num_questions = Column(Integer, default=5)
    conversation_json = Column(Text, default="[]")

def ensure_db():
    Base.metadata.create_all(bind=engine)
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(sessions)")
    columns = [col[1] for col in cursor.fetchall()]

    if "num_questions" not in columns:
        cursor.execute("ALTER TABLE sessions ADD COLUMN num_questions INTEGER DEFAULT 5")
    if "conversation_json" not in columns:
        cursor.execute("ALTER TABLE sessions ADD COLUMN conversation_json TEXT DEFAULT '[]'")
    
    conn.commit()
    conn.close()

ensure_db()

# ================= FASTAPI SETUP =================
app = FastAPI()

origins = [
    "https://ai-interview-coach-8ij8ysewu-akshays-projects-ccff1c85.vercel.app/",
    "http://localhost:3000", 
      # for local testing
]

# CORS: Allow all origins dynamically (safe for public API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # <-- you can replace "*" with a list of allowed domains if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= Pydantic Schemas =================
class StartSessionRequest(BaseModel):
    num_questions: int = 5

class SubmitAnswerRequest(BaseModel):
    session_id: str
    answer: str

# ================= Helper Functions =================
def save_conversation(session_id, conversation):
    db = SessionLocal()
    session = db.query(Session).filter(Session.session_id == session_id).first()
    if session:
        session.conversation_json = json.dumps(conversation)
        db.commit()
    db.close()

def load_conversation(session_id):
    db = SessionLocal()
    session = db.query(Session).filter(Session.session_id == session_id).first()
    db.close()
    if session:
        return json.loads(session.conversation_json)
    return []

def get_next_question(conversation, num_questions):
    if len(conversation) >= num_questions:
        return None
    
    messages = [{"role": "system", "content": "You are an interview coach."}]
    for qa in conversation:
        messages.append({"role": "user", "content": f"Q: {qa['question']}\nA: {qa['answer']}"} )
    messages.append({"role": "user", "content": "Ask the next interview question in a professional way, numbered correctly, without extra letters."})
    
    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=100
        )
        next_question = response.choices[0].message.content.strip()
        next_question = re.sub(r"^(Qn\s*\d+:?\s*|\d+\.\s*)", "", next_question).strip()
        return next_question
    except Exception as e:
        print(f"OpenAI error in get_next_question: {e}")
        return "Unable to generate next question at this time."

def evaluate_answer(answer, question):
    messages = [
        {"role": "system", "content": (
            "You are an AI interview coach. "
            "After evaluating a candidate's answer, provide a numeric score with decimal precision (0-100, can include decimals) "
            "and a clear, professional, constructive feedback paragraph highlighting strengths, "
            "areas for improvement, and tips for better performance. "
            "Do NOT include the numeric score in the feedback text. "
            "Return the response in JSON format: {\"score\": number, \"feedback\": \"text\"} "
        )},
        {"role": "user", "content": f"Question: {question}\nAnswer: {answer}"}
    ]

    response = openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=200
    )

    result = response.choices[0].message.content.strip()

    try:
        data = json.loads(result)
        score = float(data.get("score", 0.0))
        feedback = data.get("feedback", "")
    except Exception as e:
        print(f"Error parsing score/feedback: {e}")
        score = 0.0
        feedback = result

    return score, feedback

# ================= API ENDPOINTS =================
@app.post("/start_session")
def start_session(req: StartSessionRequest):
    if req.num_questions < 5 or req.num_questions > 20:
        raise HTTPException(status_code=400, detail="num_questions must be between 5 and 20")
    
    session_id = str(uuid.uuid4())
    db = SessionLocal()
    new_session = Session(session_id=session_id, num_questions=req.num_questions, conversation_json="[]")
    db.add(new_session)
    db.commit()
    db.close()
    
    initial_question = "Can you introduce yourself and tell me about your background?"
    save_conversation(session_id, [{"question": initial_question, "answer": "", "score": None, "feedback": ""}])
    
    return {"session_id": session_id, "question": initial_question}

@app.post("/submit_answer")
def submit_answer(req: SubmitAnswerRequest):
    conversation = load_conversation(req.session_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Session not found")
    
    last_q = conversation[-1]["question"]
    score, feedback = evaluate_answer(req.answer, last_q)
    
    conversation[-1]["answer"] = req.answer
    conversation[-1]["score"] = score
    conversation[-1]["feedback"] = feedback
    
    db = SessionLocal()
    session = db.query(Session).filter(Session.session_id == req.session_id).first()
    num_questions = session.num_questions
    db.close()

    next_question = get_next_question(conversation, num_questions)
    if next_question:
        conversation.append({"question": next_question, "answer": "", "score": None, "feedback": ""})
    
    save_conversation(req.session_id, conversation)
    
    return {
        "score": score,
        "feedback": feedback,
        "next_question": next_question
    }
