"""
PollPulse — Pydantic Schemas (v2)
===================================
Mirrors the new ORM hierarchy:
  User / Survey / Question / Option / Answer
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, ConfigDict


# ---------------------------------------------------------------------------
# Shared enum (mirrors models.QuestionType)
# ---------------------------------------------------------------------------

class QuestionType(str, enum.Enum):
    MULTIPLE_CHOICE   = "MULTIPLE_CHOICE"
    OPEN_ENDED        = "OPEN_ENDED"
    CHOICE_WITH_OTHER = "CHOICE_WITH_OTHER"


# ===========================================================================
# USER
# ===========================================================================

class UserCreate(BaseModel):
    """Registration via email + password (legacy flow, still supported)."""
    email:    EmailStr
    password: str
    role:     str = "voter"


class UserGoogleCreate(BaseModel):
    """Registration / upsert via Google OAuth."""
    email:               EmailStr
    google_uid:          str
    name:                Optional[str] = None
    profile_picture_url: Optional[str] = None
    role:                str = "voter"


class UserLogin(BaseModel):
    email:    EmailStr
    password: str


class UserResponse(BaseModel):
    id:                  int
    email:               str
    name:                Optional[str]
    profile_picture_url: Optional[str]
    role:                str
    age:                 Optional[int]
    gender:              Optional[str]

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    """Partial update for demographics / profile."""
    name:                Optional[str] = None
    profile_picture_url: Optional[str] = None
    age:                 Optional[int] = None
    gender:              Optional[str] = None
    role:                Optional[str] = None


# ===========================================================================
# OPTION
# ===========================================================================

class OptionCreate(BaseModel):
    text:      str
    image_url: Optional[str] = None


class OptionResponse(BaseModel):
    id:        int
    text:      str
    image_url: Optional[str]

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# QUESTION
# ===========================================================================

class QuestionCreate(BaseModel):
    text:          str
    question_type: QuestionType = QuestionType.MULTIPLE_CHOICE
    options:       List[OptionCreate] = []   # empty list for OPEN_ENDED


class QuestionResponse(BaseModel):
    id:            int
    text:          str
    question_type: QuestionType
    options:       List[OptionResponse]

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# SURVEY  (was Poll)
# ===========================================================================

class SurveyCreate(BaseModel):
    title:       str
    image_url:   Optional[str] = None
    pollster_id: int
    questions:   List[QuestionCreate]


class SurveyResponse(BaseModel):
    id:          int
    title:       str
    image_url:   Optional[str]
    created_at:  datetime
    pollster_id: int
    questions:   List[QuestionResponse]

    model_config = ConfigDict(from_attributes=True)


class SurveySummary(BaseModel):
    """Lightweight survey card — used in list views."""
    id:          int
    title:       str
    image_url:   Optional[str]
    created_at:  datetime
    pollster_id: int

    model_config = ConfigDict(from_attributes=True)


# ===========================================================================
# ANSWER
# ===========================================================================

class AnswerCreate(BaseModel):
    """
    A single answer within a submission.
    user_id lives on SurveySubmission, not here.
    """
    question_id: int
    option_id:   Optional[int] = None   # None for OPEN_ENDED
    answer_text: Optional[str] = None   # free text or "Other" input


class AnswerResponse(BaseModel):
    id:          int
    question_id: int
    user_id:     Optional[int]
    option_id:   Optional[int]
    answer_text: Optional[str]
    created_at:  datetime

    model_config = ConfigDict(from_attributes=True)


class SurveySubmission(BaseModel):
    """Batch submission — all answers for one survey in a single request."""
    survey_id: int
    user_id:   Optional[int] = None   # None → anonymous
    answers:   List[AnswerCreate]


# ===========================================================================
# SURVEY RESULTS  (analytics)
# ===========================================================================

class OptionResult(BaseModel):
    """Vote count for a single option."""
    id:    int
    text:  str
    count: int


class QuestionResult(BaseModel):
    """Aggregated results for one question."""
    id:            int
    text:          str
    question_type: QuestionType
    total_answers: int
    options:       List[OptionResult]   # empty for OPEN_ENDED
    open_texts:    List[str]            # populated for OPEN_ENDED / CHOICE_WITH_OTHER


class SurveyResults(BaseModel):
    """Full analytics payload returned by GET /api/surveys/{id}/results."""
    survey_id:           int
    title:               str
    total_participants:  int   # unique user_ids that submitted (or raw answer rows if anon)
    questions:           List[QuestionResult]


# ===========================================================================
# AI SURVEY GENERATION  (multi-question)
# ===========================================================================

class AIOptionItem(BaseModel):
    text: str


class AIQuestionItem(BaseModel):
    text:          str
    question_type: QuestionType = QuestionType.MULTIPLE_CHOICE
    options:       List[AIOptionItem] = []


class AISurveyGenerated(BaseModel):
    """Shape returned by POST /api/generate-ai-poll (new multi-question format)."""
    title:     str
    questions: List[AIQuestionItem]


# ===========================================================================
# MISC / AI
# ===========================================================================

class AIPollRequest(BaseModel):
    topic:    str
    language: str = "tr"   # "tr" → Turkish (default), "en" → English
