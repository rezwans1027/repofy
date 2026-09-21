import { expect, it, vi } from "vitest";
import { RubricRepository } from "../../../src/domain/rubrics/repository";
import { initialRubricCatalog } from "../../../src/domain/rubrics/catalog";
const actor = "00000000-0000-4000-8000-000000000001";

it("reads active and historical manifests with an authenticated actor", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: initialRubricCatalog, error: null });
  const repository = new RubricRepository({ rpc });
  expect(await repository.read(actor)).toEqual(initialRubricCatalog);
  expect(rpc).toHaveBeenLastCalledWith("feature_one_read_rubric_catalog", { p_actor: actor, p_release_id: null });
  expect(await repository.read(actor, "readiness_1_0_0")).toEqual(initialRubricCatalog);
  expect(rpc).toHaveBeenLastCalledWith("feature_one_read_rubric_catalog", { p_actor: actor, p_release_id: "readiness_1_0_0" });
  rpc.mockResolvedValue({ data: null, error: null });
  expect(await repository.read(actor)).toBeNull();
});
it("rejects invalid actors and release keys before RPC access", async () => {
  const rpc = vi.fn(); const repository = new RubricRepository({ rpc });
  await expect(repository.read("not-an-actor")).rejects.toThrow();
  await expect(repository.read(actor, "../invalid")).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
});
it("sanitizes provider errors and invalid stored manifests", async () => {
  const rpc = vi.fn(); const repository = new RubricRepository({ rpc });
  for (const response of [{ data: null, error: { message: "private-sentinel" } }, { data: { private: "sentinel" }, error: null }]) {
    rpc.mockResolvedValue(response);
    await expect(repository.read(actor)).rejects.toThrow("Rubric discovery unavailable");
  }
  rpc.mockRejectedValue(new Error("private-sentinel"));
  await expect(repository.read(actor)).rejects.toThrow("Rubric discovery unavailable");
});
