import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Mail, Clock, ShieldCheck, Fingerprint, KeyRound, UserMinus, UserCheck, UserCog, Trash2 } from "lucide-react";
import { UserProfile } from "@/lib/api/users-api";
import { getInitials, getAvatarColor, formatLastSignIn } from "../utils";

export function UserCard({
  user,
  currentUserId,
  webAuthnSupported,
  hasPasskey,
  onOpenBiometric,
  onOpenPasswordReset,
  onToggleStatus,
  onEdit,
  onDelete,
}: {
  user: UserProfile;
  currentUserId: string | null;
  webAuthnSupported: boolean;
  hasPasskey: boolean;
  onOpenBiometric: () => void;
  onOpenPasswordReset: () => void;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={`group relative overflow-hidden rounded-2xl border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] transition hover:shadow-[var(--elevation-2)] ${!user.active ? "opacity-80" : ""}`}
    >
      {!user.active && <div className="absolute inset-0 bg-[var(--bg-subtle)]/40 pointer-events-none" />}

      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center font-black text-lg border-2 shadow-inner transition-transform group-hover:rotate-3 bg-gradient-to-br ${getAvatarColor(user.name)}`}>
              {getInitials(user.name)}
            </div>
            {user.active ? (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-[3px] border-[var(--bg-surface)] rounded-full shadow-sm" />
            ) : (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[var(--border-strong)] border-[3px] border-[var(--bg-surface)] rounded-full shadow-sm" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`font-black text-[var(--text-primary)] text-base tracking-tight leading-tight ${!user.active ? "text-[var(--text-muted)]" : ""}`}>
                {user.name}
              </span>
              <Badge
                variant={user.role === "ADMIN" ? "brand" : user.role === "COURIER" ? "info" : "secondary"}
                className="text-[10px] py-0.5 px-2 font-black uppercase tracking-wider rounded-lg"
              >
                {user.is_global_admin ? "Admin global" : user.role === "ADMIN" ? "Admin filial" : user.role === "COURIER" ? "Motoboy" : "Atendente"}
              </Badge>
              {user.role === "ADMIN" && <ShieldCheck size={14} className="text-amber-500" strokeWidth={3} />}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] font-medium mb-0.5">
              <Mail size={12} className="text-[var(--text-muted)] shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-tight">
              <Clock size={11} className="text-[var(--text-muted)] shrink-0" />
              <span>Visto: {formatLastSignIn(user.last_sign_in_at)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-3 sm:flex sm:items-center">
          {user.id === currentUserId && webAuthnSupported && (
            <button
              onClick={onOpenBiometric}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--status-info)]/20 bg-[var(--status-info-bg)] text-[var(--status-info)] transition active:scale-95"
              title={hasPasskey ? "Digital vinculada ✓" : "Vincular digital / Face ID"}
            >
              <Fingerprint className="w-4 h-4" />
              <span className="text-[11px] font-bold">Digital</span>
            </button>
          )}
          {user.can_manage && <button
            onClick={onOpenPasswordReset}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition active:scale-95"
            title="Redefinir senha"
          >
            <KeyRound className="w-4 h-4" />
            <span className="text-[11px] font-bold">Senha</span>
          </button>}
          {user.can_manage && <button
            onClick={onToggleStatus}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border transition ${
              user.active
                ? "bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-secondary)] active:scale-95"
                : "bg-brand-amber/10 border-brand-amber/20 text-brand-amber active:scale-95"
            }`}
            title={user.active ? "Desativar" : "Ativar"}
          >
            {user.active ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            <span className="text-[11px] font-bold">{user.active ? "Desativar" : "Ativar"}</span>
          </button>}
          {user.can_manage && <button
            onClick={onEdit}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-primary)] transition active:scale-95"
            title="Editar"
          >
            <UserCog className="w-4 h-4" />
            <span className="text-[11px] font-bold">Editar</span>
          </button>}
          {user.can_manage && user.id !== currentUserId && (
            <button
              onClick={onDelete}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--status-danger)]/20 bg-[var(--status-danger-bg)] text-[var(--status-danger)] transition active:scale-95"
              title="Excluir usuário"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[11px] font-bold">Excluir</span>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
