-- 족집게집 "나는 어떤 사람" 섹션별 맞아요/아니에요 표시 (F19, D-100, docs/09 §2)
-- {"surface":"yes","inner":"no"} 꼴. 다른 상품은 NULL
ALTER TABLE readings ADD COLUMN marks_json TEXT;
