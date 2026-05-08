"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  TrendingUp, 
  Clock, 
  AlertCircle, 
  Percent,
  Gift,
  XCircle,
  Trophy,
  Coffee,
  Utensils,
  Lightbulb,
  Search,
  Hash,
  Pizza,
  Zap,
  FilterX
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reportsApi, CashReportResponse, CashReportFilters, ProductStat } from "@/lib/api/reports-api";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Period = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom';

export default function RelatorioPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<CashReportResponse | null>(null);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [error, setError] = useState("");
  
  const [filters, setFilters] = useState<CashReportFilters>({
    payment_method: 'ALL',
    category_id: 'ALL',
    start_date: '',
    end_date: ''
  });
  const [period, setPeriod] = useState<Period>('today');
  const [activeRankingTab, setActiveRankingTab] = useState<'general' | 'savory' | 'sweet' | 'drinks' | 'potatoes' | 'creams'>('general');

  // Authorization check
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, active")
        .eq("id", user.id)
        .single();
        
      if (!profile || profile.role !== "ADMIN" || !profile.active) {
        setIsAdmin(false);
        router.replace("/app/caixa");
      } else {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, [router, supabase]);

  // Load categories
  useEffect(() => {
    if (isAdmin === true) {
      reportsApi.getCategories().then(setCategories);
    }
  }, [isAdmin]);

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const now = new Date();
      const start = new Date();
      const end = new Date();
      
      switch (period) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          start.setDate(now.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end.setDate(now.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          break;
        case 'last7':
          start.setDate(now.getDate() - 7);
          start.setHours(0, 0, 0, 0);
          break;
        case 'last30':
          start.setDate(now.getDate() - 30);
          start.setHours(0, 0, 0, 0);
          break;
        case 'thisMonth':
          start.setDate(1);
          start.setHours(0, 0, 0, 0);
          break;
      }

      const finalFilters: CashReportFilters = {
        ...filters,
        start_date: start.toISOString(),
        end_date: end.toISOString()
      };

      const data = await reportsApi.getCashReport(finalFilters);
      setReport(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao carregar relatório");
    } finally {
      setIsLoading(false);
    }
  }, [period, filters]);

  useEffect(() => {
    if (isAdmin === true) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadReport();
    }
  }, [isAdmin, loadReport]);

  if (isAdmin === null || (isAdmin === true && isLoading && !report)) {
    return <LoadingState message="Consolidando dados estratégicos..." />;
  }

  if (error) {
    return (
      <div className="p-4">
        <ErrorState title="Falha no relatório" message={error} onRetry={() => loadReport()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] pb-24">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-500 hover:text-brand-red transition-colors">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight">Intelligence Dashboard</h1>
          <p className="text-[10px] font-bold text-brand-red uppercase tracking-widest">Marcos Krep&apos;s</p>
        </div>
        <button onClick={loadReport} className="p-1 -mr-1 text-slate-500">
          <Zap className={`h-5 w-5 ${isLoading ? 'animate-pulse text-amber-500' : ''}`} />
        </button>
      </header>

      {/* ─── Filters ─── */}
      <section className="p-4 space-y-3 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(['today', 'yesterday', 'last7', 'last30', 'thisMonth'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                period === p 
                ? 'bg-brand-red text-white shadow-md shadow-red-100' 
                : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              {p === 'today' && 'Hoje'}
              {p === 'yesterday' && 'Ontem'}
              {p === 'last7' && '7 Dias'}
              {p === 'last30' && '30 Dias'}
              {p === 'thisMonth' && 'Este Mês'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Categoria</label>
            <Select 
              value={filters.category_id} 
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
              className="h-10 text-xs font-bold bg-slate-50 border-slate-100"
            >
              <option value="ALL">Todas Categorias</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Pagamento</label>
            <Select 
              value={filters.payment_method} 
              onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}
              className="h-10 text-xs font-bold bg-slate-50 border-slate-100"
            >
              <option value="ALL">Todos Métodos</option>
              <option value="PIX">PIX</option>
              <option value="CASH">Dinheiro</option>
              <option value="DEBIT_CARD">Débito</option>
              <option value="CREDIT_CARD">Crédito</option>
              <option value="COURTESY">Cortesia</option>
            </Select>
          </div>
        </div>
      </section>

      {!report ? null : (
        <main className="p-4 space-y-6">
          {/* ─── Financial Summary ─── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <TrendingUp className="h-3 w-3" />
                Resumo de Performance
              </h2>
              {report.metadata.is_filtered_by_category && (
                <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                  Recorte por Categoria
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard 
                label="Recebido (Líquido)" 
                value={currency.format(report.summary.received)} 
                sub={`${report.summary.paid_orders} pedidos pagos`}
                color="text-emerald-600"
                bg="bg-white border-emerald-100"
              />
              <SummaryCard 
                label="Ticket Médio" 
                value={currency.format(report.summary.average_ticket)} 
                sub="Por pedido pago"
                color="text-blue-600"
                bg="bg-white border-blue-100"
              />
              <SummaryCard 
                label="Venda Bruta" 
                value={currency.format(report.summary.gross_sales)} 
                sub="Exceto cancelados"
                color="text-slate-800"
                bg="bg-white border-slate-200"
              />
              <SummaryCard 
                label="Pendente" 
                value={currency.format(report.summary.pending)} 
                sub="Total aguardando"
                color="text-amber-600"
                bg="bg-white border-amber-100"
              />
            </div>
          </section>

          {/* ─── Category Volume Indicators ─── */}
          <section className="space-y-3">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Zap className="h-3 w-3" />
              Volume por Categoria (Unidades)
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {report.category_breakdown.map((cat) => (
                <div key={cat.category_name} className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm text-center flex flex-col items-center gap-1 transition-transform active:scale-95">
                  <div className="p-1.5 rounded-lg bg-slate-50 text-brand-red mb-1">
                    {cat.category_name.includes('Salgado') && <Pizza className="h-4 w-4" />}
                    {cat.category_name.includes('Doce') && <Utensils className="h-4 w-4" />}
                    {cat.category_name.includes('Suco') && <Coffee className="h-4 w-4" />}
                    {cat.category_name.includes('Refri') && <Zap className="h-4 w-4" />}
                    {cat.category_name.includes('Batata') && <Hash className="h-4 w-4" />}
                    {cat.category_name.includes('Creme') && <Gift className="h-4 w-4" />}
                    {!['Salgado', 'Doce', 'Suco', 'Refri', 'Batata', 'Creme'].some(k => cat.category_name.includes(k)) && <Hash className="h-4 w-4" />}
                  </div>
                  <span className="text-[14px] font-black text-slate-800 leading-none">{cat.quantity}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase truncate w-full">{cat.category_name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Insights do Período ─── */}
          {report.insights.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Lightbulb className="h-3 w-3" />
                Insights Estratégicos
              </h2>
              <div className="grid grid-cols-1 gap-2">
                {report.insights.map((insight, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border-l-4 flex gap-3 items-start shadow-sm transition-transform active:scale-[0.98] ${
                    insight.severity === 'positive' ? 'bg-emerald-50 border-l-emerald-500' : 
                    insight.severity === 'warning' ? 'bg-red-50 border-l-red-500' : 
                    'bg-blue-50 border-l-blue-500'
                  }`}>
                    <div className={`p-2 rounded-xl shrink-0 ${
                      insight.severity === 'positive' ? 'bg-emerald-100 text-emerald-600' : 
                      insight.severity === 'warning' ? 'bg-red-100 text-red-600' : 
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {insight.severity === 'positive' ? <Trophy className="h-3 w-3" /> : 
                       insight.severity === 'warning' ? <AlertCircle className="h-3 w-3" /> : 
                       <TrendingUp className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800">{insight.title}</p>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ─── Performance por Categoria ─── */}
          {!report.metadata.is_filtered_by_category && (
            <section className="space-y-3">
              <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Hash className="h-3 w-3" />
                Desempenho por Categoria
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {report.category_breakdown.map((cat) => (
                  <Card key={cat.category_name} className="overflow-hidden border-slate-100 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs font-black text-slate-800">{cat.category_name}</span>
                          <span className="text-[10px] font-bold text-slate-400">{cat.percent.toFixed(1)}% do faturamento</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-red rounded-full transition-all duration-700"
                            style={{ width: `${cat.percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold pt-1">
                          <span>{cat.quantity} unidades</span>
                          <span>{currency.format(cat.revenue)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* ─── Hourly Analysis ─── */}
          <section className="space-y-3">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Volume por Horário
            </h2>
            <Card className="border-slate-100 shadow-sm overflow-hidden bg-white">
              <CardContent className="p-6 pt-10">
                <div className="flex items-end justify-between h-40 gap-1 px-1 border-b border-slate-100 mb-2">
                  {report.hourly_sales.map((h) => {
                    const hasSales = h.orders > 0;
                      // Enforce a min-height of 8% for any bar with sales so it doesn't disappear
                      const barHeight = hasSales ? Math.max(h.percent_of_peak, 8) : 0;
                      
                      return (
                        <div key={h.range} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                          {/* Tooltip/Label on hover or peak */}
                          <div className={`absolute -top-10 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-10 ${h.percent_of_peak === 100 ? 'opacity-100' : ''}`}>
                             <div className="bg-brand-charcoal text-white text-[9px] font-black py-1 px-2 rounded-lg shadow-xl whitespace-nowrap mb-1 border border-slate-700">
                                {h.orders} ped. / {h.items_quantity} un.
                                <div className="text-brand-yellow font-bold">{currency.format(h.received)}</div>
                             </div>
                             <div className="w-1.5 h-1.5 bg-brand-charcoal rotate-45 -mt-1.5 border-r border-b border-slate-700" />
                          </div>

                          {/* The Bar */}
                          <div 
                            className={`w-full rounded-t-md transition-all duration-1000 ease-out relative border-x border-t ${
                              h.percent_of_peak === 100 
                              ? 'bg-gradient-to-t from-brand-red to-red-400 border-red-500 shadow-[0_-2px_10px_rgba(231,51,53,0.3)]' 
                              : hasSales
                                ? 'bg-gradient-to-t from-brand-charcoal to-slate-500 border-slate-600 shadow-[0_-2px_6px_rgba(47,47,49,0.15)]'
                                : 'bg-slate-50 border-slate-100'
                            }`}
                            style={{ height: `${barHeight}%` }}
                          >
                             {h.percent_of_peak === 100 && (
                               <div className="absolute -top-4 left-1/2 -translate-x-1/2 animate-bounce">
                                 <Trophy className="h-3.5 w-3.5 text-amber-500 fill-amber-500 drop-shadow-sm" />
                               </div>
                             )}
                          </div>

                          {/* X-Axis Label */}
                          <div className="mt-3 text-center w-full">
                            <p className={`text-[9px] font-black tracking-tighter transition-colors ${h.percent_of_peak === 100 ? 'text-brand-red' : hasSales ? 'text-brand-charcoal' : 'text-slate-300'}`}>
                              {h.range.split('–')[0]}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                {/* Legend/Footer for chart */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-brand-red" />
                      <span className="text-[9px] font-bold text-slate-500">Pico</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-slate-200" />
                      <span className="text-[9px] font-bold text-slate-500">Volume</span>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 italic">Toque nas barras para detalhes</p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* ─── Rankings Complexos ─── */}
          <section className="space-y-3">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Trophy className="h-3 w-3" />
              Ranking Detalhado
            </h2>
            
            {/* Ranking Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              <RankingTab active={activeRankingTab === 'general'} onClick={() => setActiveRankingTab('general')} label="Todos" icon={Search} />
              <RankingTab active={activeRankingTab === 'savory'} onClick={() => setActiveRankingTab('savory')} label="Kreps Salgados" icon={Pizza} />
              <RankingTab active={activeRankingTab === 'sweet'} onClick={() => setActiveRankingTab('sweet')} label="Kreps Doces" icon={Utensils} />
              <RankingTab active={activeRankingTab === 'drinks'} onClick={() => setActiveRankingTab('drinks')} label="Sucos / Refri" icon={Coffee} />
              <RankingTab active={activeRankingTab === 'potatoes'} onClick={() => setActiveRankingTab('potatoes')} label="Batatas" icon={Hash} />
              <RankingTab active={activeRankingTab === 'creams'} onClick={() => setActiveRankingTab('creams')} label="Açaí / Cremes" icon={Gift} />
            </div>

            <Card className="border-slate-100 shadow-sm">
              <CardContent className="p-0">
                {activeRankingTab === 'general' && <RankingList items={report.top_all_products} />}
                {activeRankingTab === 'savory' && <RankingList items={report.category_rankings.savory_kreps} emptyMsg="Sem Kreps Salgados no período" />}
                {activeRankingTab === 'sweet' && <RankingList items={report.category_rankings.sweet_kreps} emptyMsg="Sem Kreps Doces no período" />}
                {activeRankingTab === 'drinks' && <RankingList items={[...report.category_rankings.juices, ...report.category_rankings.sodas].sort((a,b) => b.quantity - a.quantity)} emptyMsg="Sem Bebidas no período" />}
                {activeRankingTab === 'potatoes' && <RankingList items={report.category_rankings.potatoes} emptyMsg="Sem Batatas no período" />}
                {activeRankingTab === 'creams' && <RankingList items={report.category_rankings.creams} emptyMsg="Sem Açaí / Cremes no período" />}
              </CardContent>
            </Card>
          </section>

          {/* ─── Oportunidades (Baixa Saída) ─── */}
          <section className="space-y-3">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              Oportunidades de Atenção
            </h2>
            <Card className="border-slate-100 shadow-sm overflow-hidden">
               <CardHeader className="p-4 pb-0">
                 <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Itens ativos sem venda no período selecionado</p>
               </CardHeader>
               <CardContent className="p-4 pt-4 space-y-3">
                 {report.low_selling_products.length === 0 ? (
                   <div className="py-4 text-center">
                     <p className="text-[11px] font-bold text-slate-400 italic">Todos os produtos ativos tiveram vendas.</p>
                   </div>
                 ) : (
                   report.low_selling_products.map((item) => (
                     <div key={item.product_id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-800 truncate">{item.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.category}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg font-black text-slate-400">0 Vendas</span>
                        </div>
                     </div>
                   ))
                 )}
               </CardContent>
            </Card>
          </section>

          {/* ─── Financial Attention ─── */}
          <section className="space-y-3">
             <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FilterX className="h-3 w-3" />
              Auditores de Receita
            </h2>
            <div className="space-y-2">
              <AttentionCard 
                label="Descontos Concedidos" 
                value={currency.format(report.financial_attention.discount_total)} 
                count={report.financial_attention.discount_orders}
                icon={Percent}
                color="text-red-500"
                bg="bg-red-50"
              />
              <AttentionCard 
                label="Pedidos em Cortesia" 
                value={currency.format(report.financial_attention.courtesy_total)} 
                count={report.financial_attention.courtesy_orders}
                icon={Gift}
                color="text-violet-500"
                bg="bg-violet-50"
              />
              <AttentionCard 
                label="Cancelamentos" 
                value={currency.format(report.financial_attention.canceled_total)} 
                count={report.financial_attention.canceled_orders}
                icon={XCircle}
                color="text-slate-400"
                bg="bg-slate-100"
              />
            </div>
          </section>

          <footer className="py-8 text-center space-y-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Marcos Krep&apos;s PDV Intelligence v2.0
            </p>
            <p className="text-[9px] text-slate-300">
              Processado em {new Date().toLocaleString()}
            </p>
          </footer>
        </main>
      )}
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────── */

function SummaryCard({ label, value, sub, color, bg }: { 
  label: string; 
  value: string; 
  sub: string; 
  color: string; 
  bg: string;
}) {
  return (
    <Card className={`${bg} border shadow-sm transition-all active:scale-[0.98]`}>
      <CardContent className="p-4">
        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">{label}</p>
        <p className={`text-lg font-black tracking-tight ${color}`}>{value}</p>
        <p className="text-[10px] font-bold text-slate-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}

function RankingTab({ active, onClick, label, icon: Icon }: { 
  active: boolean; 
  onClick: () => void; 
  label: string; 
  icon: React.ElementType; 
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap ${
        active 
        ? 'bg-brand-charcoal text-white shadow-lg' 
        : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function RankingList({ items, emptyMsg = "Sem dados no período" }: { items: ProductStat[], emptyMsg?: string }) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-[11px] font-bold text-slate-400 italic">{emptyMsg}</p>
      </div>
    );
  }

  const maxQty = Math.max(...items.map(i => i.quantity)) || 1;

  return (
    <div className="divide-y divide-slate-50">
      {items.map((item, idx) => (
        <div key={idx} className="p-4 space-y-2 hover:bg-slate-50 transition-colors">
          <div className="flex justify-between items-start gap-3">
            <div className="flex gap-3 items-center min-w-0">
               <span className="text-[10px] font-black text-slate-300 w-4">#{idx + 1}</span>
               <div className="min-w-0">
                 <p className="text-xs font-black text-slate-800 truncate">{item.name}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{item.category}</p>
               </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-black text-slate-800">{item.quantity} <span className="text-[10px] text-slate-400">un</span></p>
              <p className="text-[10px] font-bold text-brand-red">{currency.format(item.revenue)}</p>
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
             <div 
               className={`h-full rounded-full transition-all duration-700 ${idx === 0 ? 'bg-brand-red' : 'bg-brand-charcoal'}`}
               style={{ width: `${(item.quantity / maxQty) * 100}%` }}
             />
          </div>
        </div>
      ))}
    </div>
  );
}

function AttentionCard({ label, value, count, icon: Icon, color, bg }: {
  label: string;
  value: string;
  count: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} p-4 rounded-2xl border border-slate-50 shadow-sm flex items-center justify-between active:scale-[0.98] transition-transform`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl bg-white shadow-sm ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{label}</p>
          <p className="text-[10px] font-bold text-slate-400">{count} registros</p>
        </div>
      </div>
      <p className={`text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}
