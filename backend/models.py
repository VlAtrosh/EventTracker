from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    created_at: str

class EventCreate(BaseModel):
    title: str
    description: str
    event_type: str  # hackathon, meeting, lecture
    date: str
    location: str
    max_participants: int

class EventResponse(BaseModel):
    id: int
    title: str
    description: str
    event_type: str
    date: str
    location: str
    max_participants: int
    current_participants: int
    created_by: int
    created_at: str
    is_registered: Optional[bool] = False
    can_register: Optional[bool] = True

class RegistrationResponse(BaseModel):
    id: int
    event_id: int
    event_title: str
    event_date: str
    status: str
    registered_at: str