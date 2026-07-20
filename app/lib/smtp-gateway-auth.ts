import { NextResponse } from "next/server"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { and, eq, sql } from "drizzle-orm"
import { createDb } from "@/lib/db"
import { emails, smtpCredentials } from "@/lib/schema"
import { isPermanentEmail } from "@/lib/smtp-permanent"
import { verifySmtpPassword } from "@/lib/smtp-crypto"

export async function assertGatewaySecret(
  request: Request
): Promise<Response | null> {
  const provided = request.headers.get("X-SMTP-Gateway-Secret")
  let expected: string | null | undefined

  try {
    const env = getRequestContext().env as CloudflareEnv & {
      SMTP_GATEWAY_SECRET?: string
    }
    expected =
      env.SMTP_GATEWAY_SECRET ||
      (await env.SITE_CONFIG.get("SMTP_GATEWAY_SECRET"))
  } catch {
    expected = process.env.SMTP_GATEWAY_SECRET
  }

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  return null
}

export type SmtpAuthResult = {
  emailId: string
  userId: string
  address: string
  credentialId: string
}

/** Authenticate SMTP username/password; updates lastUsedAt on success. */
export async function authenticateSmtpUser(
  username: string,
  password: string
): Promise<SmtpAuthResult | null> {
  if (!username || !password) return null

  const db = createDb()
  const address = username.trim()

  const email = await db.query.emails.findFirst({
    where: eq(sql`LOWER(${emails.address})`, address.toLowerCase()),
  })

  if (!email || !email.userId || !isPermanentEmail(email.expiresAt)) {
    return null
  }

  const creds = await db
    .select()
    .from(smtpCredentials)
    .where(
      and(
        eq(smtpCredentials.emailId, email.id),
        eq(smtpCredentials.enabled, true)
      )
    )

  for (const cred of creds) {
    // Prefer username match (case-insensitive); also accept password if username was stored as address
    const userMatch =
      cred.username.toLowerCase() === address.toLowerCase() ||
      cred.username.toLowerCase() === email.address.toLowerCase()
    if (!userMatch) continue

    const ok = await verifySmtpPassword(password, cred.passwordHash)
    if (!ok) continue

    await db
      .update(smtpCredentials)
      .set({ lastUsedAt: new Date() })
      .where(eq(smtpCredentials.id, cred.id))

    return {
      emailId: email.id,
      userId: email.userId,
      address: email.address,
      credentialId: cred.id,
    }
  }

  return null
}
