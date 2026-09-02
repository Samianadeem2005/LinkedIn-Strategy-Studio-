'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import { Zap, ChevronDown, AlertTriangle, Save, CheckCircle, RefreshCw, Image, Loader2, BookOpen, Sparkles, Search, Trash2, ExternalLink, Copy, Type } from 'lucide-react';

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
  const router = useRouter();
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

  const getTodayLocalDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateForDayOfWeek = (targetDayName: string): string => {
    const now = new Date();
    const currentDayIdx = (now.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const targetDayIdx = daysOfWeek.indexOf(targetDayName);
    if (targetDayIdx === -1) return getTodayLocalDate();
    const diff = targetDayIdx - currentDayIdx;

    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedPostTypeId, setSelectedPostTypeId] = useState('');
  const [postFormat, setPostFormat] = useState<'text_post' | 'image_post' | 'carousel' | 'video_post'>('text_post');
  const [rawNotes, setRawNotes] = useState('');
  const [postDate, setPostDate] = useState(() => getTodayLocalDate());
  const today = postDate;
  const [calendarEntry, setCalendarEntry] = useState<CalendarEntry | null>(null);

  // Entrance animation mount state
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const getEntranceStyle = (delayMs: number) => ({
    animationDelay: `${delayMs}ms`,
    opacity: isLoaded ? undefined : 0,
  });

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
        const todayStr = getTodayLocalDate();
        if (parsed.rawNotes) setRawNotes(parsed.rawNotes);
        if (parsed.selectedPostTypeId) setSelectedPostTypeId(parsed.selectedPostTypeId);
        if (parsed.postId) setPostId(parsed.postId);
        if (parsed.postFormat) setPostFormat(parsed.postFormat);
        if (parsed.postDate && parsed.postDate >= todayStr) {
          setPostDate(parsed.postDate);
        }
        if (parsed.versions && parsed.versions.length > 0) {
          setVersions(parsed.versions);
          if (parsed.editedSectionsMap) setEditedSectionsMap(parsed.editedSectionsMap);
        }
      }
    } catch { }
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
      } catch { }
    }
  }, [versions, editedSectionsMap, rawNotes, selectedPostTypeId, postId, postFormat, postDate]);

  const [weeklySchedule, setWeeklySchedule] = useState<{
    dayName: string;
    isToday: boolean;
    isSelected: boolean;
    isPast: boolean;
    isFuture: boolean;
    pillarName: string;
  }[]>([]);

  // Load weekly schedule for vertical ovals & resolution order
  useEffect(() => {
    async function resolveToday() {
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

      const actualTodayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

      let selectedDayName = actualTodayName;
      if (postDate) {
        const parts = postDate.split('-');
        if (parts.length === 3) {
          const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          if (!isNaN(dObj.getTime())) {
            selectedDayName = dObj.toLocaleDateString('en-US', { weekday: 'long' });
          }
        }
      }

      const actualTodayIdx = daysOfWeek.indexOf(actualTodayName);

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
        const isToday = dayName === actualTodayName;
        const isSelected = dayName === selectedDayName;
        const isPast = idx < actualTodayIdx;
        const isFuture = idx > actualTodayIdx;
        const pillarName = mappingMap[dayName] || defaultMix[dayName] || 'Value';
        return { dayName, isToday, isSelected, isPast, isFuture, pillarName };
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

  const handleFormatPost = (vIdx: number) => {
    const currentSections = editedSectionsMap[vIdx] || versions[vIdx]?.sections || {};
    const activeAnatomy = settings?.anatomy_scope === 'per_post_type'
      ? anatomy.filter(s => !s.applies_to_post_type_id || s.applies_to_post_type_id === selectedPostTypeId)
      : anatomy.filter(s => !s.applies_to_post_type_id);

    let fullText = activeAnatomy
      .map(s => (currentSections[s.section_name] || '').trim())
      .filter(Boolean)
      .join('\n\n');

    if (!fullText.trim()) {
      fullText = Object.values(currentSections)
        .filter(val => typeof val === 'string' && val.trim())
        .map(val => (val as string).trim())
        .join('\n\n');
    }

    if (!fullText.trim()) {
      showToast('No post content to format.', 'error');
      return;
    }

    sessionStorage.setItem('format_input_text', fullText);
    showToast(`Redirecting to Formatter with Version ${vIdx + 1}...`, 'info');
    router.push('/formatter');
  };

  const selectedQuota = ruleList.find(r => r.id === selectedPostTypeId);

  const activeAnatomy = settings?.anatomy_scope === 'per_post_type'
    ? anatomy.filter(s => !s.applies_to_post_type_id || s.applies_to_post_type_id === selectedPostTypeId)
    : anatomy.filter(s => !s.applies_to_post_type_id);
  const hasOutput = versions.length > 0;

  return (
    <div className="min-h-screen bg-[#E4E1E8] text-[#2C2C2C] p-6 space-y-8 max-w-7xl mx-auto w-full">
      {ToastEl}

      {/* Top Section: Mosaic 2-Column Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full">

        {/* LEFT COLUMN: Vertical Weekly Pillar Schedule (3 cols on desktop) */}
        <div
          className={`lg:col-span-3 mosaic-card p-5 flex flex-col justify-between space-y-4 ${isLoaded ? 'animate-panel-settle' : ''}`}
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(238,236,241,0.90) 100%)',
            borderColor: 'rgba(187,178,245,0.30)',
            boxShadow: '0 4px 20px rgba(100,80,160,0.06)',
            ...getEntranceStyle(40)
          }}
        >
          <div className="flex items-center justify-between border-b border-[#8B8A93]/15 pb-3">
            <span className="text-xs font-bold text-[#2C2C2C] uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={13} className="text-[#A78BE0]" /> Weekly Schedule
            </span>
          </div>

          {/* 7 Vertical Oval Pills */}
          <div className="flex flex-col gap-2.5 flex-1 justify-around py-1">
            {weeklySchedule.map((item, idx) => {
              const savedForDay = daySavedMap[item.dayName];
              const tintStyle = idx % 3 === 0
                ? item.isToday || item.isSelected ? 'border-[#BBB2F5] bg-[#BBB2F5]/30 font-bold' : 'border-[#BBB2F5]/60 bg-[#BBB2F5]/15 hover:bg-[#BBB2F5]/25'
                : idx % 3 === 1
                  ? item.isToday || item.isSelected ? 'border-[#D6EC72] bg-[#D6EC72]/35 font-bold' : 'border-[#D6EC72]/70 bg-[#D6EC72]/20 hover:bg-[#D6EC72]/30'
                  : item.isToday || item.isSelected ? 'border-[#D2D4DA] bg-[#D2D4DA]/40 font-bold' : 'border-[#D2D4DA]/60 bg-[#D2D4DA]/20 hover:bg-[#D2D4DA]/30';

              return (
                <div
                  key={item.dayName}
                  onClick={() => {
                    const targetDateStr = getDateForDayOfWeek(item.dayName);
                    setPostDate(targetDateStr);
                  }}
                  className={`h-9 px-3.5 rounded-2xl border text-xs flex items-center justify-between transition-all duration-200 cursor-pointer text-[#2C2C2C] shadow-2xs ${tintStyle}`}>
                  <div className="flex items-center gap-2 min-w-0 font-semibold">
                    {item.isToday ? (
                      <span className="w-2 h-2 rounded-full bg-[#A78BE0] flex-shrink-0 animate-pulse" title="Real-time Today" />
                    ) : item.isSelected ? (
                      <span className="w-2 h-2 rounded-full bg-[#776497] flex-shrink-0" title="Selected Target Date" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B8A93]/50 flex-shrink-0" />
                    )}
                    <span className="truncate text-xs text-[#2C2C2C] font-medium">{item.dayName}</span>
                  </div>

                  {savedForDay && (
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-[#776497] text-white flex-shrink-0 leading-none">
                      {savedForDay.pillar_name.slice(0, 9)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#8B8A93]/15 flex items-center justify-between text-[11px] text-[#8B8A93]">
            <span>Content Strategy</span>
            <span className="text-[#1C1C1E] font-semibold">{ruleList.length} Pillars</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Hero Creator + Post Configuration (9 cols on desktop) */}
        <div className="lg:col-span-9 flex flex-col space-y-5">

          {/* CARD 1: Hero Creator Card */}
          <div
            className={`mosaic-card p-6 flex flex-col justify-between space-y-5 ${isLoaded ? 'animate-panel-settle' : ''}`}
            style={{
              background: 'linear-gradient(135deg, rgba(214,236,114,0.10) 0%, rgba(187,178,245,0.08) 60%, rgba(238,236,241,0.95) 100%)',
              borderColor: 'rgba(187,178,245,0.22)',
              ...getEntranceStyle(80)
            }}
          >
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1C1C1E] flex items-center gap-2 flex-wrap">
                  <span>Automate your posts</span>
                  <span className="font-serif-italic font-normal" style={{ color: '#776497' }}>with quiet precision</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#8B8A93] mt-1 font-normal">
                  Minimal AI content workflows that elevate your creator footprint.
                </p>
              </div>
            </div>

            {/* Calendar Context Banner (If active) */}
            {calendarEntry && calendarEntry.date === postDate && (
              <div className="p-3.5 rounded-xl border border-[#A78BE0]/30 bg-[#A78BE0]/5 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen size={14} className="text-[#A78BE0] flex-shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-[#1C1C1E]">Calendar Plan: </span>
                    <span className="text-[#8B8A93] font-medium">{calendarEntry.post_title}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Inset Textarea Container (Intellecta soft input box aesthetic) */}
            <div className="flex flex-col space-y-1.5 flex-1">
              <div className="flex items-center justify-between text-xs font-semibold text-[#1C1C1E] px-0.5">
                <span className="text-xs font-bold text-[#1C1C1E]">Raw Notes Input</span>
                <span className="text-[#8B8A93] font-mono text-[11px]">{rawNotes.length} chars</span>
              </div>

              <textarea
                id="studio-notes-textarea"
                value={rawNotes}
                onChange={e => setRawNotes(e.target.value)}
                placeholder="Hi there! Paste your raw notes, article key points, or framework thoughts here..."
                rows={4}
                className="w-full px-3.5 py-3 rounded-2xl border border-[#8B8A93]/20 bg-[#EEECF1] text-[#1C1C1E] text-xs leading-relaxed placeholder-[#8B8A93]/50 focus:outline-none focus:ring-2 focus:ring-[#A78BE0]/40 focus:border-[#A78BE0] transition-all duration-200 resize-none font-sans"
              />
            </div>

            {/* Dual Action Buttons */}
            <div className={`grid grid-cols-2 gap-3 pt-0.5 ${isLoaded ? 'animate-content-rise' : ''}`} style={getEntranceStyle(200)}>
              <button
                id="btn-generate-notes"
                onClick={() => handleGenerate()}
                disabled={generating || !selectedPostTypeId || !rawNotes.trim()}
                className="h-10 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 text-white bg-[#A78BE0] hover:bg-[#9070CC] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-md active:scale-[0.985]">
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
                className="h-10 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 border border-[#8B8A93]/30 text-[#1C1C1E] bg-[#EEECF1] hover:bg-[#8B8A93]/15 hover:border-[#8B8A93]/50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.985]">
                {generating && webSearchStatus ? (
                  <><Loader2 size={14} className="spinner" /> Searching…</>
                ) : (
                  <><Search size={14} className="text-[#8B8A93]" /> Web Search</>
                )}
              </button>
            </div>
          </div>

          {/* CARD 2: Post Configuration */}
          <div
            className={`rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-3.5 border shadow-[0_8px_30px_rgba(214,236,114,0.12)] transition-all duration-300 ${isLoaded ? 'animate-panel-settle' : ''}`}
            style={{ background: 'linear-gradient(135deg, rgba(214,236,114,0.18) 0%, rgba(255,255,255,0.96) 100%)', borderColor: 'rgba(214,236,114,0.40)', ...getEntranceStyle(140) }}
          >
            <div className="flex items-center justify-between border-b border-[#8B8A93]/10 pb-2.5">
              <h3 className="text-xs font-bold text-[#1C1C1E] uppercase tracking-wider flex items-center gap-2">
                <Zap size={13} className="text-[#A78BE0]" /> Post Configuration & Format
              </h3>
            </div>

            {/* Controls Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pillar Dropdown */}
              <div className="flex flex-col space-y-1">
                <label className="text-[11px] font-bold text-[#1C1C1E]">Pillar Strategy:</label>
                <div className="relative">
                  <select
                    value={selectedPostTypeId}
                    onChange={e => setSelectedPostTypeId(e.target.value)}
                    className="h-9 w-full px-3 py-1 pr-8 rounded-xl border border-[#8B8A93]/20 bg-[#EEECF1] text-xs text-[#1C1C1E] appearance-none cursor-pointer font-medium focus:outline-none focus:ring-2 focus:ring-[#A78BE0]/40 hover:border-[#8B8A93]/50 transition-all">
                    <option value="" className="bg-white text-[#1C1C1E]">— Select Pillar —</option>
                    {ruleList.map(r => (
                      <option key={r.id} value={r.id} className="bg-white text-[#1C1C1E]">
                        {r.name} {r.is_hybrid ? ' (Merged)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B8A93]" />
                </div>
              </div>

              {/* Format Dropdown */}
              <div className="flex flex-col space-y-1">
                <label className="text-[11px] font-bold text-[#1C1C1E]">Output Format:</label>
                <div className="relative">
                  <select
                    value={postFormat}
                    onChange={e => setPostFormat(e.target.value as any)}
                    className="h-9 w-full px-3 py-1 pr-8 rounded-xl border border-[#8B8A93]/20 bg-[#EEECF1] text-xs text-[#1C1C1E] appearance-none cursor-pointer font-medium focus:outline-none focus:ring-2 focus:ring-[#A78BE0]/40 hover:border-[#8B8A93]/50 transition-all">
                    <option value="text_post" className="bg-white text-[#1C1C1E]">Text Post (600–1,200 chars)</option>
                    <option value="image_post" className="bg-white text-[#1C1C1E]">Image Post (900–1,500 chars)</option>
                    <option value="carousel" className="bg-white text-[#1C1C1E]">Carousel (1,200–1,500 chars)</option>
                    <option value="video_post" className="bg-white text-[#1C1C1E]">Video Post (500–800 chars)</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B8A93]" />
                </div>
              </div>

              {/* Target Date Picker */}
              <div className="flex flex-col space-y-1">
                <label className="text-[11px] font-bold text-[#1C1C1E]">Target Schedule Date:</label>
                <input
                  type="date"
                  value={postDate}
                  onChange={e => setPostDate(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-[#8B8A93]/20 bg-[#EEECF1] text-xs text-[#1C1C1E] font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#A78BE0]/40 hover:border-[#8B8A93]/50 transition-all"
                />
              </div>
            </div>

            {/* Inline Quota Exceeded Confirmation Banner */}
            {inlineQuotaConfirm?.open && selectedQuota && (
              <div className="p-3 rounded-2xl border border-[#A78BE0]/30 bg-[#A78BE0]/10 text-[#1C1C1E] text-xs flex flex-col gap-2 animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-[#A78BE0]" />
                  <div>
                    <p className="font-bold text-[#1C1C1E] text-xs">Weekly Goal Reached for &quot;{selectedQuota.name}&quot;</p>
                    <p className="text-[11px] text-[#8B8A93] mt-0.5">
                      You have already saved {selectedQuota.used_this_week} of {selectedQuota.target_count} target posts. Do you still want to generate an extra post?
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#A78BE0]/20">
                  <button
                    onClick={() => setInlineQuotaConfirm(null)}
                    className="px-3 py-1 rounded-lg text-[11px] font-semibold border border-[#8B8A93]/30 text-[#8B8A93] hover:bg-white cursor-pointer">
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
                    className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[#A78BE0] text-white shadow-sm hover:bg-[#9070CC] cursor-pointer">
                    Yes, Generate Anyway
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Repeat warning */}
      {repeatWarning && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-[#A78BE0]/30 bg-white text-[#1C1C1E] shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all duration-200">
          <AlertTriangle size={17} className="text-[#A78BE0] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[#A78BE0]">Similar topic detected</p>
            <p className="text-xs mt-0.5 text-[#8B8A93]">{repeatWarning}</p>
            <p className="text-[11px] mt-1 text-[#8B8A93]/80">You can still proceed — this is non-blocking.</p>
          </div>
        </div>
      )}

      {/* Bottom Section: 3-Column Generated Output Preview Grid (Intellecta Card Style) */}
      {(hasOutput || generating) && (
        <div
          className={`rounded-3xl p-5 space-y-5 border shadow-[0_8px_30px_rgba(187,178,245,0.10)] transition-all duration-300 ${isLoaded ? 'animate-studio-settle' : ''}`}
          style={{ background: 'linear-gradient(145deg, rgba(187,178,245,0.09) 0%, rgba(255,255,255,0.96) 100%)', borderColor: 'rgba(187,178,245,0.22)', ...getEntranceStyle(300) }}>

          <div className="flex items-center justify-between border-b border-[#8B8A93]/10 pb-3">
            <div>
              <h2 className="text-base font-bold text-[#1C1C1E] flex items-center gap-2">
                <Sparkles size={17} className="text-[#A78BE0]" />
                Generated Post Angles
              </h2>
              <p className="text-xs text-[#8B8A93] mt-0.5">
                Compare all 3 generated options side-by-side. Edit sections directly or save your preferred version to Drafts.
              </p>
            </div>

            {versions.length > 0 && (
              <button
                onClick={() => { setVersions([]); setEditedSectionsMap({}); showToast('Discarded generated posts.', 'info'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#A78BE0]/30 text-[#A78BE0] hover:bg-[#A78BE0]/10 active:scale-[0.98] cursor-pointer">
                <Trash2 size={13} /> Discard All
              </button>
            )}
          </div>

          {generating ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#8B8A93]/15 py-12 bg-[#EEECF1]">
              <Loader2 size={32} className="spinner text-[#A78BE0]" />
              <p className="text-xs font-semibold text-[#1C1C1E] mt-3">
                Generating post...
              </p>
              <p className="text-[11px] text-[#8B8A93] mt-1">
                Crafting 3 distinct post versions
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {versions.map((ver, vIdx) => {
                const currentVerSections = editedSectionsMap[vIdx] || ver.sections || {};
                const charCount = Object.values(currentVerSections).reduce((acc: number, curr: unknown) => acc + (typeof curr === 'string' ? curr.length : 0), 0);
                const isCopied = copiedVersionIdx === vIdx;
                const isSaved = savedVersionIdx === vIdx;

                  return (
                  <div key={vIdx} className="flex flex-col rounded-2xl border p-4 space-y-3 shadow-2xs transition-all duration-200"
                    style={{
                      background: vIdx === 0
                        ? 'linear-gradient(135deg, rgba(187,178,245,0.12) 0%, rgba(238,236,241,0.90) 100%)'
                        : vIdx === 1
                          ? 'linear-gradient(135deg, rgba(214,236,114,0.11) 0%, rgba(238,236,241,0.88) 100%)'
                          : 'linear-gradient(135deg, rgba(210,212,218,0.14) 0%, rgba(238,236,241,0.90) 100%)',
                      borderColor: vIdx === 0 ? 'rgba(187,178,245,0.30)' : vIdx === 1 ? 'rgba(214,236,114,0.35)' : 'rgba(210,212,218,0.35)'
                    }}>

                    {/* Version Column Header */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#8B8A93]/15">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-2xs bg-[#A78BE0]">
                          Version {ver.version}
                        </span>
                        <span className="text-[11px] font-semibold text-[#8B8A93]">
                          {charCount} chars
                        </span>
                      </div>

                      <button
                        onClick={() => handleCopyFullPost(vIdx)}
                        className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer ${isCopied ? 'border-[#8B8A93] text-[#8B8A93] bg-white' : 'border-[#A78BE0] text-[#A78BE0] hover:bg-[#A78BE0]/10'
                          }`}>
                        <Copy size={12} />
                        {isCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    {/* Version Sections */}
                    <div className="flex-1 flex flex-col gap-2.5">
                      {activeAnatomy.map(section => {
                        const content = currentVerSections[section.section_name] ?? '';
                        const isRegenKey = `${vIdx}_${section.section_name}`;
                        const isRegen = regeneratingSection === isRegenKey;

                        return (
                          <div key={section.id} className="rounded-xl border border-[#8B8A93]/15 bg-white overflow-hidden shadow-2xs">
                            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#8B8A93]/10 bg-[#EEECF1]">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A78BE0]">
                                {section.section_name}
                              </span>
                              <button
                                onClick={() => handleRegenerateSection(section.id, section.section_name, vIdx)}
                                disabled={isRegen}
                                title="Regenerate this section only"
                                className="p-1 rounded-full text-[#8B8A93] hover:text-[#1C1C1E] hover:bg-white transition-colors cursor-pointer">
                                {isRegen ? <Loader2 size={12} className="spinner text-[#A78BE0]" /> : <RefreshCw size={12} />}
                              </button>
                            </div>
                            <textarea
                              name={`${vIdx}_${section.section_name}`}
                              value={content}
                              onChange={e => {
                                handleSectionEdit(vIdx, section.section_name, e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = `${Math.max(50, e.target.scrollHeight)}px`;
                              }}
                              className="section-textarea w-full px-3 py-2 bg-white text-xs text-[#1C1C1E] resize-none focus:outline-none focus:ring-1 focus:ring-[#A78BE0]/40 leading-relaxed block transition-colors font-sans"
                              style={{ height: 'auto', minHeight: '50px', overflow: 'hidden' }}
                            />
                          </div>
                        );
                      })}

                      {/* Visual suggestion */}
                      {ver.visualSuggestion && (
                        <div className="px-3 py-2 rounded-xl border border-[#8B8A93]/20 bg-white">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Image size={12} className="text-[#8B8A93]" />
                            <span className="text-[11px] font-semibold text-[#8B8A93]">Visual Suggestion</span>
                          </div>
                          <p className="text-[11px] text-[#1C1C1E] leading-relaxed">{ver.visualSuggestion}</p>
                        </div>
                      )}

                      {/* Resources */}
                      {ver.resources && ver.resources.length > 0 && (
                        <div className="px-3 py-2 rounded-xl border border-[#8B8A93]/20 bg-white">
                          <div className="flex items-center gap-1.5 mb-1">
                            <BookOpen size={12} className="text-[#8B8A93]" />
                            <span className="text-[11px] font-semibold text-[#8B8A93]">References</span>
                          </div>
                          <div className="space-y-0.5">
                            {ver.resources.map((resItem, idx) => {
                              const urlMatch = resItem.match(/https?:\/\/[^\s\)]+/);
                              const targetUrl = urlMatch ? urlMatch[0] : (resItem.startsWith('http') ? resItem : null);
                              return (
                                <div key={idx} className="flex items-start gap-1.5 text-[10px] text-[#8B8A93]">
                                  <span className="text-[8px] mt-0.5">•</span>
                                  {targetUrl ? (
                                    <a href={targetUrl} target="_blank" rel="noopener noreferrer"
                                      className="underline hover:text-[#1C1C1E] transition-colors flex items-center gap-1 break-all">
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

                    {/* Version Save & Format Buttons */}
                    <div className="pt-2 border-t border-[#8B8A93]/15 flex items-center gap-2">
                      <button
                        onClick={() => handleSaveEdits(vIdx)}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-200 ease-out shadow-xs hover:scale-[1.01] active:scale-[0.99] cursor-pointer bg-[#A78BE0] text-white hover:bg-[#9070CC]">
                        {isSaved ? (
                          <><CheckCircle size={13} /> Saved!</>
                        ) : (
                          <><Save size={13} /> Save to Drafts</>
                        )}
                      </button>

                      <button
                        onClick={() => handleFormatPost(vIdx)}
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all duration-200 ease-out shadow-xs hover:scale-[1.01] active:scale-[0.99] cursor-pointer border border-[#8B8A93]/30 text-[#8B8A93] hover:bg-[#8B8A93]/10 bg-white">
                        <Type size={13} /> Format Post
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


