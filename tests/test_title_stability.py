"""
Regression test: conversation title is set only once from first USER message.
"""

from fastapi import status


def test_title_set_once_and_not_overwritten(client, test_user_data):
    # Signup + login
    client.post("/api/v1/auth/signup", json=test_user_data)
    login = client.post(
        "/api/v1/auth/login",
        data={"username": test_user_data["username"], "password": test_user_data["password"]},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create empty chat (title is effectively unset in DB)
    created = client.post("/api/v1/chat", headers=headers)
    assert created.status_code == status.HTTP_201_CREATED
    chat_id = created.json()["id"]

    # First user message should set title
    client.post(
        "/api/v1/chat/message",
        headers=headers,
        json={"message": "First user message becomes the title", "chat_id": chat_id},
    )
    chat = client.get(f"/api/v1/chat/{chat_id}", headers=headers).json()
    title_after_first = chat["title"]
    assert title_after_first and title_after_first != "New chat"

    # Second user message should NOT overwrite title
    client.post(
        "/api/v1/chat/message",
        headers=headers,
        json={"message": "Second user message should NOT change title", "chat_id": chat_id},
    )
    chat2 = client.get(f"/api/v1/chat/{chat_id}", headers=headers).json()
    assert chat2["title"] == title_after_first


