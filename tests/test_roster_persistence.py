"""
Tests for roster persistence
"""
import pytest
from fastapi import status


@pytest.fixture
def authenticated_client(client, test_user_data):
    """Create an authenticated client"""
    # Signup and login
    client.post("/api/v1/auth/signup", json=test_user_data)
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
    )
    token = login_response.json()["access_token"]
    client.headers = {"Authorization": f"Bearer {token}"}
    return client


def test_get_empty_roster(authenticated_client):
    """Roster is currently disabled (should return 403)."""
    response = authenticated_client.get("/api/v1/roster/cards")
    assert response.status_code == status.HTTP_403_FORBIDDEN
    body = response.json()
    assert body["error"] is True
    assert body["status_code"] == 403
    assert "Roster is not available" in body["message"]


def test_create_roster_card(authenticated_client):
    """Roster is currently disabled (should return 403)."""
    cards = [
        {
            "id": "test-id-1",
            "name": "Test Interest",
            "bg": "Test background information"
        }
    ]
    response = authenticated_client.put("/api/v1/roster/cards", json=cards)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    body = response.json()
    assert body["error"] is True
    assert body["status_code"] == 403
    assert "Roster is not available" in body["message"]


def test_get_roster_cards(authenticated_client):
    """Roster is currently disabled (should return 403)."""
    response = authenticated_client.get("/api/v1/roster/cards")
    assert response.status_code == status.HTTP_403_FORBIDDEN
    body = response.json()
    assert body["error"] is True
    assert body["status_code"] == 403
    assert "Roster is not available" in body["message"]


def test_update_roster_cards(authenticated_client):
    """Roster is currently disabled (should return 403)."""
    updated_cards = [
        {
            "id": "test-id-1",
            "name": "Updated Name",
            "bg": "Updated background"
        }
    ]
    response = authenticated_client.put("/api/v1/roster/cards", json=updated_cards)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    body = response.json()
    assert body["error"] is True
    assert body["status_code"] == 403
    assert "Roster is not available" in body["message"]


def test_roster_isolation(authenticated_client, client, test_user_data):
    """Roster is currently disabled (should return 403 regardless of user)."""
    # Save first user's auth headers (we reuse the same TestClient instance in this module)
    first_headers = dict(authenticated_client.headers)

    # Create second user
    second_user = test_user_data.copy()
    second_user["email"] = "second@example.com"
    second_user["username"] = "seconduser"
    client.post("/api/v1/auth/signup", json=second_user)
    login_response = client.post(
        "/api/v1/auth/login",
        data={
            "username": second_user["username"],
            "password": second_user["password"]
        }
    )
    token = login_response.json()["access_token"]
    second_headers = {"Authorization": f"Bearer {token}"}
    
    # Second user should receive 403
    response = client.get("/api/v1/roster/cards", headers=second_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

    # First user should also receive 403
    response = client.get("/api/v1/roster/cards", headers=first_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN

