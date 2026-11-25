-- 0001 초기 스키마 (docs/09 §2, F14·F02·F05~F10·F13)
-- 이전 코드와도 동작하게 쓴다: 칼럼·테이블은 추가만, 삭제는 다음 배포에서 (docs/15 §7)
-- 시각은 모두 ISO 8601 UTC 문자열 (예: 2026-11-25T03:00:00.000Z), 날짜는 한국 시간 YYYY-MM-DD

-- 익명 계정 (F14). 기기 토큰 원문은 저장하지 않고 sha256만 둔다
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  -- 나중에 카카오 로그인을 붙일 때 쓴다 (docs/09 §1)
  auth_provider TEXT,
  status TEXT NOT NULL DEFAULT 'active'
);
-- 보관 기간 2년 정리용 (docs/09 §4)
CREATE INDEX IF NOT EXISTS users_last_seen ON users (last_seen_at);

-- IP당 하루 계정 생성 수 (F14). IP는 날짜를 섞은 해시만 저장
CREATE TABLE IF NOT EXISTS account_creations (
  ip_hash TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, date)
);

-- 프로필 (F02). birth_enc = base64(iv 12바이트 + AES-GCM 암호문),
-- 평문은 JSON { birthDate, isLeapMonth, birthTime } (docs/09 §4)
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  calendar TEXT NOT NULL,
  birth_enc TEXT NOT NULL,
  key_version INTEGER NOT NULL,
  gender TEXT NOT NULL,
  age_band TEXT NOT NULL,
  -- 고칠 때마다 1씩 올린다. 사주 정밀 seed에 들어간다 (F05)
  profile_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- 하루 LLM 호출 수 (사용자당 30회, 분류 포함, D-057)
CREATE TABLE IF NOT EXISTS daily_usage (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  llm_calls INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

-- 점 결과 (F10). 실패한 결과는 저장하지 않는다 (docs/04 §9)
CREATE TABLE IF NOT EXISTS readings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  shop TEXT NOT NULL,
  product TEXT NOT NULL,
  seed_key TEXT NOT NULL,
  input_json TEXT NOT NULL,
  visual_json TEXT NOT NULL,
  output_json TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, seed_key)
);
CREATE INDEX IF NOT EXISTS readings_user_created ON readings (user_id, created_at DESC);

-- requestId 중복 방지 (docs/15 §3). reading_id가 NULL이면 처리 중
CREATE TABLE IF NOT EXISTS request_log (
  request_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reading_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS request_log_user ON request_log (user_id, created_at);

-- 꿈 검사 결과 (F08). 10분 동안 유효
CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  symbols_json TEXT NOT NULL,
  risk TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS checks_user_created ON checks (user_id, created_at);

-- 오늘의 운세 실시간 생성 잠금 (F13): 먼저 넣은 요청만 생성한다
CREATE TABLE IF NOT EXISTS daily_gen (
  date TEXT NOT NULL,
  stem TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (date, stem)
);
