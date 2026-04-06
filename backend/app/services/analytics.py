import math
import calendar
from collections import Counter, defaultdict
from datetime import date, datetime
from typing import Iterable

from app.models.attendance import Attendance

TARGET_ATTENDANCE = 75.0


def _pct(present: int, total: int) -> float:
    if total == 0:
        return 0.0
    return round((present / total) * 100, 1)


def _streak(records: list[Attendance]) -> int:
    if not records:
        return 0
    by_day = defaultdict(list)
    for r in records:
        by_day[r.date].append(r.status)
    streak_count = 0
    for date_key in sorted(by_day.keys(), reverse=True):
        statuses = by_day[date_key]
        day_total = len(statuses)
        day_present = sum(1 for s in statuses if s == "Present")
        if day_total > 0 and (day_present / day_total) * 100 >= TARGET_ATTENDANCE:
            streak_count += 1
        else:
            break
    return streak_count


def calc_subject_stat(records: Iterable[Attendance], professor: str) -> dict:
    subject_records = [r for r in records if r.professor == professor]
    total = len(subject_records)
    present = sum(1 for r in subject_records if r.status == "Present")
    pct = _pct(present, total)
    bunkable = max(int((present / 0.75) - total), 0) if total > 0 else 0
    needed = max(math.ceil(3 * total - 4 * present), 0)
    return {
        "professor": professor,
        "total": total,
        "present": present,
        "absent": total - present,
        "percentage": pct,
        "safe_to_skip": bunkable if pct >= TARGET_ATTENDANCE else 0,
        "need_to_attend": needed if pct < TARGET_ATTENDANCE else 0,
        "status_hint": f"Safe to skip {bunkable}" if pct >= TARGET_ATTENDANCE else f"Need {needed} more",
    }

def professor_breakdown(records: Iterable[Attendance], professors: list[str]) -> list[dict]:
    rows = list(records)
    result: list[dict] = []

    # Regular teacher rows
    for professor in professors:
        result.append(calc_subject_stat(rows, professor))

    # Subject-mode rows logged with "Unspecified" teacher become subject-tagged buckets.
    by_subject_unspecified: dict[str, list[Attendance]] = defaultdict(list)
    for r in rows:
        if r.professor == "Unspecified" and r.subject:
            by_subject_unspecified[r.subject].append(r)

    for subject in sorted(by_subject_unspecified.keys(), key=lambda s: SUBJECT_ORDER.index(s) if s in SUBJECT_ORDER else 999):
        d = by_subject_unspecified[subject]
        total = len(d)
        present = sum(1 for x in d if x.status == "Present")
        pct = _pct(present, total)
        bunkable = max(int((present / 0.75) - total), 0) if total > 0 else 0
        needed = max(math.ceil(3 * total - 4 * present), 0)
        result.append(
            {
                "professor": f"{subject} (Unspecified)",
                "total": total,
                "present": present,
                "absent": total - present,
                "percentage": pct,
                "safe_to_skip": bunkable if pct >= TARGET_ATTENDANCE else 0,
                "need_to_attend": needed if pct < TARGET_ATTENDANCE else 0,
                "status_hint": f"Safe to skip {bunkable}" if pct >= TARGET_ATTENDANCE else f"Need {needed} more",
            }
        )

    return result


SUBJECT_ORDER = [
    "Physiology",
    "Anatomy",
    "Samhita",
    "Padarth Vigyan",
    "Sanskrit (CM Sir)",
]


def calc_grouped_subjects(records: Iterable[Attendance]) -> list[dict]:
    rows = list(records)
    by_subject: dict[str, list[Attendance]] = defaultdict(list)
    for r in rows:
        if r.subject:
            by_subject[r.subject].append(r)

    subjects = sorted(by_subject.keys(), key=lambda s: SUBJECT_ORDER.index(s) if s in SUBJECT_ORDER else 999)
    result: list[dict] = []
    for subject in subjects:
        d = by_subject[subject]
        total = len(d)
        present = sum(1 for r in d if r.status == "Present")
        pct = _pct(present, total)
        bunkable = max(int((present / 0.75) - total), 0) if total > 0 else 0
        needed = max(math.ceil(3 * total - 4 * present), 0)
        result.append(
            {
                "subject": subject,
                "present": present,
                "total": total,
                "percentage": pct,
                "safe_to_skip": bunkable if pct >= TARGET_ATTENDANCE else 0,
                "need_to_attend": needed if pct < TARGET_ATTENDANCE else 0,
                "status_hint": f"Safe to skip {bunkable}" if pct >= TARGET_ATTENDANCE else f"Need {needed} more",
            }
        )
    return result


