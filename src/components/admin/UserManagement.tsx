'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Edit2, Eye, KeyRound, Loader2, Plus, RefreshCw, Search, Shield, ShieldAlert, UserCheck, UserX, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { hasValidProvisionalPassword, isValidUserEmail } from '@/lib/admin/userValidation';

interface InvestorRef { id: string; displayName: string }
interface UserRow {
  id: string; email: string; name: string; role: 'ADMIN' | 'INVESTOR'; active: boolean;
  firstLogin: boolean; investorId: string | null; createdAt: string; updatedAt: string; investor: InvestorRef | null;
}
type SortField = 'name' | 'email' | 'role' | 'active' | 'investor' | 'createdAt';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch { return iso; }
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

export function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [investors, setInvestors] = useState<InvestorRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'ADMIN' | 'INVESTOR'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [uRes, iRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/investors')]);
      if (!uRes.ok) throw new Error('Falha ao carregar usuarios');
      if (!iRes.ok) throw new Error('Falha ao carregar investidores');
      const uData = await uRes.json();
      const iData = await iRes.json();
      setUsers(uData.users); setInvestors(iData.investors);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function toggleActive(user: UserRow) {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !user.active }) });
      const data = await res.json();
      if (!res.ok) return showToast('error', data.error || 'Erro ao atualizar');
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)));
      showToast('success', user.active ? `${user.name} inativado` : `${user.name} reativado`);
    } catch { showToast('error', 'Erro de rede'); }
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  }

  const filtered = users.filter((u) => {
    if (filterRole !== 'ALL' && u.role !== filterRole) return false;
    if (filterStatus === 'ACTIVE' && !u.active) return false;
    if (filterStatus === 'INACTIVE' && u.active) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.investor?.displayName.toLowerCase().includes(q) ?? false);
  }).sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'name': return a.name.localeCompare(b.name) * dir;
      case 'email': return a.email.localeCompare(b.email) * dir;
      case 'role': return a.role.localeCompare(b.role) * dir;
      case 'active': return (Number(a.active) - Number(b.active)) * dir;
      case 'investor': return (a.investor?.displayName ?? '').localeCompare(b.investor?.displayName ?? '') * dir;
      case 'createdAt': return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      default: return 0;
    }
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.active).length;
  const investorUsers = users.filter((u) => u.role === 'INVESTOR').length;
  const unlinkedInvestors = users.filter((u) => u.role === 'INVESTOR' && !u.investorId).length;

  const SortIcon = ({ field }: { field: SortField }) => sortField !== field ? <ChevronDown className="h-3 w-3 opacity-30" /> : sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-[#022D44]" /> : <ChevronDown className="h-3 w-3 text-[#022D44]" />;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <StatCard label="Total" value={totalUsers} icon={<Shield className="h-3.5 w-3.5" />} />
        <StatCard label="Ativos" value={activeUsers} icon={<UserCheck className="h-3.5 w-3.5" />} accent="green" />
        <StatCard label="Investidores" value={investorUsers} icon={<UserCheck className="h-3.5 w-3.5" />} accent="blue" />
        <StatCard label="Sem vinculo" value={unlinkedInvestors} icon={<ShieldAlert className="h-3.5 w-3.5" />} accent={unlinkedInvestors > 0 ? 'red' : undefined} />
      </div>

      <div className="card-premium flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 gap-2.5 md:grid-cols-[minmax(280px,1.25fr)_180px_180px_44px]">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, email ou investidor..." className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10" />
          </div>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as typeof filterRole)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10">
            <option value="ALL">Todos os papeis</option><option value="ADMIN">Admin</option><option value="INVESTOR">Investidor</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10">
            <option value="ALL">Todos os status</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option>
          </select>
          <button onClick={loadData} disabled={loading} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50" title="Atualizar"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#022D44] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#033b5a] lg:min-w-[180px]"><Plus className="h-4 w-4" />Novo usuario</button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="data-table-shell overflow-hidden rounded-[24px] border border-white/60 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
                {([['name','Nome'],['email','Email'],['role','Papel'],['investor','Investidor'],['active','Status'],['createdAt','Criado em']] as [SortField,string][]).map(([field,label]) => (
                  <th key={field} onClick={() => handleSort(field)} className="cursor-pointer select-none px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-[#022D44]"><span className="inline-flex items-center gap-1">{label}<SortIcon field={field} /></span></th>
                ))}
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="py-16 text-center text-sm text-slate-400">Nenhum usuario encontrado</td></tr> : filtered.map((user) => (
                <tr key={user.id} className={`border-b border-slate-50 transition-colors hover:bg-slate-50/60 ${!user.active ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3.5"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold text-white ${user.role === 'ADMIN' ? 'bg-[#022D44]' : 'bg-slate-400'}`}>{user.name.charAt(0).toUpperCase()}</div><p className="font-medium text-slate-800">{user.name}</p></div></td>
                  <td className="px-4 py-3.5 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3.5"><Badge variant={user.role === 'ADMIN' ? 'accent' : 'info'} size="sm">{user.role === 'ADMIN' ? 'Admin' : 'Investidor'}</Badge></td>
                  <td className="px-4 py-3.5 text-slate-600">{user.investor ? user.investor.displayName : user.role === 'INVESTOR' ? <span className="text-red-500">Sem vinculo</span> : <span className="text-slate-300">-</span>}</td>
                  <td className="px-4 py-3.5"><div className="flex items-center gap-1.5"><Badge variant={user.active ? 'success' : 'error'} size="sm">{user.active ? 'Ativo' : 'Inativo'}</Badge>{user.firstLogin && user.role === 'INVESTOR' && <Badge variant="warning" size="sm" title="Aguardando troca de senha no primeiro acesso">1o acesso</Badge>}</div></td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3.5"><div className="flex items-center justify-end gap-1"><button onClick={() => setEditingUser(user)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#022D44]" title="Editar"><Edit2 className="h-4 w-4" /></button><button onClick={() => setResetPasswordUser(user)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600" title="Redefinir senha"><KeyRound className="h-4 w-4" /></button><button onClick={() => toggleActive(user)} className={`rounded-lg p-2 transition-colors ${user.active ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-400 hover:bg-green-50 hover:text-green-600'}`} title={user.active ? 'Inativar' : 'Ativar'}>{user.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>{user.role === 'INVESTOR' && user.investorId && <a href={`/portal?_as=${user.investorId}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600" title="Ver como investidor"><Eye className="h-4 w-4" /></a>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-500">{filtered.length} de {totalUsers} usuarios</div>
      </div>

      {toast && <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium shadow-lg animate-in slide-in-from-bottom-5 ${toast.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>{toast.type === 'success' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}{toast.text}</div>}
      {showCreateModal && <UserFormModal mode="create" investors={investors} onClose={() => setShowCreateModal(false)} onSaved={(user) => { setUsers((prev) => [...prev, user]); setShowCreateModal(false); showToast('success', `${user.name} criado com sucesso`); }} />}
      {editingUser && <UserFormModal mode="edit" user={editingUser} investors={investors} onClose={() => setEditingUser(null)} onSaved={(user) => { setUsers((prev) => prev.map((u) => (u.id === user.id ? user : u))); setEditingUser(null); showToast('success', `${user.name} atualizado`); }} />}
      {resetPasswordUser && <ResetPasswordModal user={resetPasswordUser} onClose={() => setResetPasswordUser(null)} onReset={() => { setResetPasswordUser(null); showToast('success', `Senha de ${resetPasswordUser.name} redefinida`); }} />}
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: 'green' | 'blue' | 'red' }) {
  const color = accent === 'green' ? 'text-emerald-600' : accent === 'blue' ? 'text-sky-600' : accent === 'red' ? 'text-red-500' : 'text-slate-600';
  return <div className="card-premium flex items-center gap-3 p-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 ${color}`}>{icon}</div><div><p className="text-xl font-bold tracking-tight text-slate-800">{value}</p><p className="text-[11px] text-slate-500">{label}</p></div></div>;
}

function UserFormModal({ mode, user, investors, onClose, onSaved }: { mode: 'create' | 'edit'; user?: UserRow; investors: InvestorRef[]; onClose: () => void; onSaved: (user: UserRow) => void }) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'INVESTOR'>(user?.role ?? 'INVESTOR');
  const [investorId, setInvestorId] = useState(user?.investorId ?? '');
  const [active, setActive] = useState(user?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (!name.trim()) return setError('Nome e obrigatorio');
      if (!isValidUserEmail(email)) return setError('Informe um email valido');
      if (mode === 'create' && !hasValidProvisionalPassword(password)) return setError('Senha provisoria deve ter pelo menos 6 caracteres');
      if (mode === 'edit' && password && !hasValidProvisionalPassword(password)) return setError('Senha provisoria deve ter pelo menos 6 caracteres');
      const payload: Record<string, unknown> = { name, email, role, active, investorId: role === 'INVESTOR' ? investorId || null : null };
      if (mode === 'create' || password) payload.password = password;
      const res = await fetch(mode === 'create' ? '/api/admin/users' : `/api/admin/users/${user!.id}`, { method: mode === 'create' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Erro ao salvar');
      onSaved(data.user);
    } catch { setError('Erro de rede'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white p-0 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between rounded-t-3xl border-b border-slate-100 bg-slate-50/80 px-6 py-4"><h2 className="text-lg font-semibold text-slate-800">{mode === 'create' ? 'Novo Usuario' : 'Editar Usuario'}</h2><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><label className="mb-1.5 block text-sm font-medium text-slate-700">Nome</label><input value={name} onChange={(e) => setName(e.target.value)} required className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10" placeholder="Nome completo" /></div>
            <div className="md:col-span-2"><label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10" placeholder="email@exemplo.com" />{mode === 'edit' && email !== user?.email && <p className="mt-1.5 text-[11px] text-amber-600">O usuario devera usar o novo email para acessar o portal.</p>}</div>
            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Papel</label><select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'INVESTOR')} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10"><option value="INVESTOR">Investidor</option><option value="ADMIN">Administrador</option></select></div>
            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label><button type="button" onClick={() => setActive(!active)} className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"><span>{active ? 'Ativo' : 'Inativo'}</span><span className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${active ? 'left-[22px]' : 'left-0.5'}`} /></span></button></div>
            {role === 'INVESTOR' && <div className="md:col-span-2"><label className="mb-1.5 block text-sm font-medium text-slate-700">Investidor vinculado</label><select value={investorId} onChange={(e) => setInvestorId(e.target.value)} required className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10"><option value="">Selecionar investidor...</option>{investors.map((inv) => <option key={inv.id} value={inv.id}>{inv.displayName}</option>)}</select></div>}
            {(mode === 'create' || role === 'INVESTOR') && <div className="md:col-span-2"><label className="mb-1.5 block text-sm font-medium text-slate-700">{mode === 'create' ? 'Senha provisoria' : 'Nova senha provisoria (opcional)'}</label><div className="flex items-center gap-2"><input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required={mode === 'create'} minLength={mode === 'create' || password ? 6 : undefined} className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-mono text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10" placeholder={mode === 'create' ? 'Minimo 6 caracteres' : 'Preencha apenas se quiser redefinir a senha'} /><button type="button" onClick={() => setPassword(generateTempPassword())} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#022D44]" title="Gerar senha"><RefreshCw className="h-4 w-4" /></button><button type="button" onClick={() => navigator.clipboard.writeText(password)} disabled={!password} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#022D44] disabled:opacity-40" title="Copiar senha"><Copy className="h-4 w-4" /></button></div><p className="mt-1.5 text-[11px] text-slate-400">{mode === 'create' ? 'A senha e hashada normalmente e o investidor sera obrigado a troca-la no primeiro acesso.' : 'Se preenchida, a senha e atualizada, hashada e o usuario volta para o fluxo de primeiro acesso.'}</p></div>}
          </div>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex items-center justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#022D44] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#033b5a] disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{mode === 'create' ? 'Criar usuario' : 'Salvar alteracoes'}</button></div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onReset }: { user: UserRow; onClose: () => void; onReset: () => void }) {
  const [mode, setMode] = useState<'generate' | 'manual'>('generate');
  const [newPassword, setNewPassword] = useState(generateTempPassword());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleReset() {
    if (mode === 'manual' && !hasValidProvisionalPassword(newPassword)) return setError('Senha deve ter pelo menos 6 caracteres');
    setError(''); setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword }) });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Erro ao redefinir senha');
      onReset();
    } catch { setError('Erro de rede'); } finally { setSaving(false); }
  }

  function copyPassword() { navigator.clipboard.writeText(newPassword); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white p-0 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between rounded-t-3xl border-b border-slate-100 bg-slate-50/80 px-6 py-4"><div><h2 className="text-lg font-semibold text-slate-800">Redefinir senha</h2><p className="text-xs text-slate-500">{user.name} · {user.email}</p></div><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button></div>
        <div className="space-y-5 p-6">
          <div className="flex gap-2"><button type="button" onClick={() => { setMode('generate'); setNewPassword(generateTempPassword()); }} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${mode === 'generate' ? 'border-[#022D44]/20 bg-[#022D44]/5 text-[#022D44]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Gerar senha</button><button type="button" onClick={() => { setMode('manual'); setNewPassword(''); }} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'border-[#022D44]/20 bg-[#022D44]/5 text-[#022D44]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Definir manualmente</button></div>
          {mode === 'generate' ? <div className="flex items-center gap-2"><div className="flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800">{newPassword}</div><button type="button" onClick={copyPassword} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#022D44]" title="Copiar">{copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}</button><button type="button" onClick={() => setNewPassword(generateTempPassword())} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-[#022D44]" title="Gerar outra"><RefreshCw className="h-4 w-4" /></button></div> : <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha (minimo 6 caracteres)" minLength={6} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#022D44]/30 focus:outline-none focus:ring-2 focus:ring-[#022D44]/10" />}
          <p className="text-xs text-slate-500">A nova senha sera aplicada imediatamente e o usuario sera obrigado a troca-la no proximo login.</p>
          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex items-center justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">Cancelar</button><button type="button" onClick={handleReset} disabled={saving || !newPassword} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-600 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Redefinir senha</button></div>
        </div>
      </div>
    </div>
  );
}

