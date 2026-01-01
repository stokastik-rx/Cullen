"""
Tests for chat persistence
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


def test_create_chat(authenticated_client):
    """Test creating a new chat"""
    response = authenticated_client.post("/api/v1/chat")
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "id" in data
    assert data["title"] == "New chat"
    assert data["messages"] == []


def test_list_chats(authenticated_client):
    """Test listing user's chats"""
    # Create a chat
    create_response = authenticated_client.post("/api/v1/chat")
    chat_id = create_response.json()["id"]
    
    # List chats
    response = authenticated_client.get("/api/v1/chat")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == chat_id


def test_get_chat(authenticated_client):
    """Test getting a specific chat"""
    # Create a chat
    create_response = authenticated_client.post("/api/v1/chat")
    chat_id = create_response.json()["id"]
    
    # Get chat
    response = authenticated_client.get(f"/api/v1/chat/{chat_id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == chat_id


def test_send_message(authenticated_client):
    """Test sending a message to a chat"""
    # Create a chat
    create_response = authenticated_client.post("/api/v1/chat")
    chat_id = create_response.json()["id"]
    
    # Send message
    response = authenticated_client.post(
        "/api/v1/chat/message",
        json={
            "message": "Hello, world!",
            "chat_id": chat_id
        }
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "response" in data
    
    # Verify chat was updated
    chat_response = authenticated_client.get(f"/api/v1/chat/{chat_id}")
    chat_data = chat_response.json()
    assert len(chat_data["messages"]) == 2  # user message + assistant response
    assert chat_data["messages"][0]["role"] == "user"
    assert chat_data["messages"][0]["content"] == "Hello, world!"


def test_chat_isolation(authenticated_client, client, test_user_data):
    """Test that users can only see their own chats"""
    # Create chat with first user
    create_response = authenticated_client.post("/api/v1/chat")
    chat_id = create_response.json()["id"]
    
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
    second_client = client
    second_client.headers = {"Authorization": f"Bearer {token}"}
    
    # Second user should not see first user's chat
    response = second_client.get("/api/v1/chat")
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 0
    
    # Second user should not be able to access first user's chat
    response = second_client.get(f"/api/v1/chat/{chat_id}")
    assert response.status_code == status.HTTP_404_NOT_FOUND

