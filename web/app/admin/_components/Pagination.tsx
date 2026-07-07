"use client";

import { AppIcons } from "@/config/icons";
import { AppButton } from "@/components/ui/AppButton";

export const DEFAULT_PAGE_SIZE = 10;

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  tone?: "default" | "blue" | "purple";
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";

function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis-end", totalPages - 1, totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [1, 2, "ellipsis-start", totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "ellipsis-start",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis-end",
    totalPages,
  ];
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize = DEFAULT_PAGE_SIZE,
  totalRecords,
  onPageChange,
  tone = "default",
}: PaginationProps) {
  const calculatedTotalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safeTotalPages =
    totalPages === calculatedTotalPages ? totalPages : calculatedTotalPages;
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), safeTotalPages);
  const pageItems = getPageItems(safeCurrentPage, safeTotalPages);
  const firstVisibleRecord = totalRecords === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const lastVisibleRecord = Math.min(safeCurrentPage * pageSize, totalRecords);
  const isPurple = tone === "purple";
  const PreviousIcon = AppIcons.previous;
  const NextIcon = AppIcons.next;

  function changePage(page: number) {
    onPageChange(Math.min(Math.max(page, 1), safeTotalPages));
  }

  return (
    <nav
      aria-label="Pagination"
      className="grid gap-2 py-1 sm:grid-cols-[1fr_auto_1fr] sm:items-center"
    >
      <span className="sr-only">
        Page {safeCurrentPage} of {safeTotalPages}, showing up to {pageSize} of {totalRecords} records
      </span>

      <div className={`flex min-w-0 items-center justify-center gap-1 rounded-full border px-1.5 py-1.5 sm:col-start-2 ${isPurple ? "border-white/80 bg-white/70 shadow-[0_10px_30px_-16px_rgba(109,74,255,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-purple-100/70 backdrop-blur-xl" : tone === "blue" ? "border-slate-200 bg-white shadow-sm" : "border-transparent bg-slate-100"}`}>
        <AppButton
          className={`h-8 min-h-8 px-2 text-xs disabled:opacity-100 ${isPurple ? "focus-visible:ring-purple-400" : "focus-visible:ring-blue-400"}`}
          disabled={safeCurrentPage === 1}
          icon={PreviousIcon}
          onClick={() => changePage(safeCurrentPage - 1)}
          size="sm"
          type="button"
          variant="pagination"
        >
          <span className="hidden sm:inline">Previous</span>
        </AppButton>

        <div className="flex min-w-0 items-center gap-0.5 px-1">
          {pageItems.map((item) =>
            typeof item === "number" ? (
              <AppButton
                aria-current={item === safeCurrentPage ? "page" : undefined}
                aria-label={`Go to page ${item}`}
                active={item === safeCurrentPage}
                className={`relative h-8 min-h-8 min-w-8 px-2 text-sm ${isPurple ? "focus-visible:ring-purple-400" : tone === "blue" ? "focus-visible:ring-blue-400" : "focus-visible:ring-indigo-500"}`}
                key={item}
                onClick={() => changePage(item)}
                size="sm"
                type="button"
                variant="pagination"
              >
                {item}
              </AppButton>
            ) : (
              <span
                aria-hidden
                className="flex h-8 min-w-7 shrink-0 items-center justify-center text-sm font-semibold text-slate-400"
                key={item}
              >
                &hellip;
              </span>
            ),
          )}
        </div>

        <AppButton
          className={`h-8 min-h-8 px-2 text-xs disabled:opacity-100 ${isPurple ? "focus-visible:ring-purple-400" : "focus-visible:ring-blue-400"}`}
          disabled={safeCurrentPage === safeTotalPages}
          icon={NextIcon}
          onClick={() => changePage(safeCurrentPage + 1)}
          size="sm"
          type="button"
          variant="pagination"
        >
          <span className="hidden sm:inline">Next</span>
        </AppButton>
      </div>

      <p className="text-center text-xs font-medium text-slate-500 sm:col-start-3 sm:row-start-1 sm:justify-self-end sm:text-right">
        {safeTotalPages === 1
          ? `Showing ${totalRecords.toLocaleString()} Results`
          : `Showing ${firstVisibleRecord}–${lastVisibleRecord} of ${totalRecords.toLocaleString()} Results`}
      </p>
    </nav>
  );
}
