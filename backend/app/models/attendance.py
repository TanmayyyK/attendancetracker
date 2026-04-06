from typing import Optional

from sqlmodel import Field, SQLModel


class Attendance(SQLModel, table=True):
    __tablename__ = "attendance"

    id: Optional[int] = Field(default=None, primary_key=True)
    date: str
    timestamp: str
    subject: Optional[str] = None
    professor: str
    status: str
