import { useState, useCallback } from 'react';

export interface TablePaginationControls {
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  getPaginationProps: (totalItems: number, totalPagesOverride?: number) => {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
  };
}

export function useTablePagination(initialPage = 1, initialPageSize = 20): TablePaginationControls {
  const [page, setPageState] = useState<number>(initialPage);
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize);

  const setPage = useCallback((p: number) => {
    setPageState(Math.max(1, p));
  }, []);

  // when page size changes, reset to first page by default
  const setPageSize = useCallback((s: number) => {
    setPageSizeState(s);
    setPageState(1);
  }, []);

  const getPaginationProps = useCallback(
    (totalItems: number, totalPagesOverride?: number) => {
      const totalPages = totalPagesOverride ?? Math.max(1, Math.ceil(totalItems / pageSize));
      return {
        currentPage: page,
        totalPages,
        pageSize,
        totalItems,
        onPageChange: setPage,
        onPageSizeChange: setPageSize,
      };
    },
    [page, pageSize, setPage, setPageSize]
  );

  return { page, pageSize, setPage, setPageSize, getPaginationProps };
}
