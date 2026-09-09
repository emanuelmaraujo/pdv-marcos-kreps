import { Search, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Branch } from "@/types/pdv";

export type RoleFilter = "ALL" | "ADMIN" | "ATTENDANT" | "COURIER";
export type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function UserFilters({
  search,
  onSearchChange,
  role,
  onRoleChange,
  status,
  onStatusChange,
  branchId,
  onBranchChange,
  branches,
  onAdd,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  role: RoleFilter;
  onRoleChange: (value: RoleFilter) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  branchId: string;
  onBranchChange: (value: string) => void;
  branches: Branch[];
  onAdd: () => void;
}) {
  return (
    <section aria-label="Filtros de usuários" className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--elevation-1)]">
      <div className="flex gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <Input
            placeholder="Pesquisar por nome ou e-mail..."
            className="h-12 rounded-xl border-[var(--border)] bg-[var(--bg-subtle)] pl-11 text-base transition focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/20"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button
          onClick={onAdd}
          className="h-12 rounded-xl bg-brand-red px-4 text-white shadow-sm shadow-brand-red/20 active:scale-95 sm:px-5"
        >
          <UserPlus size={22} className="group-hover:scale-110 transition-transform" />
          <span className="font-bold hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as RoleFilter)}
          className="h-11 w-full rounded-xl bg-[var(--bg-subtle)] text-sm font-semibold sm:w-auto sm:min-w-[9.5rem]"
        >
          <option value="ALL">Todos os papéis</option>
          <option value="ADMIN">Administrador</option>
          <option value="ATTENDANT">Atendente</option>
          <option value="COURIER">Motoboy</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          className="h-11 w-full rounded-xl bg-[var(--bg-subtle)] text-sm font-semibold sm:w-auto sm:min-w-[8.5rem]"
        >
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </Select>
        {branches.length > 0 && (
          <Select
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
            className="col-span-2 h-11 w-full rounded-xl bg-[var(--bg-subtle)] text-sm font-semibold sm:w-auto sm:min-w-[9.5rem]"
          >
            <option value="ALL">Todas as filiais</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        )}
      </div>
    </section>
  );
}
