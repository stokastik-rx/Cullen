"""
Regression test: POST /api/v1/chats must work with no body and return a usable chat_id.
"""

from fastapi import status


def test_post_chats_no_body_returns_chat_id(client, test_user_data):
    # Signup + login
    client.post("/api/v1/auth/signup", json=test_user_data)
    login = client.post(
        "/api/v1/auth/login",
        data={"username": test_user_data["username"], "password": test_user_data["password"]},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post("/api/v1/chats", headers=headers)
    assert resp.status_code == status.HTTP_201_CREATED
    data = resp.json()
    assert "chat_id" in data
    assert "id" in data
    assert data["chat_id"] == data["id"]

