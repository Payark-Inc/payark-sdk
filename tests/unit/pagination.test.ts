// ---------------------------------------------------------------------------
// PayArk SDK – Auto-Pagination Unit Tests
// ---------------------------------------------------------------------------
// Verifies the AsyncIterator implementation:
//   - Single-page iteration
//   - Multi-page fetching
//   - Empty result sets
//   - Backward-compatible .data/.meta access
// ---------------------------------------------------------------------------

import { describe, test, expect } from "bun:test";
import { createAutoPaginatingList } from "../../src/pagination";
import type { PaginatedResponse } from "../../src/types";

interface MockItem {
  id: string;
}

function makePage(
  items: MockItem[],
  total: number,
  limit: number,
  offset: number,
): PaginatedResponse<MockItem> {
  return {
    data: items,
    meta: { total, limit, offset },
  };
}

describe("Auto-Pagination", () => {
  test("should yield all items from a single page", async () => {
    const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
    const page = makePage(items, 3, 10, 0);

    const list = createAutoPaginatingList(
      page,
      async () => makePage([], 3, 10, 10),
      10,
    );

    const collected: MockItem[] = [];
    for await (const item of list) {
      collected.push(item);
    }

    expect(collected).toHaveLength(3);
    expect(collected.map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  test("should fetch multiple pages automatically", async () => {
    const page1 = makePage([{ id: "1" }, { id: "2" }], 5, 2, 0);
    const page2 = makePage([{ id: "3" }, { id: "4" }], 5, 2, 2);
    const page3 = makePage([{ id: "5" }], 5, 2, 4); // last page (< limit)

    let fetchCount = 0;
    const fetchPage = async (offset: number) => {
      fetchCount++;
      if (offset === 2) return page2;
      if (offset === 4) return page3;
      throw new Error(`Unexpected offset: ${offset}`);
    };

    const list = createAutoPaginatingList(page1, fetchPage, 2);

    const collected: string[] = [];
    for await (const item of list) {
      collected.push(item.id);
    }

    expect(collected).toEqual(["1", "2", "3", "4", "5"]);
    expect(fetchCount).toBe(2); // 2 additional fetches (page1 was provided)
  });

  test("should handle empty result set", async () => {
    const emptyPage = makePage([], 0, 10, 0);

    const list = createAutoPaginatingList(
      emptyPage,
      async () => {
        throw new Error("Should not fetch more pages");
      },
      10,
    );

    const collected: MockItem[] = [];
    for await (const item of list) {
      collected.push(item);
    }

    expect(collected).toHaveLength(0);
  });

  test("should preserve .data and .meta for backward compatibility", async () => {
    const items = [{ id: "a" }, { id: "b" }];
    const page = makePage(items, 42, 10, 0);

    const list = createAutoPaginatingList(
      page,
      async () => makePage([], 42, 10, 10),
      10,
    );

    // Traditional access still works
    expect(list.data).toHaveLength(2);
    expect(list.meta.total).toBe(42);
    expect(list.meta.limit).toBe(10);
    expect(list.meta.offset).toBe(0);
  });

  test("should stop iteration when last page returns fewer items than limit", async () => {
    const page1 = makePage([{ id: "1" }, { id: "2" }, { id: "3" }], 4, 3, 0);
    const page2 = makePage([{ id: "4" }], 4, 3, 3);

    const list = createAutoPaginatingList(page1, async () => page2, 3);

    const collected: string[] = [];
    for await (const item of list) {
      collected.push(item.id);
    }

    expect(collected).toEqual(["1", "2", "3", "4"]);
  });
});
