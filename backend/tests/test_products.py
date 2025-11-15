"""
Tests for product management endpoints.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_products_no_auth_required(client: AsyncClient, sample_product):
    """Test that listing products doesn't require authentication."""
    response = await client.get("/api/products")
    
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(p["name"] == sample_product.name for p in data)


@pytest.mark.asyncio
async def test_create_product_requires_auth(client: AsyncClient):
    """Test that creating products requires authentication."""
    response = await client.post(
        "/api/products",
        json={"name": "New Product"}
    )
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_product_requires_auth(client: AsyncClient, sample_product):
    """Test that deleting products requires authentication."""
    response = await client.delete(f"/api/products/{sample_product.id}")
    
    assert response.status_code == 401
