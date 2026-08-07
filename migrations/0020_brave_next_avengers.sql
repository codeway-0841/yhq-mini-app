CREATE TABLE "tutor_usage" (
	"user_id" bigint NOT NULL,
	"date" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "uq_tutor_usage" UNIQUE("user_id","date"),
	CONSTRAINT "chk_tutor_usage_nonnegative" CHECK ("tutor_usage"."count" >= 0),
	CONSTRAINT "chk_tutor_usage_date_fmt" CHECK ("tutor_usage"."date" ~ '^\d{4}-\d{2}-\d{2}$')
);
