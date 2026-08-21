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
      className={`group relative overflow-hidden bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl ${!user.active ? "opacity-80" : ""}`}
    >
      {!user.active && <div className="absolute inset-0 bg-zinc-50/40 pointer-events-none" />}

      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center font-black text-lg border-2 shadow-inner transition-transform group-hover:rotate-3 bg-gradient-to-br ${getAvatarColor(user.name)}`}>
              {getInitials(user.name)}
            </div>
            {user.active ? (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-[3px] border-white rounded-full shadow-sm" />
            ) : (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-zinc-300 border-[3px] border-white rounded-full shadow-sm" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`font-black text-zinc-900 text-base tracking-tight leading-tight ${!user.active ? "text-zinc-500" : ""}`}>
                {user.name}
              </span>
              <Badge
                variant={user.role === "ADMIN" ? "brand" : user.role === "COURIER" ? "info" : "secondary"}
                className="text-[10px] py-0.5 px-2 font-black uppercase tracking-wider rounded-lg"
              >
                {user.role === "ADMIN" ? "Admin" : user.role === "COURIER" ? "Motoboy" : "Equipe"}
              </Badge>
              {user.role === "ADMIN" && <ShieldCheck size={14} className="text-amber-500" strokeWidth={3} />}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-zinc-500 font-medium mb-0.5">
              <Mail size={12} className="text-zinc-400 shrink-0" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
              <Clock size={11} className="text-zinc-300 shrink-0" />
              <span>Visto: {formatLastSignIn(user.last_sign_in_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 border-t border-zinc-100">
          {user.id === currentUserId && webAuthnSupported && (
            <button
              onClick={onOpenBiometric}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 active:scale-95 transition-all"
              title={hasPasskey ? "Digital vinculada ✓" : "Vincular digital / Face ID"}
            >
              <Fingerprint className="w-4 h-4" />
              <span className="text-[11px] font-bold">Digital</span>
            </button>
          )}
          <button
            onClick={onOpenPasswordReset}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100 text-zinc-600 active:scale-95 transition-all"
            title="Redefinir senha"
          >
            <KeyRound className="w-4 h-4" />
            <span className="text-[11px] font-bold">Senha</span>
          </button>
          <button
            onClick={onToggleStatus}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all border ${
              user.active
                ? "bg-zinc-50 border-zinc-100 text-zinc-600 active:scale-95"
                : "bg-brand-amber/10 border-brand-amber/20 text-brand-amber active:scale-95"
            }`}
            title={user.active ? "Desativar" : "Ativar"}
          >
            {user.active ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            <span className="text-[11px] font-bold">{user.active ? "Desativar" : "Ativar"}</span>
          </button>
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100 text-brand-charcoal active:scale-95 transition-all"
            title="Editar"
          >
            <UserCog className="w-4 h-4" />
            <span className="text-[11px] font-bold">Editar</span>
          </button>
          {user.id !== currentUserId && (
            <button
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-50 border border-red-100 text-red-500 active:scale-95 transition-all"
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
