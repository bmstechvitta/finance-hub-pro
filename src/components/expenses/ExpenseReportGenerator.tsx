import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarIcon, FileText, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { generateExpenseReportPDF, downloadPDF } from "./ExpenseReportPDF";
import { useCompany } from "@/hooks/useCompany";

type GroupByOption = "category" | "department" | "status" | "employee";

interface ExpenseReportFilters {
  startDate: Date;
  endDate: Date;
  groupBy: GroupByOption;
  status: string | null;
  department: string | null;
}

interface ReportExpense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  status: string;
  department: string | null;
  category_name: string | null;
  submitter_name: string | null;
}

interface GroupedData {
  groupName: string;
  expenses: ReportExpense[];
  total: number;
  count: number;
}

function useExpenseReport(filters: ExpenseReportFilters) {
  return useQuery({
    queryKey: ["expense-report", filters],
    queryFn: async () => {
      const { data: expenses, error } = await supabase
        .from("expenses")
        .select(`
          id,
          description,
          amount,
          expense_date,
          status,
          department,
          created_by,
          expense_categories (name)
        `)
        .gte("expense_date", format(filters.startDate, "yyyy-MM-dd"))
        .lte("expense_date", format(filters.endDate, "yyyy-MM-dd"))
        .order("expense_date", { ascending: false });

      if (error) throw error;

      // Get unique creator IDs to fetch profile names
      const creatorIds = [...new Set(expenses?.map(e => e.created_by).filter(Boolean))];
      
      let profilesMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", creatorIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.full_name || "Unknown";
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Apply additional filters
      let filteredExpenses = expenses || [];
      
      if (filters.status) {
        filteredExpenses = filteredExpenses.filter(e => e.status === filters.status);
      }
      
      if (filters.department) {
        filteredExpenses = filteredExpenses.filter(e => e.department === filters.department);
      }

      // Map to simpler structure
      const mappedExpenses: ReportExpense[] = filteredExpenses.map(e => ({
        id: e.id,
        description: e.description,
        amount: Number(e.amount),
        expense_date: e.expense_date,
        status: e.status || "pending",
        department: e.department,
        category_name: e.expense_categories?.name || null,
        submitter_name: e.created_by ? profilesMap[e.created_by] || null : null,
      }));

      // Group expenses
      const grouped: Record<string, ReportExpense[]> = {};
      
      mappedExpenses.forEach(expense => {
        let key: string;
        switch (filters.groupBy) {
          case "category":
            key = expense.category_name || "Uncategorized";
            break;
          case "department":
            key = expense.department || "No Department";
            break;
          case "status":
            key = expense.status.charAt(0).toUpperCase() + expense.status.slice(1);
            break;
          case "employee":
            key = expense.submitter_name || "Unknown";
            break;
          default:
            key = "All";
        }
        
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(expense);
      });

      // Convert to array with totals
      const groupedData: GroupedData[] = Object.entries(grouped)
        .map(([groupName, expenses]) => ({
          groupName,
          expenses,
          total: expenses.reduce((sum, e) => sum + e.amount, 0),
          count: expenses.length,
        }))
        .sort((a, b) => b.total - a.total);

      // Calculate summary
      const totalAmount = mappedExpenses.reduce((sum, e) => sum + e.amount, 0);
      const approvedAmount = mappedExpenses
        .filter(e => e.status === "approved")
        .reduce((sum, e) => sum + e.amount, 0);
      const pendingAmount = mappedExpenses
        .filter(e => e.status === "pending")
        .reduce((sum, e) => sum + e.amount, 0);
      const rejectedAmount = mappedExpenses
        .filter(e => e.status === "rejected")
        .reduce((sum, e) => sum + e.amount, 0);

      return {
        expenses: mappedExpenses,
        grouped: groupedData,
        summary: {
          totalAmount,
          approvedAmount,
          pendingAmount,
          rejectedAmount,
          totalCount: mappedExpenses.length,
        },
      };
    },
  });
}

function useDepartments() {
  return useQuery({
    queryKey: ["expense-departments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("department")
        .not("department", "is", null);
      
      const unique = [...new Set(data?.map(d => d.department).filter(Boolean))];
      return unique as string[];
    },
  });
}

