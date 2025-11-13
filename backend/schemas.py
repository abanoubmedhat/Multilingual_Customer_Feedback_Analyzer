# backend/schemas.py

from pydantic import BaseModel, Field
from pydantic import ConfigDict
from datetime import datetime
from typing import Annotated
from typing import List

# --- Translation Schemas ---

# Schema for the input to the /translate endpoint
class TranslateInput(BaseModel):
    # Enforce sane limits to prevent abuse
    text: Annotated[str, Field(min_length=1, max_length=2000)]

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
    # Enforce input length limits
    text: Annotated[str, Field(min_length=1, max_length=2000)]
    # Product is mandatory and must match an existing product name
    product: Annotated[str, Field(min_length=1, max_length=100)]
    # Optional: Pre-analyzed data to skip re-analysis
    language: str | None = None
    translated_text: str | None = None
    sentiment: str | None = None
    language_confidence: float | None = None


# --- Feedback Delete Schemas ---

class FeedbackBulkDelete(BaseModel):
    ids: List[int]


# --- Product Schemas ---

class ProductBase(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100)]


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


# --- Admin Schemas ---
class AdminPasswordChange(BaseModel):
    current_password: Annotated[str, Field(min_length=1, max_length=200)]
    new_password: Annotated[str, Field(min_length=6, max_length=200)]


# --- Settings Schemas ---
class GeminiModel(BaseModel):
    name: str
    display_name: str
    description: str | None = None


class ModelSetting(BaseModel):
    current_model: str


class ModelSettingUpdate(BaseModel):
    model_name: str