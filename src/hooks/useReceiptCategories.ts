import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "./useCompany";

export interface ReceiptCategory {
  id: string;
  company_id: string;
  name: string;
  is_custom: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const defaultCategories = [
  "Office Supplies",
  "Technology",
  "Travel",
  "Meals & Entertainment",
  "Utilities",
  "Shipping",
  "Marketing",
  "Professional Services",
];

export function useReceiptCategories() {
  const { data: company } = useCompany();

  return useQuery({
    queryKey: ["receipt-categories", company?.id],
    queryFn: async () => {
      if (!company?.id) {
        return {
          all: [...defaultCategories, "Other"],
          custom: [],
        };
      }

      const { data, error } = await supabase
        .from("receipt_categories")
        .select("*")
        .eq("company_id", company.id)
        .order("name", { ascending: true });

      if (error) throw error;

      // Combine default categories with custom categories from database
      const customCategories = (data || []).map((cat) => cat.name);
      const allCategories = [
        ...defaultCategories,
        ...customCategories.filter((cat) => !defaultCategories.includes(cat)),
        "Other",
      ];

      return {
        all: allCategories,
        custom: data || [],
      };
    },
    enabled: !!company?.id,
  });
}

export function useCreateReceiptCategory() {
  const queryClient = useQueryClient();
  const { data: company } = useCompany();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!company?.id) throw new Error("Company not found");

      // Check if category already exists
      const { data: existing } = await supabase
        .from("receipt_categories")
        .select("id")
        .eq("company_id", company.id)
        .eq("name", name.trim())
        .single();

      if (existing) {
        // Category already exists, return it
        return existing;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Create new category
      const { data, error } = await supabase
        .from("receipt_categories")
        .insert({
          company_id: company.id,
          name: name.trim(),
          is_custom: true,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipt-categories"] });
    },
  });
}
