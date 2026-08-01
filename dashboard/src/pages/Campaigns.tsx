import { useState, useEffect, useCallback } from 'react';
import {
  Megaphone, Plus, Play, Pause, RotateCcw, Trash2, RefreshCw,
  X, CheckCircle, AlertCircle, Clock, BarChart2, Users, Send,
  Eye, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  campaignsApi, contactsApi,
  type Campaign, type CampaignStats, type CampaignMessage,
  type ContactGroup,
} from '../services/campaign-api';
import { sessionApi, type Session } from '../services/api';
import './Campaigns.css';

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', scheduled: '#3b82f6', running: '#22c55e',
  paused: '#f59e0b', completed: '#6366f1', failed: '#ef4444',
};
const PIE_COLORS = ['#22c55e', '#6366f1', '#3b82f6', '#ef4444', '#94a3b8'];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="campaign-status-badge" style={{ background: STATUS_COLORS[status] + '22', color: STATUS_COLORS[status] }}>
      {status === 'running' && <span className="pulse-dot" />}
      {status}
    </span>
  );
}

type View = 'list' | 'create' | 'detail';

export function Campaigns() {
  const [view, setView] = useState<View>('list');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selected, setSelected] = useState<CampaignStats | null>(null);
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [msgPage, setMsgPage] = useState(1);
  const [msgStatus, setMsgStatus] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);

  // Create form
  const [form, setForm] = useState({
    name: '', description: '', messageTemplate: '',
    groupId: '', sessionId: '',
    minDelayMs: 4000, maxDelayMs: 10000, scheduledAt: '',
  });

  const flash = (msg: string, type: 'ok' | 'err') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); }
    else { setError(msg); setTimeout(() => setError(''), 5000); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try { setCampaigns(await campaignsApi.list()); }
    catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed to load', 'err'); }
    finally { setLoading(false); }
  }, []);

  const loadGroupsAndSessions = useCallback(async () => {
    try {
      const [grpRes, sessRes] = await Promise.all([contactsApi.getGroups(), sessionApi.list()]);
      setGroups(grpRes);
      setSessions(sessRes);
    } catch { /* silent */ }
  }, []);

  const loadMessages = useCallback(async (campaignId: string) => {
    setMsgLoading(true);
    try {
      const params: Record<string, string | number> = { page: msgPage, limit: 20 };
      if (msgStatus) params.status = msgStatus;
      const res = await campaignsApi.getMessages(campaignId, params);
      setMessages(res.data);
      setMsgTotal(res.total);
    } catch { /* silent */ }
    finally { setMsgLoading(false); }
  }, [msgPage, msgStatus]);

  useEffect(() => { load(); loadGroupsAndSessions(); }, [load, loadGroupsAndSessions]);

  useEffect(() => {
    if (selected) loadMessages(selected.campaign.id);
  }, [selected, loadMessages]);

  // Auto-refresh when a campaign is running
  useEffect(() => {
    if (!selected || selected.campaign.status !== 'running') return;
    const iv = setInterval(async () => {
      try {
        const fresh = await campaignsApi.getStats(selected.campaign.id);
        setSelected(fresh);
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(iv);
  }, [selected]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.messageTemplate.trim()) {
      flash('Name and message template are required', 'err'); return;
    }
    if (!form.sessionId) {
      flash('Please select a session', 'err'); return;
    }
    try {
      await campaignsApi.create({
        name: form.name, description: form.description,
        messageTemplate: form.messageTemplate,
        groupId: form.groupId || undefined,
        sessionId: form.sessionId,
        minDelayMs: form.minDelayMs, maxDelayMs: form.maxDelayMs,
        scheduledAt: form.scheduledAt || undefined,
      });
      flash('Campaign created!', 'ok');
      setView('list');
      setForm({ name: '', description: '', messageTemplate: '', groupId: '', sessionId: 'job-recruitment', minDelayMs: 4000, maxDelayMs: 10000, scheduledAt: '' });
      await load();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', 'err'); }
  };

  const handleAction = async (id: string, action: 'start' | 'pause' | 'resume' | 'delete') => {
    try {
      if (action === 'delete') {
        if (!confirm('Delete this campaign?')) return;
        await campaignsApi.delete(id);
        flash('Campaign deleted', 'ok');
      } else {
        const fn = action === 'start' ? campaignsApi.start : action === 'pause' ? campaignsApi.pause : campaignsApi.resume;
        await fn(id);
        flash(`Campaign ${action}ed`, 'ok');
      }
      await load();
      if (selected?.campaign.id === id) {
        if (action === 'delete') { setSelected(null); setView('list'); }
        else {
          const fresh = await campaignsApi.getStats(id);
          setSelected(fresh);
        }
      }
    } catch (e: unknown) { flash(e instanceof Error ? e.message : `Action failed`, 'err'); }
  };

  const openDetail = async (id: string) => {
    try {
      const stats = await campaignsApi.getStats(id);
      setSelected(stats);
      setMsgPage(1);
      setView('detail');
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', 'err'); }
  };

  const insertVar = (variable: string) => {
    setForm(f => ({ ...f, messageTemplate: f.messageTemplate + `{{${variable}}}` }));
  };

  const templateVars = ['greeting', 'name', 'mobile', 'city', 'company', 'language', 'custom1', 'custom2', 'unsubscribe'];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="campaigns-page">
      {/* Header */}
      <div className="campaigns-header">
        <div className="campaigns-title">
          <Megaphone size={28} />
          <div>
            <h1>Campaigns</h1>
            <p>Create and manage bulk WhatsApp message campaigns</p>
          </div>
        </div>
        <div className="campaigns-actions">
          {view !== 'list' && (
            <button className="btn btn-secondary" onClick={() => { setView('list'); setSelected(null); }}>
              <ChevronLeft size={16} /> Back
            </button>
          )}
          {view === 'list' && (
            <button className="btn btn-primary" onClick={() => setView('create')}>
              <Plus size={16} /> New Campaign
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert alert-success"><CheckCircle size={16} />{success}</div>}

      {/* ── List View ── */}
      {view === 'list' && (
        <div className="campaigns-list">
          {loading ? (
            <div className="campaigns-loading"><RefreshCw size={24} className="spin" /> Loading...</div>
          ) : campaigns.length === 0 ? (
            <div className="empty-state">
              <Megaphone size={48} />
              <h3>No campaigns yet</h3>
              <p>Create your first campaign to start sending bulk messages</p>
              <button className="btn btn-primary" onClick={() => setView('create')}><Plus size={16} /> New Campaign</button>
            </div>
          ) : (
            campaigns.map(c => (
              <div key={c.id} className="campaign-card">
                <div className="campaign-card-left">
                  <div className="campaign-card-name">
                    <Megaphone size={18} />
                    <h3>{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.description && <p className="campaign-desc">{c.description}</p>}
                  <div className="campaign-meta">
                    <span><Users size={12} /> {c.totalContacts} contacts</span>
                    <span><Send size={12} /> {c.sentCount} sent</span>
                    {c.status !== 'draft' && (
                      <span className={`meta-rate ${c.failedCount > 0 ? 'has-failures' : ''}`}>
                        ✓ {c.totalContacts > 0 ? Math.round(((c.sentCount + c.deliveredCount + c.readCount) / c.totalContacts) * 100) : 0}%
                      </span>
                    )}
                    <span className="meta-session">📱 {c.sessionId}</span>
                  </div>
                  {/* Mini progress bar */}
                  {c.totalContacts > 0 && (
                    <div className="progress-bar-wrap">
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill sent" style={{ width: `${((c.sentCount + c.deliveredCount + c.readCount) / c.totalContacts) * 100}%` }} />
                        <div className="progress-bar-fill failed" style={{ width: `${(c.failedCount / c.totalContacts) * 100}%`, marginLeft: `${((c.sentCount + c.deliveredCount + c.readCount) / c.totalContacts) * 100}%` }} />
                      </div>
                      <span className="progress-label">{c.sentCount + c.deliveredCount + c.readCount}/{c.totalContacts}</span>
                    </div>
                  )}
                </div>
                <div className="campaign-card-actions">
                  <button className="btn-icon" onClick={() => openDetail(c.id)} title="View Details"><Eye size={16} /></button>
                  {c.status === 'draft' && <button className="btn-icon success" onClick={() => handleAction(c.id, 'start')} title="Start"><Play size={16} /></button>}
                  {c.status === 'running' && <button className="btn-icon warning" onClick={() => handleAction(c.id, 'pause')} title="Pause"><Pause size={16} /></button>}
                  {c.status === 'paused' && <button className="btn-icon success" onClick={() => handleAction(c.id, 'resume')} title="Resume"><RotateCcw size={16} /></button>}
                  {['draft', 'completed', 'failed'].includes(c.status) && (
                    <button className="btn-icon danger" onClick={() => handleAction(c.id, 'delete')} title="Delete"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Create View ── */}
      {view === 'create' && (
        <div className="create-campaign">
          <div className="create-grid">
            <div className="create-form-panel">
              <h2>Campaign Details</h2>
              <div className="form-group">
                <label>Campaign Name *</label>
                <input className="form-control" placeholder="e.g. Festival Offer 2026" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows={2} placeholder="Optional description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Target Group</label>
                <select className="form-control" value={form.groupId} onChange={e => setForm(f => ({ ...f, groupId: e.target.value }))}>
                  <option value="">— Select contact group —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.totalContacts} contacts)</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>WhatsApp Session *</label>
                  <select className="form-control" value={form.sessionId} onChange={e => setForm(f => ({ ...f, sessionId: e.target.value }))}>
                    <option value="">— Select Session —</option>
                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name || s.id} ({s.status})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Schedule (optional)</label>
                  <input type="datetime-local" className="form-control" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Min Delay (ms)</label>
                  <input type="number" className="form-control" min={1000} max={60000} value={form.minDelayMs} onChange={e => setForm(f => ({ ...f, minDelayMs: +e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Max Delay (ms)</label>
                  <input type="number" className="form-control" min={1000} max={120000} value={form.maxDelayMs} onChange={e => setForm(f => ({ ...f, maxDelayMs: +e.target.value }))} />
                </div>
              </div>
              <p className="delay-hint">Smart delay: random wait between {form.minDelayMs/1000}s – {form.maxDelayMs/1000}s between each message</p>
            </div>

            <div className="create-template-panel">
              <h2>Message Template</h2>
              <div className="template-vars">
                <span className="vars-label">Insert variable:</span>
                {templateVars.map(v => (
                  <button key={v} className="var-chip" onClick={() => insertVar(v)}>{`{{${v}}}`}</button>
                ))}
              </div>
              <div className="form-group">
                <textarea
                  className="form-control template-textarea"
                  rows={10}
                  placeholder={'Hello {{name}},\n\nWelcome from {{company}}!\n\nBest regards,\nYour Team'}
                  value={form.messageTemplate}
                  onChange={e => setForm(f => ({ ...f, messageTemplate: e.target.value }))}
                />
              </div>
              <div className="template-preview">
                <h4>Preview (Sample Data)</h4>
                <div className="preview-bubble">
                  {form.messageTemplate
                    .replace(/\{\{name\}\}/gi, 'Rahul')
                    .replace(/\{\{mobile\}\}/gi, '9876543210')
                    .replace(/\{\{city\}\}/gi, 'Ahmedabad')
                    .replace(/\{\{company\}\}/gi, 'ABC Corp')
                    .replace(/\{\{language\}\}/gi, 'Hindi')
                    .replace(/\{\{custom1\}\}/gi, 'Gold')
                    .replace(/\{\{custom2\}\}/gi, 'Dealer')
                    || <span className="preview-placeholder">Type a message above to preview</span>}
                </div>
              </div>
              <div className="create-actions">
                <button className="btn btn-secondary" onClick={() => setView('list')}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreate}>
                  <Plus size={16} /> Create Campaign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail View ── */}
      {view === 'detail' && selected && (
        <div className="campaign-detail">
          {/* Stats Cards */}
          <div className="stats-grid">
            {[
              { label: 'Total', value: selected.stats.total, color: '#6366f1', icon: Users },
              { label: 'Sent', value: selected.stats.sent, color: '#3b82f6', icon: Send },
              { label: 'Delivered', value: selected.stats.delivered, color: '#8b5cf6', icon: CheckCircle },
              { label: 'Read', value: selected.stats.read, color: '#22c55e', icon: CheckCircle },
              { label: 'Failed', value: selected.stats.failed, color: '#ef4444', icon: AlertCircle },
              { label: 'Pending', value: selected.stats.pending, color: '#f59e0b', icon: Clock },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="stat-card" style={{ borderTopColor: color }}>
                <div className="stat-card-icon" style={{ background: color + '22', color }}><Icon size={20} /></div>
                <div className="stat-card-body">
                  <div className="stat-value" style={{ color }}>{value.toLocaleString()}</div>
                  <div className="stat-label">{label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="detail-grid">
            {/* Pie Chart */}
            <div className="detail-chart-panel">
              <h3><BarChart2 size={16} /> Delivery Overview</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Sent', value: selected.stats.sent },
                      { name: 'Delivered', value: selected.stats.delivered },
                      { name: 'Read', value: selected.stats.read },
                      { name: 'Failed', value: selected.stats.failed },
                      { name: 'Pending', value: selected.stats.pending },
                    ]}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={90}
                    paddingAngle={3} dataKey="value"
                  >
                    {PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="success-rate">
                <span>{selected.stats.successRate}%</span>
                <small>Success Rate</small>
              </div>
              <div className="detail-actions">
                {selected.campaign.status === 'draft' && (
                  <button className="btn btn-primary" onClick={() => handleAction(selected.campaign.id, 'start')}>
                    <Play size={16} /> Start Campaign
                  </button>
                )}
                {selected.campaign.status === 'running' && (
                  <button className="btn btn-warning" onClick={() => handleAction(selected.campaign.id, 'pause')}>
                    <Pause size={16} /> Pause
                  </button>
                )}
                {selected.campaign.status === 'paused' && (
                  <button className="btn btn-primary" onClick={() => handleAction(selected.campaign.id, 'resume')}>
                    <RotateCcw size={16} /> Resume
                  </button>
                )}
              </div>
            </div>

            {/* Messages Table */}
            <div className="detail-messages-panel">
              <div className="messages-header">
                <h3><Send size={16} /> Messages</h3>
                <select className="filter-select-sm" value={msgStatus} onChange={e => { setMsgStatus(e.target.value); setMsgPage(1); }}>
                  <option value="">All statuses</option>
                  {['pending', 'queued', 'sent', 'delivered', 'read', 'failed'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {msgLoading ? (
                <div className="msg-loading"><RefreshCw size={18} className="spin" /> Loading...</div>
              ) : (
                <table className="messages-table">
                  <thead><tr><th>Mobile</th><th>Name</th><th>Status</th><th>Retry</th><th>Sent At</th></tr></thead>
                  <tbody>
                    {messages.map((m: CampaignMessage) => (
                      <tr key={m.id}>
                        <td className="mono">{m.mobile}</td>
                        <td>{m.contactName ?? '—'}</td>
                        <td>
                          <span className={`msg-status ${m.status}`}>{m.status}</span>
                          {m.failReason && <div className="fail-reason">{m.failReason.slice(0, 60)}</div>}
                        </td>
                        <td>{m.retryCount}</td>
                        <td>{m.sentAt ? new Date(m.sentAt).toLocaleTimeString() : '—'}</td>
                      </tr>
                    ))}
                    {messages.length === 0 && <tr><td colSpan={5} className="empty-cell">No messages found</td></tr>}
                  </tbody>
                </table>
              )}
              {msgTotal > 20 && (
                <div className="pagination">
                  <button disabled={msgPage === 1} onClick={() => setMsgPage(p => p - 1)} className="btn btn-secondary btn-sm"><ChevronLeft size={14} /></button>
                  <span>Page {msgPage} ({msgTotal} total)</span>
                  <button disabled={messages.length < 20} onClick={() => setMsgPage(p => p + 1)} className="btn btn-secondary btn-sm"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
