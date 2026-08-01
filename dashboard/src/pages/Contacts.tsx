import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Users, Upload, Trash2, RefreshCw, Plus, X, CheckCircle,
  AlertCircle, Clock, Filter, ChevronLeft, ChevronRight,
  FileText, FolderPlus,
} from 'lucide-react';
import { contactsApi, type Contact, type ContactGroup, type ImportLog, type ContactsPage } from '../services/campaign-api';
import './Contacts.css';

type Tab = 'contacts' | 'groups' | 'import-logs';

export function Contacts() {
  const [tab, setTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<ContactsPage | null>(null);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [filterCity, setFilterCity] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [page, setPage] = useState(1);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadGroupId, setUploadGroupId] = useState('');
  const [uploadGroupName, setUploadGroupName] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Create group modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const flash = (msg: string, type: 'ok' | 'err') => {
    if (type === 'ok') { setSuccess(msg); setTimeout(() => setSuccess(''), 3500); }
    else { setError(msg); setTimeout(() => setError(''), 5000); }
  };

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 50 };
      if (filterCity) params.city = filterCity;
      if (filterLanguage) params.language = filterLanguage;
      if (filterGroup) params.groupId = filterGroup;
      const data = await contactsApi.getContacts(params);
      setContacts(data);
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed to load contacts', 'err'); }
    finally { setLoading(false); }
  }, [page, filterCity, filterLanguage, filterGroup]);

  const loadGroups = useCallback(async () => {
    try { setGroups(await contactsApi.getGroups()); }
    catch { /* silent */ }
  }, []);

  const loadImportLogs = useCallback(async () => {
    try { setImportLogs(await contactsApi.getImportLogs()); }
    catch { /* silent */ }
  }, []);

  useEffect(() => { loadContacts(); }, [loadContacts]);
  useEffect(() => { loadGroups(); }, [loadGroups]);
  useEffect(() => { if (tab === 'import-logs') loadImportLogs(); }, [tab, loadImportLogs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
    maxFiles: 1,
    onDrop: (files) => { if (files[0]) setSelectedFile(files[0]); },
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const log = await contactsApi.uploadFile(selectedFile, uploadGroupId || undefined, uploadGroupName || undefined);
      flash(`Imported ${log.successRows} contacts (${log.duplicateRows} duplicates, ${log.failedRows} failed)`, 'ok');
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadGroupId('');
      setUploadGroupName('');
      await Promise.all([loadContacts(), loadGroups()]);
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Upload failed', 'err'); }
    finally { setUploading(false); }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Delete this contact?')) return;
    try {
      await contactsApi.deleteContact(id);
      flash('Contact deleted', 'ok');
      await loadContacts();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Delete failed', 'err'); }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await contactsApi.createGroup(newGroupName.trim(), newGroupDesc.trim() || undefined);
      flash(`Group "${newGroupName}" created`, 'ok');
      setShowGroupModal(false);
      setNewGroupName('');
      setNewGroupDesc('');
      await loadGroups();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', 'err'); }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Delete group "${name}"? Contacts will not be deleted.`)) return;
    try {
      await contactsApi.deleteGroup(id);
      flash('Group deleted', 'ok');
      await loadGroups();
    } catch (e: unknown) { flash(e instanceof Error ? e.message : 'Failed', 'err'); }
  };

  return (
    <div className="contacts-page">
      {/* Header */}
      <div className="contacts-header">
        <div className="contacts-title">
          <Users size={28} />
          <div>
            <h1>Contact Management</h1>
            <p>Import CSV/Excel contacts and organize them into groups</p>
          </div>
        </div>
        <div className="contacts-actions">
          <button className="btn btn-secondary" onClick={() => setShowGroupModal(true)}>
            <FolderPlus size={16} /> New Group
          </button>
          <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} /> Import CSV/Excel
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-error"><AlertCircle size={16} />{error}</div>}
      {success && <div className="alert alert-success"><CheckCircle size={16} />{success}</div>}

      {/* Tabs */}
      <div className="contacts-tabs">
        {(['contacts', 'groups', 'import-logs'] as Tab[]).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'contacts' ? <Users size={16} /> : t === 'groups' ? <FolderPlus size={16} /> : <FileText size={16} />}
            {t === 'contacts' ? `Contacts (${contacts?.total ?? 0})` : t === 'groups' ? `Groups (${groups.length})` : 'Import Logs'}
          </button>
        ))}
      </div>

      {/* ── Contacts Tab ── */}
      {tab === 'contacts' && (
        <>
          <div className="contacts-filters">
            <div className="filter-row">
              <Filter size={16} />
              <input className="filter-input" placeholder="City..." value={filterCity} onChange={e => { setFilterCity(e.target.value); setPage(1); }} />
              <input className="filter-input" placeholder="Language..." value={filterLanguage} onChange={e => { setFilterLanguage(e.target.value); setPage(1); }} />
              <select className="filter-select" value={filterGroup} onChange={e => { setFilterGroup(e.target.value); setPage(1); }}>
                <option value="">All Groups</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={loadContacts}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="contacts-table-wrapper">
            {loading ? (
              <div className="contacts-loading"><RefreshCw size={24} className="spin" /> Loading contacts...</div>
            ) : (
              <>
                <table className="contacts-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Mobile</th><th>City</th><th>Company</th><th>Language</th>
                      <th>Custom1</th><th>Group</th><th>Status</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts?.data.map((c: Contact) => (
                      <tr key={c.id}>
                        <td>{c.name ?? '—'}</td>
                        <td className="mobile-cell">{c.mobile}</td>
                        <td>{c.city ?? '—'}</td>
                        <td>{c.company ?? '—'}</td>
                        <td>{c.language ?? '—'}</td>
                        <td>{c.custom1 ?? '—'}</td>
                        <td><span className="group-badge">{c.group?.name ?? '—'}</span></td>
                        <td>
                          {c.isDuplicate && <span className="status-badge duplicate">Duplicate</span>}
                          {!c.isValid && <span className="status-badge invalid">Invalid</span>}
                          {c.isValid && !c.isDuplicate && <span className="status-badge valid">Valid</span>}
                        </td>
                        <td>
                          <button className="btn-icon danger" onClick={() => handleDeleteContact(c.id)} title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {contacts?.data.length === 0 && (
                      <tr><td colSpan={9} className="empty-cell">No contacts found. Import a CSV to get started.</td></tr>
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {contacts && contacts.totalPages > 1 && (
                  <div className="pagination">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">
                      <ChevronLeft size={14} />
                    </button>
                    <span>Page {page} of {contacts.totalPages} ({contacts.total} contacts)</span>
                    <button disabled={page === contacts.totalPages} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Groups Tab ── */}
      {tab === 'groups' && (
        <div className="groups-grid">
          {groups.map(g => (
            <div key={g.id} className="group-card">
              <div className="group-card-header">
                <div className="group-icon"><FolderPlus size={20} /></div>
                <button className="btn-icon danger" onClick={() => handleDeleteGroup(g.id, g.name)}><Trash2 size={14} /></button>
              </div>
              <h3>{g.name}</h3>
              {g.description && <p className="group-desc">{g.description}</p>}
              <div className="group-stats">
                <span className="stat-pill"><Users size={12} /> {g.totalContacts} contacts</span>
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="empty-state">
              <FolderPlus size={48} />
              <h3>No groups yet</h3>
              <p>Create a group to organize your contacts</p>
              <button className="btn btn-primary" onClick={() => setShowGroupModal(true)}>Create Group</button>
            </div>
          )}
        </div>
      )}

      {/* ── Import Logs Tab ── */}
      {tab === 'import-logs' && (
        <div className="import-logs">
          {importLogs.map(log => (
            <div key={log.id} className="import-log-card">
              <div className="log-header">
                <div className="log-filename"><FileText size={16} /> {log.filename}</div>
                <span className={`status-badge ${log.status}`}>
                  {log.status === 'processing' && <Clock size={12} />}
                  {log.status === 'done' && <CheckCircle size={12} />}
                  {log.status === 'failed' && <AlertCircle size={12} />}
                  {log.status}
                </span>
              </div>
              {log.groupName && <div className="log-group">Group: <b>{log.groupName}</b></div>}
              <div className="log-stats">
                <span className="stat-item total">Total: {log.totalRows}</span>
                <span className="stat-item success">✓ {log.successRows}</span>
                <span className="stat-item duplicate">⤢ {log.duplicateRows} dup</span>
                <span className="stat-item failed">✗ {log.failedRows}</span>
              </div>
              <div className="log-date">{new Date(log.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {importLogs.length === 0 && (
            <div className="empty-state">
              <FileText size={48} />
              <h3>No imports yet</h3>
              <p>Upload a CSV or Excel file to see history here</p>
            </div>
          )}
        </div>
      )}

      {/* ── Upload Modal ── */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Upload size={20} /> Import Contacts</h2>
              <button className="btn-icon" onClick={() => setShowUploadModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''} ${selectedFile ? 'has-file' : ''}`}>
                <input {...getInputProps()} />
                {selectedFile ? (
                  <div className="dropzone-file">
                    <CheckCircle size={32} className="text-success" />
                    <p><b>{selectedFile.name}</b></p>
                    <p className="small">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="dropzone-prompt">
                    <Upload size={32} />
                    <p>{isDragActive ? 'Drop file here...' : 'Drag & drop CSV/Excel here, or click to browse'}</p>
                    <p className="small">Supports .csv, .xlsx, .xls — Columns: Name, Mobile, City, Company, Language, Custom1, Custom2</p>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Group (optional)</label>
                <select className="form-control" value={uploadGroupId} onChange={e => { setUploadGroupId(e.target.value); setUploadGroupName(''); }}>
                  <option value="">— Select existing group —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              {!uploadGroupId && (
                <div className="form-group">
                  <label>Or create new group</label>
                  <input className="form-control" placeholder="New group name..." value={uploadGroupName} onChange={e => setUploadGroupName(e.target.value)} />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={!selectedFile || uploading}>
                {uploading ? <><RefreshCw size={14} className="spin" /> Importing...</> : <><Upload size={14} /> Import</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Group Modal ── */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Plus size={20} /> Create Group</h2>
              <button className="btn-icon" onClick={() => setShowGroupModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Group Name *</label>
                <input className="form-control" placeholder="e.g. Ahmedabad Dealers" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" rows={2} placeholder="Optional description..." value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                <Plus size={14} /> Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
