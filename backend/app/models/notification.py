from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlmodel import Field, SQLModel


class NotificationLog(SQLModel, table=True):
    __tablename__ = "notification_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    body: str
    sent_at: str = Field(
        default_factory=lambda: datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()
    )
    status: str = "pending"  # pending, success, partial, failed
    ticket_ids: Optional[str] = None  # JSON array of Expo ticket IDs
    recipients_count: int = 0
    error_message: Optional[str] = None
