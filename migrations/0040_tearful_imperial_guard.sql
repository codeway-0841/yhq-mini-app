CREATE INDEX "idx_referrals_referrer_status" ON "referrals" USING btree ("referrer_id","status");--> statement-breakpoint
CREATE INDEX "idx_users_phone" ON "users" USING btree ("phone");