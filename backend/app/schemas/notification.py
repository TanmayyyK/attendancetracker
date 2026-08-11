from typing import Optional
from pydantic import BaseModel


class RegisterTokenRequest(BaseModel):
    token: str
    device_name: Optional[str] = None


class SendNotificationRequest(BaseModel):
    title: str
    body: str
    secret_key: str


class NotificationLogResponse(BaseModel):
    id: int
    title: str
    body: str
    sent_at: str
    status: str
    recipients_count: int
