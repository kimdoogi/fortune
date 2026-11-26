-- 당산나무 소원 (F18, D-099, docs/09 §2). 글은 본인과 같이 묶은 사람만 본다
CREATE TABLE IF NOT EXISTS wishes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  with_user_id TEXT,
  with_nickname TEXT,
  by_nickname TEXT NOT NULL,
  text TEXT NOT NULL,
  color TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL,
  outcome TEXT,
  outcome_at TEXT
);
-- 사람마다 하루 한 번
CREATE UNIQUE INDEX IF NOT EXISTS idx_wishes_user_day ON wishes (user_id, day);
CREATE INDEX IF NOT EXISTS idx_wishes_with ON wishes (with_user_id);
CREATE INDEX IF NOT EXISTS idx_wishes_created ON wishes (created_at);

-- 돌 올리기: 사람마다 하루 한 번
CREATE TABLE IF NOT EXISTS wish_stones (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS idx_wish_stones_day ON wish_stones (day);
