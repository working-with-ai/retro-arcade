CREATE TABLE IF NOT EXISTS maintenance_cursors (
 prefix TEXT PRIMARY KEY, cursor TEXT NOT NULL
);

DROP TRIGGER IF EXISTS upload_quota;
CREATE TRIGGER upload_quota BEFORE INSERT ON uploads BEGIN
 SELECT CASE WHEN
  COALESCE((SELECT SUM(size) FROM saves WHERE user_id=NEW.user_id),0)
  + COALESCE((SELECT SUM(u.size-COALESCE(s.size,0)) FROM uploads u LEFT JOIN saves s ON s.user_id=u.user_id AND s.game_id=u.game_id AND s.slot_id=u.slot_id WHERE u.user_id=NEW.user_id),0)
  + NEW.size-COALESCE((SELECT size FROM saves WHERE user_id=NEW.user_id AND game_id=NEW.game_id AND slot_id=NEW.slot_id),0)
  > COALESCE((SELECT max_bytes FROM membership_limits WHERE tier=CASE WHEN (SELECT member_until FROM users WHERE id=NEW.user_id)>unixepoch()*1000 THEN 'member' ELSE 'free' END),0)
 THEN RAISE(ABORT,'QUOTA_BYTES') END;
 SELECT CASE WHEN
  (SELECT COUNT(*) FROM saves WHERE user_id=NEW.user_id)
  +(SELECT COUNT(*) FROM uploads u WHERE user_id=NEW.user_id AND NOT EXISTS(SELECT 1 FROM saves s WHERE s.user_id=u.user_id AND s.game_id=u.game_id AND s.slot_id=u.slot_id))
  +CASE WHEN EXISTS(SELECT 1 FROM saves WHERE user_id=NEW.user_id AND game_id=NEW.game_id AND slot_id=NEW.slot_id) THEN 0 ELSE 1 END
  > COALESCE((SELECT max_saves FROM membership_limits WHERE tier=CASE WHEN (SELECT member_until FROM users WHERE id=NEW.user_id)>unixepoch()*1000 THEN 'member' ELSE 'free' END),0)
 THEN RAISE(ABORT,'QUOTA_COUNT') END;
END;
