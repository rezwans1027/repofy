import { RoleFocusSchema, type ReportView, type RoleTemplateReference } from "@repofy/contracts";

/** Only orders recorded data; never rewrites metrics, prose, priorities or rubrics. */
export function roleFocus(view: ReportView, role: RoleTemplateReference | null) {
  const selected = view.aggregation?.roles.find(r => r.template.roleId === role?.roleId);
  const relevance = new Map<string, number>();
  for (const r of selected?.requirements ?? []) for (const capability of r.capabilityIds) relevance.set(capability, (relevance.get(capability) ?? 0) + r.weight);
  const capabilities = view.report.capabilityGroups.flatMap(g => g.capabilities.map(c => c.capabilityId));
  return RoleFocusSchema.parse({ reportId: view.report.reportId, role, policy: "recorded-role-order-1.0.0",
    capabilityOrder: [...capabilities].sort((a, b) => (relevance.get(b) ?? 0) - (relevance.get(a) ?? 0) || capabilities.indexOf(a) - capabilities.indexOf(b)),
    improvementOrder: view.report.improvements.map((item, index) => ({ item, index })).sort((a, b) =>
      Number(!!role && b.item.roleIds.includes(role.roleId)) - Number(!!role && a.item.roleIds.includes(role.roleId)) || a.index - b.index).map(v => v.item.improvementId),
    roleOrder: view.report.roles.map(r => r.template.roleId).sort((a, b) => Number(b === role?.roleId) - Number(a === role?.roleId)),
    gapOrder: [...selected?.gaps ?? []].sort((a, b) => b.impact - a.impact || Number(b.required) - Number(a.required) || a.requirementId.localeCompare(b.requirementId)).map(g => g.requirementId),
  });
}
