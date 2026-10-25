import os
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.config import settings
from app.db.engine import get_session
from app.main import app
from app.models.attendance import Attendance

BASE_URL = "" if "VERCEL" in os.environ else settings.api_prefix


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def seed_records(session: Session, count: int):
    records = []
    for i in range(1, count + 1):
        rec = Attendance(
            id=i,
            date=f"2026-10-{(i % 28) + 1:02d}",
            timestamp="10:00:00",
            subject=f"Subject {i % 5}",
            professor="Dean Sir",
            status="Present" if i % 2 == 0 else "Absent",
            reason=None if i % 2 == 0 else "Personal",
        )
        session.add(rec)
        records.append(rec)
    session.commit()
    return records


def test_empty_history(client: TestClient):
    response = client.get(f"{BASE_URL}/attendance")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0
    assert response.headers.get("X-Has-More") == "false"
    assert response.headers.get("X-Next-Cursor") == ""


def test_default_request_compatibility_and_json_array(client: TestClient, session: Session):
    seed_records(session, 150)
    response = client.get(f"{BASE_URL}/attendance")
    assert response.status_code == 200
    data = response.json()
    # Backward-compatible bare array
    assert isinstance(data, list)
    assert len(data) == 100
    # Descending ID ordering (150 down to 51)
    assert data[0]["id"] == 150
    assert data[-1]["id"] == 51
    assert response.headers.get("X-Has-More") == "true"
    assert response.headers.get("X-Next-Cursor") == "51"


def test_pagination_progression_across_pages(client: TestClient, session: Session):
    seed_records(session, 120)

    # Page 1 (limit 50): 120 down to 71
    p1 = client.get(f"{BASE_URL}/attendance?limit=50")
    assert p1.status_code == 200
    p1_data = p1.json()
    assert len(p1_data) == 50
    assert p1_data[0]["id"] == 120
    assert p1_data[-1]["id"] == 71
    assert p1.headers.get("X-Has-More") == "true"
    assert p1.headers.get("X-Next-Cursor") == "71"

    # Page 2 (limit 50, before_id 71): 70 down to 21
    p2 = client.get(f"{BASE_URL}/attendance?limit=50&before_id=71")
    assert p2.status_code == 200
    p2_data = p2.json()
    assert len(p2_data) == 50
    assert p2_data[0]["id"] == 70
    assert p2_data[-1]["id"] == 21
    assert p2.headers.get("X-Has-More") == "true"
    assert p2.headers.get("X-Next-Cursor") == "21"

    # Page 3 (limit 50, before_id 21): 20 down to 1
    p3 = client.get(f"{BASE_URL}/attendance?limit=50&before_id=21")
    assert p3.status_code == 200
    p3_data = p3.json()
    assert len(p3_data) == 20
    assert p3_data[0]["id"] == 20
    assert p3_data[-1]["id"] == 1
    assert p3.headers.get("X-Has-More") == "false"
    assert p3.headers.get("X-Next-Cursor") == ""

    # Page 4 (before_id 1): empty
    p4 = client.get(f"{BASE_URL}/attendance?limit=50&before_id=1")
    assert p4.status_code == 200
    assert p4.json() == []
    assert p4.headers.get("X-Has-More") == "false"
    assert p4.headers.get("X-Next-Cursor") == ""


def test_exact_page_boundary(client: TestClient, session: Session):
    seed_records(session, 50)
    response = client.get(f"{BASE_URL}/attendance?limit=50")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 50
    assert data[0]["id"] == 50
    assert data[-1]["id"] == 1
    # Exactly 50 records with limit 50 -> no more pages
    assert response.headers.get("X-Has-More") == "false"
    assert response.headers.get("X-Next-Cursor") == ""


def test_fewer_than_one_page(client: TestClient, session: Session):
    seed_records(session, 15)
    response = client.get(f"{BASE_URL}/attendance?limit=50")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 15
    assert response.headers.get("X-Has-More") == "false"
    assert response.headers.get("X-Next-Cursor") == ""


def test_validation_invalid_limit(client: TestClient):
    r_zero = client.get(f"{BASE_URL}/attendance?limit=0")
    assert r_zero.status_code == 422

    r_neg = client.get(f"{BASE_URL}/attendance?limit=-10")
    assert r_neg.status_code == 422

    r_excess = client.get(f"{BASE_URL}/attendance?limit=201")
    assert r_excess.status_code == 422

    r_valid_max = client.get(f"{BASE_URL}/attendance?limit=200")
    assert r_valid_max.status_code == 200


def test_validation_invalid_cursor(client: TestClient):
    r_zero = client.get(f"{BASE_URL}/attendance?before_id=0")
    assert r_zero.status_code == 422

    r_neg = client.get(f"{BASE_URL}/attendance?before_id=-1")
    assert r_neg.status_code == 422

    r_non_int = client.get(f"{BASE_URL}/attendance?before_id=abc")
    assert r_non_int.status_code == 422


def test_cors_exposure_headers(client: TestClient):
    # Perform preflight or request with Origin header
    response = client.get(f"{BASE_URL}/attendance", headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    exposed = response.headers.get("access-control-expose-headers", "")
    assert "X-Has-More" in exposed
    assert "X-Next-Cursor" in exposed
