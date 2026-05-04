import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'brand';
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const baseStyle = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:ring-offset-2";
  
  const variants = {
    default: "border-transparent bg-brand-red text-white",
    secondary: "border-transparent bg-zinc-100 text-zinc-600",
    destructive: "border-transparent bg-red-100 text-red-700",
    outline: "border-zinc-200 text-zinc-600 bg-white",
    success: "border-transparent bg-emerald-100 text-emerald-700",
    warning: "border-transparent bg-amber-100 text-amber-700",
    brand: "border-transparent bg-brand-charcoal text-white",
  };

  return (
    <div className={`${baseStyle} ${variants[variant]} ${className}`} {...props} />
  )
}
