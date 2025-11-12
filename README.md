# 📊 Multilingual Customer Feedback Analyzer

A full-stack web application that collects customer feedback in any language, automatically translates it to English using Google Gemini AI, performs sentiment analysis, and provides an admin dashboard with beautiful visualizations and management tools.

## 🎯 Project Summary

This application solves the challenge of analyzing multilingual customer feedback at scale. It features:

- **Multilingual Support**: Accept feedback in any language with automatic language detection
- **AI-Powered Analysis**: Google Gemini 2.5 Pro translates text to English and classifies sentiment (positive/neutral/negative)
- **Real-time Dashboard**: Interactive pie charts, statistics, and filterable feedback lists
- **Product Management**: Track feedback across multiple products
- **Secure Admin Panel**: JWT-based authentication with sliding token expiration
- **Two-Phase Submission**: Analyze feedback first, then save - with proper cancellation support
- **Rate Limiting**: Built-in protection against API abuse
- **Responsive Design**: Modern UI that works on desktop and mobile

---

## 🏗️ Architecture Overview

### **Backend (FastAPI + Python 3.11)**
- **Framework**: FastAPI with async/await for high performance
- **Database**: PostgreSQL 14 with SQLAlchemy async ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **AI Integration**: Google Gemini 2.5 Pro for translation and sentiment analysis
- **API Design**: RESTful endpoints with OpenAPI/Swagger documentation
- **Middleware**: Token refresh, CORS, rate limiting

### **Frontend (React 18 + Vite)**
- **Framework**: React 18 with functional components and hooks
- **Build Tool**: Vite for fast development and HMR (Hot Module Replacement)
- **State Management**: Component-level state with custom event system
- **Styling**: Custom CSS with CSS variables and modern flexbox/grid layouts
- **Authentication**: Centralized `fetchWithAuth` utility with auto-refresh and logout
- **UX**: Modal dialogs with React Portals, loading states, cancellable operations

### **Infrastructure**
- **Containerization**: Docker Compose orchestrating 3 services
- **Development**: Hot-reload for both frontend and backend
- **Database**: Persistent PostgreSQL with volume mounting
- **Networking**: Internal Docker network with port mapping

---

## 🚀 Getting Started

### Prerequisites

