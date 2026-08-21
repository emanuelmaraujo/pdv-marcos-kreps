"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { branchesAdminApi } from "@/lib/api/branches-admin-api";
import { isWebAuthnSupported, hasEnrolledPasskey } from "@/lib/webauthn-client";
import { useUsers } from "@/hooks/useUsers";
import { useClientPagination } from "@/hooks/useClientPagination";
import { UserProfile } from "@/lib/api/users-api";
import { UserCard } from "./components/UserCard";
import { UserFilters, type RoleFilter, type StatusFilter } from "./components/UserFilters";
import { UserFormSheet, type UserFormData } from "./components/UserFormSheet";
import { PasswordResetModal } from "./components/PasswordResetModal";
import { BiometricEnrollModal } from "./components/BiometricEnrollModal";
import { getInitials, getAvatarColor, formatLastSignIn } from "./utils";
import { Users, UserCheck, ShieldCheck, Activity, Mail, Clock, KeyRound, Fingerprint, UserMinus, UserCog, Trash2 } from "lucide-react";

const PAGE_SIZE = 10;

export default function GestaoUsuarios() {
  const { users, loading, createUser, updateUser, toggleStatus, deleteUser, resetPassword } = useUsers();
  const { branches } = useBranch();
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

  async function handleEdit(user: UserProfile) {
    setEditingUser(user);
    let branch_ids: string[] = [];
    try {
      branch_ids = await branchesAdminApi.listProfileBranches(user.id);
    } catch { /* não bloqueia abertura do form */ }
    setEditingBranchIds(branch_ids);
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
          home_branch_id: data.branch_ids[0] ?? null,
        });
        addToast("success", "Usuário atualizado com sucesso!");
      } else {
        await createUser({
          ...data,
          branch_ids: data.branch_ids,
          home_branch_id: data.branch_ids[0] ?? null,
        });
        addToast("success", "Usuário criado com sucesso!");
      }
      setIsFormOpen(false);
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao salvar usuário");
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
      addToast("error", error instanceof Error ? error.message : "Erro ao redefinir senha");
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
      addToast("error", error instanceof Error ? error.message : "Erro ao excluir usuário");
    }
  }

  async function handleToggleStatus(user: UserProfile) {
    try {
      await toggleStatus(user.id, !user.active);
      addToast("success", `Usuário ${!user.active ? "ativado" : "desativado"} com sucesso!`);
    } catch (error: unknown) {
      addToast("error", error instanceof Error ? error.message : "Erro ao alterar status");
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
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${user.active ? "bg-emerald-500" : "bg-zinc-300"}`} />
          </div>
          <div className="min-w-0">
            <p className={`truncate text-sm font-black ${user.active ? "text-zinc-900" : "text-zinc-500"}`}>{user.name}</p>
            <p className="flex items-center gap-1 truncate text-xs font-medium text-zinc-500">
              <Mail size={11} className="shrink-0 text-zinc-400" />
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
          {user.role === "ADMIN" ? "Admin" : user.role === "COURIER" ? "Motoboy" : "Equipe"}
        </Badge>
      ),
    },
    {
      key: "branches",
      header: "Filiais",
      render: (user) => {
        const ids = user.branch_ids ?? [];
        if (ids.length === 0) return <span className="text-xs text-zinc-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {ids.map((id) => (
              <span key={id} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-black text-zinc-600" title={branchNameById.get(id)?.name}>
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
        <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
          <Clock size={12} className="text-zinc-400" />
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
              className="text-indigo-600 hover:bg-indigo-50"
            />
          )}
          <IconAction title="Redefinir senha" onClick={() => { setResetUser(user); setIsPasswordModalOpen(true); }} icon={KeyRound} className="text-zinc-600 hover:bg-zinc-100" />
          <IconAction
            title={user.active ? "Desativar" : "Ativar"}
            onClick={() => handleToggleStatus(user)}
            icon={user.active ? UserMinus : UserCheck}
            className={user.active ? "text-zinc-600 hover:bg-zinc-100" : "text-brand-amber hover:bg-brand-amber/10"}
          />
          <IconAction title="Editar" onClick={() => handleEdit(user)} icon={UserCog} className="text-brand-charcoal hover:bg-zinc-100" />
          {user.id !== currentUserId && (
            <IconAction title="Excluir usuário" onClick={() => handleDelete(user)} icon={Trash2} className="text-red-500 hover:bg-red-50" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="p-6 space-y-6 flex-1 overflow-y-auto pb-32">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-white/80 backdrop-blur-md border-zinc-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users size={48} />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
                <Users size={20} className="text-zinc-600" />
              </div>
              <span className="text-2xl font-black text-zinc-900 leading-tight">{stats.total}</span>
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total</span>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border-zinc-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserCheck size={48} className="text-emerald-500" />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <UserCheck size={20} className="text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-emerald-600 leading-tight">{stats.active}</span>
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Ativos</span>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border-zinc-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck size={48} className="text-amber-500" />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                <ShieldCheck size={20} className="text-amber-600" />
              </div>
              <span className="text-2xl font-black text-amber-600 leading-tight">{stats.admins}</span>
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Admins</span>
            </CardContent>
          </Card>
        </div>

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
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} />
              Lista de Equipe
            </h3>
            <span className="text-xs text-zinc-400 font-medium">Exibindo {total} resultado{total === 1 ? "" : "s"}</span>
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
    </div>
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
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${className}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
