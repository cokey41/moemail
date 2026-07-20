import { SMTPServer } from "smtp-server"
import { simpleParser } from "mailparser"
import fs from "fs"

const BASE = process.env.MOEMAIL_BASE_URL || "https://mail.633533.xyz"
const SECRET = process.env.SMTP_GATEWAY_SECRET
const CERT = process.env.TLS_CERT_PATH
const KEY = process.env.TLS_KEY_PATH
const PORT_STARTTLS = Number(process.env.LISTEN_STARTTLS || 587)
const PORT_SMTPS = Number(process.env.LISTEN_SMTPS || 465)

if (!SECRET) {
  console.error("SMTP_GATEWAY_SECRET required")
  process.exit(1)
}

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SMTP-Gateway-Secret": SECRET,
    },
    body: JSON.stringify(body),
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  return { status: res.status, data }
}

function loadTls() {
  if (CERT && KEY && fs.existsSync(CERT) && fs.existsSync(KEY)) {
    return {
      key: fs.readFileSync(KEY),
      cert: fs.readFileSync(CERT),
    }
  }
  return null
}

function createServer({ secure, tls }) {
  const options = {
    authOptional: false,
    disabledCommands: secure ? [] : [],
    secure: !!secure,
    onAuth(auth, session, cb) {
      api("/api/internal/smtp/auth", {
        username: auth.username,
        password: auth.password,
      })
        .then(({ status, data }) => {
          if (status === 200 && data.ok) {
            session.smtpUser = auth.username
            session.smtpPass = auth.password
            return cb(null, { user: auth.username })
          }
          return cb(new Error("Invalid username or password"))
        })
        .catch(() => cb(new Error("Auth service unavailable")))
    },
    onData(stream, session, cb) {
      simpleParser(stream)
        .then(async (mail) => {
          const toList = []
            .concat(mail.to?.value || [])
            .map((x) => x.address)
            .filter(Boolean)
          if (!toList.length) return cb(new Error("No recipients"))
          const html = mail.html || mail.textAsHtml || mail.text || ""
          const subject = mail.subject || "(no subject)"
          for (const rcpt of toList) {
            const { status, data } = await api("/api/internal/smtp/send", {
              username: session.smtpUser,
              password: session.smtpPass,
              to: rcpt,
              subject,
              text: mail.text || "",
              html,
            })
            if (status !== 200 || !data.success) {
              return cb(new Error(data.error || "Send failed"))
            }
          }
          cb()
        })
        .catch((e) => cb(e))
    },
  }
  if (tls) {
    options.key = tls.key
    options.cert = tls.cert
  }
  if (!secure && tls) {
    // advertise STARTTLS
    options.hideSTARTTLS = false
  }
  if (!secure && !tls) {
    options.disabledCommands = ["STARTTLS"]
  }
  return new SMTPServer(options)
}

const tls = loadTls()
const starttlsServer = createServer({ secure: false, tls })
starttlsServer.listen(PORT_STARTTLS, "0.0.0.0", () => {
  console.log(`SMTP STARTTLS listening on ${PORT_STARTTLS} tls=${!!tls}`)
})

if (tls) {
  const smtpsServer = createServer({ secure: true, tls })
  smtpsServer.listen(PORT_SMTPS, "0.0.0.0", () => {
    console.log(`SMTP SMTPS listening on ${PORT_SMTPS}`)
  })
} else {
  console.warn("No TLS certs; only plain/auth port without STARTTLS cert")
}
