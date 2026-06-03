"use client";

import styles from "./AdminPagination.module.css";

type PageItem = number | "jump-prev" | "jump-next";

let animationTimer: number | null = null;

type AdminPaginationProps = {
  page: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
};

function getPageItems(page: number, totalPages: number): PageItem[] {
  const pages: PageItem[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i);
    return pages;
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, "jump-next", totalPages];
  }

  if (page >= totalPages - 3) {
    return [1, "jump-prev", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "jump-prev", page - 1, page, page + 1, "jump-next", totalPages];
}

export default function AdminPagination({
  page,
  totalItems,
  itemsPerPage,
  onPageChange,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const endItem = Math.min(safePage * itemsPerPage, totalItems);
  const pages = getPageItems(safePage, totalPages);

  const changePage = (nextPage: number) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    document.documentElement.classList.add("admin-pagination-animating");
    if (animationTimer) window.clearTimeout(animationTimer);
    animationTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("admin-pagination-animating");
    }, 900);

    onPageChange(nextPage);
  };

  return (
    <div className={styles.pagination}>
      <span className={styles.info}>
        Menampilkan data <strong>{startItem}</strong> - <strong>{endItem}</strong> dari <strong>{totalItems}</strong>
      </span>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          onClick={() => changePage(Math.max(1, safePage - 1))}
          disabled={safePage === 1}
        >
          Prev
        </button>

        {pages.map((item, idx) => {
          if (item === "jump-prev" || item === "jump-next") {
            return (
              <span key={`${item}-${idx}`} className={styles.ellipsis}>
                ...
              </span>
            );
          }

          return (
            <button
              type="button"
              key={item}
              className={`${styles.pageButton} ${item === safePage ? styles.pageButtonActive : ""}`}
              onClick={() => changePage(item)}
            >
              {item}
            </button>
          );
        })}

        <button
          type="button"
          className={styles.button}
          onClick={() => changePage(Math.min(totalPages, safePage + 1))}
          disabled={safePage === totalPages}
        >
          Next
        </button>

        <div className={styles.jump}>
          <span className={styles.jumpLabel}>Ke hal:</span>
          <select
            className={styles.select}
            value={safePage}
            onChange={(event) => changePage(Number(event.target.value))}
          >
            {Array.from({ length: totalPages }).map((_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
