"use client";

import { useState } from "react";
import { Product, Category } from "@/types/pdv";
import { AlertCircle, CheckCircle2, ExternalLink, ImageOff, Info, Loader2, X, Save } from "lucide-react";
import { DuplicateProductButton } from "./DuplicateProductButton";
import { ProductImage } from "./ProductImage";
import { looksLikeImagePath, normalizeProductImageUrl } from "@/lib/utils/product-image";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Product>) => Promise<void>;
  categories: Category[];
  product?: Product | null;
}

export function ProductModal({
  isOpen,
  onClose,
  onSave,
  categories,
  product,
}: ProductModalProps) {
  const [loading, setLoading] = useState(false);
  // Estado da foto: o que o admin digitou, o que dá pra usar de fato e o
  // recado pra ele (link recusado, link ajustado, link que não abriu).
  const [imageInput, setImageInput] = useState(product?.image_url ?? "");
  const [imageMessage, setImageMessage] = useState<
    { kind: "error" | "info" | "warn"; text: string } | null
  >(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [formData, setFormData] = useState<Partial<Product>>(
    product || {
      name: "",
      price: 0,
      cost_price: 0,
      category_id: categories[0]?.id || "",
      sector: "KITCHEN",
      active: true,
      image_url: "",
    }
  );

  if (!isOpen) return null;

  /**
   * Passa o que foi digitado pelo normalizador e devolve a URL pronta.
   * Retorna `false` quando o link não serve — aí o recado já está na tela e o
   * salvamento é abortado (antes, o input `type="url"` só travava o submit sem
   * dizer nada e parecia que o botão "Salvar" tinha morrido).
   */
  const resolveImage = (): string | null | false => {
    const { url, error, notice } = normalizeProductImageUrl(imageInput);
    if (error) {
      setImageMessage({ kind: "error", text: error });
      return false;
    }
    if (url && url !== imageInput.trim()) setImageInput(url);
    setImageLoadFailed(false);
    setImageMessage(
      notice
        ? { kind: "info", text: notice }
        : url && !looksLikeImagePath(url)
          ? { kind: "warn", text: "Esse link não termina em .jpg/.png — confira na pré-visualização se a foto aparece." }
          : null,
    );
    return url;
  };

  // Pré-visualização ao vivo: usa a URL já convertida, e só depois que o campo
  // tem cara de endereço inteiro — senão cada tecla digitada viraria um pedido
  // de imagem quebrado.
  const preview = normalizeProductImageUrl(imageInput);
  const previewUrl =
    !preview.error && preview.url && /^(\/|https:\/\/[^/]+\.[a-z]{2,})/i.test(preview.url)
      ? preview.url
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const image = resolveImage();
    if (image === false) return;
    try {
      setLoading(true);
      await onSave({ ...formData, image_url: image });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-black/40 animate-in fade-in duration-200 sm:items-center sm:p-4">
      <div className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[32px] bg-[var(--bg-surface)] p-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-full duration-300 sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px] sm:p-6">
        <div className="flex justify-between items-center mb-6 gap-2">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            {product ? "Editar Produto" : "Novo Produto"}
          </h2>
          <div className="flex items-center gap-1.5">
            {product?.id && <DuplicateProductButton productId={product.id} compact />}
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--bg-subtle)] rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
              Nome do Produto
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
              placeholder="Ex: Krep Especial"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
              Foto do produto (link)
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                <ProductImage
                  src={previewUrl}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-cover"
                  onLoadError={() => setImageLoadFailed(true)}
                  fallback={<ImageOff className="h-6 w-6" strokeWidth={1.5} />}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  value={imageInput}
                  onChange={(e) => {
                    setImageInput(e.target.value);
                    setImageLoadFailed(false);
                    setImageMessage(null);
                  }}
                  onBlur={() => {
                    if (imageInput.trim()) resolveImage();
                  }}
                  className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                  placeholder="Cole aqui o link da foto (opcional)"
                />
                {previewUrl && !previewUrl.startsWith("/") && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 px-1 text-xs font-bold text-brand-red underline-offset-2 hover:underline focus-ring"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir imagem
                  </a>
                )}
              </div>
            </div>
            {imageMessage ? (
              <p
                className={`mt-1.5 ml-1 flex items-start gap-1.5 text-[11px] leading-snug ${
                  imageMessage.kind === "error" ? "text-brand-red" : "text-[var(--text-muted)]"
                }`}
              >
                {imageMessage.kind === "error" ? (
                  <AlertCircle className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
                ) : (
                  <Info className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
                )}
                {imageMessage.text}
              </p>
            ) : imageLoadFailed ? (
              <p className="mt-1.5 ml-1 flex items-start gap-1.5 text-[11px] leading-snug text-brand-red">
                <AlertCircle className="mt-px h-3 w-3 shrink-0" strokeWidth={2} />
                Esse link não abriu como imagem. Abra a foto no navegador, clique com o botão
                direito e use &quot;Copiar endereço da imagem&quot;.
              </p>
            ) : previewUrl && !imageLoadFailed ? (
              <p className="mt-1.5 ml-1 flex items-start gap-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
                <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-green-600" strokeWidth={2} />
                Foto carregada — é assim que ela aparece no cardápio.
              </p>
            ) : (
              <p className="mt-1.5 ml-1 text-[11px] text-[var(--text-muted)]">
                Sem foto, o produto aparece com um ícone no cardápio público.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
                Preço (R$)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
                Custo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost_price ?? 0}
                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all"
                title="Custo unitário — usado para calcular margem nos relatórios"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
              Categoria
            </label>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-all appearance-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-muted)] uppercase mb-1 ml-1">
              Setor de Produção
            </label>
            <div className="flex gap-2">
              {(["KITCHEN", "JUICE_POTATO", "NONE"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFormData({ ...formData, sector: s })}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                    formData.sector === s
                      ? "bg-brand-charcoal text-white border-brand-charcoal shadow-md"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]"
                  }`}
                >
                  {s === "KITCHEN" ? "Kreps" : s === "JUICE_POTATO" ? "Cozinha" : "Nenhum"}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-red text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-red/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                {product ? "Salvar Alterações" : "Criar Produto"}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
