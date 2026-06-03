import styles from "./Pagination.module.css";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel?: string;
  className?: string;
  onPageChange: (page: number) => void;
};

function getVisiblePages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  itemLabel = "data",
  className = "",
  onPageChange,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, currentPage), safeTotalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const visiblePages = getVisiblePages(safePage, safeTotalPages);

  return (
    <div className={`${styles.paginationFooter} ${className}`.trim()}>
      <div className={styles.paginationSummary}>
        <span className={styles.summaryMain}>{start}-{end}</span>
        <span className={styles.summaryText}>dari {totalItems} {itemLabel}</span>
      </div>

      <div className={styles.paginationControls}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
          aria-label="Halaman sebelumnya"
        >
          <span aria-hidden>‹</span>
          <span className={styles.navText}>Prev</span>
        </button>

        <div className={styles.pageNumbers}>
          {visiblePages.map((page, index) => {
            const prevPage = visiblePages[index - 1];
            const showGap = prevPage && page - prevPage > 1;

            return (
              <span key={page} className={styles.pageNumberGroup}>
                {showGap && <span className={styles.gap}>…</span>}
                <button
                  type="button"
                  className={`${styles.pageButton} ${page === safePage ? styles.pageButtonActive : ""}`}
                  onClick={() => onPageChange(page)}
                  aria-current={page === safePage ? "page" : undefined}
                >
                  {page}
                </button>
              </span>
            );
          })}
        </div>

        <button
          type="button"
          className={styles.navButton}
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          disabled={safePage === safeTotalPages}
          aria-label="Halaman berikutnya"
        >
          <span className={styles.navText}>Next</span>
          <span aria-hidden>›</span>
        </button>
      </div>
    </div>
  );
}
