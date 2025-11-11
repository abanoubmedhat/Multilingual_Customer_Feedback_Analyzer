# backend/schemas.py

from pydantic import BaseModel
from pydantic import ConfigDict
from datetime import datetime

# --- Translation Schemas ---

# Schema for the input to the /translate endpoint
class TranslateInput(BaseModel):
    text: str

# Schema for the output of the /translate endpoint
class TranslateOutput(BaseModel):
    translated_text: str
    sentiment: str
    language: str | None = None
    language_confidence: float | None = None

# --- Feedback Schemas ---

# Base schema for feedback, containing common attributes
class FeedbackBase(BaseModel):
    original_text: str
    translated_text: str | None = None
    sentiment: str
    product: str | None = None
    language: str | None = None
    language_confidence: float | None = None

# Schema for displaying feedback (includes DB-generated fields)
class Feedback(FeedbackBase):
    id: int
    created_at: datetime
    # Pydantic v2: enable reading from ORM model attributes
    model_config = ConfigDict(from_attributes=True)


# Schema for creating feedback (POST /api/feedback)
class FeedbackCreate(BaseModel):
    text: str
    product: str | None = None