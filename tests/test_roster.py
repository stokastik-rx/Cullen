"""
Roster endpoint tests - create, read, update roster cards
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def auth_headers(client: TestClient, test_user_data: dict) -> dict:
    """Create a user, login, and return auth headers"""
    client.post("/api/v1/auth/signup", json=test_user_data)
    login_response = client.post("/api/v1/auth/login", data={
        "username": test_user_data["username"],
        "password": test_user_data["password"]
    })
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_cards() -> list:
    """Sample roster cards for testing"""
    return [
        {"id": "card-1", "name": "Alice", "bg": "Context about Alice"},
        {"id": "card-2", "name": "Bob", "bg": "Context about Bob"},
    ]


class TestRosterGet:
    """Tests for GET /api/v1/roster/cards"""

    def test_get_cards_empty(self, client: TestClient, auth_headers: dict):
        """Roster is currently disabled (should return 403 for authenticated users)."""
        response = client.get("/api/v1/roster/cards", headers=auth_headers)
        
        assert response.status_code == 403
        body = response.json()
        assert body["error"] is True
        assert body["status_code"] == 403
        assert "Roster is not available" in body["message"]

    def test_get_cards_unauthenticated(self, client: TestClient):
        """Test getting cards without auth fails"""
        response = client.get("/api/v1/roster/cards")
        
        assert response.status_code == 401


class TestRosterPut:
    """Tests for PUT /api/v1/roster/cards"""

    def test_put_cards_create(self, client: TestClient, auth_headers: dict, sample_cards: list):
        """Roster is currently disabled (should return 403 for authenticated users)."""
        response = client.put(
            "/api/v1/roster/cards",
            headers=auth_headers,
            json=sample_cards
        )
        
        assert response.status_code == 403
        body = response.json()
        assert body["error"] is True
        assert body["status_code"] == 403
        assert "Roster is not available" in body["message"]

    def test_put_cards_persist(self, client: TestClient, auth_headers: dict, sample_cards: list):
        """Roster is currently disabled (should return 403 for authenticated users)."""
        response = client.get("/api/v1/roster/cards", headers=auth_headers)
        
        assert response.status_code == 403
        body = response.json()
        assert body["error"] is True
        assert body["status_code"] == 403
        assert "Roster is not available" in body["message"]

    def test_put_cards_replace(self, client: TestClient, auth_headers: dict, sample_cards: list):
        """Roster is currently disabled (should return 403 for authenticated users)."""
        new_cards = [{"id": "card-new", "name": "Charlie", "bg": "New context"}]
        response = client.put("/api/v1/roster/cards", headers=auth_headers, json=new_cards)
        
        assert response.status_code == 403
        body = response.json()
        assert body["error"] is True
        assert body["status_code"] == 403
        assert "Roster is not available" in body["message"]

    def test_put_cards_empty_name_rejected(self, client: TestClient, auth_headers: dict):
        """Even while disabled, request-body validation can still run first (422)."""
        cards = [
            {"id": "card-1", "name": "", "bg": "Empty name"},
        ]
        response = client.put("/api/v1/roster/cards", headers=auth_headers, json=cards)
        
        assert response.status_code == 422

    def test_put_cards_whitespace_name_filtered(self, client: TestClient, auth_headers: dict):
        """Roster is currently disabled (returns 403)."""
        cards = [
            {"id": "card-1", "name": "Valid", "bg": ""},
            {"id": "card-2", "name": "   ", "bg": "Whitespace name"},
        ]
        response = client.put("/api/v1/roster/cards", headers=auth_headers, json=cards)
        
        assert response.status_code == 403

    def test_put_cards_duplicate_ids_filtered(self, client: TestClient, auth_headers: dict):
        """Roster is currently disabled (returns 403)."""
        cards = [
            {"id": "same-id", "name": "First", "bg": ""},
            {"id": "same-id", "name": "Second", "bg": ""},
        ]
        response = client.put("/api/v1/roster/cards", headers=auth_headers, json=cards)
        
        assert response.status_code == 403

    def test_put_cards_unauthenticated(self, client: TestClient, sample_cards: list):
        """Test PUT cards without auth fails"""
        response = client.put("/api/v1/roster/cards", json=sample_cards)
        
        assert response.status_code == 401

    def test_put_cards_validation_error(self, client: TestClient, auth_headers: dict):
        """Test PUT with invalid card schema fails"""
        # Missing required 'id' field
        invalid_cards = [{"name": "NoId", "bg": ""}]
        response = client.put("/api/v1/roster/cards", headers=auth_headers, json=invalid_cards)
        
        assert response.status_code == 422

