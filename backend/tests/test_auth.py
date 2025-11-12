"""
Tests for authentication endpoints and JWT functionality.
"""
import pytest
from httpx import AsyncClient
from datetime import datetime, timedelta, timezone
import jwt


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user):
    """Test successful admin login."""
    response = await client.post(
        "/auth/token",
        data={
            "username": "testadmin",
            "password": "testpass",
            "grant_type": "password"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient, admin_user):
    """Test login with invalid credentials."""
    response = await client.post(
        "/auth/token",
        data={
            "username": "testadmin",
            "password": "wrongpassword",
            "grant_type": "password"
        }
    )
    assert response.status_code == 401
    assert "Incorrect username or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Test login with non-existent user."""
    response = await client.post(
        "/auth/token",
        data={
            "username": "nonexistent",
            "password": "password",
            "grant_type": "password"
        }
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_token_contains_correct_claims(admin_token):
    """Test that JWT token contains correct claims."""
    from main import SECRET_KEY, ALGORITHM
    
    payload = jwt.decode(admin_token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["sub"] == "testadmin"
    assert payload["role"] == "admin"
    assert "exp" in payload
    assert "iat" in payload


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
async def test_change_password_success(client: AsyncClient, admin_token):
    """Test successful password change."""
    response = await client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "current_password": "testpass",
            "new_password": "newpass123"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    # Verify old password no longer works
    login_response = await client.post(
        "/auth/token",
        data={
            "username": "testadmin",
            "password": "testpass",
            "grant_type": "password"
        }
    )
    assert login_response.status_code == 401
    
    # Verify new password works
    new_login = await client.post(
        "/auth/token",
        data={
            "username": "testadmin",
            "password": "newpass123",
            "grant_type": "password"
        }
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_change_password_wrong_current(client: AsyncClient, admin_token):
    """Test password change with wrong current password."""
    response = await client.post(
        "/auth/change-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "current_password": "wrongpass",
            "new_password": "newpass123"
        }
    )
    assert response.status_code == 400
    assert "incorrect" in response.json()["detail"].lower()


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
