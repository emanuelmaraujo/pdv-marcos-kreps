import { Clock } from "lucide-react";
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
  return (
    <div className="space-y-4 lg:max-w-md">
      <FieldGroup>
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

        {editing.ordering_start_time && editing.ordering_end_time ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-[var(--status-info-bg)] px-3.5 py-3">
            <Clock className="h-4 w-4 shrink-0 text-[var(--status-info)]" />
            <p className="text-xs leading-relaxed text-[var(--status-info)]">
              Aceita pedidos das <strong>{editing.ordering_start_time}</strong> às <strong>{editing.ordering_end_time}</strong>
            </p>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
            Deixe em branco pra herdar o horário global configurado em Configurações.
          </p>
        )}
      </FieldGroup>
    </div>
  );
}
