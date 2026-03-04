// ---------------------------------------------------------------------------
// PayArk SDK – Auto-Pagination
// ---------------------------------------------------------------------------
// Provides an AsyncIterable wrapper around paginated list endpoints.
//
// Usage:
//   for await (const payment of payark.payments.list()) {
//     console.log(payment.id);
//   }
//
// The iterator automatically fetches subsequent pages when the current
// page is exhausted, using the `offset` + `limit` pattern. It stops
// when the API returns fewer items than `limit` (no more pages).
// ---------------------------------------------------------------------------

import type { PaginatedResponse, PaginationMeta } from "./types";

/** Default page size when auto-paginating. */
const DEFAULT_PAGE_SIZE = 100;

/**
 * A paginated list result that doubles as an AsyncIterable.
 *
 * Can be used in two ways:
 *
 * 1. **Traditional** — access `.data` and `.meta` directly:
 *    ```ts
 *    const result = await payark.payments.list({ limit: 10 });
 *    console.log(result.data, result.meta.total);
 *    ```
 *
 * 2. **Auto-pagination** — iterate with `for await`:
 *    ```ts
 *    for await (const payment of payark.payments.list()) {
 *      console.log(payment.id);
 *    }
 *    ```
 *
 * @typeParam T - The resource type (e.g., `Payment`, `Customer`).
 */
export interface AutoPaginatingList<T>
  extends PaginatedResponse<T>, AsyncIterable<T> {}

/**
 * Wraps a paginated API call with an AsyncIterator so consumers can
 * use `for await...of` without manually managing offsets.
 *
 * @param firstPage - The resolved first page of results.
 * @param fetchPage - A function that fetches subsequent pages given an offset.
 * @param pageSize  - The number of items per page (used to calculate next offset).
 * @returns An object with `.data`, `.meta`, and `Symbol.asyncIterator`.
 *
 * @internal
 */
export function createAutoPaginatingList<T>(
  firstPage: PaginatedResponse<T>,
  fetchPage: (offset: number) => Promise<PaginatedResponse<T>>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): AutoPaginatingList<T> {
  return {
    data: firstPage.data,
    meta: firstPage.meta,

    [Symbol.asyncIterator](): AsyncIterator<T> {
      let currentItems = [...firstPage.data];
      let currentIndex = 0;
      let currentOffset = pageSize;
      let done = firstPage.data.length < pageSize;

      return {
        async next(): Promise<IteratorResult<T>> {
          // Yield items from the current page
          if (currentIndex < currentItems.length) {
            return { value: currentItems[currentIndex++], done: false };
          }

          // No more pages to fetch
          if (done) {
            return { value: undefined as any, done: true };
          }

          // Fetch next page
          const nextPage = await fetchPage(currentOffset);
          currentItems = [...nextPage.data];
          currentIndex = 0;
          currentOffset += pageSize;

          // If the page is smaller than pageSize, this is the last page
          if (nextPage.data.length < pageSize) {
            done = true;
          }

          // Yield first item of the new page (or signal done if empty)
          if (currentItems.length > 0) {
            return { value: currentItems[currentIndex++], done: false };
          }

          return { value: undefined as any, done: true };
        },
      };
    },
  };
}
