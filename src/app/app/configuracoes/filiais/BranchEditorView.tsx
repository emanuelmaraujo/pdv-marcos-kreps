"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bike, Building2, Clock, Loader2, MessageSquare, Printer, ShoppingBag, X } from "lucide-react";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { TabbedForm, type TabbedFormTab } from "@/components/ui/TabbedForm";
import { useBranchEditor } from "@/hooks/useBranchEditor";
import { DadosTab } from "./components/tabs/DadosTab";
import { HorariosTab } from "./components/tabs/HorariosTab";
import { EntregaTab } from "./components/tabs/EntregaTab";
import { ImpressaoTab } from "./components/tabs/ImpressaoTab";
import { WhatsAppTab } from "./components/tabs/WhatsAppTab";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";

const TAB_ORDER = ["dados", "horarios", "entrega", "impressao", "whatsapp"];

export function BranchEditorView({ branchId }: { branchId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editor = useBranchEditor(branchId);
  const { toasts, addToast, removeToast } = useToast();

  const activeTab = TAB_ORDER.includes(searchParams.get("tab") ?? "") ? (searchParams.get("tab") as string) : "dados";

  const goToTab = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  // Se a URL aponta direto pra uma aba além de "Dados" sem a filial ainda
  // existir (ex: link colado à mão), volta pra "Dados" — as outras abas
  // dependem de um branchId real.
  useEffect(() => {
    if (!editor.loading && !editor.branchId && activeTab !== "dados") {
      goToTab("dados");
    }
  }, [editor.loading, editor.branchId, activeTab, goToTab]);

  async function handleTabChange(nextId: string) {
    if (!editor.branchId && nextId !== "dados") {
      try {
        await editor.ensureCreated();
      } catch (e: unknown) {
        addToast("error", getFriendlyErrorMessage(e, "Preencha os dados básicos antes de continuar."));
        return;
      }
    }
    goToTab(nextId);
  }

  async function handleSubmit() {
    try {
      await editor.save();
      addToast("success", branchId ? "Filial salva!" : "Filial criada!");
      router.push("/app/configuracoes/filiais");
    } catch (e: unknown) {
      addToast("error", getFriendlyErrorMessage(e, "Não conseguimos salvar a filial."));
    }
  }

  const tabs: TabbedFormTab[] = [
    {
      id: "dados", label: "Dados", icon: Building2,
      description: "Nome, identificação e disponibilidade da filial.",
      accent: { iconBg: "bg-blue-100", iconColor: "text-blue-600" },
      validate: () => editor.validateDados(),
    },
    {
      id: "horarios", label: "Horários", icon: Clock,
      description: "Janela de atendimento — deixe em branco para usar o horário global.",
      accent: { iconBg: "bg-amber-100", iconColor: "text-amber-600" },
    },
    {
      id: "entrega", label: "Entrega", icon: Bike,
      description: "Zonas de entrega, taxas por bairro e entregadores cadastrados.",
      accent: { iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
    },
    {
      id: "impressao", label: "Impressão", icon: Printer,
      description: "IP e porta por setor — sem customização, usa o padrão da rede.",
      accent: { iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    },
    {
      id: "whatsapp", label: "WhatsApp", icon: MessageSquare,
      description: "Templates transacionais por evento — sem customização, usa o padrão da rede.",
      accent: { iconBg: "bg-teal-100", iconColor: "text-teal-600" },
    },
  ];

  if (editor.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando filial...
      </div>
    );
  }

  const statusPills: { label: string; tone: "success" | "warning" | "info" | "neutral"; icon: typeof Building2 }[] = [
    editor.editing.active !== false
      ? { label: "Ativa", tone: "success", icon: Building2 }
      : { label: "Inativa", tone: "neutral", icon: Building2 },
    editor.editing.ordering_enabled !== false
      ? { label: "Pedidos online", tone: "success", icon: ShoppingBag }
      : { label: "Pedidos offline", tone: "warning", icon: ShoppingBag },
    editor.editing.delivery_enabled
      ? { label: "Entrega ligada", tone: "info", icon: Bike }
      : { label: "Sem entrega", tone: "neutral", icon: Bike },
    editor.editing.whatsapp_enabled !== false
      ? { label: "WhatsApp ligado", tone: "success", icon: MessageSquare }
      : { label: "WhatsApp desligado", tone: "neutral", icon: MessageSquare },
  ];

  const PILL_TONE_CLS: Record<string, string> = {
    success: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
    warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning)]",
    info: "bg-[var(--status-info-bg)] text-[var(--status-info)]",
    neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]",
  };

  const header = (
    <header className="border-b border-[var(--border)] px-4 py-3 sm:px-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-black text-[var(--text-primary)]">
          {branchId ? `Editar — ${editor.editing.name || "filial"}` : "Nova filial"}
        </h1>
        <Link
          href="/app/configuracoes/filiais"
          className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          aria-label="Voltar para a lista de filiais"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>
      {branchId && (
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto">
          {statusPills.map((pill) => (
            <span
              key={pill.label}
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold ${PILL_TONE_CLS[pill.tone]}`}
            >
              <pill.icon className="h-3 w-3" strokeWidth={2} />
              {pill.label}
            </span>
          ))}
        </div>
      )}
    </header>
  );

  return (
    <div className="mx-auto max-w-3xl lg:max-w-5xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <TabbedForm
        variant="page"
        header={header}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSubmit={handleSubmit}
        submitting={editor.saving || editor.creatingDraft}
        submitLabel={branchId ? "Salvar filial" : "Criar filial"}
      >
        {activeTab === "dados" && <DadosTab editing={editor.editing} setField={editor.setField} />}
          {activeTab === "horarios" && <HorariosTab editing={editor.editing} setField={editor.setField} />}
          {activeTab === "entrega" && (
            <EntregaTab
              editing={editor.editing}
              setField={editor.setField}
              branchReady={editor.branchReady}
              zones={editor.zones}
              zonesLoading={editor.zonesLoading}
              newZone={editor.newZone}
              setNewZone={editor.setNewZone}
              savingZone={editor.savingZone}
              onAddZone={() => void editor.addZone().catch((e: unknown) => addToast("error", getFriendlyErrorMessage(e, "Não conseguimos adicionar o bairro.")))}
              onToggleZone={(zone) => void editor.toggleZoneActive(zone).catch((e: unknown) => addToast("error", getFriendlyErrorMessage(e, "Não conseguimos atualizar o bairro.")))}
              onRemoveZone={(zone) => void editor.removeZone(zone).catch((e: unknown) => addToast("error", getFriendlyErrorMessage(e, "Não conseguimos remover o bairro.")))}
              couriers={editor.couriers}
              couriersLoading={editor.couriersLoading}
              newCourier={editor.newCourier}
              setNewCourier={editor.setNewCourier}
              savingCourier={editor.savingCourier}
              onAddCourier={() => void editor.addCourier().catch((e: unknown) => addToast("error", getFriendlyErrorMessage(e, "Não conseguimos adicionar o entregador.")))}
              onToggleCourier={(courier) => void editor.toggleCourierActive(courier).catch((e: unknown) => addToast("error", getFriendlyErrorMessage(e, "Não conseguimos atualizar o entregador.")))}
              onRemoveCourier={(courier) => void editor.removeCourier(courier).catch((e: unknown) => addToast("error", getFriendlyErrorMessage(e, "Não conseguimos remover o entregador.")))}
            />
          )}
          {activeTab === "impressao" && (
            <ImpressaoTab printerCfg={editor.printerCfg} setPrinterCfg={editor.setPrinterCfg} globalSettings={editor.globalSettings} />
          )}
          {activeTab === "whatsapp" && (
            <WhatsAppTab
              editing={editor.editing}
              setField={editor.setField}
              waCfg={editor.waCfg}
              setWaCfg={editor.setWaCfg}
              globalSettings={editor.globalSettings}
            />
          )}
      </TabbedForm>
    </div>
  );
}
