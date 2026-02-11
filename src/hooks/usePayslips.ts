import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

export type Payslip = Tables<"payslips"> & {
  employees?: {
    full_name: string | null;
    email: string | null;
    position: string | null;
    department: string | null;
  } | null;
};

export function usePayslips() {
  return useQuery({
    queryKey: ["payslips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select(`
          *,
          employees:employee_id (
            full_name,
            email,
            position,
            department
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Payslip[];
    },
  });
}

export function usePayslipStats() {
  return useQuery({
    queryKey: ["payslip-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("net_pay, status");

      if (error) throw error;

      const totalPayroll = data.reduce((sum, p) => sum + Number(p.net_pay || 0), 0);
      const paidAmount = data
        .filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.net_pay || 0), 0);
      const pendingAmount = data
        .filter((p) => p.status !== "paid")
        .reduce((sum, p) => sum + Number(p.net_pay || 0), 0);
      const totalEmployees = new Set(data.map((p) => p.employee_id)).size;

      return {
        totalPayroll,
        paidAmount,
        pendingAmount,
        totalEmployees,
      };
    },
  });
}

interface ProcessPayrollInput {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  payDate?: string;    // YYYY-MM-DD
}

export function useProcessPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ periodStart, periodEnd, payDate }: ProcessPayrollInput) => {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Not authenticated");

      // Get company_id for the current user
      const { data: companyIdData, error: companyError } = await supabase
        .rpc("get_user_company_id", { _user_id: user.id });

      if (companyError) throw companyError;

      const companyId = companyIdData as string | null;

      // Fetch active employees for this company
      const { data: employees, error: employeesError } = await supabase
        .from("employees")
        .select("id, salary, status")
        .eq("company_id", companyId)
        .eq("status", "active");

      if (employeesError) throw employeesError;

      if (!employees || employees.length === 0) {
        throw new Error("No active employees found for this company");
      }

      // Fetch existing payslips for this period to avoid duplicates
      const employeeIds = employees.map((e) => e.id);

      const { data: existingPayslips, error: existingError } = await supabase
        .from("payslips")
        .select("employee_id")
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .in("employee_id", employeeIds);

      if (existingError) throw existingError;

      const existingEmployeeIds = new Set(
        (existingPayslips || []).map((p) => p.employee_id as string)
      );

      const rowsToInsert = employees
        .filter((e) => !existingEmployeeIds.has(e.id))
        .map((e) => {
          const basicSalary = Number(e.salary || 0);
          const allowances = 0;
          const deductions = 0;
          const netPay = basicSalary + allowances - deductions;

          return {
            employee_id: e.id,
            company_id: companyId,
            period_start: periodStart,
            period_end: periodEnd,
            basic_salary: basicSalary,
            allowances,
            deductions,
            net_pay: netPay,
            pay_date: payDate ?? null,
            status: "pending" as string,
            created_by: user.id,
          };
        });

      if (rowsToInsert.length === 0) {
        throw new Error("Payslips for this period have already been generated for all active employees");
      }

      const { data: inserted, error: insertError } = await supabase
        .from("payslips")
        .insert(rowsToInsert)
        .select("id");

      if (insertError) throw insertError;

      return {
        createdCount: inserted?.length || 0,
        periodStart,
        periodEnd,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      queryClient.invalidateQueries({ queryKey: ["payslip-stats"] });

      toast({
        title: "Payroll processed",
        description: `Generated ${result.createdCount} payslip${result.createdCount === 1 ? "" : "s"} for this period.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to process payroll",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

