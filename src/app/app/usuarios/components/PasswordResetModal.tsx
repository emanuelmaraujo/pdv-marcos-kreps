"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KeyRound } from "lucide-react";
import { UserProfile } from "@/lib/api/users-api";

export function PasswordResetModal({
  isOpen,
  onClose,
  user,
  saving,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  saving: boolean;
  onSubmit: (password: string) => Promise<void> | void;
}) {
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`Redefinir senha — ${user?.name ?? ""}`}>
      {isOpen && <PasswordResetForm userName={user?.name ?? ""} saving={saving} onSubmit={onSubmit} />}
    </BottomSheet>
  );
}

function PasswordResetForm({
  userName,
  saving,
  onSubmit,
}: {
  userName: string;
  saving: boolean;
  onSubmit: (password: string) => Promise<void> | void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    void onSubmit(password);
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 space-y-6">
      <p className="text-sm text-zinc-500">
        Defina uma nova senha para <span className="font-bold text-zinc-800">{userName}</span>. O usuário deverá usar essa senha no próximo login.
      </p>
      <div className="space-y-2">
        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">Nova Senha</label>
        <div className="relative group">
          <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-red transition-colors" />
          <Input
            required
            type="password"
            placeholder="Mínimo 6 caracteres"
            className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">Confirmar Senha</label>
        <div className="relative group">
          <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-red transition-colors" />
          <Input
            required
            type="password"
            placeholder="Repita a nova senha"
            className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p className="rounded-lg bg-[var(--status-danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--status-danger)]">
          {error}
        </p>
      )}
      <Button type="submit" loading={saving} className="w-full h-14 font-black bg-brand-red hover:bg-red-700 text-white rounded-2xl">
        <KeyRound size={20} className="mr-2" />
        Redefinir Senha
      </Button>
    </form>
  );
}
