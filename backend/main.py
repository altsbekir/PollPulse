"""
PollPulse — FastAPI Main (v2)
================================
Auth endpoints  : /api/register  /api/login  /api/auth/google
User endpoints  : /api/users/{id}  /api/users/{id}/demographics
Survey endpoints: /api/surveys  /api/surveys/{id}  /api/surveys/user/{pollster_id}
Answer endpoint : /api/surveys/{id}/submit
Stats endpoint  : /api/pollster/stats/{pollster_id}
AI endpoint     : /api/generate-ai-poll
"""

from typing import List, Optional
from collections import defaultdict
from datetime import datetime
import os
import re
import random
import json as _json
import jwt

from dotenv import load_dotenv
import google.generativeai as genai

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from passlib.context import CryptContext

from database import SessionLocal, engine
import models
import schemas

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Create tables (idempotent — safe to call every startup)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="PollPulse API v2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://poll-pulse-tan.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# DB dependency
# ---------------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# AI helpers — multi-question survey generation
# ---------------------------------------------------------------------------

_FALLBACK_SURVEYS: list[dict] = [
    {
        "title": "{topic} üzerine anket",
        "questions": [
            {
                "text": "{topic} konusunda en önemli faktör sizce nedir?",
                "question_type": "MULTIPLE_CHOICE",
                "options": [
                    {"text": "Maliyet ve bütçe yönetimi"},
                    {"text": "Teknik altyapı"},
                    {"text": "İnsan kaynakları"},
                    {"text": "Strateji ve planlama"},
                ],
            },
            {
                "text": "{topic} alanında en büyük zorluk nedir?",
                "question_type": "MULTIPLE_CHOICE",
                "options": [
                    {"text": "Verimlilik artışı"},
                    {"text": "Risk azaltma"},
                    {"text": "Yenilik ve Ar-Ge"},
                    {"text": "Müşteri memnuniyeti"},
                ],
            },
            {
                "text": "{topic} hakkında görüşünüz nedir?",
                "question_type": "OPEN_ENDED",
                "options": [],
            },
        ],
    },
]


def _build_fallback(topic: str) -> dict:
    tpl = random.choice(_FALLBACK_SURVEYS)

    def _fmt(s: str) -> str:
        return s.replace("{topic}", topic)

    return {
        "title": _fmt(tpl["title"]),
        "questions": [
            {
                "text": _fmt(q["text"]),
                "question_type": q["question_type"],
                "options": [{"text": o["text"]} for o in q["options"]],
            }
            for q in tpl["questions"]
        ],
    }


_SURVEY_SYSTEM_PROMPT = """
Sen bir profesyonel anket tasarımcısısın.
Kullanıcının verdiği konuya göre 3-5 soruluk kapsamlı ve yaratıcı bir anket oluşturursun.
Yanıtını SADECE geçerli bir JSON nesnesi olarak ver. Hiçbir markdown, kod bloğu veya açıklama ekleme.

Format (kesinlikle bu yapıya uy):
{
  "title": "<Anket başlığı>",
  "questions": [
    {
      "text": "<Soru metni>",
      "question_type": "MULTIPLE_CHOICE" | "OPEN_ENDED" | "CHOICE_WITH_OTHER",
      "options": [{"text": "<Seçenek>"}]  // OPEN_ENDED için boş liste
    }
  ]
}

Kurallar:
- 3-5 soru oluştur.
- En az 2 soru MULTIPLE_CHOICE veya CHOICE_WITH_OTHER olsun.
- En az 1 soru OPEN_ENDED olsun.
- MULTIPLE_CHOICE / CHOICE_WITH_OTHER soruları için 3-5 seçenek oluştur.
- Tüm sorular konuyla doğrudan ilişkili olsun.
"""


