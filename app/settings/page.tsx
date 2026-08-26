'use client';

import { useState, useCallback } from 'react';
import { useApp, PostType, AnatomySection } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import TagInput from '@/components/TagInput';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Settings, Plus, Pencil, Trash2, GripVertical, ChevronDown, Save, Loader2 } from 'lucide-react';

// ─── Post Type Modal ────────────────────────────────────────────────────────
function PostTypeModal({ existing, onClose, onSaved }: {
  existing?: PostType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show: showToast, ToastEl } = useToast();
  const [name, setName] = useState(existing?.name ?? '');
  const [coreFocus, setCoreFocus] = useState(existing?.core_focus ?? '');
  const [dos, setDos] = useState<string[]>(existing?.dos ?? []);
  const [donts, setDonts] = useState<string[]>(existing?.donts ?? []);
  const [dosError, setDosError] = useState('');
  const [dontsError, setDontsError] = useState('');
  const [nameError, setNameError] = useState('');
  const [coreFocusError, setCoreFocusError] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    let ok = true;
    if (!name.trim()) { setNameError('Name is required.'); ok = false; } else setNameError('');
    if (!coreFocus.trim()) { setCoreFocusError('Core Focus is mandatory — describe what this post type is for.'); ok = false; } else setCoreFocusError('');
    if (dos.length === 0) { setDosError('DOs are mandatory — add at least one item.'); ok = false; } else setDosError('');
    if (donts.length === 0) { setDontsError("DON'Ts are mandatory — add at least one item."); ok = false; } else setDontsError('');
    return ok;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = existing ? `/api/post-types/${existing.id}` : '/api/post-types';
      const method = existing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, core_focus: coreFocus, dos, donts })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Save failed.', 'error');
        return;
      }
      onSaved();
      onClose();
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={existing ? `Edit: ${existing.name}` : 'New Post Type'} onClose={onClose} width="max-w-xl">
      {ToastEl}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Post Type Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Value, Lead Magnet, Authority"
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none transition-colors"
            style={{ background: 'var(--bg-primary)', borderColor: nameError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.borderColor = nameError ? 'var(--danger)' : 'var(--accent)'; }}
            onBlur={e => { e.target.style.borderColor = nameError ? 'var(--danger)' : 'var(--border)'; }}
          />
          {nameError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{nameError}</p>}
        </div>

        {/* Core Focus — the key new field */}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Core Focus
            <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>— what is this post type fundamentally for?</span>
          </label>
          <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            This is the first thing Gemini reads. Describe the purpose, the reader outcome, and the strategic intent — not just rules.
          </p>
          <textarea
            value={coreFocus}
            onChange={e => setCoreFocus(e.target.value)}
            placeholder={`e.g. Educate the audience on one specific concept. The reader should finish knowing something actionable they didn't before. Pure knowledge transfer — no selling, no storytelling detour.`}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: coreFocusError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.borderColor = coreFocusError ? 'var(--danger)' : 'var(--accent)'; }}
            onBlur={e => { e.target.style.borderColor = coreFocusError ? 'var(--danger)' : 'var(--border)'; }}
          />
          {coreFocusError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{coreFocusError}</p>}
        </div>

        <TagInput
          label="DOs — what this post type should always do"
          tags={dos}
          onChange={setDos}
          placeholder="Type a rule and press Enter"
          accentColor="var(--success)"
          error={dosError}
        />

        <TagInput
          label="DON'Ts — what this post type must never do"
          tags={donts}
          onChange={setDonts}
          placeholder="Type a rule and press Enter"
          accentColor="#ef4444"
          error={dontsError}
        />

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? <><Loader2 size={14} className="spinner" /> Saving…</> : <><Save size={14} /> Save Post Type</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Anatomy Section Modal ─────────────────────────────────────────────────
function AnatomyModal({ existing, maxOrder, onClose, onSaved }: {
  existing?: AnatomySection;
  maxOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show: showToast, ToastEl } = useToast();
  const [sectionName, setSectionName] = useState(existing?.section_name ?? '');
  const [ruleDescription, setRuleDescription] = useState(existing?.rule_description ?? '');
  const [nameError, setNameError] = useState('');
  const [ruleError, setRuleError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let ok = true;
    if (!sectionName.trim()) { setNameError('Section name is required.'); ok = false; } else setNameError('');
    if (!ruleDescription.trim()) { setRuleError('Rule description is required.'); ok = false; } else setRuleError('');
    if (!ok) return;
    setSaving(true);
    try {
      const url = existing ? `/api/anatomy/${existing.id}` : '/api/anatomy';
      const method = existing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_name: sectionName, rule_description: ruleDescription, order_index: existing?.order_index ?? maxOrder + 1 })
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Save failed.', 'error'); return; }
      onSaved();
      onClose();
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={existing ? `Edit: ${existing.section_name}` : 'New Anatomy Section'} onClose={onClose}>
      {ToastEl}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Section Name</label>
          <input value={sectionName} onChange={e => setSectionName(e.target.value)} placeholder="e.g. Hook, Breakdown, CTA"
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none"
            style={{ background: 'var(--bg-primary)', borderColor: nameError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }} />
          {nameError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{nameError}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Generator Rule / Instructions</label>
          <textarea value={ruleDescription} onChange={e => setRuleDescription(e.target.value)}
            placeholder="Tell the AI exactly what to write in this section…"
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: ruleError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }} />
          {ruleError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{ruleError}</p>}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? <><Loader2 size={14} className="spinner" /> Saving…</> : <><Save size={14} /> Save Section</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────
