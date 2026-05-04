"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { printerApi } from "@/lib/api/printer-api";
import { PrinterJobCard } from "./components/PrinterJobCard";
import { PrinterJob } from "@/types/pdv";

export default function ImpressaoPage() {
  const [jobs, setJobs] = useState<PrinterJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<string>("PENDING");

  const fetchJobs = useCallback(async () => {
    setError("");
    try {
      const data = await printerApi.getTodayJobs();
      setJobs(data || []);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Erro ao carregar fila de impressão");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchJobs();
    
    // Auto-refresh a cada 10 segundos
    const interval = setInterval(() => {
      fetchJobs();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const filteredJobs = jobs.filter((j) => {
    if (activeTab === "TODOS") return true;
    return j.status === activeTab;
  });

  const getCount = (status: string) => jobs.filter(j => j.status === status).length;

  const tabs = [
    { id: "PENDING", label: `Pendentes (${getCount('PENDING')})` },
    { id: "FAILED", label: `Falhas (${getCount('FAILED')})` },
    { id: "PRINTED", label: `Impressos (${getCount('PRINTED')})` },
  ];

  return (
    <div className="flex flex-col h-full bg-muted/10">
      <PageHeader title="Fila de Impressão" />
      
      <div className="flex justify-between items-center p-4 bg-white border-b border-border">
        <div className="flex space-x-2 overflow-x-auto hide-scrollbar">
          {tabs.map(tab => (
            <Badge 
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"} 
              className="whitespace-nowrap cursor-pointer text-sm py-1.5 px-3"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Badge>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => { setIsLoading(true); fetchJobs(); }} disabled={isLoading}>
          Atualizar
        </Button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading && jobs.length === 0 ? (
          <div className="flex justify-center p-8 text-muted-foreground text-sm">Carregando fila...</div>
        ) : error ? (
          <div className="text-red-500 text-center p-4 bg-red-50 rounded-md border border-red-200 text-sm font-medium">{error}</div>
        ) : filteredJobs.length === 0 ? (
          <EmptyState 
            title="Nenhum job aqui" 
            description="A fila está vazia para o status selecionado."
          />
        ) : (
          <div className="space-y-3 pb-20">
            {filteredJobs.map(job => (
              <PrinterJobCard 
                key={job.id} 
                job={job} 
                onJobUpdated={fetchJobs} 
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
