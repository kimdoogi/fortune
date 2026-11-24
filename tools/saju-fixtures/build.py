"""Build saju test fixtures from KASI data + textbook rules (independent of fortune-engine).

Usage:
  python3 build.py dates          -> print solar dates whose 일진 must be fetched from KASI
  python3 build.py build OUT.json -> write fixtures (needs ILJIN filled in kasi_data_iljin.json)
"""
import json, sys, os
from datetime import datetime, timedelta, date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from kasi_data import SOLAR_TERMS, LUNAR

STEMS = "갑을병정무기경신임계"
BRANCHES = "자축인묘진사오미신유술해"
JEOL = ["소한", "입춘", "경칩", "청명", "입하", "망종", "소서", "입추", "백로", "한로", "입동", "대설"]
# branch index of the month that STARTS at each 절
JEOL_BRANCH = {"소한": 1, "입춘": 2, "경칩": 3, "청명": 4, "입하": 5, "망종": 6, "소서": 7,
               "입추": 8, "백로": 9, "한로": 10, "입동": 11, "대설": 0}
# calendar month of each 절, and earliest/latest day it can fall on (1920-2050)
JEOL_MONTH = {"소한": 1, "입춘": 2, "경칩": 3, "청명": 4, "입하": 5, "망종": 6, "소서": 7,
              "입추": 8, "백로": 9, "한로": 10, "입동": 11, "대설": 12}
JEOL_WINDOW = {"소한": (5, 7), "입춘": (3, 5), "경칩": (5, 6), "청명": (4, 5), "입하": (5, 6),
               "망종": (5, 7), "소서": (6, 8), "입추": (7, 9), "백로": (7, 9), "한로": (8, 9),
               "입동": (7, 8), "대설": (6, 8)}

def gz(i):
    return STEMS[i % 10] + BRANCHES[i % 12]

def gz_index(stem, branch):
    for i in range(60):
        if i % 10 == stem and i % 12 == branch:
            return i

# ---------- time zone / DST history: IANA tz database Asia/Seoul (tools/tz-history) ----------
H = timedelta(hours=1)
_TZ = json.load(open(os.path.join(HERE, "../../packages/fortune-engine/data/tz-seoul.json")))["transitions"]
_OFFSETS = sorted({o for _, o in _TZ})

def _offset_at_utc(utc):
    s = (utc - datetime(1970, 1, 1)).total_seconds()
    off = _TZ[0][1]
    for t, o in _TZ:
        if t <= s:
            off = o
        else:
            break
    return off

def utc_offset(local):
    """-> (status, timedelta|None, note). status: ok | ambiguous | nonexistent"""
    valid = sorted((local - timedelta(minutes=o), o) for o in _OFFSETS
                   if _offset_at_utc(local - timedelta(minutes=o)) == o)
    if not valid:
        return "nonexistent", None, None
    utc, o = valid[0]
    note = f"IANA tz Asia/Seoul: UTC{'+' if o >= 0 else ''}{o // 60}:{o % 60:02d}"
    return ("ambiguous" if len(valid) > 1 else "ok"), timedelta(minutes=o), note

REF = timedelta(hours=8, minutes=30)

def term_instant_utc(year, name):
    s = SOLAR_TERMS.get(str(year), {}).get(name)
    if not s:
        return None
    mm, dd = int(s[0:2]), int(s[3:5]); hh, mi = int(s[7:9]), int(s[10:12])
    return datetime(year, mm, dd, hh, mi) - timedelta(hours=9)  # KST since 1961

import math
JEOL_LONGITUDE = {"소한": 285, "입춘": 315, "경칩": 345, "청명": 15, "입하": 45, "망종": 75,
                  "소서": 105, "입추": 135, "백로": 165, "한로": 195, "입동": 225, "대설": 255}

def sun_apparent_longitude(dt_utc):
    """Meeus ch.25 low-precision apparent solar longitude (deg). ~0.01 deg."""
    jd = (dt_utc - datetime(2000, 1, 1, 12)).total_seconds() / 86400 + 2451545.0
    T = (jd - 2451545.0) / 36525
    L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T
    M = math.radians(357.52911 + 35999.05029 * T - 0.0001537 * T * T)
    Cc = ((1.914602 - 0.004817 * T - 0.000014 * T * T) * math.sin(M)
          + (0.019993 - 0.000101 * T) * math.sin(2 * M) + 0.000289 * math.sin(3 * M))
    om = math.radians(125.04 - 1934.136 * T)
    return (L0 + Cc - 0.00569 - 0.00478 * math.sin(om)) % 360

