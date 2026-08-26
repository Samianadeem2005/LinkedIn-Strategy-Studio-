'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import { Zap, ChevronDown, AlertTriangle, Save, CheckCircle, Rocket, RefreshCw, Eye, Image, Loader2, BookOpen, Sparkles, Lightbulb, X } from 'lucide-react';

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
  const { postTypes, anatomy, settings } = useApp();
  const { show: showToast, ToastEl } = useToast();

  const [selectedPostTypeId, setSelectedPostTypeId] = useState('');
  const [rawNotes, setRawNotes] = useState('');
  const [today] = useState(() => new Date().toISOString().split('T')[0]);
  const [calendarEntry, setCalendarEntry] = useState<CalendarEntry | null>(null);
  const [resolvedLabel, setResolvedLabel] = useState('');
  const [resolvedSource, setResolvedSource] = useState<'calendar' | 'weekly' | 'manual'>('manual');

  const [generating, setGenerating] = useState(false);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [repeatWarning, setRepeatWarning] = useState<string | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<'draft' | 'approved' | 'published'>('draft');
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

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

  const handleGenerate = async () => {
    if (!selectedPostTypeId) { showToast('Select a post type first.', 'error'); return; }
    if (!rawNotes.trim()) { showToast('Add raw notes before generating.', 'error'); return; }
    setGenerating(true);
    setVersions([]);
    setRepeatWarning(null);
    setPostId(null);
    try {
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes, postTypeId: selectedPostTypeId, date: today })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Generation failed.', 'error'); return; }
      setVersions(data.versions);
      setActiveVersion(0);
      setEditedSections(data.versions[0].sections);
      setPostId(data.postId);
      setPostStatus('draft');
      if (data.repeatWarning) setRepeatWarning(data.repeatWarning);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setGenerating(false);
    }
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
    if (!postId) return;
    const updatedVersions = versions.map((v, i) =>
      i === activeVersion ? { ...v, sections: editedSections } : v
    );
    await fetch(`/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ versions: updatedVersions, selected_version: activeVersion })
    });
    setVersions(updatedVersions);
    showToast('Changes saved.', 'success');
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
  const activeAnatomy = settings?.anatomy_scope === 'per_post_type'
    ? anatomy.filter(s => !s.applies_to_post_type_id || s.applies_to_post_type_id === selectedPostTypeId)
    : anatomy.filter(s => !s.applies_to_post_type_id);
  const currentVisualSuggestion = versions[activeVersion]?.visualSuggestion ?? '';
  const hasOutput = versions.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {ToastEl}

      {/* Header */}
      <div className="sticky top-0 z-10 border-b px-6 py-4"
        style={{ background: 'rgba(10,10,15,0.9)', borderColor: 'var(--border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap size={18} style={{ color: 'var(--accent)' }} />
              <h1 className="font-semibold text-base">Studio</h1>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {resolvedSource === 'calendar' && '📅'}
                {resolvedSource === 'weekly' && '📆'}
                {resolvedSource === 'manual' && '✏️'}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{resolvedLabel || 'Resolving…'}</span>
            </div>
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Input panel */}
        <div className="flex flex-col gap-4">
          
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
              
              {weeklySchedule.map(item => (
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

                  {item.isPast && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                      {item.pillarName}
                    </span>
                  )}

                  {item.isToday && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                      style={{ background: 'var(--accent)', color: '#fff' }}>
                      {selectedType?.name || item.pillarName}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Main Area: Raw Notes Box + Pillar Selector & AI Suggest Button */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              
              {/* Controls bar: Custom Pillar Dropdown + Suggest Pillar AI Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-xl border"
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
                      <option value="">— Select Custom Pillar —</option>
                      {postTypes.map(pt => (
                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                  </div>
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
                  rows={12}
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

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !selectedPostTypeId || !rawNotes.trim()}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
              color: 'white',
              boxShadow: generating ? 'none' : '0 4px 20px var(--accent-glow)',
            }}>
            {generating ? (
              <><Loader2 size={16} className="spinner" /> Generating with Gemini…</>
            ) : (
              <><Zap size={16} /> Generate Post (3 Versions)</>
            )}
          </button>
        </div>

        {/* Right: Output panel */}
        <div className="flex flex-col gap-4">
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
              <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>Generating 3 versions…</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Gemini is writing your post</p>
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
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
                {activeAnatomy.map(section => {
                  const content = editedSections[section.section_name] ?? '';
                  const isRegen = regeneratingSection === section.section_name;
                  return (
                    <div key={section.id} className="rounded-xl border overflow-hidden animate-fade-in"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center justify-between px-4 py-2 border-b"
                        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                            {section.section_name}
                          </span>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', maxWidth: 300 }}>
                            {section.rule_description}
                          </p>
                        </div>
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
                        value={content}
                        onChange={e => handleSectionEdit(section.section_name, e.target.value)}
                        rows={section.section_name === 'Breakdown' ? 6 : 3}
                        className="w-full px-4 py-3 bg-transparent text-sm resize-none focus:outline-none leading-relaxed"
                        style={{ color: 'var(--text-primary)' }}
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
              <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                  style={{
                    background: postStatus === 'published' ? '#0d2e22' : postStatus === 'approved' ? '#1a1f0d' : 'var(--bg-elevated)',
                    color: postStatus === 'published' ? 'var(--success)' : postStatus === 'approved' ? '#bef264' : 'var(--text-muted)',
                    border: `1px solid ${postStatus === 'published' ? 'var(--success)' : postStatus === 'approved' ? '#4d7c0f' : 'var(--border)'}`,
                  }}>
                  <Eye size={12} />
                  {postStatus}
                </div>

                <button onClick={handleSaveEdits}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <Save size={12} /> Save Edits
                </button>

                {postStatus === 'draft' && (
                  <button onClick={() => handleStatusChange('approved')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: '#1a2e0d', border: '1px solid #4d7c0f', color: '#bef264' }}>
                    <CheckCircle size={12} /> Mark Approved
                  </button>
                )}

                {postStatus === 'approved' && (
                  <button onClick={() => handleStatusChange('published')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: '#0d2e22', border: '1px solid var(--success)', color: 'var(--success)' }}>
                    <Rocket size={12} /> Mark Published
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