1. **Docker & Docker Compose** installed on your system
   - [Install Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

2. **Google Gemini API Key**
   - Get your free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/abanoubmedhat/feedback_analyzer.git
   cd feedback_analyzer
   ```

2. **Create environment configuration**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   ```

3. **Configure your `.env` file**
   ```bash
   # Required: Add your Google Gemini API key
   GOOGLE_API_KEY=AIzaSy...your-actual-key-here

   # Security settings
   SECRET_KEY=your-secret-key-here-change-in-production
   ACCESS_TOKEN_EXPIRE_MINUTES=60

   # Admin credentials (default)
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin
   ADMIN_FORCE_RESET=false

   # CORS settings
   ALLOWED_ORIGINS=http://localhost:3000
   ```

4. **Build and start all services**
   ```bash
   docker-compose up --build
   ```

   This will start:
   - **Backend API** on `http://localhost:8000`
   - **Frontend UI** on `http://localhost:3000`
   - **PostgreSQL** on `localhost:5432`

5. **Access the application**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   - Redoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🎮 How to Run

### Starting the Application

```bash
# Start all services (backend, frontend, database)
docker-compose up --build

# Or run in detached mode (background)
docker-compose up --build -d
```

### Stopping the Application

```bash
# Stop all services
docker-compose down

# Stop and remove database volumes (⚠️ deletes all data)
docker-compose down -v
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Accessing Services

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **API Documentation (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Documentation (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Direct API**: [http://localhost:8000](http://localhost:8000)
- **PostgreSQL**: `localhost:5432` (user: `user`, password: `password`, db: `feedbackdb`)

---

## 🎮 How to Use

### For End Users (Feedback Submission)

1. **Navigate** to [http://localhost:3000](http://localhost:3000)
2. **Select a product** from the dropdown (e.g., "General")
3. **Enter feedback** in any language (up to 2000 characters)
4. **Click "Submit & Analyze"**
5. View the results:
   - Translated text (English)
   - Sentiment classification (😊 positive, 😐 neutral, 😞 negative)
   - Detected language (ISO code)
   - Associated product

**Supported languages**: Any language supported by Google Gemini (100+ languages including English, Spanish, French, German, Chinese, Japanese, Arabic, etc.)

### For Administrators (Dashboard)

1. **Click "Admin Login"** button in the top-right corner
2. **Login** with default credentials:
   - Username: `admin`
   - Password: `admin` (change this in production!)
3. **Navigate tabs**:
   - **Dashboard**: View analytics and manage feedback
   - **Submit Feedback**: Test the submission form
   - **Settings**: Manage products and change password

### Admin Dashboard Features

#### **Dashboard Tab**
- **Sentiment Overview Cards**: 
  - Total feedback count
  - Positive, neutral, negative counts
  - Color-coded with gradients
  
- **Interactive Pie Chart**: 
  - Visual sentiment distribution
  - Hover effects
  - Percentage breakdown with legend

- **Recent Feedback List**:
  - Paginated table (5/10/20/50 per page)
  - Filter by product, language, sentiment
  - Checkbox selection for bulk operations
  - Show/hide translated text toggle
  - Individual delete buttons
  - Bulk delete selected
  - Delete all filtered

#### **Settings Tab**
- **Product Management**:
  - Add new products
  - Delete existing products (with confirmation)
  - View all products
  
- **Password Management**:
  - Change admin password
  - Minimum 6 characters
  - Current password verification

---

## 📡 API Routes & Usage

### Public Endpoints

#### `GET /`
Welcome message and API health check

**Response:**
```json
{
  "message": "Welcome to the Feedback Analyzer API!"
}
```

---

### Feedback Endpoints

#### `POST /api/translate`
Analyze text without saving to database (preview mode)

**Purpose**: Test translation and sentiment analysis without persistence

**Request Body:**
```json
{
  "text": "This product is amazing! I love it!"
}
```

**Response:**
```json
{
  "translated_text": "This product is amazing! I love it!",
  "sentiment": "positive",
  "language": "en",
  "language_confidence": 0.99
}
```

**Rate Limit**: 30 requests per minute per IP

**Error Responses:**
- `400`: Invalid input or AI processing failed
- `429`: Rate limit exceeded

---

#### `POST /api/feedback`
Submit feedback for AI analysis and database storage

**Purpose**: Production endpoint for storing customer feedback

**Request Body (Basic):**
```json
{
  "text": "Ce produit est incroyable!",
  "product": "General"
}
```

**Request Body (With Pre-analyzed Data):**
```json
{
  "text": "Ce produit est incroyable!",
  "product": "General",
  "language": "fr",
  "translated_text": "This product is amazing!",
  "sentiment": "positive",
  "language_confidence": 0.98
}
```

**Response:**
```json
{
  "id": 1,
  "original_text": "Ce produit est incroyable!",
  "translated_text": "This product is amazing!",
  "sentiment": "positive",
  "product": "General",
  "language": "fr",
  "language_confidence": 0.98,
  "created_at": "2025-11-13T10:30:00.123456Z"
}
```

**Rate Limit**: 10 requests per minute per IP

**Error Responses:**
- `400`: Invalid input, unknown product, or AI processing failed
- `429`: Rate limit exceeded
- `499`: Client disconnected (cancelled request)
- `500`: Internal server error

---

#### `GET /api/feedback` 🔒 Admin Only
Retrieve paginated feedback with optional filters

**Authentication**: Requires `Authorization: Bearer <JWT_TOKEN>` header

**Query Parameters:**
- `product` (optional): Filter by product name (or "(unspecified)")
- `language` (optional): Filter by language code (e.g., "en", "fr", "es")
- `sentiment` (optional): Filter by sentiment ("positive", "neutral", "negative")
- `skip` (default: 0): Number of records to skip (pagination offset)
- `limit` (default: 100, max: 100): Maximum records to return

**Example Request:**
```
GET /api/feedback?product=General&sentiment=positive&skip=0&limit=10
```

**Response:**
```json
{
  "total": 42,
  "items": [
    {
      "id": 1,
      "original_text": "Great product!",
      "translated_text": "Great product!",
      "sentiment": "positive",
      "product": "General",
      "language": "en",
      "language_confidence": 0.99,
      "created_at": "2025-11-13T10:30:00Z"
    }
  ],
  "skip": 0,
  "limit": 10
}
```

---

#### `DELETE /api/feedback/{feedback_id}` 🔒 Admin Only
Delete a single feedback entry by ID

**Authentication**: Required

**Path Parameter:**
- `feedback_id`: Integer ID of the feedback to delete

**Response:**
```json
{
  "status": "deleted",
  "id": 1
}
```

**Error Responses:**
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (non-admin user)
- `404`: Feedback not found
- `500`: Deletion failed

---

#### `DELETE /api/feedback` 🔒 Admin Only
Bulk delete multiple feedback entries by IDs

**Authentication**: Required

**Request Body:**
```json
{
  "ids": [1, 2, 3, 4, 5]
}
```

**Response:**
```json
{
  "deleted": 5,
  "ids": [1, 2, 3, 4, 5]
}
```

**Notes:**
- Only existing IDs will be deleted
- Returns actual count of deleted records

---

#### `DELETE /api/feedback/all` 🔒 Admin Only
Delete all feedback matching filters

**Authentication**: Required

**Query Parameters:** (all optional)
- `product`: Filter by product name
- `language`: Filter by language code
- `sentiment`: Filter by sentiment

**Example Request:**
```
DELETE /api/feedback/all?sentiment=negative&product=General
```

**Response:**
```json
{
  "deleted": 12
}
```

**Warning**: This is a destructive operation! Use with caution.

---

#### `GET /api/stats` 🔒 Admin Only
Get sentiment statistics with optional filters

**Authentication**: Required

**Query Parameters:** (all optional)
- `product`: Filter by product name
- `language`: Filter by language code

**Example Request:**
```
GET /api/stats?product=General
```

**Response:**
```json
{
  "total": 100,
  "counts": {
    "positive": 60,
    "neutral": 25,
    "negative": 15
  },
  "percentages": {
    "positive": 60.0,
    "neutral": 25.0,
    "negative": 15.0
  }
}
```

---

### Product Management

#### `GET /api/products`
List all products (publicly accessible)

**Purpose**: Populate product dropdown in submission form

**Response:**
```json
[
  {
    "id": 1,
    "name": "General"
  },
  {
    "id": 2,
    "name": "Premium Plan"
  }
]
```

---

#### `POST /api/products` 🔒 Admin Only
Create a new product

**Authentication**: Required

**Request Body:**
```json
{
  "name": "New Product"
}
```

**Response:**
```json
{
  "id": 3,
  "name": "New Product"
}
```

**Error Responses:**
- `400`: Product already exists or invalid name
- `500`: Creation failed

---

#### `DELETE /api/products/{product_id}` 🔒 Admin Only
Delete a product by ID

**Authentication**: Required

**Path Parameter:**
- `product_id`: Integer ID of the product

**Response:**
```json
{
  "status": "deleted"
}
```

**Error Responses:**
- `404`: Product not found
- `500`: Deletion failed

**Note**: Deleting a product does NOT delete associated feedback (feedback.product remains as-is)

---

### Authentication

#### `POST /auth/token`
Login to obtain JWT access token

**Request Body (Form Data - application/x-www-form-urlencoded):**
```
username=admin
password=admin
grant_type=password
scope=
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTcwMDAwMDAwMCwiaWF0IjoxNzAwMDAwMDAwfQ.signature",
  "token_type": "bearer"
}
```

**Usage**: Include token in subsequent requests:
```
Authorization: Bearer <access_token>
```

**Token Lifetime**: Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 60 minutes)

**Sliding Expiration**: 
- Tokens automatically refresh when within 50% of expiration
- Backend sends `X-New-Token` header on successful authenticated requests
- Frontend automatically detects and stores refreshed tokens

**Error Responses:**
- `401`: Incorrect username or password

---

#### `POST /auth/change-password` 🔒 Admin Only
Change admin password

**Authentication**: Required

**Request Body:**
```json
{
  "current_password": "admin",
  "new_password": "newSecurePassword123"
}
```

**Response:**
```json
{
  "status": "ok"
}
```

**Validation:**
- `new_password` must be at least 6 characters
- `current_password` must match existing password

**Error Responses:**
- `400`: Invalid input or incorrect current password
- `401`: Unauthorized

---

### Feedback Endpoints

#### `POST /api/translate`
Analyze text without saving to database (for preview/testing)

**Request Body:**
```json
{
  "text": "This product is amazing!"
}
```

**Response:**
```json
{
  "translated_text": "This product is amazing!",
  "sentiment": "positive",
  "language": "en",
  "language_confidence": 0.99
}
```

---

## 🗄️ Data Schema

### Database Tables

#### **feedback** table
Stores all customer feedback entries with AI analysis results

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Primary key, auto-increment |
| `original_text` | STRING | No | Original feedback text (any language) |
| `translated_text` | STRING | Yes | English translation from Gemini |
| `sentiment` | STRING | No | Classification: "positive", "neutral", or "negative" |
| `product` | STRING | Yes | Associated product name |
| `language` | STRING | Yes | ISO 639-1 language code (e.g., "en", "fr", "es", "zh") |
| `language_confidence` | FLOAT | Yes | AI confidence score for language detection (0.0-1.0) |
| `created_at` | DATETIME(TZ) | No | Timestamp when feedback was created (UTC, auto-generated) |

**Indexes**: 
- Primary key on `id`
- Index on `sentiment` (for filtering)
- Index on `product` (for filtering)
- Index on `language` (for filtering)

**Example Row:**
```sql
id: 1
original_text: "Ce produit est incroyable!"
translated_text: "This product is amazing!"
sentiment: "positive"
product: "General"
language: "fr"
language_confidence: 0.98
created_at: "2025-11-13 10:30:00.123456+00"
```

---

#### **products** table
Manages available products for categorizing feedback

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Primary key, auto-increment |
| `name` | STRING | No | Unique product name |

**Constraints**: 
- Unique constraint on `name` (case-sensitive)
- Indexed on `name` for fast lookups

**Default Seeded Data:**
- "General" (created on first startup if no products exist)

---

#### **admin_users** table
Stores admin authentication credentials

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER | No | Primary key, auto-increment |
| `username` | STRING | No | Unique username for admin login |
| `password_hash` | STRING | No | Bcrypt-hashed password (never plain text) |

**Constraints**: 
- Unique constraint on `username`
- Indexed on `username` for fast authentication

**Default Seeded Data:**
- Username: `admin` (from `ADMIN_USERNAME` env var)
- Password: `admin` (from `ADMIN_PASSWORD` env var, hashed with bcrypt)

**Security Notes:**
- Passwords are hashed using bcrypt with automatic salt generation
- Plain-text passwords are NEVER stored
- Hash verification happens server-side only

---

### Entity Relationships

```
products (1) ─────< (many) feedback
    │                        │
    │                        │
 name field    ──────   product field
  (unique)              (foreign key-like, 
                         but not enforced 
                         via FK constraint)
