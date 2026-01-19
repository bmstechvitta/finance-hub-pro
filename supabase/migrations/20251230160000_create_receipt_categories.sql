-- Create receipt_categories table for storing custom receipt categories
CREATE TABLE IF NOT EXISTS public.receipt_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_receipt_categories_company ON public.receipt_categories(company_id);

-- Enable RLS
ALTER TABLE public.receipt_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for receipt_categories
CREATE POLICY "Users can view receipt categories for their company"
  ON public.receipt_categories FOR SELECT
  USING (
    company_id = public.get_user_company_id(auth.uid()) OR 
    public.is_admin(auth.uid())
  );

CREATE POLICY "Users can create receipt categories"
  ON public.receipt_categories FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (company_id = public.get_user_company_id(auth.uid()) OR public.is_admin(auth.uid()))
  );

CREATE POLICY "Finance users can manage receipt categories"
  ON public.receipt_categories FOR UPDATE
  USING (
    public.has_finance_access(auth.uid()) OR 
    created_by = auth.uid() OR
    public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete receipt categories"
  ON public.receipt_categories FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_receipt_categories_updated_at
BEFORE UPDATE ON public.receipt_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
