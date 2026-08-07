ALTER TABLE "saved_questions" DROP CONSTRAINT "uq_saved";--> statement-breakpoint
ALTER TABLE "saved_questions" ADD COLUMN "subject_id" text DEFAULT 'yhq' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_questions" ADD CONSTRAINT "uq_saved" UNIQUE("user_id","subject_id","question_id");--> statement-breakpoint
-- DATA MIGRATION (multi-fan identity): wrong_by_ticket kalitlari tekis ('123')
-- formatdan composite ('yhq:123') formatga o'tkaziladi. Allaqachon ':' li
-- kalitlar tegilmaydi (idempotent — qayta ishga tushsa ham xavfsiz).
UPDATE "progress" SET "wrong_by_ticket" = COALESCE((
  SELECT jsonb_object_agg(
    CASE WHEN k LIKE '%:%' THEN k ELSE 'yhq:' || k END,
    v
  )
  FROM jsonb_each("wrong_by_ticket") AS t(k, v)
), '{}'::jsonb)
WHERE "wrong_by_ticket" <> '{}'::jsonb;