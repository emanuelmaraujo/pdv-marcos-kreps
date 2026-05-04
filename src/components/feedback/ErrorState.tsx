import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = "Algo deu errado", 
  message = "Ocorreu um erro inesperado. Tente novamente.", 
  onRetry 
}: ErrorStateProps) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center space-y-4 p-8 text-center bg-destructive/10 rounded-xl border border-destructive/20">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h3 className="font-semibold text-destructive">{title}</h3>
        <p className="text-sm text-destructive/80">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="destructive" size="sm" className="mt-2">
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
