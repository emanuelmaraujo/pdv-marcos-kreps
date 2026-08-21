export function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1][0] || "")).toUpperCase();
}

const AVATAR_COLORS = [
  "from-blue-500/20 to-blue-600/20 text-blue-600 border-blue-200/50",
  "from-emerald-500/20 to-emerald-600/20 text-emerald-600 border-emerald-200/50",
  "from-violet-500/20 to-violet-600/20 text-violet-600 border-violet-200/50",
  "from-amber-500/20 to-amber-600/20 text-amber-600 border-amber-200/50",
  "from-rose-500/20 to-rose-600/20 text-rose-600 border-rose-200/50",
  "from-indigo-500/20 to-indigo-600/20 text-indigo-600 border-indigo-200/50",
];

export function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatLastSignIn(dateString?: string) {
  if (!dateString) return "Nunca acessou";
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  if (diffInHours < 24) {
    if (diffInHours < 1) {
      const diffInMins = diffInMs / (1000 * 60);
      if (diffInMins < 5) return "Online";
      return `Há ${Math.floor(diffInMins)} min`;
    }
    return `Há ${Math.floor(diffInHours)}h`;
  }
  if (diffInHours < 48) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
