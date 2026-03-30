from typing import List
from collections import defaultdict
from datetime import datetime, timedelta
import os
import re
import random
import json as _json
from dotenv import load_dotenv
import google.generativeai as genai
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import SessionLocal, engine
import models
import schemas

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PollPulse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# AI Poll Generation helpers
# ---------------------------------------------------------------------------

_AI_Q_TEMPLATES = [
    "{topic} konusunda en önemli faktör sizce nedir?",
    "{topic} alanında karşılaşılan en büyük zorluk nedir?",
    "{topic} sürecinde öncelikli olarak neye odaklanırsınız?",
    "{topic} ile ilgili en etkili yaklaşım sizce hangisidir?",
    "{topic} hakkındaki görüşünüz nedir?",
]

_AI_OPT_TEMPLATES = [
    ["Maliyet ve bütçe yönetimi", "Teknik altyapı", "İnsan kaynakları", "Strateji ve planlama"],
    ["Verimlilik artışı", "Risk azaltma", "Yenilik ve Ar-Ge", "Müşteri memnuniyeti"],
    ["Evet, kesinlikle destekliyorum", "Kısmen destekliyorum", "Kararasızım", "Desteklemiyorum"],
    ["Tamamen otomatik sistemler", "Yarı otomatik hibrit yaklaşım", "İnsan odaklı süreçler", "Durum bazlı karma model"],
    ["Kısa vadeli kazanımlar", "Uzun vadeli sürdürülebilirlik", "Anlık operasyonel ihtiyaçlar", "Stratejik büyüme hedefleri"],
    ["Yaygınlaşması çok kolay olacak", "Belirli sektörlerle sınırlı kalacak", "Henüz olgunlaşmadı", "Artık olmazsa olmaz hâle geldi"],
]


def _template_generation(topic: str) -> dict:
    question = random.choice(_AI_Q_TEMPLATES).format(topic=topic)
    options = list(random.choice(_AI_OPT_TEMPLATES))
    return {"question": question, "options": options}


def _try_llm_generation(topic: str) -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=(
                "Sen bir anket oluşturma asistanısın. "
                "Kullanıcının verdiği konuya göre yaratici bir anket sorusu ve 4 seçenek üreti̇rsi̇n. "
                "Yanıtını her zaman SADECE geçerli bir JSON nesnesi olarak ver, "
                "başka hiçbir açıklama veya markdown işareti ekleme. "
                'Format: {"question": "...", "options": ["...", "...", "...", "..."]}'
            ),
        )

        prompt = (
            f"Konu: {topic}. "
            "Bu konuyla ilişkili yaratıcı bir anket sorusu ve 4 seçenek oluştur. "
            "Yanıtı sadece şu JSON formatında ver: "
            '{"question": "...", "options": ["...", "...", "...", "..."]}. '
            "Dil: Türkçe."
        )

        response = model.generate_content(prompt)
        text = response.text.strip()

        # Strip markdown code fences if the model adds them
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
            text = re.sub(r"```$", "", text).strip()

        # Extract the first JSON object found in the response
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None

        data = _json.loads(match.group())

        if (
            isinstance(data.get("question"), str)
            and isinstance(data.get("options"), list)
            and len(data["options"]) >= 2
        ):
            return data

        return None

    except Exception:
        return None


@app.post("/api/generate-ai-poll")
def generate_ai_poll(request: schemas.AIPollRequest):
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Konu boş olamaz.")

    result = _try_llm_generation(topic)
    if result and "question" in result and "options" in result:
        return result

    return _template_generation(topic)


@app.get("/")
def root():
    return {"mesaj": "PollPulse API başarıyla çalışıyor! Frontend'e bağlanmaya hazır."}


