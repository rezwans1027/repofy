"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";

export function ExportDataButton() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const data = await api.get("/auth/export-data");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "repofy-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handled by api-client (will throw ApiError)
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleExport}
      disabled={loading}
      className="font-mono text-xs gap-2"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      Export My Data
    </Button>
  );
}
