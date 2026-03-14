import { describe, it, expect, vi, beforeEach } from "vitest";
import { createControllerMocks } from "../../helpers/controller-mocks";

vi.mock("../../../src/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createCrudController } from "../../../src/controllers/crud.controller";
import { MAX_DELETE_IDS } from "../../../src/lib/validators";

function createMockService() {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    exists: vi.fn(),
    deleteBatch: vi.fn(),
  };
}

describe("deleteBatch validation", () => {
  let mockService: ReturnType<typeof createMockService>;
  let controller: ReturnType<typeof createCrudController>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = createMockService();
    controller = createCrudController({
      service: mockService,
      entityName: "report",
    });
  });

  it("succeeds with a valid batch of IDs", async () => {
    mockService.deleteBatch.mockResolvedValue(undefined);
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: ["id-1", "id-2", "id-3"] };

    await controller.deleteBatch(req, res, next);

    expect(mockService.deleteBatch).toHaveBeenCalledWith("user-123", [
      "id-1",
      "id-2",
      "id-3",
    ]);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it("succeeds with a single ID in the array", async () => {
    mockService.deleteBatch.mockResolvedValue(undefined);
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: ["id-1"] };

    await controller.deleteBatch(req, res, next);

    expect(mockService.deleteBatch).toHaveBeenCalledWith("user-123", ["id-1"]);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it("rejects an empty array", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: [] };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it("rejects when ids is not an array (string)", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: "not-an-array" };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it("rejects when ids is not an array (number)", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: 42 };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it("rejects when ids is null", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: null };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it("rejects when ids is undefined (missing from body)", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = {};

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it("rejects array containing non-string elements (numbers)", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: [1, 2, 3] };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it("rejects array with mixed types (strings and numbers)", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: ["id-1", 2, "id-3"] };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it("rejects array containing null elements", async () => {
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: ["id-1", null, "id-3"] };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "ids must be a non-empty array of strings",
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it(`rejects array exceeding MAX_DELETE_IDS (${MAX_DELETE_IDS})`, async () => {
    const oversizedIds = Array.from(
      { length: MAX_DELETE_IDS + 1 },
      (_, i) => `id-${i}`,
    );
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: oversizedIds };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: `Cannot delete more than ${MAX_DELETE_IDS} items at once`,
    });
    expect(mockService.deleteBatch).not.toHaveBeenCalled();
  });

  it(`accepts array at exactly MAX_DELETE_IDS (${MAX_DELETE_IDS})`, async () => {
    mockService.deleteBatch.mockResolvedValue(undefined);
    const exactIds = Array.from(
      { length: MAX_DELETE_IDS },
      (_, i) => `id-${i}`,
    );
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: exactIds };

    await controller.deleteBatch(req, res, next);

    expect(mockService.deleteBatch).toHaveBeenCalledWith("user-123", exactIds);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it("returns 500 when service.deleteBatch throws a generic error", async () => {
    mockService.deleteBatch.mockRejectedValue(new Error("DB connection lost"));
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: ["id-1"] };

    await controller.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Failed to delete reports",
    });
  });

  it("returns nothing when request signal is aborted", async () => {
    mockService.deleteBatch.mockRejectedValue(new Error("aborted"));
    const { req, res, next, abortController } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: ["id-1"] };
    abortController.abort();

    await controller.deleteBatch(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("uses the entityName in error messages", async () => {
    const adviceController = createCrudController({
      service: mockService,
      entityName: "advice",
    });
    mockService.deleteBatch.mockRejectedValue(new Error("fail"));
    const { req, res, next } = createControllerMocks();
    (req as any).userId = "user-123";
    (req as any).body = { ids: ["id-1"] };

    await adviceController.deleteBatch(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Failed to delete advices",
    });
  });
});
