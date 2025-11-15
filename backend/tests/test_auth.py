"""
Tests for authentication endpoints and JWT functionality.
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone
import jwt


@pytest.mark.asyncio
async def test_expired_token_rejected(client: AsyncClient, admin_user):
    """Test that expired tokens are rejected."""
    from main import SECRET_KEY, ALGORITHM
    
    # Create an expired token
    expire = datetime.now(timezone.utc) - timedelta(hours=1)
    token_data = {"sub": "testadmin", "role": "admin", "exp": expire}
    expired_token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
    
    # Try to use expired token
    response = await client.get(
        "/api/feedback",
        headers={"Authorization": f"Bearer {expired_token}"}
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_invalid_token_rejected(client: AsyncClient):
    """Test that invalid tokens are rejected."""
    response = await client.get(
        "/api/feedback",
        headers={"Authorization": "Bearer invalid-token"}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_missing_token_rejected(client: AsyncClient):
    """Test that requests without token are rejected."""
    response = await client.get("/api/feedback")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_without_auth(client: AsyncClient):
    """Test password change without authentication."""
    response = await client.post(
        "/auth/change-password",
        json={
            "current_password": "testpass",
            "new_password": "newpass123"
        }
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_only_endpoint_requires_admin_role(client: AsyncClient):
    """Test that admin endpoints require admin role."""
    from main import create_access_token
    
    # Create token with non-admin role
    user_token = create_access_token({"sub": "user", "role": "user"})
    
    response = await client.get(
        "/api/feedback",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 403
    assert "Admin access required" in response.json()["detail"]
