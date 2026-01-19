-- Add number prefix fields to companies table for configurable invoice/receipt/quotation numbering
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'INV',
ADD COLUMN IF NOT EXISTS receipt_prefix TEXT DEFAULT 'RCP',
ADD COLUMN IF NOT EXISTS quotation_prefix TEXT DEFAULT 'QT';

-- Add comment
COMMENT ON COLUMN public.companies.invoice_prefix IS 'Prefix for invoice numbers (e.g., INV, INV-, CUST-)';
COMMENT ON COLUMN public.companies.receipt_prefix IS 'Prefix for receipt numbers (e.g., RCP, RCP-, REC-)';
COMMENT ON COLUMN public.companies.quotation_prefix IS 'Prefix for quotation numbers (e.g., QT, QT-, QUOT-)';
