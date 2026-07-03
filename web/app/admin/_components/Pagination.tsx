"use client";

export const DEFAULT_PAGE_SIZE = 10;

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize?: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  tone?: "default" | "blue";
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

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.25"
      viewBox="0 0 24 24"
    >
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
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

      <div className={`flex min-w-0 items-center justify-center gap-1 rounded-full border px-1.5 py-1.5 sm:col-start-2 ${tone === "blue" ? "border-slate-200 bg-white shadow-sm" : "border-transparent bg-slate-100"}`}>
        <button
          className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:text-slate-300 disabled:opacity-100"
          disabled={safeCurrentPage === 1}
          onClick={() => changePage(safeCurrentPage - 1)}
          type="button"
        >
          <ChevronIcon direction="left" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        <div className="flex min-w-0 items-center gap-0.5 px-1">
          {pageItems.map((item) =>
            typeof item === "number" ? (
              <button
                aria-current={item === safeCurrentPage ? "page" : undefined}
                aria-label={`Go to page ${item}`}
                className={`relative flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full px-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${tone === "blue" ? "focus-visible:ring-blue-400" : "focus-visible:ring-indigo-500"} ${
                  item === safeCurrentPage
                    ? tone === "blue" ? "z-10 bg-blue-600 text-white shadow-sm" : "z-10 -my-1 h-9 min-w-9 bg-indigo-600 text-white shadow-[0_0_0_4px_rgba(129,140,248,0.24),0_8px_18px_-7px_rgba(79,70,229,0.8)]"
                    : tone === "blue" ? "text-slate-600 hover:bg-blue-50 hover:text-blue-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
                key={item}
                onClick={() => changePage(item)}
                type="button"
              >
                {item}
              </button>
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

        <button
          className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:text-slate-300 disabled:opacity-100"
          disabled={safeCurrentPage === safeTotalPages}
          onClick={() => changePage(safeCurrentPage + 1)}
          type="button"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronIcon direction="right" />
        </button>
      </div>

      <p className="text-center text-xs font-medium text-slate-500 sm:col-start-3 sm:row-start-1 sm:justify-self-end sm:text-right">
        {safeTotalPages === 1
          ? `Showing ${totalRecords.toLocaleString()} Results`
          : `Showing ${firstVisibleRecord}–${lastVisibleRecord} of ${totalRecords.toLocaleString()} Results`}
      </p>
    </nav>
  );
}
