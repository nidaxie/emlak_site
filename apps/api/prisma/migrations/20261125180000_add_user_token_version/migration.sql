-- Existing rows stay at 0. Access tokens issued before this column
-- have no ver claim and are treated as version 0, so they remain valid
-- until the account is deactivated.
ALTER TABLE "users" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
