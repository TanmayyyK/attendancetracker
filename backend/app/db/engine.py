from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings


def _build_engine():
    db_url = settings.database_url
    connect_args = {}
    # Rule: Only apply this argument if the URL implies a local file: sqlite:///
    if db_url.startswith("sqlite:///"):
        connect_args = {"check_same_thread": False}
    return create_engine(db_url, connect_args=connect_args, echo=False)


engine = _build_engine()


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
