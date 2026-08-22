import Link from "next/link";
import { Bike, Loader2, MapPin, Plus, Trash2, User } from "lucide-react";
import { BranchInput } from "@/lib/api/branches-admin-api";
import { Courier, DeliveryZone } from "@/types/pdv";
import { Select } from "@/components/ui/Select";
import { Field, FieldGroup, Toggle } from "../FormPrimitives";
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
    <div className="space-y-4">
      <Toggle
        label="Aceitar pedidos de entrega"
        desc="Habilita a opção Entrega no atendente e no checkout público desta filial"
        checked={editing.delivery_enabled === true}
        onChange={(v) => setField('delivery_enabled', v)}
      />

      {!editing.delivery_enabled && (
        <p className="rounded-xl bg-[var(--status-info-bg)] px-3.5 py-3 text-xs leading-relaxed text-[var(--status-info)]">
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

          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
          <FieldGroup>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                <MapPin className="h-4 w-4 text-emerald-600" />
              </span>
              <p className="text-xs font-black text-[var(--text-primary)]">Bairros atendidos</p>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
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
                      <div key={zone.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 shadow-sm transition-shadow hover:shadow-md">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)]">
                          <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[var(--text-primary)]">{zone.neighborhood}</p>
                          <button
                            type="button"
                            onClick={() => onToggleZone(zone)}
                            className={`text-[10px] font-bold ${
                              zone.active ? 'text-[var(--status-success)]' : 'text-[var(--status-neutral)]'
                            }`}
                          >
                            {zone.active ? '● Ativo' : '○ Inativo'}
                          </button>
                        </div>
                        <span className="shrink-0 text-xs font-black text-[var(--text-secondary)]">
                          R$ {Number(zone.fee).toFixed(2).replace('.', ',')}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveZone(zone)}
                          className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)]"
                          aria-label={`Remover ${zone.neighborhood}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2 border-t border-[var(--border)] pt-3">
                  <Select
                    value={newZone.neighborhood}
                    onChange={(e) => setNewZone({ ...newZone, neighborhood: e.target.value })}
                    className={`${INPUT_CLS} w-full`}
                  >
                    <option value="">Selecione o bairro...</option>
                    {BRASILIA_NEIGHBORHOODS
                      .filter((name) => !zones.some((z) => z.neighborhood === name))
                      .map((name) => <option key={name} value={name}>{name}</option>)}
                  </Select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newZone.fee}
                      onChange={(e) => setNewZone({ ...newZone, fee: e.target.value })}
                      placeholder="Taxa (R$)"
                      className={`${INPUT_CLS} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={onAddZone}
                      disabled={savingZone || !newZone.neighborhood.trim()}
                      className="flex shrink-0 items-center justify-center rounded-xl bg-brand-red px-4 text-white shadow-sm shadow-brand-red/20 transition-transform active:scale-95 disabled:opacity-40"
                      aria-label="Adicionar bairro"
                    >
                      {savingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </FieldGroup>

          <FieldGroup>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                <Bike className="h-4 w-4 text-indigo-600" />
              </span>
              <p className="text-xs font-black text-[var(--text-primary)]">Entregadores cadastrados</p>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              Opcional — o despacho sempre permite digitar um entregador avulso também.{" "}
              <Link href="/app/relatorios/entregadores" className="font-semibold text-brand-red hover:underline">
                Ver métricas por motoboy →
              </Link>
            </p>

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
                      <div key={courier.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 shadow-sm transition-shadow hover:shadow-md">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-subtle)]">
                          <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[var(--text-primary)]">{courier.name}</p>
                          <button
                            type="button"
                            onClick={() => onToggleCourier(courier)}
                            className={`text-[10px] font-bold ${
                              courier.active ? 'text-[var(--status-success)]' : 'text-[var(--status-neutral)]'
                            }`}
                          >
                            {courier.active ? '● Ativo' : '○ Inativo'}
                          </button>
                        </div>
                        {courier.phone && <span className="shrink-0 text-[11px] font-semibold text-[var(--text-muted)]">{courier.phone}</span>}
                        <button
                          type="button"
                          onClick={() => onRemoveCourier(courier)}
                          className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger)]"
                          aria-label={`Remover ${courier.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="space-y-2 border-t border-[var(--border)] pt-3">
                  <input
                    type="text"
                    value={newCourier.name}
                    onChange={(e) => setNewCourier({ ...newCourier, name: e.target.value })}
                    placeholder="Nome do entregador"
                    className={`${INPUT_CLS} w-full`}
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCourier.phone}
                      onChange={(e) => setNewCourier({ ...newCourier, phone: e.target.value })}
                      placeholder="Telefone"
                      className={`${INPUT_CLS} min-w-0 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={onAddCourier}
                      disabled={savingCourier || !newCourier.name.trim()}
                      className="flex shrink-0 items-center justify-center rounded-xl bg-brand-red px-4 text-white shadow-sm shadow-brand-red/20 transition-transform active:scale-95 disabled:opacity-40"
                      aria-label="Adicionar entregador"
                    >
                      {savingCourier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </FieldGroup>
          </div>
        </>
      )}
    </div>
  );
}
