"""
Ownership enforcement tests - ensure users can only access their own data
"""
import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def user1_data() -> dict:
    """First test user data"""
    return {
        "email": "user1@example.com",
        "username": "user1",
        "password": "password123"
    }


@pytest.fixture
def user2_data() -> dict:
    """Second test user data"""
    return {
        "email": "user2@example.com",
        "username": "user2",
        "password": "password456"
    }


@pytest.fixture
def user1_headers(client: TestClient, user1_data: dict) -> dict:
    """Create user1, login, and return auth headers"""
    client.post("/api/v1/auth/signup", json=user1_data)
    login_response = client.post("/api/v1/auth/login", data={
        "username": user1_data["username"],
        "password": user1_data["password"]
    })
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user2_headers(client: TestClient, user2_data: dict) -> dict:
    """Create user2, login, and return auth headers"""
    client.post("/api/v1/auth/signup", json=user2_data)
    login_response = client.post("/api/v1/auth/login", data={
        "username": user2_data["username"],
        "password": user2_data["password"]
    })
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestRosterOwnership:
    """Tests for roster cards ownership isolation"""

    def test_roster_isolated_between_users(
        self, client: TestClient, user1_headers: dict, user2_headers: dict
    ):
        """Roster is currently disabled (should return 403 regardless of user)."""
        response1 = client.get("/api/v1/roster/cards", headers=user1_headers)
        assert response1.status_code == 403
        
        response2 = client.get("/api/v1/roster/cards", headers=user2_headers)
        assert response2.status_code == 403

    def test_roster_put_doesnt_affect_other_user(
        self, client: TestClient, user1_headers: dict, user2_headers: dict
    ):
        """Roster is currently disabled (PUT/GET should return 403)."""
        put1 = client.put(
            "/api/v1/roster/cards",
            headers=user1_headers,
            json=[{"id": "u1", "name": "User1", "bg": ""}],
        )
        assert put1.status_code == 403

        put2 = client.put(
            "/api/v1/roster/cards",
            headers=user2_headers,
            json=[{"id": "u2", "name": "User2", "bg": ""}],
        )
        assert put2.status_code == 403

        response = client.get("/api/v1/roster/cards", headers=user2_headers)
        assert response.status_code == 403


class TestChatOwnership:
    """Tests for chat ownership isolation"""

    def test_chat_isolated_between_users(
        self, client: TestClient, user1_headers: dict, user2_headers: dict
    ):
        """Test that user1's chats are not visible to user2"""
        # User1 creates a chat
        response1 = client.post("/api/v1/chat", headers=user1_headers)
        assert response1.status_code == 201
        user1_chat_id = response1.json()["id"]
        
        # User2 creates a chat
        response2 = client.post("/api/v1/chat", headers=user2_headers)
        assert response2.status_code == 201
        user2_chat_id = response2.json()["id"]
        
        # User1 should only see their chat
        list_response1 = client.get("/api/v1/chat", headers=user1_headers)
        assert list_response1.status_code == 200
        chats1 = list_response1.json()
        assert len(chats1) == 1
        assert chats1[0]["id"] == user1_chat_id
        
        # User2 should only see their chat
        list_response2 = client.get("/api/v1/chat", headers=user2_headers)
        assert list_response2.status_code == 200
        chats2 = list_response2.json()
        assert len(chats2) == 1
        assert chats2[0]["id"] == user2_chat_id

    def test_user_cannot_access_other_users_chat(
        self, client: TestClient, user1_headers: dict, user2_headers: dict
    ):
        """Test that user2 cannot access user1's chat by ID"""
        # User1 creates a chat
        response = client.post("/api/v1/chat", headers=user1_headers)
        user1_chat_id = response.json()["id"]
        
        # User2 tries to access user1's chat
        response = client.get(f"/api/v1/chat/{user1_chat_id}", headers=user2_headers)
        assert response.status_code == 404  # Should not find it

    def test_user_cannot_update_other_users_chat(
        self, client: TestClient, user1_headers: dict, user2_headers: dict
    ):
        """Test that user2 cannot update user1's chat"""
        # User1 creates a chat
        response = client.post("/api/v1/chat", headers=user1_headers)
        user1_chat_id = response.json()["id"]
        
        # User2 tries to update user1's chat
        response = client.put(
            f"/api/v1/chat/{user1_chat_id}",
            headers=user2_headers,
            json={"title": "Hijacked!", "messages": []}
        )
        assert response.status_code == 404  # Should not find it

    def test_user_cannot_delete_other_users_chat(
        self, client: TestClient, user1_headers: dict, user2_headers: dict
    ):
        """Test that user2 cannot delete user1's chat"""
        # User1 creates a chat
        response = client.post("/api/v1/chat", headers=user1_headers)
        user1_chat_id = response.json()["id"]
        
        # User2 tries to delete user1's chat
        response = client.delete(f"/api/v1/chat/{user1_chat_id}", headers=user2_headers)
        assert response.status_code == 404  # Should not find it
        
        # User1's chat should still exist
        response = client.get(f"/api/v1/chat/{user1_chat_id}", headers=user1_headers)
        assert response.status_code == 200

    def test_user_cannot_send_message_to_other_users_chat(
        self, client: TestClient, user1_headers: dict, user2_headers: dict
    ):
        """Test that user2 cannot send messages to user1's chat"""
        # User1 creates a chat
        response = client.post("/api/v1/chat", headers=user1_headers)
        user1_chat_id = response.json()["id"]
        
        # User2 tries to send a message to user1's chat
        response = client.post(
            "/api/v1/chat/message",
            headers=user2_headers,
            json={"message": "Hijacked message!", "chat_id": user1_chat_id}
        )
        assert response.status_code == 404  # Should not find the chat

