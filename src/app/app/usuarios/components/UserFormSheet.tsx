"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TabbedForm, type TabbedFormTab } from "@/components/ui/TabbedForm";
import { Users, Mail, ShieldCheck, Filter, Phone, User as UserIcon } from "lucide-react";
import { Branch } from "@/types/pdv";
import { UserProfile } from "@/lib/api/users-api";
import { getInitials } from "../utils";

export type UserFormData = {
  name: string;
  email: string;
  password: string;
  role: "ADMIN" | "ATTENDANT" | "COURIER";
  active: boolean;
  branch_ids: string[];
  home_branch_id: string;
  phone: string;
};

export function UserFormSheet({
  isOpen,
  onClose,
  editingUser,
  initialBranchIds,
  branches,
  saving,
  onSubmit,
  canCreateAdmin,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingUser: UserProfile | null;
  initialBranchIds: string[];
  branches: Branch[];
  saving: boolean;
  onSubmit: (data: UserFormData) => Promise<void>;
  canCreateAdmin: boolean;
}) {
  if (!isOpen) return null;
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={editingUser ? "Configurações de Acesso" : "Novo Membro da Equipe"}>
      <UserFormSheetContent
        editingUser={editingUser}
        initialBranchIds={initialBranchIds}
        branches={branches}
        saving={saving}
        onSubmit={onSubmit}
        canCreateAdmin={canCreateAdmin}
      />
    </BottomSheet>
  );
}

