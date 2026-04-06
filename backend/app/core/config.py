from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "attendace-api"
    api_prefix: str = "/api"
    target_attendance: float = 75.0
    database_url: str = Field(
        default="sqlite:///./attendance_ultra.db",
        description="Uses existing SQLite DB by default for seamless continuity.",
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
