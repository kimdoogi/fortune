-- 궁합 초대 (F16, D-089, docs/09 §2). 30분 안에 참여 없으면 만료, 참여 뒤 3시간 유효 (코드에서 검사)
CREATE TABLE IF NOT EXISTS gunghap_invites (
  code TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  guest_id TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  relation TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gunghap_host ON gunghap_invites (host_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gunghap_guest ON gunghap_invites (guest_id);
