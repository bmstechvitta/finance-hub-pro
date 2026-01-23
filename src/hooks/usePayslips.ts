import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

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
