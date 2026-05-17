import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Origin-aware CORS — restringe às origens configuradas quando disponível.
// Consistente com as demais Edge Functions do projeto.
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const configured = Deno.env.get("PUBLIC_CHECKOUT_ALLOWED_ORIGINS") ?? "*";
  const allowed = configured.split(",").map((o) => o.trim()).filter(Boolean);
  const allowOrigin =
    configured === "*" || !origin || allowed.includes(origin)
      ? (origin || "*")
      : (allowed[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

/**
 * Normalizes and classifies products into operational groups.
 * Essential for robust rankings even if category names vary slightly.
 */
function classifyProductGroup(productName: string, categoryName: string): string {
  const name = productName.toLowerCase();
  const cat = categoryName.toLowerCase();

  if (cat.includes('krep') && cat.includes('salgado')) return 'Kreps Salgados';
  if (cat.includes('krep') && cat.includes('doce')) return 'Kreps Doces';
  if (cat.includes('batata')) return 'Batata';
  if (cat.includes('creme') || cat.includes('açaí') || cat.includes('acai')) return 'Cremes / Açaí';
  if (cat.includes('adicional')) return 'Adicionais';
  
  // Special handling for Drinks
  if (cat.includes('bebida') || cat.includes('combustível')) {
    if (name.includes('suco')) return 'Sucos';
    if (name.includes('refrigerante') || name.includes('coca') || name.includes('guaraná') || name.includes('fanta') || name.includes('sprite')) return 'Refrigerantes';
    if (name.includes('h2o') || name.includes('soda')) return 'Outros';
    return 'Outros';
  }

  return 'Outros';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 1. Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 401
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido ou expirado' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 401
      });
    }

    // 2. Validate Admin role
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'ADMIN' || !profile.active) {
      return new Response(JSON.stringify({ error: 'Acesso negado: Apenas administradores ativos.' }), {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 403
      });
    }

    // 3. Parse filters
    const { start_date, end_date, category_id, payment_method, branch_id } = await req.json();

    // 4. Query Orders
    let query = supabaseAdmin
      .from('orders')
      .select(`
        id,
        total_amount,
        payment_status,
        payment_method,
        status,
        discount_amount,
        created_at,
        daily_number
      `);

    if (start_date) query = query.gte('created_at', start_date);
    if (end_date) query = query.lte('created_at', end_date);
    if (payment_method && payment_method !== 'ALL') query = query.eq('payment_method', payment_method);
    if (branch_id) query = query.eq('branch_id', branch_id);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) throw ordersError;

    const cancellations = (orders || []).filter(o => o.status === 'CANCELADO').length;

    // 5. Query Order Items
    let itemsQuery = supabaseAdmin
      .from('order_items')
      .select(`
        product_id,
        product_name_snapshot,
        product_price_snapshot,
        quantity,
        total_price,
        order_id,
        products (
          category_id,
          categories (
            name
          )
        )
      `)
      .in('order_id', (orders || []).map(o => o.id));

    const { data: items, error: itemsError } = await itemsQuery;
    if (itemsError) throw itemsError;

    // 6. Fetch all active products for low-selling analysis
    const { data: activeProducts, error: activeProductsError } = await supabaseAdmin
      .from('products')
      .select(`
        id,
        name,
        category_id,
        categories (
          name
        )
      `)
      .eq('active', true);
    if (activeProductsError) throw activeProductsError;

    // 7. Aggregate Data
    const isFilteredByCategory = !!category_id && category_id !== 'ALL';

    const summary = {
      received: 0,
      pending: 0,
      courtesy: 0,
      canceled: 0,
      gross_sales: 0,
      discounts: 0,
      total_orders: orders?.length || 0,
      paid_orders: 0,
      average_ticket: 0,
    };

    const paymentBreakdownMap = new Map();
    const weekdayMap = new Map();
    const hourlyMap = new Map();
    const productStats = new Map();
    const categoryStats = new Map();
    const soldProductIds = new Set();

    const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const HOURS = ['17h–18h', '18h–19h', '19h–20h', '20h–21h', '21h–22h', '22h–23h', '23h–00h', '00h+'];

    // 7.1 Filter items by category if needed
    const filteredItems = isFilteredByCategory 
      ? (items || []).filter(item => item.products?.category_id === category_id)
      : (items || []);

    // 7.2 Calculate order metrics
    (orders || []).forEach(order => {
      const orderDate = new Date(order.created_at);
      const weekday = WEEKDAYS[orderDate.getDay()];
      const hour = orderDate.getHours();
      let hourRange = 'Outros';
      
      if (hour === 17) hourRange = '17h–18h';
      else if (hour === 18) hourRange = '18h–19h';
      else if (hour === 19) hourRange = '19h–20h';
      else if (hour === 20) hourRange = '20h–21h';
      else if (hour === 21) hourRange = '21h–22h';
      else if (hour === 22) hourRange = '22h–23h';
      else if (hour === 23) hourRange = '23h–00h';
      else if (hour >= 0 && hour < 5) hourRange = '00h+';

      const orderItems = (items || []).filter(i => i.order_id === order.id);
      const categorySpecificItems = orderItems.filter(i => !isFilteredByCategory || i.products?.category_id === category_id);
      
      // If category filter is active, skip orders that don't have items from that category
      if (isFilteredByCategory && categorySpecificItems.length === 0) return;

      const orderValue = isFilteredByCategory 
        ? categorySpecificItems.reduce((acc, i) => acc + Number(i.total_price || 0), 0)
        : Number(order.total_amount || 0);

      const discountValue = isFilteredByCategory ? 0 : Number(order.discount_amount || 0);

      if (order.status === 'CANCELADO') {
        summary.canceled += orderValue;
      } else {
        summary.gross_sales += orderValue;
        summary.discounts += discountValue;

        if (order.payment_status === 'PAID') {
          summary.received += orderValue;
          summary.paid_orders++;
        } else if (order.payment_status === 'PENDING') {
          summary.pending += orderValue;
        } else if (order.payment_status === 'COURTESY') {
          summary.courtesy += orderValue;
        }

        // Weekday
        const wData = weekdayMap.get(weekday) || { weekday, orders: 0, received: 0 };
        wData.orders++;
        if (order.payment_status === 'PAID') wData.received += orderValue;
        weekdayMap.set(weekday, wData);

        // Hourly
        const hData = hourlyMap.get(hourRange) || { range: hourRange, orders: 0, items_quantity: 0, received: 0 };
        hData.orders++;
        hData.items_quantity += categorySpecificItems.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
        if (order.payment_status === 'PAID') hData.received += orderValue;
        hourlyMap.set(hourRange, hData);

        // Payment
        const pMethod = order.payment_method;
        const pData = paymentBreakdownMap.get(pMethod) || { method: pMethod, total: 0, count: 0 };
        pData.count++;
        if (order.payment_status === 'PAID') pData.total += orderValue;
        paymentBreakdownMap.set(pMethod, pData);
      }
    });

    summary.average_ticket = summary.paid_orders > 0 ? summary.received / summary.paid_orders : 0;

    // 7.3 Items & Rankings
    filteredItems.forEach(item => {
      const order = orders?.find(o => o.id === item.order_id);
      if (!order || order.status === 'CANCELADO') return;

      const name = item.product_name_snapshot;
      const qty = Number(item.quantity || 0);
      const rev = Number(item.total_price || 0);
      const categoryName = item.products?.categories?.name || 'Sem Categoria';
      const group = classifyProductGroup(name, categoryName);
      
      soldProductIds.add(item.product_id);

      // Product stats
      const pStat = productStats.get(name) || { name, category: group, quantity: 0, revenue: 0 };
      pStat.quantity += qty;
      pStat.revenue += rev;
      productStats.set(name, pStat);

      // Category stats (breakdown)
      const cStat = categoryStats.get(group) || { category_name: group, quantity: 0, revenue: 0, orders_count: new Set() };
      cStat.quantity += qty;
      cStat.revenue += rev;
      cStat.orders_count.add(item.order_id);
      categoryStats.set(group, cStat);
    });

    // 7.4 Formatting Outputs
    const topAllProducts = Array.from(productStats.values())
      .sort((a, b) => b.quantity - a.quantity)
      .map(p => ({ ...p, percent: summary.gross_sales > 0 ? (p.revenue / summary.gross_sales) * 100 : 0 }));

    const categoryBreakdown = Array.from(categoryStats.values()).map(c => ({
      category_name: c.category_name,
      quantity: c.quantity,
      revenue: c.revenue,
      orders_count: c.orders_count.size,
      percent: summary.gross_sales > 0 ? (c.revenue / summary.gross_sales) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const hourlySalesRaw = HOURS.map(r => hourlyMap.get(r) || { range: r, orders: 0, items_quantity: 0, received: 0 });
    const peakOrders = Math.max(...hourlySalesRaw.map(h => h.orders)) || 1;
    const hourlySales = hourlySalesRaw.map(h => ({
      ...h,
      percent_of_peak: (h.orders / peakOrders) * 100
    }));

    const weekdaySales = WEEKDAYS.map(w => weekdayMap.get(w) || { weekday: w, orders: 0, received: 0 })
      .map(w => ({ ...w, average_ticket: w.orders > 0 ? w.received / w.orders : 0 }));

    // Category specific rankings
    const getGroupRank = (group: string) => topAllProducts.filter(p => p.category === group).slice(0, 10);
    const categoryRankings = {
      savory_kreps: getGroupRank('Kreps Salgados'),
      sweet_kreps: getGroupRank('Kreps Doces'),
      juices: getGroupRank('Sucos'),
      sodas: getGroupRank('Refrigerantes'),
      potatoes: getGroupRank('Batata'),
      creams: getGroupRank('Cremes / Açaí'),
      others: getGroupRank('Outros'),
    };

    // Low selling products
    const lowSellingProducts = (activeProducts || [])
      .filter(p => {
        // If filtered by category, only consider products from that category
        if (isFilteredByCategory && p.category_id !== category_id) return false;
        return !soldProductIds.has(p.id);
      })
      .map(p => ({
        product_id: p.id,
        name: p.name,
        category: classifyProductGroup(p.name, p.categories?.name || 'Sem Categoria'),
        quantity: 0,
        revenue: 0
      }))
      .slice(0, 10);

    // 8. Strategic Insights
    const insights = [];
    
    // 8.1 Peak Hour
    const peak = [...hourlySales].sort((a, b) => b.orders - a.orders)[0];
    if (peak && peak.orders > 0) {
      insights.push({
        title: 'Horário de Pico',
        description: `O horário das ${peak.range} é o seu motor principal, concentrando ${peak.orders} pedidos.`,
        severity: 'info'
      });
    }

    // 8.2 Operational Load (Avg Items per Order)
    const totalUnits = Array.from(categoryStats.values()).reduce((acc, c) => acc + c.quantity, 0);
    const avgItems = summary.paid_orders > 0 ? (totalUnits / summary.paid_orders).toFixed(1) : 0;
    if (Number(avgItems) > 0) {
      insights.push({
        title: 'Ticket de Itens',
        description: `Média de ${avgItems} itens por pedido. ${Number(avgItems) < 2 ? 'Oportunidade de aumentar o upsell de bebidas.' : 'Bom índice de acompanhamentos.'}`,
        severity: Number(avgItems) >= 2 ? 'positive' : 'info'
      });
    }

    // 8.3 Revenue Concentration (Pareto)
    const top3Revenue = topAllProducts.slice(0, 3).reduce((acc, p) => acc + p.revenue, 0);
    const concentration = summary.gross_sales > 0 ? (top3Revenue / summary.gross_sales) * 100 : 0;
    if (concentration > 0) {
      insights.push({
        title: 'Concentração de Receita',
        description: `Seus 3 produtos principais geram ${concentration.toFixed(0)}% do seu faturamento bruto.`,
        severity: concentration > 60 ? 'warning' : 'positive'
      });
    }

    // 8.4 Late Night Specialty (Top product after 22h)
    const lateItems = (items || []).filter(item => {
      const order = orders?.find(o => o.id === item.order_id);
      if (!order) return false;
      const hour = new Date(order.created_at).getHours();
      return hour >= 22 || hour < 5;
    });

    if (lateItems.length > 0) {
      const lateGroups = new Map();
      lateItems.forEach(i => {
        const group = classifyProductGroup(i.product_name_snapshot, i.products?.categories?.name || '');
        lateGroups.set(group, (lateGroups.get(group) || 0) + i.quantity);
      });
      const topLate = Array.from(lateGroups.entries()).sort((a, b) => b[1] - a[1])[0];
      if (topLate) {
        insights.push({
          title: 'Preferência da Madrugada',
          description: `Após as 22h, a categoria ${topLate[0]} é a mais pedida (${topLate[1]} unidades).`,
          severity: 'info'
        });
      }
    }

    // 8.5 Star Product
    const star = topAllProducts[0];
    if (star) {
      insights.push({
        title: 'Produto Estrela',
        description: `${star.name} liderou com ${star.quantity} unidades vendidas.`,
        severity: 'positive'
      });
    }

    // 8.6 Opportunity
    if (lowSellingProducts.length > 0) {
      insights.push({
        title: 'Oportunidade de Cardápio',
        description: `${lowSellingProducts.length} itens ativos não saíram. Considere promoções ou revisão de preços.`,
        severity: 'warning'
      });
    }

    const paymentBreakdown = Array.from(paymentBreakdownMap.values())
      .map(p => ({ ...p, percent: summary.received > 0 ? (p.total / summary.received) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);

    const financial_attention = {
      discount_orders: (orders || []).filter(o => Number(o.discount_amount || 0) > 0).length,
      discount_total: summary.discounts,
      courtesy_orders: (orders || []).filter(o => o.payment_status === 'COURTESY').length,
      courtesy_total: summary.courtesy,
      canceled_orders: cancellations,
      canceled_total: summary.canceled,
    };

    return new Response(JSON.stringify({
      summary,
      payment_breakdown: paymentBreakdown,
      category_breakdown: categoryBreakdown,
      top_all_products: topAllProducts.slice(0, 15),
      category_rankings: categoryRankings,
      hourly_sales: hourlySales,
      weekday_sales: weekdaySales,
      low_selling_products: lowSellingProducts,
      financial_attention,
      insights,
      metadata: {
        is_filtered_by_category: isFilteredByCategory,
        note: isFilteredByCategory ? "Valores por produto usam preço histórico e não rateiam descontos do pedido." : null
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error(`[cash-report] Erro:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
