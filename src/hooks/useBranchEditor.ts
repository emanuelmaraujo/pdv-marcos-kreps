import { useCallback, useEffect, useRef, useState } from "react";
import { Branch, Courier, DeliveryZone } from "@/types/pdv";
import { branchesAdminApi, BranchInput, couriersApi, deliveryZonesApi } from "@/lib/api/branches-admin-api";
import { settingsApi } from "@/lib/api/settings-api";
import { EMPTY_BRANCH, PrinterConfig, WaTemplates, parseConfig, parseTemplates, validateBranchCode, validateBranchSlug } from "@/app/app/configuracoes/filiais/utils";

// Estado + ações de edição de uma filial — usado tanto na criação (branchId
// inicial undefined) quanto na edição (branchId vindo da rota /filiais/[id]).
// No fluxo de criação, a filial é criada de fato (ensureCreated) assim que o
// usuário sai da aba "Dados" pela primeira vez — depois disso o resto do
// wizard funciona exatamente como editar uma filial existente, sem exigir
// um "salvar" explícito antes de cadastrar bairros/entregadores.
export function useBranchEditor(initialBranchId?: string) {
  const [branchId, setBranchId] = useState<string | null>(initialBranchId ?? null);
  const [editing, setEditing] = useState<BranchInput>({ ...EMPTY_BRANCH });
  const [printerCfg, setPrinterCfg] = useState<PrinterConfig>({});
  const [waCfg, setWaCfg] = useState<WaTemplates>({});
  const [globalSettings, setGlobalSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!initialBranchId);
  const [saving, setSaving] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  const [newZone, setNewZone] = useState({ neighborhood: "", fee: "" });
  const [savingZone, setSavingZone] = useState(false);

  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [couriersLoading, setCouriersLoading] = useState(false);
  const [newCourier, setNewCourier] = useState({ name: "", phone: "" });
  const [savingCourier, setSavingCourier] = useState(false);

  const loadZones = useCallback(async (id: string) => {
    setZonesLoading(true);
    try {
      setZones(await deliveryZonesApi.listByBranch(id));
    } finally {
      setZonesLoading(false);
    }
  }, []);

  const loadCouriers = useCallback(async (id: string) => {
    setCouriersLoading(true);
    try {
      setCouriers(await couriersApi.listByBranch(id));
    } finally {
      setCouriersLoading(false);
    }
  }, []);

  useEffect(() => {
    void settingsApi.getSettings().then(setGlobalSettings).catch(() => { /* Impressão/WhatsApp seguem sem indicador de herança se isso falhar */ });
  }, []);

  useEffect(() => {
    if (!initialBranchId) return;
    let cancelled = false;
    async function loadBranch(id: string) {
      setLoading(true);
      try {
        const branch = await branchesAdminApi.getById(id);
        if (cancelled) return;
        applyBranch(branch);
        void loadZones(id);
        void loadCouriers(id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadBranch(initialBranchId);
    return () => { cancelled = true; };
  }, [initialBranchId, loadZones, loadCouriers]);

  function applyBranch(b: Branch) {
    setEditing({
      code: b.code, slug: b.slug, name: b.name, type: b.type, active: b.active,
      address: b.address, phone: b.phone,
      packing_fee: Number(b.packing_fee ?? 0),
      ordering_enabled: b.ordering_enabled,
      ordering_start_time: b.ordering_start_time,
      ordering_end_time: b.ordering_end_time,
      whatsapp_enabled: b.whatsapp_enabled,
      delivery_enabled: b.delivery_enabled,
      default_delivery_fee: Number(b.default_delivery_fee ?? 0),
      monthly_revenue_goal: b.monthly_revenue_goal != null ? Number(b.monthly_revenue_goal) : null,
    });
    setPrinterCfg(parseConfig(b.printer_config as Record<string, unknown>));
    setWaCfg(parseTemplates(b.whatsapp_templates));
  }

  function setField<K extends keyof BranchInput>(k: K, v: BranchInput[K]) {
    setEditing((prev) => ({ ...prev, [k]: v }));
  }

  function validateDados(): string | null {
    if (!editing.name.trim()) return "Informe o nome da filial.";
    if (!editing.code.trim()) return "Informe o código da filial.";
    if (!validateBranchCode(editing.code)) return "Código inválido — só letras maiúsculas ou dígitos (máx 3).";
    if (!editing.slug.trim()) return "Informe o slug (URL) da filial.";
    if (!validateBranchSlug(editing.slug)) return "Slug inválido — mín. 2 caracteres, só minúsculas, números e hífen.";
    return null;
  }

  function buildPayload(): BranchInput {
    // Uma chave presente com valor `undefined` ainda é vista pelo cliente
    // Supabase (Object.keys) e entra na query `columns=`, o que faz o
    // PostgREST tentar inserir NULL explícito em vez de aplicar o
    // DEFAULT '{}' da coluna — e branches.printer_config é NOT NULL.
    // Por isso as chaves são omitidas de vez (não setadas como undefined)
    // quando não há customização.
    const payload: BranchInput = { ...editing };
    if (Object.keys(printerCfg).length) payload.printer_config = printerCfg;
    if (Object.keys(waCfg).length) payload.whatsapp_templates = waCfg;
    return payload;
  }

  // Guarda a promise em andamento: dois cliques rápidos em "Próximo" (antes do
  // primeiro re-render desabilitar o botão) chamariam ensureCreated() duas
  // vezes com branchId ainda null nas duas closures, criando a filial em
  // duplicidade. Compartilhar a mesma promise entre chamadas concorrentes
  // fecha essa race condition sem depender só do estado (que só atualiza no
  // próximo render).
  const creatingPromiseRef = useRef<Promise<string> | null>(null);

  /** Garante que a filial já existe no banco — cria na primeira chamada (fluxo "novo"), no-op depois. */
  const ensureCreated = useCallback(async (): Promise<string> => {
    if (branchId) return branchId;
    if (creatingPromiseRef.current) return creatingPromiseRef.current;

    const validationError = validateDados();
    if (validationError) throw new Error(validationError);

    const promise = (async () => {
      setCreatingDraft(true);
      try {
        const created = await branchesAdminApi.create(buildPayload());
        setBranchId(created.id);
        return created.id;
      } finally {
        setCreatingDraft(false);
        creatingPromiseRef.current = null;
      }
    })();
    creatingPromiseRef.current = promise;
    return promise;
    // buildPayload/validateDados fecham sobre editing/printerCfg/waCfg mas
    // são recriadas a cada render (não memoizadas) — listá-las aqui recriaria
    // ensureCreated em todo render e anularia o useCallback. Listar o estado
    // bruto do qual elas dependem tem o mesmo efeito de "frescor" sem esse custo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, editing, printerCfg, waCfg]);

  async function save(): Promise<void> {
    setSaving(true);
    try {
      if (branchId) {
        await branchesAdminApi.update(branchId, buildPayload());
      } else {
        const created = await branchesAdminApi.create(buildPayload());
        setBranchId(created.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addZone() {
    const id = await ensureCreated();
    const fee = Number(newZone.fee.replace(",", "."));
    if (!newZone.neighborhood.trim() || !Number.isFinite(fee) || fee < 0) {
      throw new Error("Informe um bairro e uma taxa válida.");
    }
    setSavingZone(true);
    try {
      await deliveryZonesApi.create(id, { neighborhood: newZone.neighborhood.trim(), fee });
      setNewZone({ neighborhood: "", fee: "" });
      await loadZones(id);
    } finally {
      setSavingZone(false);
    }
  }

  async function toggleZoneActive(zone: DeliveryZone) {
    if (!branchId) return;
    await deliveryZonesApi.update(zone.id, { active: !zone.active });
    await loadZones(branchId);
  }

  async function removeZone(zone: DeliveryZone) {
    if (!branchId) return;
    await deliveryZonesApi.remove(zone.id);
    await loadZones(branchId);
  }

  async function addCourier() {
    const id = await ensureCreated();
    if (!newCourier.name.trim()) throw new Error("Informe o nome do entregador.");
    setSavingCourier(true);
    try {
      await couriersApi.create(id, { name: newCourier.name.trim(), phone: newCourier.phone.trim() || undefined });
      setNewCourier({ name: "", phone: "" });
      await loadCouriers(id);
    } finally {
      setSavingCourier(false);
    }
  }

  async function toggleCourierActive(courier: Courier) {
    if (!branchId) return;
    await couriersApi.update(courier.id, { active: !courier.active });
    await loadCouriers(branchId);
  }

  async function removeCourier(courier: Courier) {
    if (!branchId) return;
    await couriersApi.remove(courier.id);
    await loadCouriers(branchId);
  }

  return {
    branchId,
    branchReady: !!branchId,
    editing,
    setField,
    printerCfg,
    setPrinterCfg,
    waCfg,
    setWaCfg,
    globalSettings,
    loading,
    saving,
    creatingDraft,
    validateDados,
    ensureCreated,
    save,
    zones,
    zonesLoading,
    newZone,
    setNewZone,
    savingZone,
    addZone,
    toggleZoneActive,
    removeZone,
    couriers,
    couriersLoading,
    newCourier,
    setNewCourier,
    savingCourier,
    addCourier,
    toggleCourierActive,
    removeCourier,
  };
}
