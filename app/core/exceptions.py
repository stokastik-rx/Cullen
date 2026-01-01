"""
Custom exception handlers
"""
import logging
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppException(Exception):
    """Base application exception"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class NotFoundError(AppException):
    """Resource not found exception"""
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ValidationError(AppException):
    """Validation error exception"""
    def __init__(self, message: str = "Validation error"):
        super().__init__(message, status_code=422)


class UnauthorizedError(AppException):
    """Unauthorized access exception"""
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status_code=401)


def setup_exception_handlers(app: FastAPI):
    """Setup custom exception handlers"""
    
    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(
            "AppException %s %s -> %s: %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.message,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": True,
                "message": exc.message,
                "status_code": exc.status_code,
            },
        )
    
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        # Keep the response body consistent, but log for debugging.
        logger.info(
            "HTTPException %s %s -> %s: %s",
            request.method,
            request.url.path,
            exc.status_code,
            exc.detail,
        )
        # Plan limit errors must return FastAPI-default shape:
        # { "detail": { ... } }
        if exc.status_code == status.HTTP_402_PAYMENT_REQUIRED and isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

        # If detail is already a structured dict, return it directly (merged with defaults).
        if isinstance(exc.detail, dict):
            body = dict(exc.detail)
            body.setdefault("error", True)
            body.setdefault("status_code", exc.status_code)
            body.setdefault("message", body.get("detail") or body.get("message") or "Request failed")
            return JSONResponse(status_code=exc.status_code, content=body)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": True,
                "message": exc.detail,
                "status_code": exc.status_code,
            },
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.info(
            "ValidationError %s %s -> 422: %s",
            request.method,
            request.url.path,
            exc.errors(),
        )
        return JSONResponse(
            # Starlette/FastAPI deprecate *_ENTITY in favor of *_CONTENT
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "error": True,
                "message": "Validation error",
                "details": exc.errors(),
                "status_code": 422,
            },
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        # Critical: log stacktrace so we can debug real production issues.
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": "Internal server error",
                "status_code": 500,
            },
        )

