// Showcase note: the composed DataTable that every list in the product is built on:
// admin payments, organizer players, teams, orders. Sorting, filtering, pagination,
// column visibility and row selection live here once, on top of TanStack Table.

'use client';

import * as React from 'react';
import {
  Column,
  flexRender,
  Table as ReactTable,
  Row
} from '@tanstack/react-table';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  DownloadIcon,
  EyeOffIcon,
  PlusCircleIcon,
  Settings2Icon
} from 'lucide-react';

import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from './command';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './dropdown-menu';
import { EmptyText } from './empty-text';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { ScrollArea } from './scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select';
import { Separator } from './separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type TableProps
} from './table';

// Export utilities - these will be dynamically imported to avoid bundling issues
const exportToCSV = async <TData,>(
  table: ReactTable<TData>,
  filename: string
) => {
  const Papa = (await import('papaparse')).default;
  const rows = table.getPrePaginationRowModel().rows;
  const headers = table
    .getVisibleLeafColumns()
    .filter((col) => col.id !== 'select' && col.id !== 'actions')
    .map((col) => 
      (col.columnDef.meta as any)?.title || col.id
    );

  const data = rows.map((row) =>
    table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== 'select' && col.id !== 'actions')
      .reduce((acc, col) => {
        const value = row.getValue(col.id);
        acc[col.id] = typeof value === 'string' || typeof value === 'number' 
          ? value 
          : String(value || '');
        return acc;
      }, {} as Record<string, any>)
  );

  const csv = Papa.unparse({ fields: headers, data });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToExcel = async <TData,>(
  table: ReactTable<TData>,
  filename: string
) => {
  const XLSX = await import('xlsx');
  const rows = table.getPrePaginationRowModel().rows;
  const headers = table
    .getVisibleLeafColumns()
    .filter((col) => col.id !== 'select' && col.id !== 'actions')
    .map((col) => 
      (col.columnDef.meta as any)?.title || col.id
    );

  const data = [
    headers,
    ...rows.map((row) =>
      table
        .getVisibleLeafColumns()
        .filter((col) => col.id !== 'select' && col.id !== 'actions')
        .map((col) => {
          const value = row.getValue(col.id);
          return typeof value === 'string' || typeof value === 'number' 
            ? value 
            : String(value || '');
        })
    )
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

const exportToPDF = async <TData,>(
  table: ReactTable<TData>,
  filename: string,
  title?: string
) => {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF();
  
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 20);
  }

  const rows = table.getPrePaginationRowModel().rows;
  const headers = table
    .getVisibleLeafColumns()
    .filter((col) => col.id !== 'select' && col.id !== 'actions')
    .map((col) => 
      (col.columnDef.meta as any)?.title || col.id
    );

  const data = rows.map((row) =>
    table
      .getVisibleLeafColumns()
      .filter((col) => col.id !== 'select' && col.id !== 'actions')
      .map((col) => {
        const value = row.getValue(col.id);
        return typeof value === 'string' || typeof value === 'number' 
          ? value 
          : String(value || '');
      })
  );

  // Use autoTable directly
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: title ? 30 : 20,
  });

  doc.save(`${filename}.pdf`);
};

