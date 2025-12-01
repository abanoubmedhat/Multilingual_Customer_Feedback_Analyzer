import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_filters(client: AsyncClient, admin_token_headers, sample_feedback):
    """Test retrieving distinct filter values."""
    # Create some feedback with different attributes
    await sample_feedback(product="Product A", language="en", sentiment="positive")
    await sample_feedback(product="Product A", language="fr", sentiment="neutral")
    await sample_feedback(product="Product B", language="es", sentiment="negative")
    await sample_feedback(product="Product B", language="en", sentiment="positive")

    response = await client.get("/api/filters", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()

    assert "products" in data
    assert "languages" in data
    assert "sentiments" in data

    assert sorted(data["products"]) == ["Product A", "Product B"]
    assert sorted(data["languages"]) == ["en", "es", "fr"]
    assert sorted(data["sentiments"]) == ["negative", "neutral", "positive"]

@pytest.mark.asyncio
async def test_get_filters_empty(client: AsyncClient, admin_token_headers):
    """Test retrieving filters when no feedback exists."""
    response = await client.get("/api/filters", headers=admin_token_headers)
    assert response.status_code == 200
    data = response.json()

    assert data["products"] == []
    assert data["languages"] == []
    assert data["sentiments"] == []
