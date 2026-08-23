ALTER TABLE "progress_questions" ADD COLUMN "first_ms" integer;--> statement-breakpoint
ALTER TABLE "progress_questions" ADD COLUMN "last_ms" integer;--> statement-breakpoint
ALTER TABLE "progress_questions" ADD CONSTRAINT "chk_progress_questions_ms" CHECK (
    ("progress_questions"."first_ms" IS NULL OR ("progress_questions"."first_ms" >= 0 AND "progress_questions"."first_ms" <= 600000))
    AND ("progress_questions"."last_ms" IS NULL OR ("progress_questions"."last_ms" >= 0 AND "progress_questions"."last_ms" <= 600000))
  );