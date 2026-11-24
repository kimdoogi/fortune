"""Build packages/fortune-engine/data/lunar.json from KASI lunar month data.

Input (kasi-lunar-years.json): {"1985": "음력1월1일의 양력|윤달|달 길이 비트"} built in the browser from https://astro.kasi.re.kr/life/lunc (lunar YYYY-MM-01 -> solar date, LUNC_EN_DD = month length)

Checks:
  - every year has 12 or 13 months in order, at most one leap month, month lengths 29/30
  - each month starts the day after the previous one ends (also across years)
  - known conversions (tools/saju-fixtures/kasi_data.py LUNAR) reproduce
"""
import json
import os
import sys
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "kasi-lunar-years.json")
OUT = os.path.normpath(os.path.join(HERE, "../../packages/fortune-engine/data/lunar.json"))

# Input is the compact form produced in the browser after per-month continuity checks:
#   {"1985": "1985-02-20|0|101010110101", ...}
raw = json.load(open(SRC, encoding="utf-8"))
errors = []
years = {}
prev_end = None
for y in sorted(raw, key=int):
    start, leap, bits = raw[y].split("|")
    leap = int(leap)
    if len(bits) != (13 if leap else 12) or set(bits) - {"0", "1"}:
        errors.append(f"{y}: bad bits {bits} (leap {leap})")
    s0 = date.fromisoformat(start)
    if prev_end is not None and s0 != prev_end + timedelta(days=1):
        errors.append(f"{y}: starts {s0}, expected {prev_end + timedelta(days=1)}")
    total = sum(30 if c == "1" else 29 for c in bits)
    if not (353 <= total <= 385):
        errors.append(f"{y}: {total} days")
    prev_end = s0 + timedelta(days=total - 1)
    years[y] = [start, leap, bits]

# known conversions
sys.path.insert(0, os.path.join(HERE, "../saju-fixtures"))
from kasi_data import LUNAR  # noqa: E402


def to_solar(y, m, d, leap):
    row = years.get(str(y))
    if not row:
        return None
    start, leap_month, bits = row
    seq = []
    for mm in range(1, 13):
        seq.append((mm, False))
        if mm == leap_month:
            seq.append((mm, True))
    off = 0
    for (mm, lp), b in zip(seq, bits):
        n = 30 if b == "1" else 29
        if mm == m and lp == leap:
            return None if d > n else (date.fromisoformat(start) + timedelta(days=off + d - 1)).isoformat()
        off += n
    return None


for key, solar in LUNAR.items():
    dstr, leap = key.split("|")
    y, m, d = map(int, dstr.split("-"))
    got = to_solar(y, m, d, leap == "1")
    if got != solar:
        errors.append(f"known {key}: got {got}, KASI {solar}")
if to_solar(1990, 1, 10, True) is not None:
    errors.append("1990 윤1월 should not exist")

if errors:
    print("ERRORS:")
    for e in errors:
        print(" ", e)
    sys.exit(1)

json.dump({"source": "KASI astro.kasi.re.kr /life/lunc (fetched 2026-11-24)",
           "format": "[lunar month 1 day 1 as solar date, leap month (0 = none), month lengths 1=30 0=29 in order]",
           "years": years}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"ok: {len(years)} lunar years ({min(years, key=int)}..{max(years, key=int)}), "
      f"leap years {sum(1 for r in years.values() if r[1])}, {os.path.getsize(OUT)} bytes -> {OUT}")
