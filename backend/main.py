# backend/main.py

import os
import json
import asyncio
from datetime import datetime, timedelta
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_

# Import our new modules
import models, schemas
from database import engine, get_db

import google.generativeai as genai
from passlib.context import CryptContext

# --- Auth / JWT Setup ---
ALGORITHM = "HS256"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    import jwt  # PyJWT
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    import jwt
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"username": username, "role": role}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def get_current_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

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
    # Configure Gemini (Google) client if API key is provided. We avoid raising
    # at import time so the app can start in non-AI dev modes and tests.
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        try:
            genai.configure(api_key=api_key)
            print("Gemini configured.")
        except Exception as e:
            print(f"Failed to configure Gemini: {e}")
    else:
        print("WARNING: GOOGLE_API_KEY not set; Gemini calls will fail if invoked.")

    await create_tables()
    # Ensure an admin user exists in DB seeded from env
    admin_user = os.getenv("ADMIN_USERNAME", "admin")
    admin_pass = os.getenv("ADMIN_PASSWORD", "admin")
    force_reset = os.getenv("ADMIN_FORCE_RESET", "false").lower() in ("1", "true", "yes")
    try:
        async with AsyncSession(engine) as s:
            from sqlalchemy import select as sa_select
            res = await s.execute(sa_select(models.AdminUser).where(models.AdminUser.username == admin_user))
            user = res.scalars().first()
            if not user:
                hashed = pwd_context.hash(admin_pass)
                s.add(models.AdminUser(username=admin_user, password_hash=hashed))
                await s.commit()
                print(f"Seeded admin user '{admin_user}'.")
            elif force_reset:
                user.password_hash = pwd_context.hash(admin_pass)
                s.add(user)
                await s.commit()
                print(f"Reset password for admin user '{admin_user}'.")
    except Exception as e:
        print(f"Admin seed error: {e}")
    # Optional: seed products from env (comma-separated)
    seed = os.getenv("SEED_PRODUCTS")
    if seed:
        names = [s.strip() for s in seed.split(",") if s.strip()]
        if names:
            async with AsyncSession(engine) as s:
                for name in names:
                    try:
                        exists = await s.execute(select(models.Product).where(models.Product.name == name))
                        if not exists.scalars().first():
                            s.add(models.Product(name=name))
                    except Exception as e:
                        print(f"Product seed error for '{name}': {e}")
                try:
                    await s.commit()
                except Exception as e:
                    print(f"Product seed commit error: {e}")
    # If still no products, create a default one so the dropdown is never empty
    try:
        async with AsyncSession(engine) as s:
            count_res = await s.execute(select(func.count()).select_from(models.Product))
            count = count_res.scalar() or 0
            if count == 0:
                s.add(models.Product(name="General"))
                await s.commit()
                print("Seeded default product 'General'.")
    except Exception as e:
        print(f"Default product seed error: {e}")
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

# --- Configure CORS ---
# Allow origins from env variable ALLOWED_ORIGINS (comma-separated) or default to localhost:3000 for dev
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simple in-memory rate limiter (dev/demo only) ---
_rate_store: dict[tuple[str, str], list[float]] = {}
_rate_lock = asyncio.Lock()

def make_rate_limiter(limit: int, window_seconds: int, key: str):
    async def _limiter(request: Request):
        # Identify client by IP
        ip = request.client.host if request.client else "unknown"
        k = (ip, key)
        now = asyncio.get_running_loop().time()
        cutoff = now - window_seconds
        async with _rate_lock:
            bucket = _rate_store.get(k, [])
            # prune old
            bucket = [t for t in bucket if t >= cutoff]
            if len(bucket) >= limit:
                raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
            bucket.append(now)
            _rate_store[k] = bucket
    return _limiter

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
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    """
    Admin-only: Retrieves feedback records from the database.
    """
    query = select(models.Feedback)
    if product:
        if product == "(unspecified)":
            query = query.where(or_(models.Feedback.product == '', models.Feedback.product.is_(None)))
        else:
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


