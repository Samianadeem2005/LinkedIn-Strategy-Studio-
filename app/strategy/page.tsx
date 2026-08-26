'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import { LayoutGrid, Save, Loader2, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle, ChevronDown, Calendar } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

interface ValidationWarning {
  message: string;
}

export default function StrategyPage() {
  const { postTypes, weeklyMapping, refreshWeeklyMapping } = useApp();
  const { show: showToast, ToastEl } = useToast();
  const [activeTab, setActiveTab] = useState<'weekly' | 'calendar'>('weekly');

  // ── Tab A state ────────────────────────────────────────────────
  const [mappings, setMappings] = useState<Record<string, { post_type_id: string; series_length: number; is_continuation_of: string }>>({});
  const [savingWeekly, setSavingWeekly] = useState(false);

  useEffect(() => {
    const init: typeof mappings = {};
    for (const day of DAYS) {
      const found = weeklyMapping.find(m => m.day_of_week === day);
      init[day] = {
        post_type_id: found?.post_type_id ?? '',
        series_length: found?.series_length ?? 1,
        is_continuation_of: found?.is_continuation_of ?? '',
      };
    }
    setMappings(init);
  }, [weeklyMapping]);

  const saveWeekly = async () => {
    setSavingWeekly(true);
    try {
      const payload = DAYS.map(day => ({
        day_of_week: day,
        post_type_id: mappings[day]?.post_type_id || null,
        series_length: mappings[day]?.series_length ?? 1,
        is_continuation_of: mappings[day]?.is_continuation_of || null,
      }));
      const res = await fetch('/api/weekly-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) { await refreshWeeklyMapping(); showToast('Weekly template saved.', 'success'); }
      else { const d = await res.json(); showToast(d.error ?? 'Save failed.', 'error'); }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSavingWeekly(false);
    }
  };

  // ── Tab B state ────────────────────────────────────────────────
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
  const [editingRow, setEditingRow] = useState<number | null>(null);

  const [phaseASchedule, setPhaseASchedule] = useState<{ day_of_week: string; post_type_name: string }[]>([]);

  const effectiveDuration = durationDays === 0 ? (parseInt(customDays) || 14) : durationDays;

  const generateCalendar = async () => {
    if (!rawDump.trim()) { showToast('Paste some raw content first.', 'error'); return; }
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
      if (!res.ok) { showToast(data.error ?? 'Generation failed.', 'error'); return; }
      setCalendarEntries(data.entries);
      setPhaseASchedule(data.phaseASchedule ?? []);
      setValidationWarnings(data.validationWarnings ?? []);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setGenerating(false);
    }
  };

  const regenerateRow = async (index: number) => {
    // Regenerate single row: re-run generation for 1 day with the same dump
    showToast('Row regeneration coming soon — edit the cell directly for now.', 'info');
  };

  const updateEntry = (index: number, field: keyof CalendarEntry, value: unknown) => {
    setCalendarEntries(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
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
      if (!res.ok) { showToast(data.error ?? 'Save failed.', 'error'); return; }
      setSaved(true);
      showToast(`Calendar saved — ${data.saved} entries added.`, 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
  };

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent-glow)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {ToastEl}

      <div className="flex items-center gap-3 mb-6">
        <LayoutGrid size={20} style={{ color: 'var(--accent)' }} />
        <h1 className="text-xl font-semibold">Strategy</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <button style={tabStyle(activeTab === 'weekly')} onClick={() => setActiveTab('weekly')}>
          📆 Weekly Template
        </button>
        <button style={tabStyle(activeTab === 'calendar')} onClick={() => setActiveTab('calendar')}>
          📅 Calendar Maker
        </button>
      </div>

      {/* ── Tab A: Weekly Template ───────────────────────── */}
      {activeTab === 'weekly' && (
        <div>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Fallback schedule — used when no Calendar Maker entry exists for a given date.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {DAYS.map(day => {
              const m = mappings[day] ?? { post_type_id: '', series_length: 1, is_continuation_of: '' };
              return (
                <div key={day} className="flex items-center gap-4 px-5 py-4 rounded-xl"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="w-24 flex-shrink-0">
                    <span className="font-medium text-sm">{day}</span>
                  </div>
                  <div className="flex-1">
                    <div className="relative">
                      <select
                        value={m.post_type_id}
                        onChange={e => setMappings(prev => ({ ...prev, [day]: { ...prev[day], post_type_id: e.target.value } }))}
                        className="w-full appearance-none"
                        style={selectStyle}>
                        <option value="">— None —</option>
                        {postTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                      </select>
                      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Series:</span>
                    <input
                      type="number" min={1} max={10}
                      value={m.series_length}
                      onChange={e => setMappings(prev => ({ ...prev, [day]: { ...prev[day], series_length: parseInt(e.target.value) || 1 } }))}
                      className="w-14 text-center text-sm rounded-lg px-2 py-1.5"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  {m.post_type_id && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)' }}>
                      <span className="text-xs" style={{ color: 'var(--accent)' }}>✓</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={saveWeekly} disabled={savingWeekly}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
              style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 16px var(--accent-glow)' }}>
              {savingWeekly ? <><Loader2 size={14} className="spinner" /> Saving…</> : <><Save size={14} /> Save Weekly Template</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab B: Calendar Maker ────────────────────────── */}
      {activeTab === 'calendar' && (
        <div>
          {/* Input section */}
          <div className="rounded-xl border p-5 mb-5"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <h3 className="font-semibold text-sm mb-4">1. Paste Raw Content</h3>
            <textarea
              value={rawDump}
              onChange={e => setRawDump(e.target.value)}
              placeholder="Paste topics, study logs, article summaries, code notes — anything. The more context, the better the calendar.&#10;&#10;Example:&#10;- Learned about LangChain chains and how they work&#10;- Built a LangGraph state machine for NETSOL chatbot&#10;- Read Karpathy's essay on agents&#10;- Finished Text-to-SQL pipeline"
              rows={8}
              className="w-full px-4 py-3 rounded-xl border text-sm resize-none focus:outline-none"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
            <div className="flex items-center gap-5 mt-4 flex-wrap">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Duration</label>
                <div className="flex gap-2">
                  {[7, 14, 30].map(d => (
                    <button key={d}
                      onClick={() => { setDurationDays(d); setCustomDays(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: durationDays === d ? 'var(--accent)' : 'var(--bg-elevated)',
                        color: durationDays === d ? 'white' : 'var(--text-secondary)',
                        border: `1px solid ${durationDays === d ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                      {d} days
                    </button>
                  ))}
                  <input
                    type="number" min={1} max={90} placeholder="Custom"
                    value={customDays}
                    onChange={e => { setCustomDays(e.target.value); setDurationDays(0); }}
                    className="w-20 px-2 py-1.5 rounded-lg text-xs text-center"
                    style={{ background: 'var(--bg-elevated)', border: `1px solid ${durationDays === 0 && customDays ? 'var(--accent)' : 'var(--border)'}`, color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="mt-4">
              <button onClick={generateCalendar} disabled={generating || !rawDump.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)', color: 'white', boxShadow: '0 4px 16px var(--accent-glow)' }}>
                {generating ? <><Loader2 size={14} className="spinner" /> Generating {effectiveDuration}-day calendar…</>
                  : <><Calendar size={14} /> Generate {effectiveDuration}-Day Calendar</>}
              </button>
            </div>
          </div>

          {/* Phase A Schedule Preview */}
          {phaseASchedule.length > 0 && calendarEntries.length > 0 && (
            <div className="mb-5 p-4 rounded-xl border animate-fade-in"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                  Phase A — Locked Weekly Type Schedule (2 Lead Magnet, 2 Value, 2 Authority, 1 Personal)
                </span>
                <span className="text-xs text-muted font-normal">
                  Matches Recurring Weekly Template
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-xs">
                {phaseASchedule.map(item => (
                  <div key={item.day_of_week} className="p-2 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div className="font-medium text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.day_of_week.slice(0, 3)}</div>
                    <div className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>{item.post_type_name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation warnings */}
          {validationWarnings.length > 0 && (
            <div className="mb-4 p-4 rounded-xl border animate-fade-in"
              style={{ background: '#2e1f0d', borderColor: '#f59e0b55' }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--warning)' }}>
                  {validationWarnings.length} validation {validationWarnings.length === 1 ? 'issue' : 'issues'} found
                </span>
              </div>
              <ul className="space-y-1">
                {validationWarnings.map((w, i) => (
                  <li key={i} className="text-xs" style={{ color: '#d97706' }}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Calendar table */}
          {calendarEntries.length > 0 && (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{calendarEntries.length}-Day Content Calendar</h3>
                <div className="flex gap-2">
                  {saved && (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#0d2e22', color: 'var(--success)', border: '1px solid var(--success)' }}>
                      <CheckCircle size={12} /> Saved to Calendar
                    </span>
                  )}
                  <button onClick={saveCalendar} disabled={saving || saved}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-40 transition-all"
                    style={{ background: 'var(--success)', color: '#0a0a0f', fontWeight: 600 }}>
                    {saving ? <><Loader2 size={12} className="spinner" /> Saving…</> : <><Save size={12} /> Save Calendar</>}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                        {['Day', 'Type', 'Post', 'Topic(s)', 'Visual', 'Auth?', ''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {calendarEntries.map((entry, i) => (
                        <tr key={i} className="border-b transition-colors hover:bg-white/2"
                          style={{ borderColor: 'var(--border-subtle)' }}>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{entry.day_name}</div>
                            <div>{entry.date}</div>
                          </td>
                          <td className="px-3 py-2">
                            <select value={entry.post_type_id}
                              onChange={e => updateEntry(i, 'post_type_id', e.target.value)}
                              className="text-xs rounded-lg px-2 py-1"
                              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
                              {postTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2" style={{ minWidth: 200 }}>
                            <textarea
                              value={entry.post_title}
                              onChange={e => updateEntry(i, 'post_title', e.target.value)}
                              rows={2}
                              className="w-full bg-transparent resize-none focus:outline-none text-xs"
                              style={{ color: 'var(--text-primary)' }}
                            />
                          </td>
                          <td className="px-3 py-2" style={{ minWidth: 140 }}>
                            <div style={{ color: 'var(--text-secondary)' }}>
                              {Array.isArray(entry.topics_covered) ? entry.topics_covered.join(', ') : entry.topics_covered}
                            </div>
                          </td>
                          <td className="px-3 py-2" style={{ minWidth: 220 }}>
                            <textarea
                              value={entry.visual_suggestion || ''}
                              onChange={e => updateEntry(i, 'visual_suggestion', e.target.value)}
                              rows={2}
                              placeholder="Visual recommendation..."
                              className="w-full bg-transparent resize-none focus:outline-none text-xs leading-relaxed"
                              style={{ color: 'var(--text-secondary)' }}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input type="checkbox"
                              checked={!!entry.is_authority_borrow}
                              onChange={e => updateEntry(i, 'is_authority_borrow', e.target.checked)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1">
                              <button onClick={() => regenerateRow(i)} title="Regenerate row"
                                className="p-1 rounded hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                                <RefreshCw size={11} />
                              </button>
                              <button onClick={() => deleteEntry(i)} title="Delete row"
                                className="p-1 rounded hover:bg-red-900/20" style={{ color: '#ef4444' }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add row */}
              <button
                onClick={() => {
                  const last = calendarEntries[calendarEntries.length - 1];
                  const nextDate = new Date(last?.date ?? startDate);
                  nextDate.setDate(nextDate.getDate() + 1);
                  const newEntry: CalendarEntry = {
                    day_index: (last?.day_index ?? 0) + 1,
                    date: nextDate.toISOString().split('T')[0],
                    day_name: nextDate.toLocaleDateString('en-US', { weekday: 'long' }),
                    post_type_id: postTypes[0]?.id ?? '',
                    post_type_name: postTypes[0]?.name ?? '',
                    post_title: '',
                    topics_covered: [],
                    bridge_logic: '',
                    visual_suggestion: '',
                    is_authority_borrow: false,
                  };
                  setCalendarEntries(prev => [...prev, newEntry]);
                }}
                className="mt-2 w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                <Plus size={12} /> Add Row
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
