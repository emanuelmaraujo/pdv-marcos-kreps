import * as React from "react"
import { Loader2 } from "lucide-react";


export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'brand' | 'highlight';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', loading = false, children, disabled, ...props }, ref) => {
    const baseStyle = "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]";
    
    const variants = {
      default: "bg-brand-red text-white shadow-sm hover:bg-brand-red-dark",
      outline: "border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50 hover:text-zinc-900",
      ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
      destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700",
      brand: "bg-brand-charcoal text-white shadow-sm hover:bg-brand-black",
      highlight: "bg-brand-amber text-brand-charcoal shadow-sm hover:bg-brand-yellow font-bold",
    };
    
    const sizes = {
      default: "h-12 px-5 py-2",
      sm: "h-9 rounded-lg px-3 text-xs",
      lg: "h-14 rounded-xl px-8 text-base",
      icon: "h-12 w-12",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = "Button"
