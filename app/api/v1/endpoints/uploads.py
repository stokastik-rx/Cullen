"""
Upload endpoints (v1).

Purpose: allow the UI to upload an image and get back a stable `image_url`
that can be previewed immediately in the message bar.
"""

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.dependencies import get_current_active_user
from app.core.uploads import save_chat_image_upload
from app.models.user import User
from app.schemas.chat import ImageUploadResponse

router = APIRouter()


@router.post("/chat-image", response_model=ImageUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    # current_user is required for auth; we don't currently scope storage per-user on disk.
    image_url, mime, size = save_chat_image_upload(file)
    return ImageUploadResponse(image_url=image_url, mime_type=mime, size_bytes=size)


