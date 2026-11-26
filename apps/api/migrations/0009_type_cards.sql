-- 족집게집 내 유형 카드 링크 (F19, D-101, docs/09 §2). 한 사람에 하나, 만료 없음.
-- 닉네임·유형은 볼 때 profiles에서 읽는다. 계정 삭제 때 지운다
CREATE TABLE IF NOT EXISTS type_cards (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
