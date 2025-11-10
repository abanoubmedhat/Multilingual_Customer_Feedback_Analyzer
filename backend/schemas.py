# backend/schemas.py

from pydantic import BaseModel
from datetime import datetime

# --- Translation Schemas ---

# Schema for the input to the /translate endpoint
class TranslateInput(BaseModel):
    text: str

# Schema for the output of the /translate endpoint
class TranslateOutput(BaseModel):
    translated_text: str
    sentiment: str

# --- Feedback Schemas ---

# Base schema for feedback, containing common attributes
class FeedbackBase(BaseModel):
    original_text: str
    translated_text: str | None = None
    sentiment: str

# Schema for displaying feedback (includes DB-generated fields)
class Feedback(FeedbackBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True # Allows Pydantic to read data from ORM models