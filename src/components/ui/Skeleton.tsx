import * as React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Variante visual — bloco padrão, texto (altura menor), círculo (avatar). */
  shape?: "block" | "text" | "circle";
}

/**
 * Skeleton — placeholder animado para conteúdo carregando.
 * Use enquanto dados remotos estão chegando, no lugar do conteúdo final.
 *
 * Exemplo:
 *   <Skeleton className="h-6 w-40" />
 *   <Skeleton shape="circle" className="size-10" />
 */
export function Skeleton({ className = "", shape = "block", ...props }: SkeletonProps) {
  const shapeClass =
    shape === "circle" ? "rounded-full"
    : shape === "text" ? "rounded-md h-3"
    : "rounded-lg";

  return (
    <div
      className={`skeleton ${shapeClass} ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
