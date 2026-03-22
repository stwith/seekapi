import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export interface Column<T> {
  key?: string;
  header: string;
  accessor?: keyof T;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = "No data available",
  onRowClick,
}: DataTableProps<T>) {
  return (
    <Table data-testid="data-table">
      <TableHeader>
        <TableRow>
          {columns.map((col, i) => (
            <TableHead key={i}>{col.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 5 }, (_, rowIdx) => (
              <TableRow key={`skel-${rowIdx}`}>
                {columns.map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.length === 0
            ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24">
                    <EmptyState message={emptyMessage} />
                  </TableCell>
                </TableRow>
              )
            : rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  className={cn(
                    "transition-colors hover:bg-muted/50",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col, colIdx) => (
                    <TableCell key={colIdx}>
                      {col.render
                        ? col.render(row)
                        : col.accessor != null
                          ? String(row[col.accessor] ?? "")
                          : null}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
      </TableBody>
    </Table>
  );
}