```

**Note**: Product deletion does NOT cascade to feedback. Feedback retains the product name even if the product is deleted from the `products` table.

---

## 🤖 Google Gemini AI Integration

### Overview

This application uses **Google Gemini 2.5 Pro** for three AI-powered tasks:
1. **Language Detection**: Identify the language of input text
2. **Translation**: Convert text to English
3. **Sentiment Analysis**: Classify as positive, neutral, or negative

### Configuration

**Required**: Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

**Setup**: Add to `.env` file
```bash
GOOGLE_API_KEY=AIzaSy...your-actual-key-here
```

**SDK**: Uses official `google-generativeai` Python package
```python
import google.generativeai as genai
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
```

---

### Gemini Model Configuration

**Model**: `models/gemini-2.5-pro`
- **Context Window**: 1 million tokens
- **Max Output**: 8,192 tokens
- **Capabilities**: Multilingual understanding, translation, reasoning

**Why Gemini 2.5 Pro?**
- Superior language detection across 100+ languages
- High-quality translation with context awareness
- Nuanced sentiment analysis (not just positive/negative)
- Cost-effective for moderate usage

---

### Prompt Engineering

The application uses a carefully crafted prompt to ensure consistent JSON responses:

```python
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
```

**Prompt Design Principles:**
- **Explicit Instructions**: Clear numbered steps
- **JSON-Only Output**: Prevents extraneous text
- **Standard Format**: ISO codes for language
- **Constrained Sentiment**: Only 3 valid values
- **Confidence Score**: Optional metric for quality assessment

---

### Response Parsing

The backend includes robust error handling for AI responses:

#### **Markdown Fence Removal**
Gemini sometimes wraps JSON in markdown code blocks:
```python
if text_resp.startswith("```"):
    text_resp = text_resp.split("```", 1)[1]
    if text_resp.startswith("json"):
        text_resp = text_resp[4:].lstrip()
    text_resp = text_resp.rsplit("```", 1)[0].strip()
