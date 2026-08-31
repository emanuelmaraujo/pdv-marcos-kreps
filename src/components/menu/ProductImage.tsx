"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";

interface ProductImageProps {
  /** URL já normalizada (normalizeProductImageUrl) ou caminho local. */
  src?: string | null;
  alt?: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** O que desenhar quando não há foto ou o link não carregou. */
  fallback: ReactNode;
  /** Avisa a tela de cadastro que o link não carregou, pra mostrar o alerta. */
  onLoadError?: () => void;
}

/**
 * Foto de produto tolerante a link ruim.
 *
 * Dois cuidados que o <Image> puro não tinha e por isso a foto sumia:
 *
 * 1. `unoptimized`: sem isso o Next baixa a imagem no servidor pra otimizar, e
 *    um monte de host (CDN com proteção contra hotlink, Drive, storage que
 *    responde 403 pra quem não é navegador) recusa esse download — resultado:
 *    espaço vazio no cardápio mesmo com o link certo. Carregando direto no
 *    navegador do cliente, funciona igual a abrir o link na aba.
 * 2. `referrerPolicy="no-referrer"`: vários hosts liberam a imagem só quando
 *    não conseguem ver de qual site ela está sendo pedida.
 *
 * E, se ainda assim falhar, cai no ícone da categoria em vez de deixar o
 * quadrado quebrado.
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
  // Guarda *qual* src falhou: trocar o link no cadastro tem que dar nova chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const clean = src?.trim();
  if (!clean || failedSrc === clean) return <>{fallback}</>;

  return (
    <Image
      key={clean}
      src={clean}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      unoptimized
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        setFailedSrc(clean);
        onLoadError?.();
      }}
    />
  );
}
