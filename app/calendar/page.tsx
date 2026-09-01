'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/Toast';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Copy, ExternalLink, Loader2, Sparkles, X, FileText, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface CalendarItem {
  id: string;
  date: string;
  post_type_id: string;
  post_type_name: string;
  post_title?: string;
  topics_covered?: string[] | string;
  bridge_logic?: string;
  visual_suggestion?: string;
  status?: string;
}

interface PostVersion {
  version: number;
  sections: Record<string, string>;
  visualSuggestion?: string;
  resources?: string[];
}

interface DraftItem {
  id: string;
  date: string;
  post_type_id: string;
  post_type_name: string;
  topic_summary: string;
  raw_notes_used: string;
  versions: PostVersion[];
  selected_version: number;
  status: string;
  post_format?: string;
  character_count?: number;
  created_at: string;
}

const formatNames: Record<string, string> = {
  'text_post': 'Text Post (600–1,200 chars)',
  'image_post': 'Image Post (900–1,500 chars)',
  'carousel': 'Carousel (1,200–1,500 chars)',
  'video_post': 'Video Post (500–800 chars)'
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default function CalendarPage() {
  const { show: showToast, ToastEl } = useToast();

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [loading, setLoading] = useState(true);
  const [calendarEntries, setCalendarEntries] = useState<CalendarItem[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

  // Drag & drop state
  const [draggedDate, setDraggedDate] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // Selected date pop-up state
  const [selectedDayEvent, setSelectedDayEvent] = useState<{
    dateStr: string;
    draft?: DraftItem;
    plan?: CalendarItem;
  } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthYearString = useMemo(() => {
    return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const monthQueryString = useMemo(() => {
    const m = (month + 1).toString().padStart(2, '0');
    return `${year}-${m}`;
  }, [year, month]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar-events?month=${monthQueryString}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarEntries(data.calendarEntries || []);
        setDrafts(data.posts || []);
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [monthQueryString]);

  // Handle Drag & Drop Swap Logic (Immediate UI update & silent DB persistence)
  const handleSwapDates = async (sourceDate: string, targetDate: string) => {
    if (!sourceDate || !targetDate || sourceDate === targetDate) return;

    // Optimistic state update in UI - immediate visual feedback
    setCalendarEntries(prev => prev.map(c => {
      if (c.date === sourceDate) return { ...c, date: targetDate };
      if (c.date === targetDate) return { ...c, date: sourceDate };
      return c;
    }));

    setDrafts(prev => prev.map(d => {
      if (d.date === sourceDate) return { ...d, date: targetDate };
      if (d.date === targetDate) return { ...d, date: sourceDate };
      return d;
    }));

    // Silent backend sync without popups or alerts
    try {
      const res = await fetch('/api/calendar-events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDate, targetDate })
      });

      if (!res.ok) {
        fetchData(); // Quiet rollback on server error
      }
    } catch (e) {
      fetchData(); // Quiet rollback on network error
    }
  };

  // Helper to format topic(s) covered string
  const formatTopicsCovered = (topics?: string[] | string): string => {
    if (!topics) return '';
    if (Array.isArray(topics)) return topics.join(', ');
    if (typeof topics === 'string') {
      try {
        const parsed = JSON.parse(topics);
        if (Array.isArray(parsed)) return parsed.join(', ');
      } catch (_) {}
      return topics;
    }
    return '';
  };

  // Build Grid Days for Month
  const gridDays = useMemo(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

    const days: ({ dayNum: number; dateStr: string; isCurrentMonth: boolean } | null)[] = [];

    // Leading padding boxes for days of week before first day of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }

    // Days in month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dayFormatted = d.toString().padStart(2, '0');
      const monthFormatted = (month + 1).toString().padStart(2, '0');
      const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;
      days.push({ dayNum: d, dateStr, isCurrentMonth: true });
    }

    return days;
  }, [year, month]);

  // Index events by dateStr
  const eventsByDate = useMemo(() => {
    const map: Record<string, { draft?: DraftItem; plan?: CalendarItem }> = {};

    calendarEntries.forEach(c => {
      if (!map[c.date]) map[c.date] = {};
      map[c.date].plan = c;
    });

    drafts.forEach(d => {
      if (!map[d.date]) map[d.date] = {};
      map[d.date].draft = d;
    });

    return map;
  }, [calendarEntries, drafts]);

  const totalScheduledCount = useMemo(() => {
    return Object.keys(eventsByDate).length;
  }, [eventsByDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleCopyText = (draft: DraftItem) => {
    const activeVer = draft.versions[draft.selected_version || 0] || draft.versions[0];
    if (!activeVer || !activeVer.sections) {
      showToast('No post text available to copy.', 'error');
      return;
    }

    const text = Object.entries(activeVer.sections)
      .map(([heading, body]) => `${heading.toUpperCase()}\n${body}`)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    showToast('Post text copied to clipboard!', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 pb-12">
      {ToastEl}

      {/* Header & Controls */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {monthYearString}
            </h1>
            <div className="flex items-center gap-1">
              <button onClick={handlePrevMonth}
                className="p-1 rounded-lg border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                title="Previous month">
                <ChevronLeft size={14} />
              </button>
              <button onClick={handleNextMonth}
                className="p-1 rounded-lg border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                title="Next month">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <p className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <span>{totalScheduledCount} {totalScheduledCount === 1 ? 'post scheduled' : 'posts scheduled'}</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full border border-purple-500/30 text-purple-400 bg-purple-500/10">
              Drag cards to swap dates
            </span>
          </p>
        </div>

        <Link href="/strategy"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <Sparkles size={13} style={{ color: 'var(--accent)' }} /> Strategy & Quotas
        </Link>
      </div>

      {/* Weekday Labels Header */}
      <div className="grid grid-cols-7 gap-2 mb-2 text-center shrink-0">
        {WEEKDAYS.map((day, idx) => (
          <div key={day} className="text-[11px] font-bold uppercase tracking-wider py-0.5"
            style={{ color: idx === 0 || idx === 1 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Monthly Grid driven by aspect-square per cell */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="spinner" />
          <p className="text-sm font-medium">Loading calendar schedule...</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2 w-full">
          {gridDays.map((cell, idx) => {
            if (!cell) {
              return (
                <div key={`empty-${idx}`} className="w-full rounded-xl" style={{ aspectRatio: '1 / 1', padding: '8px', boxSizing: 'border-box', background: 'transparent' }} />
              );
            }

            const events = eventsByDate[cell.dateStr];
            const hasDraft = !!events?.draft;
            const hasPlan = !!events?.plan;
            const isDraggable = hasDraft || hasPlan;
            const isBeingDragged = draggedDate === cell.dateStr;
            const isDragTarget = dragOverDate === cell.dateStr;

            const topicsCoveredText = hasPlan ? formatTopicsCovered(events.plan?.topics_covered) : '';
            const topicText = topicsCoveredText 
              || (hasPlan ? events.plan?.post_title : '') 
              || events?.draft?.topic_summary 
              || 'Saved Post';

            return (
              <div
                key={cell.dateStr}
                draggable={isDraggable}
                onDragStart={(e) => {
                  setDraggedDate(cell.dateStr);
                  e.dataTransfer.setData('text/plain', cell.dateStr);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={() => {
                  setDraggedDate(null);
                  setDragOverDate(null);
                }}
                onDragOver={(e) => {
                  if (draggedDate && draggedDate !== cell.dateStr) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDragEnter={(e) => {
                  if (draggedDate && draggedDate !== cell.dateStr) {
                    e.preventDefault();
                    setDragOverDate(cell.dateStr);
                  }
                }}
                onDragLeave={(e) => {
                  if (dragOverDate === cell.dateStr) {
                    setDragOverDate(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverDate(null);
                  const sourceDate = e.dataTransfer.getData('text/plain') || draggedDate;
                  if (sourceDate && sourceDate !== cell.dateStr) {
                    handleSwapDates(sourceDate, cell.dateStr);
                  }
                }}
                onClick={() => {
                  if (hasDraft || hasPlan) {
                    setSelectedDayEvent({
                      dateStr: cell.dateStr,
                      draft: events?.draft,
                      plan: events?.plan
                    });
                  }
                }}
                className={`w-full rounded-xl flex flex-col justify-between border overflow-hidden transition-all duration-200 select-none box-border ${
                  isDraggable ? 'cursor-grab active:cursor-grabbing hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/10' : ''
                } ${
                  isBeingDragged ? 'opacity-40 scale-95 border-dashed border-purple-500' : ''
                } ${
                  isDragTarget ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-500/20 scale-[1.02] shadow-xl shadow-purple-500/20' : ''
                }`}
                style={{
                  aspectRatio: '1 / 1',
                  padding: '8px',
                  boxSizing: 'border-box',
                  background: isDragTarget ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-surface)',
                  borderColor: isDragTarget
                    ? '#7c3aed'
                    : hasDraft
                    ? 'var(--accent)'
                    : hasPlan
                    ? 'rgba(108,99,255,0.3)'
                    : 'rgba(255,255,255,0.07)',
                }}
              >
                {/* Top Row: Day Number */}
                <div className="flex items-center justify-between pointer-events-none w-full shrink-0">
                  <span className="font-semibold text-[12px] leading-none" style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    {cell.dayNum}
                  </span>
                  {hasDraft && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} title="Saved Draft" />
                  )}
                </div>

                {/* Event Content Inside Day Box - Vertically Centered */}
                {hasDraft && (
                  <div className="w-full min-w-0 pointer-events-none overflow-hidden flex flex-col justify-center gap-1 flex-1 my-auto">
                    <span className="font-bold uppercase tracking-wider rounded-full block opacity-90 self-start"
                      style={{
                        fontSize: '9px',
                        padding: '1.5px 6px',
                        maxWidth: '100%',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        background: 'rgba(124, 58, 237, 0.2)',
                        color: 'var(--accent)',
                        border: '1px solid var(--accent)'
                      }}>
                      {events.draft?.post_type_name || 'Draft'}
                    </span>
                    <p className="font-medium leading-tight opacity-90"
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-primary)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                      {topicText}
                    </p>
                  </div>
                )}

                {!hasDraft && hasPlan && (
                  <div className="w-full min-w-0 pointer-events-none overflow-hidden flex flex-col justify-center gap-1 flex-1 my-auto">
                    <span className="font-bold uppercase tracking-wider rounded-full block opacity-90 self-start"
                      style={{
                        fontSize: '9px',
                        padding: '1.5px 6px',
                        maxWidth: '100%',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa',
                        border: '1px solid #3b82f6'
                      }}>
                      {events.plan?.post_type_name || 'Planned'}
                    </span>
                    <p className="font-medium leading-tight opacity-90"
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-primary)',
                        maxWidth: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                      {topicText}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pop-Up Modal Overlay for Selected Date Event ────────────────── */}
      {selectedDayEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-2xl rounded-2xl border p-6 animate-scale-in relative shadow-2xl"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            
            {/* Close Button */}
            <button onClick={() => setSelectedDayEvent(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                style={{ background: 'rgba(124, 58, 237, 0.2)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                {selectedDayEvent.draft ? <FileText size={20} /> : <BookOpen size={20} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                    {selectedDayEvent.draft ? 'Saved Draft' : 'Calendar Plan'}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {selectedDayEvent.dateStr}
                  </span>
                </div>
                <h2 className="text-lg font-bold mt-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                  {selectedDayEvent.draft?.topic_summary || selectedDayEvent.plan?.post_title}
                </h2>
              </div>
            </div>

            {/* Modal Details Body */}
            {selectedDayEvent.draft ? (
              <div className="space-y-4">
                {/* Meta details */}
                <div className="flex items-center gap-3 flex-wrap text-xs">
                  <span className="px-2.5 py-1 rounded-full font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                    Pillar: {selectedDayEvent.draft.post_type_name || 'Standard'}
                  </span>
                  <span className="px-2.5 py-1 rounded-full font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    Format: {formatNames[selectedDayEvent.draft.post_format || 'text_post'] || 'Text Post'}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {selectedDayEvent.draft.character_count || 0} characters
                  </span>
                </div>

                {/* Prompt Question / Raw Notes Used */}
                {selectedDayEvent.draft.raw_notes_used && (
                  <div className="p-3 rounded-xl border text-xs" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                    <strong className="block font-semibold mb-1" style={{ color: 'var(--accent)' }}>💡 Prompt Question / Raw Notes:</strong>
                    <p style={{ color: 'var(--text-secondary)' }} className="leading-relaxed whitespace-pre-wrap">{selectedDayEvent.draft.raw_notes_used}</p>
                  </div>
                )}

                {/* Section Content Preview */}
                {selectedDayEvent.draft.versions?.[selectedDayEvent.draft.selected_version || 0]?.sections && (
                  <div className="max-h-72 overflow-y-auto space-y-3 p-4 rounded-xl border text-xs leading-relaxed"
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                    {Object.entries(selectedDayEvent.draft.versions[selectedDayEvent.draft.selected_version || 0].sections).map(([secName, secText]) => (
                      <div key={secName} className="space-y-1">
                        <strong className="block text-xs uppercase font-bold" style={{ color: 'var(--accent)' }}>
                          {secName}
                        </strong>
                        <p className="whitespace-pre-wrap text-sm" style={{ color: 'var(--text-primary)' }}>
                          {secText}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visual Suggestion */}
                {selectedDayEvent.draft.versions?.[selectedDayEvent.draft.selected_version || 0]?.visualSuggestion && (
                  <p className="text-xs italic p-3 rounded-lg border mb-2" style={{ background: '#0d1a0d', borderColor: '#166534', color: '#86efac' }}>
                    🎨 Visual Suggestion: {selectedDayEvent.draft.versions[selectedDayEvent.draft.selected_version || 0].visualSuggestion}
                  </p>
                )}

                {/* Resources */}
                {selectedDayEvent.draft.versions?.[selectedDayEvent.draft.selected_version || 0]?.resources && selectedDayEvent.draft.versions[selectedDayEvent.draft.selected_version || 0].resources!.length > 0 && (
                  <div className="p-3 rounded-lg border text-xs" style={{ background: '#0d1f2e', borderColor: '#1a4a7a', color: '#93c5fd' }}>
                    <strong className="block mb-1 text-blue-400">📚 Resources / References:</strong>
                    {selectedDayEvent.draft.versions[selectedDayEvent.draft.selected_version || 0].resources!.map((r, i) => (
                      <p key={i} className="truncate">• {r}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : selectedDayEvent.plan ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="px-2.5 py-1 rounded-full font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                    Pillar: {selectedDayEvent.plan.post_type_name || 'Standard'}
                  </span>
                  {formatTopicsCovered(selectedDayEvent.plan.topics_covered) && (
                    <span className="px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      Topic(s): {formatTopicsCovered(selectedDayEvent.plan.topics_covered)}
                    </span>
                  )}
                </div>

                {selectedDayEvent.plan.post_title && (
                  <div className="p-3.5 rounded-xl border text-xs" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                    <strong className="block font-semibold mb-1" style={{ color: 'var(--accent)' }}>Planned Headline / Angle:</strong>
                    <p style={{ color: 'var(--text-primary)' }} className="text-sm font-medium">{selectedDayEvent.plan.post_title}</p>
                  </div>
                )}

                {selectedDayEvent.plan.bridge_logic && (
                  <div className="p-3.5 rounded-xl border text-xs" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                    <strong className="block font-semibold mb-1" style={{ color: 'var(--accent)' }}>Bridge Logic:</strong>
                    <p style={{ color: 'var(--text-secondary)' }}>{selectedDayEvent.plan.bridge_logic}</p>
                  </div>
                )}

                {selectedDayEvent.plan.visual_suggestion && (
                  <p className="text-xs italic p-3 rounded-lg border" style={{ background: '#0d1a0d', borderColor: '#166534', color: '#86efac' }}>
                    🎨 Visual Suggestion: {selectedDayEvent.plan.visual_suggestion}
                  </p>
                )}
              </div>
            ) : null}

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
              {selectedDayEvent.draft ? (
                <button onClick={() => handleCopyText(selectedDayEvent.draft!)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 10px rgba(108,99,255,0.25)' }}>
                  <Copy size={14} /> Copy Full Text
                </button>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Planned in Weekly Strategy</span>
              )}

              <Link href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                <ExternalLink size={14} /> Open Studio
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