```

#### **JSON Validation**
```python
try:
    result = json.loads(text_resp)
except json.JSONDecodeError as je:
    raise HTTPException(
        status_code=400, 
        detail=f"AI returned invalid JSON: {str(je)}"
    )
```

#### **Expected Response Format**
```json
{
  "translated_text": "English translation here",
  "sentiment": "positive",
  "language": "fr",
  "language_confidence": 0.98
}
```

---

### Rate Limiting for AI Calls

**Purpose**: Protect against quota exhaustion and API abuse

**Limits:**
- `/api/translate`: 30 requests per minute per IP
- `/api/feedback`: 10 requests per minute per IP

**Implementation**: In-memory rate limiter (per-IP tracking)

**Exceeded Response:**
```json
{
  "detail": "Rate limit exceeded. Please try again later."
}
```

---

### Error Handling

#### **Empty Responses**
```python
if not response.parts or not response.text:
    raise HTTPException(
        status_code=400, 
        detail="AI content generation failed. Empty response from Gemini API."
    )
```

#### **Invalid JSON**
```python
raise HTTPException(
    status_code=400, 
    detail=f"AI returned invalid JSON: {parsing_error}"
)
```

#### **Missing API Key**
```python
if not api_key:
    print("WARNING: GOOGLE_API_KEY not set; Gemini calls will fail if invoked.")
```

---

### Performance Characteristics

**Typical Latency:**
- Short text (1-50 words): 2-3 seconds
- Medium text (50-500 words): 3-5 seconds
- Long text (500-2000 words): 5-10 seconds

**Timeout Protection:**
- Frontend: 20-second timeout with cancel button
- Backend: Client disconnection detection

**Cost Considerations:**
- Gemini 2.5 Pro: Free tier includes 50 requests/day
- Paid tier: $0.00025 per 1K characters (input) + $0.00075 per 1K characters (output)
- Average feedback (100 chars): ~$0.0001 per analysis

---

### Language Support

**Supported Languages** (100+):
- **European**: English, Spanish, French, German, Italian, Portuguese, Dutch, Polish, Swedish, etc.
- **Asian**: Chinese (Simplified/Traditional), Japanese, Korean, Hindi, Thai, Vietnamese, etc.
- **Middle Eastern**: Arabic, Hebrew, Persian, Turkish, etc.
- **Others**: Russian, Ukrainian, Greek, Indonesian, Malay, etc.

**Language Codes** (ISO 639-1):
```
en = English    fr = French     es = Spanish
de = German     it = Italian    pt = Portuguese
zh = Chinese    ja = Japanese   ko = Korean
ar = Arabic     hi = Hindi      ru = Russian
```

---

### Known AI Limitations

1. **Mixed-Language Text**
   - Example: "I love this产品!"
   - Gemini may default to the dominant language or mark as "mixed"
   - Workaround: Encourage single-language feedback

2. **Very Short Text**
   - Example: "Great!"
   - Low confidence scores due to lack of context
   - May misclassify language or sentiment

3. **Sarcasm Detection**
   - Example: "Oh great, another broken feature..."
   - May classify as "positive" due to keyword "great"
   - Limitation of current sentiment models

4. **Regional Dialects**
   - Example: Cantonese vs. Mandarin
   - Both may be classified as "zh" (Chinese)
   - language_confidence may be lower

5. **Emoji Interpretation**
   - Example: "This product 😊😊😊"
   - Gemini handles emojis well, but not all models do
   - Consider emoji as a sentiment signal

---

## 🏗️ Frontend + Backend Overview

### Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + Vite | Modern UI with fast HMR |
| **Backend** | FastAPI + Python 3.11 | Async REST API |
| **Database** | PostgreSQL 14 | Relational data storage |
| **AI** | Google Gemini 2.5 Pro | Translation & sentiment analysis |
| **Auth** | JWT + Bcrypt | Secure token-based auth |
| **Deployment** | Docker Compose | Containerized multi-service app |

---

### Backend Architecture (FastAPI)

#### **Project Structure**
```
backend/
├── main.py              # FastAPI app, routes, middleware
├── models.py            # SQLAlchemy ORM models
├── schemas.py           # Pydantic request/response schemas
├── database.py          # Database engine & session config
├── requirements.txt     # Python dependencies
├── Dockerfile           # Container image definition
└── .env                 # Environment variables (not committed)
```

#### **Key Features**

**1. Async/Await Architecture**
- All database operations use `async/await` for concurrency
- SQLAlchemy async engine with `asyncpg` driver
- Non-blocking I/O for high throughput

**2. Automatic API Documentation**
- Swagger UI at `/docs`
- ReDoc at `/redoc`
- OpenAPI 3.0 schema auto-generated

**3. Middleware Stack**
```python
1. CORS Middleware         # Cross-origin requests
2. Token Refresh Middleware # Sliding expiration
3. Rate Limiting           # Per-IP request tracking
```

**4. Authentication Flow**
```
User → POST /auth/token → JWT issued → Store in localStorage
↓
Subsequent requests → Authorization: Bearer <token> → Verify → Allow/Deny
↓
Token near expiry? → Backend sends X-New-Token → Frontend updates token
```

**5. Database Session Management**
```python
async def get_db():
    async with AsyncSessionLocal() as db:
        yield db  # Dependency injection into routes
