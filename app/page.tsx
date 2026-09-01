'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import { Zap, ChevronDown, AlertTriangle, Save, CheckCircle, RefreshCw, Eye, Image, Loader2, BookOpen, Sparkles, Search, Trash2, ExternalLink, Copy } from 'lucide-react';

interface PostVersion {
  version: number;
  sections: Record<string, string>;
  visualSuggestion: string;
  resources?: string[];
}

interface CalendarEntry {
  id: string;
  date: string;
  post_type_id: string;
  post_title: string;
  topics_covered: string[];
  bridge_logic: string;
}

export default function StudioPage() {
  const {
    postTypes,
    anatomy,
    settings,
    generating,
    webSearchStatus,
    generationResult,
    generationError,
    startWebSearchGenerate,
    startNotesGenerate
  } = useApp();
  const { show: showToast, ToastEl } = useToast();

  const [selectedPostTypeId, setSelectedPostTypeId] = useState('');
  const [postFormat, setPostFormat] = useState<'text_post' | 'image_post' | 'carousel' | 'video_post'>('text_post');
  const [rawNotes, setRawNotes] = useState('');
  const [postDate, setPostDate] = useState(() => new Date().toISOString().split('T')[0]);
  const today = postDate;
  const [calendarEntry, setCalendarEntry] = useState<CalendarEntry | null>(null);

  // Quota & Weekly Saved Tracking
  const [ruleList, setRuleList] = useState<{ id: string; name: string; target_count: number; used_this_week: number; is_hybrid: boolean }[]>([]);
  const [daySavedMap, setDaySavedMap] = useState<Record<string, { pillar_name: string; post_id: string; topic: string }>>({});

  const fetchQuotas = async () => {
    try {
      const res = await fetch('/api/pillar-quotas');
      if (res.ok) {
        const data = await res.json();
        if (data.rules) setRuleList(data.rules);
        if (data.daySavedMap) setDaySavedMap(data.daySavedMap);
      }
    } catch { /* fall through */ }
  };

  useEffect(() => {
    fetchQuotas();
  }, []);

  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [editedSectionsMap, setEditedSectionsMap] = useState<Record<number, Record<string, string>>>({});
  const [repeatWarning, setRepeatWarning] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<'draft' | 'approved' | 'published'>('draft');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [copiedVersionIdx, setCopiedVersionIdx] = useState<number | null>(null);
  const [savedVersionIdx, setSavedVersionIdx] = useState<number | null>(null);

  // Sync completed generation result from AppContext
  useEffect(() => {
    if (generationResult && generationResult.versions?.length > 0) {
      setVersions(generationResult.versions);
      const initialMap: Record<number, Record<string, string>> = {};
      generationResult.versions.forEach((v: PostVersion, i: number) => {
        initialMap[i] = { ...v.sections };
      });
      setEditedSectionsMap(initialMap);
      setPostId(generationResult.postId);
      setPostStatus('draft');
      if (generationResult.repeatWarning) setRepeatWarning(generationResult.repeatWarning);
      fetchQuotas();
    }
  }, [generationResult]);

  useEffect(() => {
    if (generationError) {
      showToast(generationError, 'error');
    }
  }, [generationError, showToast]);

  // Sync editedSectionsMap when versions change
  useEffect(() => {
    if (versions.length > 0) {
      setEditedSectionsMap(prev => {
        const next: Record<number, Record<string, string>> = { ...prev };
        versions.forEach((v, i) => {
          if (!next[i]) {
            next[i] = { ...v.sections };
          }
        });
        return next;
      });
    }
  }, [versions]);

  // Auto-resize textareas to fit content dynamically
  useEffect(() => {
    if (versions.length === 0) return;
    requestAnimationFrame(() => {
      const textareas = document.querySelectorAll<HTMLTextAreaElement>('.section-textarea');
      textareas.forEach(ta => {
        ta.style.height = 'auto';
        ta.style.height = `${Math.max(60, ta.scrollHeight)}px`;
      });
    });
  }, [versions, editedSectionsMap]);

  // ── Inline Quota Confirmation State ──────────────────────────────
  const [inlineQuotaConfirm, setInlineQuotaConfirm] = useState<{
    open: boolean;
    type: 'notes' | 'web';
  } | null>(null);

  // Restore Studio state on mount if navigating back from another page
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('studio_page_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.versions && parsed.versions.length > 0) {
          setVersions(parsed.versions);
          if (parsed.editedSectionsMap) setEditedSectionsMap(parsed.editedSectionsMap);
          if (parsed.rawNotes) setRawNotes(parsed.rawNotes);
          if (parsed.selectedPostTypeId) setSelectedPostTypeId(parsed.selectedPostTypeId);
          if (parsed.postId) setPostId(parsed.postId);
          if (parsed.postFormat) setPostFormat(parsed.postFormat);
          if (parsed.postDate) setPostDate(parsed.postDate);
        }
      }
    } catch {}
  }, []);

  // Save Studio state to sessionStorage on state change
  useEffect(() => {
    if (versions.length > 0 || rawNotes.trim().length > 0) {
      try {
        sessionStorage.setItem('studio_page_state', JSON.stringify({
          versions,
          editedSectionsMap,
          rawNotes,
          selectedPostTypeId,
          postId,
          postFormat,
          postDate
        }));
      } catch {}
    }
  }, [versions, editedSectionsMap, rawNotes, selectedPostTypeId, postId, postFormat, postDate]);

  const [weeklySchedule, setWeeklySchedule] = useState<{
    dayName: string;
    isToday: boolean;
    isPast: boolean;
    isFuture: boolean;
    pillarName: string;
  }[]>([]);

  // Load weekly schedule for vertical ovals & resolution order
  useEffect(() => {
    async function resolveToday() {
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      let selectedDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      if (postDate) {
        const parts = postDate.split('-');
        if (parts.length === 3) {
          const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          if (!isNaN(dObj.getTime())) {
            selectedDayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
          }
        }
      }
      const selectedDayIdx = daysOfWeek.indexOf(selectedDayName);

      const defaultMix: Record<string, string> = {
        'Monday': 'Value',
        'Tuesday': 'Lead Magnet',
        'Wednesday': 'Showcase',
        'Thursday': 'Value',
        'Friday': 'Authority',
        'Saturday': 'Lead Magnet',
        'Sunday': 'Personal'
      };

      let mappingMap: Record<string, string> = {};
      try {
        const res = await fetch('/api/weekly-mapping');
        if (res.ok) {
          const mappings = await res.json();
          mappings.forEach((m: { day_of_week: string; post_type_name?: string }) => {
            if (m.post_type_name) mappingMap[m.day_of_week] = m.post_type_name;
          });
        }
      } catch { /* fall through */ }

      const list = daysOfWeek.map((dayName, idx) => {
        const isToday = dayName === selectedDayName;
        const isPast = idx < selectedDayIdx;
        const isFuture = idx > selectedDayIdx;
        const pillarName = mappingMap[dayName] || defaultMix[dayName] || 'Value';
        return { dayName, isToday, isPast, isFuture, pillarName };
      });
      setWeeklySchedule(list);

      // Check calendar_entries for postDate
      try {
        const calRes = await fetch(`/api/calendar-today?date=${postDate}`);
        if (calRes.ok) {
          const entry: CalendarEntry = await calRes.json();
          if (entry?.id && entry.date === postDate) {
            setCalendarEntry(entry);
            setSelectedPostTypeId(entry.post_type_id);
            return;
          }
        }
      } catch { /* fall through */ }

      setCalendarEntry(null);

      // Fall back to weekly mapping
      if (mappingMap[selectedDayName]) {
        const matched = postTypes.find(pt => pt.name.toLowerCase() === mappingMap[selectedDayName].toLowerCase());
        if (matched) {
          setSelectedPostTypeId(matched.id);
        }
      }
    }
    resolveToday();
  }, [postDate, settings, postTypes]);

  // ── Mode A: generate from raw notes ──────────────────────────
  const handleGenerate = async (overrideQuota = false) => {
    if (!selectedPostTypeId) { showToast('Select a post type first.', 'error'); return; }
    if (!rawNotes.trim()) { showToast('Add raw notes before generating.', 'error'); return; }

    const selectedQuota = ruleList.find(r => r.id === selectedPostTypeId);
    const isQuotaExceeded = selectedQuota ? selectedQuota.target_count > 0 && selectedQuota.used_this_week >= selectedQuota.target_count : false;

    if (isQuotaExceeded && !overrideQuota) {
      setInlineQuotaConfirm({ open: true, type: 'notes' });
      return;
    }

    setInlineQuotaConfirm(null);
    setVersions([]);
    setEditedSectionsMap({});
    setRepeatWarning(null);
    setPostId(null);
    await startNotesGenerate({
      rawNotes,
      selectedPostTypeId,
      postFormat,
      postDate,
      selectedHooks: [],
      selectedHookIds: []
    });
  };

  // ── Mode B: web search → then generate ─────────────────────
  const handleWebSearchGenerate = async (overrideQuota = false) => {
    if (!selectedPostTypeId) { showToast('Select a pillar first.', 'error'); return; }
    if (!rawNotes.trim()) { showToast('Enter a topic in Raw Notes to search for.', 'error'); return; }

    const selectedQuota = ruleList.find(r => r.id === selectedPostTypeId);
    const isQuotaExceeded = selectedQuota ? selectedQuota.target_count > 0 && selectedQuota.used_this_week >= selectedQuota.target_count : false;

    if (isQuotaExceeded && !overrideQuota) {
      setInlineQuotaConfirm({ open: true, type: 'web' });
      return;
    }

    setInlineQuotaConfirm(null);
    setVersions([]);
    setEditedSectionsMap({});
    setRepeatWarning(null);
    setPostId(null);
    await startWebSearchGenerate({
      rawNotes,
      selectedPostTypeId,
      postFormat,
      postDate,
      selectedHooks: [],
      selectedHookIds: []
    });
  };

  const handleSectionEdit = (vIdx: number, sectionName: string, value: string) => {
    setEditedSectionsMap(prev => ({
      ...prev,
      [vIdx]: {
        ...(prev[vIdx] || {}),
        [sectionName]: value
      }
    }));
  };

  const handleRegenerateSection = async (sectionId: string, sectionName: string, vIdx: number) => {
    if (!postId || !selectedPostTypeId || !rawNotes.trim()) return;
    const isRegenKey = `${vIdx}_${sectionName}`;
    setRegeneratingSection(isRegenKey);
    try {
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes, postTypeId: selectedPostTypeId, date: today, sectionId })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Section regeneration failed.', 'error'); return; }
      setEditedSectionsMap(prev => ({
        ...prev,
        [vIdx]: {
          ...(prev[vIdx] || {}),
          [sectionName]: data.sectionContent
        }
      }));
      showToast(`"${sectionName}" regenerated for Version ${vIdx + 1}.`, 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleSaveEdits = async (vIdx: number) => {
    const updatedVersions = versions.map((v, i) => ({
      ...v,
      sections: editedSectionsMap[i] || v.sections
    }));

    const postTypeIdToUse = selectedPostTypeId || (postTypes.length > 0 ? postTypes[0].id : null);

    if (postId) {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versions: updatedVersions, selected_version: vIdx, status: 'draft' })
      });
      if (res.ok) {
        setVersions(updatedVersions);
        setPostStatus('draft');
        fetchQuotas();
        setSavedVersionIdx(vIdx);
        setTimeout(() => setSavedVersionIdx(null), 2000);
        showToast(`Version ${vIdx + 1} saved to Drafts!`, 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update draft.', 'error');
      }
    } else {
      const topicSummary = rawNotes.slice(0, 200).replace(/\s+/g, ' ').trim() || 'Untitled Draft';
      const targetVer = updatedVersions[vIdx]?.sections || {};
      const totalCharCount = Object.values(targetVer).reduce((acc: number, curr: unknown) => acc + (typeof curr === 'string' ? curr.length : 0), 0);
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: postDate,
          post_type_id: postTypeIdToUse,
          raw_notes_used: rawNotes,
          topic_summary: topicSummary,
          versions: updatedVersions,
          selected_version: vIdx,
          status: 'draft',
          post_format: postFormat,
          character_count: totalCharCount
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPostId(data.id);
        setVersions(updatedVersions);
        setPostStatus('draft');
        fetchQuotas();
        setSavedVersionIdx(vIdx);
        setTimeout(() => setSavedVersionIdx(null), 2000);
        showToast(`Version ${vIdx + 1} saved to Drafts!`, 'success');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to save draft.', 'error');
      }
    }
  };

  const handleCopyFullPost = (vIdx: number) => {
    const currentSections = editedSectionsMap[vIdx] || versions[vIdx]?.sections || {};
    const activeAnatomy = settings?.anatomy_scope === 'per_post_type'
      ? anatomy.filter(s => !s.applies_to_post_type_id || s.applies_to_post_type_id === selectedPostTypeId)
      : anatomy.filter(s => !s.applies_to_post_type_id);

    const fullText = activeAnatomy
      .map(s => (currentSections[s.section_name] || '').trim())
      .filter(Boolean)
      .join('\n\n');

    if (!fullText.trim()) {
      showToast('No post content to copy.', 'error');
      return;
    }

    navigator.clipboard.writeText(fullText.replace(/\r\n/g, '\n'));
    setCopiedVersionIdx(vIdx);
    setTimeout(() => setCopiedVersionIdx(null), 2000);
    showToast(`Version ${vIdx + 1} copied to clipboard!`, 'success');
  };

  const selectedQuota = ruleList.find(r => r.id === selectedPostTypeId);

  const activeAnatomy = settings?.anatomy_scope === 'per_post_type'
    ? anatomy.filter(s => !s.applies_to_post_type_id || s.applies_to_post_type_id === selectedPostTypeId)
    : anatomy.filter(s => !s.applies_to_post_type_id);
  const hasOutput = versions.length > 0;

  return (
    <div className="min-h-screen bg-[var(--bg-dark)] text-white p-6 space-y-8 max-w-7xl mx-auto w-full">
      {ToastEl}

      {/* Top Section: Input Card (Full Width) */}
      <div className="rounded-2xl border p-6 space-y-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        
        {/* Calendar context banner if available */}
        {calendarEntry && calendarEntry.date === postDate && (
          <div className="p-4 rounded-xl border animate-fade-in"
            style={{ background: '#0d1f2e', borderColor: '#1a4a7a' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <BookOpen size={14} style={{ color: '#60a5fa' }} />
              <span className="text-xs font-semibold" style={{ color: '#60a5fa' }}>From your Calendar Plan</span>
            </div>
            <p className="text-sm font-bold">{calendarEntry.post_title}</p>
            {calendarEntry.bridge_logic && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Bridge: {calendarEntry.bridge_logic}</p>
            )}
          </div>
        )}

        {/* Main Grid: Weekly Schedule + Controls & Raw Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Side Column: 7 Weekly Days in Vertical Ovals */}
          <div className="lg:col-span-1 flex flex-col gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span>Weekly Schedule</span>
            </div>
            
            {weeklySchedule.map(item => {
              const savedForDay = daySavedMap[item.dayName];
              return (
                <div
                  key={item.dayName}
                  className={`px-3.5 py-2.5 rounded-full border text-xs flex items-center justify-between transition-all ${
                    item.isToday ? 'shadow-lg shadow-indigo-500/20' : ''
                  }`}
                  style={{
                    background: item.isToday
                      ? 'linear-gradient(135deg, rgba(108,99,255,0.22), rgba(167,139,250,0.12))'
                      : item.isPast
                      ? 'var(--bg-elevated)'
                      : 'var(--bg-surface)',
                    borderColor: item.isToday ? 'var(--accent)' : 'var(--border-subtle)',
                    color: item.isToday ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: item.isToday ? 600 : 500
                  }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    {item.isToday && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: 'var(--accent)' }} />
                    )}
                    <span className="truncate">{item.dayName}</span>
                  </div>

                  {savedForDay && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {savedForDay.pillar_name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main Controls & Raw Notes Area */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              
              {/* Pillar Dropdown */}
              <div className="flex-1 flex items-center gap-2">
                <label className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  Pillar:
                </label>
                <div className="relative flex-1">
                  <select
                    value={selectedPostTypeId}
                    onChange={e => setSelectedPostTypeId(e.target.value)}
                    className="w-full px-3 py-2 pr-8 rounded-lg border text-xs appearance-none cursor-pointer font-medium transition-colors"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="">— Select Pillar Option —</option>
                    {ruleList.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.is_hybrid ? ' (Merged Combo)' : ''} ({r.used_this_week}/{r.target_count})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Post Format Selector */}
              <div className="flex-1 flex items-center gap-2">
                <label className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  Format:
                </label>
                <div className="relative flex-1">
                  <select
                    value={postFormat}
                    onChange={e => setPostFormat(e.target.value as any)}
                    className="w-full px-3 py-2 pr-8 rounded-lg border text-xs appearance-none cursor-pointer font-medium transition-colors"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                    <option value="text_post">Text Post (600–1,200 chars)</option>
                    <option value="image_post">Image Post (900–1,500 chars)</option>
                    <option value="carousel">Carousel (1,200–1,500 chars)</option>
                    <option value="video_post">Video Post (500–800 chars)</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Scheduled Date Picker */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                  Target Date:
                </label>
                <input
                  type="date"
                  value={postDate}
                  onChange={e => setPostDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-xs font-mono font-medium cursor-pointer transition-colors"
                  style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Inline Quota Exceeded Confirmation Banner */}
            {inlineQuotaConfirm?.open && selectedQuota && (
              <div className="p-3.5 rounded-xl border flex flex-col gap-2.5 text-xs animate-fade-in"
                style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: '#ef4444', color: '#f87171' }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Weekly Goal Reached for &quot;{selectedQuota.name}&quot;</p>
                    <p className="font-normal text-xs mt-0.5" style={{ color: '#fca5a5' }}>
                      You have already saved {selectedQuota.used_this_week} of {selectedQuota.target_count} target posts for this pillar this week. Do you still want to generate an extra post?
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-1 border-t" style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}>
                  <button
                    onClick={() => setInlineQuotaConfirm(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-white/5"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}>
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const type = inlineQuotaConfirm.type;
                      setInlineQuotaConfirm(null);
                      if (type === 'notes') {
                        handleGenerate(true);
                      } else {
                        handleWebSearchGenerate(true);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow"
                    style={{ background: '#ef4444', color: '#fff', boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)' }}>
                    Yes, Generate Anyway
                  </button>
                </div>
              </div>
            )}

            {/* Raw notes input box */}
            <div className="flex flex-col">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Raw Notes / Today&apos;s Content
              </label>
              <textarea
                value={rawNotes}
                onChange={e => setRawNotes(e.target.value)}
                placeholder="Type or paste everything you built, learned, or studied today here. Articles, code snippets, bug stories, or frameworks — all in this one box."
                rows={8}
                className="w-full px-4 py-3 rounded-xl border resize-none text-sm leading-relaxed transition-colors focus:outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-inter)',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{rawNotes.length} chars</span>
                {anatomy.length > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {activeAnatomy.length} sections active
                  </span>
                )}
              </div>
            </div>

            {/* Generate Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                id="btn-generate-notes"
                onClick={() => handleGenerate()}
                disabled={generating || !selectedPostTypeId || !rawNotes.trim()}
                className="py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                  color: 'white',
                  boxShadow: generating ? 'none' : '0 4px 20px var(--accent-glow)',
                }}>
                {generating && !webSearchStatus ? (
                  <><Loader2 size={14} className="spinner" /> Generating…</>
                ) : (
                  <><Zap size={14} /> From Notes</>
                )}
              </button>

              <button
                id="btn-generate-websearch"
                onClick={() => handleWebSearchGenerate()}
                disabled={generating || !selectedPostTypeId || !rawNotes.trim()}
                className="py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: generating && webSearchStatus
                    ? 'rgba(20,184,166,0.2)'
                    : 'linear-gradient(135deg, #0f766e, #14b8a6)',
                  color: 'white',
                  boxShadow: generating ? 'none' : '0 4px 16px rgba(20,184,166,0.3)',
                  border: '1px solid rgba(20,184,166,0.4)',
                }}>
                {generating && webSearchStatus ? (
                  <><Loader2 size={14} className="spinner" /> Searching…</>
                ) : (
                  <><Search size={14} /> Web Search</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Repeat warning */}
      {repeatWarning && (
        <div className="flex items-start gap-3 p-4 rounded-xl animate-fade-in border"
          style={{ background: '#2e1f0d', borderColor: '#f59e0b55' }}>
          <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--warning)' }}>Similar topic detected</p>
            <p className="text-xs mt-0.5" style={{ color: '#d97706' }}>{repeatWarning}</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>You can still proceed — this is non-blocking.</p>
          </div>
        </div>
      )}

      {/* Bottom Section: 3-Column Generated Output Preview Grid (Below Viewport, Full Width) */}
      {(hasOutput || generating) && (
        <div className="rounded-2xl border p-6 space-y-6 animate-fade-in" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                Generated Post Versions
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Compare all 3 generated angles side-by-side. Edit sections directly or save your preferred version to Drafts.
              </p>
            </div>

            {versions.length > 0 && (
              <button
                onClick={() => { setVersions([]); setEditedSectionsMap({}); showToast('Discarded generated posts.', 'info'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors hover:bg-red-950/20"
                style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}>
                <Trash2 size={13} /> Discard All
              </button>
            )}
          </div>

          {generating ? (
            <div className="flex flex-col items-center justify-center rounded-xl border py-16"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              <Loader2 size={36} className="spinner" style={{ color: 'var(--accent)' }} />
              <p className="text-sm font-semibold mt-4" style={{ color: 'var(--text-primary)' }}>
                {webSearchStatus ?? 'Generating 3 versions…'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {webSearchStatus ? 'Tavily → Gemini pipeline running' : 'Gemini is crafting 3 unique angles for your post'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {versions.map((ver, vIdx) => {
                const currentVerSections = editedSectionsMap[vIdx] || ver.sections || {};
                const charCount = Object.values(currentVerSections).reduce((acc: number, curr: unknown) => acc + (typeof curr === 'string' ? curr.length : 0), 0);
                const isCopied = copiedVersionIdx === vIdx;
                const isSaved = savedVersionIdx === vIdx;

                return (
                  <div key={vIdx} className="flex flex-col rounded-2xl border p-4 space-y-4"
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                    
                    {/* Version Column Header */}
                    <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                          style={{ background: 'var(--accent)' }}>
                          Version {ver.version}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          {charCount} chars
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyFullPost(vIdx)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5"
                        style={{
                          borderColor: isCopied ? '#22c55e' : 'var(--accent)',
                          color: isCopied ? '#22c55e' : 'var(--accent)',
                        }}>
                        <Copy size={12} />
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    {/* Version Sections */}
                    <div className="flex-1 flex flex-col gap-3">
                      {activeAnatomy.map(section => {
                        const content = currentVerSections[section.section_name] ?? '';
                        const isRegenKey = `${vIdx}_${section.section_name}`;
                        const isRegen = regeneratingSection === isRegenKey;

                        return (
                          <div key={section.id} className="rounded-xl border"
                            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                            <div className="flex items-center justify-between px-3 py-1.5 border-b rounded-t-xl"
                              style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'var(--border)' }}>
                              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                                {section.section_name}
                              </span>
                              <button
                                onClick={() => handleRegenerateSection(section.id, section.section_name, vIdx)}
                                disabled={isRegen}
                                title="Regenerate this section only"
                                className="p-1 rounded transition-colors hover:bg-white/5 disabled:opacity-40"
                                style={{ color: 'var(--text-muted)' }}>
                                {isRegen ? <Loader2 size={12} className="spinner" /> : <RefreshCw size={12} />}
                              </button>
                            </div>
                            <textarea
                              name={`${vIdx}_${section.section_name}`}
                              value={content}
                              onChange={e => {
                                handleSectionEdit(vIdx, section.section_name, e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.max(60, e.target.scrollHeight)}px`;
                              }}
                              className="section-textarea w-full px-3 py-2.5 bg-transparent text-xs resize-none focus:outline-none leading-relaxed block rounded-b-xl"
                              style={{ color: 'var(--text-primary)', height: 'auto', minHeight: '60px', overflow: 'hidden' }}
                            />
                          </div>
                        );
                      })}

                      {/* Visual suggestion */}
                      {ver.visualSuggestion && (
                        <div className="px-3 py-2.5 rounded-xl border"
                          style={{ background: '#0d1a0d', borderColor: '#166534' }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Image size={13} style={{ color: '#22c55e' }} />
                            <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>Visual Suggestion</span>
                          </div>
                          <p className="text-[11px] leading-relaxed" style={{ color: '#86efac' }}>{ver.visualSuggestion}</p>
                        </div>
                      )}

                      {/* Resources */}
                      {ver.resources && ver.resources.length > 0 && (
                        <div className="px-3 py-2.5 rounded-xl border"
                          style={{ background: '#0d1f2e', borderColor: '#1a4a7a' }}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <BookOpen size={13} style={{ color: '#60a5fa' }} />
                            <span className="text-xs font-semibold" style={{ color: '#60a5fa' }}>References</span>
                          </div>
                          <div className="space-y-1">
                            {ver.resources.map((resItem, idx) => {
                              const urlMatch = resItem.match(/https?:\/\/[^\s\)]+/);
                              const targetUrl = urlMatch ? urlMatch[0] : (resItem.startsWith('http') ? resItem : null);
                              return (
                                <div key={idx} className="flex items-start gap-1.5 text-[11px]" style={{ color: '#93c5fd' }}>
                                  <span className="text-[9px] mt-0.5">•</span>
                                  {targetUrl ? (
                                    <a href={targetUrl} target="_blank" rel="noopener noreferrer"
                                      className="underline hover:text-white transition-colors flex items-center gap-1 break-all">
                                      {resItem}
                                      <ExternalLink size={9} className="inline flex-shrink-0" />
                                    </a>
                                  ) : (
                                    <span className="leading-relaxed break-all">{resItem}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Version Save Button */}
                    <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <button
                        onClick={() => handleSaveEdits(vIdx)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                        style={{
                          background: isSaved ? '#22c55e' : 'var(--accent)',
                          color: '#fff',
                          boxShadow: '0 2px 10px rgba(108,99,255,0.3)'
                        }}>
                        {isSaved ? (
                          <><CheckCircle size={14} /> Version {vIdx + 1} Saved!</>
                        ) : (
                          <><Save size={14} /> Save Version {vIdx + 1} to Drafts</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
