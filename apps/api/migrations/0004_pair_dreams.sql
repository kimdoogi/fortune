-- 두 사람 꿈풀이 (F16, D-090, docs/09 §2). 초대 하나에 한 사람 꿈 하나. 풀이를 만들면 지운다 (코드에서)
CREATE TABLE IF NOT EXISTS pair_dreams (
  code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  symbols_json TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL,
  PRIMARY KEY (code, user_id)
);