def meeus_term_utc(year, name):
    target = JEOL_LONGITUDE[name]
    m = JEOL_MONTH[name]
    lo = datetime(year, m, 1) - timedelta(hours=9)
    hi = lo + timedelta(days=15)
    f = lambda t: ((sun_apparent_longitude(t) - target + 180) % 360) - 180
    for _ in range(60):
        mid = lo + (hi - lo) / 2
        if f(mid) < 0: lo = mid
        else: hi = mid
    return lo

MARGIN = timedelta(hours=6)
def jeol_passed(year, name, utc_instant, local_date):
    """True if the 절 `name` of calendar `year` has passed at utc_instant. None if undecidable."""
    t = term_instant_utc(year, name)
    if t is not None:
        return utc_instant >= t, f"KASI {year} {name} {SOLAR_TERMS[str(year)][name]}"
    t = meeus_term_utc(year, name)
    if abs(utc_instant - t) < MARGIN:
        return None, f"{year} {name} KASI 시각 필요 (천문 계산상 6시간 이내)"
    gap = abs(utc_instant - t).total_seconds() / 3600
    return utc_instant >= t, f"{year} {name}: 천문 계산으로 판정 (절기와 {gap:.0f}시간 차이, KASI 대비 오차 13분 이내)"

def year_month(utc_instant, local_date):
    y = local_date.year
    basis = []
    ip, b = jeol_passed(y, "입춘", utc_instant, local_date)
    if b: basis.append(b)
    if ip is None:
        raise ValueError("입춘 undecidable " + str(local_date))
    sy = y if ip else y - 1
    year_i = (sy - 4) % 60
    # month: latest 절 passed scanning calendar year
    branch = None
    last_b = next_b = None
    for name in JEOL:  # in calendar order Jan..Dec
        p, b = jeol_passed(y, name, utc_instant, local_date)
        if p is None:
            raise ValueError(b + " " + str(local_date))
        if p:
            branch = JEOL_BRANCH[name]; last_b = b
        else:
            next_b = b
            break
    for b in (last_b, next_b):
        if b and b not in basis: basis.append(b)
    if branch is None:  # before 소한 of this calendar year -> 자월 (from previous 대설)
        branch = 0
    year_stem = year_i % 10
    in_stem = (year_stem % 5) * 2 + 2
    month_stem = (in_stem + (branch - 2) % 12) % 10
    month_i = gz_index(month_stem, branch)
    return year_i, month_i, basis