```

**6. Error Handling**
- HTTP status codes follow REST conventions
- Detailed error messages with validation errors
- Exception middleware catches unhandled errors

---

### Frontend Architecture (React + Vite)

#### **Project Structure**
```
frontend/
├── src/
│   ├── App.jsx              # Root component, auth state, routing
│   ├── main.jsx             # React entry point
│   ├── styles.css           # Global styles (CSS variables)
│   ├── pages/
│   │   ├── Dashboard.jsx    # Admin dashboard (stats, management)
│   │   └── Submit.jsx       # Feedback submission form
│   └── utils/
│       └── fetchWithAuth.js # Auth-aware fetch wrapper
├── index.html               # HTML template
├── vite.config.mjs          # Vite configuration
├── package.json             # Node dependencies
└── Dockerfile               # Container image definition
```

#### **Key Features**

**1. Component Architecture**
```
App.jsx (Root)
├── Auth State Management
├── Product State (shared)
├── Token Refresh Listeners
├── Session Monitoring
└── Tab Navigation
    ├── Dashboard.jsx (Admin)
    │   ├── Sentiment Overview Cards
    │   ├── Pie Chart Visualization
    │   ├── Feedback Table (paginated)
    │   └── Delete Confirmations (Promise-based)
    ├── Submit.jsx (Public + Admin)
    │   ├── Two-Phase Submission
    │   ├── AbortController Integration
    │   └── Real-time Feedback Display
    └── Settings (Admin)
        ├── Product Management
        └── Password Change
```

**2. State Management**
- **Local Component State**: `useState` for form inputs, UI state
- **Event System**: Custom events for cross-component communication
  - `feedback:created` → Dashboard auto-refresh
  - `auth:logout` → Global logout trigger
  - `token:refreshed` → Token state synchronization

**3. Two-Phase Submission Pattern**
```javascript
Phase 1: Analyze
  ↓
  POST /api/translate (AbortController enabled)
  ↓
  User sees: "🔍 Analyzing..."
  ↓
  User can cancel (no DB write)
  ↓
Phase 2: Save
  ↓
  POST /api/feedback (with pre-analyzed data)
  ↓
  User sees: "💾 Saving..."
  ↓
  Success: Feedback stored + Dashboard refreshed
```

**Benefits:**
- User can cancel during long AI operations
- No database writes for cancelled requests
- Better UX with detailed progress indicators

**4. Authentication Utilities**

**fetchWithAuth.js** - Centralized auth wrapper
```javascript
// Automatically adds Authorization header
// Detects X-New-Token and updates localStorage
// Triggers logout on 401 errors
// Dispatches custom events for state sync

const response = await fetchWithAuth('/api/feedback')
```

**5. Modal System with React Portals**
```javascript
// Modals render at document.body to escape stacking contexts
{confirmDelete && createPortal(
  <ConfirmModal />,
  document.body
)}
```

**6. Responsive Design**
- CSS Grid for dashboard layout
- Flexbox for components
- CSS variables for theming
- Mobile-friendly breakpoints

---

### Communication Flow

```
┌─────────────┐          ┌─────────────┐          ┌──────────────┐
│   Browser   │          │   Backend   │          │  PostgreSQL  │
│  (React)    │          │  (FastAPI)  │          │  (Database)  │
└──────┬──────┘          └──────┬──────┘          └──────┬───────┘
       │                        │                        │
       │  1. POST /api/feedback │                        │
       │───────────────────────>│                        │
       │                        │  2. Call Gemini API    │
       │                        │───────────────────>    │
       │                        │  3. Get AI response    │
       │                        │<───────────────────    │
       │                        │                        │
       │                        │  4. INSERT INTO        │
       │                        │───────────────────────>│
       │                        │  5. Return saved row   │
       │                        │<───────────────────────│
       │  6. Return JSON        │                        │
       │<───────────────────────│                        │
       │                        │                        │
       │  7. Dispatch event     │                        │
       │  'feedback:created'    │                        │
       │                        │                        │
       │  8. Dashboard refresh  │                        │
       │  GET /api/stats        │                        │
       │───────────────────────>│  9. SELECT COUNT(*)    │
       │                        │───────────────────────>│
       │                        │  10. Return aggregates │
       │                        │<───────────────────────│
       │  11. Update UI         │                        │
       │<───────────────────────│                        │
       │                        │                        │
