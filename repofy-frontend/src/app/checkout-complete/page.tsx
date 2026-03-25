"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Check, X } from "lucide-react";

function CheckoutCompleteContent() {
  const searchParams = useSearchParams();
  const canceled = searchParams.get("canceled") === "true";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        {canceled ? (
          <>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-yellow-500/10">
              <X className="size-5 text-yellow-400" />
            </div>
            <h1 className="font-mono text-sm font-bold">Payment canceled</h1>
            <p className="text-xs text-muted-foreground">
              No charges were made. You can close this tab.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="size-5 text-emerald-400" />
            </div>
            <h1 className="font-mono text-sm font-bold">Payment received</h1>
            <p className="text-xs text-muted-foreground">
              Your credits are being added. You can close this tab and return to
              Repofy.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutCompletePage() {
  return (
    <Suspense>
      <CheckoutCompleteContent />
    </Suspense>
  );
}
