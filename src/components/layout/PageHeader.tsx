import * as React from "react"

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <header className={`sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md ${className || ''}`}>
      <div className="flex h-14 items-center justify-between px-4 md:px-6 lg:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-brand-charcoal">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="ml-3 shrink-0">{action}</div>}
      </div>
    </header>
  )
}
