"""
One-time legacy baseline seeder for attendance DB.

Purpose:
- Backfill baseline data snapshot (as of 2026-02-28) into the attendance table.
- Generates row-level entries distributed across 2025-11-01 to 2026-02-28.
- Uses professor-level rows to match app schema.

Run:
  DATABASE_URL="sqlite:///./attendance_ultra.db" python seed_legacy_data.py
  DATABASE_URL="sqlite+libsql://<db>.turso.io" TURSO_AUTH_TOKEN="<token>" python seed_legacy_data.py
"""

from __future__ import annotations

import os
import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlmodel import Field, SQLModel, Session, create_engine


# ---------------------------
# Schema mirror (standalone)
# ---------------------------
class Attendance(SQLModel, table=True):
    __tablename__ = "attendance"

    id: int | None = Field(default=None, primary_key=True)
    date: str
    timestamp: str
    professor: str
    status: str


# ---------------------------
# Legacy input (effective counts)
# ---------------------------
LEGACY_SUBJECT_COUNTS = {
    "Samhita": {"Present": 53, "Absent": 24},  # effective total: 77
    "Physiology": {"Present": 63, "Absent": 29},  # effective total: 92
    "Sanskrit / CM Sir (Other)": {"Present": 41, "Absent": 28},  # effective total: 69
    "Anatomy": {"Present": 73, "Absent": 34},  # effective total: 107
    "Padarth Vigyan (PV)": {"Present": 46, "Absent": 31},  # effective total: 77
}

SUBJECT_PROFESSORS = {
    "Physiology": ["Anoop Sir", "Ritesh Mam"],
    "Anatomy": ["Raghu Sir", "Akanksha Mam", "Tanvi Mam"],
    "Samhita": ["Satish Sir (Dean)", "Dhaval Sir", "Mahesh Sir"],
    "Padarth Vigyan (PV)": ["Satish Sir (Dean)", "Dhaval Sir", "Mahesh Sir"],
    "Sanskrit / CM Sir (Other)": ["CM Sir"],
}

# Halving reversal: these subjects are halved at read time in /subjects/cumulative,
# so we must seed double rows to preserve effective totals.
DOUBLE_RAW_SUBJECTS = {"Samhita", "Padarth Vigyan (PV)"}

START_DATE = date(2025, 11, 1)
END_DATE = date(2026, 2, 28)


@dataclass
class PlannedRows:
    subject: str
    status: str
    count: int


def _all_dates(start: date, end: date) -> list[date]:
    days = (end - start).days + 1
    return [start + timedelta(days=i) for i in range(days)]


def _pick_dates_even_random(count: int, start: date, end: date, rng: random.Random) -> list[date]:
    """
    Even + random distribution:
    - Build one shuffled cycle of all dates
    - Repeat cycles for large counts
    - Truncate and reshuffle final list
    This keeps per-day counts near-uniform while retaining randomness.
    """
    if count <= 0:
        return []

    dates = _all_dates(start, end)
    n = len(dates)
    cycles = (count + n - 1) // n
    picked: list[date] = []
    for _ in range(cycles):
        cycle = dates[:]
        rng.shuffle(cycle)
        picked.extend(cycle)
    picked = picked[:count]
    rng.shuffle(picked)
    return picked


def _random_time(rng: random.Random) -> str:
    # Typical college-day window
    hour = rng.randint(8, 17)
    minute = rng.randint(0, 59)
    second = rng.randint(0, 59)
    return f"{hour:02d}:{minute:02d}:{second:02d}"


def _build_engine(database_url: str):
    connect_args: dict[str, Any] = {}

    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    # Turso / libsql token handling
    token = os.getenv("TURSO_AUTH_TOKEN")
    if database_url.startswith("sqlite+libsql://") and token:
        connect_args["auth_token"] = token

    return create_engine(database_url, connect_args=connect_args, echo=False)


def plan_generation() -> list[PlannedRows]:
    plan: list[PlannedRows] = []
    for subject, counts in LEGACY_SUBJECT_COUNTS.items():
        multiplier = 2 if subject in DOUBLE_RAW_SUBJECTS else 1
        for status in ("Present", "Absent"):
            raw_count = counts[status] * multiplier
            plan.append(PlannedRows(subject=subject, status=status, count=raw_count))
    return plan


def main() -> None:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set. Please export it before running this script.")

    seed_value = int(os.getenv("LEGACY_SEED", "20260228"))
    rng = random.Random(seed_value)

    print("=" * 70)
    print("Legacy attendance baseline seeding")
    print(f"DATABASE_URL: {database_url}")
    print(f"Date range: {START_DATE.isoformat()} -> {END_DATE.isoformat()}")
    print(f"RNG seed: {seed_value}")
    print("=" * 70)

    engine = _build_engine(database_url)

    SQLModel.metadata.create_all(engine)

    plan = plan_generation()
    planned_total = sum(p.count for p in plan)

    print("\nPlanned row generation:")
    for p in plan:
        print(f"- {p.subject:<28} {p.status:<7} -> {p.count:>4} rows")
    print(f"TOTAL planned rows: {planned_total}")

    rows: list[Attendance] = []
    progress = 0
    for item in plan:
        professors = SUBJECT_PROFESSORS[item.subject]
        row_dates = _pick_dates_even_random(item.count, START_DATE, END_DATE, rng)

        for d in row_dates:
            prof = rng.choice(professors)
            rows.append(
                Attendance(
                    date=d.isoformat(),
                    timestamp=_random_time(rng),
                    professor=prof,
                    status=item.status,
                )
            )
            progress += 1
            if progress % 100 == 0 or progress == planned_total:
                print(f"Generated {progress}/{planned_total} rows...")

    print("\nInserting rows into database...")
    with Session(engine) as session:
        session.add_all(rows)
        session.commit()
    print(f"Inserted {len(rows)} rows successfully.")

    # Post-insert summary (raw)
    print("\nRaw rows inserted per subject group:")
    subject_totals: dict[str, int] = {k: 0 for k in LEGACY_SUBJECT_COUNTS}
    for r in rows:
        for subject, profs in SUBJECT_PROFESSORS.items():
            if r.professor in profs:
                subject_totals[subject] += 1
                break
    for subject, cnt in subject_totals.items():
        print(f"- {subject:<28}: {cnt}")

    print("\nDone. This script is intended to be run once.")


if __name__ == "__main__":
    main()
