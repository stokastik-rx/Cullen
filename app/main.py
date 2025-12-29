from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.database import Base, engine
from app.api.v1.router import api_router

# Make sure DB tables exist
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Cullen.AI")

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
PAGES_DIR = BASE_DIR / "pages"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(api_router)

@app.get("/")
def serve_index():
    return FileResponse(str(PAGES_DIR / "index.html"))

@app.get("/roster")
def serve_roster():
    return FileResponse(str(PAGES_DIR / "roster.html"))
