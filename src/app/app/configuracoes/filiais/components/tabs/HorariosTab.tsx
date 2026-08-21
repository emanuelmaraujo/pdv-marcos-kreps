import { BranchInput } from "@/lib/api/branches-admin-api";
import { Field } from "../FormPrimitives";
import { INPUT_CLS } from "../../utils";

export function HorariosTab({
  editing,
  setField,
}: {
  editing: BranchInput;
  setField: <K extends keyof BranchInput>(k: K, v: BranchInput[K]) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-secondary)]">
        Deixe em branco para usar o horário global configurado em Configurações. Quando preenchido, tem prioridade.
      </p>
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
      {editing.ordering_start_time && editing.ordering_end_time && (
        <p className="rounded-lg bg-[var(--status-info-bg)] px-3 py-2 text-[11px] text-[var(--status-info)]">
          Aceita pedidos das <strong>{editing.ordering_start_time}</strong> às <strong>{editing.ordering_end_time}</strong>
        </p>
      )}
    </div>
  );
}
