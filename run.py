"""
Development server runner.

We import the FastAPI app object directly to avoid module-resolution surprises
when multiple worktrees/copies of the project exist on disk.
"""

import uvicorn

from app.core.config import settings
from app.main import app


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )

