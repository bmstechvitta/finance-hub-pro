-- ============================================================================
-- COMPLETE DATABASE RESET AND ADMIN USER SETUP
-- ============================================================================
-- Email: info@ncharudhsolutions.com
-- Password: Chakri@2555
-- Company: Ncharudhsolutions
-- Role: super_admin
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Run this entire script (Steps 1-2) first
-- 2. Create user via Supabase Dashboard (Step 3 instructions below)
-- 3. Run the second script (step_4_create_user_profile.sql) after getting user UUID
-- ============================================================================

-- ============================================================================
-- STEP 1: DISABLE TRIGGER AND DELETE ALL DATA
-- ============================================================================
-- Disable the trigger that auto-creates profiles (we'll handle it manually)
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

SET session_replication_role = 'replica';

-- Delete all data from all tables (in order to respect foreign keys)
TRUNCATE TABLE public.quotation_milestones CASCADE;
TRUNCATE TABLE public.quotation_deliverables CASCADE;
TRUNCATE TABLE public.quotation_technical_scope CASCADE;
TRUNCATE TABLE public.quotation_items CASCADE;
TRUNCATE TABLE public.quotations CASCADE;
TRUNCATE TABLE public.service_templates CASCADE;
TRUNCATE TABLE public.expense_approval_actions CASCADE;
TRUNCATE TABLE public.expense_approvals CASCADE;
TRUNCATE TABLE public.approval_chain_levels CASCADE;
TRUNCATE TABLE public.approval_chains CASCADE;
TRUNCATE TABLE public.anomaly_reviews CASCADE;
TRUNCATE TABLE public.anomaly_detection_settings CASCADE;
TRUNCATE TABLE public.expense_policy_violations CASCADE;
TRUNCATE TABLE public.expense_policies CASCADE;
TRUNCATE TABLE public.expense_delegations CASCADE;
TRUNCATE TABLE public.recurring_expenses CASCADE;
TRUNCATE TABLE public.department_budgets CASCADE;
TRUNCATE TABLE public.invoice_items CASCADE;
TRUNCATE TABLE public.invoices CASCADE;
TRUNCATE TABLE public.expenses CASCADE;
TRUNCATE TABLE public.receipt_categories CASCADE;
TRUNCATE TABLE public.receipts CASCADE;
TRUNCATE TABLE public.payslips CASCADE;
TRUNCATE TABLE public.employees CASCADE;
TRUNCATE TABLE public.expense_categories CASCADE;
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.profiles CASCADE;

-- Delete auth users (if you have proper privileges)
-- If this fails, delete users manually via Supabase Dashboard > Authentication > Users
DELETE FROM auth.users;

-- Delete companies
TRUNCATE TABLE public.companies CASCADE;

SET session_replication_role = 'origin';

-- ============================================================================
-- STEP 2: CREATE COMPANY
-- ============================================================================
INSERT INTO public.companies (
  name,
  email,
  currency,
  created_at,
  updated_at
) VALUES (
  'Ncharudhsolutions',
  'info@ncharudhsolutions.com',
  'INR',
  now(),
  now()
);

-- ============================================================================
-- STEP 3: CREATE USER VIA SUPABASE DASHBOARD (MANUAL STEP)
-- ============================================================================
-- IMPORTANT: The trigger is now DISABLED, so you can create the user safely.
-- The trigger won't try to auto-create the profile (which was causing the error).
--
-- 1. Go to: Supabase Dashboard > Authentication > Users
-- 2. Click: "Add User" > "Create new user"
-- 3. Email: info@ncharudhsolutions.com
-- 4. Password: Chakri@2555
-- 5. Check: "Auto Confirm User"
-- 6. Click: "Create User" (should work now without errors!)
-- 7. Copy the User UID (it's shown in the user list - looks like: 12345678-1234-1234-1234-123456789abc)
-- 8. Run the next script: step_4_create_user_profile.sql (with your UUID)
-- 9. After step 4, you can optionally re-enable the trigger (see below)
-- ============================================================================

-- ============================================================================
-- OPTIONAL: Re-enable trigger after creating the admin user
-- ============================================================================
-- Uncomment this line after you've created the admin user and profile:
-- ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
-- ============================================================================
