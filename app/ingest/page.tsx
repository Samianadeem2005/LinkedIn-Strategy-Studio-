'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Sparkles, Loader2, CheckCircle2, XCircle, FileText, Database, BookOpen, GitMerge, Replace, ShieldCheck, Ban, Check } from 'lucide-react';

interface ReviewItem {
  id: string;
  heading: string;
  point_text: string;
  target_table: 'post_types' | 'post_anatomy' | 'writing_mechanics' | 'hook_bank';
  is_new_category: number;
  target_row_id: string | null;
  target_row_name?: string | null;
  current_text?: string | null;
  apply_mode?: 'merge' | 'replace';
  user_decision: 'keep' | 'discard' | 'pending' | 'apply_update' | 'keep_previous';
}

export default function IngestPage() {
  const { show: showToast, ToastEl } = useToast();
  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [dumpId, setDumpId] = useState<string | null>(null);
  const [cleanSummary, setCleanSummary] = useState<string | null>(null);

  const [newItems, setNewItems] = useState<ReviewItem[]>([]);
  const [updates, setUpdates] = useState<ReviewItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);

  const extractStrategy = async () => {
    if (!rawText.trim()) {
      showToast('Please paste strategy notes or text first.', 'error');
      return;
    }

    setExtracting(true);
    setCompleted(false);

    try {
      const res = await fetch('/api/knowledge-dumps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Extraction failed.', 'error');
        setExtracting(false);
        return;
      }

      setDumpId(data.dumpId);

      // Load review queue
      const reviewRes = await fetch(`/api/knowledge-dumps/${data.dumpId}/review`);
      if (reviewRes.ok) {
        const reviewData = await reviewRes.json();
        setCleanSummary(reviewData.clean_summary || null);

        const initializedNew = (reviewData.newItems || []).map((item: ReviewItem) => ({
          ...item,
          user_decision: 'keep' as const
        }));

        // Default Section 3 (updates) to 'keep_previous'
        const initializedUpdates = (reviewData.updates || []).map((item: ReviewItem) => ({
          ...item,
          apply_mode: (item.apply_mode as 'merge' | 'replace') || 'merge',
          user_decision: (item.user_decision as ReviewItem['user_decision']) || 'keep_previous'
        }));

        setNewItems(initializedNew);
        setUpdates(initializedUpdates);
        showToast(`Extraction complete! ${reviewData.total} items extracted.`, 'success');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setExtracting(false);
    }
  };

  const updateItemText = async (id: string, newText: string, isNewList: boolean) => {
    if (isNewList) {
      setNewItems(prev => prev.map(item => item.id === id ? { ...item, point_text: newText } : item));
    } else {
      setUpdates(prev => prev.map(item => item.id === id ? { ...item, point_text: newText } : item));
    }

    await fetch(`/api/extraction-review/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ point_text: newText })
    });
  };

  const updateApplyMode = async (id: string, mode: 'merge' | 'replace') => {
    setUpdates(prev => prev.map(item => item.id === id ? { ...item, apply_mode: mode } : item));

    await fetch(`/api/extraction-review/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apply_mode: mode })
    });
  };

  const setDecision = async (id: string, decision: ReviewItem['user_decision'], isNewList: boolean) => {
    if (isNewList) {
      setNewItems(prev => prev.map(item => item.id === id ? { ...item, user_decision: decision } : item));
    } else {
      setUpdates(prev => prev.map(item => item.id === id ? { ...item, user_decision: decision } : item));
    }

    await fetch(`/api/extraction-review/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_decision: decision })
    });
  };

  const confirmAll = async () => {
    if (!dumpId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/knowledge-dumps/${dumpId}/confirm`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.summaryMessage || `Successfully applied ${data.appliedCount} items to your strategy database!`, 'success');
        setCompleted(true);
        window.dispatchEvent(new CustomEvent('strategy_updated', { detail: data }));
      } else {
        showToast(data.error ?? 'Failed to confirm items.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const newItemsToInsert = newItems.filter(i => i.user_decision === 'keep').length;
  const updatesToApply = updates.filter(i => i.user_decision === 'apply_update').length;
  const totalKeptCount = newItemsToInsert + updatesToApply;

  const getTableBadgeStyle = (table: string) => {
    switch (table) {
      case 'post_types': return { bg: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', label: 'Post Pillar' };
      case 'post_anatomy': return { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: 'Post Anatomy' };
      case 'writing_mechanics': return { bg: 'rgba(52, 211, 153, 0.15)', color: '#34d399', label: 'Writing Mechanic' };
      case 'hook_bank': return { bg: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', label: 'Hook Bank' };
      default: return { bg: 'var(--bg-hover)', color: 'var(--text-muted)', label: table };
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {ToastEl}

      {/* Top Header */}
      <div
        className="flex-shrink-0 border-b px-6 py-4 flex items-center justify-between"
        style={{ background: 'rgba(10,10,15,0.9)', borderColor: 'var(--border)', backdropFilter: 'blur(8px)' }}
      >
        <div className="flex items-center gap-3">
          <Sparkles size={18} style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="font-semibold text-base">Strategy Ingestion Pipeline</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Paste raw strategy articles to extract clean summaries, new pillars, anatomy rules, and hooks.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Scroll Container */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
          
          {/* Raw Text Input Card */}
          <div
            className="p-5 rounded-2xl border space-y-4"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: 'var(--accent)' }} />
              <h2 className="font-medium text-sm">Raw Strategy Document / Article Notes</h2>
            </div>

            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              disabled={extracting}
              rows={7}
              placeholder="Paste raw strategy article, book excerpt, or LinkedIn guide here..."
              className="w-full p-4 rounded-xl text-sm border focus:outline-none resize-none transition-all"
              style={{
                background: 'var(--bg-primary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)'
              }}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {rawText.trim() ? `${rawText.trim().split(/\s+/).length} words` : '0 words'}
              </span>

              <button
                onClick={extractStrategy}
                disabled={extracting || !rawText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                  color: 'white'
                }}
              >
                {extracting ? (
                  <>
                    <Loader2 size={15} className="spinner" />
                    Chunking &amp; Extracting Strategy...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Extract Strategy
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Success Banner */}
          {completed && (
            <div
              className="p-6 rounded-2xl border text-center space-y-3"
              style={{ background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.3)' }}
            >
              <CheckCircle2 size={32} className="mx-auto" style={{ color: 'var(--success)' }} />
              <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                Strategy Integrated Live!
              </h3>
              <p className="text-xs max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                All confirmed items have been applied to your database. Studio, Settings, and Hook Bank are live-updated.
              </p>
              <button
                onClick={() => { setRawText(''); setNewItems([]); setUpdates([]); setDumpId(null); setCleanSummary(null); setCompleted(false); }}
                className="px-4 py-2 rounded-lg text-xs font-medium border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                Process Another Document
              </button>
            </div>
          )}

          {/* Extracted Strategy Review Interface (3 Sections) */}
          {!completed && (newItems.length > 0 || updates.length > 0 || cleanSummary) && (
            <div className="space-y-8">
              
              {/* SECTION 1: Clean Summary (Read-Only Outline) */}
              {cleanSummary && (
                <div
                  className="p-6 rounded-2xl border space-y-3"
                  style={{ background: 'rgba(124, 58, 237, 0.05)', borderColor: 'rgba(124, 58, 237, 0.25)' }}
                >
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'rgba(124, 58, 237, 0.2)' }}>
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} style={{ color: 'var(--accent)' }} />
                      <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        Section 1 — Clean Strategy Overview (Read-Only Outline)
                      </h2>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md" style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#a78bfa' }}>
                      Cleaned Outline
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed font-normal space-y-2 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {cleanSummary}
                  </div>
                </div>
              )}

              {/* Dynamic Global Summary Counter */}
              <div
                className="px-5 py-3 rounded-xl border flex items-center justify-between"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Database size={15} style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Ready to confirm <strong style={{ color: 'var(--accent)' }}>{totalKeptCount}</strong> items
                  </span>
                </div>
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  ({newItemsToInsert} new + {updatesToApply} updates to apply)
                </span>
              </div>

              {/* SECTION 2: 🆕 New Things Detected */}
              {newItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🆕</span>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      Section 2 — New Things Detected ({newItems.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {newItems.map(item => {
                      const badge = getTableBadgeStyle(item.target_table);
                      const isKeep = item.user_decision === 'keep';

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl p-5 border transition-all space-y-3"
                          style={{
                            background: isKeep ? 'var(--bg-elevated)' : 'rgba(255, 255, 255, 0.02)',
                            borderColor: isKeep ? 'var(--border)' : 'rgba(255, 255, 255, 0.06)',
                            opacity: isKeep ? 1 : 0.6
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md"
                                style={{ background: badge.bg, color: badge.color }}
                              >
                                {badge.label}
                              </span>
                              <span className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                {item.heading}
                              </span>
                            </div>

                            <button
                              onClick={() => setDecision(item.id, isKeep ? 'discard' : 'keep', true)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                              style={{
                                background: isKeep ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: isKeep ? 'var(--success)' : '#ef4444',
                                border: `1px solid ${isKeep ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                              }}
                            >
                              {isKeep ? <><CheckCircle2 size={13} /> Add New Item</> : <><XCircle size={13} /> Discarded</>}
                            </button>
                          </div>

                          <textarea
                            value={item.point_text}
                            onChange={e => updateItemText(item.id, e.target.value, true)}
                            rows={3}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs resize-none focus:outline-none transition-colors leading-relaxed"
                            style={{
                              background: 'var(--bg-primary)',
                              borderColor: 'var(--border)',
                              color: 'var(--text-primary)'
                            }}
                            placeholder="Extracted rule text..."
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SECTION 3: 📝 Updates to Existing Rules */}
              {updates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📝</span>
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                      Section 3 — Updates to Existing Rules ({updates.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    {updates.map(item => {
                      const decision = item.user_decision;
                      const isApply = decision === 'apply_update';
                      const isKeepPrev = decision === 'keep_previous';
                      const isDiscard = decision === 'discard';
                      const mode = item.apply_mode || 'merge';

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl p-5 border transition-all space-y-4"
                          style={{
                            background: isApply ? 'var(--bg-elevated)' : 'rgba(255, 255, 255, 0.02)',
                            borderColor: isApply ? 'var(--accent)' : 'var(--border)',
                            opacity: isDiscard ? 0.5 : 1
                          }}
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                              {item.target_row_name || 'Existing Rule'}
                            </span>

                            {/* 3 Explicit Choice Action Buttons */}
                            <div className="flex items-center gap-1.5">
                              {/* Option 1: Apply Update */}
                              <button
                                onClick={() => setDecision(item.id, 'apply_update', false)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{
                                  background: isApply ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-primary)',
                                  color: isApply ? '#4ade80' : 'var(--text-muted)',
                                  border: `1px solid ${isApply ? '#34d399' : 'var(--border)'}`
                                }}
                              >
                                <Check size={13} /> Apply Update
                              </button>

                              {/* Option 2: Keep Previous (Default) */}
                              <button
                                onClick={() => setDecision(item.id, 'keep_previous', false)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{
                                  background: isKeepPrev ? 'rgba(168, 85, 247, 0.2)' : 'var(--bg-primary)',
                                  color: isKeepPrev ? '#c084fc' : 'var(--text-muted)',
                                  border: `1px solid ${isKeepPrev ? '#a855f7' : 'var(--border)'}`
                                }}
                              >
                                <ShieldCheck size={13} /> Keep Previous (Untouched)
                              </button>

                              {/* Option 3: Discard Suggestion */}
                              <button
                                onClick={() => setDecision(item.id, 'discard', false)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{
                                  background: isDiscard ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-primary)',
                                  color: isDiscard ? '#f87171' : 'var(--text-muted)',
                                  border: `1px solid ${isDiscard ? '#ef4444' : 'var(--border)'}`
                                }}
                              >
                                <Ban size={13} /> Discard Suggestion
                              </button>
                            </div>
                          </div>

                          {/* BEFORE vs AFTER Comparison Box */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* BEFORE Box */}
                            <div className="p-3.5 rounded-xl border space-y-1.5" style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border)' }}>
                              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-muted)' }}>
                                BEFORE (Current in DB):
                              </span>
                              <p className="text-xs leading-relaxed italic" style={{ color: 'var(--text-secondary)' }}>
                                &ldquo;{item.current_text || 'No current text found.'}&rdquo;
                              </p>
                            </div>

                            {/* AFTER Box */}
                            <div
                              className="p-3.5 rounded-xl border space-y-1.5 transition-all"
                              style={{
                                background: isApply ? 'var(--bg-primary)' : 'rgba(0,0,0,0.1)',
                                borderColor: isApply ? 'var(--accent)' : 'var(--border)',
                                opacity: isApply ? 1 : 0.6
                              }}
                            >
                              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: isApply ? 'var(--accent)' : 'var(--text-muted)' }}>
                                AFTER (Proposed Update):
                              </span>
                              <textarea
                                value={item.point_text}
                                onChange={e => updateItemText(item.id, e.target.value, false)}
                                disabled={!isApply}
                                rows={3}
                                className="w-full text-xs bg-transparent border-0 focus:outline-none resize-none leading-relaxed"
                                style={{ color: isApply ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                placeholder="Proposed text..."
                              />
                            </div>
                          </div>

                          {/* Apply Mode Radio Options (Only enabled when Apply Update is active) */}
                          {isApply && (
                            <div className="pt-1 flex items-center gap-6 text-xs border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                              <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>Apply as:</span>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`apply_mode_${item.id}`}
                                  checked={mode === 'merge'}
                                  onChange={() => updateApplyMode(item.id, 'merge')}
                                  className="accent-purple-500"
                                />
                                <span className="flex items-center gap-1" style={{ color: mode === 'merge' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  <GitMerge size={13} style={{ color: 'var(--accent)' }} /> Merge with existing (AI combine)
                                </span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`apply_mode_${item.id}`}
                                  checked={mode === 'replace'}
                                  onChange={() => updateApplyMode(item.id, 'replace')}
                                  className="accent-purple-500"
                                />
                                <span className="flex items-center gap-1" style={{ color: mode === 'replace' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                  <Replace size={13} style={{ color: '#ef4444' }} /> Replace completely
                                </span>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom Sticky Confirm Bar */}
              <div
                className="sticky bottom-4 p-4 rounded-2xl border flex items-center justify-between backdrop-blur-md shadow-2xl z-20"
                style={{
                  background: 'rgba(18, 18, 26, 0.95)',
                  borderColor: 'var(--accent)'
                }}
              >
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <Database size={15} style={{ color: 'var(--accent)' }} />
                  <span>
                    Ready to confirm <strong style={{ color: 'var(--text-primary)' }}>{totalKeptCount}</strong> items into database
                  </span>
                </div>

                <button
                  onClick={confirmAll}
                  disabled={saving || totalKeptCount === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 shadow-lg shadow-purple-600/30"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                    color: 'white'
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 size={15} className="spinner" />
                      Applying Updates &amp; Merging AI...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      Confirm All Kept Items
                    </>
                  )}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