@app.post("/api/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")

    hashed_password = pwd_context.hash(user.password)
    new_user = models.User(
        email=user.email,
        password=hashed_password,
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/login")
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not pwd_context.verify(credentials.password, user.password):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı.")

    return {
        "message": "Login successful",
        "user": schemas.UserResponse.model_validate(user),
    }


@app.post("/api/polls", response_model=schemas.PollResponse)
def create_poll(poll: schemas.PollCreate, db: Session = Depends(get_db)):
    new_poll = models.Poll(
        question=poll.question, 
        creator_id=poll.creator_id,
        visibility=poll.visibility,
        duration=poll.duration
    )
    db.add(new_poll)
    db.commit()
    db.refresh(new_poll)

    created_options = []
    for option_schema in poll.options:
        new_option = models.Option(poll_id=new_poll.id, text=option_schema.text)
        db.add(new_option)
        created_options.append(new_option)

    db.commit()

    for option in created_options:
        db.refresh(option)

    # Attach loaded options explicitly since relationship is not defined in models.py
    setattr(new_poll, "options", created_options)

    return new_poll


@app.get("/api/polls/{creator_id}", response_model=List[schemas.PollResponse])
def get_polls(creator_id: int, db: Session = Depends(get_db)):
    polls = db.query(models.Poll).filter(models.Poll.creator_id == creator_id).all()
    if not polls:
        return []

    poll_ids = [p.id for p in polls]
    options = db.query(models.Option).filter(models.Option.poll_id.in_(poll_ids)).all()

    opts_by_poll = defaultdict(list)
    for opt in options:
        opts_by_poll[opt.poll_id].append(opt)

    for p in polls:
        setattr(p, "options", opts_by_poll[p.id])

    return polls


@app.get("/api/polls", response_model=List[schemas.PollResponse])
def get_all_polls(db: Session = Depends(get_db)):
    # 1. Filter out non-public polls
    polls = db.query(models.Poll).filter(models.Poll.visibility == 'public').all()
    if not polls:
        return []

    now = datetime.utcnow()
    valid_polls = []

    for p in polls:
        if p.duration == 'unlimited':
            valid_polls.append(p)
            continue
            
        # Ensure naive UTC comparison
        created = p.created_at.replace(tzinfo=None) if p.created_at.tzinfo else p.created_at
        
        if p.duration == '24h':
            if now < created + timedelta(hours=24):
                valid_polls.append(p)
        elif p.duration == '3d':
            if now < created + timedelta(days=3):
                valid_polls.append(p)
        elif p.duration == '7d':
            if now < created + timedelta(days=7):
                valid_polls.append(p)

    if not valid_polls:
        return []

    poll_ids = [p.id for p in valid_polls]
    options = db.query(models.Option).filter(models.Option.poll_id.in_(poll_ids)).all()

    opts_by_poll = defaultdict(list)
    for opt in options:
        opts_by_poll[opt.poll_id].append(opt)

    for p in valid_polls:
        setattr(p, "options", opts_by_poll[p.id])

    return valid_polls


@app.get("/api/polls/single/{poll_id}", response_model=schemas.PollResponse)
def get_single_poll(poll_id: int, db: Session = Depends(get_db)):
    poll = db.query(models.Poll).filter(models.Poll.id == poll_id).first()
    if not poll:
        raise HTTPException(status_code=404, detail="Anket bulunamadı veya silinmiş olabilir.")
    
    options = db.query(models.Option).filter(models.Option.poll_id == poll_id).all()
    setattr(poll, "options", options)
    return poll


@app.post("/api/vote")
def vote_on_poll(vote: schemas.VoteCreate, db: Session = Depends(get_db)):
    existing_vote = db.query(models.Vote).filter(
        models.Vote.user_id == vote.user_id,
        models.Vote.poll_id == vote.poll_id
    ).first()

    if existing_vote:
        raise HTTPException(status_code=400, detail="Already voted")

    new_vote = models.Vote(
        user_id=vote.user_id,
        poll_id=vote.poll_id,
        option_id=vote.option_id
    )
    db.add(new_vote)

    option = db.query(models.Option).filter(models.Option.id == vote.option_id).first()
    if option:
        option.votes += 1

    # Streak logic
    user = db.query(models.User).filter(models.User.id == vote.user_id).first()
    today = datetime.utcnow().date()
    if user:
        if user.last_vote_date is None:
            user.streak_count = 1
        else:
            last_date = (
                user.last_vote_date.date()
                if isinstance(user.last_vote_date, datetime)
                else user.last_vote_date
            )
            if last_date == today - timedelta(days=1):
                user.streak_count = (user.streak_count or 0) + 1
            elif last_date < today - timedelta(days=1):
                user.streak_count = 1
            # last_date == today → already voted today, keep streak unchanged
        user.last_vote_date = datetime.utcnow()

    db.commit()

    return {
        "message": "Vote recorded successfully",
        "streak_count": user.streak_count if user else 0,
    }


@app.get("/api/users/{user_id}/votes")
def get_user_votes(user_id: int, db: Session = Depends(get_db)):
    votes = db.query(models.Vote).filter(models.Vote.user_id == user_id).all()
    return [{"poll_id": vote.poll_id, "option_id": vote.option_id} for vote in votes]


@app.get("/api/users/{user_id}/voted-polls", response_model=List[schemas.PollResponse])
def get_user_voted_polls(user_id: int, db: Session = Depends(get_db)):
    """
    Fetches all unique polls that a specific user has voted on,
    including all options and current vote counts.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    votes = db.query(models.Vote.poll_id).filter(models.Vote.user_id == user_id).distinct().all()
    if not votes:
        return []

    poll_ids = [v[0] for v in votes]

    polls = db.query(models.Poll).filter(models.Poll.id.in_(poll_ids)).all()

    options = db.query(models.Option).filter(models.Option.poll_id.in_(poll_ids)).all()

    opts_by_poll = defaultdict(list)
    for opt in options:
        opts_by_poll[opt.poll_id].append(opt)

    for p in polls:
        setattr(p, "options", opts_by_poll[p.id])

    return polls


@app.get("/api/pollster/stats/{user_id}")
def get_pollster_stats(user_id: int, db: Session = Depends(get_db)):
    polls = db.query(models.Poll).filter(models.Poll.creator_id == user_id).all()
    poll_ids = [p.id for p in polls]
    total_polls = len(polls)

    # Unique voters across all of this pollster's polls
    if poll_ids:
        total_voters = (
            db.query(models.Vote.user_id)
            .filter(models.Vote.poll_id.in_(poll_ids))
            .distinct()
            .count()
        )
    else:
        total_voters = 0

    # Weekly votes: index 0 = 6 days ago … index 6 = today (UTC)
    now = datetime.utcnow()
    period_start = datetime(now.year, now.month, now.day) - timedelta(days=6)

    weekly_votes = [0] * 7
    if poll_ids:
        recent_votes = (
            db.query(models.Vote)
            .filter(
                models.Vote.poll_id.in_(poll_ids),
                models.Vote.created_at >= period_start,
            )
            .all()
        )
        for v in recent_votes:
            created = v.created_at.replace(tzinfo=None) if v.created_at.tzinfo else v.created_at
            day_offset = (created.date() - period_start.date()).days
            if 0 <= day_offset <= 6:
                weekly_votes[day_offset] += 1

    # All polls with their options for the dropdown + pie chart
    polls_list = []
    if polls:
        all_options = (
            db.query(models.Option)
            .filter(models.Option.poll_id.in_(poll_ids))
            .all()
        )
        opts_map: dict = defaultdict(list)
        for o in all_options:
            opts_map[o.poll_id].append({"name": o.text, "value": o.votes})

        for p in sorted(polls, key=lambda x: x.created_at, reverse=True):
            polls_list.append({
                "id": p.id,
                "question": p.question,
                "options": opts_map[p.id],
            })

    # latest_poll_data kept for backwards compatibility
    latest_poll_data = polls_list[0] if polls_list else None

    return {
        "total_voters": total_voters,
        "total_polls": total_polls,
        "weekly_votes": weekly_votes,
        "latest_poll_data": latest_poll_data,
        "polls_list": polls_list,
    }
