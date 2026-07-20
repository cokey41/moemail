import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { createDb } from "@/lib/db"
import { emails, smtpCredentials } from "@/lib/schema"
import { getUserId } from "@/lib/apiKey"

export const runtime = "edge"

export async function DELETE(
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

  const result = await db
    .delete(smtpCredentials)
    .where(
      and(
        eq(smtpCredentials.id, credId),
        eq(smtpCredentials.emailId, id),
        eq(smtpCredentials.userId, userId)
      )
    )
    .returning({ id: smtpCredentials.id })

  if (!result.length) return NextResponse.json({ error: "凭据不存在" }, { status: 404 })
  return NextResponse.json({ success: true })
}
