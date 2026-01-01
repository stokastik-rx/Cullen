"""
Pytest configuration and fixtures
"""
import pytest
from fastapi.testclient import TestClient
import httpx
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db

# Import models BEFORE importing app to ensure they're registered with Base
from app.models.user import User  # noqa: F401
from app.models.chat import ChatThread, ChatMessage  # noqa: F401
from app.models.roster import RosterState  # noqa: F401

from app.main import app

# Use in-memory SQLite for testing with StaticPool to share connection across threads
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # Use static pool for in-memory SQLite
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database for each test"""
    # Create all tables using the test engine
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()

@pytest.fixture(autouse=True)
def _mock_grok_bridge(monkeypatch):
    """
    Tests should not depend on the external Grok bridge running.
    Mock httpx.AsyncClient.post to return a stable { "answer": ... } payload.
    """

    class _MockResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"answer": "test grok answer"}

    async def _mock_post(self, url, json=None, **kwargs):  # noqa: ARG001
        return _MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", _mock_post, raising=True)


@pytest.fixture
def test_user_data():
    """Test user data for signup"""
    return {
        "email": "test@example.com",
        "username": "testuser",
        "password": "testpassword123"
    }

