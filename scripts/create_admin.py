"""
Create or promote an admin account.

Usage (PowerShell):
  .\\venv\\Scripts\\python.exe scripts\\create_admin.py --email you@example.com --username you --password "StrongPassword123!"

Notes:
- This NEVER prints or stores plaintext passwords beyond hashing.
- It will create the user if missing, otherwise it will just set is_admin=true.
"""

import argparse
import sys
from pathlib import Path

from sqlalchemy.orm import Session

# Ensure repo root is on sys.path so `import app...` works when running as a script on Windows.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models import chat as _chat  # noqa: F401
from app.models import roster as _roster  # noqa: F401


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    # Ensure tables exist
    init_db()

    db: Session = SessionLocal()
    try:
        # Find by email OR username (either could already exist).
        user = db.query(User).filter(User.email == args.email).first()
        if user is None:
            user = db.query(User).filter(User.username == args.username).first()
        if user is None:
            user = User(
                email=args.email,
                username=args.username,
                hashed_password=get_password_hash(args.password),
                subscription_tier="BASE",
                plan="base",
                is_admin=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created admin user id={user.id} username={user.username} email={user.email}")
            return

        # Promote existing user
        user.is_admin = True
        # Reset password to the provided one (explicit, deterministic admin bootstrap).
        user.hashed_password = get_password_hash(args.password)
        # Best-effort keep identifiers consistent, but never violate unique constraints.
        if args.email and user.email != args.email:
            email_taken = db.query(User.id).filter(User.email == args.email, User.id != user.id).first()
            if not email_taken:
                user.email = args.email
        if args.username and user.username != args.username:
            username_taken = db.query(User.id).filter(User.username == args.username, User.id != user.id).first()
            if not username_taken:
                user.username = args.username
        db.commit()
        print(f"Promoted user id={user.id} username={user.username} email={user.email} to admin")
    finally:
        db.close()


if __name__ == "__main__":
    main()