def _month_end(year: int, month: int) -> date:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, last_day)


def monthly_snapshots(records: Iterable[Attendance]) -> list[dict]:
    rows = list(records)
    if not rows:
        return []

    dates = sorted({datetime.strptime(r.date, "%Y-%m-%d").date() for r in rows})
    min_d, max_d = dates[0], dates[-1]
    today = date.today()

    months: list[tuple[int, int]] = []
    y, m = min_d.year, min_d.month
    while (y, m) <= (max_d.year, max_d.month):
        months.append((y, m))
        if m == 12:
            y += 1
            m = 1
        else:
            m += 1

    snapshots: list[dict] = []
    prev_subject_pct: dict[str, float] | None = None
    prev_overall: float | None = None

    for (yy, mm) in months:
        cutoff = _month_end(yy, mm)
        is_complete = cutoff < today
        is_mtd = (yy, mm) == (today.year, today.month) and not is_complete

        # Only include months we have *reached* (past months + current month-to-date)
        if cutoff > today and not is_mtd:
            continue

        filtered = [r for r in rows if datetime.strptime(r.date, "%Y-%m-%d").date() <= min(cutoff, today)]
        total = len(filtered)
        present = sum(1 for r in filtered if r.status == "Present")
        overall_pct = _pct(present, total)

        grouped = calc_grouped_subjects(filtered)
        subject_pct = {g["subject"]: float(g["percentage"]) for g in grouped}

        deltas = {}
        if prev_subject_pct is not None:
            subject_names = sorted(set(subject_pct.keys()) | set(prev_subject_pct.keys()))
            for subject in subject_names:
                deltas[subject] = round(subject_pct.get(subject, 0.0) - prev_subject_pct.get(subject, 0.0), 1)

        overall_delta = round(overall_pct - prev_overall, 1) if prev_overall is not None else None

        # Generate a single, dynamic insight string.
        insight = None
        if prev_subject_pct is not None and deltas:
            worst = min(deltas.items(), key=lambda kv: kv[1])
            best = max(deltas.items(), key=lambda kv: kv[1])
            if worst[1] < 0:
                insight = f"In {datetime(yy, mm, 1).strftime('%B')}, you dropped {abs(worst[1])}% in {worst[0]} vs last month."
            elif best[1] > 0:
                insight = f"In {datetime(yy, mm, 1).strftime('%B')}, you improved {best[1]}% in {best[0]} vs last month."

        snapshots.append(
            {
                "month_key": f"{yy:04d}-{mm:02d}",
                "label": datetime(yy, mm, 1).strftime("%B %Y"),
                "cutoff_date": cutoff.isoformat(),
                "is_complete": is_complete,
                "is_mtd": is_mtd,
                "overall": {"percentage": overall_pct, "present": present, "total": total},
                "subjects": grouped,
                "deltas": deltas,
                "overall_delta": overall_delta,
                "insight": insight,
            }
        )

        prev_subject_pct = subject_pct
        prev_overall = overall_pct

    return snapshots


def dashboard_summary(records: list[Attendance], professors: list[str]) -> dict:
    total = len(records)
    present = sum(1 for r in records if r.status == "Present")
    absent = total - present
    month_total = Counter()
    month_present = Counter()
    dow_counter_total = Counter()
    dow_counter_present = Counter()
    for r in records:
        dt = datetime.strptime(r.date, "%Y-%m-%d")
        month_key = dt.strftime("%Y-%m")
        month_total[month_key] += 1
        if r.status == "Present":
            month_present[month_key] += 1
        dow_counter_total[dt.strftime("%A")] += 1
        if r.status == "Present":
            dow_counter_present[dt.strftime("%A")] += 1

    burnout = []
    for dow in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]:
        t = dow_counter_total[dow]
        p = dow_counter_present[dow]
        if t > 0:
            burnout.append({"day": dow, "attendance": round((p / t) * 100, 1)})

    weekly_total = max(len({r.date for r in records}), 1)
    predicted = _pct(present + (weekly_total * 8), total + (weekly_total * 10))

    month_trend = []
    for month in sorted(month_total.keys()):
        t = month_total[month]
        p = month_present[month]
        month_trend.append(
            {
                "month": month,
                "percentage": _pct(p, t),
                "total": t,
                "present": p,
            }
        )

    return {
        "overall": {
            "total": total,
            "present": present,
            "absent": absent,
            "percentage": _pct(present, total),
            "streak": _streak(records),
        },
        "subject_cards": professor_breakdown(records, professors),
        "month_trend": month_trend,
        "burnout_analysis": burnout,
        "predictive_trajectory": {"projected_percentage": predicted},
    }
