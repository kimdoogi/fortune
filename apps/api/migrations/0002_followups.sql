-- 이어 묻기 (F15, docs/09 §2). 풀이를 지우면 함께 지운다 (코드에서)
-- answer_json: 모델 출력 문자열 그대로. 다음 이어 묻기에 같은 바이트로 다시 보내 캐시를 탄다 (docs/04 §13)
CREATE TABLE IF NOT EXISTS reading_followups (
  id TEXT PRIMARY KEY,
  reading_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  prompt_version TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_followups_reading ON reading_followups (reading_id, created_at);
CREATE INDEX IF NOT EXISTS idx_followups_user ON reading_followups (user_id);
