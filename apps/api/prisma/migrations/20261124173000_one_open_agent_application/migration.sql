-- One editable or in-review application per user.
-- APPROVED and REJECTED rows stay unrestricted, so application history is kept.
-- The older PENDING-only index remains in place.
CREATE UNIQUE INDEX "agent_applications_one_open_per_user"
ON "agent_applications"("userId")
WHERE "status" IN ('DRAFT', 'PENDING');
