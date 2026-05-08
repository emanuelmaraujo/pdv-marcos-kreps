"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { usersApi, UserProfile } from "@/lib/api/users-api";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { 
  UserPlus, 
  UserCog, 
  UserCheck, 
  Loader2, 
  Mail, 
  Search, 
  Users, 
  ShieldCheck, 
  UserMinus, 
  Clock,
  User as UserIcon,
  ChevronRight,
  Filter,
  MoreVertical,
  Activity
} from "lucide-react";

/**
 * Obtém as iniciais de um nome para o avatar.
 * @param name Nome completo do usuário
 */
function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[parts.length - 1][0] || '')).toUpperCase();
}

/**
 * Gera uma cor de fundo harmônica baseada no nome para o avatar.
 * @param name Nome do usuário para gerar o hash
 */
function getAvatarColor(name: string) {
  const colors = [
    'from-blue-500/20 to-blue-600/20 text-blue-600 border-blue-200/50',
    'from-emerald-500/20 to-emerald-600/20 text-emerald-600 border-emerald-200/50',
    'from-violet-500/20 to-violet-600/20 text-violet-600 border-violet-200/50',
    'from-amber-500/20 to-amber-600/20 text-amber-600 border-amber-200/50',
    'from-rose-500/20 to-rose-600/20 text-rose-600 border-rose-200/50',
    'from-indigo-500/20 to-indigo-600/20 text-indigo-600 border-indigo-200/50',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Formata a data de último acesso de forma relativa e amigável.
 * @param dateString ISO date string
 */
function formatLastSignIn(dateString?: string) {
  if (!dateString) return 'Nunca acessou';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  if (diffInHours < 24) {
    if (diffInHours < 1) {
      const diffInMins = diffInMs / (1000 * 60);
      if (diffInMins < 5) return 'Online';
      return `Há ${Math.floor(diffInMins)} min`;
    }
    return `Há ${Math.floor(diffInHours)}h`;
  }
  
  if (diffInHours < 48) return 'Ontem';
  
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function GestaoUsuarios() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "ATTENDANT" as "ADMIN" | "ATTENDANT",
    active: true
  });

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.listUsers();
      setUsers(data);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao carregar usuários";
      addToast("error", msg);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function handleAdd() {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "ATTENDANT",
      active: true
    });
    setIsModalOpen(true);
  }

  function handleEdit(user: UserProfile) {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      active: user.active
    });
    setIsModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await usersApi.updateUser({
          id: editingUser.id,
          name: formData.name,
          role: formData.role
        });
        addToast("success", "Usuário atualizado com sucesso!");
      } else {
        await usersApi.createUser(formData);
        addToast("success", "Usuário criado com sucesso!");
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar usuário";
      addToast("error", msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(user: UserProfile) {
    try {
      await usersApi.toggleStatus(user.id, !user.active);
      addToast("success", `Usuário ${!user.active ? 'ativado' : 'desativado'} com sucesso!`);
      loadUsers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro ao alterar status";
      addToast("error", msg);
    }
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: users.length,
    active: users.filter(u => u.active).length,
    admins: users.filter(u => u.role === 'ADMIN').length
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-200 border-t-brand-red animate-spin" />
        <span className="text-zinc-500 font-medium">Carregando usuários...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <PageHeader 
        title="Gestão de Usuários" 
        subtitle="Administre acessos e permissões da equipe"
        className="px-6 pt-8 pb-4"
      />

      <div className="p-6 space-y-8 flex-1 overflow-y-auto pb-32">
        {/* Sumário de Usuários - Design Premium */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-white/80 backdrop-blur-md border-zinc-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users size={48} />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
                <Users size={20} className="text-zinc-600" />
              </div>
              <span className="text-2xl font-black text-zinc-900 leading-tight">{stats.total}</span>
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Total</span>
            </CardContent>
          </Card>
          
          <Card className="bg-white/80 backdrop-blur-md border-zinc-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserCheck size={48} className="text-emerald-500" />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
                <UserCheck size={20} className="text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-emerald-600 leading-tight">{stats.active}</span>
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Ativos</span>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-md border-zinc-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck size={48} className="text-amber-500" />
            </div>
            <CardContent className="p-4 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
                <ShieldCheck size={20} className="text-amber-600" />
              </div>
              <span className="text-2xl font-black text-amber-600 leading-tight">{stats.admins}</span>
              <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Admins</span>
            </CardContent>
          </Card>
        </div>

        {/* Busca e Ação */}
        <div className="flex gap-3 sticky top-0 z-10 bg-zinc-50/80 backdrop-blur-sm py-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <Input 
              placeholder="Pesquisar por nome ou e-mail..." 
              className="pl-12 h-14 bg-white border-zinc-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red/50 transition-all text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleAdd} 
            className="h-14 px-6 bg-brand-charcoal hover:bg-zinc-800 text-white rounded-2xl shadow-lg shadow-zinc-200 active:scale-95 flex items-center gap-2 group transition-all"
          >
            <UserPlus size={22} className="group-hover:scale-110 transition-transform" />
            <span className="font-bold hidden sm:inline">Adicionar</span>
          </Button>
        </div>

        {/* Lista de Usuários */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} />
              Lista de Equipe
            </h3>
            <span className="text-xs text-zinc-400 font-medium">Exibindo {filteredUsers.length} resultados</span>
          </div>

          <div className="grid gap-4">
            {filteredUsers.map((user) => (
              <Card 
                key={user.id} 
                className={`group relative overflow-hidden bg-white border-zinc-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 rounded-3xl ${!user.active ? 'opacity-80' : ''}`}
              >
                {!user.active && (
                  <div className="absolute inset-0 bg-zinc-50/40 pointer-events-none" />
                )}
                
                <CardContent className="p-5 flex items-center gap-5">
                  {/* Avatar Representação */}
                  <div className={`relative shrink-0`}>
                    <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center font-black text-xl border-2 shadow-inner transition-transform group-hover:rotate-3 bg-gradient-to-br ${getAvatarColor(user.name)}`}>
                      {getInitials(user.name)}
                    </div>
                    {user.active ? (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-4 border-white rounded-full shadow-sm" />
                    ) : (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-zinc-300 border-4 border-white rounded-full shadow-sm" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-black text-zinc-900 truncate text-lg tracking-tight ${!user.active ? 'text-zinc-500' : ''}`}>
                        {user.name}
                      </span>
                      <Badge variant={user.role === 'ADMIN' ? 'brand' : 'secondary'} className="text-[10px] py-0.5 px-2 font-black uppercase tracking-wider rounded-lg">
                        {user.role === 'ADMIN' ? 'Admin' : 'Equipe'}
                      </Badge>
                      {user.role === 'ADMIN' && (
                        <ShieldCheck size={16} className="text-amber-500" strokeWidth={3} />
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 text-sm text-zinc-500 font-medium">
                        <div className="w-5 h-5 rounded-md bg-zinc-100 flex items-center justify-center">
                          <Mail size={12} className="text-zinc-400" />
                        </div>
                        <span className="truncate">{user.email}</span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 uppercase tracking-tight">
                          <Clock size={12} className="text-zinc-300" />
                          <span>Visto: {formatLastSignIn(user.last_sign_in_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 ml-auto shrink-0 transition-all">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`p-3 rounded-2xl transition-all shadow-sm border ${
                        user.active 
                          ? 'bg-zinc-50 border-zinc-100 text-zinc-600 active:scale-95' 
                          : 'bg-brand-amber/10 border-brand-amber/20 text-brand-amber active:scale-95'
                      }`}
                      title={user.active ? "Desativar" : "Ativar"}
                    >
                      {user.active ? <UserMinus className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
                    </button>
                    
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-brand-charcoal active:scale-95 transition-all shadow-sm"
                      title="Editar"
                    >
                      <UserCog className="w-6 h-6" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredUsers.length === 0 && (
              <div className="py-24 text-center space-y-6 bg-white/50 border-2 border-dashed border-zinc-200 rounded-[40px]">
                <div className="bg-zinc-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto ring-8 ring-zinc-50">
                  <Search size={40} className="text-zinc-300" />
                </div>
                <div className="space-y-2 max-w-xs mx-auto">
                  <h3 className="font-black text-xl text-zinc-800 tracking-tight">Nenhum resultado</h3>
                  <p className="text-zinc-500 font-medium">Não encontramos nenhum usuário com os termos "<b>{searchTerm}</b>".</p>
                  <Button variant="outline" onClick={() => setSearchTerm("")} className="mt-4 rounded-xl font-bold">Limpar Busca</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomSheet 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? "Configurações de Acesso" : "Novo Membro da Equipe"}
      >
        <form onSubmit={handleSave} className="p-8 space-y-8">
          <div className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl bg-gradient-to-br from-zinc-200 to-zinc-300 text-zinc-600 shadow-inner`}>
              {formData.name ? getInitials(formData.name) : <UserIcon size={24} />}
            </div>
            <div>
              <p className="text-sm font-black text-zinc-900 leading-tight">{formData.name || "Novo Usuário"}</p>
              <p className="text-xs text-zinc-400 font-medium">{formData.email || "aguardando e-mail..."}</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Nome Completo */}
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">
                Nome Completo
              </label>
              <div className="relative group">
                <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-red transition-colors" />
                <Input 
                  required
                  placeholder="Ex: Marcos Kreps" 
                  className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            {!editingUser && (
              <>
                {/* E-mail */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">
                    E-mail de Acesso
                  </label>
                  <div className="relative group">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-red transition-colors" />
                    <Input 
                      required
                      type="email"
                      placeholder="exemplo@pdvmarcos.com" 
                      className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">
                    Senha de Acesso
                  </label>
                  <div className="relative group">
                    <ShieldCheck size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-red transition-colors" />
                    <Input 
                      required
                      type="password"
                      placeholder="Mínimo 6 caracteres" 
                      className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-medium"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Nível de Acesso */}
            <div className="space-y-2">
              <label className="text-xs font-black text-zinc-400 uppercase tracking-widest px-1">
                Nível de Acesso
              </label>
              <div className="relative group">
                <Filter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-brand-red transition-colors z-10" />
                <Select 
                  value={formData.role}
                  className="h-14 pl-12 bg-zinc-50 border-zinc-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-brand-red/5 transition-all text-base font-bold appearance-none"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as "ADMIN" | "ATTENDANT" })}
                >
                  <option value="ATTENDANT">Atendente (PDV & Balcão)</option>
                  <option value="ADMIN">Administrador (Controle Total)</option>
                </Select>
              </div>
              <p className="text-[10px] text-zinc-400 italic px-2">Administradores podem gerenciar estoque, financeiro e outros usuários.</p>
            </div>
          </div>

          <div className="pt-6">
            <Button 
              type="submit" 
              loading={saving} 
              className="w-full h-16 text-lg font-black bg-brand-charcoal hover:bg-zinc-800 text-white shadow-xl shadow-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 rounded-[24px]"
            >
              {editingUser ? (
                <>
                  <UserCheck size={24} />
                  Salvar Alterações
                </>
              ) : (
                <>
                  <UserPlus size={24} />
                  Criar Usuário Agora
                </>
              )}
            </Button>
            
            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <ShieldCheck size={12} className="text-brand-amber" />
                Ação Segura e Auditada
              </div>
              <div className="w-12 h-1 rounded-full bg-zinc-100" />
            </div>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
