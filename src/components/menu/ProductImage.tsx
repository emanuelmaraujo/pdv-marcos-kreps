"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { buildImageCandidates } from "@/lib/utils/productImage";

interface ProductImageProps {
  /** URL guardada no produto (link do Drive, link externo ou caminho local). */
  src?: string | null;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** O que desenhar quando não há foto ou nenhum endereço carregou. */
  fallback: ReactNode;
  /** Avisa a tela de cadastro que a foto não carregou, pra mostrar o alerta. */
  onLoadError?: () => void;
}

/**
 * Foto de produto tolerante a link ruim.
 *
 * Três cuidados que o <Image> puro não tinha e por isso a foto sumia:
 *
 * 1. Tenta os endereços alternativos do Google Drive em sequência
 *    (buildImageCandidates). O Drive serve o mesmo arquivo por endpoints
 *    diferentes e nem todo arquivo responde em todos — tentando um por um, a
 *    foto aparece em vez de deixar buraco no cardápio.
 * 2. `unoptimized`: sem isso o Next baixa a imagem no servidor pra otimizar, e
 *    o Drive (como várias CDNs) recusa esse download. Carregando direto no
 *    navegador do cliente, funciona igual a abrir o link na aba.
 * 3. `referrerPolicy="no-referrer"`: vários hosts só liberam a imagem quando
 *    não conseguem ver de qual site ela está sendo pedida.
 *
 * Se todos falharem, cai no ícone da categoria em vez do quadrado quebrado.
 */
export function ProductImage({
  src,
  alt = "",
  width,
  height,
  className,
  sizes,
  priority,
  fallback,
  onLoadError,
}: ProductImageProps) {
  const candidates = buildImageCandidates(src);
  // Guarda a tentativa atual junto do src de origem: trocar o link no cadastro
  // tem que recomeçar a fila do zero.
  const [attempt, setAttempt] = useState<{ src: string; index: number }>({
    src: src ?? "",
    index: 0,
  });
  const index = attempt.src === (src ?? "") ? attempt.index : 0;
  const current = candidates[index];

  if (!current) return <>{fallback}</>;

  return (
    <Image
      key={current}
      src={current}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      unoptimized
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        const next = index + 1;
        setAttempt({ src: src ?? "", index: next });
        // Só é erro de verdade quando acabaram as alternativas.
        if (next >= candidates.length) onLoadError?.();
      }}
    />
  );
}
