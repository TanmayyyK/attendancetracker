import json
import urllib.request
import urllib.error
from typing import Optional

from sqlmodel import Session, select

from app.models.push_token import PushToken
from app.models.notification import NotificationLog


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push_notification(
    session: Session,
    title: str,
    body: str,
) -> NotificationLog:
    """Send push notification to all registered devices via Expo Push API."""
    tokens = session.exec(select(PushToken)).all()

    log = NotificationLog(
        title=title,
        body=body,
        recipients_count=len(tokens),
    )

    if not tokens:
        log.status = "failed"
        log.error_message = "No registered devices"
        session.add(log)
        session.commit()
        session.refresh(log)
        return log

    # Build messages for Expo Push API
    messages = []
    for push_token in tokens:
        messages.append({
            "to": push_token.token,
            "sound": "default",
            "title": title,
            "body": body,
            "priority": "high",
        })

    try:
        data = json.dumps(messages).encode("utf-8")
        req = urllib.request.Request(
            EXPO_PUSH_URL,
            data=data,
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))

        ticket_ids = []
        errors = []
        stale_tokens = []

        for i, ticket in enumerate(result.get("data", [])):
            if ticket.get("status") == "ok":
                ticket_ids.append(ticket.get("id", ""))
            else:
                error_detail = ticket.get("details", {})
                error_code = error_detail.get("error", "")
                errors.append(f"{tokens[i].token[:20]}...: {ticket.get('message', 'Unknown error')}")
                # Auto-cleanup stale tokens
                if error_code == "DeviceNotRegistered":
                    stale_tokens.append(tokens[i])

        # Remove stale tokens
        for stale in stale_tokens:
            session.delete(stale)

        log.ticket_ids = json.dumps(ticket_ids)

        if errors and not ticket_ids:
            log.status = "failed"
            log.error_message = "; ".join(errors[:3])  # Keep first 3 errors
        elif errors:
            log.status = "partial"
            log.error_message = "; ".join(errors[:3])
        else:
            log.status = "success"

    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        log.status = "failed"
        log.error_message = f"Expo API error: {str(e)[:200]}"
    except Exception as e:
        log.status = "failed"
        log.error_message = f"Unexpected error: {str(e)[:200]}"

    session.add(log)
    session.commit()
    session.refresh(log)
    return log
