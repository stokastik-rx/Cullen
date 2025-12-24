"""
Database connection and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=settings.DEBUG,
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Create Base class for models (SQLAlchemy 2.0 style)
class Base(DeclarativeBase):
    pass


def get_db():
    """
    Database session dependency for FastAPI
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database - create all tables and migrate schema if needed
    """
    Base.metadata.create_all(bind=engine)
    
    # Migration: Add subscription_tier column if it doesn't exist
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'subscription_tier' not in columns:
            with engine.connect() as conn:
                # SQLite: Add column as nullable first, then update values, then we can't add NOT NULL constraint
                # So we'll add it with DEFAULT and handle NULLs in application code
                try:
                    conn.execute(text("ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'BASE'"))
                    conn.commit()
                    # Update any NULL values (shouldn't happen with DEFAULT, but just in case)
                    conn.execute(text("UPDATE users SET subscription_tier = 'BASE' WHERE subscription_tier IS NULL"))
                    conn.commit()
                except Exception as e:
                    # If migration fails, log it but don't crash
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Migration warning: {e}")
                    conn.rollback()

