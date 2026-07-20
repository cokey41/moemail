/** Permanent emails use expiryTime=0 → expiresAt year 9999 in generate route */
export function isPermanentEmail(expiresAt: Date | number | null | undefined): boolean {
  if (expiresAt == null) return false
  const d = typeof expiresAt === "number" ? new Date(expiresAt) : expiresAt
  if (Number.isNaN(d.getTime())) return false
  return d.getUTCFullYear() >= 9000
}