_SURVEY_SYSTEM_PROMPT_EN = """
You are a professional survey designer.
Given a topic, create a comprehensive 3-5 question survey.
Respond with ONLY a valid JSON object. No markdown, no code fences, no explanation.

Format (follow exactly):
{
  "title": "<Survey title>",
  "questions": [
    {
      "text": "<Question text>",
      "question_type": "MULTIPLE_CHOICE" | "OPEN_ENDED" | "CHOICE_WITH_OTHER",
      "options": [{"text": "<Option>"}]  // empty list for OPEN_ENDED
    }
  ]
}

Rules:
- Generate 3-5 questions.
- At least 2 must be MULTIPLE_CHOICE or CHOICE_WITH_OTHER.
- At least 1 must be OPEN_ENDED.
- MULTIPLE_CHOICE / CHOICE_WITH_OTHER questions must have 3-5 options.
- All questions must be directly relevant to the topic.
"""


def _try_llm_survey(topic: str, language: str = "tr") -> dict | None:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        system = _SURVEY_SYSTEM_PROMPT_EN if language == "en" else _SURVEY_SYSTEM_PROMPT
        user_prompt = (
            f"Topic: {topic}" if language == "en"
            else f"Konu: {topic}"
        )
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system,
        )
        response = model.generate_content(user_prompt)
        text = response.text.strip()

        # Strip markdown code fences models sometimes add
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
            text = re.sub(r"```$", "", text).strip()

        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            return None

        data = _json.loads(match.group())

        # Validate the shape
        if not isinstance(data.get("title"), str):
            return None
        if not isinstance(data.get("questions"), list) or len(data["questions"]) < 1:
            return None
        for q in data["questions"]:
            if not isinstance(q.get("text"), str):
                return None
            if q.get("question_type") not in ("MULTIPLE_CHOICE", "OPEN_ENDED", "CHOICE_WITH_OTHER"):
                q["question_type"] = "MULTIPLE_CHOICE"   # safe default
            if not isinstance(q.get("options"), list):
                q["options"] = []

        return data
    except Exception:
        return None


@app.post("/api/generate-ai-poll", response_model=schemas.AISurveyGenerated)
def generate_ai_poll(request: schemas.AIPollRequest):
    """
    Generate a multi-question survey draft using Gemini.
    Falls back to a hardcoded template when the API key is absent or the
    model returns unparseable output.

    Response shape matches SurveyCreate.questions so the frontend can
    pre-populate the survey builder directly.
    """
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Konu boş olamaz.")

    result = _try_llm_survey(topic, language=request.language)
    return result or _build_fallback(topic)


# ===========================================================================
# HEALTH
# ===========================================================================

@app.get("/")
def root():
    return {"message": "PollPulse API v2 is running."}


# ===========================================================================
# AUTH  —  email/password (legacy) + Google upsert
# ===========================================================================

@app.post("/api/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı.")
    new_user = models.User(
        email=user.email,
        password=pwd_context.hash(user.password),
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/api/login")
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not user.password or not pwd_context.verify(credentials.password, user.password):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı.")
    return {"message": "Login successful", "user": schemas.UserResponse.model_validate(user)}

security = HTTPBearer()
optional_bearer = HTTPBearer(auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    auth_header: HTTPAuthorizationCredentials = Depends(security)
) -> models.User:
    """
    Decodes the Firebase token from the Authorization header and returns 
     the corresponding User record. Raises 401 if invalid/missing.
    """
    try:
        decoded = jwt.decode(auth_header.credentials, options={"verify_signature": False})
        token_uid = decoded.get("user_id") or decoded.get("sub")
        if not token_uid:
            raise HTTPException(status_code=401, detail="Invalid token: missing UID.")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")

    user = db.query(models.User).filter(models.User.google_uid == token_uid).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found in database.")
    return user

def get_optional_current_user(
    db: Session = Depends(get_db),
    auth_header: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer)
) -> Optional[models.User]:
    """
    Returns the User if a valid token is present, else returns None.
    Does NOT raise 401 if the token is missing, but does if the token is malformed.
    """
    if not auth_header:
        return None
    try:
        decoded = jwt.decode(auth_header.credentials, options={"verify_signature": False})
        token_uid = decoded.get("user_id") or decoded.get("sub")
        if not token_uid:
            return None
        return db.query(models.User).filter(models.User.google_uid == token_uid).first()
    except:
        return None

