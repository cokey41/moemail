"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Copy,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useCopy } from "@/hooks/use-copy"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type SmtpConfig = {
  host: string
  ports: { starttls: number; smtps: number }
  encryption: readonly string[] | string[]
}

type SmtpCredential = {
  id: string
  username: string
  enabled: boolean
  name: string | null
  createdAt: string | Date
  lastUsedAt?: string | Date | null
}

type SmtpResponse = {
  permanent: boolean
  smtp: SmtpConfig
  credentials: SmtpCredential[]
}

interface SmtpCredentialsPanelProps {
  emailId: string
}

export function SmtpCredentialsPanel({ emailId }: SmtpCredentialsPanelProps) {
  const { toast } = useToast()
  const { copyToClipboard } = useCopy()
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [permanent, setPermanent] = useState(false)
  const [smtp, setSmtp] = useState<SmtpConfig | null>(null)
  const [credentials, setCredentials] = useState<SmtpCredential[]>([])
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [revealedUsername, setRevealedUsername] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/emails/${emailId}/smtp`)
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || "加载 SMTP 信息失败")
      }
      const data = (await res.json()) as SmtpResponse
      setPermanent(data.permanent)
      setSmtp(data.smtp)
      setCredentials(data.credentials || [])
    } catch (error) {
      console.error(error)
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "加载 SMTP 信息失败",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [emailId, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const showPasswordOnce = (password: string, username?: string) => {
    setRevealedPassword(password)
    setRevealedUsername(username || null)
    setPasswordDialogOpen(true)
  }

  const handleCreate = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/emails/${emailId}/smtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as {
        error?: string
        password?: string
        credential?: SmtpCredential
        message?: string
      }
      if (!res.ok) {
        throw new Error(data.error || "生成凭据失败")
      }
      if (data.password) {
        showPasswordOnce(data.password, data.credential?.username)
      }
      toast({
        title: "成功",
        description: data.message || "SMTP 凭据已生成",
      })
      await fetchData()
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "生成凭据失败",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReset = async (credId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/emails/${emailId}/smtp/${credId}/reset`, {
        method: "POST",
      })
      const data = (await res.json()) as {
        error?: string
        password?: string
        credential?: { id: string; username: string }
      }
      if (!res.ok) {
        throw new Error(data.error || "重置密码失败")
      }
      if (data.password) {
        showPasswordOnce(data.password, data.credential?.username)
      }
      toast({
        title: "成功",
        description: "密码已重置，请立即保存",
      })
      await fetchData()
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "重置密码失败",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (credId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/emails/${emailId}/smtp/${credId}`, {
        method: "DELETE",
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(data.error || "删除凭据失败")
      }
      toast({
        title: "成功",
        description: "SMTP 凭据已删除",
      })
      await fetchData()
    } catch (error) {
      toast({
        title: "错误",
        description: error instanceof Error ? error.message : "删除凭据失败",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (value: string | Date) => {
    try {
      return new Date(value).toLocaleString()
    } catch {
      return String(value)
    }
  }

  if (loading) {
    return (
      <div className="border-t-2 border-primary/20 p-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        加载 SMTP 信息...
      </div>
    )
  }

  if (!permanent) {
    return (
      <div className="border-t-2 border-primary/20 p-3">
        <p className="text-xs text-muted-foreground">
          仅永久邮箱支持 SMTP 发送凭据
        </p>
      </div>
    )
  }

  return (
    <div className="border-t-2 border-primary/20 p-3 space-y-3 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="h-4 w-4 text-primary shrink-0" />
          <h3 className="text-sm font-semibold truncate">SMTP 凭据</h3>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1 shrink-0"
          onClick={handleCreate}
          disabled={actionLoading}
        >
          {actionLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          生成
        </Button>
      </div>

      {smtp && (
        <div className="rounded-md border border-primary/20 bg-card p-2.5 space-y-1 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">主机</span>
            <span className="font-mono text-right break-all">{smtp.host}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">STARTTLS</span>
            <span className="font-mono">{smtp.ports.starttls}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">SMTPS</span>
            <span className="font-mono">{smtp.ports.smtps}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">加密</span>
            <span className="text-right">
              {(smtp.encryption || []).join(" / ")}
            </span>
          </div>
        </div>
      )}

      {credentials.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          暂无凭据，点击「生成」创建 SMTP 密码
        </p>
      ) : (
        <div className="space-y-2 max-h-40 overflow-auto">
          {credentials.map((cred) => (
            <div
              key={cred.id}
              className="flex items-start justify-between gap-2 rounded-md border bg-card p-2.5"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-medium font-mono truncate">
                  {cred.username}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {cred.enabled ? "已启用" : "已禁用"} · 创建于{" "}
                  {formatDate(cred.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="重置密码"
                  disabled={actionLoading}
                  onClick={() => handleReset(cred.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  title="删除"
                  disabled={actionLoading}
                  onClick={() => handleDelete(cred.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open)
          if (!open) {
            setRevealedPassword(null)
            setRevealedUsername(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMTP 密码</DialogTitle>
            <DialogDescription className="text-destructive">
              请立即保存密码，之后无法再次查看明文
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {revealedUsername && (
              <div className="space-y-1.5">
                <Label>用户名</Label>
                <div className="flex gap-2">
                  <Input
                    value={revealedUsername}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(revealedUsername)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {revealedPassword && (
              <div className="space-y-1.5">
                <Label>密码</Label>
                <div className="flex gap-2">
                  <Input
                    value={revealedPassword}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(revealedPassword)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {smtp && (
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                <div>主机: {smtp.host}</div>
                <div>
                  端口: {smtp.ports.starttls} (STARTTLS) / {smtp.ports.smtps}{" "}
                  (SMTPS)
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">我已保存</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
