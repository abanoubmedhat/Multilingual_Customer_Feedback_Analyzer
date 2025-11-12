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
async def test_create_product_success(client: AsyncClient, admin_token):
    """Test creating a new product."""
    response = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "New Product"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Product"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_product_requires_auth(client: AsyncClient):
    """Test that creating products requires authentication."""
    response = await client.post(
        "/api/products",
        json={"name": "New Product"}
    )
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_duplicate_product(client: AsyncClient, admin_token, sample_product):
    """Test creating a product with duplicate name."""
    response = await client.post(
        "/api/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": sample_product.name}
    )
    
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_product_success(client: AsyncClient, admin_token, sample_product):
    """Test deleting a product."""
    response = await client.delete(
        f"/api/products/{sample_product.id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "deleted"
    
    # Verify it's deleted
    list_response = await client.get("/api/products")
    products = list_response.json()
    assert not any(p["id"] == sample_product.id for p in products)


@pytest.mark.asyncio
async def test_delete_product_requires_auth(client: AsyncClient, sample_product):
    """Test that deleting products requires authentication."""
    response = await client.delete(f"/api/products/{sample_product.id}")
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_nonexistent_product(client: AsyncClient, admin_token):
    """Test deleting a non-existent product."""
    response = await client.delete(
        "/api/products/99999",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    assert response.status_code == 404
