import type { Row } from "./api";
// These definitions match the original web dashboard, including partial collections.
export function metricValue(entity: string, rows: Row[]): number {
  if (entity === "commissions")
    return rows.reduce(
      (sum, row) => sum + Number(row.collected_amount || 0),
      0,
    );
  if (entity === "activities")
    return rows.filter(
      (row) =>
        !["completata", "non completata", "annullata"].includes(
          String(row.status),
        ),
    ).length;
  if (entity === "deals")
    return rows.filter((row) =>
      ["aperta", "in attesa"].includes(String(row.status)),
    ).length;
  if (entity === "offers")
    return rows.filter((row) =>
      ["bozza", "presentata"].includes(String(row.status)),
    ).length;
  if (entity === "leases")
    return rows.filter((row) => row.status === "attiva").length;
  return rows.length;
}
