"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { useUser } from "@/contexts/UserContext";
import { isWebAuthnSupported, hasEnrolledPasskey } from "@/lib/webauthn-client";
import { useUsers } from "@/hooks/useUsers";
import { useClientPagination } from "@/hooks/useClientPagination";
import { UserProfile } from "@/lib/api/users-api";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { UserCard } from "@/app/app/usuarios/components/UserCard";
import { UserFilters, type RoleFilter, type StatusFilter } from "@/app/app/usuarios/components/UserFilters";
import { UserFormSheet, type UserFormData } from "@/app/app/usuarios/components/UserFormSheet";
import { PasswordResetModal } from "@/app/app/usuarios/components/PasswordResetModal";
import { BiometricEnrollModal } from "@/app/app/usuarios/components/BiometricEnrollModal";
import { getInitials, getAvatarColor, formatLastSignIn } from "@/app/app/usuarios/utils";
import { Users, UserCheck, ShieldCheck, Activity, Mail, Clock, KeyRound, Fingerprint, UserMinus, UserCog, Trash2 } from "lucide-react";
import { SettingsBadge, SettingsPageHeader } from "../components/SettingsPageHeader";

const PAGE_SIZE = 10;

export default function GestaoUsuarios() {
  const { users, loading, createUser, updateUser, toggleStatus, deleteUser, resetPassword } = useUsers();
  const { branches } = useBranch();
  const { isGlobalAdmin } = useUser();
  const { toasts, addToast, removeToast } = useToast();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingBranchIds, setEditingBranchIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const webAuthnSupported = typeof window !== "undefined" ? isWebAuthnSupported() : false;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email ?? null);
      }
    });
  }, []);

  const branchNameById = useMemo(() => new Map(branches.map((b) => [b.id, b])), [branches]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (term && !u.name.toLowerCase().includes(term) && !u.email.toLowerCase().includes(term)) return false;
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter === "ACTIVE" && !u.active) return false;
      if (statusFilter === "INACTIVE" && u.active) return false;
      if (branchFilter !== "ALL" && !(u.branch_ids ?? []).includes(branchFilter)) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter, branchFilter]);

  const { page, setPage, pageItems, total } = useClientPagination(filteredUsers, PAGE_SIZE);

  const stats = {
    total: users.length,
    active: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.role === "ADMIN").length,
  };

  function handleAdd() {
    setEditingUser(null);
    setEditingBranchIds([]);
    setIsFormOpen(true);
  }

  function handleEdit(user: UserProfile) {
    if (!user.can_manage) return;
    setEditingUser(user);
    setEditingBranchIds(user.branch_ids ?? []);
    setIsFormOpen(true);
  }

  async function handleFormSubmit(data: UserFormData) {
    setSaving(true);
    try {
      if (editingUser) {
        await updateUser({
          id: editingUser.id,
          name: data.name,
          role: data.role,
          branch_ids: data.branch_ids,
          home_branch_id: data.home_branch_id,
          phone: data.phone,
        });
        addToast("success", "Usuário atualizado com sucesso!");
      } else {
        await createUser({
          ...data,
          branch_ids: data.branch_ids,
          home_branch_id: data.home_branch_id,
        });
        addToast("success", "Usuário criado com sucesso!");
      }
      setIsFormOpen(false);
    } catch (error: unknown) {
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos salvar o usuário. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset(password: string) {
    if (!resetUser) return;
    setSaving(true);
    try {
      await resetPassword(resetUser.id, password);
      addToast("success", `Senha de ${resetUser.name} redefinida com sucesso!`);
      setIsPasswordModalOpen(false);
    } catch (error: unknown) {
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos redefinir a senha. Tente novamente."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserProfile) {
    if (!window.confirm(`Excluir permanentemente "${user.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteUser(user.id);
      addToast("success", `Usuário ${user.name} excluído.`);
    } catch (error: unknown) {
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos excluir o usuário. Tente novamente."));
    }
  }

  async function handleToggleStatus(user: UserProfile) {
    try {
      await toggleStatus(user.id, !user.active);
      addToast("success", `Usuário ${!user.active ? "ativado" : "desativado"} com sucesso!`);
    } catch (error: unknown) {
      addToast("error", getFriendlyErrorMessage(error, "Não conseguimos alterar o status do usuário."));
    }
  }

  const columns: DataTableColumn<UserProfile>[] = [
    {
      key: "user",
      header: "Usuário",
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 font-black text-xs shadow-inner bg-gradient-to-br ${getAvatarColor(user.name)}`}>
            {getInitials(user.name)}
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-surface)] ${user.active ? "bg-emerald-500" : "bg-[var(--border-strong)]"}`} />
          </div>
          <div className="min-w-0">
            <p className={`truncate text-sm font-black ${user.active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{user.name}</p>
            <p className="flex items-center gap-1 truncate text-xs font-medium text-[var(--text-muted)]">
              <Mail size={11} className="shrink-0 text-[var(--text-muted)]" />
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Papel",
      render: (user) => (
        <Badge
          variant={user.role === "ADMIN" ? "brand" : user.role === "COURIER" ? "info" : "secondary"}
          className="text-[10px] py-0.5 px-2 font-black uppercase tracking-wider rounded-lg"
        >
          {user.is_global_admin ? "Admin global" : user.role === "ADMIN" ? "Admin filial" : user.role === "COURIER" ? "Motoboy" : "Atendente"}
        </Badge>
      ),
    },
    {
      key: "branches",
      header: "Filiais",
      render: (user) => {
        const ids = user.branch_ids ?? [];
        if (ids.length === 0) return <span className="text-xs text-[var(--text-muted)]">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {ids.map((id) => (
              <span key={id} className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-black text-[var(--text-secondary)]" title={branchNameById.get(id)?.name}>
                {branchNameById.get(id)?.code ?? "?"}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "seen",
      header: "Visto por último",
      render: (user) => (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
          <Clock size={12} className="text-[var(--text-muted)]" />
          {formatLastSignIn(user.last_sign_in_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      className: "text-right",
      render: (user) => (
        <div className="flex items-center justify-end gap-1">
          {user.id === currentUserId && webAuthnSupported && (
            <IconAction
              title={hasEnrolledPasskey() ? "Digital vinculada ✓" : "Vincular digital / Face ID"}
              onClick={() => setIsBiometricModalOpen(true)}
              icon={Fingerprint}
              className="text-[var(--status-info)] hover:bg-[var(--status-info-bg)]"
            />
          )}
          {user.can_manage && <IconAction title="Redefinir senha" onClick={() => { setResetUser(user); setIsPasswordModalOpen(true); }} icon={KeyRound} className="text-[var(--text-secondary)] hover:bg-[var(--border)]" />}
          {user.can_manage && <IconAction
            title={user.active ? "Desativar" : "Ativar"}
            onClick={() => handleToggleStatus(user)}
            icon={user.active ? UserMinus : UserCheck}
            className={user.active ? "text-[var(--text-secondary)] hover:bg-[var(--border)]" : "text-brand-amber hover:bg-brand-amber/10"}
          />}
          {user.can_manage && <IconAction title="Editar" onClick={() => handleEdit(user)} icon={UserCog} className="text-[var(--text-primary)] hover:bg-[var(--border)]" />}
          {user.can_manage && user.id !== currentUserId && (
            <IconAction title="Excluir usuário" onClick={() => handleDelete(user)} icon={Trash2} className="text-red-500 hover:bg-[var(--status-danger-bg)]" />
          )}
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <SettingsPageHeader
        eyebrow="Equipe e permissões"
        title="Usuários e acessos"
        description="Gerencie papéis, filiais autorizadas, credenciais e status da equipe com o menor privilégio necessário."
        icon={Users}
        meta={
          <>
            <SettingsBadge tone="success">{stats.active} ativos</SettingsBadge>
            <SettingsBadge tone="warning">{stats.admins} administradores</SettingsBadge>
            <SettingsBadge>{stats.total} usuários</SettingsBadge>
          </>
        }
      />

      <div className="space-y-6">
        {/* Stats */}
        <section aria-label="Resumo da equipe" className="grid gap-3 sm:grid-cols-3">
          <Card className="group relative overflow-hidden border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] transition hover:shadow-[var(--elevation-2)]">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users size={48} />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center mb-3">
                <Users size={20} className="text-[var(--text-secondary)]" />
              </div>
              <span className="text-2xl font-black text-[var(--text-primary)] leading-tight">{stats.total}</span>
              <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">Total</span>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] transition hover:shadow-[var(--elevation-2)]">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserCheck size={48} className="text-emerald-500" />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--status-success-bg)]">
                <UserCheck size={20} className="text-[var(--status-success)]" />
              </div>
              <span className="text-2xl font-black leading-tight text-[var(--status-success)]">{stats.active}</span>
              <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">Ativos</span>
            </CardContent>
          </Card>

          <Card className="group relative overflow-hidden border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--elevation-1)] transition hover:shadow-[var(--elevation-2)]">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck size={48} className="text-amber-500" />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--status-warning-bg)]">
                <ShieldCheck size={20} className="text-[var(--status-warning)]" />
              </div>
              <span className="text-2xl font-black leading-tight text-[var(--status-warning)]">{stats.admins}</span>
              <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">Admins</span>
            </CardContent>
          </Card>
        </section>

        <UserFilters
          search={search}
          onSearchChange={setSearch}
          role={roleFilter}
          onRoleChange={setRoleFilter}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          branchId={branchFilter}
          onBranchChange={setBranchFilter}
          branches={branches}
          onAdd={handleAdd}
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <Activity size={14} />
              Lista da equipe
            </h2>
            <span className="text-xs text-[var(--text-muted)] font-medium">Exibindo {total} resultado{total === 1 ? "" : "s"}</span>
          </div>

          <DataTable
            columns={columns}
            data={pageItems}
            keyField={(user) => user.id}
            loading={loading}
            emptyMessage="Nenhum usuário encontrado com os filtros atuais."
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
            renderCard={(user) => (
              <UserCard
                user={user}
                currentUserId={currentUserId}
                webAuthnSupported={webAuthnSupported}
                hasPasskey={hasEnrolledPasskey()}
                onOpenBiometric={() => setIsBiometricModalOpen(true)}
                onOpenPasswordReset={() => { setResetUser(user); setIsPasswordModalOpen(true); }}
                onToggleStatus={() => handleToggleStatus(user)}
                onEdit={() => handleEdit(user)}
                onDelete={() => handleDelete(user)}
              />
            )}
          />
        </div>
      </div>

      <UserFormSheet
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingUser={editingUser}
        initialBranchIds={editingBranchIds}
        branches={branches}
        saving={saving}
        onSubmit={handleFormSubmit}
        canCreateAdmin={isGlobalAdmin}
      />

      <PasswordResetModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        user={resetUser}
        saving={saving}
        onSubmit={handlePasswordReset}
      />

      <BiometricEnrollModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        currentUserId={currentUserId}
        currentUserEmail={currentUserEmail}
        onError={(message) => addToast("error", message)}
      />
    </main>
  );
}

function IconAction({
  title,
  icon: Icon,
  onClick,
  className = "",
}: {
  title: string;
  icon: React.ElementType;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${className}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
