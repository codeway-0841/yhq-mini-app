CREATE TABLE "job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"period_key" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "uq_job_run_period" UNIQUE("job_name","period_key")
);
