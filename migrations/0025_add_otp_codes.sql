-- SMS OTP verification table
CREATE TABLE "otp_codes" (
	"phone" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_otp_codes_expires" ON "otp_codes" USING btree ("expires_at");
