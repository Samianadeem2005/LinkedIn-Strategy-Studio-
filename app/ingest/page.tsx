'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { Sparkles, Loader2, CheckCircle2, XCircle, FileText, Database, BookOpen, GitMerge, Replace, ShieldCheck, Check, AlertTriangle } from 'lucide-react';

interface ReviewItem {
  id: string;
  heading: string;
  point_text: string;
  target_table: 'post_types' | 'post_anatomy' | 'writing_mechanics' | 'hook_types';
  is_new_category: number;
  target_row_id: string | null;
  target_row_name?: string | null;
  current_text?: string | null;
  apply_mode?: 'merge' | 'replace';
  suggested_order_index?: number | null;
  user_decision: 'keep' | 'discard' | 'pending' | 'apply_update' | 'keep_previous' | 'error';
  reason?: string | null;
}

export default function IngestPage() {
  const { show: showToast, ToastEl } = useToast();
  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [dumpId, setDumpId] = useState<string | null>(null);
  const [cleanSummary, setCleanSummary] = useState<string | null>(null);

  const [newItems, setNewItems] = useState<ReviewItem[]>([]);
  const [updates, setUpdates] = useState<ReviewItem[]>([]);
  const [errorItems, setErrorItems] = useState<ReviewItem[]>([]);
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

        const initializedErrorItems = (reviewData.errorItems || []).map((item: ReviewItem) => ({
          ...item,
          user_decision: 'error' as const
        }));

        setNewItems(initializedNew);
        setUpdates(initializedUpdates);
        setErrorItems(initializedErrorItems);
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
      case 'post_types': return { bg: 'rgba(79, 110, 125, 0.12)', color: '#4f6e7d', label: 'Post Pillar' };
      case 'post_anatomy': return { bg: 'rgba(201, 71, 49, 0.12)', color: '#c94731', label: 'Post Anatomy' };
      case 'writing_mechanics': return { bg: 'rgba(79, 110, 125, 0.12)', color: '#4f6e7d', label: 'Writing Mechanic' };
      case 'hook_types': return { bg: 'rgba(201, 71, 49, 0.12)', color: '#c94731', label: 'Hook Types' };
      default: return { bg: 'rgba(79, 110, 125, 0.12)', color: '#4f6e7d', label: table };
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden animate-fade-in">
      {ToastEl}

      {/* Top Header */}
      <div className="shrink-0 border-b border-[#4f6e7d]/15 px-8 py-5 flex items-center justify-between bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#4f6e7d]/12 border border-[#4f6e7d]/20 flex items-center justify-center text-[#4f6e7d]">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-[#2c2c2c] tracking-tight">Strategy Ingestion Pipeline</h1>
            <p className="text-xs font-medium text-[#4f6e7d]">
              Paste raw strategy articles to extract clean summaries, new pillars, anatomy rules, and hooks.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Scroll Container */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8 space-y-8">

          {/* Raw Text Input Card */}
          <div className="mosaic-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-[#c94731]" />
              <h2 className="font-bold text-sm text-[#2c2c2c]">Raw Strategy Document / Article Notes</h2>
            </div>

            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              disabled={extracting}
              rows={7}
              placeholder="Paste raw strategy article, book excerpt, or LinkedIn guide here..."
              className="w-full p-4 rounded-xl text-sm border border-[#4f6e7d]/20 bg-[#f5f1f2] text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#4f6e7d]/20 focus:border-[#4f6e7d] resize-none transition-all"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium text-[#4f6e7d]">
                {rawText.trim() ? `${rawText.trim().split(/\s+/).length} words` : '0 words'}
              </span>

              <button
                onClick={extractStrategy}
                disabled={extracting || !rawText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#c94731] hover:bg-[#b83d28] transition-all cursor-pointer shadow-md disabled:opacity-40"
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
            <div className="p-6 rounded-3xl border border-[#4f6e7d]/20 bg-white text-center space-y-3 shadow-[0_8px_30px_rgba(44,44,44,0.06)]">
              <CheckCircle2 size={32} className="mx-auto text-[#4f6e7d]" />
              <h3 className="font-bold text-base text-[#2c2c2c]">
                Strategy Integrated Live!
              </h3>
              <p className="text-xs text-[#4f6e7d] max-w-md mx-auto">
                All confirmed items have been applied to your database. Studio, Settings, and Hook Bank are live-updated.
              </p>
              <button
                onClick={() => { setRawText(''); setNewItems([]); setUpdates([]); setErrorItems([]); setDumpId(null); setCleanSummary(null); setCompleted(false); }}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-[#4f6e7d]/25 text-[#4f6e7d] bg-white hover:bg-[#4f6e7d]/10 transition-all cursor-pointer"
              >
                Process Another Document
              </button>
            </div>
          )}

          {/* Extracted Strategy Review Interface */}
          {!completed && (newItems.length > 0 || updates.length > 0 || errorItems.length > 0 || cleanSummary) && (
            <div className="space-y-8">

              {/* SECTION 1: Clean Summary (Read-Only Outline) */}
              {cleanSummary && (
                <div className="p-6 rounded-3xl border border-[#4f6e7d]/20 bg-white space-y-3 shadow-[0_8px_30px_rgba(44,44,44,0.06)]">
                  <div className="flex items-center justify-between border-b border-[#4f6e7d]/15 pb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen size={18} className="text-[#4f6e7d]" />
                      <h2 className="font-bold text-sm text-[#2c2c2c]">
                        Section 1 — Clean Strategy Overview (Read-Only Outline)
                      </h2>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#4f6e7d]/12 text-[#4f6e7d]">
                      Cleaned Outline
                    </span>
                  </div>

                  <div className="text-xs leading-relaxed font-medium text-[#2c2c2c] space-y-2 whitespace-pre-wrap">
                    {cleanSummary}
                  </div>
                </div>
              )}

              {/* Dynamic Global Summary Counter */}
              <div className="px-5 py-3.5 rounded-2xl border border-[#4f6e7d]/20 bg-white flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <Database size={15} className="text-[#c94731]" />
                  <span className="text-xs font-bold text-[#2c2c2c]">
                    Ready to confirm <strong className="text-[#c94731]">{totalKeptCount}</strong> items
                  </span>
                </div>
                <span className="text-[11px] font-medium text-[#4f6e7d]">
                  ({newItemsToInsert} new + {updatesToApply} updates to apply)
                </span>
              </div>

              {/* SECTION 2: 🆕 New Things Detected */}
              {newItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🆕</span>
                    <h3 className="font-bold text-sm text-[#2c2c2c]">
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
                          className="mosaic-card p-5 space-y-3"
                          style={{ opacity: isKeep ? 1 : 0.6 }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span
                                className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md"
                                style={{ background: badge.bg, color: badge.color }}
                              >
                                {badge.label}
                              </span>
                              {item.target_table === 'post_anatomy' && item.suggested_order_index != null && (
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#c94731]/12 text-[#c94731] border border-[#c94731]/30">
                                  Sequence Position: #{item.suggested_order_index}
                                </span>
                              )}
                              <span className="font-bold text-sm truncate text-[#2c2c2c]">
                                {item.heading}
                              </span>
                            </div>

                            <button
                              onClick={() => setDecision(item.id, isKeep ? 'discard' : 'keep', true)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isKeep
                                  ? 'bg-[#4f6e7d]/12 text-[#4f6e7d] border border-[#4f6e7d]/30'
                                  : 'bg-[#c94731]/12 text-[#c94731] border border-[#c94731]/30'
                                }`}
                            >
                              {isKeep ? <><CheckCircle2 size={13} /> Add New Item</> : <><XCircle size={13} /> Discarded</>}
                            </button>
                          </div>

                          <textarea
                            value={item.point_text}
                            onChange={e => updateItemText(item.id, e.target.value, true)}
                            rows={3}
                            className="w-full px-3.5 py-2.5 rounded-xl text-xs border border-[#4f6e7d]/20 bg-[#f5f1f2] text-[#2c2c2c] focus:outline-none focus:ring-2 focus:ring-[#4f6e7d]/20 focus:border-[#4f6e7d] resize-none transition-colors leading-relaxed font-medium"
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
                    <h3 className="font-bold text-sm text-[#2c2c2c]">
                      Section 3 — Updates to Existing Rules ({updates.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-5">
                    {updates.map(item => {
                      const decision = item.user_decision;
                      const isApply = decision === 'apply_update';
                      const isKeepPrev = decision === 'keep_previous';
                      const mode = item.apply_mode || 'merge';

                      return (
                        <div
                          key={item.id}
                          className="mosaic-card p-5 space-y-4"
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-xs font-extrabold text-[#c94731]">
                              {item.target_row_name || 'Existing Rule'}
                            </span>

                            {/* 2 Explicit Choice Action Buttons */}
                            <div className="flex items-center gap-2">
                              {/* Option 1: Apply Update */}
                              <button
                                onClick={() => setDecision(item.id, 'apply_update', false)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isApply
                                    ? 'bg-[#c94731] text-white shadow-xs'
                                    : 'bg-[#f5f1f2] text-[#4f6e7d] border border-[#4f6e7d]/20'
                                  }`}
                              >
                                <Check size={13} /> Apply Update
                              </button>

                              {/* Option 2: Keep Previous (Default) */}
                              <button
                                onClick={() => setDecision(item.id, 'keep_previous', false)}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isKeepPrev
                                    ? 'bg-[#4f6e7d] text-white shadow-xs'
                                    : 'bg-[#f5f1f2] text-[#4f6e7d] border border-[#4f6e7d]/20'
                                  }`}
                              >
                                <ShieldCheck size={13} /> Keep Previous (Untouched)
                              </button>
                            </div>
                          </div>

                          {/* BEFORE vs AFTER Comparison Box */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* BEFORE Box */}
                            <div className="p-3.5 rounded-2xl border border-[#4f6e7d]/15 bg-[#f5f1f2] space-y-1.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider block text-[#4f6e7d]">
                                BEFORE (Current in DB):
                              </span>
                              <p className="text-xs leading-relaxed italic text-[#2c2c2c] font-medium">
                                &ldquo;{item.current_text || 'No current text found.'}&rdquo;
                              </p>
                            </div>

                            {/* AFTER Box */}
                            <div
                              className="p-3.5 rounded-2xl border border-[#4f6e7d]/20 bg-white space-y-1.5 transition-all"
                              style={{ opacity: isApply ? 1 : 0.6 }}
                            >
                              <span className="text-[10px] font-extrabold uppercase tracking-wider block text-[#c94731]">
                                AFTER (Proposed Update):
                              </span>
                              <textarea
                                value={item.point_text}
                                onChange={e => updateItemText(item.id, e.target.value, false)}
                                disabled={!isApply}
                                rows={3}
                                className="w-full text-xs bg-transparent border-0 focus:outline-none resize-none leading-relaxed text-[#2c2c2c] font-medium"
                                placeholder="Proposed text..."
                              />
                            </div>
                          </div>

                          {/* Apply Mode Radio Options (Only enabled when Apply Update is active) */}
                          {isApply && (
                            <div className="pt-2 flex items-center gap-6 text-xs border-t border-[#4f6e7d]/15">
                              <span className="font-bold text-[#4f6e7d]">Apply as:</span>

                              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#2c2c2c]">
                                <input
                                  type="radio"
                                  name={`apply_mode_${item.id}`}
                                  checked={mode === 'merge'}
                                  onChange={() => updateApplyMode(item.id, 'merge')}
                                  className="accent-[#c94731]"
                                />
                                <span className="flex items-center gap-1">
                                  <GitMerge size={13} className="text-[#4f6e7d]" /> Merge with existing (AI combine)
                                </span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#2c2c2c]">
                                <input
                                  type="radio"
                                  name={`apply_mode_${item.id}`}
                                  checked={mode === 'replace'}
                                  onChange={() => updateApplyMode(item.id, 'replace')}
                                  className="accent-[#c94731]"
                                />
                                <span className="flex items-center gap-1">
                                  <Replace size={13} className="text-[#c94731]" /> Replace completely
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

              {/* SECTION: ⚠️ Couldn't Process — Check Manually */}
              {errorItems.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3.5 rounded-2xl border border-[#c94731]/30 bg-[#c94731]/10 text-[#c94731]">
                    <AlertTriangle size={18} />
                    <h3 className="font-bold text-sm">
                      ⚠️ Couldn&apos;t process — check manually ({errorItems.length})
                    </h3>
                  </div>
                  <p className="text-xs font-medium text-[#4f6e7d]">
                    These items encountered pipeline or embedding errors during processing and could not be automatically evaluated.
                  </p>

                  <div className="grid grid-cols-1 gap-4">
                    {errorItems.map(item => (
                      <div
                        key={item.id}
                        className="mosaic-card p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-sm text-[#2c2c2c]">
                            {item.heading}
                          </span>
                          <span className="text-[11px] px-2.5 py-1 rounded-md font-mono bg-[#c94731]/12 text-[#c94731] font-bold">
                            {item.reason || 'Pipeline Error'}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-[#4f6e7d] font-medium">
                          {item.point_text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Sticky Confirm Bar */}
              <div className="sticky bottom-4 p-4 rounded-3xl border border-[#4f6e7d]/20 bg-white/95 backdrop-blur-md flex items-center justify-between shadow-[0_8px_30px_rgba(44,44,44,0.12)] z-20">
                <div className="flex items-center gap-2 text-xs text-[#4f6e7d]">
                  <Database size={15} className="text-[#c94731]" />
                  <span>
                    Ready to confirm <strong className="text-[#2c2c2c]">{totalKeptCount}</strong> items into database
                  </span>
                </div>

                <button
                  onClick={confirmAll}
                  disabled={saving || totalKeptCount === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#c94731] hover:bg-[#b83d28] transition-all cursor-pointer shadow-md disabled:opacity-40"
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
