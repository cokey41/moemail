import { NextResponse } from "next/server"
import {
  assertGatewaySecret,
  authenticateSmtpUser,
} from "@/lib/smtp-gateway-auth"

export const runtime = "edge"

interface AuthBody {
  username?: string
  password?: string
}

export async function POST(request: Request) {
  const denied = await assertGatewaySecret(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as AuthBody
    const username = body.username?.trim()
    const password = body.password

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "username and password required" },
        { status: 400 }
      )
    }

    const auth = await authenticateSmtpUser(username, password)
    if (!auth) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    return NextResponse.json({
      ok: true,
      emailId: auth.emailId,
      userId: auth.userId,
      address: auth.address,
    })
  } catch (error) {
    console.error("SMTP gateway auth failed:", error)
    return NextResponse.json({ ok: false }, { status: 401 })
  }
}
