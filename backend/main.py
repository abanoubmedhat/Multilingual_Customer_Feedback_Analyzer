# backend/main.py

import os
import json
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

# Import our new modules
import models, schemas
from database import engine, get_db

import google.generativeai as genai

# --- Application Lifespan (for DB table creation) ---
async def create_tables(retries: int = 10, base_delay: float = 1.0):
    """Attempt to create DB tables, retrying while the DB service is starting.

    SQLAlchemy's create_all will fail if Postgres isn't accepting connections yet
    (race during container startup). Retry with exponential backoff so the
    backend can start once the DB is ready.
    """
    for attempt in range(1, retries + 1):
        try:
            async with engine.begin() as conn:
                # This creates the 'feedback' table based on our models.py definition
                await conn.run_sync(models.Base.metadata.create_all)
            print("Database tables created or already exist.")
            return
        except Exception as e:
            wait = base_delay * attempt
            print(f"Database not ready (attempt {attempt}/{retries}): {e}. Retrying in {wait}s...")
            await asyncio.sleep(wait)

    # If we get here, all retries failed
    raise RuntimeError("Could not connect to the database after multiple attempts")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup: Creating database tables...")
    await create_tables()
    yield
    print("Application shutdown.")

# --- App Initialization ---
description = """
Multilingual Customer Feedback Analyzer v1.0

This service accepts customer feedback in any language, uses Google Gemini to detect
language, translate to English, and classify sentiment. Feedback can be stored and
queried via the API. This backend is intended for development/demo purposes and
is containerized with Docker Compose.

Available endpoints:
- POST /api/feedback — Analyze and store feedback (accepts optional `product`).
- POST /api/translate — Analyze (translate + sentiment) without storing.
- GET  /api/feedback — List feedback with filters (product, language, sentiment).
- GET  /api/stats — Sentiment overview and percentages.
"""

openapi_tags = [
    {"name": "feedback", "description": "Create and list feedback entries."},
    {"name": "translate", "description": "Translate and classify text using Gemini (no DB write)."},
    {"name": "stats", "description": "Sentiment aggregate statistics."},
]

app = FastAPI(
    title="Multilingual Customer Feedback Analyzer API",
    version="1.1",
    description=description,
    openapi_tags=openapi_tags,
    lifespan=lifespan # Use the new lifespan context manager
)

# --- Configure Gemini AI ---
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("GOOGLE_API_KEY not found. Please set it in your .env file.")
genai.configure(api_key=api_key)

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Welcome to the Feedback Analyzer API!"}

# NOTE: /api/analyze removed — use POST /api/feedback to analyze + store,
# and POST /api/translate to analyze without storing. This avoids overlapping
# endpoints and matches the project API specification.


@app.get("/api/feedback", response_model=list[schemas.Feedback])
async def get_all_feedback(
    product: str | None = None,
    language: str | None = None,
    sentiment: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all feedback records from the database.
    """
    query = select(models.Feedback)
    if product:
        query = query.where(models.Feedback.product == product)
    if language:
        query = query.where(models.Feedback.language == language)
    if sentiment:
        query = query.where(models.Feedback.sentiment == sentiment)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    feedback_list = result.scalars().all()
    return feedback_list


def _call_gemini_analysis(text: str) -> dict:
    """Call Gemini model synchronously and return a dict with keys:
    translated_text, sentiment, language (ISO code), language_confidence (optional)
    This wraps the previous parsing logic into one place.
    """
    model = genai.GenerativeModel('models/gemini-2.5-pro')
    prompt = f'''
    Analyze the following customer feedback text.
    Your task is to:
    1. Detect the language of the input and return it as an ISO 639-1 code in the key "language".
    2. Translate the text into English and return it in "translated_text".
    3. Classify the sentiment as one of: 'positive', 'negative', or 'neutral' and return it in "sentiment".
    4. Optionally return a numeric confidence for language detection as "language_confidence".
    Provide the output ONLY in a valid JSON format with the keys: "translated_text", "sentiment", "language", and "language_confidence" (language_confidence may be null).
    Text: "{text}"
    '''

    response = model.generate_content(prompt)
    if not response.parts or not response.text:
        raise HTTPException(status_code=400, detail="AI content generation failed. Empty response from Gemini API.")

    # Strip markdown code fences if present
    text_resp = response.text.strip()
    if text_resp.startswith("```"):
        text_resp = text_resp.split("```", 1)[1]
        if text_resp.startswith("json"):
            text_resp = text_resp[4:].lstrip()
        text_resp = text_resp.rsplit("```", 1)[0].strip()

    try:
        result = json.loads(text_resp)
    except json.JSONDecodeError as je:
        print(f"Failed to parse JSON response from Gemini: {response.text}")
        raise HTTPException(status_code=400, detail=f"AI returned invalid JSON: {str(je)}")

    return result


@app.post("/api/translate", response_model=schemas.TranslateOutput)
async def translate_only(feedback_input: schemas.TranslateInput):
    """Translate and classify sentiment without storing."""
    analysis = _call_gemini_analysis(feedback_input.text)
    return schemas.TranslateOutput(**analysis)


@app.post("/api/feedback", response_model=schemas.Feedback)
async def create_feedback(
    feedback_input: schemas.FeedbackCreate,
    db: AsyncSession = Depends(get_db)
):
    """Analyze input with Gemini and store the result along with optional product."""
    try:
        analysis = _call_gemini_analysis(feedback_input.text)

        db_feedback = models.Feedback(
            original_text=feedback_input.text,
            translated_text=analysis.get("translated_text"),
            sentiment=analysis.get("sentiment"),
            product=feedback_input.product,
            language=analysis.get("language"),
            language_confidence=analysis.get("language_confidence")
        )
        db.add(db_feedback)
        await db.commit()
        await db.refresh(db_feedback)

        return db_feedback
    except HTTPException:
        raise
    except Exception as e:
        print(f"An error occurred while creating feedback: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@app.get("/api/stats")
async def get_stats(
    product: str | None = None,
    language: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """Return sentiment counts and percentages. Optional filters: product, language."""
    query = select(models.Feedback.sentiment, func.count()).group_by(models.Feedback.sentiment)
    if product:
        query = query.where(models.Feedback.product == product)
    if language:
        query = query.where(models.Feedback.language == language)

    result = await db.execute(query)
    rows = result.all()
    counts = {row[0]: row[1] for row in rows}
    total = sum(counts.values())
    percentages = {k: (v / total * 100) if total else 0 for k, v in counts.items()}

    return {"total": total, "counts": counts, "percentages": percentages}