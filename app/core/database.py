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
    table_names = inspector.get_table_names()
    
    if 'users' in table_names:
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

        # Migration: Add billing/plan columns (additive, SQLite-friendly)
        with engine.connect() as conn:
            try:
                if "plan" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN plan VARCHAR(20) DEFAULT 'base'"))
                    conn.commit()
                    conn.execute(text("UPDATE users SET plan = 'base' WHERE plan IS NULL"))
                    conn.commit()
                if "stripe_customer_id" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)"))
                    conn.commit()
                if "stripe_subscription_id" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255)"))
                    conn.commit()
                if "plan_status" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN plan_status VARCHAR(20)"))
                    conn.commit()
                if "plan_renews_at" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN plan_renews_at DATETIME"))
                    conn.commit()

                # Best-effort indexes
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_plan ON users (plan)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_stripe_customer_id ON users (stripe_customer_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_stripe_subscription_id ON users (stripe_subscription_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_plan_status ON users (plan_status)"))
                conn.commit()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Migration warning (users billing fields): {e}")
                conn.rollback()

    # Migration: Add roster_card_id to chat_threads if it doesn't exist (SQLite-friendly).
    if "chat_threads" in table_names:
        columns = [col["name"] for col in inspector.get_columns("chat_threads")]
        if "roster_card_id" not in columns:
            with engine.connect() as conn:
                try:
                    conn.execute(text("ALTER TABLE chat_threads ADD COLUMN roster_card_id VARCHAR(80)"))
                    conn.commit()
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Migration warning (chat_threads.roster_card_id): {e}")
                    conn.rollback()

        # Best-effort index creation (no-op if already exists / unsupported)
        with engine.connect() as conn:
            try:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_threads_roster_card_id ON chat_threads (roster_card_id)"))
                conn.commit()
            except Exception:
                conn.rollback()

    # Migration: Add image attachment columns to chat_messages (SQLite-friendly).
    if "chat_messages" in table_names:
        msg_cols = [col["name"] for col in inspector.get_columns("chat_messages")]
        with engine.connect() as conn:
            try:
                if "image_url" not in msg_cols:
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN image_url VARCHAR(500)"))
                    conn.commit()
                if "image_mime_type" not in msg_cols:
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN image_mime_type VARCHAR(100)"))
                    conn.commit()
                if "image_size_bytes" not in msg_cols:
                    conn.execute(text("ALTER TABLE chat_messages ADD COLUMN image_size_bytes INTEGER"))
                    conn.commit()

                # Optional helper index for filtering / debugging (best-effort)
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_messages_thread_created_at ON chat_messages (thread_id, created_at)"))
                conn.commit()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Migration warning (chat_messages image fields): {e}")
                conn.rollback()
    
    # Ensure chats table exists (should be created by Base.metadata.create_all, but verify)
    if 'chats' not in table_names:
        # This should not happen if models are imported, but log a warning if it does
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("Chats table not found. Make sure Chat model is imported.")
    elif 'chats' in table_names:
        # Verify chats table has required columns
        chat_columns = [col['name'] for col in inspector.get_columns('chats')]
        required_columns = ['id', 'user_id', 'title', 'messages', 'created_at', 'updated_at']
        missing_columns = [col for col in required_columns if col not in chat_columns]
        if missing_columns:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Chats table missing columns: {missing_columns}. Consider recreating the table.")