```

---

### Docker Compose Orchestration

```yaml
services:
  backend:      # FastAPI Python app
    ports: 8000:8000
    depends_on: [db]
    volumes: ./backend:/app (hot-reload)
    
  frontend:     # Vite React dev server
    ports: 3000:3000
    depends_on: [backend]
    volumes: ./frontend:/app (hot-reload)
    
  db:           # PostgreSQL database
    ports: 5432:5432
    volumes: postgres_data (persistent)
```

**Internal Network:**
- Frontend → Backend: `http://backend:8000`
- Backend → Database: `postgresql+asyncpg://user:password@db/feedbackdb`

**External Access:**
- User → Frontend: `http://localhost:3000`
- User → Backend: `http://localhost:8000` (proxied via Vite)
- User → Database: `localhost:5432` (for admin tools)

---

## ⚠️ Limitations & Known Issues

### Current Limitations

#### **1. Single Admin User**
**Issue**: System supports only one admin account
- No multi-user support
- No role-based access control (RBAC)
- No user registration flow

**Workaround**: 
```sql
-- Manually add admin users via SQL
INSERT INTO admin_users (username, password_hash) 
VALUES ('admin2', '$2b$12$hashed_password_here');
```

**Planned**: Multi-admin support in future release

---

#### **2. In-Memory Rate Limiter**
**Issue**: Rate limits stored in application memory
- Resets when backend restarts
- Not shared across multiple backend instances
- No persistence

**Impact**: 
- Low (suitable for single-instance deployments)
- Not production-ready for horizontal scaling

**Production Alternative**: 
- Use Redis for distributed rate limiting
- Implement middleware with `slowapi` or `fastapi-limiter`

---

#### **3. No Email Notifications**
**Issue**: No alerts for new feedback or sentiment trends
- Admins must manually check dashboard
- No real-time alerts for negative sentiment

**Workaround**: 
- Poll `/api/stats` endpoint periodically
- Set up external monitoring

**Planned**: Email integration with SendGrid/AWS SES

---

#### **4. Language Detection Edge Cases**
**Issue**: Mixed-language text confuses AI

**Examples:**
```
"I love this产品!"  → May classify as "en" or "zh"
"Great job! 👍👍👍"  → Emojis may skew results
```

**Mitigation**:
- Encourage single-language feedback
- Use `language_confidence` to flag low-quality detections

---

#### **5. No Feedback Editing**
**Issue**: Once submitted, feedback cannot be modified
- Only deletion is supported
- No edit history/audit trail

**Rationale**: 
- Intentional design to maintain data integrity
- Prevents tampering with historical sentiment

**Workaround**: Delete and re-submit

---

#### **6. Pagination UX**
**Issue**: Some operations reset filters/pagination
- Deleting items may cause page refresh issues
- Filter state not persisted in URL

**Impact**: Minor inconvenience

**Planned**: URL state management with React Router

---

### Known Bugs

#### **1. Token Expiration During Sleep Mode**
**Scenario**: Computer sleeps mid-session → Token expires → User sees error on wake

**Status**: 
- User will see "Token expired" message
- Must log in again
- No data loss

**Mitigation**: 
- Frontend proactive logout timer handles most cases
- Token refresh happens automatically for active users

---

#### **2. Modal Scroll Lock on Small Screens**
**Scenario**: Delete confirmation modals with very long messages overflow viewport

**Status**: 
- Rare occurrence (messages usually short)
- Acceptable for MVP

**Workaround**: User can still scroll to see buttons

**Fix**: Add `max-height` + `overflow-y: auto` to modal body

---

#### **3. Dashboard Refresh Race Condition**
**Scenario**: Rapid submission + deletion → Dashboard shows stale data

**Status**: 
- Resolved by sequential refresh operations
- Use of `Promise.allSettled` ensures all refreshes complete

**Impact**: None (fixed in current version)

---

### Performance Considerations

#### **1. Gemini API Latency**
**Typical Response Time:**
- Short text: 2-5 seconds
- Long text: 5-10 seconds

**Status**: Expected behavior with cloud AI

**Mitigation**:
- 20-second timeout with user-friendly cancel button
- Two-phase submission allows early cancellation
- Loading indicators with elapsed time display

---

#### **2. Database Query Performance**
**Current State:**
- Indexes on `product`, `language`, `sentiment`
- Queries perform well up to ~10,000 rows
- No full-text search implementation

**Acceptable For**: 
- Small to medium deployments (<10k feedback entries)

