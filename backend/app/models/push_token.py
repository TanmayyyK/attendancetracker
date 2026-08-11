from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlmodel import Field, SQLModel


class PushToken(SQLModel, table=True):
    __tablename__ = "push_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(unique=True, index=True)
    device_name: Optional[str] = None
    created_at: str = Field(
        default_factory=lambda: datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()
    )
