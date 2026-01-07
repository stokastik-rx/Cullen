"""
Main FastAPI application entry point
"""
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.database import init_db
from app.api.v1.router import api_router
from app.api.conversations import router as conversations_router
from app.api.chats import router as chats_router
from app.api.auth import router as auth_router
from app.api.roster import router as roster_router
from app.api.uploads import router as uploads_router
from app.core.exceptions import setup_exception_handlers
from app.core.uploads import ensure_upload_dirs

# Import models to ensure they are registered with Base
from app.models import user, chat, roster  # noqa: F401

# Setup logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup - initialize database tables
    is_pytest = ("pytest" in sys.modules) or (os.getenv("PYTEST_CURRENT_TEST") is not None)
    if (os.getenv("SKIP_DB_INIT") != "1") and (not is_pytest):
        # Initialize DB schema (skipped during pytest or when SKIP_DB_INIT=1)
        init_db()
    ensure_upload_dirs()
    yield
    # Shutdown
    pass

# Create FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup exception handlers
setup_exception_handlers(app)

# Mount static files (for frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")
ensure_upload_dirs()
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/roster")
def roster_page():
    # Roster feature is intentionally disabled for now.
    html = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Roster — Not Implemented</title>
    <link rel="stylesheet" href="/static/styles.css" />
  </head>
  <body>
    <div class="app-container" style="min-height: 100vh; align-items: center; justify-content: center;">
      <div class="card" style="max-width: 720px; width: 92%; padding: 24px;">
        <h1 style="margin: 0 0 12px 0;">Sorry — this function has not been implemented yet.</h1>
        <p style="margin: 0 0 16px 0; opacity: 0.9;">Available in CullenPill 1.5.</p>
        <a href="/" class="auth-btn" style="text-decoration: none; display: inline-flex;">Back to chat</a>
      </div>
    </div>
  </body>
</html>
"""
    return HTMLResponse(content=html, status_code=403)


@app.get("/admin", include_in_schema=False)
def admin_page():
    """
    Serve the admin UI (requires an admin JWT to use the API, but page itself is static).
    """
    preferred = os.path.join("static", "pages", "admin.html")
    if os.path.exists(preferred):
        return FileResponse(preferred)
    return JSONResponse(status_code=404, content={"message": "Admin page not found"})

# Include routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(conversations_router, prefix="/api")
app.include_router(chats_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(roster_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")


@app.get("/", include_in_schema=False)
def home():
    """
    Serve the chat UI.

    Preferred: static/pages/index.html (new structure)
    Fallback: static/index.html (legacy)
    """
    preferred = os.path.join("static", "pages", "index.html")
    if os.path.exists(preferred):
        return FileResponse(preferred)
    legacy = os.path.join("static", "index.html")
    if os.path.exists(legacy):
        return FileResponse(legacy)
    return JSONResponse(
        status_code=200,
        content={
            "message": f"Welcome to {settings.PROJECT_NAME}",
            "version": settings.VERSION,
            "docs": "/docs",
        },
    )


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return JSONResponse(
        status_code=200,
        content={"status": "healthy", "service": settings.PROJECT_NAME},
    )
