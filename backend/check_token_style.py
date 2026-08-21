import os
from sqlalchemy import create_engine, text

def test():
    db_url = "sqlite+libsql://attendance-tanmayyyk.aws-ap-south-1.turso.io/?secure=true"
    token = os.environ.get("TURSO_AUTH_TOKEN")
    if not token:
        raise RuntimeError("Set TURSO_AUTH_TOKEN before running this diagnostic.")
    
    # Try the connect_args style
    try:
        engine = create_engine(db_url, connect_args={"auth_token": token})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("SUCCESS: connect_args works!")
    except Exception as e:
        print(f"FAILED connect_args: {e}")

test()
