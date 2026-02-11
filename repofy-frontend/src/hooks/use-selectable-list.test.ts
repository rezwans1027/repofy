import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSelectableList } from "./use-selectable-list";

describe("useSelectableList", () => {
  it("starts with empty selection and selectMode=false", () => {
    const { result } = renderHook(() => useSelectableList());
    expect(result.current.selectMode).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });

  it("toggles individual selection", () => {
    const { result } = renderHook(() => useSelectableList());

    act(() => {
      result.current.toggleSelect("id-1");
    });
    expect(result.current.selected.has("id-1")).toBe(true);

    act(() => {
      result.current.toggleSelect("id-1");
    });
    expect(result.current.selected.has("id-1")).toBe(false);
  });

  it("selects all when not all are selected", () => {
    const { result } = renderHook(() => useSelectableList());
    const ids = ["id-1", "id-2", "id-3"];

    act(() => {
      result.current.toggleSelectAll(ids);
    });
    expect(result.current.selected.size).toBe(3);
    expect(result.current.selected.has("id-1")).toBe(true);
    expect(result.current.selected.has("id-2")).toBe(true);
    expect(result.current.selected.has("id-3")).toBe(true);
  });

  it("deselects all when all are selected", () => {
    const { result } = renderHook(() => useSelectableList());
    const ids = ["id-1", "id-2"];

    // Select all first
    act(() => {
      result.current.toggleSelectAll(ids);
    });
    expect(result.current.selected.size).toBe(2);

    // Toggle again should deselect all
    act(() => {
      result.current.toggleSelectAll(ids);
    });
    expect(result.current.selected.size).toBe(0);
  });

  it("exitSelectMode clears selection and mode", () => {
    const { result } = renderHook(() => useSelectableList());

    act(() => {
      result.current.setSelectMode(true);
      result.current.toggleSelect("id-1");
    });
    expect(result.current.selectMode).toBe(true);
    expect(result.current.selected.size).toBe(1);

    act(() => {
      result.current.exitSelectMode();
    });
    expect(result.current.selectMode).toBe(false);
    expect(result.current.selected.size).toBe(0);
  });

  it("handleDelete calls deleteFn and clears selection on success", async () => {
    const { result } = renderHook(() => useSelectableList());
    const deleteFn = vi.fn().mockResolvedValue(undefined);

    act(() => {
      result.current.setSelectMode(true);
      result.current.toggleSelect("id-1");
      result.current.toggleSelect("id-2");
    });

    await act(async () => {
      await result.current.handleDelete(deleteFn);
    });

    expect(deleteFn).toHaveBeenCalledWith(expect.arrayContaining(["id-1", "id-2"]));
    expect(result.current.selected.size).toBe(0);
    expect(result.current.selectMode).toBe(false);
  });

  it("handleDelete keeps selection on failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useSelectableList());
    const deleteFn = vi.fn().mockRejectedValue(new Error("fail"));

    act(() => {
      result.current.toggleSelect("id-1");
    });

    await act(async () => {
      await result.current.handleDelete(deleteFn);
    });

    expect(result.current.selected.size).toBe(1);
    consoleSpy.mockRestore();
  });
});
