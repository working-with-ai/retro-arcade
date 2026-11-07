PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, phone_key TEXT NOT NULL UNIQUE, phone_enc TEXT NOT NULL,
 nickname TEXT NOT NULL, created_at INTEGER NOT NULL, member_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS sms_codes (id TEXT PRIMARY KEY, phone_key TEXT NOT NULL, code_hash TEXT NOT NULL, phone_enc TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS sms_phone ON sms_codes(phone_key,created_at);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (user_id TEXT PRIMARY KEY REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 1, value TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS saves (user_id TEXT NOT NULL REFERENCES users(id), game_id TEXT NOT NULL, slot_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, label TEXT NOT NULL, created_at INTEGER NOT NULL, seconds INTEGER NOT NULL DEFAULT 0, operation_id TEXT NOT NULL UNIQUE, PRIMARY KEY(user_id,game_id,slot_id));
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), game_id TEXT NOT NULL, slot_id TEXT NOT NULL, object_key TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL, UNIQUE(user_id,game_id,slot_id));
CREATE TRIGGER IF NOT EXISTS upload_quota BEFORE INSERT ON uploads BEGIN
 SELECT CASE WHEN
  COALESCE((SELECT SUM(size) FROM saves WHERE user_id=NEW.user_id),0)
  + COALESCE((SELECT SUM(u.size-COALESCE(s.size,0)) FROM uploads u LEFT JOIN saves s ON s.user_id=u.user_id AND s.game_id=u.game_id AND s.slot_id=u.slot_id WHERE u.user_id=NEW.user_id),0)
  + NEW.size-COALESCE((SELECT size FROM saves WHERE user_id=NEW.user_id AND game_id=NEW.game_id AND slot_id=NEW.slot_id),0)
  > CASE WHEN (SELECT member_until FROM users WHERE id=NEW.user_id)>unixepoch()*1000 THEN 1073741824 ELSE 104857600 END
 THEN RAISE(ABORT,'QUOTA_BYTES') END;
 SELECT CASE WHEN
  (SELECT COUNT(*) FROM saves WHERE user_id=NEW.user_id)
  +(SELECT COUNT(*) FROM uploads u WHERE user_id=NEW.user_id AND NOT EXISTS(SELECT 1 FROM saves s WHERE s.user_id=u.user_id AND s.game_id=u.game_id AND s.slot_id=u.slot_id))
  +CASE WHEN EXISTS(SELECT 1 FROM saves WHERE user_id=NEW.user_id AND game_id=NEW.game_id AND slot_id=NEW.slot_id) THEN 0 ELSE 1 END
  > CASE WHEN (SELECT member_until FROM users WHERE id=NEW.user_id)>unixepoch()*1000 THEN 3000 ELSE 300 END
 THEN RAISE(ABORT,'QUOTA_COUNT') END;
END;
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), product TEXT NOT NULL, amount INTEGER NOT NULL, duration INTEGER NOT NULL, channel TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, paid_at INTEGER, transaction_id TEXT UNIQUE, payment TEXT, needs_review INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id,created_at);
CREATE TABLE IF NOT EXISTS grants (order_id TEXT PRIMARY KEY REFERENCES orders(id), user_id TEXT NOT NULL REFERENCES users(id), paid_at INTEGER NOT NULL, duration INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0);
CREATE TRIGGER IF NOT EXISTS grant_added AFTER INSERT ON grants BEGIN
 UPDATE users SET member_until=COALESCE((SELECT MAX(paid_at+remaining) FROM (SELECT paid_at,SUM(duration) OVER(ORDER BY paid_at,order_id ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) remaining FROM grants WHERE user_id=NEW.user_id AND revoked=0)),0) WHERE id=NEW.user_id;
END;
CREATE TRIGGER IF NOT EXISTS grant_revoked AFTER UPDATE OF revoked ON grants BEGIN
 UPDATE users SET member_until=COALESCE((SELECT MAX(paid_at+remaining) FROM (SELECT paid_at,SUM(duration) OVER(ORDER BY paid_at,order_id ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING) remaining FROM grants WHERE user_id=NEW.user_id AND revoked=0)),0) WHERE id=NEW.user_id;
END;
CREATE TABLE IF NOT EXISTS oauth_states (hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, order_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payment_events (id TEXT PRIMARY KEY, kind TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS relays (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), game_id TEXT NOT NULL, fingerprint TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ended_at INTEGER, head_seq INTEGER NOT NULL DEFAULT -1, lease_owner TEXT, lease_hash TEXT, lease_until INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS relay_list ON relays(status,created_at);
CREATE TABLE IF NOT EXISTS relay_steps (id TEXT PRIMARY KEY, relay_id TEXT NOT NULL REFERENCES relays(id), seq INTEGER NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), object_key TEXT NOT NULL UNIQUE, size INTEGER NOT NULL, sha256 TEXT NOT NULL, lease_hash TEXT, created_at INTEGER NOT NULL, UNIQUE(relay_id,seq));
CREATE TRIGGER IF NOT EXISTS relay_daily BEFORE INSERT ON relays BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM relays WHERE user_id=NEW.user_id AND created_at>NEW.created_at-86400000)>=3 THEN RAISE(ABORT,'RELAY_DAILY_LIMIT') END;
END;
CREATE TRIGGER IF NOT EXISTS step_guard BEFORE INSERT ON relay_steps BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM relays r WHERE r.id=NEW.relay_id AND r.status='active' AND r.expires_at>NEW.created_at AND r.head_seq+1=NEW.seq AND NEW.seq<=50 AND ((NEW.seq=0 AND r.user_id=NEW.user_id) OR (r.lease_owner=NEW.user_id AND r.lease_hash=NEW.lease_hash AND r.lease_until>NEW.created_at))) THEN RAISE(ABORT,'RELAY_CONFLICT') END;
END;
CREATE TRIGGER IF NOT EXISTS step_advance AFTER INSERT ON relay_steps BEGIN
 UPDATE relays SET head_seq=NEW.seq,lease_owner=NULL,lease_hash=NULL,lease_until=0 WHERE id=NEW.relay_id;
END;
CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, relay_id TEXT NOT NULL REFERENCES relays(id), user_id TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(relay_id,user_id));
CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