// Componente separado (montado só quando o sheet abre) pra poder usar
// useState com inicializador preguiçoso a partir de editingUser sem se
// preocupar em resetar o form quando o usuário editado muda — o BottomSheet
// desmonta o conteúdo ao fechar, então cada abertura já é um mount novo.
function UserFormSheetContent({
  editingUser,
  initialBranchIds,
  branches,
  saving,
  onSubmit,
  canCreateAdmin,
}: {
  editingUser: UserProfile | null;
  initialBranchIds: string[];
  branches: Branch[];
  saving: boolean;
  onSubmit: (data: UserFormData) => Promise<void>;
  canCreateAdmin: boolean;
}) {
  const [activeTab, setActiveTab] = useState("dados");
  const [formData, setFormData] = useState<UserFormData>(() => ({
    name: editingUser?.name ?? "",
    email: editingUser?.email ?? "",
    password: "",
    role: editingUser?.role ?? "ATTENDANT",
    active: editingUser?.active ?? true,
    branch_ids: initialBranchIds,
    home_branch_id: editingUser?.home_branch_id ?? initialBranchIds[0] ?? "",
    phone: editingUser?.phone ?? "",
  }));

  function set<K extends keyof UserFormData>(key: K, value: UserFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  const tabs: TabbedFormTab[] = [
    {
      id: "dados",
      label: "Dados pessoais",
      validate: () => {
        if (!formData.name.trim()) return "Informe o nome completo.";
        if (!editingUser && !formData.email.trim()) return "Informe o e-mail de acesso.";
        return null;
      },
    },
    {
      id: "acesso",
      label: "Acesso e segurança",
      validate: () => {
        if (!editingUser && formData.password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
        return null;
      },
    },
    {
      id: "permissoes",
      label: "Permissões e filiais",
      validate: () => {
        if ((formData.role === "ADMIN" || formData.role === "COURIER") && formData.branch_ids.length !== 1)
          return `Selecione exatamente uma filial para o ${formData.role === "ADMIN" ? "administrador" : "motoboy"}.`;
        if (formData.role === "ATTENDANT" && formData.branch_ids.length < 1)
          return "Selecione pelo menos uma filial para o atendente.";
        if (!formData.branch_ids.includes(formData.home_branch_id)) return "Escolha uma filial inicial válida.";
        return null;
      },
    },
  ];

  return (
    <div className="flex h-[75vh] flex-col">
      <div className="flex items-center gap-4 mx-6 mt-6 p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border)] shrink-0">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl bg-gradient-to-br from-[var(--bg-subtle)] to-[var(--border-strong)] text-[var(--text-secondary)] shadow-inner">
          {formData.name ? getInitials(formData.name) : <UserIcon size={24} />}
        </div>
        <div>
          <p className="text-sm font-black text-[var(--text-primary)] leading-tight">{formData.name || "Novo Usuário"}</p>
          <p className="text-xs text-[var(--text-muted)] font-medium">{formData.email || "aguardando e-mail..."}</p>
        </div>
      </div>

      <TabbedForm
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        submitting={saving}
        submitLabel={editingUser ? "Salvar alterações" : "Criar usuário"}
        onSubmit={() => void onSubmit(formData)}
      >
        {activeTab === "dados" && (
          <div className="space-y-6">
            <FormField label="Nome Completo">
              <FieldIcon icon={Users} />
              <Input
                required
                placeholder="Ex: Marcos Kreps"
                className="h-14 pl-12 bg-[var(--bg-subtle)] border-[var(--border)] rounded-2xl focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
                value={formData.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </FormField>

            {!editingUser && (
              <FormField label="E-mail de Acesso">
                <FieldIcon icon={Mail} />
                <Input
                  required
                  type="email"
                  placeholder="exemplo@pdvmarcos.com"
                  className="h-14 pl-12 bg-[var(--bg-subtle)] border-[var(--border)] rounded-2xl focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
                  value={formData.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </FormField>
            )}
          </div>
        )}

        {activeTab === "acesso" && (
          <div className="space-y-6">
            {!editingUser && (
              <FormField label="Senha de Acesso">
                <FieldIcon icon={ShieldCheck} />
                <Input
                  required
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  className="h-14 pl-12 bg-[var(--bg-subtle)] border-[var(--border)] rounded-2xl focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
                  value={formData.password}
                  onChange={(e) => set("password", e.target.value)}
                />
              </FormField>
            )}

            <div className="space-y-2">
              <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest px-1">Nível de Acesso</label>
              <div className="relative group">
                <Filter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-brand-red transition-colors z-10" />
                <Select
                  value={formData.role}
                  className="h-14 pl-12 bg-[var(--bg-subtle)] border-[var(--border)] rounded-2xl focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-bold appearance-none"
                  onChange={(e) => {
                    const role = e.target.value as UserFormData["role"];
                    const branch_ids = role === "ATTENDANT" ? formData.branch_ids : formData.branch_ids.slice(0, 1);
                    setFormData((prev) => ({ ...prev, role, branch_ids, home_branch_id: branch_ids[0] ?? "" }));
                  }}
                >
                  <option value="ATTENDANT">Atendente (PDV & Balcão)</option>
                  {canCreateAdmin && <option value="ADMIN">Administrador de filial</option>}
                  <option value="COURIER">Motoboy (Entregas)</option>
                </Select>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] italic px-2">
                {formData.role === "COURIER"
                  ? "Motoboy vê só os próprios pedidos de entrega e confirma a entrega pelo celular."
                  : formData.role === "ADMIN"
                    ? "Administrador de filial gerencia somente os dados e a equipe da sua unidade."
                    : "Atendentes podem operar em uma ou mais filiais autorizadas."}
              </p>
            </div>

            {formData.role === "COURIER" && (
              <FormField label="Telefone do Motoboy">
                <FieldIcon icon={Phone} />
                <Input
                  type="tel"
                  placeholder="(61) 99999-9999"
                  className="h-14 pl-12 bg-[var(--bg-subtle)] border-[var(--border)] rounded-2xl focus:bg-[var(--bg-surface)] focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
                  value={formData.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </FormField>
            )}
          </div>
        )}

        {activeTab === "permissoes" && branches.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest px-1">
              {formData.role === "ATTENDANT" ? "Filiais autorizadas" : "Filial de operação"}
            </label>
            <p className="text-[10px] text-[var(--text-muted)] italic px-2">
              {formData.role === "ATTENDANT"
                ? "O atendente pode alternar apenas entre as unidades selecionadas."
                : "Administradores de filial e motoboys operam em exatamente uma unidade."}
            </p>
            <div className="space-y-1.5">
              {branches.map((b) => {
                const checked = formData.branch_ids.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                      checked ? "border-brand-red bg-brand-red/10" : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    <input
                      type={formData.role === "ATTENDANT" ? "checkbox" : "radio"}
                      name="branch_ids"
                      checked={checked}
                      onChange={(e) => {
                        if (formData.role !== "ATTENDANT") {
                          setFormData((prev) => ({ ...prev, branch_ids: [b.id], home_branch_id: b.id }));
                          return;
                        }
                        const next = e.target.checked
                          ? [...formData.branch_ids, b.id]
                          : formData.branch_ids.filter((x) => x !== b.id);
                        setFormData((prev) => ({
                          ...prev,
                          branch_ids: next,
                          home_branch_id: next.includes(prev.home_branch_id) ? prev.home_branch_id : next[0] ?? "",
                        }));
                      }}
                      className="h-4 w-4 accent-brand-red"
                    />
                    <span className="rounded-md bg-brand-charcoal px-2 py-0.5 text-[10px] font-black text-white">
                      {b.code}
                    </span>
                    <span className="flex-1 text-sm font-bold text-[var(--text-primary)]">{b.name}</span>
                    {!b.active && <span className="text-[10px] font-bold text-red-500">Inativa</span>}
                  </label>
                );
              })}
            </div>
            {formData.role === "ATTENDANT" && formData.branch_ids.length > 1 && (
              <div className="space-y-2 pt-3">
                <label className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Filial inicial</label>
                <Select
                  value={formData.home_branch_id}
                  onChange={(event) => set("home_branch_id", event.target.value)}
                  className="h-12 rounded-xl bg-[var(--bg-surface)]"
                >
                  {branches.filter((branch) => formData.branch_ids.includes(branch.id)).map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}
      </TabbedForm>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest px-1">{label}</label>
      <div className="relative group">{children}</div>
    </div>
  );
}

function FieldIcon({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-brand-red transition-colors" />;
}
