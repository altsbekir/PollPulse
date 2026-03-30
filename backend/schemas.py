from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List
from datetime import datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "Voter"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str

    model_config = ConfigDict(from_attributes=True)


class OptionCreate(BaseModel):
    text: str


class PollCreate(BaseModel):
    question: str
    creator_id: int
    visibility: str = "public"
    duration: str = "unlimited"
    options: List[OptionCreate]


class OptionResponse(BaseModel):
    id: int
    text: str
    votes: int

    model_config = ConfigDict(from_attributes=True)


class PollResponse(BaseModel):
    id: int
    question: str
    created_at: datetime
    visibility: str = "public"
    duration: str = "unlimited"
    options: List[OptionResponse]

    model_config = ConfigDict(from_attributes=True)


class VoteCreate(BaseModel):
    user_id: int
    poll_id: int
    option_id: int
