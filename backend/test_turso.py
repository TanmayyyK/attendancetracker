import os
from sqlalchemy import create_engine, text

def test_connection():
    url = os.getenv("DATABASE_URL")
    token = os.getenv("TURSO_AUTH_TOKEN")
    
    if not url:
        print("DATABASE_URL not set")
        return

    # Normalize as I did in the script
    if url.startswith("libsql://"):
        url = url.replace("libsql://", "sqlite+libsql://", 1)
    
    print(f"Testing URL: {url}")
    
    connect_args = {}
    if "libsql" in url and token:
        connect_args["auth_token"] = token
        
    try:
        engine = create_engine(url, connect_args=connect_args)
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print(f"Connection successful: {result.fetchone()}")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_connection()
