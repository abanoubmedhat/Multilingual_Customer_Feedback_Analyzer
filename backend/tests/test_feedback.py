"""
Tests for feedback API endpoints.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_create_feedback_success(client: AsyncClient, sample_product, mock_gemini_response):
    """Test successful feedback creation with Gemini mocking."""
    with patch("main._call_gemini_analysis", return_value=mock_gemini_response):
        response = await client.post(
            "/api/feedback",
            json={
                "text": "Ce produit est excellent!",
                "product": sample_product.name
            }
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["original_text"] == "Ce produit est excellent!"
    assert data["translated_text"] == "This is excellent!"
    assert data["sentiment"] == "positive"
    assert data["language"] == "en"
    assert data["product"] == sample_product.name
    assert "id" in data


@pytest.mark.asyncio
async def test_create_feedback_with_preanalyzed_data(client: AsyncClient, sample_product):
    """Test feedback creation with pre-analyzed data (no Gemini call)."""
    response = await client.post(
        "/api/feedback",
        json={
            "text": "This is great!",
            "product": sample_product.name,
            "translated_text": "This is great!",
            "sentiment": "positive",
            "language": "en"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["sentiment"] == "positive"
    assert data["translated_text"] == "This is great!"


@pytest.mark.asyncio
async def test_create_feedback_unknown_product(client: AsyncClient, mock_gemini_response):
    """Test feedback creation with unknown product."""
    with patch("main._call_gemini_analysis", return_value=mock_gemini_response):
        response = await client.post(
            "/api/feedback",
            json={
                "text": "Test feedback",
                "product": "NonExistentProduct"
            }
        )
    
    assert response.status_code == 400
    assert "Unknown product" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_feedback_without_product(client: AsyncClient, mock_gemini_response):
    """Test feedback creation without product (should return validation error)."""
    with patch("main._call_gemini_analysis", return_value=mock_gemini_response):
        response = await client.post(
            "/api/feedback",
            json={"text": "Test feedback without product"}
        )
    
    # Product is mandatory, so should get 422 validation error
    assert response.status_code == 422
    assert "product" in str(response.json()).lower()


@pytest.mark.asyncio
async def test_translate_only_endpoint(client: AsyncClient, mock_gemini_response):
    """Test translate endpoint (no database save)."""
    with patch("main._call_gemini_analysis", return_value=mock_gemini_response):
        response = await client.post(
            "/api/translate",
            json={"text": "Bonjour!"}
        )
    
    assert response.status_code == 200
    data = response.json()
    assert "translated_text" in data
    assert "sentiment" in data
    assert "language" in data


@pytest.mark.asyncio
async def test_get_feedback_requires_auth(client: AsyncClient):
    """Test that getting feedback requires authentication."""
    response = await client.get("/api/feedback")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_stats_requires_auth(client: AsyncClient):
    """Test that stats endpoint requires authentication."""
    response = await client.get("/api/stats")
    assert response.status_code == 401