export type DataTableProps<TData> = TableProps & {
  table: ReactTable<TData>;
  fixedHeader?: boolean;
  onRowClicked?: (row: Row<TData>) => void;
};
function DataTable<TData>({
  table,
  fixedHeader,
  onRowClicked,
  ...other
}: DataTableProps<TData>): React.JSX.Element {
  const visibleColumns = table
    .getAllColumns()
    .filter((c) => c.getIsVisible()).length;
  const helperColumns = table
    .getAllColumns()
    .filter(
      (c) => (c.id === 'select' || c.id === 'actions') && c.getIsVisible()
    ).length;

  const flexColumns = visibleColumns - helperColumns;
  return (
    <Table {...other}>
      <TableHeader className={cn(fixedHeader && 'sticky top-0 z-20 shadow-xs')}>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                style={{
                  width:
                    header.column.getSize() !== 0
                      ? header.column.getSize()
                      : `${100 / flexColumns}%`,
                  minWidth:
                    header.column.getSize() !== 0
                      ? header.column.getSize()
                      : `${100 / flexColumns}%`
                }}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody showLastRowBorder>
        {table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && 'selected'}
              className={onRowClicked && 'cursor-pointer'}
              onClick={() => {
                onRowClicked?.(row);
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow className="bg-transparent!">
            <TableCell
              colSpan={table.getAllColumns().length}
              className="h-24 text-center"
            >
              <EmptyText>No results.</EmptyText>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export type DataTableColumnHeaderProps<TData, TValue> =
  React.HTMLAttributes<HTMLDivElement> & {
    column: Column<TData, TValue>;
    title: string;
  };
function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort() && !column.getCanHide()) {
    return <div className={cn(className)}>{title}</div>;
  }
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 text-sm data-[state=open]:bg-accent"
          >
            <span>{title}</span>
            {column.getIsSorted() === 'desc' ? (
              <ArrowDownIcon className="size-4 shrink-0" />
            ) : column.getIsSorted() === 'asc' ? (
              <ArrowUpIcon className="size-4 shrink-0" />
            ) : (
              <ArrowUpDownIcon className="size-4 shrink-0" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {column.getCanSort() && (
            <>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => column.toggleSorting(false)}
              >
                <ArrowUpIcon className="size-3.5 text-muted-foreground/70" />
                Sort ascending
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => column.toggleSorting(true)}
              >
                <ArrowDownIcon className="size-3.5 text-muted-foreground/70" />
                Sort descending
              </DropdownMenuItem>
            </>
          )}
          {column.getCanSort() && column.getCanHide() && (
            <DropdownMenuSeparator />
          )}
          {column.getCanHide() && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => column.toggleVisibility(false)}
            >
              <EyeOffIcon className="size-3.5 text-muted-foreground/70" />
              Hide column
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export type DataTableColumnOptionsHeaderProps<TData> = {
  table: ReactTable<TData>;
};
function DataTableColumnOptionsHeader<TData>({
  table
}: DataTableColumnOptionsHeaderProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="ml-auto mr-4 flex size-8 data-[state=open]:bg-muted"
        >
          <Settings2Icon className="size-4 shrink-0" />
          <span className="sr-only">Column options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[150px]"
      >
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== 'undefined' && column.getCanHide()
          )
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="capitalize"
              checked={column.getIsVisible()}
              onCheckedChange={(value) => column.toggleVisibility(!!value)}
            >
              {(
                column.columnDef.meta as typeof column.columnDef.meta & {
                  title?: string;
                }
              )?.title ?? column.columnDef.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type DataTablePaginationProps<TData> = {
  table: ReactTable<TData>;
  pageSizeOptions?: number[];
};
function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 30, 40, 50]
}: DataTablePaginationProps<TData>): React.JSX.Element {
  return (
    <div className="sticky inset-x-0 bottom-0 z-20 border-t bg-background">
      <div className="flex flex-row items-center justify-between gap-2 space-x-2 px-6 py-3">
        <div className="flex flex-row items-center gap-4 sm:gap-6 lg:gap-8">
          <div className="flex items-center space-x-2">
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-16">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem
                    key={pageSize}
                    value={`${pageSize}`}
                  >
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="whitespace-nowrap text-sm font-medium">
              <span className="hidden sm:inline">rows per page</span>
              <span className="sm:hidden">rows</span>
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
          <Button
            aria-label="Go to first page"
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeftIcon
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          </Button>
          <Button
            aria-label="Go to previous page"
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          </Button>
          <Button
            aria-label="Go to next page"
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          </Button>
          <Button
            aria-label="Go to last page"
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRightIcon
              className="size-4 shrink-0"
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

export type DataTableSelectionProps<TData> = React.PropsWithChildren<{
  table: ReactTable<TData>;
}>;
function DataTableBulkActions<TData>({
  table,
  children
}: DataTableSelectionProps<TData>): React.JSX.Element {
  return (
    <div className="absolute inset-x-0 bottom-12 z-50 mx-auto flex h-[60px] max-w-xl animate-fadeIn items-center justify-between rounded-md border bg-background px-6 py-3 shadow">
      <p className="text-sm font-semibold">
        {table.getSelectedRowModel().rows.length} selected
      </p>
      {children}
    </div>
  );
}

export type DataTableFilterProps = {
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  selected: string[];
  onChange: (values: string[]) => void;
};
function DataTableFilter({
  title,
  options,
  selected,
  onChange
}: DataTableFilterProps) {
  const selectedValues = new Set(selected);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-dashed text-sm"
        >
          <PlusCircleIcon className="size-4 shrink-0" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator
                orientation="vertical"
                className="mx-2 h-4"
              />
              <Badge
                variant="secondary"
                className="rounded-sm px-1 font-normal lg:hidden"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1 font-normal"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant="secondary"
                        key={option.value}
                        className="rounded-sm px-1 font-normal"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[200px] overflow-hidden p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={title} />
          <CommandList className="h-auto max-h-max overflow-hidden">
            <ScrollArea className="h-56">
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => {
                  const isSelected = selectedValues.has(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      onSelect={() => {
                        if (isSelected) {
                          selectedValues.delete(option.value);
                        } else {
                          selectedValues.add(option.value);
                        }
                        const filterValues = Array.from(selectedValues);
                        onChange(filterValues.length ? filterValues : []);
                      }}
                    >
                      <div
                        className={cn(
                          'mr-2 flex size-4 items-center justify-center rounded-sm border border-primary',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'opacity-50 [&_svg]:invisible'
                        )}
                      >
                        <CheckIcon className="text-current size-4 shrink-0" />
                      </div>
                      {option.icon && (
                        <option.icon className="mr-2 size-4 text-muted-foreground" />
                      )}
                      <span>{option.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {selectedValues.size > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => onChange([])}
                      className="justify-center text-center"
                    >
                      Clear filters
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export type DataTableExportProps<TData> = {
  table: ReactTable<TData>;
  filename?: string;
  title?: string;
};
function DataTableExport<TData>({
  table,
  filename = 'data',
  title
}: DataTableExportProps<TData>): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-sm">
          <DownloadIcon className="size-4 shrink-0" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export data</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => exportToCSV(table, filename)}
          className="cursor-pointer"
        >
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportToExcel(table, filename)}
          className="cursor-pointer"
        >
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => exportToPDF(table, filename, title)}
          className="cursor-pointer"
        >
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export {
  DataTable,
  DataTableBulkActions,
  DataTableColumnHeader,
  DataTableColumnOptionsHeader,
  DataTableExport,
  DataTableFilter,
  DataTablePagination
};
