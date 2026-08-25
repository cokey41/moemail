import { GET as authGET, POST } from "@/lib/auth"

export const runtime = 'edge'

// GitHub 会在 OAuth 回调 URL 上附加 iss（issuer）参数，而锁定的 @auth/core 0.37
// 要求回调 iss 必须等于占位 issuer（authjs.dev），不匹配则拒绝整个回调
// （CallbackRouteError -> error=Configuration）。防 mix-up 已由 state/PKCE 保证，
// 这里在进入 Auth 处理前剥掉该参数。
export async function GET(
  request: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  const url = new URL(request.url)
  if (!url.searchParams.has("iss")) {
    return authGET(request, ctx)
  }
  url.searchParams.delete("iss")
  return authGET(
    new Request(url.toString(), { method: "GET", headers: request.headers }),
    ctx
  )
}

export { POST }
