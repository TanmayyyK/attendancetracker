from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, delete, func, select

from app.db.engine import get_session
from app.models.attendance import Attendance
from app.schemas.attendance import AttendanceCreate, AttendanceUpdate, BulkQuickLogBatch
from app.services.analytics import calc_grouped_subjects, calc_subject_stat, dashboard_summary, monthly_snapshots, professor_breakdown

router = APIRouter()

PROFESSORS = [
    "Satish Sir (Dean)",
    "Raghu Sir",
    "Tanvi Mam",
    "Akanksha Mam",
    "Dhaval Sir",
    "Ritesh Mam",
    "Anoop Sir",
    "CM Sir",
    "Mahesh Sir",
]


@router.get("/health")
def health():
    return {"ok": True, "service": "attendace-api"}


@router.get("/attendance")
def list_attendance(session: Session = Depends(get_session)):
    rows = session.exec(select(Attendance).order_by(Attendance.id.desc()).limit(10)).all()
    return rows


@router.post("/attendance")
def create_attendance(payload: AttendanceCreate, session: Session = Depends(get_session)):
    record = Attendance(
        date=payload.date,
        timestamp=payload.timestamp or datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%H:%M:%S"),
        subject=payload.subject,
        professor=payload.professor,
        status=payload.status,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.post("/attendance/bulk")
def bulk_create_attendance(payload: BulkQuickLogBatch, session: Session = Depends(get_session)):
    inserted = 0
    now = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%H:%M:%S")
    for row in payload.rows:
        if row.present < 0 or row.absent < 0:
            continue
        mode = (row.mode or "teacher").lower().strip()
        if mode == "subject":
            professor_name = "Unspecified"
        else:
            professor_name = row.professor
        if not professor_name:
            continue
        for _ in range(row.present):
            session.add(
                Attendance(
                    date=row.date,
                    timestamp=now,
                    subject=row.subject,
                    professor=professor_name,
                    status="Present",
                )
            )
            inserted += 1
        for _ in range(row.absent):
            session.add(
                Attendance(
                    date=row.date,
                    timestamp=now,
                    subject=row.subject,
                    professor=professor_name,
                    status="Absent",
                )
            )
            inserted += 1
    session.commit()
    return {"inserted": inserted}


@router.put("/attendance/{attendance_id}")
def update_attendance(
    attendance_id: int, payload: AttendanceUpdate, session: Session = Depends(get_session)
):
    row = session.get(Attendance, attendance_id)
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@router.delete("/attendance/{attendance_id}")
def delete_attendance(attendance_id: int, session: Session = Depends(get_session)):
    row = session.get(Attendance, attendance_id)
    if not row:
        raise HTTPException(status_code=404, detail="Entry not found")
    session.delete(row)
    session.commit()
    return {"deleted": attendance_id}


@router.delete("/attendance/by-date/{date_value}")
def delete_by_date(date_value: str, session: Session = Depends(get_session)):
    stmt = delete(Attendance).where(Attendance.date == date_value)
    result = session.exec(stmt)
    session.commit()
    return {"deleted": result.rowcount, "date": date_value}


@router.post("/manage/merge-professor")
def merge_professor_names(
    from_name: str = Query(..., description="Legacy name"),
    to_name: str = Query(..., description="Canonical name"),
    session: Session = Depends(get_session),
):
    rows = session.exec(select(Attendance).where(Attendance.professor == from_name)).all()
    for row in rows:
        row.professor = to_name
        session.add(row)
    session.commit()
    return {"merged_count": len(rows), "from": from_name, "to": to_name}


@router.get("/dashboard/summary")
def get_dashboard_summary(session: Session = Depends(get_session)):
    rows = session.exec(select(Attendance).order_by(Attendance.date.asc())).all()
    return dashboard_summary(rows, professors=PROFESSORS)

@router.get("/simulator/subjects")
def simulator_subjects(session: Session = Depends(get_session)):
    rows = session.exec(select(Attendance)).all()
    return [calc_subject_stat(rows, professor) for professor in PROFESSORS]

@router.get("/professors/breakdown")
def professors_breakdown(session: Session = Depends(get_session)):
    rows = session.exec(select(Attendance)).all()
    return professor_breakdown(rows, professors=PROFESSORS)

@router.get("/subjects/cumulative")
def subjects_cumulative(session: Session = Depends(get_session)):
    rows = session.exec(select(Attendance)).all()
    return calc_grouped_subjects(rows)

@router.get("/insights/monthly")
def insights_monthly(session: Session = Depends(get_session)):
    rows = session.exec(select(Attendance)).all()
    return monthly_snapshots(rows)


@router.get("/insights/bunk-budget")
def bunk_budget(session: Session = Depends(get_session)):
    rows = session.exec(select(Attendance)).all()
    summary = dashboard_summary(rows, professors=PROFESSORS)
    table = []
    for row in summary["subject_cards"]:
        table.append(
            {
                "professor": row["professor"],
                "percentage": row["percentage"],
                "safe_to_skip": row["safe_to_skip"],
                "need_to_attend": row["need_to_attend"],
            }
        )
    return table


@router.get("/meta/count")
def db_count(session: Session = Depends(get_session)):
    count = session.exec(select(func.count()).select_from(Attendance)).one()
    return {"rows": count}
