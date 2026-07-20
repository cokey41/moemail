import { getRequestContext } from "@cloudflare/next-on-pages"

export async function getSmtpPublicConfig() {
  let host = "smtp.633533.xyz"
  try {
    const env = getRequestContext().env
    const fromKv = await env.SITE_CONFIG.get("SMTP_PUBLIC_HOST")
    if (fromKv) host = fromKv
  } catch {
    // build-time / non-edge
  }
  return {
    host,
    ports: { starttls: 587, smtps: 465 },
    encryption: ["STARTTLS", "SSL/TLS"] as const,
  }
}
