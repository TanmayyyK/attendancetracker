import os
from sqlalchemy import create_engine, text

def test():
    db_url = "sqlite+libsql://attendance-tanmayyyk.aws-ap-south-1.turso.io/?secure=true"
    token = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzU1ODc5NjQsImlkIjoiMDE5ZDY0NGUtNjUwMS03Y2Y4LTllM2EtNzQxMjg0YjM2NmU2IiwicmlkIjoiYjIxNjI5ZTItYTdhZS00YTg1LTlmZGItZDg0NDI4YTk0YTg2In0.FuVRhdI-MP1kR_9ygUUMWW9IDJwPTyZtrJuEpg0hbi9PVqXtod3OyT9xwPPfl29ZEf78zTdhjzj2FmmWN7IcAw"
    
    # Try the connect_args style
    try:
        engine = create_engine(db_url, connect_args={"auth_token": token})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("SUCCESS: connect_args works!")
    except Exception as e:
        print(f"FAILED connect_args: {e}")

test()
