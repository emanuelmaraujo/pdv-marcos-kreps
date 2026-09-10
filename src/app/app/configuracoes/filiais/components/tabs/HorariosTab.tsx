import { Clock, RotateCcw, Sun } from "lucide-react";
import { BranchInput } from "@/lib/api/branches-admin-api";
import { Field, FieldGroup } from "../FormPrimitives";
import { INPUT_CLS } from "../../utils";

export function HorariosTab({
  editing,
  setField,
}: {
  editing: BranchInput;
  setField: <K extends keyof BranchInput>(k: K, v: BranchInput[K]) => void;
}) {
  const hasCustomSchedule = Boolean(editing.ordering_start_time || editing.ordering_end_time);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <FieldGroup
        title="Horário de pedidos online"
        description="Defina uma janela própria ou mantenha a programação padrão da rede."
        icon={Clock}
        iconBg="bg-[var(--status-warning-bg)]"
        iconColor="text-[var(--status-warning)]"
        action={hasCustomSchedule ? (
          <button
            type="button"
            onClick={() => {
              setField("ordering_start_time", undefined);
              setField("ordering_end_time", undefined);
            }}
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Usar padrão
          </button>
        ) : undefined}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Abre às">
            <input
              type="time"
              value={editing.ordering_start_time ?? ''}
              onChange={(e) => setField('ordering_start_time', e.target.value || undefined)}
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Fecha às">
            <input
              type="time"
              value={editing.ordering_end_time ?? ''}
              onChange={(e) => setField('ordering_end_time', e.target.value || undefined)}
              className={INPUT_CLS}
            />
          </Field>
        </div>

        <div className={`rounded-xl border px-3.5 py-3 ${hasCustomSchedule ? "border-[var(--status-info)]/20 bg-[var(--status-info-bg)] text-[var(--status-info)]" : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}>
          <p className="text-xs font-bold">{hasCustomSchedule ? "Programação personalizada" : "Usando programação global"}</p>
          <p className="mt-1 text-[11px] leading-5 opacity-80">
            {editing.ordering_start_time && editing.ordering_end_time
              ? `Pedidos disponíveis das ${editing.ordering_start_time} às ${editing.ordering_end_time}.`
              : hasCustomSchedule
                ? "Preencha abertura e fechamento para concluir a janela desta filial."
                : "Esta unidade acompanha automaticamente o horário definido em Configurações gerais."}
          </p>
        </div>
      </FieldGroup>

      <aside className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--status-warning-bg)] text-[var(--status-warning)]"><Sun className="h-4 w-4" /></span>
          <div><p className="text-xs font-bold text-[var(--text-primary)]">Resumo operacional</p><p className="text-[10px] text-[var(--text-muted)]">Disponibilidade do cardápio público</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[var(--bg-surface)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Abertura</p><p className="mt-1 text-lg font-black text-[var(--text-primary)]">{editing.ordering_start_time || "Global"}</p></div>
          <div className="rounded-xl bg-[var(--bg-surface)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Fechamento</p><p className="mt-1 text-lg font-black text-[var(--text-primary)]">{editing.ordering_end_time || "Global"}</p></div>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-[var(--text-secondary)]">Fora dessa janela, o cliente vê a loja fechada e não consegue finalizar um novo pedido.</p>
      </aside>
    </div>
  );
}
