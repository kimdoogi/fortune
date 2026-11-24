"""Generate the 24 solar terms table for fortune-engine (D-039, D-061).

Definition (same as KASI): the instant the Sun's apparent geocentric ecliptic
longitude (true ecliptic and equinox of date) reaches a multiple of 15 degrees.

Usage:
  .venv/bin/python generate.py                       # writes ../../packages/fortune-engine/data/solar-terms.json
  .venv/bin/python generate.py --verify KASI.json    # compare with KASI times (minute precision)
"""
import json
import os
import sys
from datetime import timezone

from skyfield import almanac  # noqa: F401  (kept for find_discrete import path stability)
from skyfield.api import load
from skyfield.framelib import ecliptic_frame
from skyfield.searchlib import find_discrete

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "../../packages/fortune-engine/data/solar-terms.json"))

# Order within a calendar year, starting from 소한 (285 deg)
NAMES = ["소한", "대한", "입춘", "우수", "경칩", "춘분", "청명", "곡우", "입하", "소만", "망종", "하지",
         "소서", "대서", "입추", "처서", "백로", "추분", "한로", "상강", "입동", "소설", "대설", "동지"]
LON = {n: (285 + 15 * i) % 360 for i, n in enumerate(NAMES)}
FIRST_YEAR, LAST_YEAR = 1919, 2051
# KASI publishes minutes. Our instants run ~7 s later than KASI's on average (measured on
# 168 official 2004-2017 times), so we subtract 7 s before rounding to the minute, then
# overwrite with KASI's official minute wherever we have it (D-039).
CALIBRATION_S = 7
KASI_FILES = ["kasi-2004-2017-jeol.json"]

ts = load.timescale()
eph = load(os.path.join(HERE, "de440s.bsp"))
earth, sun = eph["earth"], eph["sun"]


def term_index(t):
    lon = earth.at(t).observe(sun).apparent().frame_latlon(ecliptic_frame)[1].degrees
    return (lon // 15).astype(int) % 24


term_index.step_days = 7


def generate():
    t0 = ts.utc(FIRST_YEAR - 1, 12, 15)
    t1 = ts.utc(LAST_YEAR + 1, 1, 15)
    times, idx = find_discrete(t0, t1, term_index)
    by_year = {}
    for t, i in zip(times, idx):
        lon = int(i) * 15
        name = next(n for n, l in LON.items() if l == lon)
        dt = t.utc_datetime().replace(tzinfo=timezone.utc)
        year = dt.year if not (name in ("소한", "대한") and dt.month == 12) else dt.year + 1
        # KST date decides the calendar year a term belongs to (소한/대한 are always in January KST)
        if FIRST_YEAR <= year <= LAST_YEAR:
            by_year.setdefault(str(year), {})[name] = int(round(dt.timestamp()))
    table = {}
    for y, terms in sorted(by_year.items()):
        if len(terms) != 24:
            continue  # edge years outside the full range
        table[y] = [terms[n] for n in NAMES]
    return table


def main():
    if "--verify" in sys.argv:
        kasi = json.load(open(sys.argv[sys.argv.index("--verify") + 1], encoding="utf-8"))
        data = json.load(open(OUT, encoding="utf-8"))
        from datetime import datetime, timedelta
        worst, n, bad = 0, 0, []
        for y, terms in kasi.items():
            for name, s in terms.items():
                # "MM월DD일 HH시MM분" in KST
                mm, dd, hh, mi = int(s[0:2]), int(s[3:5]), int(s[7:9]), int(s[10:12])
                kst = datetime(int(y), mm, dd, hh, mi)
                ours_utc = datetime.fromtimestamp(data["terms"][y][NAMES.index(name)], tz=timezone.utc)
                ours_kst = (ours_utc + timedelta(hours=9)).replace(tzinfo=None)
                truncated = ours_kst.replace(second=0, microsecond=0)
                diff = (ours_kst - kst).total_seconds()
                worst = max(worst, abs(diff))
                n += 1
                if truncated != kst:
                    bad.append((y, name, s, ours_kst.strftime("%m-%d %H:%M:%S")))
        print(f"compared {n} terms (KASI minute = our time truncated), max |ours - KASI| {worst:.0f}s, mismatches: {len(bad)}")
        for b in bad:
            print("  MISMATCH", b)
        sys.exit(1 if bad else 0)
    from datetime import datetime, timedelta
    raw = generate()
    table = {y: [int(round((t - CALIBRATION_S) / 60)) * 60 for t in ts_] for y, ts_ in raw.items()}
    overrides = []
    for fname in KASI_FILES:
        kasi = json.load(open(os.path.join(HERE, fname), encoding="utf-8"))
        for y, terms in kasi.items():
            for name, s in terms.items():
                mm, dd, hh, mi = int(s[0:2]), int(s[3:5]), int(s[7:9]), int(s[10:12])
                k = int(datetime(int(y), mm, dd, hh, mi, tzinfo=timezone(timedelta(hours=9))).timestamp())
                i = NAMES.index(name)
                if table[y][i] != k:
                    overrides.append({"year": y, "term": name, "computed": table[y][i], "kasi": k})
                    table[y][i] = k
    out = {
        "version": 1,
        "source": "Skyfield 1.49 + JPL DE440s (apparent geocentric ecliptic longitude of date), "
                  f"minus {CALIBRATION_S}s, rounded to the minute; KASI official minutes override",
        "unit": "unix seconds (UTC), minute precision",
        "names": NAMES,
        "kasiFiles": KASI_FILES,
        "overrides": overrides,
        "terms": table,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {len(table)} years ({min(table)}..{max(table)}) -> {OUT}, {os.path.getsize(OUT)} bytes, {len(overrides)} KASI overrides")


if __name__ == "__main__":
    main()
