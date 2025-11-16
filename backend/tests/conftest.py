"""
Pytest configuration and fixtures for backend tests.
"""
import os
import asyncio
from typing import AsyncGenerator, Generator
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

# Set test environment variables before importing app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"
os.environ["GOOGLE_API_KEY"] = "test-api-key"
os.environ["ADMIN_USERNAME"] = "testadmin"
os.environ["ADMIN_PASSWORD"] = "testpass"

from main import app
from database import get_db
from models import Base, AdminUser, Product, Feedback
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Test database engine - use StaticPool to maintain single connection
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # Use StaticPool for in-memory database
    echo=False,  # Set to True for SQL debugging
)
TestSessionLocal = async_sessionmaker(
    test_engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Yield a new session
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()  # Rollback any uncommitted changes
    
    # Drop all tables after the test
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with dependency overrides."""
    from contextlib import asynccontextmanager

    async def override_get_db():
        yield db_session
    
    @asynccontextmanager
    async def override_lifespan(app):
        # Do nothing during startup/shutdown for tests
        yield

    app.dependency_overrides[get_db] = override_get_db
    app.router.lifespan_context = override_lifespan
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()
    # It's good practice to restore the original lifespan if needed, but clear() is often enough


@pytest.fixture(scope="function")
async def admin_user(db_session: AsyncSession) -> AdminUser:
    """Create a test admin user."""
    admin = AdminUser(
        username="testadmin",
        password_hash=pwd_context.hash("testpass")
    )
    db_session.add(admin)
    await db_session.commit()
    await db_session.refresh(admin)
    return admin


@pytest.fixture(scope="function")
async def admin_token(client: AsyncClient, admin_user: AdminUser) -> str:
    """Get an admin JWT token."""
    response = await client.post(
        "/auth/token",
        data={
            "username": "testadmin",
            "password": "testpass",
            "grant_type": "password"
        }
    )
    assert response.status_code == 200
    return response.json()["access_token"]

@pytest.fixture(scope="function")
async def admin_token_headers(admin_token: str) -> dict:
    """Get admin token headers for authenticated requests."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="function")
async def sample_product(db_session: AsyncSession) -> Product:
    """Create a sample product."""
    product = Product(name="Test Product")
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest.fixture(scope="function")
async def sample_feedback(db_session: AsyncSession, sample_product: Product):
    """A factory fixture to create sample feedback entries."""
    async def _create_feedback(**kwargs):
        defaults = {
            "original_text": "This is a test feedback",
            "translated_text": "This is a test feedback",
            "sentiment": "positive",
            "language": "en",
            "product": sample_product.name,
        }
        defaults.update(kwargs)
        feedback = Feedback(**defaults)
        db_session.add(feedback)
        await db_session.commit()
        await db_session.refresh(feedback)
        return feedback
    return _create_feedback


@pytest.fixture(scope="function")
def mock_gemini_response():
    """Mock Gemini API response."""
    return {
        "translated_text": "This is excellent!",
        "sentiment": "positive",
        "language": "en"
    }
