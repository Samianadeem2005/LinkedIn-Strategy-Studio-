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
  topics_covered?: string[];
  bridge_logic?: string;
  visual_suggestion?: string;
  status?: string;
}

interface PostVersion {
  version: number;
  sections: Record<string, string>;
  visualSuggestion?: string;
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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const { show: showToast, ToastEl } = useToast();

  // Current selected month date (defaults to September 2026 or current active month)
  const [currentDate, setCurrentDate] = useState(() => {
    // If today is before Sep 2026, default to Sep 2026 for demonstration if calendar entries exist, else current month
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [loading, setLoading] = useState(true);
  const [calendarEntries, setCalendarEntries] = useState<CalendarItem[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);

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
    <div className="max-w-6xl mx-auto px-6 py-8">
      {ToastEl}

      {/* Header & Controls */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {monthYearString}
            </h1>
            <div className="flex items-center gap-1">
              <button onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                title="Previous month">
                <ChevronLeft size={16} />
              </button>
              <button onClick={handleNextMonth}
                className="p-1.5 rounded-lg border transition-colors hover:bg-white/5"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                title="Next month">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {totalScheduledCount} {totalScheduledCount === 1 ? 'post scheduled' : 'posts scheduled'}
          </p>
        </div>

        <Link href="/strategy"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
          <Sparkles size={14} style={{ color: 'var(--accent)' }} /> Strategy & Quotas
        </Link>
      </div>

      {/* Weekday Labels Header */}
      <div className="grid grid-cols-7 gap-3 mb-3 text-center">
        {WEEKDAYS.map((day, idx) => (
          <div key={day} className="text-xs font-semibold uppercase tracking-wider py-1"
            style={{ color: idx === 0 || idx === 1 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {day}
          </div>
        ))}
      </div>

      {/* Monthly Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="spinner" />
          <p className="text-sm font-medium">Loading calendar schedule...</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {gridDays.map((cell, idx) => {
            if (!cell) {
              return (
                <div key={`empty-${idx}`} className="h-28 rounded-2xl" style={{ background: 'transparent' }} />
              );
            }

            const events = eventsByDate[cell.dateStr];
            const hasDraft = !!events?.draft;
            const hasPlan = !!events?.plan;

            return (
              <div
                key={cell.dateStr}
                onClick={() => {
                  if (hasDraft || hasPlan) {
                    setSelectedDayEvent({
                      dateStr: cell.dateStr,
                      draft: events?.draft,
                      plan: events?.plan
                    });
                  }
                }}
                className={`h-28 rounded-2xl p-3 flex flex-col justify-between border transition-all ${
                  hasDraft || hasPlan ? 'cursor-pointer hover:border-purple-500/60 hover:shadow-lg hover:shadow-purple-500/10' : ''
                }`}
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: hasDraft ? 'var(--accent)' : hasPlan ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.06)',
                }}
              >
                {/* Top Row: Day Number */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {cell.dayNum}
                  </span>
                  {hasDraft && (
                    <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} title="Saved Draft" />
                  )}
                </div>

                {/* Event Content Inside Day Box */}
                {hasDraft && (
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-block mb-1 truncate max-w-full"
                      style={{ background: 'rgba(124, 58, 237, 0.2)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                      {events.draft?.post_type_name || 'Draft'}
                    </div>
                    <p className="text-xs font-medium line-clamp-2 leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {events.draft?.topic_summary || 'Saved Draft'}
                    </p>
                  </div>
                )}

                {!hasDraft && hasPlan && (
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-block mb-1 truncate max-w-full"
                      style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid #3b82f6' }}>
                      {events.plan?.post_type_name || 'Planned'}
                    </div>
                    <p className="text-xs font-medium line-clamp-2 leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {events.plan?.post_title}
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
                <h2 className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
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

                {/* Section Content Preview */}
                {selectedDayEvent.draft.versions?.[selectedDayEvent.draft.selected_version || 0]?.sections && (
                  <div className="max-h-80 overflow-y-auto space-y-3 p-4 rounded-xl border text-xs leading-relaxed"
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
                  <p className="text-xs italic p-3 rounded-lg border" style={{ background: '#0d1a0d', borderColor: '#166534', color: '#86efac' }}>
                    🎨 Visual Suggestion: {selectedDayEvent.draft.versions[selectedDayEvent.draft.selected_version || 0].visualSuggestion}
                  </p>
                )}
              </div>
            ) : selectedDayEvent.plan ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-full font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                    Pillar: {selectedDayEvent.plan.post_type_name || 'Standard'}
                  </span>
                </div>

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
