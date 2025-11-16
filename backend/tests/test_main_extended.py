"""
Additional tests for main.py to improve coverage.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock, PropertyMock
from datetime import datetime, timedelta, timezone

import main
from models import Feedback, Settings

@pytest.mark.asyncio
async def test_read_root(client: AsyncClient):
    """Test the root endpoint."""
    response = await client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the Feedback Analyzer API!"}

@pytest.mark.asyncio
async def test_get_stats_no_feedback(client: AsyncClient, admin_token_headers):
    """Test stats endpoint when there is no feedback."""
    response = await client.get("/api/stats", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["counts"] == {}
    assert data["percentages"] == {}

@pytest.mark.asyncio
async def test_get_stats_with_feedback(client: AsyncClient, admin_token_headers, sample_feedback):
    """Test stats endpoint with existing feedback using the factory."""
    # Add some feedback entries
    await sample_feedback(sentiment="positive", product="Product A")
    await sample_feedback(sentiment="positive", product="Product A")
    await sample_feedback(sentiment="negative", product="Product B")
    await sample_feedback(sentiment="neutral", product="Product A", language="fr")

    # Test without filters
    response = await client.get("/api/stats", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4
    assert data["counts"] == {"positive": 2, "negative": 1, "neutral": 1}
    assert data["percentages"]["positive"] == 50.0
    assert data["percentages"]["negative"] == 25.0
    assert data["percentages"]["neutral"] == 25.0

    # Test with product filter
    response = await client.get("/api/stats?product=Product A", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert data["counts"] == {"positive": 2, "neutral": 1}

    # Test with language filter
    response = await client.get("/api/stats?language=fr", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["counts"] == {"neutral": 1}


# --- Gemini Model Management Tests ---

@pytest.mark.asyncio
async def test_list_gemini_models(client: AsyncClient, admin_token_headers):
    """Test listing available Gemini models, mocking the genai call."""
    # Mock model attributes properly
    mock_pro = MagicMock()
    mock_pro.name = 'models/gemini-pro'
    type(mock_pro).supported_generation_methods = PropertyMock(return_value=['generateContent'])
    type(mock_pro).input_token_limit = PropertyMock(return_value=8000)
    mock_pro.display_name = "Gemini Pro"
    mock_pro.description = "The best all-around model."

    mock_flash = MagicMock()
    mock_flash.name = 'models/gemini-1.5-flash'
    type(mock_flash).supported_generation_methods = PropertyMock(return_value=['generateContent'])
    type(mock_flash).input_token_limit = PropertyMock(return_value=8000)
    mock_flash.display_name = "Gemini 1.5 Flash"
    mock_flash.description = "The fastest and most cost-effective model."
    
    with patch('google.generativeai.list_models', return_value=[mock_pro, mock_flash]) as mock_list:
        # Clear cache to ensure API is called
        main._gemini_models_cache = None
        
        response = await client.get("/api/gemini/models", headers=admin_token_headers)
        assert response.status_code == 200
        mock_list.assert_called_once()
        data = response.json()
        assert len(data) == 2
        assert data[0]['name'] == 'models/gemini-1.5-flash' # Sorted by name
        assert data[1]['name'] == 'models/gemini-pro'

@pytest.mark.asyncio
async def test_get_current_model(client: AsyncClient, admin_token_headers, db_session):
    """Test getting the current Gemini model from settings."""
    # Set a model in the database
    setting = Settings(key="gemini_model", value="models/test-model")
    db_session.add(setting)
    await db_session.commit()

    response = await client.get("/api/gemini/current-model", headers=admin_token_headers)
    assert response.status_code == 200
    assert response.json() == {"current_model": "models/test-model"}

@pytest.mark.asyncio
async def test_update_current_model(client: AsyncClient, admin_token_headers, db_session):
    """Test updating the current Gemini model."""
    response = await client.post(
        "/api/gemini/current-model",
        headers=admin_token_headers,
        json={"model_name": "models/new-awesome-model"}
    )
    assert response.status_code == 200
    assert response.json() == {"current_model": "models/new-awesome-model"}

    # Verify it was saved to the DB
    res = await db_session.execute(main.select(Settings).where(Settings.key == "gemini_model"))
    setting = res.scalars().first()
    assert setting is not None
    assert setting.value == "models/new-awesome-model"


# --- Deletion Tests ---

@pytest.mark.asyncio
async def test_bulk_delete_feedback(client: AsyncClient, admin_token_headers, sample_feedback):
    """Test bulk deleting feedback entries by ID."""
    f1 = await sample_feedback(original_text="f1")
    f2 = await sample_feedback()
    f3 = await sample_feedback()

    import json
    response = await client.request(
        "DELETE",
        "/api/feedback",
        headers=admin_token_headers,
        content=json.dumps({"ids": [f1.id, f3.id]}),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] == 2
    assert sorted(data["ids"]) == sorted([f1.id, f3.id])

    # Verify f2 still exists
    get_response = await client.get(f"/api/feedback", headers=admin_token_headers)
    remaining_feedback = get_response.json().get("items", [])
    assert len(remaining_feedback) == 1
    assert remaining_feedback[0]["id"] == f2.id

@pytest.mark.asyncio
async def test_delete_all_filtered_feedback(client: AsyncClient, admin_token_headers, sample_feedback):
    """Test deleting all feedback that matches a filter."""
    await sample_feedback(product="FilterProduct", sentiment="positive")
    await sample_feedback(product="FilterProduct", sentiment="positive")
    await sample_feedback(product="OtherProduct", sentiment="positive")

    # Delete all from "FilterProduct"
    response = await client.delete(
        "/api/feedback/all?product=FilterProduct",
        headers=admin_token_headers
    )
    assert response.status_code == 200
    assert response.json() == {"deleted": 2}

    # Verify only the "OtherProduct" feedback remains
    get_response = await client.get("/api/feedback", headers=admin_token_headers)
    remaining_feedback = get_response.json()["items"]
    assert len(remaining_feedback) == 1
    assert remaining_feedback[0]["product"] == "OtherProduct"


# --- Miscellaneous and Edge Case Tests ---

def test_should_refresh_token():
    """Test the token refresh logic."""
    # Set expiry to be just inside the 50% refresh window
    refresh_time = datetime.now(timezone.utc) + timedelta(minutes=main.ACCESS_TOKEN_EXPIRE_MINUTES * 0.4)
    assert main.should_refresh_token(refresh_time.timestamp()) is True

    # Set expiry to be outside the refresh window
    no_refresh_time = datetime.now(timezone.utc) + timedelta(minutes=main.ACCESS_TOKEN_EXPIRE_MINUTES * 0.6)
    assert main.should_refresh_token(no_refresh_time.timestamp()) is False

    # Test with expired token
    expired_time = datetime.now(timezone.utc) - timedelta(minutes=1)
    assert main.should_refresh_token(expired_time.timestamp()) is False

@pytest.mark.asyncio
async def test_get_feedback_unspecified_product(client: AsyncClient, admin_token_headers, sample_feedback):
    """Test filtering feedback for items with no product specified."""
    await sample_feedback(product="RealProduct")
    await sample_feedback(product=None)
    await sample_feedback(product="")

    response = await client.get("/api/feedback?product=(unspecified)", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["items"]) == 2

@pytest.mark.asyncio
async def test_gemini_api_error_handling(client: AsyncClient):
    """Test that errors from the Gemini API are handled gracefully in translate endpoint."""
    # Mock the model generation itself to test the error handling in _call_gemini_analysis
    with patch('google.generativeai.GenerativeModel') as mock_gen_model:
        mock_gen_model.return_value.generate_content.side_effect = Exception("Gemini is down")

        response = await client.post(
            "/api/translate",
            json={"text": "This will fail"}
        )
        assert response.status_code == 500
        assert "AI analysis failed" in response.json()["detail"]
        assert "Gemini is down" in response.json()["detail"]

@pytest.mark.asyncio
async def test_gemini_api_quota_error(client: AsyncClient):
    """Test Gemini API quota/rate limit error handling in translate endpoint."""
    with patch('google.generativeai.GenerativeModel') as mock_gen_model:
        # Simulate quota error
        class DummyResponse:
            parts = [1]
            text = None
        mock_gen_model.return_value.generate_content.side_effect = Exception("ResourceExhausted: Quota exceeded")
        response = await client.post(
            "/api/translate",
            json={"text": "Test quota error"}
        )
        assert response.status_code == 429
        assert "rate limit" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_gemini_api_invalid_model_error(client: AsyncClient):
    """Test Gemini API invalid model error handling in translate endpoint."""
    with patch('google.generativeai.GenerativeModel') as mock_gen_model:
        # Simulate invalid model error
        mock_gen_model.return_value.generate_content.side_effect = Exception("Model not found or invalid")
        response = await client.post(
            "/api/translate",
            json={"text": "Test invalid model error"}
        )
        assert response.status_code == 400
        assert "invalid or unsupported model" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_gemini_api_generic_error(client: AsyncClient):
    """Test Gemini API generic error handling in translate endpoint."""
    with patch('google.generativeai.GenerativeModel') as mock_gen_model:
        # Simulate generic error
        mock_gen_model.return_value.generate_content.side_effect = Exception("Some generic error occurred")
        response = await client.post(
            "/api/translate",
            json={"text": "Test generic error"}
        )
        assert response.status_code == 500
        assert "ai analysis failed" in response.json()["detail"].lower()
        assert "generic error" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_create_tables_retry(monkeypatch):
    call_count = {"count": 0}

    class DummyConn:
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc, tb):
            pass
        async def run_sync(self, func):
            call_count["count"] += 1
            if call_count["count"] == 1:
                raise Exception("DB not ready")
            return None

    def dummy_begin(self):
        return DummyConn()

    async def dummy_sleep(_):
        return None

    from sqlalchemy.ext.asyncio import AsyncEngine
    monkeypatch.setattr(AsyncEngine, "begin", dummy_begin)
    monkeypatch.setattr("asyncio.sleep", dummy_sleep)

    await main.create_tables(retries=2, base_delay=0.01)
    assert call_count["count"] == 2

@pytest.mark.asyncio
def test_lifespan_startup(monkeypatch):
    # Patch Gemini config and DB session
    monkeypatch.setattr("google.generativeai.configure", lambda api_key: None)
    monkeypatch.setattr("builtins.print", lambda *a, **k: None)  # Suppress prints
    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    monkeypatch.setenv("ADMIN_USERNAME", "testadmin")
    monkeypatch.setenv("ADMIN_PASSWORD", "testpass")
    monkeypatch.setenv("ADMIN_FORCE_RESET", "true")

    # Patch get_db to yield a dummy session
    class DummySession:
        async def execute(self, *args, **kwargs):
            class DummyResult:
                def scalars(self):
                    class DummyScalar:
                        def first(self): return None
                        def scalar(self): return 0
                    return DummyScalar()
                def scalar(self): return 0
            return DummyResult()
        async def commit(self): pass
        async def rollback(self): pass
        async def close(self): pass
        def add(self, obj): pass
    async def dummy_get_db():
        yield DummySession()
    monkeypatch.setattr("main.get_db", dummy_get_db)
    async def dummy_create_tables(*a, **kw):
        return None
    monkeypatch.setattr("main.create_tables", dummy_create_tables)

    # Run the lifespan context manager
    from main import lifespan
    import types
    app = None
    cm = lifespan(app)
    if hasattr(cm, "__aenter__"):
        import asyncio
        loop = asyncio.get_event_loop()
        loop.run_until_complete(cm.__aenter__())
        loop.run_until_complete(cm.__aexit__(None, None, None))

def test_refresh_token_middleware_sets_new_token(monkeypatch):
    import jwt
    from main import app, SECRET_KEY, ALGORITHM
    from starlette.testclient import TestClient
    from datetime import datetime, timedelta

    # Create a token that is close to expiring
    payload = {
        "sub": "testuser",
        "role": "user",
        "exp": int((datetime.utcnow() + timedelta(seconds=10)).timestamp())
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    # Patch should_refresh_token to always return True
    monkeypatch.setattr("main.should_refresh_token", lambda exp: True)
    # Patch create_access_token to return a predictable token
    monkeypatch.setattr("main.create_access_token", lambda data: "newtoken123")

    with TestClient(app) as client:
        response = client.get("/", headers={"Authorization": f"Bearer {token}"})
        # Should set the X-New-Token header
        assert response.headers["X-New-Token"] == "newtoken123"

@pytest.mark.asyncio
async def test_get_all_feedback_language_and_sentiment(client: AsyncClient, admin_token_headers, sample_feedback):
    # Add feedback with different languages and sentiments
    await sample_feedback(sentiment="positive", language="en")
    await sample_feedback(sentiment="negative", language="fr")
    await sample_feedback(sentiment="neutral", language="en")
    await sample_feedback(sentiment="positive", language="fr")

    # Filter by language
    response = await client.get("/api/feedback?language=en", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    for item in data["items"]:
        assert item["language"] == "en"

    # Filter by sentiment
    response = await client.get("/api/feedback?sentiment=positive", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    for item in data["items"]:
        assert item["sentiment"] == "positive"

    # Filter by both
    response = await client.get("/api/feedback?language=fr&sentiment=positive", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["language"] == "fr"
    assert data["items"][0]["sentiment"] == "positive"


# --- Current Gemini Model Tests ---

@pytest.mark.asyncio
async def test_get_current_gemini_model_found(db_session):
    from main import _get_current_gemini_model
    from models import Settings
    # Insert a setting
    setting = Settings(key="gemini_model", value="models/test-model")
    db_session.add(setting)
    await db_session.commit()
    # Should return the value
    result = await _get_current_gemini_model(db_session)
    assert result == "models/test-model"

@pytest.mark.asyncio
async def test_get_current_gemini_model_not_found(db_session):
    from main import _get_current_gemini_model
    # No setting in DB
    result = await _get_current_gemini_model(db_session)
    assert result == "models/gemini-2.5-flash"

@pytest.mark.asyncio
async def test_get_current_gemini_model_db_error(monkeypatch, db_session):
    from main import _get_current_gemini_model
    # Simulate DB error
    async def broken_execute(*a, **kw):
        raise Exception("DB error")
    monkeypatch.setattr(db_session, "execute", broken_execute)
    result = await _get_current_gemini_model(db_session)
    assert result == "models/gemini-2.5-flash"


# --- Authentication and Password Change Error Handling Tests ---

@pytest.mark.asyncio
async def test_login_incorrect_password(client: AsyncClient):
    """Test login with incorrect password returns 401."""
    response = await client.post("/auth/token", data={"username": "admin", "password": "wrongpass"})
    assert response.status_code == 401
    assert "incorrect username or password" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_change_password_no_admin(client: AsyncClient, admin_token_headers, monkeypatch):
    """Test password change when no admin user exists returns 400."""
    async def dummy_execute(self, stmt):
        class DummyRes:
            def scalars(_):
                class DummyScalar:
                    def first(_): return None
                return DummyScalar()
        return DummyRes()
    monkeypatch.setattr("main.AsyncSession.execute", dummy_execute)
    response = await client.post(
        "/auth/change-password",
        json={"current_password": "irrelevant", "new_password": "newpass"},
        headers=admin_token_headers
    )
    assert response.status_code == 400
    assert "admin not initialized" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_change_password_incorrect_current(client: AsyncClient, admin_token_headers, monkeypatch):
    """Test password change with incorrect current password returns 400."""
    class DummyUser:
        username = "admin"
        password_hash = "hashed-correctpass"
    async def dummy_execute(self, stmt):
        class DummyRes:
            def scalars(_):
                class DummyScalar:
                    def first(_): return DummyUser()
                return DummyScalar()
        return DummyRes()
    monkeypatch.setattr("main.AsyncSession.execute", dummy_execute)
    monkeypatch.setattr("main.pwd_context.verify", lambda pw, h: False)
    response = await client.post(
        "/auth/change-password",
        json={"current_password": "wrongpass", "new_password": "newpass"},
        headers=admin_token_headers
    )
    assert response.status_code == 400
    assert "current password is incorrect" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_create_product_already_exists(client: AsyncClient, admin_token_headers, monkeypatch):
    """Test creating a product that already exists returns 400."""
    class DummyProduct:
        name = "General"
    async def dummy_execute(self, stmt):
        class DummyRes:
            def scalars(_):
                class DummyScalar:
                    def first(_): return DummyProduct()
                return DummyScalar()
        return DummyRes()
    monkeypatch.setattr("main.AsyncSession.execute", dummy_execute)
    response = await client.post(
        "/api/products",
        json={"name": "General"},
        headers=admin_token_headers
    )
    assert response.status_code == 400
    assert "product already exists" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_create_product_db_error(client: AsyncClient, admin_token_headers, monkeypatch):
    """Test DB error during product creation returns 500."""
    async def dummy_execute(self, stmt):
        class DummyRes:
            def scalars(_):
                class DummyScalar:
                    def first(_): return None
                return DummyScalar()
        return DummyRes()
    async def fail_commit(self):
        raise Exception("DB failure")
    monkeypatch.setattr("main.AsyncSession.execute", dummy_execute)
    monkeypatch.setattr("main.AsyncSession.commit", fail_commit)
    response = await client.post(
        "/api/products",
        json={"name": "NewProduct"},
        headers=admin_token_headers
    )
    assert response.status_code == 500
    assert "failed to create product" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_delete_product_not_found(client: AsyncClient, admin_token_headers, monkeypatch):
    """Test deleting a non-existent product returns 404."""
    async def dummy_execute(self, stmt):
        class DummyRes:
            def scalars(_):
                class DummyScalar:
                    def first(_): return None
                return DummyScalar()
        return DummyRes()
    monkeypatch.setattr("main.AsyncSession.execute", dummy_execute)
    response = await client.delete(
        "/api/products/999",
        headers=admin_token_headers
    )
    assert response.status_code == 404
    assert "product not found" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_delete_product_db_error(client: AsyncClient, admin_token_headers, monkeypatch):
    """Test DB error during product deletion returns 500."""
    # Create a real product first
    create_resp = await client.post(
        "/api/products",
        json={"name": "ErrProduct"},
        headers=admin_token_headers
    )
    assert create_resp.status_code == 200
    product_id = create_resp.json()["id"]
    # Patch commit to raise exception
    async def fail_commit(self):
        raise Exception("DB failure")
    monkeypatch.setattr("main.AsyncSession.commit", fail_commit)
    # Attempt to delete
    response = await client.delete(
        f"/api/products/{product_id}",
        headers=admin_token_headers
    )
    assert response.status_code == 500
    assert "failed to delete product" in response.json()["detail"].lower()