"""
Main FastAPI application entry point
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.database import init_db
from app.api.v1.router import api_router
from app.core.exceptions import setup_exception_handlers

# Import models to ensure they are registered with Base
from app.models import user, chat  # noqa: F401

# Setup logging
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    # Startup - initialize database tables
    init_db()
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

# Include routers
app.include_router(api_router, prefix=settings.API_V1_STR)


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

