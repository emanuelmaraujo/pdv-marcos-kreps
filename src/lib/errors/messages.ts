/**
 * Dicionário central de mensagens de erro.
 *
 * Regra do plano de UX (docs/plano-acao-ux-ui.md, seção 1 e Fase 0):
 * nenhuma exceção crua (`error.message` de Supabase/PostgREST/rede, em
 * inglês e com vocabulário de banco de dados) deve chegar à interface.
 * Todo catch que hoje faz `error instanceof Error ? error.message : fallback`
 * deve trocar para `getFriendlyErrorMessage(error, fallback)`.
 *
 * Se um erro não mapeado aparecer com frequência, adicione um padrão aqui —
 * isso é sinal de cobertura faltando, não motivo para deixar o texto cru
 * passar "só dessa vez".
 */

type ErrorPattern = {
  /** Trecho (case-insensitive) procurado na mensagem técnica original. */
  match: string;
  friendly: string;
};

const KNOWN_ERRORS: ErrorPattern[] = [
  // Rede / conectividade
  { match: "failed to fetch", friendly: "Sem conexão com o servidor. Verifique sua internet e tente novamente." },
  { match: "networkerror", friendly: "Sem conexão com o servidor. Verifique sua internet e tente novamente." },
  { match: "network request failed", friendly: "Sem conexão com o servidor. Verifique sua internet e tente novamente." },
  { match: "timeout", friendly: "A operação demorou mais do que o esperado. Tente novamente." },
  { match: "load failed", friendly: "Sem conexão com o servidor. Verifique sua internet e tente novamente." },

  // Autenticação / sessão (Supabase Auth / JWT)
  { match: "jwt expired", friendly: "Sua sessão expirou. Faça login novamente." },
  { match: "invalid login credentials", friendly: "E-mail ou senha incorretos." },
  { match: "invalid refresh token", friendly: "Sua sessão expirou. Faça login novamente." },
  { match: "user not found", friendly: "Não encontramos essa conta." },
  { match: "email not confirmed", friendly: "Confirme seu e-mail antes de entrar." },

  // Banco de dados / PostgREST — nunca expor nome de tabela/coluna/constraint
  { match: "duplicate key", friendly: "Já existe um registro com essas informações." },
  { match: "violates foreign key", friendly: "Não é possível concluir porque há dados relacionados a isso." },
  { match: "violates not-null", friendly: "Preencha todos os campos obrigatórios." },
  { match: "violates check constraint", friendly: "Um dos valores informados não é válido." },
  { match: "permission denied", friendly: "Você não tem permissão para fazer isso." },
  { match: "row-level security", friendly: "Você não tem permissão para fazer isso." },
  { match: "pgrst", friendly: "Não foi possível concluir a operação. Tente novamente." },

  // Limites e disponibilidade
  { match: "rate limit", friendly: "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo." },
  { match: "too many requests", friendly: "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo." },
  { match: "service unavailable", friendly: "O serviço está indisponível no momento. Tente novamente em instantes." },
];

/**
 * Converte um erro capturado em `catch` para uma mensagem segura de exibir.
 * Nunca retorna o texto técnico original — só o fallback amigável passado
 * pelo chamador, a menos que o erro bata em um padrão conhecido acima
 * (nesse caso, a mensagem mapeada é mais específica que o fallback genérico).
 */
export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const lower = raw.toLowerCase();

  for (const { match, friendly } of KNOWN_ERRORS) {
    if (lower.includes(match)) return friendly;
  }

  return fallback;
}
