-- Leaderboard ORDER BY total_correct DESC LIMIT N tezligi uchun
CREATE INDEX IF NOT EXISTS "idx_progress_total_correct" ON "progress" ("total_correct" DESC);
