import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  Download,
  Calendar,
  DollarSign,
  Loader2,
  FileText,
} from "lucide-react";
import { format, parse } from "date-fns";
import { useBankStatements, useBankStatementTransactions, useCreateBankStatement, useDeleteBankStatement } from "@/hooks/useStatements";
import { useCompany } from "@/hooks/useCompany";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const Statement = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteStatementId, setDeleteStatementId] = useState<string | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);

  const { data: statements, isLoading } = useBankStatements();
  const { data: transactions, isLoading: transactionsLoading } = useBankStatementTransactions(selectedStatementId);
  const createStatement = useCreateBankStatement();
  const deleteStatement = useDeleteBankStatement();
  const { data: company } = useCompany();
  const { user } = useAuth();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const parseExcelFile = async (file: File) => {
    return new Promise<{ statement: any; transactions: any[] }>((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array", cellDates: true, cellNF: true, cellText: true });
          
          // Get first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Get both raw and formatted values to preserve exact Excel formatting
          const jsonDataRaw = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: "",
            raw: true, // Get raw numeric values
            dateNF: "dd/MM/yyyy"
          });
          
          const jsonDataFormatted = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1, 
            defval: "",
            raw: false, // Get formatted display values
            dateNF: "dd/MM/yyyy"
          });
          
          // Combine raw and formatted - use formatted for display, raw for calculations
          const jsonData = jsonDataFormatted.map((row: any, rowIdx: number) => {
            const rawRow = jsonDataRaw[rowIdx] as any[];
            if (!rawRow) return row;
            
            return row.map((cell: any, colIdx: number) => {
              const rawCell = rawRow[colIdx];
              // If raw cell is a number and formatted cell exists, prefer formatted for display
              // But store both for accurate calculations
              return cell !== undefined && cell !== null ? cell : rawCell;
            });
          });

          console.log("Excel data loaded:", {
            totalRows: jsonData.length,
            firstFewRows: jsonData.slice(0, 5)
          });

          // Find header row - check more rows and be more flexible
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(20, jsonData.length); i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;
            
            // Check if this row looks like headers
            const headerKeywords = ['date', 'description', 'narration', 'particulars', 'debit', 'credit', 'amount', 'balance', 'ref', 'reference', 'value date', 'transaction'];
            const rowText = row.map(cell => String(cell || "").toLowerCase().trim()).join(" ");
            const keywordCount = headerKeywords.filter(keyword => rowText.includes(keyword)).length;
            
            // If row contains at least 2 header keywords, it's likely the header row
            if (keywordCount >= 2) {
              headerRowIndex = i;
              console.log("Found header row at index:", i, "Keywords found:", keywordCount);
              break;
            }
          }

          // If no header found, assume first row is header
          if (headerRowIndex === -1) {
            headerRowIndex = 0;
            console.log("No header row found, using first row");
          }

          const headers = (jsonData[headerRowIndex] as any[]).map((h: any, idx: number) => {
            const header = String(h || "").trim();
            // If header is empty, create a default name
            return header || `Column_${idx + 1}`;
          });

          console.log("Headers detected:", headers);

          // Map common column names (case-insensitive, more flexible)
          const headersLower = headers.map(h => h.toLowerCase());
          
          const dateCol = headersLower.findIndex(h => 
            h.includes('date') && !h.includes('value')
          );
          const valueDateCol = headersLower.findIndex(h => 
            h.includes('value date') || (h.includes('value') && h.includes('date'))
          );
          const descCol = headersLower.findIndex(h => 
            h.includes('description') || h.includes('narration') || h.includes('particulars') || 
            h.includes('details') || h.includes('remarks') || h.includes('transaction')
          );
          const refCol = headersLower.findIndex(h => 
            h.includes('reference') || h.includes('ref') || h.includes('cheque') || 
            h.includes('chq') || h.includes('chq no') || h.includes('instrument')
          );
          // Find debit column - must contain "debit" keyword and be numeric
          const debitCol = headersLower.findIndex(h => {
            const hasDebitKeyword = h.includes('debit') || h.includes('withdrawal') || h.includes('dr');
            // Exclude if it's clearly a description field
            const isNotDescription = !h.includes('description') && !h.includes('narration') && !h.includes('particulars');
            return hasDebitKeyword && isNotDescription;
          });
          
          // Find credit column - must contain "credit" keyword and be numeric
          const creditCol = headersLower.findIndex(h => {
            const hasCreditKeyword = h.includes('credit') || h.includes('deposit') || h.includes('cr');
            // Exclude if it's clearly a description field
            const isNotDescription = !h.includes('description') && !h.includes('narration') && !h.includes('particulars');
            return hasCreditKeyword && isNotDescription;
          });
          
          const balanceCol = headersLower.findIndex(h => 
            h.includes('balance') || h.includes('closing')
          );
          
          // Validate that debit/credit columns actually contain numeric data
          // Check a few sample rows to verify
          let validatedDebitCol = debitCol;
          let validatedCreditCol = creditCol;
          
          if (debitCol >= 0 || creditCol >= 0) {
            // Check first few data rows to validate columns contain numbers
            for (let checkRow = headerRowIndex + 1; checkRow < Math.min(headerRowIndex + 5, jsonData.length); checkRow++) {
              const sampleRow = jsonData[checkRow] as any[];
              if (!sampleRow) continue;
              
              // Validate debit column
              if (debitCol >= 0 && sampleRow[debitCol] !== undefined) {
                const debitValue = sampleRow[debitCol];
                const isNumeric = typeof debitValue === 'number' || 
                                 (typeof debitValue === 'string' && /^[\d.,\s-]+$/.test(debitValue.replace(/[₹$,\s]/g, "")));
                if (!isNumeric && debitValue !== "" && debitValue !== null) {
                  // This column doesn't seem to contain numbers, might be wrong
                  console.warn(`Debit column ${debitCol} doesn't contain numeric data, value:`, debitValue);
                }
              }
              
              // Validate credit column
              if (creditCol >= 0 && sampleRow[creditCol] !== undefined) {
                const creditValue = sampleRow[creditCol];
                const isNumeric = typeof creditValue === 'number' || 
                                 (typeof creditValue === 'string' && /^[\d.,\s-]+$/.test(creditValue.replace(/[₹$,\s]/g, "")));
                if (!isNumeric && creditValue !== "" && creditValue !== null) {
                  // This column doesn't seem to contain numbers, might be wrong
                  console.warn(`Credit column ${creditCol} doesn't contain numeric data, value:`, creditValue);
                  // If credit column contains text that looks like description, it's wrong
                  if (typeof creditValue === 'string' && (creditValue.includes('/') || creditValue.match(/[A-Za-z]/))) {
                    validatedCreditCol = -1; // Mark as invalid
                  }
                }
              }
            }
          }
          
          // Use validated columns
          const finalDebitCol = validatedDebitCol;
          const finalCreditCol = validatedCreditCol;

          console.log("Column mapping:", {
            dateCol,
            valueDateCol,
            descCol,
            refCol,
            debitCol: finalDebitCol,
            creditCol: finalCreditCol,
            balanceCol,
            headers
          });

          const transactions: any[] = [];
          let openingBalance: number | null = null;
          let closingBalance: number | null = null;
          let minDate: Date | null = null;
          let maxDate: Date | null = null;

          // Parse transactions - start from row after header
          let parsedCount = 0;
          let skippedCount = 0;
          
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) {
              skippedCount++;
              continue;
            }

            // Skip completely empty rows
            const hasData = row.some((cell, idx) => {
              const val = String(cell || "").trim();
              return val !== "" && val !== null && val !== undefined;
            });
            
            if (!hasData) {
              skippedCount++;
              continue;
            }

            // Get values from mapped columns - preserve original formatting
            const dateStr = dateCol >= 0 && row[dateCol] !== undefined 
              ? String(row[dateCol] || "").trim() 
              : "";
            const valueDateStr = valueDateCol >= 0 && row[valueDateCol] !== undefined
              ? String(row[valueDateCol] || "").trim() 
              : dateStr;
            
            // Use validated column indices
            const actualDebitCol = finalDebitCol;
            const actualCreditCol = finalCreditCol;
            
            // Get description - preserve ALL transaction details exactly as in Excel
            let description = "";
            if (descCol >= 0 && row[descCol] !== undefined) {
              description = String(row[descCol] || "").trim();
            }
            
            // Collect ALL non-empty columns that aren't dates/amounts/balance - these might be transaction details
            const transactionParts: string[] = [];
            headers.forEach((header, idx) => {
              const headerLower = header.toLowerCase();
              const cellValue = row[idx];
              
              // Skip if empty, or if it's a date/amount/balance column
              if (cellValue === undefined || cellValue === null || String(cellValue).trim() === "") return;
              
              const isDateCol = idx === dateCol || idx === valueDateCol || headerLower.includes('date');
              const isAmountCol = idx === debitCol || idx === creditCol || idx === balanceCol || 
                                  headerLower.includes('debit') || headerLower.includes('credit') || 
                                  headerLower.includes('balance') || headerLower.includes('amount');
              const isRefCol = idx === refCol || headerLower.includes('ref') || headerLower.includes('reference');
              
              // Include if it's description-related or if it's not a standard column
              if (!isDateCol && !isAmountCol) {
                const value = String(cellValue).trim();
                // If it looks like transaction detail (contains letters/special chars, not just numbers)
                if (value && (value.includes('/') || value.match(/[a-zA-Z]/) || !value.match(/^[\d.,\s-]+$/))) {
                  if (idx === descCol || headerLower.includes('description') || 
                      headerLower.includes('narration') || headerLower.includes('particulars') ||
                      headerLower.includes('details') || headerLower.includes('transaction') ||
                      headerLower.includes('remarks')) {
                    transactionParts.push(value);
                  } else if (!isRefCol && value.length > 3) {
                    // Include other text columns that might be part of transaction details
                    transactionParts.push(value);
                  }
                }
              }
            });
            
            // Combine all transaction parts with "/" separator (common in bank statements)
            if (transactionParts.length > 0) {
              description = transactionParts.join("/");
            }
            
            const reference = refCol >= 0 && row[refCol] !== undefined
              ? String(row[refCol] || "").trim() 
              : "";
            
            // Get original amount strings as they appear in Excel (preserve formatting)
            // Handle both numeric values and formatted strings
            // Use validated column indices
            const debitCell = actualDebitCol >= 0 ? row[actualDebitCol] : undefined;
            const creditCell = actualCreditCol >= 0 ? row[actualCreditCol] : undefined;
            const balanceCell = balanceCol >= 0 ? row[balanceCol] : undefined;
            
            // Get formatted display strings
            let debitOriginal = "";
            let creditOriginal = "";
            let balanceOriginal = "";
            
            if (debitCell !== undefined && debitCell !== null && debitCell !== "") {
              debitOriginal = String(debitCell).trim();
            }
            if (creditCell !== undefined && creditCell !== null && creditCell !== "") {
              creditOriginal = String(creditCell).trim();
            }
            if (balanceCell !== undefined && balanceCell !== null && balanceCell !== "") {
              balanceOriginal = String(balanceCell).trim();
            }

            // Parse numeric values for calculations
            // Handle both numbers and formatted strings
            let debit: number = 0;
            let credit: number = 0;
            let balance: number | null = null;
            
            // Parse debit amount - ensure it's actually a number
            if (debitCell !== undefined && debitCell !== null && debitCell !== "") {
              const debitStr = String(debitCell).trim();
              // Skip if it looks like text (contains letters or special transaction characters)
              if (debitStr.match(/[A-Za-z]/) || debitStr.includes('/') || debitStr.includes('IMPS') || debitStr.includes('NEFT')) {
                console.warn(`Row ${i + 1}: Debit cell contains text, skipping:`, debitStr);
                // Don't use this as debit amount
              } else {
                if (typeof debitCell === 'number') {
                  debit = debitCell;
                } else {
                  // Remove formatting but preserve the full number
                  const cleaned = debitStr
                    .replace(/[₹$,\s]/g, "")
                    .replace(/\(/g, "-")
                    .replace(/\)/g, "")
                    .trim();
                  const parsed = parseFloat(cleaned);
                  if (!isNaN(parsed) && parsed > 0) {
                    debit = parsed;
                  }
                }
              }
            }
            
            // Parse credit amount - ensure it's actually a number
            if (creditCell !== undefined && creditCell !== null && creditCell !== "") {
              const creditStr = String(creditCell).trim();
              // Skip if it looks like text (contains letters or special transaction characters)
              if (creditStr.match(/[A-Za-z]/) || creditStr.includes('/') || creditStr.includes('IMPS') || creditStr.includes('NEFT')) {
                console.warn(`Row ${i + 1}: Credit cell contains text, skipping:`, creditStr);
                // Don't use this as credit amount - it's probably a description
              } else {
                if (typeof creditCell === 'number') {
                  credit = creditCell;
                } else {
                  // Remove formatting but preserve the full number
                  const cleaned = creditStr
                    .replace(/[₹$,\s]/g, "")
                    .replace(/\(/g, "-")
                    .replace(/\)/g, "")
                    .trim();
                  const parsed = parseFloat(cleaned);
                  if (!isNaN(parsed) && parsed > 0) {
                    credit = parsed;
                  }
                }
              }
            }
            
            if (balanceCell !== undefined && balanceCell !== null && balanceCell !== "") {
              if (typeof balanceCell === 'number') {
                balance = balanceCell;
              } else {
                const balanceStr = String(balanceCell)
                  .replace(/[₹$,\s]/g, "")
                  .replace(/\(/g, "-")
                  .replace(/\)/g, "")
                  .trim();
                const parsed = parseFloat(balanceStr);
                if (!isNaN(parsed)) {
                  balance = parsed;
                }
              }
            }
            
            // Debug logging for amount parsing
            if (debit > 0 || credit > 0) {
              console.log(`Row ${i + 1} amounts:`, {
                debitOriginal,
                debit,
                creditOriginal,
                credit,
                balanceOriginal,
                balance
              });
            }

            // More lenient: include row if it has a date OR has amounts OR has description
            const hasDate = dateStr && dateStr.length > 0;
            const hasAmounts = debit !== 0 || credit !== 0;
            const hasDescription = description && description.length > 0;

            if (!hasDate && !hasAmounts && !hasDescription) {
              skippedCount++;
              continue;
            }

            // Parse date - try multiple formats and Excel serial numbers
            let transactionDate: Date | null = null;
            let valueDate: Date | null = null;

            const dateFormats = [
              "dd/MM/yyyy",
              "dd-MM-yyyy",
              "yyyy-MM-dd",
              "MM/dd/yyyy",
              "dd.MM.yyyy",
              "yyyy/MM/dd",
              "d/M/yyyy",
              "d-M-yyyy",
              "d.M.yyyy",
            ];

            // Try parsing date string
            if (dateStr) {
              // First try Excel serial number (common in Excel exports)
              const excelDateNum = parseFloat(dateStr);
              if (!isNaN(excelDateNum) && excelDateNum > 25569 && excelDateNum < 1000000) {
                // Excel epoch starts from 1900-01-01
                transactionDate = new Date((excelDateNum - 25569) * 86400 * 1000);
                console.log("Parsed Excel serial date:", excelDateNum, "->", transactionDate);
              } else {
                // Try date formats
                for (const format of dateFormats) {
                  try {
                    const parsed = parse(dateStr, format, new Date());
                    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
                      transactionDate = parsed;
                      break;
                    }
                  } catch {}
                }
              }
            }

            // If still no date but we have amounts/description, use a default date
            if (!transactionDate && (hasAmounts || hasDescription)) {
              // Use current date as fallback, or try to infer from context
              transactionDate = new Date();
              console.warn("No valid date found for row", i, "using current date");
            }

            // If absolutely no date and no data, skip
            if (!transactionDate) {
              skippedCount++;
              continue;
            }

            // Parse value date
            if (valueDateStr && valueDateStr !== dateStr) {
              for (const format of dateFormats) {
                try {
                  valueDate = parse(valueDateStr, format, new Date());
                  if (!isNaN(valueDate.getTime())) break;
                } catch {}
              }
            } else {
              valueDate = transactionDate;
            }

            // Track dates for statement period
            if (!minDate || transactionDate < minDate) minDate = transactionDate;
            if (!maxDate || transactionDate > maxDate) maxDate = transactionDate;

            // Track opening/closing balance
            if (balance !== null) {
              if (openingBalance === null) openingBalance = balance;
              closingBalance = balance;
            }

            const transactionType = debit > 0 && credit > 0 ? "both" : debit > 0 ? "debit" : "credit";

            // Store all original row data in metadata for reference
            const rowData: Record<string, any> = {};
            headers.forEach((header, idx) => {
              if (row[idx] !== undefined && row[idx] !== null && row[idx] !== "") {
                rowData[header] = row[idx];
              }
            });

            transactions.push({
              transaction_date: transactionDate.toISOString().split("T")[0],
              value_date: valueDate ? valueDate.toISOString().split("T")[0] : null,
              description: description || "Transaction",
              reference_number: reference || null,
              debit_amount: debit,
              credit_amount: credit,
              balance: balance,
              transaction_type: transactionType,
              metadata: {
                row_number: i + 1,
                original_data: rowData,
                all_columns: headers.map((h, idx) => ({ header: h, value: row[idx] })),
                // Store original formatted amounts as they appear in Excel
                original_debit: debitOriginal,
                original_credit: creditOriginal,
                original_balance: balanceOriginal,
              },
            });
            
            parsedCount++;
          }

          console.log("Parsing complete:", {
            totalRows: jsonData.length,
            headerRow: headerRowIndex,
            parsedTransactions: parsedCount,
            skippedRows: skippedCount,
            transactionsFound: transactions.length
          });

          // Calculate totals
          const totalDebits = transactions.reduce((sum, t) => sum + (t.debit_amount || 0), 0);
          const totalCredits = transactions.reduce((sum, t) => sum + (t.credit_amount || 0), 0);

          const statement = {
            file_name: file.name,
            file_url: "", // Will be set after upload
            bank_name: null,
            account_number: null,
            statement_period_start: minDate ? minDate.toISOString().split("T")[0] : null,
            statement_period_end: maxDate ? maxDate.toISOString().split("T")[0] : null,
            total_debits: totalDebits,
            total_credits: totalCredits,
            opening_balance: openingBalance,
            closing_balance: closingBalance,
            currency: company?.currency || "INR",
            metadata: {
              uploaded_at: new Date().toISOString(),
              total_transactions: transactions.length,
            },
          };

          resolve({ statement, transactions });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const excelFile = files.find(f => 
        f.name.endsWith('.xlsx') || 
        f.name.endsWith('.xls') || 
        f.name.endsWith('.csv')
      );

      if (excelFile) {
        await uploadStatement(excelFile);
      } else {
        toast({
          title: "Invalid file",
          description: "Please upload an Excel file (.xlsx, .xls, or .csv)",
          variant: "destructive",
        });
      }
    },
    [company, user]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadStatement(file);
    }
  };

  const uploadStatement = async (file: File) => {
    if (!user || !company) {
      toast({
        title: "Error",
        description: "Please log in to upload statements",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx, .xls, or .csv)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to storage
      // Sanitize filename to remove special characters that might cause issues
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${user.id}/statements/${Date.now()}_${sanitizedFileName}`;
      
      // Upload with proper content type
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      let contentType = file.type || 'application/octet-stream';
      
      // Ensure correct MIME type for Excel files (browsers sometimes don't set this correctly)
      if (fileExt === 'xlsx') {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (fileExt === 'xls') {
        contentType = 'application/vnd.ms-excel';
      } else if (fileExt === 'csv') {
        contentType = 'text/csv';
      }
      
      console.log('Uploading file:', {
        path: filePath,
        name: file.name,
        size: file.size,
        type: contentType,
        originalType: file.type,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, file, {
          contentType: contentType,
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error("Upload error details:", {
          error: uploadError,
          message: uploadError.message,
          statusCode: uploadError.statusCode,
        });
        
        // Provide more helpful error messages
        if (uploadError.message?.includes('new row violates row-level security policy') || 
            uploadError.message?.includes('RLS policy')) {
          throw new Error('Permission denied. Please ensure you are logged in and have permission to upload statements.');
        }
        if (uploadError.message?.includes('File size exceeds') || 
            uploadError.message?.includes('too large')) {
          throw new Error('File size exceeds the 20MB limit. Please upload a smaller file.');
        }
        if (uploadError.message?.includes('Invalid file type') || 
            uploadError.message?.includes('MIME type') ||
            uploadError.message?.includes('not allowed')) {
          throw new Error('Invalid file type. The bucket needs to be updated to allow Excel files. Please contact your administrator or run the migration: 20251231030000_update_receipts_bucket_for_statements.sql');
        }
        if (uploadError.statusCode === '400') {
          throw new Error(`Upload failed: ${uploadError.message || 'Bad Request. Please check file format and try again.'}`);
        }
        throw new Error(uploadError.message || 'Failed to upload file. Please try again.');
      }

      if (!uploadData) {
        throw new Error('Upload completed but no data returned');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get file URL after upload');
      }

      console.log('File uploaded successfully:', urlData.publicUrl);

      // Parse Excel file
      const { statement, transactions } = await parseExcelFile(file);

      // Create statement with transactions
      await createStatement.mutateAsync({
        statement: {
          ...statement,
          file_url: urlData.publicUrl,
        },
        transactions,
      });

      toast({
        title: "Success",
        description: `Uploaded and parsed ${transactions.length} transactions`,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload and parse statement",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: company?.currency || "INR",
    }).format(amount);
  };

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bank Statements</h1>
            <p className="text-muted-foreground">
              Upload and manage your bank statements
            </p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Statement</CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx, .xls, or .csv) containing your bank statement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
              ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary/50"}
            `}
            onClick={() => document.getElementById("statement-file-input")?.click()}
          >
            <input
              id="statement-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            {isUploading ? (
              <>
                <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium">Processing statement...</p>
                <p className="text-sm text-muted-foreground">Please wait while we parse your file</p>
              </>
            ) : (
              <>
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">
                  Drag and drop your statement file here, or click to browse
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports .xlsx, .xls, and .csv formats
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statements List */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Statements</CardTitle>
          <CardDescription>
            View and manage your uploaded bank statements
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : statements && statements.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Opening Balance</TableHead>
                  <TableHead>Closing Balance</TableHead>
                  <TableHead>Total Credits</TableHead>
                  <TableHead>Total Debits</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((statement) => (
                  <TableRow
                    key={statement.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedStatementId(
                      selectedStatementId === statement.id ? null : statement.id
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{statement.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {statement.statement_period_start && statement.statement_period_end ? (
                        <div className="text-sm">
                          {format(new Date(statement.statement_period_start), "MMM d, yyyy")} -{" "}
                          {format(new Date(statement.statement_period_end), "MMM d, yyyy")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {(statement.metadata as any)?.total_transactions || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(statement.opening_balance)}</TableCell>
                    <TableCell>{formatCurrency(statement.closing_balance)}</TableCell>
                    <TableCell className="text-green-600">
                      {formatCurrency(statement.total_credits)}
                    </TableCell>
                    <TableCell className="text-red-600">
                      {formatCurrency(statement.total_debits)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(statement.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (statement.file_url) {
                              window.open(statement.file_url, "_blank");
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteStatementId(statement.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium">No statements uploaded</p>
              <p className="text-sm text-muted-foreground">
                Upload your first bank statement to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions Detail */}
      {selectedStatementId && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction Details</CardTitle>
                <CardDescription>
                  Showing {transactions?.length || 0} transactions from the selected statement
                </CardDescription>
              </div>
              {transactions && transactions.length > 0 && (
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Debit Transactions</p>
                    <p className="text-red-600 font-bold text-lg">
                      {transactions.filter(t => t.debit_amount > 0).length}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">Credit Transactions</p>
                    <p className="text-green-600 font-bold text-lg">
                      {transactions.filter(t => t.credit_amount > 0).length}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {transactionsLoading ? (
              <div className="p-6">
                <Skeleton className="h-10 w-full mb-2" />
                <Skeleton className="h-10 w-full mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Value Date</TableHead>
                      <TableHead className="min-w-[250px]">Transaction Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right min-w-[140px] font-semibold">Debit Amount</TableHead>
                      <TableHead className="text-right min-w-[140px] font-semibold">Credit Amount</TableHead>
                      <TableHead className="text-right min-w-[140px] font-semibold">Balance</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, index) => {
                      const metadata = transaction.metadata as any;
                      const allColumns = metadata?.all_columns || [];
                      
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            {format(new Date(transaction.transaction_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            {transaction.value_date 
                              ? format(new Date(transaction.value_date), "MMM d, yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell className="min-w-[400px] max-w-[600px]">
                            <div className="space-y-1">
                              {/* Show full transaction description exactly as in Excel */}
                              <div className="text-sm font-medium break-words leading-relaxed" title={transaction.description}>
                                {transaction.description || "—"}
                              </div>
                              {allColumns.length > 0 && (
                                <details className="mt-2">
                                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                    View all {allColumns.length} columns
                                  </summary>
                                  <div className="mt-2 text-xs space-y-1 max-h-60 overflow-y-auto bg-muted/50 p-3 rounded border">
                                    {allColumns.map((col: any, idx: number) => (
                                      <div key={idx} className="flex justify-between gap-4 py-1 border-b border-border/50 last:border-0">
                                        <span className="font-semibold text-muted-foreground min-w-[120px]">{col.header}:</span>
                                        <span className="text-foreground break-words text-right flex-1">{String(col.value || "—")}</span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{transaction.reference_number || "—"}</span>
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-semibold">
                            {(() => {
                              const metadata = transaction.metadata as any;
                              const originalDebit = metadata?.original_debit;
                              
                              // Always show debit amount if it exists
                              if (transaction.debit_amount > 0) {
                                // Prefer original Excel format, fallback to formatted
                                if (originalDebit && originalDebit !== "" && originalDebit !== "0") {
                                  return (
                                    <div className="whitespace-nowrap font-semibold">
                                      {originalDebit}
                                    </div>
                                  );
                                }
                                return (
                                  <div className="whitespace-nowrap font-semibold">
                                    {formatCurrency(transaction.debit_amount)}
                                  </div>
                                );
                              }
                              return <span className="text-muted-foreground">—</span>;
                            })()}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">
                            {(() => {
                              const metadata = transaction.metadata as any;
                              const originalCredit = metadata?.original_credit;
                              
                              // Always show credit amount if it exists
                              if (transaction.credit_amount > 0) {
                                // ALWAYS prefer original Excel format if available (preserves exact formatting like "30,000.00")
                                if (originalCredit && originalCredit !== "" && originalCredit !== "0" && originalCredit !== "0.00") {
                                  return (
                                    <div className="whitespace-nowrap font-semibold">
                                      {originalCredit}
                                    </div>
                                  );
                                }
                                // Fallback to formatted currency only if original not available
                                return (
                                  <div className="whitespace-nowrap font-semibold">
                                    {formatCurrency(transaction.credit_amount)}
                                  </div>
                                );
                              }
                              return <span className="text-muted-foreground">—</span>;
                            })()}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {(() => {
                              const metadata = transaction.metadata as any;
                              const originalBalance = metadata?.original_balance;
                              // Show original Excel format if available, otherwise format the number
                              if (originalBalance && originalBalance !== "" && originalBalance !== "0") {
                                return <span className="whitespace-nowrap">{originalBalance}</span>;
                              }
                              return transaction.balance !== null && transaction.balance !== undefined ? (
                                <span className="whitespace-nowrap">{formatCurrency(transaction.balance)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              transaction.transaction_type === "debit" ? "destructive" :
                              transaction.transaction_type === "credit" ? "default" : "secondary"
                            }>
                              {transaction.transaction_type}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground">
                No transactions found. The Excel file may not have been parsed correctly.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteStatementId} onOpenChange={() => setDeleteStatementId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Statement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this statement? This will also delete all associated transactions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteStatementId) {
                  deleteStatement.mutate(deleteStatementId);
                  setDeleteStatementId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Statement;
