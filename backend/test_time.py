from datetime import datetime
from zoneinfo import ZoneInfo
print("UTC:", datetime.now().strftime("%H:%M:%S"))
print("IST:", datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%H:%M:%S"))
