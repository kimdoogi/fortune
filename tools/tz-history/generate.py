"""Export Asia/Seoul UTC-offset history (IANA tz database) for fortune-engine.

Output: packages/fortune-engine/data/tz-seoul.json
  transitions: [[utcUnixSeconds, offsetMinutes], ...] ascending; offset applies from that instant.
Covers 1912-01-01 .. 2052-01-01 (range D-035 plus margin).
"""
import json
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "../../packages/fortune-engine/data/tz-seoul.json"))
z = ZoneInfo("Asia/Seoul")
t = datetime(1912, 1, 1, tzinfo=timezone.utc)
end = datetime(2052, 1, 1, tzinfo=timezone.utc)
prev = None
transitions = []
while t < end:
    off = int(t.astimezone(z).utcoffset().total_seconds() // 60)
    if off != prev:
        # refine to the exact minute of change
        lo = t - timedelta(minutes=15)
        while int(lo.astimezone(z).utcoffset().total_seconds() // 60) != off:
            lo += timedelta(minutes=1)
        transitions.append([int(lo.timestamp()) if prev is not None else int(t.timestamp()), off])
        prev = off
    t += timedelta(minutes=15)
try:
    version = open("/usr/share/zoneinfo/+VERSION").read().strip()
except OSError:
    version = "unknown"
json.dump({"source": f"IANA tz database Asia/Seoul ({version})", "unit": "unix seconds UTC, offset minutes",
           "transitions": transitions}, open(OUT, "w"), separators=(",", ":"))
print(len(transitions), "transitions ->", OUT)
for s, o in transitions:
    print(datetime.fromtimestamp(s, tz=timezone.utc).isoformat(), o)
