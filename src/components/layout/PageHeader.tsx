import * as React from "react"

interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {action && <div>{action}</div>}
    </header>
  )
}
