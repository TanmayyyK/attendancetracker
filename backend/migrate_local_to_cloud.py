import os
from typing import Optional
from sqlmodel import Field, SQLModel, Session, create_engine, select

# ---------------------------
# Schema mirror (matches local attendance_ultra.db)
# ---------------------------
class Attendance(SQLModel, table=True):
    __tablename__ = "attendance"

    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    timestamp: str
    subject: Optional[str] = None
    professor: str
    status: str


def _build_engine(database_url: str):
    connect_args = {}
    
    # Normalize Turso URL: SQLAlchemy with sqlalchemy-libsql needs sqlite+libsql://
    # We also force 'secure=true' to avoid 308 redirects by ensuring it uses HTTPS.
    if "turso.io" in database_url:
        # Handle various protocol prefix suggestions
        for prefix in ["libsql://", "sqlite+libsql://", "sqlite+https://"]:
            if database_url.startswith(prefix):
                database_url = database_url.replace(prefix, "sqlite+libsql://", 1)
                break
        
        # Force secure connection (HTTPS) to avoid 308 redirects
        if "?" in database_url:
            if "secure=" not in database_url:
                database_url += "&secure=true"
        else:
            database_url += "?secure=true"

    if database_url.startswith("sqlite"):
        # Local SQLite workaround for threading (only for local files)
        if "libsql" not in database_url:
            connect_args["check_same_thread"] = False
    
    # Turso / libsql token handling
    if "libsql" in database_url:
        token = os.getenv("TURSO_AUTH_TOKEN")
        if token:
            connect_args["auth_token"] = token
        
    return create_engine(database_url, connect_args=connect_args)


def migrate():
    # Local connection setup
    # Assuming the script is run from the backend directory where the DB exists
    local_url = "sqlite:///./attendance_ultra.db"
    
    # Cloud connection from environment variables
    cloud_url = os.getenv("DATABASE_URL")
    if not cloud_url:
        print("❌ Error: DATABASE_URL is not set.")
        print("Usage: DATABASE_URL=\"sqlite+libsql://your-db.turso.io\" TURSO_AUTH_TOKEN=\"...\" python migrate_local_to_cloud.py")
        return

    print("=" * 70)
    print("🚀 MIGRATION: Local SQLite -> Turso Cloud")
    print(f"Local DB Path: ./attendance_ultra.db")
    print(f"Cloud URL:     {cloud_url}")
    print("=" * 70)

    # Initialize engines
    local_engine = _build_engine(local_url)
    cloud_engine = _build_engine(cloud_url)

    # 1. Fetch rows from local database
    print("\n[Step 1/3] Reading data from local database...")
    try:
        with Session(local_engine) as local_session:
            statement = select(Attendance)
            local_rows = local_session.exec(statement).all()
            total_rows = len(local_rows)
            print(f"✅ Found {total_rows} rows in local 'attendance' table.")
    except Exception as e:
        print(f"❌ Error reading local DB: {e}")
        return

    if total_rows == 0:
        print("⚠️ No data found to migrate.")
        return

    # 2. Ensure table exists in cloud
    print("\n[Step 2/3] Ensuring 'attendance' table exists in Turso...")
    try:
        SQLModel.metadata.create_all(cloud_engine)
    except Exception as e:
        print(f"❌ Error creating cloud table: {e}")
        return

    # 3. Migrate data to cloud
    print(f"\n[Step 3/3] Migrating {total_rows} entries to Turso...")
    try:
        with Session(cloud_engine) as cloud_session:
            for i, row in enumerate(local_rows, 1):
                # Create a fresh copy to insert into the cloud session
                # We preserve the original ID for data integrity
                new_row = Attendance(
                    id=row.id,
                    date=row.date,
                    timestamp=row.timestamp,
                    subject=row.subject,
                    professor=row.professor,
                    status=row.status
                )
                cloud_session.add(new_row)
                
                # Print progress every 100 rows
                if i % 100 == 0 or i == total_rows:
                    print(f"📦 Staged {i}/{total_rows} rows...")

            print("💾 Committing changes to Turso Cloud (this may take a moment)...")
            cloud_session.commit()
            print(f"✨ Success! All {total_rows} rows have been migrated.")
    except Exception as e:
        print(f"❌ Error during data insertion: {e}")
        print("\nTIP: If you get a 'Primary Key' error, it means the cloud DB already has data.")
        print("This script is designed for a one-time migration to an empty cloud database.")

    print("\n" + "=" * 70)
    print("Migration Checkpoint Complete.")
    print("=" * 70)


if __name__ == "__main__":
    migrate()