export function ExpenseReportGenerator() {
  const [filters, setFilters] = useState<ExpenseReportFilters>({
    startDate: startOfMonth(subMonths(new Date(), 1)),
    endDate: endOfMonth(subMonths(new Date(), 1)),
    groupBy: "category",
    status: null,
    department: null,
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const { data: reportData, isLoading } = useExpenseReport(filters);
  const { data: departments } = useDepartments();
  const { data: company } = useCompany();

  const handleExportPDF = async () => {
    if (!reportData) return;
    
    setIsGeneratingPDF(true);
    try {
      const blob = await generateExpenseReportPDF({
        filters,
        grouped: reportData.grouped,
        summary: reportData.summary,
        companyName: company?.name,
        companyAddress: company?.address || undefined,
      });
      
      const filename = `expense-report-${format(filters.startDate, "yyyy-MM-dd")}-to-${format(filters.endDate, "yyyy-MM-dd")}.pdf`;
      downloadPDF(blob, filename);
      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      toast.error("Failed to generate PDF report");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const setPresetPeriod = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case "this-month":
        setFilters(prev => ({
          ...prev,
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        }));
        break;
      case "last-month":
        setFilters(prev => ({
          ...prev,
          startDate: startOfMonth(subMonths(now, 1)),
          endDate: endOfMonth(subMonths(now, 1)),
        }));
        break;
      case "last-3-months":
        setFilters(prev => ({
          ...prev,
          startDate: startOfMonth(subMonths(now, 3)),
          endDate: endOfMonth(now),
        }));
        break;
      case "last-6-months":
        setFilters(prev => ({
          ...prev,
          startDate: startOfMonth(subMonths(now, 6)),
          endDate: endOfMonth(now),
        }));
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Expense Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period Presets */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetPeriod("this-month")}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetPeriod("last-month")}
            >
              Last Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetPeriod("last-3-months")}
            >
              Last 3 Months
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPresetPeriod("last-6-months")}
            >
              Last 6 Months
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Start Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filters.startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) =>
                      date && setFilters(prev => ({ ...prev, startDate: date }))
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filters.endDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) =>
                      date && setFilters(prev => ({ ...prev, endDate: date }))
                    }
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Group By */}
            <div className="space-y-2">
              <Label>Group By</Label>
              <Select
                value={filters.groupBy}
                onValueChange={(value: GroupByOption) =>
                  setFilters(prev => ({ ...prev, groupBy: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters(prev => ({
                    ...prev,
                    status: value === "all" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department Filter */}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={filters.department || "all"}
                onValueChange={(value) =>
                  setFilters(prev => ({
                    ...prev,
                    department: value === "all" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleExportPDF}
              disabled={isLoading || isGeneratingPDF || !reportData?.expenses.length}
            >
              {isGeneratingPDF ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export PDF Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">Total Expenses</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <p className="text-2xl font-bold">
                ${reportData?.summary.totalAmount.toLocaleString() || 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {reportData?.summary.totalCount || 0} expenses
              </p>
            </>
          )}
        </Card>
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">Approved</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-success">
              ${reportData?.summary.approvedAmount.toLocaleString() || 0}
            </p>
          )}
        </Card>
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-warning">
              ${reportData?.summary.pendingAmount.toLocaleString() || 0}
            </p>
          )}
        </Card>
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">Rejected</p>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold text-destructive">
              ${reportData?.summary.rejectedAmount.toLocaleString() || 0}
            </p>
          )}
        </Card>
      </div>

      {/* Grouped Report Preview */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      ) : reportData?.grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No expenses found</p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters to see more data
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reportData?.grouped.map((group) => (
            <Card key={group.groupName}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{group.groupName}</CardTitle>
                  <div className="flex items-center gap-4">
                    <Badge variant="muted">{group.count} expenses</Badge>
                    <span className="text-lg font-bold">
                      ${group.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      {filters.groupBy !== "category" && (
                        <TableHead>Category</TableHead>
                      )}
                      {filters.groupBy !== "department" && (
                        <TableHead>Department</TableHead>
                      )}
                      {filters.groupBy !== "employee" && (
                        <TableHead>Employee</TableHead>
                      )}
                      {filters.groupBy !== "status" && (
                        <TableHead>Status</TableHead>
                      )}
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.expenses.slice(0, 5).map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {expense.description}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(expense.expense_date), "MMM d, yyyy")}
                        </TableCell>
                        {filters.groupBy !== "category" && (
                          <TableCell>
                            {expense.category_name || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        {filters.groupBy !== "department" && (
                          <TableCell>
                            {expense.department || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        {filters.groupBy !== "employee" && (
                          <TableCell>
                            {expense.submitter_name || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        {filters.groupBy !== "status" && (
                          <TableCell>
                            <Badge
                              variant={
                                expense.status === "approved"
                                  ? "success"
                                  : expense.status === "pending"
                                  ? "warning"
                                  : "destructive"
                              }
                            >
                              {expense.status}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium">
                          ${expense.amount.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {group.expenses.length > 5 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-2"
                        >
                          + {group.expenses.length - 5} more expenses
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
