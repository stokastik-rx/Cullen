from fastapi import APIRouter

from app.api.v1.endpoints import health, items, chat
from app.api.v1.endpoints.auth import router as auth_router

# ✅ roster.py is NOT inside endpoints/ in your tree
from app.api.v1.roster import router as roster_router

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["Health"])
api_router.include_router(items.router, prefix="/items", tags=["Items"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(roster_router, prefix="", tags=["Roster"])

# ✅ name expected by main.py
router = api_router