# --- Auth Endpoints ---
@app.post("/auth/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    async with AsyncSession(engine) as s:
        res = await s.execute(select(models.AdminUser).where(models.AdminUser.username == form_data.username))
        user = res.scalars().first()
        if not user or not pwd_context.verify(form_data.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
        token = create_access_token({"sub": user.username, "role": "admin"})
        return {"access_token": token, "token_type": "bearer"}

@app.post("/auth/change-password")
async def change_password(payload: schemas.AdminPasswordChange, _: dict = Depends(get_current_admin)):
    async with AsyncSession(engine) as s:
        # current admin username from token is not returned here; re-issue query for any admin
        # Since we only support a single admin, update the first row
        res = await s.execute(select(models.AdminUser))
        user = res.scalars().first()
        if not user:
            raise HTTPException(status_code=400, detail="Admin not initialized")
        if not pwd_context.verify(payload.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        user.password_hash = pwd_context.hash(payload.new_password)
        s.add(user)
        await s.commit()
        return {"status": "ok"}
@app.get("/api/products", response_model=list[schemas.Product])
async def list_products(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(models.Product).order_by(models.Product.name.asc()))
    return res.scalars().all()

@app.post("/api/products", response_model=schemas.Product)
async def create_product(
    prod: schemas.ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    # Protected by simple token guard (see require_admin).
    existing = await db.execute(select(models.Product).where(models.Product.name == prod.name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Product already exists")
    item = models.Product(name=prod.name)
    db.add(item)
    try:
        await db.commit()
        await db.refresh(item)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create product: {e}")
    return item

@app.delete("/api/products/{product_id}")
async def delete_product(product_id: int, db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_admin)):
    res = await db.execute(select(models.Product).where(models.Product.id == product_id))
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(item)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete product: {e}")
    return {"status": "deleted"}


translate_limiter = Depends(make_rate_limiter(limit=30, window_seconds=60, key="translate"))
feedback_limiter = Depends(make_rate_limiter(limit=10, window_seconds=60, key="feedback"))

@app.post("/api/translate", response_model=schemas.TranslateOutput)
async def translate_only(feedback_input: schemas.TranslateInput, _: None = translate_limiter):
    """Translate and classify sentiment without storing."""
    analysis = _call_gemini_analysis(feedback_input.text)
    return schemas.TranslateOutput(**analysis)


@app.post("/api/feedback", response_model=schemas.Feedback)
async def create_feedback(
    feedback_input: schemas.FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    _: None = feedback_limiter
):
    """Analyze input with Gemini and store the result along with optional product."""
    try:
        # If product provided, ensure it exists in DB
        if feedback_input.product:
            check = await db.execute(select(models.Product).where(models.Product.name == feedback_input.product))
            if not check.scalars().first():
                raise HTTPException(status_code=400, detail="Unknown product. Please select a valid product.")

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
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    """Return sentiment counts and percentages. Optional filters: product, language."""
    query = select(models.Feedback.sentiment, func.count()).group_by(models.Feedback.sentiment)
    if product:
        if product == "(unspecified)":
            query = query.where(or_(models.Feedback.product == '', models.Feedback.product.is_(None)))
        else:
            query = query.where(models.Feedback.product == product)
    if language:
        query = query.where(models.Feedback.language == language)

    result = await db.execute(query)
    rows = result.all()
    counts = {row[0]: row[1] for row in rows}
    total = sum(counts.values())
    percentages = {k: (v / total * 100) if total else 0 for k, v in counts.items()}

    return {"total": total, "counts": counts, "percentages": percentages}


@app.get("/health")
def health():
    """Liveness probe for orchestration: returns quickly if the app process is alive."""
    return {"status": "ok"}


@app.get("/ready")
async def ready(db: AsyncSession = Depends(get_db)):
    """Readiness probe: attempt a lightweight DB query to confirm DB connectivity."""
    try:
        result = await db.execute(select(func.count()).select_from(models.Feedback))
        # If the query executes, DB is ready
        return {"ready": True}
    except Exception as e:
        print(f"Readiness check failed: {e}")
        return {"ready": False}


@app.get("/api/feedback/paginated")
async def get_feedback_paginated(
    product: str | None = None,
    language: str | None = None,
    sentiment: str | None = None,
    skip: int = 0,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    """Return paginated feedback results along with total counts.

    This endpoint is intended for frontend pagination and returns a JSON object
    with `total`, `items`, `skip`, and `limit` fields.
    """
    # Build the base query for filtering
    base = select(models.Feedback)
    count_q = select(func.count()).select_from(models.Feedback)
    if product:
        if product == "(unspecified)":
            base = base.where(or_(models.Feedback.product == '', models.Feedback.product.is_(None)))
            count_q = count_q.where(or_(models.Feedback.product == '', models.Feedback.product.is_(None)))
        else:
            base = base.where(models.Feedback.product == product)
            count_q = count_q.where(models.Feedback.product == product)
    if language:
        base = base.where(models.Feedback.language == language)
        count_q = count_q.where(models.Feedback.language == language)
    if sentiment:
        base = base.where(models.Feedback.sentiment == sentiment)
        count_q = count_q.where(models.Feedback.sentiment == sentiment)

    # total
    total_res = await db.execute(count_q)
    total = total_res.scalar() or 0

    # items
    query = base.offset(skip).limit(limit)
    res = await db.execute(query)
    items = res.scalars().all()

    return {"total": total, "items": items, "skip": skip, "limit": limit}

 