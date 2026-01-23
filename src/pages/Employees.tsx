import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Building,
} from "lucide-react";
import { EmployeeDialog } from "@/components/employees/EmployeeDialog";
import { Employee, useEmployees, useDeleteEmployee } from "@/hooks/useEmployees";
import { format } from "date-fns";
import { useCompany } from "@/hooks/useCompany";
import { formatCurrency } from "@/lib/utils";



const statusConfig = {
  active: {
    variant: "success" as const,
    label: "Active",
  },
  "on-leave": {
    variant: "warning" as const,
    label: "On Leave",
  },
  terminated: {
    variant: "destructive" as const,
    label: "Terminated",
  },
};

const Employees = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: employeesData, isLoading } = useEmployees();
  const deleteEmployee = useDeleteEmployee();
  const { data: company } = useCompany();
  const currency = company?.currency || "INR";

  // Use data from database
  const allEmployees = employeesData || [];
  
  // Get unique departments
  const uniqueDepartments = [...new Set(allEmployees.map((e) => e.department).filter(Boolean))];

  // Filter employees based on search query and filters
  const employees = allEmployees.filter((employee) => {
    const employeeName = employee.full_name || "Unknown";
    const employeeEmail = employee.email || "";
    const employeeDepartment = employee.department || "";
    const employeePosition = employee.position || "";
    
    const matchesSearch =
      !searchQuery ||
      employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employeeEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employeeDepartment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employeePosition.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDepartment = departmentFilter === "all" || employee.department === departmentFilter;
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter;

    return matchesSearch && matchesDepartment && matchesStatus;
  });
  
  const totalEmployees = allEmployees.length;
  const activeCount = allEmployees.filter((e) => e.status === "active").length;
  const onLeaveCount = allEmployees.filter((e) => e.status === "on-leave").length;
  const totalPayroll = allEmployees.reduce((sum, e) => sum + (Number(e.salary) || 0), 0);

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    setDialogOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDialogOpen(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (confirm(`Are you sure you want to remove ${employee.full_name}?`)) {
      await deleteEmployee.mutateAsync(employee.id);
    }
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">
              Manage your team and employee information
            </p>
          </div>
          <Button onClick={handleAddEmployee}>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">Total Employees</p>
          <p className="text-2xl font-bold">{totalEmployees}</p>
        </Card>
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-success">{activeCount}</p>
        </Card>
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">On Leave</p>
          <p className="text-2xl font-bold text-warning">{onLeaveCount}</p>
        </Card>
        <Card variant="stat" className="p-4">
          <p className="text-sm text-muted-foreground">Monthly Payroll</p>
          <p className="text-2xl font-bold">
            {formatCurrency(totalPayroll / 12, currency)}
          </p>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search employees..." 
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {uniqueDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on-leave">On Leave</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employees Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading employees...
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No employees found. Click "Add Employee" to get started.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => {
          const employeeName = employee.full_name || "Unknown";
          const employeePosition = employee.position || "";
          const employeeEmail = employee.email || "";
          const employeeDepartment = employee.department || "";
          const employeeLocation = employee.location || "";
          const employeeStatus = (employee.status as "active" | "on-leave" | "terminated") || "active";
          const employeeJoinDate = employee.hire_date ? format(new Date(employee.hire_date), "MMM d, yyyy") : "";
          const avatarSeed = employeeName.toLowerCase().replace(/\s+/g, "-") || employeeEmail?.split("@")[0] || "employee";
          
          const status = statusConfig[employeeStatus as keyof typeof statusConfig] || statusConfig.active;
          return (
            <Card key={employee.id} variant="stat" className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`}
                    />
                    <AvatarFallback>{employeeName.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{employeeName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {employeePosition}
                    </p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Eye className="mr-2 h-4 w-4" />
                      View Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDeleteEmployee(employee)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="truncate">{employeeEmail}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-4 w-4" />
                  <span>{employeeDepartment}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{employeeLocation}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between pt-4 border-t border-border/50">
                <Badge variant={status.variant}>{status.label}</Badge>
                {employeeJoinDate && (
                  <span className="text-sm text-muted-foreground">
                    Since {employeeJoinDate}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
        </div>
      )}

      {/* Employee Dialog */}
      <EmployeeDialog
        employee={selectedEmployee}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </DashboardLayout>
  );
};

export default Employees;
