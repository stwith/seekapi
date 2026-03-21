import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

export function DataTable<T>({ columns, rows, rowKey }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table data-testid="data-table" className="w-full text-sm text-left">
        <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="bg-gray-900 hover:bg-gray-800 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-gray-300">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
