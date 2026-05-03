"""
Migration script: add auth to an existing AponRoots SQLite database.

Run with:
    python -m app.migrate_to_auth <admin_email> <admin_password>

Idempotent: safe to run multiple times.

What it does:
  1. Creates the `users` table if missing.
  2. Adds `user_id` column to `persons` if missing.
  3. Creates a default admin user (or skips if email exists).
  4. Backfills any persons with NULL user_id to the admin's id.
"""

import sys
from sqlalchemy import inspect, text

from .database import Base, engine, SessionLocal
from . import models  # noqa: F401 -- ensures Base.metadata sees all tables
from .security import hash_password


def column_exists(conn, table: str, column: str) -> bool:
    insp = inspect(conn)
    return any(c["name"] == column for c in insp.get_columns(table))


def main(admin_email: str, admin_password: str, admin_name: str = "Admin") -> None:
    # 1. Make sure all tables exist (creates `users` and any other missing tables).
    Base.metadata.create_all(bind=engine)
    print("✓ Schema synced")

    # 2. Add `user_id` column to `persons` if running against pre-auth DB.
    with engine.begin() as conn:
        insp = inspect(conn)
        if "persons" in insp.get_table_names():
            cols = [c["name"] for c in insp.get_columns("persons")]
            if "user_id" not in cols:
                conn.execute(text("ALTER TABLE persons ADD COLUMN user_id INTEGER"))
                print("✓ Added user_id column to persons")
            else:
                print("• user_id column already exists on persons")

    db = SessionLocal()
    try:
        # 3. Create or reuse admin user
        admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if admin:
            print(f"• Admin {admin_email} already exists (id={admin.id})")
            if not admin.is_admin:
                admin.is_admin = True
                db.commit()
                print("  Promoted to admin.")
        else:
            admin = models.User(
                email=admin_email,
                password_hash=hash_password(admin_password),
                name=admin_name,
                is_admin=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
            print(f"✓ Created admin {admin_email} (id={admin.id})")

        # 4. Backfill orphaned persons
        orphans = (
            db.query(models.Person)
            .filter((models.Person.user_id == None) | (models.Person.user_id == 0))  # noqa: E711
            .all()
        )
        if orphans:
            for p in orphans:
                p.user_id = admin.id
            db.commit()
            print(f"✓ Reassigned {len(orphans)} existing persons to admin")
        else:
            print("• No orphaned persons to migrate")
    finally:
        db.close()

    print("\n🎉 Migration complete. You can now log in.")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python -m app.migrate_to_auth <email> <password> [name]")
        sys.exit(1)
    email = sys.argv[1]
    password = sys.argv[2]
    name = sys.argv[3] if len(sys.argv) > 3 else "Admin"
    main(email, password, name)
