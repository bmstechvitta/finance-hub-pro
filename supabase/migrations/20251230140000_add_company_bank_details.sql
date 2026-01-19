-- Add bank details and Indian tax fields to companies table

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS gstin TEXT,
ADD COLUMN IF NOT EXISTS pan TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_ifsc TEXT,
ADD COLUMN IF NOT EXISTS bank_account_type TEXT,
ADD COLUMN IF NOT EXISTS bank_branch TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.gstin IS 'GST Identification Number (for Indian companies)';
COMMENT ON COLUMN public.companies.pan IS 'Permanent Account Number (for Indian companies)';
COMMENT ON COLUMN public.companies.bank_name IS 'Bank name for payment details';
COMMENT ON COLUMN public.companies.bank_account_number IS 'Bank account number';
COMMENT ON COLUMN public.companies.bank_ifsc IS 'IFSC code for Indian banks';
COMMENT ON COLUMN public.companies.bank_account_type IS 'Account type (e.g., Current, Savings)';
COMMENT ON COLUMN public.companies.bank_branch IS 'Bank branch name';
