"""
PollPulse — SQLAlchemy ORM Models
==================================
Hierarchy:
  User  ──< Survey ──< Question ──< Option
                               └──< Answer >── User (nullable)
                                           └── Option (nullable, for MC answers)
"""

import enum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


# ---------------------------------------------------------------------------
# Enum
# ---------------------------------------------------------------------------

class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE   = "MULTIPLE_CHOICE"
    OPEN_ENDED        = "OPEN_ENDED"
    CHOICE_WITH_OTHER = "CHOICE_WITH_OTHER"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id                  = Column(Integer, primary_key=True, index=True)
    email               = Column(String, unique=True, index=True, nullable=False)
    # password is nullable so Google-only users don't need one
    password            = Column(String, nullable=True)
    google_uid          = Column(String, unique=True, nullable=True, index=True)
    name                = Column(String, nullable=True)
    profile_picture_url = Column(String, nullable=True)
    role                = Column(String, default="voter")   # "voter" | "pollster"

    # Demographics (optional, collected after first login)
    age                 = Column(Integer, nullable=True)
    gender              = Column(String, nullable=True)     # e.g. "male", "female", "non-binary" …

    # Relationships
    surveys             = relationship("Survey", back_populates="pollster",
                                       cascade="all, delete-orphan")
    answers             = relationship("Answer", back_populates="user")


# ---------------------------------------------------------------------------
# Survey  (replaces old Poll)
# ---------------------------------------------------------------------------

class Survey(Base):
    __tablename__ = "surveys"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String, nullable=False)
    image_url   = Column(String, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    pollster_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    pollster    = relationship("User", back_populates="surveys")
    questions   = relationship("Question", back_populates="survey",
                               cascade="all, delete-orphan", order_by="Question.id")


# ---------------------------------------------------------------------------
# Question
# ---------------------------------------------------------------------------

class Question(Base):
    __tablename__ = "questions"

    id            = Column(Integer, primary_key=True, index=True)
    survey_id     = Column(Integer, ForeignKey("surveys.id"), nullable=False)
    text          = Column(String, nullable=False)
    question_type = Column(
        SAEnum(QuestionType, name="question_type_enum"),
        nullable=False,
        default=QuestionType.MULTIPLE_CHOICE,
    )

    # Relationships
    survey    = relationship("Survey", back_populates="questions")
    options   = relationship("Option", back_populates="question",
                             cascade="all, delete-orphan", order_by="Option.id")
    answers   = relationship("Answer", back_populates="question",
                             cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Option
# ---------------------------------------------------------------------------

class Option(Base):
    __tablename__ = "options"

    id          = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    text        = Column(String, nullable=False)
    image_url   = Column(String, nullable=True)   # reserved for future image-option support

    # Relationships
    question = relationship("Question", back_populates="options")
    answers  = relationship("Answer", back_populates="option")


# ---------------------------------------------------------------------------
# Answer
# ---------------------------------------------------------------------------

class Answer(Base):
    __tablename__ = "answers"

    id          = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)

    # nullable → supports anonymous surveys
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)

    # nullable → open-ended questions have no option selection
    option_id   = Column(Integer, ForeignKey("options.id"), nullable=True)

    # stores free-text for OPEN_ENDED or the "Other" input for CHOICE_WITH_OTHER
    answer_text = Column(Text, nullable=True)

    created_at  = Column(DateTime, server_default=func.now())

    # Relationships
    question = relationship("Question", back_populates="answers")
    user     = relationship("User", back_populates="answers")
    option   = relationship("Option", back_populates="answers")
