-- CreateEnum
CREATE TYPE "CompensationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PayComponentType" AS ENUM ('BASE_SALARY', 'FIXED_ALLOWANCE', 'VARIABLE_ALLOWANCE', 'POSITION_ALLOWANCE', 'ADDITIONAL_DUTY', 'ATTENDANCE_INCENTIVE', 'PERFORMANCE_INCENTIVE', 'UNIT_OR_HOURLY_HONORARIUM', 'CORRECTION');

-- CreateEnum
CREATE TYPE "CalculationMethod" AS ENUM ('FIXED', 'PERCENTAGE', 'UNIT_RATE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CompensationScenario" AS ENUM ('BASELINE', 'CONSERVATIVE', 'GROWTH', 'CUSTOM');

-- CreateTable
CREATE TABLE "compensation_factors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_grades" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "minimum_score" DECIMAL(6,2) NOT NULL,
    "maximum_score" DECIMAL(6,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_evaluations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "job_grade_id" UUID,
    "responsibility" INTEGER NOT NULL,
    "competency" INTEGER NOT NULL,
    "complexity" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "independence" INTEGER NOT NULL,
    "weighted_score" DECIMAL(6,2) NOT NULL,
    "status" "CompensationStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewer_notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE,
    "effective_date" DATE NOT NULL,
    "status" "CompensationStatus" NOT NULL DEFAULT 'DRAFT',
    "scope_key" TEXT NOT NULL DEFAULT 'ORGANIZATION',
    "minimum_wage_config" JSONB,
    "change_notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_scales" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "job_grade_id" UUID NOT NULL,
    "minimum" DECIMAL(18,2) NOT NULL,
    "midpoint" DECIMAL(18,2) NOT NULL,
    "maximum" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "basis_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_scales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_components" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PayComponentType" NOT NULL,
    "method" "CalculationMethod" NOT NULL,
    "default_value" DECIMAL(18,2),
    "effective_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "legal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_proposals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "job_grade_id" UUID NOT NULL,
    "salary_policy_id" UUID NOT NULL,
    "salary_placement" DECIMAL(18,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CompensationStatus" NOT NULL DEFAULT 'DRAFT',
    "proposed_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compensation_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_proposal_items" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "pay_component_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "notes" TEXT,

    CONSTRAINT "compensation_proposal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_cost_allocations" (
    "id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE,
    "is_incomplete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "compensation_cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_simulations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "salary_policy_id" UUID,
    "name" TEXT NOT NULL,
    "scenario" "CompensationScenario" NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "assumptions" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "total_base_salary" DECIMAL(18,2) NOT NULL,
    "total_allowances" DECIMAL(18,2) NOT NULL,
    "total_compensation" DECIMAL(18,2) NOT NULL,
    "employer_cost" DECIMAL(18,2) NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensation_approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "notes" TEXT,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensation_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compensation_factors_organization_id_key_key" ON "compensation_factors"("organization_id", "key");

-- CreateIndex
CREATE INDEX "job_grades_organization_id_is_active_idx" ON "job_grades"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "job_grades_organization_id_code_key" ON "job_grades"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "job_grades_organization_id_level_key" ON "job_grades"("organization_id", "level");

-- CreateIndex
CREATE INDEX "job_evaluations_organization_id_position_id_effective_date_idx" ON "job_evaluations"("organization_id", "position_id", "effective_date");

-- CreateIndex
CREATE INDEX "salary_policies_organization_id_status_effective_date_idx" ON "salary_policies"("organization_id", "status", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "salary_policies_organization_id_name_version_key" ON "salary_policies"("organization_id", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "salary_scales_policy_id_job_grade_id_key" ON "salary_scales"("policy_id", "job_grade_id");

-- CreateIndex
CREATE INDEX "pay_components_organization_id_is_active_effective_date_idx" ON "pay_components"("organization_id", "is_active", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "pay_components_organization_id_code_key" ON "pay_components"("organization_id", "code");

-- CreateIndex
CREATE INDEX "compensation_proposals_organization_id_employee_id_effectiv_idx" ON "compensation_proposals"("organization_id", "employee_id", "effective_date");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_proposals_organization_id_idempotency_key_key" ON "compensation_proposals"("organization_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_proposal_items_proposal_id_pay_component_id_key" ON "compensation_proposal_items"("proposal_id", "pay_component_id");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_cost_allocations_proposal_id_unit_id_period_st_key" ON "compensation_cost_allocations"("proposal_id", "unit_id", "period_start");

-- CreateIndex
CREATE INDEX "compensation_simulations_organization_id_created_at_idx" ON "compensation_simulations"("organization_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "compensation_simulations_organization_id_idempotency_key_key" ON "compensation_simulations"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "compensation_approvals_organization_id_entity_type_entity_i_idx" ON "compensation_approvals"("organization_id", "entity_type", "entity_id", "created_at");

-- AddForeignKey
ALTER TABLE "compensation_factors" ADD CONSTRAINT "compensation_factors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_grades" ADD CONSTRAINT "job_grades_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_job_grade_id_fkey" FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_policies" ADD CONSTRAINT "salary_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_policies" ADD CONSTRAINT "salary_policies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_scales" ADD CONSTRAINT "salary_scales_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "salary_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_scales" ADD CONSTRAINT "salary_scales_job_grade_id_fkey" FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_components" ADD CONSTRAINT "pay_components_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_job_grade_id_fkey" FOREIGN KEY ("job_grade_id") REFERENCES "job_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_salary_policy_id_fkey" FOREIGN KEY ("salary_policy_id") REFERENCES "salary_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposals" ADD CONSTRAINT "compensation_proposals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposal_items" ADD CONSTRAINT "compensation_proposal_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "compensation_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_proposal_items" ADD CONSTRAINT "compensation_proposal_items_pay_component_id_fkey" FOREIGN KEY ("pay_component_id") REFERENCES "pay_components"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_cost_allocations" ADD CONSTRAINT "compensation_cost_allocations_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "compensation_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_cost_allocations" ADD CONSTRAINT "compensation_cost_allocations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_simulations" ADD CONSTRAINT "compensation_simulations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_simulations" ADD CONSTRAINT "compensation_simulations_salary_policy_id_fkey" FOREIGN KEY ("salary_policy_id") REFERENCES "salary_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_simulations" ADD CONSTRAINT "compensation_simulations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_approvals" ADD CONSTRAINT "compensation_approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensation_approvals" ADD CONSTRAINT "compensation_approvals_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