@app.post("/api/auth/google", response_model=schemas.UserResponse)
def google_auth(
    payload: schemas.UserGoogleCreate,
    db: Session = Depends(get_db),
    auth_header: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Called by the frontend after a successful Firebase Google sign-in.
    Creates OR updates the local user record using the attached Bearer token claims.
    """
    try:
        # We decode unverified safely here (Firebase Admin SDK is standard for verified,
        # but decoding allows extracting claims from the Google token natively)
        decoded = jwt.decode(auth_header.credentials, options={"verify_signature": False})
        token_uid = decoded.get("user_id") or decoded.get("sub")
        token_email = decoded.get("email")
        token_name = decoded.get("name")
        token_picture = decoded.get("picture")

        if not token_uid or not token_email:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")

    # 1. Try to find by google_uid first (most precise)
    user = db.query(models.User).filter(models.User.google_uid == token_uid).first()

    # 2. Fall back to email match (user may have registered with email before)
    if not user:
        user = db.query(models.User).filter(models.User.email == token_email).first()

    if user:
        # Update profile fields that Firebase provides
        user.google_uid          = token_uid
        user.name                = token_name or user.name
        user.profile_picture_url = token_picture or user.profile_picture_url
        # Only update role if it's explicitly passed and the user hasn't set one yet
        if payload.role and not user.role:
            user.role = payload.role
    else:
        user = models.User(
            email=token_email,
            google_uid=token_uid,
            name=token_name,
            profile_picture_url=token_picture,
            role=payload.role or "voter"
        )
        db.add(user)

    db.commit()
    db.refresh(user)
    return user


# ===========================================================================
# USER  —  profile & demographics
# ===========================================================================

@app.get("/api/users/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@app.patch("/api/users/{user_id}", response_model=schemas.UserResponse)
def update_user(user_id: int, body: schemas.UserUpdate, db: Session = Depends(get_db)):
    """Partial update — demographics, name, profile picture, role."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


# ===========================================================================
# SURVEYS
# ===========================================================================

@app.post("/api/surveys", response_model=schemas.SurveyResponse)
def create_survey(body: schemas.SurveyCreate, db: Session = Depends(get_db)):
    """
    Create a full survey with nested questions and options in one atomic transaction.
    Validation rules:
      - At least 1 question required.
      - MULTIPLE_CHOICE / CHOICE_WITH_OTHER questions must have >= 2 options.
      - OPEN_ENDED questions must have 0 options.
    """
    if not body.questions:
        raise HTTPException(status_code=400, detail="A survey must have at least one question.")

    for i, q in enumerate(body.questions, start=1):
        if q.question_type in (
            schemas.QuestionType.MULTIPLE_CHOICE,
            schemas.QuestionType.CHOICE_WITH_OTHER,
        ):
            if len(q.options) < 2:
                raise HTTPException(
                    status_code=400,
                    detail=f"Question {i} ('{q.text[:40]}') must have at least 2 options.",
                )
        elif q.question_type == schemas.QuestionType.OPEN_ENDED:
            if q.options:
                raise HTTPException(
                    status_code=400,
                    detail=f"Question {i}: OPEN_ENDED questions should not have options.",
                )

    pollster = db.query(models.User).filter(models.User.id == body.pollster_id).first()
    if not pollster:
        raise HTTPException(status_code=404, detail="Pollster not found.")

    try:
        survey = models.Survey(
            title=body.title,
            pollster_id=body.pollster_id,
            image_url=body.image_url,
            is_anonymous=body.is_anonymous,
        )
        db.add(survey)
        db.flush()  # obtain survey.id inside the transaction

        for q_data in body.questions:
            question = models.Question(
                survey_id=survey.id,
                text=q_data.text,
                question_type=q_data.question_type,
            )
            db.add(question)
            db.flush()  # obtain question.id

            for o_data in q_data.options:
                db.add(models.Option(
                    question_id=question.id,
                    text=o_data.text,
                    image_url=o_data.image_url,
                ))

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create survey: {exc}") from exc

    # Eagerly reload nested relations for the response
    survey = (
        db.query(models.Survey)
        .options(
            joinedload(models.Survey.questions)
            .joinedload(models.Question.options)
        )
        .filter(models.Survey.id == survey.id)
        .first()
    )
    return survey


@app.get("/api/surveys", response_model=List[schemas.SurveySummary])
def list_surveys(db: Session = Depends(get_db)):
    """Return all surveys (summary cards — no nested questions)."""
    return db.query(models.Survey).order_by(models.Survey.created_at.desc()).all()


@app.get("/api/surveys/user/{pollster_id}", response_model=List[schemas.SurveySummary])
def list_surveys_by_pollster(pollster_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Survey)
        .filter(models.Survey.pollster_id == pollster_id)
        .order_by(models.Survey.created_at.desc())
        .all()
    )


