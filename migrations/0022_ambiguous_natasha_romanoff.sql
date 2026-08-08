CREATE TABLE "question_banks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Banka id = shared/subjects.ts dagi dataSourceId (yagona manba).
-- Yangi fan bazasi qo'shilganda yangi migratsiyada shunga o'xshash INSERT kerak.
INSERT INTO "question_banks" ("id", "name") VALUES ('traffic_rules_db', 'YHQ savollar bazasi')
	ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "bank_id" text DEFAULT 'traffic_rules_db' NOT NULL;--> statement-breakpoint
-- external_id: mavjud qatorlar uchun backfill kerak — avval DEFAULT bilan,
-- keyin id::text bilan to'ldirib, DEFAULT'ni olib tashlaymiz.
ALTER TABLE "questions" ADD COLUMN "external_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "questions" SET "external_id" = "id"::text WHERE "external_id" = '';--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "external_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "bank_id" text DEFAULT 'traffic_rules_db' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_bank_id_question_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_bank_id_question_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."question_banks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_questions_bank_topic" ON "questions" USING btree ("bank_id","topic_id");--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "uq_question_external" UNIQUE("bank_id","external_id");