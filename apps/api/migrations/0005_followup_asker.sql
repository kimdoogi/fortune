-- 같이 본 풀이의 이어 묻기 (F16, D-091, docs/09 §2): 물은 사람 닉네임.
-- 같이 본 풀이는 상대 풀이에도 같은 문답을 넣는다 (user_id = 물은 사람)
ALTER TABLE reading_followups ADD COLUMN asker TEXT;