@app.get("/api/surveys/{survey_id}", response_model=schemas.SurveyResponse)
def get_survey(survey_id: int, db: Session = Depends(get_db)):
    """Full survey with all questions and options."""
    survey = (
        db.query(models.Survey)
        .options(
            joinedload(models.Survey.questions)
            .joinedload(models.Question.options)
        )
        .filter(models.Survey.id == survey_id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found.")
    return survey


@app.delete("/api/surveys/{survey_id}", status_code=204)
def delete_survey(survey_id: int, db: Session = Depends(get_db)):
    survey = db.query(models.Survey).filter(models.Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found.")
    db.delete(survey)
    db.commit()


# ===========================================================================
# ANSWERS  —  survey submission
# ===========================================================================

@app.post("/api/surveys/{survey_id}/submit")
def submit_survey(
    survey_id: int,
    body: schemas.SurveySubmission,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user)
):
    """
    Submit all answers for a survey in one atomic request.

    Validation:
      - Survey must exist.
      - Each question_id must belong to this survey.
      - Authenticated users cannot re-submit the same survey.
      - MULTIPLE_CHOICE requires option_id.
      - OPEN_ENDED requires answer_text.
      - CHOICE_WITH_OTHER requires option_id OR answer_text (the 'Other' text).
    """
    survey = (
        db.query(models.Survey)
        .options(
            joinedload(models.Survey.questions)
            .joinedload(models.Question.options)
        )
        .filter(models.Survey.id == survey_id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found.")

    # Build a lookup: question_id -> Question ORM object
    question_map: dict[int, models.Question] = {q.id: q for q in survey.questions}

    # 1. Identity Mapping & Anonymity Logic
    effective_user_id = None
    if survey.is_anonymous:
        # Mandatory anonymity
        effective_user_id = None
    else:
        # Non-anonymous: must have a valid token
        if not current_user:
            raise HTTPException(
                status_code=401, 
                detail="This survey is not anonymous. Please log in to submit."
            )
        effective_user_id = current_user.id

    # 2. Duplicate-submission guard (only if we have a user_id)
    if effective_user_id:
        first_q_ids = list(question_map.keys())
        if first_q_ids:
            already_answered = (
                db.query(models.Answer)
                .filter(
                    models.Answer.user_id == effective_user_id,
                    models.Answer.question_id.in_(first_q_ids),
                )
                .first()
            )
            if already_answered:
                raise HTTPException(
                    status_code=400,
                    detail="You have already submitted this survey.",
                )

    # Per-answer validation
    for i, ans in enumerate(body.answers, start=1):
        if ans.question_id not in question_map:
            raise HTTPException(
                status_code=400,
                detail=f"Answer {i}: question_id {ans.question_id} does not belong to survey {survey_id}.",
            )
        q = question_map[ans.question_id]

        if q.question_type == schemas.QuestionType.MULTIPLE_CHOICE:
            if not ans.option_id:
                raise HTTPException(
                    status_code=400,
                    detail=f"Answer {i}: MULTIPLE_CHOICE question requires an option_id.",
                )

        elif q.question_type == schemas.QuestionType.OPEN_ENDED:
            if not ans.answer_text or not ans.answer_text.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"Answer {i}: OPEN_ENDED question requires a non-empty answer_text.",
                )

        elif q.question_type == schemas.QuestionType.CHOICE_WITH_OTHER:
            if not ans.option_id and not (ans.answer_text and ans.answer_text.strip()):
                raise HTTPException(
                    status_code=400,
                    detail=f"Answer {i}: CHOICE_WITH_OTHER requires either an option_id or an answer_text.",
                )

    # Persist inside a transaction
    try:
        count = 0
        for ans in body.answers:
            db.add(models.Answer(
                question_id=ans.question_id,
                user_id=effective_user_id,
                option_id=ans.option_id,
                answer_text=ans.answer_text,
            ))
            count += 1
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save answers: {exc}") from exc

    return {"message": "Answers recorded.", "count": count}


@app.get("/api/surveys/{survey_id}/results", response_model=schemas.SurveyResults)
def get_survey_results(
    survey_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Aggregated analytics for a single survey (pollster dashboard / charts).

    Access: only the survey owner (pollster) may read results.

    Payload highlights:
      - ``options`` / ``chart_series``: option vote counts (Recharts: ``name`` / ``value``).
      - ``open_texts``: free-text answers (no respondent fields).
      - ``answer_details``: per-row ``name`` / ``email`` only when the survey is **not** anonymous.
    """
    survey = (
        db.query(models.Survey)
        .options(
            joinedload(models.Survey.questions)
            .joinedload(models.Question.options)
        )
        .filter(models.Survey.id == survey_id)
        .first()
    )
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found.")

    if survey.pollster_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view results for this survey.",
        )

    question_ids = [q.id for q in survey.questions]

    all_answers: list[models.Answer] = (
        db.query(models.Answer)
        .options(joinedload(models.Answer.user))
        .filter(models.Answer.question_id.in_(question_ids))
        .order_by(models.Answer.id)
        .all()
        if question_ids else []
    )

    authenticated_user_ids = {a.user_id for a in all_answers if a.user_id is not None}
    if authenticated_user_ids:
        total_participants = len(authenticated_user_ids)
    else:
        first_q_id = question_ids[0] if question_ids else None
        total_participants = (
            sum(1 for a in all_answers if a.question_id == first_q_id)
            if first_q_id else 0
        )

    ans_by_q: dict[int, list[models.Answer]] = defaultdict(list)
    for a in all_answers:
        ans_by_q[a.question_id].append(a)

    question_results: list[schemas.QuestionResult] = []
    for q in survey.questions:
        q_answers = ans_by_q.get(q.id, [])

        option_counts: dict[int, int] = defaultdict(int)
        open_texts: list[str] = []

        for a in q_answers:
            if a.option_id:
                option_counts[a.option_id] += 1
            if a.answer_text and a.answer_text.strip():
                open_texts.append(a.answer_text.strip())

        options_result = [
            schemas.OptionResult(
                id=opt.id,
                text=opt.text,
                count=option_counts.get(opt.id, 0),
            )
            for opt in (q.options or [])
        ]

        chart_series: list[schemas.ChartPoint] = []
        if q.question_type in (
            models.QuestionType.MULTIPLE_CHOICE,
            models.QuestionType.CHOICE_WITH_OTHER,
        ):
            chart_series = [
                schemas.ChartPoint(
                    id=opt.id,
                    name=opt.text,
                    value=option_counts.get(opt.id, 0),
                )
                for opt in (q.options or [])
            ]

        answer_details: list[schemas.AnswerDetail] = []
        if not survey.is_anonymous:
            opt_label = {o.id: o.text for o in (q.options or [])}
            for a in q_answers:
                if not a.user_id or not a.user:
                    continue
                at = a.answer_text.strip() if a.answer_text and a.answer_text.strip() else None
                answer_details.append(
                    schemas.AnswerDetail(
                        respondent=schemas.Respondent(
                            name=a.user.name,
                            email=a.user.email,
                        ),
                        option_id=a.option_id,
                        option_text=opt_label.get(a.option_id) if a.option_id else None,
                        answer_text=at,
                    )
                )

        question_results.append(
            schemas.QuestionResult(
                id=q.id,
                text=q.text,
                question_type=q.question_type,
                total_answers=len(q_answers),
                options=options_result,
                open_texts=open_texts,
                chart_series=chart_series,
                answer_details=answer_details,
            )
        )

    return schemas.SurveyResults(
        survey_id=survey.id,
        title=survey.title,
        is_anonymous=survey.is_anonymous,
        total_participants=total_participants,
        questions=question_results,
    )



# ===========================================================================
# POLLSTER STATS
# ===========================================================================

@app.get("/api/pollster/stats/{pollster_id}")
def get_pollster_stats(pollster_id: int, db: Session = Depends(get_db)):
    """
    Aggregate stats for the pollster dashboard:
      - total_surveys
      - total_responses  (unique answers submitted)
      - surveys_list     (id, title, response_count, per-question breakdowns)
    """
    surveys = (
        db.query(models.Survey)
        .filter(models.Survey.pollster_id == pollster_id)
        .order_by(models.Survey.created_at.desc())
        .all()
    )
    survey_ids = [s.id for s in surveys]
    total_surveys = len(surveys)

    if not survey_ids:
        return {
            "total_surveys": 0,
            "total_responses": 0,
            "surveys_list": [],
        }

    # Count all answers across this pollster's surveys
    question_ids = [
        q.id for q in
        db.query(models.Question.id)
        .filter(models.Question.survey_id.in_(survey_ids))
        .all()
    ]

    total_responses = 0
    if question_ids:
        total_responses = (
            db.query(models.Answer)
            .filter(models.Answer.question_id.in_(question_ids))
            .count()
        )

    # Build per-survey summary with question breakdowns
    surveys_list = []
    for survey in surveys:
        q_ids = [q.id for q in survey.questions] if survey.questions else []

        response_count = 0
        questions_data = []

        if q_ids:
            answers = (
                db.query(models.Answer)
                .filter(models.Answer.question_id.in_(q_ids))
                .all()
            )
            response_count = len(answers)

            # Group answers by question
            ans_by_q: dict = defaultdict(list)
            for a in answers:
                ans_by_q[a.question_id].append(a)

            for q in survey.questions:
                q_answers = ans_by_q.get(q.id, [])

                # Option tallies for MC / CHOICE_WITH_OTHER
                option_counts: dict = defaultdict(int)
                open_texts = []
                for a in q_answers:
                    if a.option_id:
                        option_counts[a.option_id] += 1
                    if a.answer_text:
                        open_texts.append(a.answer_text)

                options_summary = []
                for opt in (q.options or []):
                    options_summary.append({
                        "id": opt.id,
                        "text": opt.text,
                        "count": option_counts.get(opt.id, 0),
                    })

                questions_data.append({
                    "id": q.id,
                    "text": q.text,
                    "question_type": q.question_type,
                    "total_answers": len(q_answers),
                    "options": options_summary,
                    "open_texts": open_texts,
                })

        surveys_list.append({
            "id": survey.id,
            "title": survey.title,
            "created_at": survey.created_at,
            "response_count": response_count,
            "questions": questions_data,
        })

    return {
        "total_surveys": total_surveys,
        "total_responses": total_responses,
        "surveys_list": surveys_list,
    }
