-- ============================================================================
-- RESET DATABASE AND CREATE ADMIN USER
-- ============================================================================
-- This script will:
-- 1. Delete all data from all tables
-- 2. Create a company: Ncharudhsolutions
-- 3. You need to create user manually via Supabase Dashboard, then run Part 2
-- ============================================================================

-- ============================================================================
-- PART 1: DELETE ALL DATA AND CREATE COMPANY
-- ============================================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- Delete from child tables first (respecting foreign key constraints)
DELETE FROM public.quotation_milestones;
DELETE FROM public.quotation_deliverables;
DELETE FROM public.quotation_technical_scope;
DELETE FROM public.quotation_items;
DELETE FROM public.quotations;
DELETE FROM public.service_templates;
DELETE FROM public.expense_approval_actions;
DELETE FROM public.expense_approvals;
DELETE FROM public.approval_chain_levels;
DELETE FROM public.approval_chains;
DELETE FROM public.anomaly_reviews;
DELETE FROM public.anomaly_detection_settings;
DELETE FROM public.expense_policy_violations;
DELETE FROM public.expense_policies;
DELETE FROM public.expense_delegations;
DELETE FROM public.recurring_expenses;
DELETE FROM public.department_budgets;
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;
DELETE FROM public.expenses;
DELETE FROM public.receipt_categories;
DELETE FROM public.receipts;
DELETE FROM public.payslips;
DELETE FROM public.employees;
DELETE FROM public.expense_categories;
DELETE FROM public.notifications;
DELETE FROM public.audit_logs;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- Delete all auth users (requires proper privileges)
-- If this fails, delete users manually via Supabase Dashboard
DELETE FROM auth.users;

-- Delete companies
DELETE FROM public.companies;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- ============================================================================
-- CREATE COMPANY
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
-- PART 2: CREATE USER PROFILE AND ROLE
-- ============================================================================
-- IMPORTANT: Before running Part 2, you MUST create the user via Supabase Dashboard:
--
-- Steps:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User" > "Create new user"
-- 3. Email: info@ncharudhsolutions.com
-- 4. Password: Chakri@2555
-- 5. Auto Confirm User: Yes (check the box)
-- 6. Click "Create User"
-- 7. Copy the User UID from the user list
-- 8. Replace 'USER_UUID_HERE' below with the actual UUID
-- 9. Then run the SQL below
-- ============================================================================

-- Uncomment and run this after creating the user in Supabase Dashboard:
/*
DO $$
DECLARE
  company_uuid UUID;
  user_uuid UUID := 'USER_UUID_HERE'; -- Replace with actual user UUID from Dashboard
BEGIN
  -- Get the company ID
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Ncharudhsolutions' LIMIT 1;

  -- Create profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    company_id,
    created_at,
    updated_at
  ) VALUES (
    user_uuid,
    'info@ncharudhsolutions.com',
    'Super Admin',
    company_uuid,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = 'info@ncharudhsolutions.com',
    full_name = 'Super Admin',
    company_id = company_uuid,
    updated_at = now();

  -- Assign super_admin role
  INSERT INTO public.user_roles (
    user_id,
    role,
    created_at
  ) VALUES (
    user_uuid,
    'super_admin',
    now()
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Profile and role created successfully for user: %', user_uuid;
END $$;
*/

-- ============================================================================
-- ALTERNATIVE: ALL-IN-ONE SCRIPT (if you have user UUID ready)
-- ============================================================================
-- If you already have the user UUID, uncomment and modify this section:

/*
DO $$
DECLARE
  company_uuid UUID;
  user_uuid UUID := 'PASTE_USER_UUID_HERE'; -- Get from Supabase Dashboard > Auth > Users
BEGIN
  -- Get or create company
  SELECT id INTO company_uuid FROM public.companies WHERE name = 'Ncharudhsolutions' LIMIT 1;
  
  IF company_uuid IS NULL THEN
    INSERT INTO public.companies (name, email, currency, created_at, updated_at)
    VALUES ('Ncharudhsolutions', 'info@ncharudhsolutions.com', 'INR', now(), now())
    RETURNING id INTO company_uuid;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, company_id, created_at, updated_at)
  VALUES (user_uuid, 'info@ncharudhsolutions.com', 'Super Admin', company_uuid, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = 'info@ncharudhsolutions.com', full_name = 'Super Admin', company_id = company_uuid, updated_at = now();

  -- Assign super_admin role
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (user_uuid, 'super_admin', now())
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Setup complete! Company ID: %, User ID: %', company_uuid, user_uuid;
END $$;
*/
