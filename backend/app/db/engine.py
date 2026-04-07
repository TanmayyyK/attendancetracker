import os
from sqlmodel import Session, SQLModel, create_engine
from app.core.config import settings

def _build_engine():
    # FORCE Python to look at Vercel's environment variables first.
    # If it's not on Vercel, it safely falls back to your local settings.
    db_url = os.getenv("DATABASE_URL", settings.database_url)
    
    # Auto-fix Turso URL if user pasted "libsql://" instead of "sqlite+libsql://"
    if db_url.startswith("libsql://"):
        db_url = db_url.replace("libsql://", "sqlite+libsql://", 1)
    elif db_url.startswith("https://"):
        db_url = db_url.replace("https://", "sqlite+libsql://", 1)
        
    connect_args = {}
    
    # Only apply local threading rules if it's actually a local offline file
    if db_url.startswith("sqlite:///"):
        connect_args = {"check_same_thread": False}
        
    return create_engine(db_url, connect_args=connect_args, echo=False)

engine = _build_engine()

def init_db() -> None:
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session