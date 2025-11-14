import os
import json
import asyncio
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_

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

# Cache for Gemini models list (to avoid repeatedly querying the API)
_gemini_models_cache = None
_gemini_models_cache_time = None
MODELS_CACHE_TTL = 3600  # Cache for 1 hour

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    import jwt  # PyJWT
    to_encode = data.copy()
    # Use timezone-aware UTC datetime for better compatibility
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    import jwt
    try:
        # Explicitly verify expiration and other claims
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,  # Explicitly verify expiration
                "verify_nbf": True,
                "verify_iat": True,
                "verify_aud": False,
                "require_exp": True  # Require exp claim to be present
            }
        )
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return {"username": username, "role": role, "exp": payload.get("exp")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

def should_refresh_token(exp: float) -> bool:
    """Check if token should be refreshed (within 50% of expiration time)"""
    if not exp:
        return False
    exp_datetime = datetime.fromtimestamp(exp, tz=timezone.utc)
    now = datetime.now(timezone.utc)
    time_until_expiry = (exp_datetime - now).total_seconds()
    # Refresh if less than 50% of the original time remains
    threshold = ACCESS_TOKEN_EXPIRE_MINUTES * 60 * 0.5
    return 0 < time_until_expiry < threshold

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
                await conn.run_sync(models.Base.metadata.create_all)
            return
        except Exception as e:
            if attempt == retries:
                raise
            await asyncio.sleep(base_delay * attempt)

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
    # If no products exist, create a default one so the dropdown is never empty
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
    
    # Initialize default Gemini model setting if not exists
    try:
        async with AsyncSession(engine) as s:
            res = await s.execute(select(models.Settings).where(models.Settings.key == "gemini_model"))
            setting = res.scalars().first()
            if not setting:
                # Default to gemini-2.5-flash (better free tier quota)
                s.add(models.Settings(key="gemini_model", value="models/gemini-2.5-flash"))
                await s.commit()
                print("Seeded default Gemini model setting: gemini-2.5-flash")
    except Exception as e:
        print(f"Gemini model setting seed error: {e}")
    
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
    expose_headers=["X-New-Token"],  # Allow frontend to read the new token header
)

# --- Token Refresh Middleware ---
@app.middleware("http")
async def refresh_token_middleware(request: Request, call_next):
    """Middleware to automatically refresh tokens that are close to expiring"""
    response = await call_next(request)
    
    # Only check for token refresh on successful authenticated requests
    if response.status_code == 200:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                import jwt
                # Decode without verification to check expiration time
                payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_signature": False})
                exp = payload.get("exp")
                
                if exp and should_refresh_token(exp):
                    # Create new token with same user data
                    new_token = create_access_token(
                        data={"sub": payload.get("sub"), "role": payload.get("role")}
                    )
                    response.headers["X-New-Token"] = new_token
            except Exception:
                # If token parsing fails, just continue without refreshing
                pass
    
    return response

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


@app.get("/api/feedback")
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
    Admin-only: Retrieves feedback records from the database with pagination.
    Returns both the items and total count for pagination UI.
    
    Query params:
    - product: Filter by product name (optional)
    - language: Filter by language code (optional)
    - sentiment: Filter by sentiment (positive/neutral/negative) (optional)
    - skip: Number of records to skip (default: 0)
    - limit: Maximum records to return (default: 100)
    
    Returns: {"total": int, "items": [Feedback], "skip": int, "limit": int}
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

    # Get total count
    total_res = await db.execute(count_q)
    total = total_res.scalar() or 0

    # Get paginated items
    query = base.offset(skip).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()

    return {"total": total, "items": items, "skip": skip, "limit": limit}


async def _get_current_gemini_model(db: AsyncSession) -> str:
    """Get the current Gemini model from settings, with fallback to default."""
    try:
        res = await db.execute(select(models.Settings).where(models.Settings.key == "gemini_model"))
        setting = res.scalars().first()
        if setting:
            return setting.value
    except Exception as e:
        print(f"Error fetching Gemini model setting: {e}")
    # Fallback to default
    return "models/gemini-2.5-flash"


