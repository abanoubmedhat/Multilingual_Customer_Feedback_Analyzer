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