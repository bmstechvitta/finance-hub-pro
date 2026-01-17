import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Clock } from "lucide-react";

interface Payslip {
  id: string;
  employee: {
    name: string;
    position: string;
    avatar: string;
  };
  period: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: "paid" | "pending" | "processing";
  payDate: string;
}

interface PayslipDialogProps {
  payslip: Payslip | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  paid: {
    variant: "success" as const,
    icon: CheckCircle,
    label: "Paid",
  },
  pending: {
    variant: "warning" as const,
    icon: Clock,
    label: "Pending",
  },
  processing: {
    variant: "info" as const,
    icon: Clock,
    label: "Processing",
  },
};

export function PayslipDialog({
  payslip,
  open,
  onOpenChange,
}: PayslipDialogProps) {
  if (!payslip) return null;

  const status = statusConfig[payslip.status];
  const StatusIcon = status.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip Details</DialogTitle>
          <DialogDescription>
            Pay period: {payslip.period}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${payslip.employee.avatar}`}
              />
              <AvatarFallback className="text-lg">
                {payslip.employee.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{payslip.employee.name}</h3>
              <p className="text-sm text-muted-foreground">
                {payslip.employee.position}
              </p>
            </div>
            <Badge variant={status.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
          </div>

          <Separator />

          {/* Pay Details */}
          <div className="space-y-4">
            <h4 className="font-semibold">Pay Details</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pay Period</span>
                <span className="font-medium">{payslip.period}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pay Date</span>
                <span className="font-medium">{payslip.payDate}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Earnings */}
          <div className="space-y-4">
            <h4 className="font-semibold">Earnings</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Basic Salary</span>
                <span className="font-medium">
                  ${payslip.basicSalary.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Allowances</span>
                <span className="font-medium text-success">
                  +${payslip.allowances.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Deductions */}
          <div className="space-y-4">
            <h4 className="font-semibold">Deductions</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Deductions</span>
                <span className="font-medium text-destructive">
                  -${payslip.deductions.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Net Pay */}
          <div className="rounded-lg border-2 bg-muted/50 p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Net Pay</span>
              <span className="text-2xl font-bold">
                ${payslip.netPay.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
