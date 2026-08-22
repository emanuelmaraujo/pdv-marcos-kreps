"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Building2, Loader2, X } from "lucide-react";
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
    { id: "dados", label: "Dados", validate: () => editor.validateDados() },
    { id: "horarios", label: "Horários" },
    { id: "entrega", label: "Entrega" },
    { id: "impressao", label: "Impressão" },
    { id: "whatsapp", label: "WhatsApp" },
  ];

  if (editor.loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-[var(--text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando filial...
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-6">
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
      </header>

      <div className="flex-1 overflow-hidden">
        <TabbedForm
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
    </div>
  );
}
