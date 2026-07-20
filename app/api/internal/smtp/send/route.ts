import { NextResponse } from "next/server"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { createDb } from "@/lib/db"
import { messages } from "@/lib/schema"
import { checkSendPermission } from "@/lib/send-permissions"
import {
  assertGatewaySecret,
  authenticateSmtpUser,
} from "@/lib/smtp-gateway-auth"

export const runtime = "edge"

interface SendBody {
  username?: string
  password?: string
  to?: string
  subject?: string
  text?: string
  html?: string
}

async function sendWithResend(
  to: string,
  subject: string,
  fromEmail: string,
  config: { apiKey: string; text?: string; html?: string }
) {
  const payload: Record<string, unknown> = {
    from: fromEmail,
    to: [to],
    subject,
  }
  if (config.html) payload.html = config.html
  if (config.text) payload.text = config.text
  // Resend requires at least one of html/text
  if (!config.html && !config.text) {
    payload.text = ""
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as {
      message?: string
    }
    console.error("Resend API error:", errorData)
    throw new Error(errorData.message || "Resend发送失败，请稍后重试")
  }

  return { success: true }
}

export async function POST(request: Request) {
  const denied = await assertGatewaySecret(request)
  if (denied) return denied

  try {
    const body = (await request.json()) as SendBody
    const username = body.username?.trim()
    const password = body.password
    const to = body.to?.trim()
    const subject = body.subject
    const text = body.text
    const html = body.html

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "username and password required" },
        { status: 400 }
      )
    }

    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { ok: false, error: "to, subject, and text or html are required" },
        { status: 400 }
      )
    }

    const auth = await authenticateSmtpUser(username, password)
    if (!auth) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const permissionResult = await checkSendPermission(auth.userId)
    if (!permissionResult.canSend) {
      return NextResponse.json(
        {
          ok: false,
          error: permissionResult.error || "没有发件权限",
          remainingEmails: permissionResult.remainingEmails,
        },
        { status: 403 }
      )
    }

    const env = getRequestContext().env
    const apiKey = await env.SITE_CONFIG.get("RESEND_API_KEY")
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Resend 发件服务未配置" },
        { status: 500 }
      )
    }

    try {
      await sendWithResend(to, subject, auth.address, {
        apiKey,
        text,
        html,
      })
    } catch (err) {
      console.error("SMTP gateway Resend failed:", err)
      return NextResponse.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "发送失败",
        },
        { status: 502 }
      )
    }

    const db = createDb()
    await db.insert(messages).values({
      emailId: auth.emailId,
      fromAddress: auth.address,
      toAddress: to,
      subject,
      content: text || "",
      type: "sent",
      html: html || null,
    })

    return NextResponse.json({
      ok: true,
      success: true,
      remainingEmails: permissionResult.remainingEmails,
    })
  } catch (error) {
    console.error("SMTP gateway send failed:", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "发送邮件失败",
      },
      { status: 500 }
    )
  }
}
