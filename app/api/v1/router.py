"""
Main API router that includes all endpoint routers
"""
from fastapi import APIRouter

from app.api.v1.endpoints import health, items, chat

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(items.router, prefix="/items", tags=["Items"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])

