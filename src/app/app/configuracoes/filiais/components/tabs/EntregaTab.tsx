import Link from "next/link";
import { Bike, Loader2, Plus, Trash2 } from "lucide-react";
import { BranchInput } from "@/lib/api/branches-admin-api";
import { Courier, DeliveryZone } from "@/types/pdv";
import { Select } from "@/components/ui/Select";
import { Field, Toggle } from "../FormPrimitives";
import { BRASILIA_NEIGHBORHOODS } from "@/lib/constants/brasilia-neighborhoods";
import { INPUT_CLS } from "../../utils";

export function EntregaTab({
  editing,
  setField,
  branchReady,
  zones,
  zonesLoading,
  newZone,
  setNewZone,
  savingZone,
  onAddZone,
  onToggleZone,
  onRemoveZone,
  couriers,
  couriersLoading,
  newCourier,
  setNewCourier,
  savingCourier,
  onAddCourier,
  onToggleCourier,
  onRemoveCourier,
}: {
  editing: BranchInput;
  setField: <K extends keyof BranchInput>(k: K, v: BranchInput[K]) => void;
  branchReady: boolean;
  zones: DeliveryZone[];
  zonesLoading: boolean;
  newZone: { neighborhood: string; fee: string };
  setNewZone: (v: { neighborhood: string; fee: string }) => void;
  savingZone: boolean;
  onAddZone: () => void;
  onToggleZone: (zone: DeliveryZone) => void;
  onRemoveZone: (zone: DeliveryZone) => void;
  couriers: Courier[];
  couriersLoading: boolean;
  newCourier: { name: string; phone: string };
  setNewCourier: (v: { name: string; phone: string }) => void;
  savingCourier: boolean;
  onAddCourier: () => void;
  onToggleCourier: (courier: Courier) => void;
  onRemoveCourier: (courier: Courier) => void;
}) {
  return (
    <div className="space-y-3">
      <Toggle
        label="Aceitar pedidos de entrega"
        desc="Habilita a opção Entrega no atendente e no checkout público desta filial"
        checked={editing.delivery_enabled === true}
        onChange={(v) => setField('delivery_enabled', v)}
      />

      {!editing.delivery_enabled && (
        <p className="rounded-lg bg-[var(--status-info-bg)] px-3 py-2 text-[11px] text-[var(--status-info)]">
          Ligue a opção acima para definir a taxa padrão e cadastrar os bairros atendidos (com a taxa de cada um).
        </p>
      )}

      {editing.delivery_enabled && (
        <>
          <Field label="Taxa padrão (R$)" hint="Usada enquanto nenhum bairro estiver cadastrado abaixo">
            <input
              type="number"
              step="0.01"
              min="0"
              value={editing.default_delivery_fee ?? 0}
              onChange={(e) => setField('default_delivery_fee', Number(e.target.value))}
              className={INPUT_CLS}
            />
          </Field>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3 space-y-2">
            <p className="text-[11px] text-[var(--text-secondary)]">
              {zones.length > 0
                ? 'Assim que há bairros cadastrados, entregas fora da lista são bloqueadas — o cliente vê que não atendemos aquele endereço.'
                : 'Nenhum bairro cadastrado ainda: toda entrega usa a taxa padrão acima.'}
            </p>

            {!branchReady ? (
              <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando cadastro de bairros...
              </div>
            ) : (
              <>
                {zonesLoading ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando bairros...
                  </div>
                ) : zones.length > 0 ? (
                  <div className="space-y-1.5">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleZone(zone)}
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            zone.active
                              ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                              : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'
                          }`}
                        >
                          {zone.active ? 'Ativo' : 'Inativo'}
                        </button>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{zone.neighborhood}</span>
                        <span className="shrink-0 text-xs font-bold text-[var(--text-secondary)]">
                          R$ {Number(zone.fee).toFixed(2).replace('.', ',')}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveZone(zone)}
                          className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)]"
                          aria-label={`Remover ${zone.neighborhood}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <Select
                    value={newZone.neighborhood}
                    onChange={(e) => setNewZone({ ...newZone, neighborhood: e.target.value })}
                    className={`${INPUT_CLS} flex-1`}
                  >
                    <option value="">Selecione o bairro...</option>
                    {BRASILIA_NEIGHBORHOODS
                      .filter((name) => !zones.some((z) => z.neighborhood === name))
                      .map((name) => <option key={name} value={name}>{name}</option>)}
                  </Select>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newZone.fee}
                    onChange={(e) => setNewZone({ ...newZone, fee: e.target.value })}
                    placeholder="Taxa"
                    className={`${INPUT_CLS} w-24`}
                  />
                  <button
                    type="button"
                    onClick={onAddZone}
                    disabled={savingZone || !newZone.neighborhood.trim()}
                    className="flex shrink-0 items-center justify-center rounded-xl bg-brand-red px-3 text-white disabled:opacity-40"
                    aria-label="Adicionar bairro"
                  >
                    {savingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 p-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">Entregadores cadastrados</p>
            <p className="text-[11px] text-[var(--text-secondary)]">Opcional — o despacho sempre permite digitar um entregador avulso também.</p>
            <Link href="/app/relatorios/entregadores" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-red hover:underline">
              <Bike className="h-3.5 w-3.5" />
              Ver métricas de entrega por motoboy
            </Link>

            {!branchReady ? (
              <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando cadastro de entregadores...
              </div>
            ) : (
              <>
                {couriersLoading ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando entregadores...
                  </div>
                ) : couriers.length > 0 ? (
                  <div className="space-y-1.5">
                    {couriers.map((courier) => (
                      <div key={courier.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleCourier(courier)}
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            courier.active
                              ? 'bg-[var(--status-success-bg)] text-[var(--status-success)]'
                              : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]'
                          }`}
                        >
                          {courier.active ? 'Ativo' : 'Inativo'}
                        </button>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-primary)]">{courier.name}</span>
                        {courier.phone && <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{courier.phone}</span>}
                        <button
                          type="button"
                          onClick={() => onRemoveCourier(courier)}
                          className="shrink-0 rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)]"
                          aria-label={`Remover ${courier.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newCourier.name}
                    onChange={(e) => setNewCourier({ ...newCourier, name: e.target.value })}
                    placeholder="Nome do entregador"
                    className={`${INPUT_CLS} flex-1`}
                  />
                  <input
                    type="text"
                    value={newCourier.phone}
                    onChange={(e) => setNewCourier({ ...newCourier, phone: e.target.value })}
                    placeholder="Telefone"
                    className={`${INPUT_CLS} w-32`}
                  />
                  <button
                    type="button"
                    onClick={onAddCourier}
                    disabled={savingCourier || !newCourier.name.trim()}
                    className="flex shrink-0 items-center justify-center rounded-xl bg-brand-red px-3 text-white disabled:opacity-40"
                    aria-label="Adicionar entregador"
                  >
                    {savingCourier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
