-- Delete all data
SET session_replication_role = 'replica';

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
DELETE FROM auth.users;
TRUNCATE TABLE public.companies CASCADE;

SET session_replication_role = 'origin';

-- Create company FIRST (before creating user, so trigger can use it)
INSERT INTO public.companies (name, email, currency, created_at, updated_at)
VALUES ('Ncharudhsolutions', 'info@ncharudhsolutions.com', 'INR', now(), now());

-- Update trigger function to handle company assignment properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
  company_uuid UUID;
BEGIN
  -- Get the first company (should be Ncharudhsolutions)
  SELECT id INTO company_uuid FROM public.companies ORDER BY created_at ASC LIMIT 1;
  
  -- Count existing users
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  
  -- Insert profile with company_id if company exists
  IF company_uuid IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name, company_id)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
      company_uuid
    )
    ON CONFLICT (id) DO UPDATE
    SET company_id = company_uuid;
    
    -- If first user, make them super_admin; otherwise, employee
    IF user_count = 0 THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'super_admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'employee')
      ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
  ELSE
    -- If no company exists, create profile without company_id
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'employee')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail user creation
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;