def jdn_iljin(d):
    a = (14 - d.month) // 12; yy = d.year + 4800 - a; mm = d.month + 12 * a - 3
    jdn = d.day + (153 * mm + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045
    return gz((jdn + 49) % 60)

# ---------- cases ----------
def C(id, cat, date_, time_=None, cal="solar", leap=False, note="", check=""):
    return dict(id=id, category=cat, date=date_, time=time_, calendar=cal, leap=leap, note=note, check=check)

def plus(s, minutes):
    t = datetime.strptime(s, "%Y-%m-%d %H:%M") + timedelta(minutes=minutes)
    return t.strftime("%Y-%m-%d"), t.strftime("%H:%M")

def term_input(year, name, delta):
    s = SOLAR_TERMS[str(year)][name]
    base = f"{year}-{s[0:2]}-{s[3:5]} {s[7:9]}:{s[10:12]}"
    return plus(base, delta)

cases = []
A = [("1921-03-15","10:00"),("1928-07-14","14:00"),("1933-11-25","06:00"),("1939-01-16","20:00"),
     ("1942-05-26","12:00"),("1947-11-14","04:00"),("1953-12-14","16:00"),("1962-04-25","08:00"),
     ("1966-08-16","22:00"),("1971-10-13","02:00"),("1975-02-26","18:00"),("1979-06-15","10:00"),
     ("1983-03-24","14:00"),("1990-12-16","06:00"),("1994-07-26","20:00"),("1999-09-25","12:00"),
     ("2003-01-26","04:00"),("2008-05-14","16:00"),("2011-11-15","08:00"),("2012-08-14","22:00")]
for i, (d, t) in enumerate(A, 1):
    cases.append(C(f"A-{i:02d}", "general", d, t))

B = [2005, 2009, 2012, 2014, 2017]
n = 1
for y in B:
    for delta in (-2, 2):
        d, t = term_input(y, "입춘", delta)
        cases.append(C(f"B-{n:02d}", "ipchun", d, t, note=f"{y} 입춘 {'-' if delta<0 else '+'}2분"))
        n += 1

Cterms = [("경칩",2004),("청명",2006),("입하",2007),("망종",2008),("소서",2010),("입추",2011),
          ("백로",2013),("한로",2015),("입동",2016),("대설",2014),("소한",2013)]
n = 1
for name, y in Cterms:
    for delta in (-2, 2):
        d, t = term_input(y, name, delta)
        extra = " (월주만 바뀌고 연주는 그대로)" if name == "소한" else ""
        if name == "한로": extra = " (23:30 이후라 일주도 다음 날)"
        cases.append(C(f"C-{n:02d}", "jeolgi", d, t, note=f"{y} {name} {'-' if delta<0 else '+'}2분{extra}"))
        n += 1

Dl = [("1985-03-12","23:29","해시, 당일 일주"),("1985-03-12","23:30","자시, 다음 날 일주"),
      ("1985-03-12","23:59","자시, 다음 날 일주"),("1985-03-13","00:00","D-02와 같은 일주·시주"),
      ("1985-03-13","01:29","자시, 당일 일주"),("2005-10-18","23:29","해시, 당일 일주"),
      ("2005-10-18","23:30","자시, 다음 날 일주"),("2005-10-19","00:15","D-07과 같은 일주"),
      ("1999-12-31","23:45","일주는 2000-01-01, 연주·월주는 그대로"),
      ("2009-02-03","23:45","일주는 2월 4일, 입춘(02-04 01:50) 전이라 연주·월주는 그대로")]
for i, (d, t, chk) in enumerate(Dl, 1):
    cases.append(C(f"D-{i:02d}", "day_boundary", d, t, check=chk))

n = 1
for h in range(1, 22, 2):
    for t in (f"{h:02d}:29", f"{h:02d}:30"):
        cases.append(C(f"E-{n:02d}", "hour_boundary", "1997-04-15", t)); n += 1

Fl = [("1987-07-15","12:00","서머타임 적용 (UTC+10 → 기준시 10:30, 사시)"),
      ("1988-08-20","10:15","서머타임을 빼먹으면 사시, 제대로 하면 진시"),
      ("1987-05-10","01:59","서머타임 시작 직전"),("1987-05-10","03:00","서머타임 시작 직후"),
      ("1987-05-10","02:30","존재하지 않는 시각 → NONEXISTENT_TIME (D-037)"),
      ("1987-10-11","02:10","두 번 있는 시각 → 서머타임 쪽(기준시 00:40, 자시), ambiguousTime (D-038). 표준시 쪽이면 축시라 규칙을 구분함"),
      ("1956-06-15","11:40","UTC+9:30 서머타임. 빼먹으면 오시, 제대로 하면 사시"),
      ("1949-07-15", "12:00", "1949년 서머타임(4/3~9/10, UTC+10) → 기준시 10:30, 사시")]
for i, (d, t, chk) in enumerate(Fl, 1):
    cases.append(C(f"F-{i:02d}", "dst", d, t, check=chk))

Gl = [("1954-03-20","23:40","1954-03-21 00:00에 시계를 23:30으로 늦춰 23:30~23:59가 두 번 있음 → 앞쪽(UTC+9), 기준시 23:10, 다음 날 일주, ambiguousTime"),
      ("1954-03-22","23:10","UTC+8:30 → 기준시 23:10, 다음 날 일주"),
      ("1958-01-10","01:10","기준시 01:10 → 축시"),
      ("1960-11-15","23:20","다음 날 일주"),
      ("1961-08-09","12:00","UTC+8:30 마지막 날"),
      ("1961-08-10","12:00","UTC+9로 돌아온 날 (00:00~00:29는 없는 시각)")]
for i, (d, t, chk) in enumerate(Gl, 1):
    cases.append(C(f"G-{i:02d}", "utc830", d, t, check=chk))

Hl = [("1925-01-01","10:00"),("1950-10-15","14:00"),("1965-12-29","06:00"),("1972-05-05","20:00"),
      ("1984-01-15","12:00"),("1993-09-09","16:00"),("2000-04-08","08:00"),("2010-12-30","22:00")]
for i, (d, t) in enumerate(Hl, 1):
    cases.append(C(f"H-{i:02d}", "lunar", d, t, cal="lunar"))

Il = [("1995-08-10",""),("2001-04-10",""),("2004-02-10",""),("2006-07-10",""),("2012-03-10",""),
      ("1990-01-10","그 해에 없는 윤달 → NO_SUCH_LEAP_MONTH")]
for i, (d, chk) in enumerate(Il, 1):
    cases.append(C(f"I-{i:02d}", "leap_month", d, "12:00", cal="lunar", leap=True, check=chk))

Jl = [("J-01","1985-03-12","solar",False,"시주 null"),
      ("J-02","1999-12-31","solar",False,"일주는 12-31 그대로"),
      ("J-03","2009-02-04","solar",False,"입춘 당일 → 정오 기준, solarTermDay (D-036)"),
      ("J-04","2013-09-07","solar",False,"백로 당일 → 정오 기준, solarTermDay (D-036)"),
      ("J-05","1956-06-15","solar",False,"서머타임 기간이어도 영향 없음"),
      ("J-06","2001-04-10","lunar",True,"음력 + 윤달 + 시간 모름")]
for id_, d, cal, leap, chk in Jl:
    cases.append(C(id_, "hour_unknown", d, None, cal=cal, leap=leap, check=chk))

cases += [C("K-01","range","1920-01-01","12:00",check="입춘 전이라 연주는 1919년 쪽"),
          C("K-02","range","1919-12-31","12:00",check="OUT_OF_RANGE"),
          C("K-03","range","1990-02-30","12:00",check="INVALID_DATE"),
          C("K-04","range","2012-12-31","23:45",check="일주는 2013-01-01"),
          C("K-05","range","2051-01-01",None,check="일진 OUT_OF_RANGE")]
Ll = ["2026-01-01","2026-02-04","2027-07-15","2030-12-31","2040-02-29","2050-12-31"]
for i, d in enumerate(Ll, 1):
    cases.append(C(f"L-{i:02d}", "iljin", d, None))

assert len(cases) == 129, len(cases)

# ---------- evaluation ----------
JEOL_DAYS = {}  # (year) -> {name: date} for solarTermDay detection (only known years)
def is_term_day(d):
    for name in JEOL:
        s = SOLAR_TERMS.get(str(d.year), {}).get(name)
        if s and int(s[0:2]) == d.month and int(s[3:5]) == d.day:
            return name
    return None

def evaluate(c, iljin):
    out = dict(referenceTime=None, solarDate=None, pillars=None,
               flags=dict(solarTermDay=False, ambiguousTime=False), error=None)
    basis = []
    # errors
    if c["check"] == "OUT_OF_RANGE" or c["check"] == "일진 OUT_OF_RANGE":
        out["error"] = "OUT_OF_RANGE"; return out, ["지원 범위 D-035"]
    if c["check"] == "INVALID_DATE":
        out["error"] = "INVALID_DATE"; return out, []
    # solar date
    if c["calendar"] == "lunar":
        key = f"{c['date']}|{1 if c['leap'] else 0}"
        if key not in LUNAR:
            out["error"] = "NO_SUCH_LEAP_MONTH"; return out, ["KASI 음양력 변환: 해당 윤달 없음"]
        solar = LUNAR[key]; basis.append(f"KASI 음→양 {c['date']}{' 윤' if c['leap'] else ''} → {solar}")
    else:
        solar = c["date"]
    out["solarDate"] = solar
    sd = datetime.strptime(solar, "%Y-%m-%d").date()

    if c["category"] == "iljin":
        out["pillars"] = dict(year=None, month=None, day=iljin[solar], hour=None)
        basis.append(f"KASI 일진 {solar}")
        return out, basis

    hour_unknown = c["time"] is None
    tstr = "12:00" if hour_unknown else c["time"]
    local = datetime.strptime(f"{solar} {tstr}", "%Y-%m-%d %H:%M")
    status, off, offnote = utc_offset(local)
    if status == "nonexistent":
        out["error"] = "NONEXISTENT_TIME"; return out, ["IANA tz Asia/Seoul: 시계를 앞당겨 없는 시각"]
    if status == "ambiguous" and not hour_unknown:
        out["flags"]["ambiguousTime"] = True; offnote += " (두 번 있는 시각, 먼저 지나간 쪽, D-038)"
    if offnote: basis.append(offnote)
    utc = local - off
    ref = utc + REF
    ym_date = sd
    yi, mi, b = year_month(utc, ym_date)
    basis += b
    if hour_unknown:
        dday = sd
        tn = is_term_day(sd)
        if tn: out["flags"]["solarTermDay"] = True; basis.append(f"{tn} 당일, 정오 기준 (D-036)")
        hour = None
        out["referenceTime"] = None
    else:
        shifted = ref + H
        dday = shifted.date()
        br = shifted.hour // 2
        di_gz = iljin[dday.isoformat()]
        dstem = STEMS.index(di_gz[0])
        hstem = ((dstem % 5) * 2 + br) % 10
        hour = STEMS[hstem] + BRANCHES[br]
        out["referenceTime"] = ref.strftime("%Y-%m-%dT%H:%M+08:30")
    day = iljin[dday.isoformat()]
    basis.append(f"KASI 일진 {dday.isoformat()}")
    out["pillars"] = dict(year=gz(yi), month=gz(mi), day=day, hour=hour)
    return out, basis

def needed_dates():
    ds = set()
    for c in cases:
        if c["check"] in ("OUT_OF_RANGE", "일진 OUT_OF_RANGE", "INVALID_DATE"): continue
        if c["calendar"] == "lunar":
            key = f"{c['date']}|{1 if c['leap'] else 0}"
            if key not in LUNAR: continue
            solar = LUNAR[key]
        else:
            solar = c["date"]
        sd = datetime.strptime(solar, "%Y-%m-%d").date()
        ds.add(sd); ds.add(sd + timedelta(days=1)); ds.add(sd - timedelta(days=1))
    return sorted(ds)

if __name__ == "__main__":
    if sys.argv[1] == "dates":
        print(json.dumps([d.isoformat() for d in needed_dates()]))
    else:
        iljin = json.load(open(os.path.join(HERE, "kasi_iljin.json")))
        # validate Meeus against KASI official times
        errs = []
        for y, terms in SOLAR_TERMS.items():
            for name in terms:
                errs.append(abs((meeus_term_utc(int(y), name) - term_instant_utc(int(y), name)).total_seconds()) / 60)
        print(f"Meeus vs KASI (n={len(errs)}): max {max(errs):.1f} min, mean {sum(errs)/len(errs):.1f} min")
        # cross-check KASI 일진 against JDN formula
        bad = [d for d, g in iljin.items() if jdn_iljin(datetime.strptime(d, "%Y-%m-%d").date()) != g]
        print("JDN mismatches:", bad)
        result = []
        for c in cases:
            exp, basis = evaluate(c, iljin)
            inp = dict(calendar=c["calendar"], date=c["date"], time=c["time"],
                       isLeapMonth=c["leap"], hourUnknown=c["time"] is None)
            result.append(dict(id=c["id"], category=c["category"], input=inp,
                               expected=exp, check=c["check"] or c["note"], basis=basis,
                               sources=["KASI astro.kasi.re.kr (월력요항 24절기, 음양력 변환 /life/solc, /life/lunc)",
                                        "연·월·시 간지: 60갑자 순환, 월두법, 시두법"],
                               crossChecked=None, checkedAt="2026-11-24"))
        json.dump(dict(version=1, rules=["D-032","D-033","D-034","D-035","D-036","D-037","D-038"],
                       cases=result), open(sys.argv[2], "w"), ensure_ascii=False, indent=2)
        secha = json.load(open(os.path.join(HERE, "kasi_secha.json")))
        print("year pillar != KASI 세차 (expected only Jan~Feb, between 입춘 and 설날):")
        for r in result:
            e = r["expected"]
            if e and e.get("pillars") and e["pillars"]["year"] and secha.get(e["solarDate"]) != e["pillars"]["year"]:
                print("  ", r["id"], e["solarDate"], e["pillars"]["year"], "vs", secha.get(e["solarDate"]))
        for r in result:
            e = r["expected"]
            print(r["id"], r["input"]["date"], r["input"]["time"], "->",
                  None if e is None else (e["error"] or (e["solarDate"], e["referenceTime"], e["pillars"], e["flags"])))
