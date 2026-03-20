import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/config/supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("../../../src/lib/errors", () => ({
  throwIfDbError: vi.fn((error: unknown, context: string) => {
    if (error) throw new Error(`Database operation failed: ${context}`);
  }),
}));

import { createCrudService } from "../../../src/services/crud.service";
import { getSupabaseAdmin } from "../../../src/config/supabase";
import { throwIfDbError } from "../../../src/lib/errors";

const mockGetSupabaseAdmin = getSupabaseAdmin as ReturnType<typeof vi.fn>;
const mockThrowIfDbError = throwIfDbError as ReturnType<typeof vi.fn>;

const config = {
  table: "reports",
  entityName: "report",
  listSelect: "id, title",
  detailSelect: "id, title, body",
  existsColumn: "analyzed_username",
};

function mockSupabase() {
  const client = {
    from: vi.fn(),
  };
  mockGetSupabaseAdmin.mockReturnValue(client);
  return client;
}

describe("crud.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const service = createCrudService(config);

  describe("list", () => {
    it("queries with user_id filter, orders by generated_at desc", async () => {
      const rangeFn = vi.fn().mockResolvedValue({
        data: [{ id: "1", title: "Report 1" }],
        error: null,
      });
      const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      const result = await service.list("user-1", 10, 0);

      expect(client.from).toHaveBeenCalledWith("reports");
      expect(selectFn).toHaveBeenCalledWith("id, title");
      expect(eqFn).toHaveBeenCalledWith("user_id", "user-1");
      expect(orderFn).toHaveBeenCalledWith("generated_at", { ascending: false });
      expect(rangeFn).toHaveBeenCalledWith(0, 9);
      expect(result).toEqual([{ id: "1", title: "Report 1" }]);
    });

    it("clamps limit to MAX_PAGE_LIMIT (200)", async () => {
      const rangeFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      await service.list("user-1", 500, 0);

      expect(rangeFn).toHaveBeenCalledWith(0, 199);
    });

    it("defaults limit to 50", async () => {
      const rangeFn = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      await service.list("user-1");

      expect(rangeFn).toHaveBeenCalledWith(0, 49);
    });

    it("returns empty array for null data", async () => {
      const rangeFn = vi.fn().mockResolvedValue({ data: null, error: null });
      const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      const result = await service.list("user-1");

      expect(result).toEqual([]);
    });

    it("calls throwIfDbError on error", async () => {
      const dbError = { message: "DB error" };
      const rangeFn = vi.fn().mockResolvedValue({ data: null, error: dbError });
      const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
      const eqFn = vi.fn().mockReturnValue({ order: orderFn });
      const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      await expect(service.list("user-1")).rejects.toThrow(
        "Database operation failed: list report",
      );
      expect(mockThrowIfDbError).toHaveBeenCalledWith(dbError, "list report");
    });
  });

  describe("getById", () => {
    it("queries with id + user_id, uses maybeSingle", async () => {
      const maybeSingleFn = vi.fn().mockResolvedValue({
        data: { id: "abc", title: "Report", body: "content" },
        error: null,
      });
      const eqUser = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const selectFn = vi.fn().mockReturnValue({ eq: eqId });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      const result = await service.getById("user-1", "abc");

      expect(selectFn).toHaveBeenCalledWith("id, title, body");
      expect(eqId).toHaveBeenCalledWith("id", "abc");
      expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
      expect(result).toEqual({ id: "abc", title: "Report", body: "content" });
    });

    it("returns null when no data found", async () => {
      const maybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const eqUser = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const selectFn = vi.fn().mockReturnValue({ eq: eqId });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      const result = await service.getById("user-1", "abc");

      expect(result).toBeNull();
    });

    it("calls throwIfDbError on error", async () => {
      const dbError = { message: "DB error" };
      const maybeSingleFn = vi.fn().mockResolvedValue({
        data: null,
        error: dbError,
      });
      const eqUser = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
      const eqId = vi.fn().mockReturnValue({ eq: eqUser });
      const selectFn = vi.fn().mockReturnValue({ eq: eqId });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      await expect(service.getById("user-1", "abc")).rejects.toThrow(
        "Database operation failed: get report",
      );
    });
  });

  describe("exists", () => {
    it("returns true when data has items", async () => {
      const limitFn = vi.fn().mockResolvedValue({
        data: [{ id: "1" }],
        error: null,
      });
      const eqCol = vi.fn().mockReturnValue({ limit: limitFn });
      const eqUser = vi.fn().mockReturnValue({ eq: eqCol });
      const selectFn = vi.fn().mockReturnValue({ eq: eqUser });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      const result = await service.exists("user-1", "OctoCat");

      expect(eqCol).toHaveBeenCalledWith("analyzed_username", "octocat");
      expect(result).toBe(true);
    });

    it("returns false when data is empty", async () => {
      const limitFn = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const eqCol = vi.fn().mockReturnValue({ limit: limitFn });
      const eqUser = vi.fn().mockReturnValue({ eq: eqCol });
      const selectFn = vi.fn().mockReturnValue({ eq: eqUser });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      const result = await service.exists("user-1", "ghost");

      expect(result).toBe(false);
    });

    it("calls throwIfDbError on error", async () => {
      const dbError = { message: "DB error" };
      const limitFn = vi.fn().mockResolvedValue({
        data: null,
        error: dbError,
      });
      const eqCol = vi.fn().mockReturnValue({ limit: limitFn });
      const eqUser = vi.fn().mockReturnValue({ eq: eqCol });
      const selectFn = vi.fn().mockReturnValue({ eq: eqUser });
      const client = mockSupabase();
      client.from.mockReturnValue({ select: selectFn });

      await expect(service.exists("user-1", "ghost")).rejects.toThrow(
        "Database operation failed: check report exists",
      );
    });
  });

  describe("deleteBatch", () => {
    it("deletes with .in(id, ids).eq(user_id)", async () => {
      const eqFn = vi.fn().mockResolvedValue({ error: null });
      const inFn = vi.fn().mockReturnValue({ eq: eqFn });
      const deleteFn = vi.fn().mockReturnValue({ in: inFn });
      const client = mockSupabase();
      client.from.mockReturnValue({ delete: deleteFn });

      await service.deleteBatch("user-1", ["id-1", "id-2"]);

      expect(client.from).toHaveBeenCalledWith("reports");
      expect(inFn).toHaveBeenCalledWith("id", ["id-1", "id-2"]);
      expect(eqFn).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("calls throwIfDbError on error", async () => {
      const dbError = { message: "DB error" };
      const eqFn = vi.fn().mockResolvedValue({ error: dbError });
      const inFn = vi.fn().mockReturnValue({ eq: eqFn });
      const deleteFn = vi.fn().mockReturnValue({ in: inFn });
      const client = mockSupabase();
      client.from.mockReturnValue({ delete: deleteFn });

      await expect(
        service.deleteBatch("user-1", ["id-1"]),
      ).rejects.toThrow("Database operation failed: delete report");
    });
  });
});
