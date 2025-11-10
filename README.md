# Multilingual Customer Feedback Analyzer v1.0

Short demo project that accepts customer feedback in multiple languages, uses
Google Gemini to detect language, translate into English and classify sentiment,
and stores feedback in PostgreSQL. The project is containerized with Docker
Compose and exposes a FastAPI backend (OpenAPI / Swagger UI).

This repository is an in-development demo. It's acceptable to reset the database
during development; do NOT store production secrets in the repository.

---

## Getting started (development)

Prerequisites:
- Docker & Docker Compose
- A Google API key with access to Gemini (set `GOOGLE_API_KEY`)

1. Copy or create a root `.env` with your `GOOGLE_API_KEY`:

```powershell
Copy-Item .\backend\.env .\.env -Force
# Edit .env and replace the placeholder with your real key
```

2. Start the stack (from repo root):

```powershell
docker compose up --build -d
```

3. Open the API docs:

http://localhost:8000/docs

4. Try endpoints (examples below).

Stopping and removing containers + volumes (destroys DB data):

```powershell
docker compose down -v
```

---

## API routes

POST /api/feedback
- Purpose: Analyze (Gemini) and store feedback.
- Body: { "text": "...", "product": "Optional product name" }
- Response: stored feedback object (includes id, translated_text, sentiment, language)

POST /api/translate
- Purpose: Analyze only (translate + sentiment) without storing.
- Body: { "text": "..." }
- Response: { translated_text, sentiment, language, language_confidence }

GET /api/feedback
- Purpose: List stored feedback
- Query params: `product`, `language`, `sentiment`, `skip`, `limit`

GET /api/stats
- Purpose: Sentiment counts and percentages
- Optional filters: `product`, `language`

---

## Data schema (Postgres)

Table `feedback` columns:
- id: integer (PK)
- original_text: text
- translated_text: text
- sentiment: text (positive/negative/neutral)
- product: text (optional)
- language: text (ISO-639-1 code recommended)
- language_confidence: float (optional)
- created_at: timestamp

Note: For development the app uses SQLAlchemy `create_all()` to create tables.
For production use, integrate Alembic for proper migrations.

---

## Gemini Studio integration

The backend uses `google-generativeai` (or `google-generativeai` client) and
calls a Gemini model (configured in `backend/main.py` as `models/gemini-2.5-pro`).
The prompt requests JSON with keys: `translated_text`, `sentiment`, `language`,
and `language_confidence`.

The backend strips markdown code fences and parses JSON safely. If Gemini
returns invalid JSON or an empty response, the API returns HTTP 400 with a
descriptive message.

---

## Frontend

This repo does not yet include a frontend. The intended frontend is a React
SPA (Vite or Create React App) that provides:
- A feedback submission form (text + optional product)
- A dashboard showing sentiment distribution and filters by product/language

I'll add a scaffolding and docker-compose service for the frontend as the next
step if you want.

---

## Limitations & notes

- This demo stores the Google API key in a local `.env` for convenience — do
  not commit secrets.
- SQLAlchemy `create_all()` is used for development only. Use Alembic in
  production.
- Gemini calls are synchronous and will block workers; consider background
  tasks or async patterns for production workloads.
- The project currently uses PostgreSQL (see `docker-compose.yml`).

---

If you want, I can now:
- Scaffold the React frontend and wire it to the backend, or
- Add Alembic for migrations and a small startup migration script, or
- Add unit tests for the backend endpoints.
