-- 0006 캐릭터 꾸미기 (F17, D-098)
-- 코드 한 줄 `species.hair.outfit.color.acc.hairColor.tone`. NULL = 성별·나이대 기본 모습 (예전 사람은 그대로)
ALTER TABLE profiles ADD COLUMN style TEXT;
