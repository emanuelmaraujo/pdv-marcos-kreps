const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type CheckoutSummaryProps = {
  orderType: "BALCAO" | "VIAGEM" | "ENTREGA";
  subtotal: number;
  packagingFee: number;
  deliveryFee: number;
  deliveryFeeKnown: boolean;
  deliveryBlocked: boolean;
  couponCode?: string;
  couponDiscount: number;
  freeDelivery: boolean;
  total: number;
};

/** Prévia para revisão; não autoriza preço ou cobrança. O servidor recalcula o pedido. */
export function CheckoutSummary(props: CheckoutSummaryProps) {
  const deliveryPending = props.orderType === "ENTREGA" && !props.deliveryFeeKnown;
  const rows = [
    ["Itens e adicionais", currency.format(props.subtotal)],
    [props.orderType === "VIAGEM" ? "Embalagem para viagem" : "Embalagem", currency.format(props.packagingFee)],
    ["Entrega", props.orderType !== "ENTREGA" ? "Não se aplica"
      : props.deliveryBlocked ? "Região não atendida"
        : deliveryPending ? "A calcular após validar o endereço"
          : props.freeDelivery ? `Grátis com ${props.couponCode ?? "cupom"}`
            : currency.format(props.deliveryFee)],
  ];

  return (
    <section aria-label="Resumo de custos do pedido" className="rounded-2xl bg-[var(--bg-subtle)] p-4">
      <dl className="space-y-2 text-sm text-[var(--text-secondary)]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <dt>{label}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
        {props.couponDiscount > 0 && (
          <div className="flex items-start justify-between gap-3 text-[var(--status-success)]">
            <dt>Desconto{props.couponCode ? ` (${props.couponCode})` : ""}</dt>
            <dd className="text-right tabular-nums">- {currency.format(props.couponDiscount)}</dd>
          </div>
        )}
        <div className="flex items-start justify-between gap-3 border-t border-[var(--border)] pt-2 font-semibold text-[var(--text-primary)]">
          <dt>{deliveryPending || props.deliveryBlocked ? "Total parcial" : "Total estimado"}</dt>
          <dd className="text-right text-lg tabular-nums">{currency.format(props.total)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-[var(--text-muted)]">O valor final é confirmado quando você envia o pedido, antes de pagar.</p>
    </section>
  );
}
