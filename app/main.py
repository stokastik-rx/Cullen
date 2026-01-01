"""
Main FastAPI application entry point
"""
import os
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
from fastapi.responses import FileResponse

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

@app.get("/")
def chat_page():
    return FileResponse("static/index.html")

# Include routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(conversations_router, prefix="/api")
app.include_router(chats_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(roster_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - serves the chat interface"""
    index_path = os.path.join("static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "version": settings.VERSION,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return JSONResponse(
        status_code=200,
        content={"status": "healthy", "service": settings.PROJECT_NAME},
    )
