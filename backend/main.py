# backend/main.py

import os
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Import our new modules
from . import models, schemas
from .database import engine, get_db

import google.generativeai as genai

# --- Application Lifespan (for DB table creation) ---
async def create_tables():
    async with engine.begin() as conn:
        # This creates the 'feedback' table based on our models.py definition
        await conn.run_sync(models.Base.metadata.create_all)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Application startup: Creating database tables...")
    await create_tables()
    yield
    print("Application shutdown.")

# --- App Initialization ---
app = FastAPI(
    title="Multilingual Customer Feedback Analyzer API",
    version="1.1",
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

@app.post("/api/analyze", response_model=schemas.TranslateOutput)
async def analyze_and_store_feedback(
    feedback_input: schemas.TranslateInput,
    db: AsyncSession = Depends(get_db)
):
    """
    Analyzes feedback, stores it in the database, and returns the analysis.
    """
    try:
        # 1. ANALYZE WITH GEMINI
        model = genai.GenerativeModel('models/gemini-pro') # Use the full name from list_models.py
        prompt = f"""
        Analyze the following customer feedback text.
        Your task is to:
        1. Translate the text into English.
        2. Classify the sentiment as one of: 'positive', 'negative', or 'neutral'.
        3. Provide the output ONLY in a valid JSON format with two keys: "translated_text" and "sentiment".
        Text: "{feedback_input.text}"
        """
        response = model.generate_content(prompt)

        if not response.parts:
            raise HTTPException(status_code=400, detail="AI content generation failed.")

        result = json.loads(response.text)
        analysis_output = schemas.TranslateOutput(**result)

        # 2. STORE IN DATABASE
        db_feedback = models.Feedback(
            original_text=feedback_input.text,
            translated_text=analysis_output.translated_text,
            sentiment=analysis_output.sentiment
        )
        db.add(db_feedback)
        await db.commit()
        await db.refresh(db_feedback)

        print(f"Successfully stored feedback ID: {db_feedback.id}")
        return analysis_output

    except Exception as e:
        print(f"An error occurred: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {str(e)}")


@app.get("/api/feedback", response_model=list[schemas.Feedback])
async def get_all_feedback(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all feedback records from the database.
    """
    result = await db.execute(select(models.Feedback).offset(skip).limit(limit))
    feedback_list = result.scalars().all()
    return feedback_list