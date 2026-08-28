'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { Sparkles, Loader2, AlertTriangle, CheckCircle, Trash2, Save, XCircle, Tag } from 'lucide-react';

interface CalendarEntry {
  day_index: number;
  date: string;
  day_name: string;
  post_type_id: string;
  post_type_name: string;
  post_title: string;
  topics_covered: string[];
  bridge_logic: string;
  visual_suggestion: string;
  is_authority_borrow: boolean;
}

const STORAGE_KEY = 'content_os_pending_calendar_maker_plan';

export default function CalendarMakerPage() {
  const { show: showToast, ToastEl } = useToast();

  const [rawDump, setRawDump] = useState('');
  const [durationDays, setDurationDays] = useState(14);
  const [customDays, setCustomDays] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const [generating, setGenerating] = useState(false);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Restore unsaved pending calendar draft from localStorage on page load
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.entries && Array.isArray(parsed.entries) && parsed.entries.length > 0) {
          setCalendarEntries(parsed.entries);
          if (parsed.rawDump) setRawDump(parsed.rawDump);
          if (parsed.startDate) setStartDate(parsed.startDate);
          if (parsed.durationDays !== undefined) setDurationDays(parsed.durationDays);
          if (parsed.validationWarnings) setValidationWarnings(parsed.validationWarnings);
        }
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Sync current entries state to localStorage so navigation doesn't wipe unsaved work
  useEffect(() => {
    if (calendarEntries.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          entries: calendarEntries,
          rawDump,
          startDate,
          durationDays,
          validationWarnings
        }));
      } catch { /* ignore */ }
    }
  }, [calendarEntries, rawDump, startDate, durationDays, validationWarnings]);

  const effectiveDuration = durationDays === 0 ? (parseInt(customDays) || 14) : durationDays;

  const generateCalendar = async () => {
    if (!rawDump.trim()) {
      showToast('Please paste raw notes or a strategy summary first.', 'error');
      return;
    }

    setGenerating(true);
    setCalendarEntries([]);
    setValidationWarnings([]);
    setSaved(false);

    try {
      const res = await fetch('/api/generate-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawDump, durationDays: effectiveDuration, startDate })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Generation failed.', 'error');
        return;
      }
      setCalendarEntries(data.entries);
      setValidationWarnings(data.validationWarnings ?? []);
      showToast(`Generated ${data.entries.length} calendar topic entries!`, 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const updateEntry = (index: number, field: keyof CalendarEntry, value: unknown) => {
    setCalendarEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const updateTopics = (index: number, rawString: string) => {
    const topicArray = rawString.split(',').map(t => t.trim()).filter(Boolean);
    updateEntry(index, 'topics_covered', topicArray);
  };

  const deleteEntry = (index: number) => {
    setCalendarEntries(prev => prev.filter((_, i) => i !== index));
  };

  const saveCalendar = async () => {
    if (calendarEntries.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/generate-calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, durationDays: effectiveDuration, rawDump, entries: calendarEntries })
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(true);
        localStorage.removeItem(STORAGE_KEY);
        showToast(`Saved ${data.saved} calendar entries to your database!`, 'success');
      } else {
        showToast(data.error ?? 'Failed to save calendar.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const discardPlan = () => {
    if (confirm('Are you sure you want to discard this generated calendar plan?')) {
      setCalendarEntries([]);
      setValidationWarnings([]);
      setSaved(false);
      localStorage.removeItem(STORAGE_KEY);
      showToast('Generated plan discarded.', 'info');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {ToastEl}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Sparkles size={22} style={{ color: 'var(--accent)' }} />
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Calendar Maker
            </h1>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Turn raw strategy dumps into a structured, date-mapped content calendar for any duration.
          </p>
        </div>
      </div>

      {/* Generator Card */}
      <div className="rounded-2xl border p-6 mb-8 shadow-lg"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        
        <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Raw Strategy Dump / Content Notes
        </label>
        <textarea
          value={rawDump}
          onChange={e => setRawDump(e.target.value)}
          placeholder="Paste raw notes, research summaries, video ideas, or transcript dumps here..."
          rows={6}
          className="w-full text-sm p-4 rounded-xl border mb-5 font-mono leading-relaxed transition-colors"
          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />

        {/* Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 p-4 rounded-xl border"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
          
          {/* Start Date */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border font-mono font-medium"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          {/* Duration (Days) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Calendar Duration (Days)
            </label>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={durationDays}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setDurationDays(val);
                  if (val !== 0) setCustomDays('');
                }}
                className="px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Weeks)</option>
                <option value={21}>21 Days (3 Weeks)</option>
                <option value={30}>30 Days (1 Month)</option>
                <option value={0}>Custom Days...</option>
              </select>

              {durationDays === 0 && (
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={customDays}
                  onChange={e => setCustomDays(e.target.value)}
                  placeholder="Enter days"
                  className="w-28 text-xs px-3 py-2 rounded-xl border font-bold"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Generate Action Button */}
        <div className="flex justify-end">
          <button onClick={generateCalendar} disabled={generating}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-lg"
            style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 20px var(--accent-glow)' }}>
            {generating ? <><Loader2 size={16} className="spinner" /> Generating Plan ({effectiveDuration} Days)...</> : <><Sparkles size={16} /> Generate Strategy Plan</>}
          </button>
        </div>
      </div>

      {/* Validation Warnings Banner */}
      {validationWarnings.length > 0 && (
        <div className="rounded-2xl border p-5 mb-8 space-y-2"
          style={{ background: '#2e1c0d', borderColor: '#b45309', color: '#fde68a' }}>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle size={16} /> Strategy Quota Warnings
          </div>
          {validationWarnings.map((w, idx) => (
            <p key={idx} className="text-xs leading-relaxed opacity-90">{w}</p>
          ))}
        </div>
      )}

      {/* Generated Plan Output Table */}
      {calendarEntries.length > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Generated Calendar Entries ({calendarEntries.length} Days)
              </h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Review and edit topic titles and main topic tags before saving to your master calendar.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={discardPlan}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/30 transition-all">
                <XCircle size={14} /> Discard Plan
              </button>

              <button onClick={saveCalendar} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow"
                style={{ background: saved ? '#064e3b' : '#0d2e22', border: '1px solid var(--success)', color: 'var(--success)' }}>
                {saving ? <Loader2 size={14} className="spinner" /> : <CheckCircle size={14} />}
                {saved ? '✓ Saved to Database!' : 'Save to Calendar'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border overflow-hidden shadow-xl"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <table className="w-full text-left text-xs">
              <thead className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
                <tr>
                  <th className="p-3.5">Date / Day</th>
                  <th className="p-3.5">Pillar</th>
                  <th className="p-3.5">Topic Covered</th>
                  <th className="p-3.5">Planned Topic Title</th>
                  <th className="p-3.5">Visual Suggestion</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {calendarEntries.map((entry, idx) => {
                  const topicsText = Array.isArray(entry.topics_covered) ? entry.topics_covered.join(', ') : (entry.topics_covered ?? '');
                  return (
                    <tr key={idx} className="hover:bg-white/2 transition-colors">
                      <td className="p-3.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                        <div className="font-bold" style={{ color: 'var(--text-primary)' }}>{entry.date}</div>
                        <div className="text-[10px]">{entry.day_name}</div>
                      </td>

                      {/* Pillar Column */}
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider"
                          style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                          {entry.post_type_name}
                        </span>
                      </td>

                      {/* Topic Covered Column */}
                      <td className="p-3.5 max-w-[180px]">
                        <div className="flex items-center gap-1">
                          <Tag size={12} className="text-purple-400 flex-shrink-0" />
                          <input
                            type="text"
                            value={topicsText}
                            onChange={e => updateTopics(idx, e.target.value)}
                            placeholder="e.g. LangChain, RAG"
                            className="w-full bg-transparent font-semibold text-[11px] p-1 rounded border border-transparent hover:border-gray-700 focus:border-purple-500 focus:bg-white/5 transition-all"
                            style={{ color: '#c084fc' }}
                          />
                        </div>
                      </td>

                      {/* Planned Topic Title */}
                      <td className="p-3.5">
                        <input
                          type="text"
                          value={entry.post_title}
                          onChange={e => updateEntry(idx, 'post_title', e.target.value)}
                          className="w-full bg-transparent font-medium p-1.5 rounded border border-transparent hover:border-gray-700 focus:border-purple-500 focus:bg-white/5 transition-all"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      </td>

                      {/* Visual Suggestion */}
                      <td className="p-3.5 italic" style={{ color: 'var(--text-muted)' }}>
                        {entry.visual_suggestion || '—'}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <button onClick={() => deleteEntry(idx)}
                          className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Note: Clicking <strong>Save to Calendar</strong> saves all entries to your master calendar database.
            </p>

            <div className="flex items-center gap-3">
              <button onClick={discardPlan}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/30 transition-all">
                <XCircle size={14} /> Discard Plan
              </button>

              <button onClick={saveCalendar} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow"
                style={{ background: saved ? '#064e3b' : '#0d2e22', border: '1px solid var(--success)', color: 'var(--success)' }}>
                {saving ? <Loader2 size={14} className="spinner" /> : <CheckCircle size={14} />}
                {saved ? '✓ Saved to Database!' : 'Save to Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
