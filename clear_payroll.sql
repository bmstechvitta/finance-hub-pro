-- Clear all payroll data (payslips table)
-- This will delete all payslip records

TRUNCATE TABLE public.payslips CASCADE;

-- Verify the table is empty
SELECT COUNT(*) as remaining_payslips FROM public.payslips;