**Future Optimization**:
- Add PostgreSQL full-text search
- Implement `ts_vector` columns for search
- Consider Elasticsearch for large datasets

---

#### **3. Frontend Bundle Size**
**Current**:
- React + React-DOM: ~150KB (gzipped)
- Total bundle: ~300KB (gzipped)

**Status**: Acceptable for modern networks

**Future Optimization**:
- Code splitting with React.lazy()
- Route-based chunking
- Tree-shaking unused dependencies

---

### Security Considerations

#### **1. Environment Variables**
**Risk**: `.env` file contains sensitive data

**Mitigation**:
- `.env` is `.gitignore`'d
- `.env.example` provided for reference
- Never commit secrets to repository

**Production Recommendation**:
- Use secret management (AWS Secrets Manager, HashiCorp Vault)
- Inject secrets via CI/CD pipeline

---

#### **2. SQL Injection**
**Risk**: User input could manipulate SQL queries

**Mitigation**:
- SQLAlchemy ORM prevents injection
- Parameterized queries throughout
- No raw SQL execution with user input

---

#### **3. XSS (Cross-Site Scripting)**
**Risk**: Malicious feedback could contain scripts

**Mitigation**:
- React escapes all text by default
- No `dangerouslySetInnerHTML` usage
- Content-Security-Policy can be added

---

#### **4. CSRF (Cross-Site Request Forgery)**
**Risk**: Unauthorized actions via forged requests

**Mitigation**:
- JWT tokens in Authorization header (not cookies)
- CORS configured to specific origins
- SameSite cookie policy (if using cookies)

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### **Problem: Backend Won't Start**
```
ERROR: Could not connect to the database after multiple attempts
```

**Solutions:**
1. Check PostgreSQL container status:
   ```bash
   docker-compose logs db
   ```

2. Ensure no port conflicts:
   ```bash
   # Windows PowerShell
   netstat -an | Select-String "5432"
   
   # Linux/Mac
   lsof -i :5432
   ```

3. Wait 10-15 seconds for DB initialization (first run only)

4. Restart services:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

---

#### **Problem: Gemini API Errors**
```
HTTP 400: AI content generation failed. Empty response from Gemini API.
```

**Solutions:**
1. Verify API key in `.env`:
   ```bash
   cat .env | grep GOOGLE_API_KEY
   ```

2. Test API key directly:
   ```bash
   curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=YOUR_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
   ```

3. Check quota limits:
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Navigate to "API Keys" section
   - Check usage metrics

4. Verify model name:
   - Ensure `main.py` uses `models/gemini-2.5-pro`
   - Check Gemini documentation for model availability

---

#### **Problem: Token Expired Immediately**
```
Login works but "Token expired" error appears within seconds
```

**Solutions:**
1. Check `ACCESS_TOKEN_EXPIRE_MINUTES` in `.env`:
   ```bash
   cat .env | grep ACCESS_TOKEN_EXPIRE_MINUTES
   ```

2. For debugging, set to 1 minute:
   ```
   ACCESS_TOKEN_EXPIRE_MINUTES=1
   ```

3. For production, use 60+ minutes:
   ```
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   ```

4. Verify system clock synchronization:
   - JWT uses UTC timestamps
   - Ensure server time is accurate

5. Clear browser cache and localStorage:
   ```javascript
   // Browser console
   localStorage.clear()
   location.reload()
   ```

---

#### **Problem: Hot-Reload Not Working**
```
Code changes don't reflect in running application
```

**Solutions:**

**Backend (Python):**
```bash
# Restart backend service
docker-compose restart backend

# Or rebuild
docker-compose up --build backend
```

**Frontend (React):**
```bash
# Restart frontend service
docker-compose restart frontend

# Or check Vite logs
docker-compose logs -f frontend
```

**Nuclear Option:**
```bash
docker-compose down
docker-compose up --build
```

---

#### **Problem: CORS Errors**
```
Access to fetch at 'http://localhost:8000/api/feedback' has been blocked by CORS policy
```

**Solutions:**
1. Check `ALLOWED_ORIGINS` in `.env`:
   ```
   ALLOWED_ORIGINS=http://localhost:3000
   ```

2. Ensure frontend runs on correct port:
   ```bash
   # Should show frontend on :3000
   docker-compose ps
   ```

3. Restart backend after `.env` changes:
   ```bash
   docker-compose restart backend
   ```

4. Clear browser cache:
   - Hard refresh: `Ctrl + Shift + R` (Windows/Linux)
   - Or: `Cmd + Shift + R` (Mac)

---

#### **Problem: Database Connection Refused**
```
ERROR: could not connect to server: Connection refused
```

**Solutions:**
1. Check if database container is running:
   ```bash
   docker-compose ps db
   ```

2. Inspect database logs:
   ```bash
   docker-compose logs db
   ```

3. Verify port availability:
   ```bash
   # Windows PowerShell
   Test-NetConnection -ComputerName localhost -Port 5432
   
   # Linux/Mac
   telnet localhost 5432
   ```

4. Remove volumes and restart:
   ```bash
   docker-compose down -v
   docker-compose up --build
   ```

---

#### **Problem: Frontend Shows Blank Page**
```
White screen, no errors in terminal
```

