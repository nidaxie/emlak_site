-- DRAFT is additive. Existing PENDING, APPROVED, and REJECTED rows stay as they are.
-- The status default remains PENDING. Current application creation still submits immediately.
ALTER TYPE "ApplicationStatus" ADD VALUE 'DRAFT';

ALTER TABLE "agent_applications" ADD COLUMN "submittedAt" TIMESTAMP(3);

-- Applications that already exist were submitted when they were created.
UPDATE "agent_applications"
SET "submittedAt" = "createdAt"
WHERE "status" IN ('PENDING', 'APPROVED', 'REJECTED')
  AND "submittedAt" IS NULL;
