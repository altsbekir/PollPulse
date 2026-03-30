from typing import List
from collections import defaultdict
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from database import SessionLocal, engine
import models
import schemas

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
    new_poll = models.Poll(question=poll.question, creator_id=poll.creator_id)
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
    polls = db.query(models.Poll).all()
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

    db.commit()

    return {"message": "Vote recorded successfully"}
