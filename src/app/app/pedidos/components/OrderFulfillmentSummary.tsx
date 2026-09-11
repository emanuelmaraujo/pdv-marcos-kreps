"use client";

import { useState } from "react";
import type { Order } from "@/types/pdv";
import { formatWhatsAppInput } from "@/lib/utils/phone";
import { whatsappUrlForPhone } from "@/lib/utils/whatsapp";
import {
  deliveryDirectionsUrl,
  deliveryNumberLabel,
  deliveryStreetName,
  formatDeliveryPostalCode,
  fullDeliveryAddress,
} from "@/lib/utils/order-delivery";
import {
  Bike,
  Check,
  ChevronDown,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  ShoppingBag,
  UserRound,
} from "lucide-react";

type CopyStatus = "idle" | "copied" | "error";

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

export function OrderFulfillmentSummary({ order }: { order: Order }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const isDelivery = order.type === "ENTREGA";
  const isTakeout = order.type === "VIAGEM";
  const customerName = order.customer_name?.trim() || "Cliente final";
  const customerPhone = order.customer_phone?.trim();
  const formattedPhone = customerPhone ? formatWhatsAppInput(customerPhone) : "";
  const fullAddress = isDelivery ? fullDeliveryAddress(order) : "";
  const directionsUrl = isDelivery ? deliveryDirectionsUrl(order) : null;
  const locality = [order.delivery_neighborhood, order.delivery_city, order.delivery_state]
    .filter(Boolean)
    .join(" · ");
  const hasCustomerDetails = Boolean(customerPhone || order.customer_email);
  const hasDeliveryDetails = Boolean(
    isDelivery && (
      order.delivery_complement
      || order.delivery_reference
      || order.delivery_postal_code
      || order.courier_name
      || order.courier_phone
    )
  );

  const copyAddress = async () => {
    if (!fullAddress) return;
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  };

  return (
    <section className={`overflow-hidden rounded-2xl border ${isDelivery ? "border-blue-500/25 bg-blue-500/[0.06]" : isTakeout ? "border-[var(--status-warning)]/25 bg-[var(--status-warning-bg)]" : "border-[var(--border)] bg-[var(--bg-surface)]"}`}>
      <div className="p-3.5 sm:p-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${isDelivery ? "bg-blue-500" : isTakeout ? "bg-[var(--status-warning)]" : "bg-brand-charcoal"}`}>
            {isDelivery ? <Bike size={18} /> : isTakeout ? <ShoppingBag size={18} /> : <UserRound size={18} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-[10px] font-black uppercase tracking-widest ${isDelivery ? "text-blue-700" : isTakeout ? "text-[var(--status-warning)]" : "text-[var(--text-muted)]"}`}>
              {isDelivery ? "Cliente e entrega" : isTakeout ? "Cliente e retirada" : "Cliente do pedido"}
            </p>
            <p className="mt-0.5 truncate text-base font-black text-[var(--text-primary)]">{customerName}</p>
            {formattedPhone && <p className="mt-0.5 text-xs font-semibold text-[var(--text-secondary)]">{formattedPhone}</p>}
          </div>
        </div>

        {isDelivery && (
          <div className="mt-3 rounded-xl border border-blue-500/15 bg-[var(--bg-surface)] p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700">
              <MapPin size={13} /> Destino
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-black leading-snug text-[var(--text-primary)]">
                {deliveryStreetName(order)}
              </p>
              <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-black ${order.delivery_number?.trim() ? "bg-blue-500 text-white" : "bg-amber-500/15 text-amber-800"}`}>
                {deliveryNumberLabel(order)}
              </span>
            </div>
            {locality && <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{locality}</p>}
          </div>
        )}

        {isTakeout && (
          <p className="mt-3 rounded-xl bg-[var(--bg-surface)]/75 px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
            Separar para retirada no balcão e confirmar a entrega quando o cliente retirar.
          </p>
        )}
      </div>

      <div className={`grid border-t ${isDelivery ? "border-blue-500/15" : "border-[var(--border)]"} ${isDelivery && customerPhone && directionsUrl ? "grid-cols-3" : customerPhone || directionsUrl ? "grid-cols-2" : "grid-cols-1"}`}>
        {customerPhone && (
          <a
            href={`tel:${customerPhone}`}
            className="focus-ring flex min-h-11 items-center justify-center gap-1.5 border-r border-[var(--border)] px-2 text-xs font-black text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)]"
          >
            <Phone size={15} /> Ligar
          </a>
        )}
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring flex min-h-11 items-center justify-center gap-1.5 border-r border-[var(--border)] px-2 text-xs font-black text-blue-700 transition hover:bg-blue-500/10"
          >
            <Navigation size={15} /> Rota
          </a>
        )}
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          aria-expanded={isExpanded}
          aria-controls={`order-customer-details-${order.id}`}
          className="focus-ring flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-black text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)]"
        >
          {isExpanded ? "Ocultar" : "Ver mais"}
          <ChevronDown size={15} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {isExpanded && (
        <div id={`order-customer-details-${order.id}`} className="border-t border-[var(--border)] bg-[var(--bg-surface)] p-3.5 sm:p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-xl bg-[var(--bg-subtle)] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"><UserRound size={13} /> Contato</p>
              <DetailRow label="Nome" value={customerName} />
              <DetailRow label="Telefone" value={formattedPhone} />
              <DetailRow label="E-mail" value={order.customer_email} />
              {!hasCustomerDetails && <p className="text-xs font-semibold text-[var(--text-muted)]">Nenhum contato informado.</p>}
            </div>

            {isDelivery && (
              <div className="space-y-3 rounded-xl bg-blue-500/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-700"><MapPin size={13} /> Detalhes da entrega</p>
                <DetailRow label="Rua" value={order.delivery_street || "Não informada"} />
                <DetailRow label="Número" value={order.delivery_number || "Não informado"} />
                <DetailRow label="Bairro e cidade" value={locality} />
                <DetailRow label="Complemento" value={order.delivery_complement} />
                <DetailRow label="Referência" value={order.delivery_reference} />
                <DetailRow label="CEP" value={formatDeliveryPostalCode(order.delivery_postal_code)} />
                {!hasDeliveryDetails && <p className="text-xs font-semibold text-[var(--text-muted)]">Sem complemento ou referência adicional.</p>}
              </div>
            )}
          </div>

          {isDelivery && (order.courier_name || order.courier_phone) && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/15 px-3 py-2.5 text-xs font-semibold text-[var(--text-secondary)]">
              <span><strong className="text-[var(--text-primary)]">Entregador:</strong> {order.courier_name || "Não informado"}</span>
              {order.courier_phone && <a href={`tel:${order.courier_phone}`} className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-500 px-3 font-black text-white"><Phone size={13} /> Ligar para entregador</a>}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {customerPhone && (
              <a
                href={whatsappUrlForPhone(customerPhone, `Olá! Sobre o pedido #${order.daily_number} da Marcos Krep's.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-black text-emerald-700"
              >
                <MessageCircle size={15} /> WhatsApp
              </a>
            )}
            {order.customer_email && (
              <a href={`mailto:${order.customer_email}`} className="focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-xs font-black text-[var(--text-secondary)]">
                <Mail size={15} /> E-mail
              </a>
            )}
            {isDelivery && fullAddress && (
              <button
                type="button"
                onClick={copyAddress}
                className="focus-ring col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-3 text-xs font-black text-blue-700"
              >
                {copyStatus === "copied" ? <Check size={15} /> : <Copy size={15} />}
                {copyStatus === "copied" ? "Endereço copiado" : copyStatus === "error" ? "Não foi possível copiar" : "Copiar endereço"}
              </button>
            )}
          </div>
          <span className="sr-only" aria-live="polite">{copyStatus === "copied" ? "Endereço copiado" : copyStatus === "error" ? "Não foi possível copiar o endereço" : ""}</span>
        </div>
      )}
    </section>
  );
}
