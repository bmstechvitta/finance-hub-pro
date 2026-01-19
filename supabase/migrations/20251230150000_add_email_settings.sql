-- Add email settings to companies table (Resend API configuration)

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS email_sender_name TEXT DEFAULT 'FinanceHub',
ADD COLUMN IF NOT EXISTS email_reply_to TEXT,
ADD COLUMN IF NOT EXISTS resend_api_key TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.companies.email_sender_name IS 'Email sender display name';
COMMENT ON COLUMN public.companies.email_reply_to IS 'Reply-to email address';
COMMENT ON COLUMN public.companies.resend_api_key IS 'Resend API key for sending emails';
