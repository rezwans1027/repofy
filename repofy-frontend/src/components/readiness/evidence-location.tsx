"use client";
import { useEffect, useRef, useState } from "react";
import { EvidenceLocationResponseSchema, type EvidenceLocationResponse } from "@repofy/contracts";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export function useEvidenceLocation(reportId: string, evidenceId: string) {
  const [location, setLocation] = useState<EvidenceLocationResponse>();
  const [busy, setBusy] = useState(false);
  const alive = useRef(true), generation = useRef(0);
  useEffect(() => {
    alive.current = true; generation.current++;
    const clear = () => { generation.current++; setLocation(undefined); setBusy(false); };
    window.addEventListener("blur", clear); document.addEventListener("visibilitychange", clear);
    return () => { alive.current = false; window.removeEventListener("blur", clear); document.removeEventListener("visibilitychange", clear); };
  }, [reportId, evidenceId]);
  async function resolveLocation() {
    const current = ++generation.current; setBusy(true); setLocation(undefined);
    try {
      const result = await api.post<EvidenceLocationResponse>(`/v1/readiness-reports/${reportId}/evidence/${evidenceId}/location`, { cache: "no-store", schema: EvidenceLocationResponseSchema });
      if (result.evidenceId !== evidenceId) throw new Error("Evidence membership mismatch");
      if (alive.current && current === generation.current) setLocation(result);
    } catch { if (alive.current && current === generation.current) setLocation({ state: "unavailable", evidenceId }); }
    finally { if (alive.current && current === generation.current) setBusy(false); }
  }
  return { location, busy, resolveLocation };
}

export function EvidenceLocationDetails({ location, privateEvidence }: { location?: EvidenceLocationResponse; privateEvidence: boolean }) {
  return location && <div role="status" className="space-y-2">{location.state === "available" ? <><p>{location.repositoryLabel}: <code>{location.label}</code>{location.lines && ` · lines ${location.lines.start}–${location.lines.end}`}</p>
    {location.url && !privateEvidence && <a className="underline" href={location.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open exact commit on GitHub</a>}
    {location.visibility === "private" && <p>Verified private evidence. Location visible only after your permission check.</p>}</>
    : <p>{location.state === "access_revoked" ? "Repository access changed. Location hidden; reconnect GitHub before trying again." : location.state === "not_retained" ? "A file location is not retained for this provider observation." : "The location could not be verified. Try again later; no source was fetched."}</p>}</div>;
}

export function ImprovementFile({ reportId, evidenceId, visibility, access, label }: {
  reportId: string; evidenceId: string; visibility: "public" | "private"; access: "active" | "revoked"; label: string;
}) {
  const { location, busy, resolveLocation } = useEvidenceLocation(reportId, evidenceId);
  return <li className="space-y-2">{access === "revoked" ? <p>{label}: access revoked; file location hidden.</p>
    : <><Button variant="outline" className="h-auto max-w-full whitespace-normal" disabled={busy} onClick={resolveLocation}>{busy ? "Checking permission…" : `Inspect relevant file · ${label}`}</Button>
      <EvidenceLocationDetails location={location} privateEvidence={visibility === "private" || location?.state === "available" && location.visibility === "private"} /></>}</li>;
}
