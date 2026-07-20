import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { createDb } from "@/lib/db"
import { emails, smtpCredentials } from "@/lib/schema"
import { getUserId } from "@/lib/apiKey"
import { generateSmtpPassword, hashSmtpPassword } from "@/lib/smtp-crypto"
import { getSmtpPublicConfig } from "@/lib/smtp-config"

export const runtime = "edge"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; credId: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const { id, credId } = await params
  const db = createDb()
  const email = await db.query.emails.findFirst({
    where: and(eq(emails.id, id), eq(emails.userId, userId)),
  })
  if (!email) return NextResponse.json({ error: "邮箱不存在" }, { status: 404 })

  const password = generateSmtpPassword()
  const passwordHash = await hashSmtpPassword(password)
  const updated = await db
    .update(smtpCredentials)
    .set({ passwordHash, enabled: true, updatedAt: new Date() })
    .where(
      and(
        eq(smtpCredentials.id, credId),
        eq(smtpCredentials.emailId, id),
        eq(smtpCredentials.userId, userId)
      )
    )
    .returning({ id: smtpCredentials.id, username: smtpCredentials.username })

  if (!updated.length) return NextResponse.json({ error: "凭据不存在" }, { status: 404 })
  const smtp = await getSmtpPublicConfig()
  return NextResponse.json({ credential: updated[0], password, smtp })
}