def _call_gemini_analysis(text: str, model_name: str = "models/gemini-2.5-flash") -> dict:
    """Call Gemini model synchronously and return a dict with keys:
    translated_text, sentiment, language (ISO code)
    This wraps the previous parsing logic into one place.
    """
    try:
        model = genai.GenerativeModel(model_name)
        prompt = f'''
        Analyze the following customer feedback text.
        Your task is to:
        1. Detect the language of the input and return it as an ISO 639-1 code in the key "language".
        2. Translate the text into English and return it in "translated_text".
        3. Classify the sentiment as one of: 'positive', 'negative', or 'neutral' and return it in "sentiment".
        
        Provide the output ONLY in valid JSON format with these exact keys: "language", "translated_text", "sentiment".
        
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
            raise HTTPException(status_code=400, detail=f"AI returned invalid JSON: {str(je)}")
        
        return result
    
    except Exception as e:
        error_msg = str(e)
        # Check for quota/rate limit errors
        if 'ResourceExhausted' in str(type(e)) or 'quota' in error_msg.lower() or '429' in error_msg:
            raise HTTPException(
                status_code=429, 
                detail=f"API rate limit exceeded for model {model_name}. Please wait a moment and try again, or select a different model in Settings."
            )
        # Check for invalid model errors
        elif 'not found' in error_msg.lower() or 'invalid' in error_msg.lower():
            raise HTTPException(
                status_code=400,
                detail=f"Invalid or unsupported model: {model_name}. Please select a different model in Settings."
            )
        else:
            # Generic error
            print(f"Error calling Gemini API with model {model_name}: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=f"AI analysis failed: {error_msg[:200]}"
            )


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
async def translate_only(
    feedback_input: schemas.TranslateInput, 
    db: AsyncSession = Depends(get_db),
    _: None = translate_limiter
):
    """Translate and classify sentiment without storing."""
    model_name = await _get_current_gemini_model(db)
    analysis = _call_gemini_analysis(feedback_input.text, model_name)
    return schemas.TranslateOutput(**analysis)


@app.post("/api/feedback", response_model=schemas.Feedback)
async def create_feedback(
    feedback_input: schemas.FeedbackCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    _: None = feedback_limiter
):
    """Analyze input with Gemini and store the result along with optional product. 
    If analysis data (language, translated_text, sentiment) is provided, it will be used
    instead of calling Gemini again."""
    try:
        # If product provided, ensure it exists in DB
        if feedback_input.product:
            check = await db.execute(select(models.Product).where(models.Product.name == feedback_input.product))
            if not check.scalars().first():
                raise HTTPException(status_code=400, detail="Unknown product. Please select a valid product.")

        # Use pre-analyzed data if provided, otherwise call Gemini
        if feedback_input.translated_text and feedback_input.sentiment:
            # Pre-analyzed data provided, use it directly
            analysis = {
                "translated_text": feedback_input.translated_text,
                "sentiment": feedback_input.sentiment,
                "language": feedback_input.language
            }
        else:
            # No pre-analyzed data, need to call Gemini
            # Check if client disconnected before calling Gemini
            if await request.is_disconnected():
                print("Client disconnected before Gemini call, aborting...")
                raise HTTPException(status_code=499, detail="Client disconnected")

            model_name = await _get_current_gemini_model(db)
            analysis = _call_gemini_analysis(feedback_input.text, model_name)

        # Check if client disconnected before saving
        if await request.is_disconnected():
            print("Client disconnected before saving, aborting...")
            raise HTTPException(status_code=499, detail="Client disconnected")

        db_feedback = models.Feedback(
            original_text=feedback_input.text,
            translated_text=analysis.get("translated_text"),
            sentiment=analysis.get("sentiment"),
            product=feedback_input.product,
            language=analysis.get("language")
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


@app.delete("/api/feedback/all", summary="Delete all feedback matching filters")
async def delete_all_filtered_feedback(
    product: str = None,
    language: str = None,
    sentiment: str = None,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    """Delete all feedback matching the current filter (admin only)."""
    base = models.Feedback.__table__.delete()
    conds = []
    if product:
        if product == "(unspecified)":
            conds.append(or_(models.Feedback.product == '', models.Feedback.product.is_(None)))
        else:
            conds.append(models.Feedback.product == product)
    if language:
        conds.append(models.Feedback.language == language)
    if sentiment:
        conds.append(models.Feedback.sentiment == sentiment)
    if conds:
        base = base.where(and_(*conds))
    try:
        # Count before delete
        count_q = select(func.count()).select_from(models.Feedback)
        if conds:
            count_q = count_q.where(and_(*conds))
        result = await db.execute(count_q)
        to_delete = result.scalar() or 0
        await db.execute(base)
        await db.commit()
        return {"deleted": to_delete}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete filtered feedback: {e}")


@app.delete("/api/feedback/{feedback_id}")
async def delete_feedback(
    feedback_id: int,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    """Delete a single feedback record by ID (admin only)."""
    item = await db.get(models.Feedback, feedback_id)
    if not item:
        raise HTTPException(status_code=404, detail="Feedback not found")
    try:
        await db.delete(item)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete feedback: {e}")
    return {"status": "deleted", "id": feedback_id}


@app.delete("/api/feedback", summary="Bulk delete feedback entries")
async def bulk_delete_feedback(
    payload: schemas.FeedbackBulkDelete,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    """Delete multiple feedback records by IDs. Returns count deleted."""
    if not payload.ids:
        return {"deleted": 0}
    try:
        # Fetch existing IDs to confirm
        existing = await db.execute(select(models.Feedback.id).where(models.Feedback.id.in_(payload.ids)))
        existing_ids = [row[0] for row in existing.all()]
        if not existing_ids:
            return {"deleted": 0}
        await db.execute(models.Feedback.__table__.delete().where(models.Feedback.id.in_(existing_ids)))
        await db.commit()
        return {"deleted": len(existing_ids), "ids": existing_ids}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to bulk delete feedback: {e}")


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


# --- Gemini Model Management Endpoints ---

@app.get("/api/gemini/models", response_model=list[schemas.GeminiModel])
async def list_gemini_models(_: dict = Depends(get_current_admin)):
    """List available Gemini models dynamically from Google API."""
    global _gemini_models_cache, _gemini_models_cache_time
    
    # Check if cache is valid
    now = datetime.now(timezone.utc)
    if (_gemini_models_cache is not None and    
        _gemini_models_cache_time is not None and 
        (now - _gemini_models_cache_time).total_seconds() < MODELS_CACHE_TTL):
        print("Returning cached models list")
        return _gemini_models_cache
    
    try:
        print("Fetching models from Google Gemini API...")
        # Fetch available models from Google Generative AI API
        available_models = genai.list_models()
        
        # Filter for models that support generateContent method
        models_list = []
        for model in available_models:
            try:
                # Extract model name first for logging
                model_name = model.name
                model_name_lower = model_name.lower()
                
                # Check model properties for better filtering
                supported_methods = getattr(model, 'supported_generation_methods', [])
                
                # Must support generateContent method
                if 'generateContent' not in supported_methods:
                    print(f"Skipping model without generateContent: {model_name}")
                    continue
                
                # Filter based on input/output modalities if available
                # Text generation models should support text input and text output
                input_token_limit = getattr(model, 'input_token_limit', 0)
                output_token_limit = getattr(model, 'output_token_limit', 0)
                
                # Models with very low token limits are likely not suitable for text generation
                if input_token_limit > 0 and input_token_limit < 1000:
                    print(f"Skipping model with low token limit: {model_name} (input: {input_token_limit})")
                    continue
                
                # Apply keyword filtering as a safety net for obvious non-text models
                # This catches models like embedding, image, audio, video variations
                skip_keywords = ['embedding', 'aqa', 'imagen', 'text-embedding', 'image', 'audio', 'video', 'vision']
                if any(keyword in model_name_lower for keyword in skip_keywords):
                    print(f"Skipping non-text model by keyword: {model_name}")
                    continue

                
                # Create display name from model name
                # e.g., "models/gemini-2.5-flash" -> "Gemini 2.5 Flash"
                display_name = model_name.replace('models/', '').replace('-', ' ').replace('_', ' ').title()
                
                # Build description with model info
                description_parts = []
                if hasattr(model, 'display_name') and model.display_name:
                    # Use official display name if available
                    display_name = model.display_name
                
                if hasattr(model, 'description') and model.description:
                    desc_short = model.description[:100] + "..." if len(model.description) > 100 else model.description
                    description_parts.append(desc_short)
                
                description = description_parts[0] if description_parts else "AI model for content generation"
                
                models_list.append({
                    "name": model_name,
                    "display_name": display_name,
                    "description": description
                })
            except Exception as e:
                # Skip models that cause errors during processing
                model_name = getattr(model, 'name', 'unknown')
                print(f"Error processing model {model_name}: {e}")
                continue
        
        # Sort by name for consistent ordering
        models_list.sort(key=lambda x: x['name'])
        
        # If no models found, raise an error
        if not models_list:
            print("ERROR: No models with generateContent support found in API response")
            raise HTTPException(
                status_code=503,
                detail="No compatible Gemini models found. Please check your API key or try again later."
            )
        
        print(f"Successfully fetched {len(models_list)} models from API")
        # Update cache
        _gemini_models_cache = models_list
        _gemini_models_cache_time = now
        
        return models_list
        
    except HTTPException:
        # Re-raise HTTP exceptions (like the 503 above)
        raise
    except Exception as e:
        print(f"Error fetching models from Google API: {e}")
        import traceback
        traceback.print_exc()
        # Raise error to inform user
        raise HTTPException(
            status_code=503,
            detail=f"Failed to fetch models from Google Gemini API: {str(e)}. Please check your API key and internet connection."
        )


@app.get("/api/gemini/current-model", response_model=schemas.ModelSetting)
async def get_current_model(db: AsyncSession = Depends(get_db), _: dict = Depends(get_current_admin)):
    """Get the currently selected Gemini model."""
    model_name = await _get_current_gemini_model(db)
    return {"current_model": model_name}


@app.post("/api/gemini/current-model", response_model=schemas.ModelSetting)
async def update_current_model(
    payload: schemas.ModelSettingUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict = Depends(get_current_admin)
):
    """Update the currently selected Gemini model."""
    try:
        # Check if setting exists
        res = await db.execute(select(models.Settings).where(models.Settings.key == "gemini_model"))
        setting = res.scalars().first()
        
        if setting:
            setting.value = payload.model_name
        else:
            setting = models.Settings(key="gemini_model", value=payload.model_name)
            db.add(setting)
        
        await db.commit()
        return {"current_model": payload.model_name}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update model setting: {e}")