'use client';

import { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import { Clock, Filter, ExternalLink, ChevronDown, Loader2, RefreshCw } from 'lucide-react';

interface HistoryPost {
  id: string;
  date: string;
  post_type_id: string;
  post_type_name: string;
  topic_summary: string;
  status: 'draft' | 'approved' | 'published';
  selected_version: number;
  series_part: string | null;
  created_at: string;
  published_at: string | null;
  versions: Array<{ version: number; sections: Record<string, string>; visualSuggestion: string }>;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  draft: { bg: 'var(--bg-elevated)', color: 'var(--text-muted)', border: 'var(--border)' },
  approved: { bg: '#1a2e0d', color: '#bef264', border: '#4d7c0f' },
  published: { bg: '#0d2e22', color: 'var(--success)', border: 'var(--success)' },
};

export default function HistoryPage() {
  const { postTypes } = useApp();
  const { show: showToast, ToastEl } = useToast();
  const [posts, setPosts] = useState<HistoryPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('post_type_id', filterType);
      if (filterStatus) params.set('status', filterStatus);
      params.set('limit', '100');
      const res = await fetch(`/api/history?${params}`);
      if (res.ok) setPosts(await res.json());
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, showToast]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const updateStatus = async (postId: string, status: string) => {
    setUpdatingStatus(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, status: status as HistoryPost['status'] } : p));
        showToast(`Marked as ${status}.`, 'success');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const selectStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    cursor: 'pointer',
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {ToastEl}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock size={20} style={{ color: 'var(--accent)' }} />
          <h1 className="text-xl font-semibold">History</h1>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            {posts.length} posts
          </span>
        </div>
        <button onClick={fetchHistory} className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 p-4 rounded-xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Filter:</span>
        <div className="relative">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} style={selectStyle}>
            <option value="">All Pillars</option>
            {postTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="published">Published</option>
          </select>
        </div>
        {(filterType || filterStatus) && (
          <button onClick={() => { setFilterType(''); setFilterStatus(''); }}
            className="text-xs px-2 py-1 rounded" style={{ color: 'var(--danger)', border: '1px solid var(--danger)33' }}>
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="spinner" style={{ color: 'var(--accent)' }} />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <Clock size={40} className="mx-auto mb-4" style={{ opacity: 0.3 }} />
          <p className="text-sm">No posts yet. Generate your first post in Studio.</p>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div className="space-y-2">
          {posts.map(post => {
            const statusColors = STATUS_COLORS[post.status] ?? STATUS_COLORS.draft;
            const isExpanded = expandedId === post.id;
            const selectedVersion = post.versions?.[post.selected_version ?? 0];
            const sectionEntries = selectedVersion ? Object.entries(selectedVersion.sections) : [];

            return (
              <div key={post.id} className="rounded-xl border overflow-hidden transition-all animate-fade-in"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-white/2 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : post.id)}>
                  
                  {/* Status badge */}
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                    style={{ background: statusColors.bg, color: statusColors.color, border: `1px solid ${statusColors.border}` }}>
                    {post.status}
                  </span>

                  {/* Post type */}
                  <span className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)33', flexShrink: 0 }}>
                    {post.post_type_name ?? '—'}
                  </span>

                  {/* Date */}
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {post.date}
                  </span>

                  {/* Topic */}
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {post.topic_summary ?? 'No summary'}
                  </span>

                  {/* Series part */}
                  {post.series_part && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      Part {post.series_part}
                    </span>
                  )}

                  {/* Expand toggle */}
                  <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                </div>

                {isExpanded && selectedVersion && (
                  <div className="border-t px-4 py-4 space-y-3 animate-fade-in" style={{ borderColor: 'var(--border)' }}>
                    {/* Version info */}
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>Version {(post.selected_version ?? 0) + 1} of {post.versions.length}</span>
                      {post.published_at && <span>· Published {new Date(post.published_at).toLocaleDateString()}</span>}
                    </div>

                    {/* Sections */}
                    {sectionEntries.map(([sectionName, content]) => (
                      <div key={sectionName} className="rounded-lg border p-3"
                        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                        <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--accent)' }}>
                          {sectionName}
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{content}</p>
                      </div>
                    ))}

                    {/* Visual suggestion */}
                    {selectedVersion.visualSuggestion && (
                      <div className="px-3 py-2 rounded-lg text-xs"
                        style={{ background: '#0d1a0d', border: '1px solid #166534', color: '#86efac' }}>
                        📸 {selectedVersion.visualSuggestion}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      {post.status === 'draft' && (
                        <button onClick={() => updateStatus(post.id, 'approved')} disabled={updatingStatus === post.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                          style={{ background: '#1a2e0d', border: '1px solid #4d7c0f', color: '#bef264' }}>
                          {updatingStatus === post.id ? <Loader2 size={11} className="spinner" /> : null}
                          Mark Approved
                        </button>
                      )}
                      {post.status === 'approved' && (
                        <button onClick={() => updateStatus(post.id, 'published')} disabled={updatingStatus === post.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                          style={{ background: '#0d2e22', border: '1px solid var(--success)', color: 'var(--success)' }}>
                          {updatingStatus === post.id ? <Loader2 size={11} className="spinner" /> : null}
                          Mark Published
                        </button>
                      )}
                      <a href={`/?reopen=${post.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
                        style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <ExternalLink size={11} /> Open in Studio
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
