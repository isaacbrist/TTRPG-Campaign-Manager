"use client";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center flex-wrap gap-1.5 mt-4">
      {/* First */}
      <button
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        aria-label="First page"
        className="px-2 py-1 rounded-lg border border-stone-700 bg-stone-900 text-stone-400 hover:border-amber-800/60 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-medium"
      >
        «
      </button>

      {/* Prev */}
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="px-2.5 py-1 rounded-lg border border-stone-700 bg-stone-900 text-stone-400 hover:border-amber-800/60 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
      >
        ‹ Prev
      </button>

      {/* Page indicator */}
      <span className="px-2 py-1 text-xs text-stone-500 select-none whitespace-nowrap">
        <span className="text-amber-400 font-semibold">{page}</span>
        <span className="text-stone-600"> / </span>
        <span className="text-stone-400">{totalPages}</span>
      </span>

      {/* Next */}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="px-2.5 py-1 rounded-lg border border-stone-700 bg-stone-900 text-stone-400 hover:border-amber-800/60 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
      >
        Next ›
      </button>

      {/* Last */}
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        aria-label="Last page"
        className="px-2 py-1 rounded-lg border border-stone-700 bg-stone-900 text-stone-400 hover:border-amber-800/60 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-medium"
      >
        »
      </button>
    </div>
  );
}
