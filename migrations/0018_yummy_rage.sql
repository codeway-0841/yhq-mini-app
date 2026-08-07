ALTER TABLE "daily_records" ADD CONSTRAINT "chk_daily_record_nonnegative" CHECK ("daily_records"."answered" >= 0 AND "daily_records"."fixed" >= 0);--> statement-breakpoint
ALTER TABLE "daily_records" ADD CONSTRAINT "chk_daily_record_correct_le" CHECK ("daily_records"."correct" BETWEEN 0 AND "daily_records"."answered");--> statement-breakpoint
ALTER TABLE "daily_records" ADD CONSTRAINT "chk_daily_record_date_fmt" CHECK ("daily_records"."date" ~ '^\d{4}-\d{2}-\d{2}$');--> statement-breakpoint
ALTER TABLE "daily_streaks" ADD CONSTRAINT "chk_daily_streak_nonnegative" CHECK ("daily_streaks"."streak" >= 0);--> statement-breakpoint
ALTER TABLE "daily_streaks" ADD CONSTRAINT "chk_daily_streak_date_fmt" CHECK ("daily_streaks"."last_daily_date" IS NULL OR "daily_streaks"."last_daily_date" ~ '^\d{4}-\d{2}-\d{2}$');--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "chk_progress_nonnegative" CHECK (
    "progress"."total_correct" >= 0 AND "progress"."total_wrong" >= 0 AND "progress"."total_answered" >= 0
    AND "progress"."streak" >= 0 AND "progress"."octagon_wins" >= 0
  );--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "chk_progress_sum" CHECK ("progress"."total_answered" = "progress"."total_correct" + "progress"."total_wrong");--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "chk_progress_league" CHECK ("progress"."league" IN ('bronze', 'silver', 'gold', 'platinum'));