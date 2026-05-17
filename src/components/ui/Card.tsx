import * as React from "react"

export function Card({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col space-y-1 p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`font-semibold leading-none tracking-tight text-[var(--text-primary)] ${className}`} {...props}>
      {children}
    </h3>
  )
}

export function CardContent({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-4 pt-0 ${className}`} {...props}>
      {children}
    </div>
  )
}
