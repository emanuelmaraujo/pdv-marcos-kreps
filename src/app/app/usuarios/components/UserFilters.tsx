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
    <div className="sticky top-0 z-10 space-y-3 bg-zinc-50/80 py-2 backdrop-blur-sm">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <Input
            placeholder="Pesquisar por nome ou e-mail..."
            className="pl-12 h-14 bg-white border-zinc-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/50 transition-all text-base"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Button
          onClick={onAdd}
          className="h-14 px-6 bg-brand-charcoal hover:bg-zinc-800 text-white rounded-2xl shadow-lg shadow-zinc-200 active:scale-95 flex items-center gap-2 group transition-all"
        >
          <UserPlus size={22} className="group-hover:scale-110 transition-transform" />
          <span className="font-bold hidden sm:inline">Adicionar</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={role}
          onChange={(e) => onRoleChange(e.target.value as RoleFilter)}
          className="h-11 w-auto min-w-[9.5rem] rounded-xl bg-white text-sm font-bold"
        >
          <option value="ALL">Todos os papéis</option>
          <option value="ADMIN">Administrador</option>
          <option value="ATTENDANT">Atendente</option>
          <option value="COURIER">Motoboy</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          className="h-11 w-auto min-w-[8.5rem] rounded-xl bg-white text-sm font-bold"
        >
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="INACTIVE">Inativos</option>
        </Select>
        {branches.length > 0 && (
          <Select
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
            className="h-11 w-auto min-w-[9.5rem] rounded-xl bg-white text-sm font-bold"
          >
            <option value="ALL">Todas as filiais</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        )}
      </div>
    </div>
  );
}
