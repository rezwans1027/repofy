"use client";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RoleFocusSchema, type ReportView, type RoleFocus } from "@repofy/contracts";
import { api } from "@/lib/api-client";
import { cardClass, privateQueryOptions } from "./report-shared";

export function useRoleFocus(actor: string, view: ReportView) {
  const client = useQueryClient(), key = ["readiness", actor, view.report.reportId, "focus"];
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function validate(focus: RoleFocus) {
    const capIds = view.report.capabilityGroups.flatMap(g => g.capabilities.map(c => c.capabilityId));
    if (focus.reportId !== view.report.reportId || focus.capabilityOrder.length !== capIds.length || focus.capabilityOrder.some(id => !capIds.includes(id))
      || focus.improvementOrder.length !== view.report.improvements.length || focus.improvementOrder.some(id => !view.report.improvements.some(i => i.improvementId === id))
      || focus.role && !view.report.roles.some(r => r.template.roleId === focus.role!.roleId && r.template.version === focus.role!.version)) throw new Error("Role membership mismatch");
    return focus;
  }
  const query = useQuery({ queryKey: key, ...privateQueryOptions, queryFn: async ({ signal }) => validate(await api.get<RoleFocus>(`/v1/readiness-reports/${view.report.reportId}/focus`, { signal, cache: "no-store", schema: RoleFocusSchema })) });
  const mutation = useMutation({ mutationFn: async (roleId: string) => validate(await api.put<RoleFocus>(`/v1/readiness-reports/${view.report.reportId}/focus`, {
    body: { role: view.report.roles.find(r => r.template.roleId === roleId)?.template ?? null }, cache: "no-store", schema: RoleFocusSchema })),
    onMutate: () => client.cancelQueries({ queryKey: key }),
    onSuccess: focus => { if (alive.current) client.setQueryData(key, focus); } });
  const focus = query.error ? undefined : query.data;
  const rank = (ids: string[] | undefined, id: string) => ids?.indexOf(id) ?? 0;
  const groups = view.report.capabilityGroups.map(group => ({ ...group, capabilities: [...group.capabilities].sort((a, b) => rank(focus?.capabilityOrder, a.capabilityId) - rank(focus?.capabilityOrder, b.capabilityId)) }))
    .sort((a, b) => Math.min(...a.capabilities.map(c => rank(focus?.capabilityOrder, c.capabilityId))) - Math.min(...b.capabilities.map(c => rank(focus?.capabilityOrder, c.capabilityId))));
  const ordered: ReportView = { ...view, report: { ...view.report, capabilityGroups: groups,
    roles: [...view.report.roles].sort((a, b) => rank(focus?.roleOrder, a.template.roleId) - rank(focus?.roleOrder, b.template.roleId)),
    improvements: [...view.report.improvements].sort((a, b) => rank(focus?.improvementOrder, a.improvementId) - rank(focus?.improvementOrder, b.improvementId)) },
    aggregation: view.aggregation && { ...view.aggregation, roles: view.aggregation.roles.map(role => role.template.roleId !== focus?.role?.roleId ? role : {
      ...role, gaps: [...role.gaps].sort((a, b) => rank(focus.gapOrder, a.requirementId) - rank(focus.gapOrder, b.requirementId)) }) } };
  return { ordered, control: <section className={cardClass} aria-label="Target role focus"><label className="block space-y-2 font-medium">Target role focus
    <select aria-label="Target role focus" className="block w-full rounded-md border border-border bg-background p-2 sm:w-auto" value={focus?.role?.roleId ?? ""}
      disabled={query.isPending || mutation.isPending || !!query.error} onChange={e => mutation.mutate(e.target.value)}><option value="">All five roles</option>
      {view.report.roles.map(r => <option key={r.template.roleId} value={r.template.roleId}>{view.roleDefinitions.find(d => d.roleId === r.template.roleId)?.name ?? r.template.roleId} · {r.template.version}</option>)}</select></label>
    <p>Role focus brings relevant capabilities, gaps and improvements first. It uses this report’s recorded rubrics and preserves its original scores, wording and priorities. Changing focus costs no credits.</p>
    <p role="status">{query.error || mutation.error ? "Role focus could not be saved or loaded. The original report remains available." : mutation.isPending ? "Saving role focus…" : focus?.role ? "Role focus saved separately from your report." : "Showing all recorded roles."}</p>
    {query.error && <button className="underline" onClick={() => void query.refetch()}>Retry role focus</button>}
  </section> };
}
