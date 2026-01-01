"""
/api uploads (non-v1) aliases for frontend convenience.
"""

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.dependencies import get_current_active_user
from app.core.uploads import save_chat_image_upload
from app.models.user import User

router = APIRouter()


@router.post("/uploads/chat-image", status_code=status.HTTP_201_CREATED)
async def upload_chat_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
):
    image_url, mime, size = save_chat_image_upload(file)
    return {"image_url": image_url, "mime_type": mime, "size_bytes": size}


