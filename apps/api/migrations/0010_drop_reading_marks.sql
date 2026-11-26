-- D-101: 족집게집 맞아요/아니에요를 뺐다. D-100의 표시 칸을 지운다 (코드는 6c36ac7부터 이 칸을 읽지 않음)
ALTER TABLE readings DROP COLUMN marks_json;
