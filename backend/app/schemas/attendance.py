from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional

from pydantic import BaseModel, field_validator


class AttendanceCreate(BaseModel):
    date: str
    timestamp: Optional[str] = None
    subject: str
    professor: str
    status: str

    @field_validator("timestamp")
    @classmethod
    def default_timestamp(cls, value: Optional[str]) -> str:
        if value:
            return value
        return datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%H:%M:%S")


class AttendanceUpdate(BaseModel):
    date: Optional[str] = None
    timestamp: Optional[str] = None
    subject: Optional[str] = None
    professor: Optional[str] = None
    status: Optional[str] = None


class BulkQuickLogCreate(BaseModel):
    date: str
    subject: str
    professor: Optional[str] = None
    mode: str = "teacher"
    present: int = 0
    absent: int = 0


class BulkQuickLogBatch(BaseModel):
    rows: list[BulkQuickLogCreate]
