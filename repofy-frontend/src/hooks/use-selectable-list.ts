import { useState, useCallback } from "react";

export function useSelectableList() {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((filteredIds: string[]) => {
    setSelected((prev) => {
      const allSelected =
        filteredIds.length > 0 && filteredIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const handleDelete = useCallback(
    async (deleteFn: (ids: string[]) => Promise<void>) => {
      const ids = [...selected];
      try {
        await deleteFn(ids);
        setSelected(new Set());
        setSelectMode(false);
      } catch (err) {
        console.error("Delete failed:", err);
      }
    },
    [selected],
  );

  return {
    selected,
    selectMode,
    setSelectMode,
    toggleSelect,
    toggleSelectAll,
    exitSelectMode,
    handleDelete,
  };
}
