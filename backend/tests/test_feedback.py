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
    """Test feedback creation without product (optional field)."""
    with patch("main._call_gemini_analysis", return_value=mock_gemini_response):
        response = await client.post(
            "/api/feedback",
            json={"text": "Test feedback without product"}
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["product"] is None or data["product"] == ""


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
async def test_get_all_feedback(client: AsyncClient, admin_token, sample_feedback):
    """Test retrieving all feedback."""
    response = await client.get(
        "/api/feedback",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert data["total"] >= 1
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_get_feedback_with_pagination(client: AsyncClient, admin_token, sample_feedback):
    """Test feedback pagination."""
    # Create multiple feedback entries
    from models import Feedback
    from database import get_db
    
    response = await client.get(
        "/api/feedback?skip=0&limit=5",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert "skip" in data
    assert "limit" in data
    assert data["skip"] == 0
    assert data["limit"] == 5


@pytest.mark.asyncio
async def test_get_feedback_filter_by_product(client: AsyncClient, admin_token, sample_feedback):
    """Test filtering feedback by product."""
    response = await client.get(
        f"/api/feedback?product={sample_feedback.product}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["product"] == sample_feedback.product


@pytest.mark.asyncio
async def test_get_feedback_filter_by_language(client: AsyncClient, admin_token, sample_feedback):
    """Test filtering feedback by language."""
    response = await client.get(
        f"/api/feedback?language={sample_feedback.language}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["language"] == sample_feedback.language


@pytest.mark.asyncio
async def test_get_feedback_filter_by_sentiment(client: AsyncClient, admin_token, sample_feedback):
    """Test filtering feedback by sentiment."""
    response = await client.get(
        f"/api/feedback?sentiment={sample_feedback.sentiment}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["sentiment"] == sample_feedback.sentiment


@pytest.mark.asyncio
async def test_delete_feedback_by_id(client: AsyncClient, admin_token, sample_feedback):
    """Test deleting a single feedback entry."""
    response = await client.delete(
        f"/api/feedback/{sample_feedback.id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"
    assert data["id"] == sample_feedback.id
    
    # Verify it's deleted
    get_response = await client.get(
        f"/api/feedback",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert get_response.status_code == 200
    items = get_response.json()["items"]
    assert not any(item["id"] == sample_feedback.id for item in items)


@pytest.mark.asyncio
async def test_delete_nonexistent_feedback(client: AsyncClient, admin_token):
    """Test deleting non-existent feedback."""
    response = await client.delete(
        "/api/feedback/99999",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_bulk_delete_feedback(client: AsyncClient, admin_token, db_session, sample_product):
    """Test bulk delete of multiple feedback entries."""
    # Create multiple feedback entries
    from models import Feedback
    
    feedback_ids = []
    for i in range(3):
        feedback = Feedback(
            original_text=f"Test feedback {i}",
            translated_text=f"Test feedback {i}",
            sentiment="positive",
            language="en",
            product=sample_product.name
        )
        db_session.add(feedback)
        await db_session.commit()
        await db_session.refresh(feedback)
        feedback_ids.append(feedback.id)
    
    # Bulk delete
    response = await client.delete(
        "/api/feedback",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"ids": feedback_ids}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] == 3
    assert set(data["ids"]) == set(feedback_ids)


@pytest.mark.asyncio
async def test_delete_all_filtered_feedback(client: AsyncClient, admin_token, db_session, sample_product):
    """Test deleting all feedback matching filters."""
    # Create multiple feedback entries
    from models import Feedback
    
    for i in range(3):
        feedback = Feedback(
            original_text=f"Test {i}",
            translated_text=f"Test {i}",
            sentiment="positive",
            language="en",
            product=sample_product.name
        )
        db_session.add(feedback)
    await db_session.commit()
    
    # Delete all with product filter
    response = await client.delete(
        f"/api/feedback/all?product={sample_product.name}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] >= 3


@pytest.mark.asyncio
async def test_get_stats(client: AsyncClient, admin_token, sample_feedback):
    """Test getting sentiment statistics."""
    response = await client.get(
        "/api/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "counts" in data
    assert "percentages" in data
    assert data["total"] >= 1
    assert isinstance(data["counts"], dict)
    assert isinstance(data["percentages"], dict)


@pytest.mark.asyncio
async def test_get_stats_with_filters(client: AsyncClient, admin_token, sample_feedback):
    """Test getting stats with product filter."""
    response = await client.get(
        f"/api/stats?product={sample_feedback.product}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "counts" in data


@pytest.mark.asyncio
async def test_stats_requires_auth(client: AsyncClient):
    """Test that stats endpoint requires authentication."""
    response = await client.get("/api/stats")
    assert response.status_code == 401
