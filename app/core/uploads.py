"""
Upload helpers for user-provided files (images).

We keep this small and explicit:
- Store images on disk under ./uploads/chat_images/
- Serve them via FastAPI StaticFiles mounted at /uploads
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status


ALLOWED_IMAGE_MIME_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
}


def ensure_upload_dirs() -> None:
    Path("uploads").mkdir(parents=True, exist_ok=True)
    Path("uploads", "chat_images").mkdir(parents=True, exist_ok=True)


def _safe_ext_from_upload(upload: UploadFile) -> Optional[str]:
    ct = (upload.content_type or "").lower().strip()
    if ct in ALLOWED_IMAGE_MIME_TYPES:
        return ALLOWED_IMAGE_MIME_TYPES[ct]
    return None


def save_chat_image_upload(
    upload: UploadFile,
    *,
    max_bytes: int = 10 * 1024 * 1024,
) -> Tuple[str, str, int]:
    """
    Save an uploaded image to disk.

    Returns: (public_url, mime_type, size_bytes)
    """
    ensure_upload_dirs()

    mime = (upload.content_type or "").lower().strip()
    ext = _safe_ext_from_upload(upload)
    if not ext:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type",
        )

    filename = f"{uuid4().hex}.{ext}"
    rel_path = os.path.join("uploads", "chat_images", filename)

    size = 0
    try:
        with open(rel_path, "wb") as f:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Image too large",
                    )
                f.write(chunk)
    except HTTPException:
        # Best-effort cleanup
        try:
            if os.path.exists(rel_path):
                os.remove(rel_path)
        except Exception:
            pass
        raise

    public_url = f"/uploads/chat_images/{filename}"
    return public_url, mime, size