export default function SettingsPage() {
  const { postTypes, anatomy, settings, refreshPostTypes, refreshAnatomy, refreshSettings } = useApp();
  const { show: showToast, ToastEl } = useToast();

  const [ptModal, setPtModal] = useState<{ open: boolean; existing?: PostType }>({ open: false });
  const [aModal, setAModal] = useState<{ open: boolean; existing?: AnatomySection }>({ open: false });
  const [deleting, setDeleting] = useState<string | null>(null);

  // Tone form state
  const [formality, setFormality] = useState<'casual' | 'professional' | 'mixed'>(settings?.tone_profile?.formality ?? 'mixed');
  const [sentenceLength, setSentenceLength] = useState<'short' | 'medium' | 'long'>(settings?.tone_profile?.sentenceLength ?? 'short');
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(settings?.tone_profile?.bannedPhrases ?? []);
  const [languageMix, setLanguageMix] = useState(settings?.tone_profile?.languageMix ?? '');
  const [savingTone, setSavingTone] = useState(false);
  const [anatomyScope, setAnatomyScope] = useState<'global' | 'per_post_type'>(settings?.anatomy_scope ?? 'global');

  // Sync tone state when settings load
  useState(() => {
    if (settings) {
      setFormality(settings.tone_profile?.formality ?? 'mixed');
      setSentenceLength(settings.tone_profile?.sentenceLength ?? 'short');
      setBannedPhrases(settings.tone_profile?.bannedPhrases ?? []);
      setLanguageMix(settings.tone_profile?.languageMix ?? '');
      setAnatomyScope(settings.anatomy_scope ?? 'global');
    }
  });

  const saveTone = async () => {
    setSavingTone(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: settings?.frequency ?? 'daily',
          anatomy_scope: anatomyScope,
          tone_profile: { formality, sentenceLength, bannedPhrases, languageMix }
        })
      });
      if (res.ok) { await refreshSettings(); showToast('Settings saved.', 'success'); }
      else { const d = await res.json(); showToast(d.error ?? 'Save failed.', 'error'); }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSavingTone(false);
    }
  };

  const deletePostType = async (id: string) => {
    if (!confirm('Delete this post type?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/post-types/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Delete failed.', 'error'); return; }
      await refreshPostTypes();
      showToast('Post type deleted.', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setDeleting(null);
    }
  };

  const deleteAnatomy = async (id: string) => {
    if (!confirm('Delete this anatomy section?')) return;
    const res = await fetch(`/api/anatomy/${id}`, { method: 'DELETE' });
    if (res.ok) { await refreshAnatomy(); showToast('Section deleted.', 'success'); }
    else showToast('Delete failed.', 'error');
  };

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(anatomy);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const reordered = items.map((item, i) => ({ id: item.id, order_index: i }));
    await fetch('/api/anatomy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reordered)
    });
    await refreshAnatomy();
  }, [anatomy, refreshAnatomy]);

  const sectionStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '24px',
    marginBottom: '20px',
  };

  const selectStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    cursor: 'pointer',
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {ToastEl}
      {ptModal.open && (
        <PostTypeModal
          existing={ptModal.existing}
          onClose={() => setPtModal({ open: false })}
          onSaved={refreshPostTypes}
        />
      )}
      {aModal.open && (
        <AnatomyModal
          existing={aModal.existing}
          maxOrder={anatomy.length}
          onClose={() => setAModal({ open: false })}
          onSaved={refreshAnatomy}
        />
      )}

      <div className="flex items-center gap-3 mb-8">
        <Settings size={20} style={{ color: 'var(--accent)' }} />
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* ── Post Types ──────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-base">Post Types</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Content pillars with their DOs and DON&apos;Ts. Both are mandatory.
            </p>
          </div>
          <button onClick={() => setPtModal({ open: true })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            <Plus size={14} /> New Type
          </button>
        </div>

        <div className="space-y-2">
          {postTypes.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No post types yet. Add one above.</p>
          )}
          {postTypes.map(pt => (
            <div key={pt.id} className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              {/* Card header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{pt.name}</span>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs" style={{ color: 'var(--success)' }}>✓ {pt.dos.length} DOs</span>
                    <span className="text-xs" style={{ color: '#ef4444' }}>✗ {pt.donts.length} DON&apos;Ts</span>
                    {pt.core_focus && (
                      <span className="text-xs" style={{ color: 'var(--accent)' }}>◈ Core Focus set</span>
                    )}
                  </div>
                </div>
                <button onClick={() => setPtModal({ open: true, existing: pt })}
                  className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                  <Pencil size={14} />
                </button>
                <button onClick={() => deletePostType(pt.id)} disabled={deleting === pt.id}
                  className="p-2 rounded-lg transition-colors hover:bg-red-900/20 disabled:opacity-40" style={{ color: '#ef4444' }}>
                  {deleting === pt.id ? <Loader2 size={14} className="spinner" /> : <Trash2 size={14} />}
                </button>
              </div>
              {/* Core Focus preview strip */}
              {pt.core_focus && (
                <div className="px-4 pb-3">
                  <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                    <span className="font-medium" style={{ color: 'var(--accent)' }}>Focus: </span>
                    {pt.core_focus}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Post Anatomy Builder ──────────────────────────── */}
      <div style={sectionStyle}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-base">Post Anatomy Builder</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Drag to reorder. Changes apply to the next generation immediately.</p>
          </div>
          <button onClick={() => setAModal({ open: true })}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
            <Plus size={14} /> Add Section
          </button>
        </div>

        {/* Anatomy scope toggle */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div className="flex-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Anatomy Scope</span>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Global = same sections for all post types. Per-type = sections linked to a specific post type.</p>
          </div>
          <select value={anatomyScope} onChange={e => setAnatomyScope(e.target.value as 'global' | 'per_post_type')} style={selectStyle}>
            <option value="global">Global (all types)</option>
            <option value="per_post_type">Per Post Type</option>
          </select>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="anatomy">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {anatomy.length === 0 && (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No sections yet. Add one above.</p>
                )}
                {anatomy.map((section, index) => (
                  <Draggable key={section.id} draggableId={section.id} index={index}>
                    {(provided, snapshot) => (
                      <div ref={provided.innerRef} {...provided.draggableProps}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                        style={{
                          background: snapshot.isDragging ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                          border: `1px solid ${snapshot.isDragging ? 'var(--accent)' : 'var(--border)'}`,
                          boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                          ...provided.draggableProps.style,
                        }}>
                        <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing" style={{ color: 'var(--text-muted)' }}>
                          <GripVertical size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)44' }}>
                              {index + 1}
                            </span>
                            <span className="font-medium text-sm">{section.section_name}</span>
                          </div>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{section.rule_description}</p>
                        </div>
                        <button onClick={() => setAModal({ open: true, existing: section })}
                          className="p-2 rounded-lg transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteAnatomy(section.id)}
                          className="p-2 rounded-lg transition-colors hover:bg-red-900/20" style={{ color: '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* ── Tone & Voice Profile ──────────────────────────── */}
      <div style={sectionStyle}>
        <h2 className="font-semibold text-base mb-1">Tone &amp; Voice Profile</h2>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Applied to every generation call regardless of pillar.</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Formality</label>
            <div className="relative">
              <select value={formality} onChange={e => setFormality(e.target.value as typeof formality)}
                className="w-full appearance-none pr-8" style={{ ...selectStyle, width: '100%' }}>
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="mixed">Mixed</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Sentence Length</label>
            <div className="relative">
              <select value={sentenceLength} onChange={e => setSentenceLength(e.target.value as typeof sentenceLength)}
                className="w-full appearance-none pr-8" style={{ ...selectStyle, width: '100%' }}>
                <option value="short">Short &amp; punchy</option>
                <option value="medium">Medium</option>
                <option value="long">Long &amp; detailed</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Language Mix</label>
          <textarea value={languageMix} onChange={e => setLanguageMix(e.target.value)}
            placeholder="e.g. Roman Urdu/English casual for hooks and personal posts, English for technical explanations"
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none focus:outline-none"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
        </div>

        <div className="mb-5">
          <TagInput
            label="Banned Phrases — never use these in any post"
            tags={bannedPhrases}
            onChange={setBannedPhrases}
            placeholder="Type a phrase and press Enter"
            accentColor="#ef4444"
          />
        </div>

        <button onClick={saveTone} disabled={savingTone}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'white' }}>
          {savingTone ? <><Loader2 size={14} className="spinner" /> Saving…</> : <><Save size={14} /> Save Tone Profile &amp; Scope</>}
        </button>
      </div>
    </div>
  );
}
