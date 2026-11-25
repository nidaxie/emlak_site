-- Change only the column default. Existing status values stay as they are.
ALTER TABLE "agent_applications" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