**Solutions:**
1. Check browser console:
   - Open DevTools: `F12`
   - Look for JavaScript errors

2. Verify frontend logs:
   ```bash
   docker-compose logs frontend
   ```

3. Check Vite server status:
   - Should see "Local: http://localhost:3000"
   - Should see "ready in Xms"

4. Clear browser cache and hard refresh

5. Rebuild frontend:
   ```bash
   docker-compose up --build frontend
   ```

---

#### **Problem: Admin Login Fails**
```
HTTP 401: Incorrect username or password
```

**Solutions:**
1. Verify credentials in `.env`:
   ```
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=admin
   ```

2. Check if admin user was seeded:
   ```bash
   # Access database
   docker-compose exec db psql -U user -d feedbackdb
   
   # Query admin users
   SELECT * FROM admin_users;
   ```

3. Force password reset:
   ```
   # In .env
   ADMIN_FORCE_RESET=true
   
   # Restart backend
   docker-compose restart backend
   
   # Change back to false
   ADMIN_FORCE_RESET=false
   ```

4. Check backend logs for seeding messages:
   ```bash
   docker-compose logs backend | grep "admin"
   ```

---

### Debug Mode

#### **Enable Verbose Logging**

**Backend:**
```python
# In main.py (add at top)
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
```javascript
// Already has console.log statements
// Check browser console (F12)
```

#### **Inspect Database**
```bash
# Access PostgreSQL shell
docker-compose exec db psql -U user -d feedbackdb

# Useful queries
SELECT COUNT(*) FROM feedback;
SELECT * FROM feedback ORDER BY created_at DESC LIMIT 5;
SELECT sentiment, COUNT(*) FROM feedback GROUP BY sentiment;
SELECT * FROM products;
SELECT * FROM admin_users;
```

---

## 📚 Additional Resources

### API Documentation
- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **OpenAPI JSON**: [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

### Official Documentation
- [FastAPI Documentation](https://fastapi.tiangolo.com/) - Backend framework
- [React Documentation](https://react.dev/) - Frontend library
- [Google Gemini API](https://ai.google.dev/docs) - AI integration
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) - ORM
- [Docker Compose](https://docs.docker.com/compose/) - Container orchestration
- [PostgreSQL 14](https://www.postgresql.org/docs/14/) - Database
- [Vite](https://vitejs.dev/) - Build tool
- [Pydantic V2](https://docs.pydantic.dev/latest/) - Data validation

### Learning Resources
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/) - Step-by-step guide
- [React Tutorial](https://react.dev/learn) - Official React course
- [Docker for Beginners](https://docker-curriculum.com/) - Container basics
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/) - SQL fundamentals

### Tools & Extensions
- **VS Code**: Recommended IDE
  - Extensions: Python, ESLint, Prettier, Docker
- **Postman**: API testing
- **DBeaver**: Database management
- **React DevTools**: Browser extension for debugging

---

## 🤝 Contributing

Contributions are welcome! Here are areas for improvement:

### Feature Ideas

1. **Multi-language UI** (i18n)
   - Translate dashboard to multiple languages
   - Use `react-i18next` or similar

2. **User Authentication** (separate from admin)
   - Allow end-users to create accounts
   - View their own feedback history

3. **Export Feedback** (CSV, JSON, Excel)
   - Download filtered feedback
   - Scheduled reports via email

4. **Email Notifications**
   - Alert on negative sentiment
   - Daily/weekly summaries
   - Integration with SendGrid/AWS SES

5. **Feedback Trends** (Time-series charts)
   - Sentiment over time
   - Language distribution trends
   - Product comparison charts

6. **Dark Mode** Toggle
   - CSS variables already in place
   - Add theme switcher

7. **Bulk Import** from CSV
   - Upload existing feedback data
   - Batch processing endpoint

8. **Webhook Support**
   - Trigger external systems on new feedback
   - Integrate with Slack, Teams, etc.

9. **Advanced Search**
   - Full-text search on feedback
   - PostgreSQL `ts_vector` implementation

10. **Mobile App**
    - React Native version
    - Native iOS/Android apps

---

## 📄 License

This project is provided as-is for educational and demonstration purposes.

**Usage**: Free for personal and commercial use  
**Attribution**: Not required but appreciated  
**Warranty**: None - use at your own risk

---

## 👨‍💻 Author

**Abanoub Medhat**  
GitHub: [@abanoubmedhat](https://github.com/abanoubmedhat)

---

## 🙏 Acknowledgments

- **Google Gemini AI** for powerful multilingual translation and sentiment analysis
- **FastAPI** team for an excellent async Python framework
- **React** team for the modern, efficient UI library
- **Docker** for making deployment seamless
- **PostgreSQL** community for the robust database
- **Open Source Community** for countless libraries and tools

---

## 📞 Support

For issues, questions, or feature requests:

1. **Check this README** thoroughly (especially Troubleshooting section)
2. **Review API docs** at `/docs` endpoint
3. **Search existing issues** on GitHub
4. **Open a new issue** with:
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs. actual behavior
   - Environment details (OS, Docker version, etc.)
   - Relevant logs

---

**Built with ❤️ using FastAPI, React, PostgreSQL, and Google Gemini AI**

*Last Updated: November 13, 2025*
