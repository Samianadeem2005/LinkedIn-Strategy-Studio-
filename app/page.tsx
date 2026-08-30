'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import { Zap, ChevronDown, AlertTriangle, Save, CheckCircle, Rocket, RefreshCw, Eye, Image, Loader2, BookOpen, Sparkles, Lightbulb, Search } from 'lucide-react';

interface PostVersion {
  version: number;
  sections: Record<string, string>;
  visualSuggestion: string;
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
  const [resolvedLabel, setResolvedLabel] = useState('');
  const [resolvedSource, setResolvedSource] = useState<'calendar' | 'weekly' | 'manual'>('manual');

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
  const [activeVersion, setActiveVersion] = useState(0);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [repeatWarning, setRepeatWarning] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<'draft' | 'approved' | 'published'>('draft');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  // Sync completed generation result from AppContext
  useEffect(() => {
    if (generationResult && generationResult.versions?.length > 0) {
      setVersions(generationResult.versions);
      setActiveVersion(0);
      setEditedSections(generationResult.versions[0].sections);
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

  // Auto-resize all section textareas to 100% of their scrollHeight to guarantee zero clipping
  useEffect(() => {
    if (versions.length === 0) return;
    requestAnimationFrame(() => {
      const textareas = document.querySelectorAll<HTMLTextAreaElement>('.section-textarea');
      textareas.forEach(ta => {
        ta.style.height = 'auto';
        const newH = Math.max(60, ta.scrollHeight);
        ta.style.height = `${newH}px`;
        console.log(`[Section Audit] ${ta.name || 'section'}: scrollHeight=${ta.scrollHeight}px, clientHeight=${ta.clientHeight}px`);
      });
    });
  }, [editedSections, activeVersion, versions]);

  // ── Topic Classifier state ─────────────────────────────────────
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<{
    recommended_type_id: string;
    recommended_type_name: string;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
    alternative_type_id: string | null;
    alternative_type_name: string | null;
    alternative_reasoning: string | null;
  } | null>(null);
  const [recentUsedTypes, setRecentUsedTypes] = useState<string[]>([]);
  // Restore Studio state on mount if navigating back from another page
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('studio_page_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.versions && parsed.versions.length > 0) {
          setVersions(parsed.versions);
          if (parsed.activeVersion !== undefined) setActiveVersion(parsed.activeVersion);
          if (parsed.editedSections) setEditedSections(parsed.editedSections);
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
          activeVersion,
          editedSections,
          rawNotes,
          selectedPostTypeId,
          postId,
          postFormat,
          postDate
        }));
      } catch {}
    }
  }, [versions, activeVersion, editedSections, rawNotes, selectedPostTypeId, postId, postFormat, postDate]);
  const [weeklySchedule, setWeeklySchedule] = useState<{
    dayName: string;
    isToday: boolean;
    isPast: boolean;
    isFuture: boolean;
    pillarName: string;
  }[]>([]);

  // ── Hook Bank state ───────────────────────────────────────────
  const [hooks, setHooks] = useState<{ id: string; hook_text: string; category: string }[]>([]);
  const [selectedHookIds, setSelectedHookIds] = useState<string[]>([]);
  const [loadingHooks, setLoadingHooks] = useState(false);

  const fetchHooks = async (categoryName?: string) => {
    setLoadingHooks(true);
    try {
      const query = categoryName ? `?category=${encodeURIComponent(categoryName)}` : '';
      const res = await fetch(`/api/hooks${query}`);
      if (res.ok) {
        const data = await res.json();
        setHooks(data);
      }
    } catch { /* fall through */ }
    finally { setLoadingHooks(false); }
  };

  useEffect(() => {
    const selectedType = postTypes.find(pt => pt.id === selectedPostTypeId);
    fetchHooks(selectedType?.name);

    const handleStrategyUpdated = () => {
      fetchHooks(selectedType?.name);
    };

    window.addEventListener('strategy_updated', handleStrategyUpdated);
    return () => window.removeEventListener('strategy_updated', handleStrategyUpdated);
  }, [selectedPostTypeId, postTypes]);

  const toggleHookSelection = (id: string) => {
    setSelectedHookIds(prev =>
      prev.includes(id) ? prev.filter(hId => hId !== id) : [...prev, id]
    );
  };

  // Load weekly schedule for vertical ovals & resolution order
  useEffect(() => {
    async function resolveToday() {
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const todayIdx = daysOfWeek.indexOf(todayDayName);

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
        const isToday = idx === todayIdx;
        const isPast = idx < todayIdx;
        const isFuture = idx > todayIdx;
        const pillarName = mappingMap[dayName] || defaultMix[dayName] || 'Value';
        return { dayName, isToday, isPast, isFuture, pillarName };
      });
      setWeeklySchedule(list);

      // 1. Check calendar_entries for today
      try {
        const calRes = await fetch(`/api/calendar-today?date=${today}`);
        if (calRes.ok) {
          const entry: CalendarEntry = await calRes.json();
          if (entry?.id) {
            setCalendarEntry(entry);
            setSelectedPostTypeId(entry.post_type_id);
            setResolvedSource('calendar');
            setResolvedLabel(`Today's plan: ${entry.post_title}`);
            return;
          }
        }
      } catch { /* fall through */ }

      // 2. Fall back to weekly mapping
      if (mappingMap[todayDayName]) {
        const matched = postTypes.find(pt => pt.name.toLowerCase() === mappingMap[todayDayName].toLowerCase());
        if (matched) {
          setSelectedPostTypeId(matched.id);
          setResolvedSource('weekly');
          setResolvedLabel(`${todayDayName} — ${matched.name}`);
          return;
        }
      }

      // 3. Manual fallback
      setResolvedSource('manual');
      setResolvedLabel('Select a pillar manually');
    }
    resolveToday();
  }, [today, settings, postTypes]);

  // ── Mode A: generate from raw notes ──────────────────────────
  const handleGenerate = async () => {
    if (!selectedPostTypeId) { showToast('Select a post type first.', 'error'); return; }
    if (!rawNotes.trim()) { showToast('Add raw notes before generating.', 'error'); return; }
    setVersions([]);
    setRepeatWarning(null);
    setPostId(null);
    const activeSelectedHookTexts = hooks.filter(h => selectedHookIds.includes(h.id)).map(h => h.hook_text);
    await startNotesGenerate({
      rawNotes,
      selectedPostTypeId,
      postFormat,
      postDate,
      selectedHooks: activeSelectedHookTexts,
      selectedHookIds
    });
  };

  // ── Mode B: web search → then generate ─────────────────────
  const handleWebSearchGenerate = async () => {
    if (!selectedPostTypeId) { showToast('Select a pillar first.', 'error'); return; }
    if (!rawNotes.trim()) { showToast('Enter a topic in Raw Notes to search for.', 'error'); return; }
    setVersions([]);
    setRepeatWarning(null);
    setPostId(null);
    const activeSelectedHookTexts = hooks.filter(h => selectedHookIds.includes(h.id)).map(h => h.hook_text);
    await startWebSearchGenerate({
      rawNotes,
      selectedPostTypeId,
      postFormat,
      postDate,
      selectedHooks: activeSelectedHookTexts,
      selectedHookIds
    });
  };

  const classifyTopic = async () => {
    if (!rawNotes.trim()) { showToast('Type or paste your content in Raw Notes first to classify.', 'error'); return; }
    setClassifying(true);
    setClassification(null);
    try {
      const res = await fetch('/api/classify-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawTopic: rawNotes, recentTypes: recentUsedTypes })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Classification failed.', 'error'); return; }
      setClassification(data);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setClassifying(false);
    }
  };

  const applyClassification = (typeId: string, typeName: string) => {
    setSelectedPostTypeId(typeId);
    setResolvedSource('manual');
    setResolvedLabel(`AI Suggested: ${typeName}`);
    setRecentUsedTypes(prev => [...prev.slice(-6), typeName]);
    setClassification(null);
    showToast(`Pillar set to "${typeName}".`, 'success');
  };

  const handleVersionSwitch = (idx: number) => {
    setActiveVersion(idx);
    setEditedSections({ ...versions[idx].sections });
  };

  const handleSectionEdit = (sectionName: string, value: string) => {
    setEditedSections(prev => ({ ...prev, [sectionName]: value }));
  };

  const handleRegenerateSection = async (sectionId: string, sectionName: string) => {
    if (!postId || !selectedPostTypeId || !rawNotes.trim()) return;
    setRegeneratingSection(sectionName);
    try {
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes, postTypeId: selectedPostTypeId, date: today, sectionId })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Section regeneration failed.', 'error'); return; }
      setEditedSections(prev => ({ ...prev, [sectionName]: data.sectionContent }));
      showToast(`"${sectionName}" regenerated.`, 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleSaveEdits = async () => {
    const updatedVersions = versions.map((v, i) =>
      i === activeVersion ? { ...v, sections: editedSections } : v
    );

    if (postId) {
      await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versions: updatedVersions, selected_version: activeVersion, status: 'draft' })
      });
    } else {
      const topicSummary = rawNotes.slice(0, 200).replace(/\s+/g, ' ').trim();
      const firstVer = updatedVersions[0]?.sections || {};
      const totalCharCount = Object.values(firstVer).reduce((acc: number, curr: unknown) => acc + (typeof curr === 'string' ? curr.length : 0), 0);
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: postDate,
          post_type_id: selectedPostTypeId,
          raw_notes_used: rawNotes,
          topic_summary: topicSummary,
          versions: updatedVersions,
          selected_version: activeVersion,
          status: 'draft',
          post_format: postFormat,
          character_count: totalCharCount
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPostId(data.id);
      }
    }
    setVersions(updatedVersions);
    setPostStatus('draft');
    fetchQuotas();
    showToast('Saved to Drafts!', 'success');
  };

  const handleStatusChange = async (status: 'draft' | 'approved' | 'published') => {
    if (!postId) return;
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, selected_version: activeVersion })
    });
    if (res.ok) {
      setPostStatus(status);
      showToast(`Marked as ${status}.`, 'success');
    } else {
      showToast('Failed to update status.', 'error');
    }
  };

  const selectedType = postTypes.find(pt => pt.id === selectedPostTypeId);
  const selectedQuota = ruleList.find(r => r.id === selectedPostTypeId);
  const isQuotaExceeded = selectedQuota ? selectedQuota.target_count > 0 && selectedQuota.used_this_week >= selectedQuota.target_count : false;

  const activeAnatomy = settings?.anatomy_scope === 'per_post_type'
    ? anatomy.filter(s => !s.applies_to_post_type_id || s.applies_to_post_type_id === selectedPostTypeId)
    : anatomy.filter(s => !s.applies_to_post_type_id);
  const currentVisualSuggestion = versions[activeVersion]?.visualSuggestion ?? '';
  const hasOutput = versions.length > 0;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {ToastEl}

      {/* Header */}
      <div className="flex-shrink-0 border-b px-6 py-4 sticky top-0 z-10"
        style={{ background: 'rgba(10,10,15,0.9)', borderColor: 'var(--border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: 'var(--accent)' }} />
            <h1 className="font-semibold text-base">Studio</h1>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Body — fixed height, two scrollable columns */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-0 overflow-hidden">

        {/* Left: Input panel — scrollable */}
        <div className="flex flex-col gap-4 overflow-y-auto p-6 border-r" style={{ borderColor: 'var(--border)' }}>
          
          {/* Calendar context banner */}
          {calendarEntry && (
            <div className="p-4 rounded-xl border animate-fade-in"
              style={{ background: '#0d1f2e', borderColor: '#1a4a7a' }}>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} style={{ color: '#60a5fa' }} />
                <span className="text-xs font-medium" style={{ color: '#60a5fa' }}>From your Calendar Plan</span>
              </div>
              <p className="text-sm font-medium mb-1">{calendarEntry.post_title}</p>
              {calendarEntry.bridge_logic && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Bridge: {calendarEntry.bridge_logic}</p>
              )}
            </div>
          )}

          {/* Main workspace layout: 7 Weekly Day Ovals on Left + Raw Notes & Controls on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
            
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
                    className={`px-3 py-2.5 rounded-full border text-xs flex items-center justify-between transition-all ${
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

            {/* Main Area: Raw Notes Box + Pillar Selector & AI Suggest Button */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              
              {/* Controls bar: Custom Pillar Dropdown + Post Format + Suggest Pillar AI Button */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 p-3 rounded-xl border"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                
                {/* Custom Pillar Dropdown */}
                <div className="flex-1 flex items-center gap-2">
                  <label className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                    Pillar:
                  </label>
                  <div className="relative flex-1">
                    <select
                      value={selectedPostTypeId}
                      onChange={e => { setSelectedPostTypeId(e.target.value); setResolvedSource('manual'); setClassification(null); }}
                      className="w-full px-3 py-2 pr-8 rounded-lg border text-xs appearance-none cursor-pointer font-medium transition-colors"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
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
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
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
                    style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Suggest Pillar Button */}
                <button
                  onClick={classifyTopic}
                  disabled={classifying || !rawNotes.trim()}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 flex-shrink-0"
                  style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 10px rgba(108,99,255,0.25)' }}>
                  {classifying ? <Loader2 size={12} className="spinner" /> : <Sparkles size={12} />}
                  {classifying ? 'Analyzing Notes…' : 'Suggest Pillar'}
                </button>
              </div>

              {/* Quota Exceeded Warning Banner */}
              {isQuotaExceeded && selectedQuota && (
                <div className="p-3.5 rounded-xl border flex items-center gap-3 text-xs animate-fade-in"
                  style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: '#ef4444', color: '#f87171' }}>
                  <AlertTriangle size={18} className="flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Weekly Quota Reached for &quot;{selectedQuota.name}&quot;</p>
                    <p className="font-normal text-xs mt-0.5" style={{ color: '#fca5a5' }}>
                      You have saved {selectedQuota.used_this_week} of {selectedQuota.target_count} posts for this pillar this week. Generation for this pillar is blocked to enforce your weekly quota. Choose another pillar or update targets in Strategy.
                    </p>
                  </div>
                </div>
              )}

              {/* Classification Suggestion Banner */}
              {classification && (
                <div className="p-3.5 rounded-xl border animate-fade-in space-y-2"
                  style={{ background: 'rgba(108,99,255,0.08)', borderColor: 'rgba(108,99,255,0.25)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb size={14} style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
                        AI Recommended: {classification.recommended_type_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{
                        background: classification.confidence === 'high' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                        color: classification.confidence === 'high' ? '#22c55e' : '#eab308'
                      }}>
                        {classification.confidence} confidence
                      </span>
                    </div>
                    <button
                      onClick={() => applyClassification(classification.recommended_type_id, classification.recommended_type_name)}
                      className="text-xs px-3 py-1 rounded-lg font-semibold transition-colors"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      Apply Suggestion
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {classification.reasoning}
                  </p>
                  {classification.alternative_type_name && (
                    <div className="pt-2 border-t flex items-center justify-between gap-2 text-xs" style={{ borderColor: 'rgba(108,99,255,0.15)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Alternative option: <strong>{classification.alternative_type_name}</strong>
                      </span>
                      <button
                        onClick={() => applyClassification(classification.alternative_type_id!, classification.alternative_type_name!)}
                        className="text-[11px] px-2 py-0.5 rounded border transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                        Use Alternative
                      </button>
                    </div>
                  )}
                </div>
              )}


              {/* Raw notes input box */}
              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Raw Notes / Today&apos;s Content
                </label>
                <textarea
                  value={rawNotes}
                  onChange={e => setRawNotes(e.target.value)}
                  placeholder="Type or paste everything you built, learned, or studied today here. Articles, code snippets, bug stories, or frameworks — all in this one box."
                  rows={9}
                  className="w-full flex-1 px-4 py-3 rounded-xl border resize-none text-sm leading-relaxed transition-colors focus:outline-none"
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
            </div>
          </div>

          {/* Repeat warning */}
          {repeatWarning && (
            <div className="flex items-start gap-3 p-3 rounded-lg animate-fade-in"
              style={{ background: '#2e1f0d', border: '1px solid #f59e0b55' }}>
              <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--warning)' }}>Similar topic detected</p>
                <p className="text-xs mt-0.5" style={{ color: '#d97706' }}>{repeatWarning}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>You can still proceed — this is non-blocking.</p>
              </div>
            </div>
          )}

          {/* Hook Bank Selector */}
          {hooks.length > 0 && (
            <div
              className="p-3.5 rounded-xl border space-y-2"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Hook Suggestions (Click to select for generation)
                  </span>
                </div>
                <button
                  onClick={() => fetchHooks(selectedType?.name)}
                  disabled={loadingHooks}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-colors hover:bg-white/5"
                  style={{ color: 'var(--accent)' }}
                >
                  <RefreshCw size={11} className={loadingHooks ? 'spinner' : ''} />
                  Shuffle
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hooks.map(h => {
                  const isSelected = selectedHookIds.includes(h.id);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => toggleHookSelection(h.id)}
                      className="p-2.5 rounded-lg text-left text-xs transition-all border flex items-start gap-2"
                      style={{
                        background: isSelected ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-primary)',
                        borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                        color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="mt-0.5 accent-purple-600 rounded"
                      />
                      <span className="line-clamp-2 leading-relaxed flex-1">{h.hook_text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate buttons — two explicit modes */}
          <div className="grid grid-cols-2 gap-3">
            {/* Mode A: from notes */}
            <button
              id="btn-generate-notes"
              onClick={handleGenerate}
              disabled={generating || !selectedPostTypeId || !rawNotes.trim() || isQuotaExceeded}
              className="py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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

            {/* Mode B: web search first, then generate */}
            <button
              id="btn-generate-websearch"
              onClick={handleWebSearchGenerate}
              disabled={generating || !selectedPostTypeId || !rawNotes.trim() || isQuotaExceeded}
              className="py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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

        {/* Right: Output panel — scrollable */}
        <div className="flex flex-col gap-4 overflow-y-auto p-6">
          {!hasOutput && !generating && (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed py-20"
              style={{ borderColor: 'var(--border)' }}>
              <Zap size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your generated post will appear here.</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Select a post type, add raw notes, then click Generate.</p>
            </div>
          )}

          {generating && (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border py-20"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
              <Loader2 size={32} className="spinner" style={{ color: 'var(--accent)' }} />
              <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>
                {webSearchStatus ?? 'Generating 3 versions…'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {webSearchStatus ? 'Tavily → Gemini pipeline running' : 'Gemini is writing your post'}
              </p>
            </div>
          )}

          {hasOutput && !generating && (
            <>
              {/* Version tabs */}
              <div className="flex gap-2">
                {versions.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => handleVersionSwitch(i)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                    style={{
                      background: activeVersion === i ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: activeVersion === i ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${activeVersion === i ? 'var(--accent)' : 'var(--border)'}`,
                    }}>
                    Version {v.version}
                  </button>
                ))}
              </div>

              {/* Sections */}
              <div className="flex flex-col gap-3" style={{ minHeight: 0 }}>
                {activeAnatomy.map(section => {
                  const content = editedSections[section.section_name] ?? '';
                  const isRegen = regeneratingSection === section.section_name;

                  return (
                    <div key={section.id} className="rounded-xl border animate-fade-in"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between px-4 py-2 border-b rounded-t-xl"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                          {section.section_name}
                        </span>
                        <button
                          onClick={() => handleRegenerateSection(section.id, section.section_name)}
                          disabled={isRegen}
                          title="Regenerate this section only"
                          className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
                          style={{ color: 'var(--text-muted)' }}>
                          {isRegen ? <Loader2 size={14} className="spinner" /> : <RefreshCw size={14} />}
                        </button>
                      </div>
                      <textarea
                        name={section.section_name}
                        value={content}
                        onChange={e => {
                          handleSectionEdit(section.section_name, e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.max(60, e.target.scrollHeight)}px`;
                        }}
                        className="section-textarea w-full px-4 py-3 bg-transparent text-sm resize-none focus:outline-none leading-relaxed block rounded-b-xl"
                        style={{ color: 'var(--text-primary)', height: 'auto', minHeight: '60px' }}
                      />
                    </div>
                  );
                })}

                {/* Visual suggestion */}
                {currentVisualSuggestion && (
                  <div className="px-4 py-3 rounded-xl border animate-fade-in"
                    style={{ background: '#0d1a0d', borderColor: '#166534' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Image size={14} style={{ color: '#22c55e' }} />
                      <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>Visual Suggestion</span>
                    </div>
                    <p className="text-xs" style={{ color: '#86efac' }}>{currentVisualSuggestion}</p>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                  }}>
                  <Eye size={12} />
                  Draft
                </div>

                <button onClick={handleSaveEdits}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm"
                  style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 10px rgba(108,99,255,0.3)' }}>
                  <Save size={14} /> Save to Drafts
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
