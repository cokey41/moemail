import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { createDb } from "@/lib/db"
import { emails, smtpCredentials } from "@/lib/schema"
import { getUserId } from "@/lib/apiKey"
import { isPermanentEmail } from "@/lib/smtp-permanent"
import { generateSmtpPassword, hashSmtpPassword } from "@/lib/smtp-crypto"
import { getSmtpPublicConfig } from "@/lib/smtp-config"

export const runtime = "edge"

async function getOwnedEmail(emailId: string, userId: string) {
  const db = createDb()
  return db.query.emails.findFirst({
    where: and(eq(emails.id, emailId), eq(emails.userId, userId)),
  })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const { id } = await params
  const email = await getOwnedEmail(id, userId)
  if (!email) return NextResponse.json({ error: "邮箱不存在" }, { status: 404 })

  const db = createDb()
  const rows = await db
    .select({
      id: smtpCredentials.id,
      username: smtpCredentials.username,
      enabled: smtpCredentials.enabled,
      name: smtpCredentials.name,
      createdAt: smtpCredentials.createdAt,
      lastUsedAt: smtpCredentials.lastUsedAt,
    })
    .from(smtpCredentials)
    .where(eq(smtpCredentials.emailId, id))

  const smtp = await getSmtpPublicConfig()
  return NextResponse.json({
    permanent: isPermanentEmail(email.expiresAt),
    smtp,
    credentials: rows,
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: "未授权" }, { status: 401 })
  const { id } = await params
  const email = await getOwnedEmail(id, userId)
  if (!email) return NextResponse.json({ error: "邮箱不存在" }, { status: 404 })
  if (!isPermanentEmail(email.expiresAt)) {
    return NextResponse.json({ error: "仅永久邮箱可生成 SMTP 凭据" }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string }
  const db = createDb()

  // default: single active credential — revoke previous enabled
  await db
    .update(smtpCredentials)
    .set({ enabled: false, updatedAt: new Date() })
    .where(and(eq(smtpCredentials.emailId, id), eq(smtpCredentials.enabled, true)))

  const password = generateSmtpPassword()
  const passwordHash = await hashSmtpPassword(password)
  const [row] = await db
    .insert(smtpCredentials)
    .values({
      emailId: id,
      userId,
      username: email.address,
      passwordHash,
      enabled: true,
      name: body.name || null,
    })
    .returning({
      id: smtpCredentials.id,
      username: smtpCredentials.username,
      enabled: smtpCredentials.enabled,
      createdAt: smtpCredentials.createdAt,
    })

  const smtp = await getSmtpPublicConfig()
  return NextResponse.json({
    credential: row,
    password, // once
    smtp,
    message: "请立即保存密码，之后无法再次查看明文",
  })
}
