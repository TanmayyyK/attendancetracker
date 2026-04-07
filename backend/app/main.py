from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NOTE: We do NOT use @app.on_event("startup") to run init_db() here.
# In a Serverless environment (Vercel), synchronous network operations like
# SQLModel.metadata.create_all() during ASGI startup will cause cold-starts 
# to time out, resulting in a 500 "Application startup failed" crash.
# Turso tables are assumed to be managed/seeded out-of-band.

app.include_router(router, prefix=settings.api_prefix)
