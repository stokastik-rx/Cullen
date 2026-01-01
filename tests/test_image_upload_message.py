"""
Basic image upload message test.

This validates that:
- multipart image upload endpoint works
- message persists and includes image_url in list
"""

from fastapi import status


def test_upload_image_creates_message_and_returns_image_url(client, test_user_data):
    # Signup + login
    client.post("/api/v1/auth/signup", json=test_user_data)
    login = client.post(
        "/api/v1/auth/login",
        data={"username": test_user_data["username"], "password": test_user_data["password"]},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create thread
    created = client.post("/api/v1/chats", headers=headers)
    assert created.status_code == status.HTTP_201_CREATED
    thread_id = created.json()["id"]

    # Upload an image as a message
    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 32, "image/png")}
    data = {"role": "user", "content": "here is an image"}
    resp = client.post(f"/api/v1/chats/{thread_id}/messages/image", headers=headers, files=files, data=data)
    assert resp.status_code == status.HTTP_201_CREATED
    msg = resp.json()
    assert msg["thread_id"] == thread_id
    assert msg["image_url"] is not None
    assert msg["image_url"].startswith("/uploads/chat_images/")

    # List messages includes the image_url
    listed = client.get(f"/api/v1/chats/{thread_id}/messages", headers=headers)
    assert listed.status_code == status.HTTP_200_OK
    msgs = listed.json()
    assert any(m.get("image_url") for m in msgs)


def test_upload_only_endpoint_returns_image_url(client, test_user_data):
    client.post("/api/v1/auth/signup", json=test_user_data)
    login = client.post(
        "/api/v1/auth/login",
        data={"username": test_user_data["username"], "password": test_user_data["password"]},
    )
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("test.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 32, "image/png")}
    resp = client.post("/api/v1/uploads/chat-image", headers=headers, files=files)
    assert resp.status_code == status.HTTP_201_CREATED
    body = resp.json()
    assert body["image_url"].startswith("/uploads/chat_images/")


