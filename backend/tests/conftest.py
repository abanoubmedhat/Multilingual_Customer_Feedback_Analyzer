"""
Pytest configuration and fixtures for backend tests.
"""
import os
import asyncio
from typing import AsyncGenerator, Generator
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

# Set test environment variables before importing app
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["GOOGLE_API_KEY"] = "test-api-key"
os.environ["ADMIN_USERNAME"] = "testadmin"
os.environ["ADMIN_PASSWORD"] = "testpass"

from main import app
from database import get_db
from models import Base, AdminUser, Product, Feedback
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Test database engine
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=NullPool,
)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
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
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with dependency overrides."""
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as ac:
        yield ac
    
    app.dependency_overrides.clear()


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
async def sample_product(db_session: AsyncSession) -> Product:
    """Create a sample product."""
    product = Product(name="Test Product")
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product


@pytest.fixture(scope="function")
async def sample_feedback(db_session: AsyncSession, sample_product: Product) -> Feedback:
    """Create sample feedback."""
    feedback = Feedback(
        original_text="This is a test feedback",
        translated_text="This is a test feedback",
        sentiment="positive",
        language="en",
        product=sample_product.name
    )
    db_session.add(feedback)
    await db_session.commit()
    await db_session.refresh(feedback)
    return feedback


@pytest.fixture(scope="function")
def mock_gemini_response():
    """Mock Gemini API response."""
    return {
        "translated_text": "This is excellent!",
        "sentiment": "positive",
        "language": "en"
    }
