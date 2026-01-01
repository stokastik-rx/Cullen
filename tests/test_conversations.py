"""
Tests for /api/conversations endpoints.
"""

from fastapi import status


def _auth_headers(client, user_data: dict) -> dict:
    client.post("/api/v1/auth/signup", json=user_data)
    login = client.post(
        "/api/v1/auth/login",
        data={"username": user_data["username"], "password": user_data["password"]},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_conversation_create_list_and_messages(client):
    user = {"email": "c1@example.com", "username": "c1u", "password": "password123"}
    headers = _auth_headers(client, user)

    # Create conversation
    resp = client.post("/api/conversations", headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    conversation_id = resp.json()["conversation_id"]

    # List conversations includes it (newest -> oldest)
    resp = client.get("/api/conversations", headers=headers)
    assert resp.status_code == status.HTTP_200_OK
    items = resp.json()
    assert any(c["id"] == conversation_id for c in items)

    # No messages initially
    resp = client.get(f"/api/conversations/{conversation_id}/messages", headers=headers)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["messages"] == []

    # Add first user message: should auto-title
    resp = client.post(
        f"/api/conversations/{conversation_id}/messages",
        headers=headers,
        json={"role": "user", "content": "Hello there, this should become the title"},
    )
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert data["message"]["role"] == "user"
    assert data["conversation_title"]

    # Messages should be returned in order
    resp = client.get(f"/api/conversations/{conversation_id}/messages", headers=headers)
    assert resp.status_code == status.HTTP_200_OK
    msgs = resp.json()["messages"]
    assert len(msgs) == 1
    assert msgs[0]["content"] == "Hello there, this should become the title"


def test_conversation_cross_user_forbidden(client):
    user1 = {"email": "c2u1@example.com", "username": "c2u1", "password": "password123"}
    user2 = {"email": "c2u2@example.com", "username": "c2u2", "password": "password456"}

    headers1 = _auth_headers(client, user1)
    headers2 = _auth_headers(client, user2)

    conv = client.post("/api/conversations", headers=headers1).json()["conversation_id"]

    resp = client.get(f"/api/conversations/{conv}/messages", headers=headers2)
    assert resp.status_code == status.HTTP_403_FORBIDDEN

