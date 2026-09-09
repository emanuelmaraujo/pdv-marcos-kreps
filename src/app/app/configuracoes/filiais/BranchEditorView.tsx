"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, Bike, Building2, Clock, CreditCard, Loader2, MessageSquare, Printer } from "lucide-react";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { TabbedForm, type TabbedFormTab } from "@/components/ui/TabbedForm";
import { useBranchEditor } from "@/hooks/useBranchEditor";
import { DadosTab } from "./components/tabs/DadosTab";
import { HorariosTab } from "./components/tabs/HorariosTab";
import { EntregaTab } from "./components/tabs/EntregaTab";
import { ImpressaoTab } from "./components/tabs/ImpressaoTab";
import { WhatsAppTab } from "./components/tabs/WhatsAppTab";
import { getFriendlyErrorMessage } from "@/lib/errors/messages";
import { SettingsBadge, SettingsPageHeader } from "../components/SettingsPageHeader";

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
      accent: { iconBg: "bg-[var(--status-info-bg)]", iconColor: "text-[var(--status-info)]" },
      validate: () => editor.validateDados(),
    },
    {
      id: "horarios", label: "Horários", icon: Clock,
      description: "Janela de atendimento — deixe em branco para usar o horário global.",
      accent: { iconBg: "bg-[var(--status-warning-bg)]", iconColor: "text-[var(--status-warning)]" },
    },
    {
      id: "entrega", label: "Entrega", icon: Bike,
      description: "Zonas de entrega, taxas por bairro e entregadores cadastrados.",
      accent: { iconBg: "bg-[var(--status-success-bg)]", iconColor: "text-[var(--status-success)]" },
    },
    {
      id: "impressao", label: "Impressão", icon: Printer,
      description: "IP e porta por setor — sem customização, usa o padrão da rede.",
      accent: { iconBg: "bg-brand-red/10", iconColor: "text-brand-red" },
    },
    {
      id: "whatsapp", label: "WhatsApp", icon: MessageSquare,
      description: "Templates transacionais por evento — sem customização, usa o padrão da rede.",
      accent: { iconBg: "bg-[var(--status-success-bg)]", iconColor: "text-[var(--status-success)]" },
    },
  ];

  if (editor.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando filial...
      </div>
    );
  }

  const statusPills: { label: string; tone: "success" | "warning" | "info" | "neutral" }[] = [
    editor.editing.active !== false
      ? { label: "Ativa", tone: "success" }
      : { label: "Inativa", tone: "neutral" },
    editor.editing.ordering_enabled !== false
      ? { label: "Pedidos online", tone: "success" }
      : { label: "Pedidos offline", tone: "warning" },
    editor.editing.delivery_enabled
      ? { label: "Entrega ligada", tone: "info" }
      : { label: "Sem entrega", tone: "neutral" },
    editor.editing.whatsapp_enabled !== false
      ? { label: "WhatsApp ligado", tone: "success" }
      : { label: "WhatsApp desligado", tone: "neutral" },
  ];

  const pageHeader = (
    <SettingsPageHeader
      eyebrow={branchId ? "Configuração da unidade" : "Estrutura da operação"}
      title={branchId ? editor.editing.name || "Editar filial" : "Nova filial"}
      description={branchId
        ? "Centralize os dados operacionais desta unidade. As alterações ficam isoladas nesta filial e as integrações podem herdar os padrões da rede."
        : "Cadastre a identidade da unidade primeiro; depois configure horários, entrega, impressão e WhatsApp no mesmo fluxo."}
      icon={Building2}
      meta={branchId ? statusPills.map((pill) => (
        <SettingsBadge key={pill.label} tone={pill.tone}>{pill.label}</SettingsBadge>
      )) : <SettingsBadge tone="info">Cadastro guiado em 5 etapas</SettingsBadge>}
      action={
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Link
            href="/app/configuracoes/filiais"
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          {branchId ? (
            <Link
              href={`/app/configuracoes/pagamentos?branch=${branchId}`}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-sm font-bold text-white transition-colors hover:bg-brand-red/90"
            >
              <CreditCard className="h-4 w-4" /> Taxas da filial
            </Link>
          ) : null}
        </div>
      }
    />
  );

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {pageHeader}

      <TabbedForm
        variant="page"
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
    </main>
  );
}
