'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, Plus, Search, Copy, Check, Edit3, Trash2, Bookmark, RefreshCw, BarChart2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface HookItem {
  id: string;
  hook_text: string;
  category: string;
  source: string;
  used_count: number;
}

export default function HookGalleryPage() {
  const { show, ToastEl } = useToast();
  const [hooks, setHooks] = useState<HookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHook, setEditingHook] = useState<HookItem | null>(null);
  const [formData, setFormData] = useState({ hook_text: '', category: 'general', source: 'Manual Entry' });
  const [saving, setSaving] = useState(false);

  const fetchHooks = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hooks?all=true');
      if (res.ok) {
        const data = await res.json();
        setHooks(data);
      } else {
        show('Failed to load hook bank.', 'error');
      }
    } catch (e) {
      show('Error loading hooks.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHooks();

    const handleStrategyUpdated = () => {
      fetchHooks();
    };

    window.addEventListener('strategy_updated', handleStrategyUpdated);
    return () => window.removeEventListener('strategy_updated', handleStrategyUpdated);
  }, []);

  // Compute unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    hooks.forEach(h => {
      if (h.category) set.add(h.category.toLowerCase());
    });
    return Array.from(set).sort();
  }, [hooks]);

  // Filtered hooks
  const filteredHooks = useMemo(() => {
    return hooks.filter(h => {
      const matchesSearch =
        h.hook_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.source && h.source.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || h.category.toLowerCase() === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [hooks, searchQuery, selectedCategory]);

  const totalUses = useMemo(() => {
    return hooks.reduce((acc, h) => acc + (h.used_count || 0), 0);
  }, [hooks]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    show('Hook formula copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openCreateModal = () => {
    setEditingHook(null);
    setFormData({ hook_text: '', category: 'general', source: 'Manual Entry' });
    setModalOpen(true);
  };

  const openEditModal = (hook: HookItem) => {
    setEditingHook(hook);
    setFormData({ hook_text: hook.hook_text, category: hook.category || 'general', source: hook.source || 'Manual Entry' });
    setModalOpen(true);
  };

  const handleSaveHook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hook_text.trim()) {
      show('Hook text cannot be empty.', 'error');
      return;
    }

    setSaving(true);
    try {
      let res;
      if (editingHook) {
        res = await fetch(`/api/hooks/${editingHook.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        res = await fetch('/api/hooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (res.ok) {
        show(editingHook ? 'Hook updated!' : 'New hook added to bank!', 'success');
        setModalOpen(false);
        fetchHooks();
      } else {
        const err = await res.json();
        show(err.error || 'Save failed.', 'error');
      }
    } catch {
      show('Save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this hook formula?')) return;

    try {
      const res = await fetch(`/api/hooks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        show('Hook deleted.', 'success');
        setHooks(prev => prev.filter(h => h.id !== id));
      } else {
        show('Delete failed.', 'error');
      }
    } catch {
      show('Delete failed.', 'error');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {ToastEl}

      {/* Top Header */}
      <div
        className="flex-shrink-0 border-b px-8 py-5 sticky top-0 z-10"
        style={{ background: 'rgba(10,10,15,0.95)', borderColor: 'var(--border)', backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(124, 58, 237, 0.3)' }}>
              <Bookmark size={20} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                Hook Bank Gallery
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  {hooks.length} templates
                </span>
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Scroll-stopping opening formulas, framework openers, and hook templates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <BarChart2 size={14} style={{ color: 'var(--accent)' }} />
              <span style={{ color: 'var(--text-muted)' }}>Total Generations Used:</span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{totalUses}</span>
            </div>

            <button
              onClick={openCreateModal}
              className="px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-purple-600/20"
              style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)', color: '#fff' }}
            >
              <Plus size={15} />
              Add Custom Hook
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col p-8 overflow-y-auto space-y-6">

        {/* Filter Controls & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                selectedCategory === 'all' ? 'shadow-sm' : ''
              }`}
              style={{
                background: selectedCategory === 'all' ? 'var(--accent)' : 'var(--bg-elevated)',
                color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: selectedCategory === 'all' ? 'var(--accent)' : 'var(--border)'
              }}
            >
              All Hooks ({hooks.length})
            </button>

            {categories.map(cat => {
              const count = hooks.filter(h => h.category.toLowerCase() === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all flex-shrink-0`}
                  style={{
                    background: isSelected ? 'rgba(124, 58, 237, 0.2)' : 'var(--bg-elevated)',
                    color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)'
                  }}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search hooks or categories..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs transition-colors focus:outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <RefreshCw size={24} className="spinner mb-3" style={{ color: 'var(--accent)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading Hook Bank...</p>
          </div>
        ) : filteredHooks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20 border rounded-2xl border-dashed" style={{ borderColor: 'var(--border)' }}>
            <Bookmark size={36} className="mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No hooks found</p>
            <p className="text-xs max-w-sm text-center mb-4" style={{ color: 'var(--text-muted)' }}>
              {searchQuery || selectedCategory !== 'all'
                ? 'Try adjusting your search query or category filter.'
                : 'Your hook bank is empty. Add your first hook formula above or ingest strategy rules!'}
            </p>
            <button
              onClick={openCreateModal}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <Plus size={14} /> Add First Hook
            </button>
          </div>
        ) : (
          /* Hooks Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHooks.map(hook => {
              const isCopied = copiedId === hook.id;
              return (
                <div
                  key={hook.id}
                  className="p-5 rounded-2xl border flex flex-col justify-between transition-all duration-200 hover:border-purple-500/40 space-y-4 group"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
                        style={{
                          background: 'rgba(124, 58, 237, 0.15)',
                          color: '#a78bfa',
                          border: '1px solid rgba(124, 58, 237, 0.3)'
                        }}
                      >
                        {hook.category || 'general'}
                      </span>
                      {hook.used_count > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
                          Used {hook.used_count}x
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      &ldquo;{hook.hook_text}&rdquo;
                    </p>
                  </div>

                  <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                      Source: {hook.source || 'Manual'}
                    </span>

                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopy(hook.id, hook.hook_text)}
                        title="Copy hook text"
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ color: isCopied ? '#22c55e' : 'var(--text-secondary)' }}
                      >
                        {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>

                      <button
                        onClick={() => openEditModal(hook)}
                        title="Edit hook"
                        className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => handleDeleteHook(hook.id)}
                        title="Delete hook"
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-500/20 text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-lg p-6 rounded-2xl border space-y-5 animate-scale-up"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                <h2 className="font-bold text-base">{editingHook ? 'Edit Hook Formula' : 'Add Custom Hook Formula'}</h2>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Hook Text / Formula *
                </label>
                <textarea
                  value={formData.hook_text}
                  onChange={e => setFormData({ ...formData, hook_text: e.target.value })}
                  placeholder="e.g. Stop building [Feature X] until you do this 1 check..."
                  rows={4}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none resize-none leading-relaxed"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Category Tag
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. contrarian, stat, story"
                    className="w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Source / Notes
                  </label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={e => setFormData({ ...formData, source: e.target.value })}
                    placeholder="e.g. Justin Welsh / Self Note"
                    className="w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {saving ? <RefreshCw size={13} className="spinner" /> : null}
                  {editingHook ? 'Save Changes' : 'Create Hook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
