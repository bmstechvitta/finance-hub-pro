import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface DepartmentBudget {
  id: string;
  company_id: string | null;
  department: string;
  monthly_limit: number;
  alert_threshold: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepartmentBudgetInsert {
  department: string;
  monthly_limit: number;
  alert_threshold?: number;
  is_active?: boolean;
  company_id?: string;
}

export interface DepartmentBudgetStatus {
  department: string;
  budget: DepartmentBudget | null;
  currentSpending: number;
  percentUsed: number;
  status: "ok" | "warning" | "exceeded";
  remaining: number;
}

export function useDepartmentBudgets() {
  return useQuery({
    queryKey: ["department-budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_budgets")
        .select("*")
        .eq("is_active", true)
        .order("department");

      if (error) throw error;
      return data as DepartmentBudget[];
    },
  });
}

export function useDepartmentBudgetStatus() {
  return useQuery({
    queryKey: ["department-budget-status"],
    queryFn: async () => {
      // Get all active budgets
      const { data: budgets, error: budgetError } = await supabase
        .from("department_budgets")
        .select("*")
        .eq("is_active", true);

      if (budgetError) throw budgetError;

      // Get current month's spending by department
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      const { data: expenses, error: expenseError } = await supabase
        .from("expenses")
        .select("department, amount, status")
        .gte("expense_date", monthStart)
        .lte("expense_date", monthEnd)
        .in("status", ["approved", "pending"]);

      if (expenseError) throw expenseError;

      // Calculate spending by department
      const spendingByDept: Record<string, number> = {};
      expenses?.forEach((e) => {
        if (e.department) {
          spendingByDept[e.department] =
            (spendingByDept[e.department] || 0) + Number(e.amount);
        }
      });

      // Build status for each budget
      const statuses: DepartmentBudgetStatus[] = (budgets || []).map((budget) => {
        const currentSpending = spendingByDept[budget.department] || 0;
        const percentUsed =
          budget.monthly_limit > 0
            ? (currentSpending / budget.monthly_limit) * 100
            : 0;
        const remaining = Math.max(0, budget.monthly_limit - currentSpending);

        let status: "ok" | "warning" | "exceeded" = "ok";
        if (percentUsed >= 100) {
          status = "exceeded";
        } else if (percentUsed >= budget.alert_threshold) {
          status = "warning";
        }

        return {
          department: budget.department,
          budget,
          currentSpending,
          percentUsed,
          status,
          remaining,
        };
      });

      // Also include departments with spending but no budget
      const budgetDepts = new Set(budgets?.map((b) => b.department) || []);
      Object.entries(spendingByDept).forEach(([dept, spending]) => {
        if (!budgetDepts.has(dept)) {
          statuses.push({
            department: dept,
            budget: null,
            currentSpending: spending,
            percentUsed: 0,
            status: "ok",
            remaining: 0,
          });
        }
      });

      return statuses.sort((a, b) => {
        // Sort by status (exceeded first, then warning, then ok)
        const statusOrder = { exceeded: 0, warning: 1, ok: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return b.currentSpending - a.currentSpending;
      });
    },
  });
}

export function useCreateDepartmentBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (budget: DepartmentBudgetInsert) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", userData.user.id)
        .single();

      const { data, error } = await supabase
        .from("department_budgets")
        .insert({
          ...budget,
          company_id: profile?.company_id,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["department-budget-status"] });
      toast.success("Budget created successfully");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate key")) {
        toast.error("A budget already exists for this department");
      } else {
        toast.error("Failed to create budget");
      }
    },
  });
}

export function useUpdateDepartmentBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<DepartmentBudget> & { id: string }) => {
      const { data, error } = await supabase
        .from("department_budgets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["department-budget-status"] });
      toast.success("Budget updated successfully");
    },
    onError: () => {
      toast.error("Failed to update budget");
    },
  });
}

export function useDeleteDepartmentBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("department_budgets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["department-budgets"] });
      queryClient.invalidateQueries({ queryKey: ["department-budget-status"] });
      toast.success("Budget deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete budget");
    },
  });
}
