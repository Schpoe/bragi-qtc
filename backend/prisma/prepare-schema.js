/**
 * Run safe column renames BEFORE prisma db push so that prisma sees the schema
 * already matches and avoids dropping + recreating columns (which loses data).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      -- Rename Allocation.percentage -> percent (old migration, kept for safety)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Allocation' AND column_name = 'percentage'
      ) THEN
        ALTER TABLE "Allocation" RENAME COLUMN "percentage" TO "percent";
      END IF;

      -- Rename QuarterlyAllocation.percentage -> percent (old migration, kept for safety)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'QuarterlyAllocation' AND column_name = 'percentage'
      ) THEN
        ALTER TABLE "QuarterlyAllocation" RENAME COLUMN "percentage" TO "percent";
      END IF;

      -- Rename Allocation.percent -> days + migrate data (old 100% ≈ 10 sprint days)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Allocation' AND column_name = 'percent'
      ) THEN
        ALTER TABLE "Allocation" RENAME COLUMN "percent" TO "days";
        UPDATE "Allocation" SET "days" = GREATEST(0, ROUND("days" / 10.0));
      END IF;

      -- Rename QuarterlyAllocation.percent -> days + migrate (old 100% = 60 quarter days)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'QuarterlyAllocation' AND column_name = 'percent'
      ) THEN
        ALTER TABLE "QuarterlyAllocation" RENAME COLUMN "percent" TO "days";
        UPDATE "QuarterlyAllocation" SET "days" = GREATEST(0, ROUND("days" * 60.0 / 100));
      END IF;

      -- Rename QuarterlyPlanHistory.old_percent -> old_days, new_percent -> new_days
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'QuarterlyPlanHistory' AND column_name = 'old_percent'
      ) THEN
        ALTER TABLE "QuarterlyPlanHistory" RENAME COLUMN "old_percent" TO "old_days";
        ALTER TABLE "QuarterlyPlanHistory" RENAME COLUMN "new_percent" TO "new_days";
        UPDATE "QuarterlyPlanHistory" SET "old_days" = ROUND("old_days" * 60.0 / 100) WHERE "old_days" IS NOT NULL;
        UPDATE "QuarterlyPlanHistory" SET "new_days" = ROUND("new_days" * 60.0 / 100) WHERE "new_days" IS NOT NULL;
      END IF;

      -- Rename TeamMember.availability_percent -> sprint_days + migrate (100% → 10 days)
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'TeamMember' AND column_name = 'availability_percent'
      ) THEN
        ALTER TABLE "TeamMember" RENAME COLUMN "availability_percent" TO "sprint_days";
        UPDATE "TeamMember" SET "sprint_days" = GREATEST(1, ROUND("sprint_days" / 10.0));
      END IF;
    END $$;
  `);
  console.log('prepare-schema: column renames done');
}

main()
  .catch(e => { console.error('prepare-schema error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
