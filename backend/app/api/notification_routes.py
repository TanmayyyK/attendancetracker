from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.config import settings
from app.db.engine import get_session
from app.models.push_token import PushToken
from app.models.notification import NotificationLog
from app.schemas.notification import (
    RegisterTokenRequest,
    SendNotificationRequest,
    NotificationLogResponse,
)
from app.services.notifications import send_push_notification

notification_router = APIRouter(prefix="/notifications", tags=["notifications"])


def _verify_secret(secret_key: str):
    """Verify the notification secret key."""
    if secret_key != settings.notification_secret:
        raise HTTPException(
            status_code=401,
            detail="Invalid secret key"
        )


@notification_router.post("/register-token")
def register_token(
    payload: RegisterTokenRequest,
    session: Session = Depends(get_session),
):
    """Register or update an Expo push token."""
    existing = session.exec(
        select(PushToken).where(PushToken.token == payload.token)
    ).first()

    if existing:
        existing.device_name = payload.device_name or existing.device_name
        existing.updated_at = datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()
        session.add(existing)
        session.commit()
        return {"status": "updated", "token_id": existing.id}

    token = PushToken(
        token=payload.token,
        device_name=payload.device_name,
    )
    session.add(token)
    session.commit()
    session.refresh(token)
    return {"status": "registered", "token_id": token.id}


@notification_router.post("/send")
def send_notification(
    payload: SendNotificationRequest,
    session: Session = Depends(get_session),
):
    """Send a push notification to all registered devices."""
    _verify_secret(payload.secret_key)

    log = send_push_notification(
        session=session,
        title=payload.title,
        body=payload.body,
    )

    return {
        "status": log.status,
        "notification_id": log.id,
        "recipients_count": log.recipients_count,
        "error": log.error_message,
    }


@notification_router.get("/history")
def notification_history(
    limit: int = Query(default=50, le=100),
    session: Session = Depends(get_session),
):
    """Get notification history."""
    logs = session.exec(
        select(NotificationLog)
        .order_by(NotificationLog.id.desc())
        .limit(limit)
    ).all()
    return logs


@notification_router.get("/tokens")
def list_tokens(
    secret_key: str = Query(...),
    session: Session = Depends(get_session),
):
    """List all registered push tokens (protected)."""
    _verify_secret(secret_key)
    tokens = session.exec(select(PushToken)).all()
    return tokens


@notification_router.delete("/tokens/{token_id}")
def delete_token(
    token_id: int,
    secret_key: str = Query(...),
    session: Session = Depends(get_session),
):
    """Delete a push token."""
    _verify_secret(secret_key)
    token = session.get(PushToken, token_id)
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    session.delete(token)
    session.commit()
    return {"deleted": token_id}
