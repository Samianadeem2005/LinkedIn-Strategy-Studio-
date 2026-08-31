'use client';

import { useState, useCallback, useEffect } from 'react';
import { useApp, PostType, AnatomySection } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import TagInput from '@/components/TagInput';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Settings, Plus, Pencil, Trash2, GripVertical, ChevronDown, Save, Loader2, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

export interface WritingMechanic {
  id: string;
  rule_name: string;
  description: string;
  prompt_directive: string;
  enabled: number;
  order_index: number;
}

// ── Post Type Modal ────────────────────────────────────────────────────────
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
    if (!coreFocus.trim()) { setCoreFocusError('Core Focus is mandatory - describe what this post type is for.'); ok = false; } else setCoreFocusError('');
    if (dos.length === 0) { setDosError('DOs are mandatory - add at least one item.'); ok = false; } else setDosError('');
    if (donts.length === 0) { setDontsError("DON'Ts are mandatory - add at least one item."); ok = false; } else setDontsError('');
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

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Core Focus
            <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>- what is this post type fundamentally for?</span>
          </label>
          <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            This is the first thing Gemini reads. Describe the purpose, the reader outcome, and the strategic intent - not just rules.
          </p>
          <textarea
            value={coreFocus}
            onChange={e => setCoreFocus(e.target.value)}
            placeholder={`e.g. Educate the audience on one specific concept. The reader should finish knowing something actionable they didn't before. Pure knowledge transfer - no selling, no storytelling detour.`}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: coreFocusError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.borderColor = coreFocusError ? 'var(--danger)' : 'var(--accent)'; }}
            onBlur={e => { e.target.style.borderColor = coreFocusError ? 'var(--danger)' : 'var(--border)'; }}
          />
          {coreFocusError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{coreFocusError}</p>}
        </div>

        <TagInput
          label="DOs - what this post type should always do"
          tags={dos}
          onChange={setDos}
          placeholder="Type a rule and press Enter"
          accentColor="var(--success)"
          error={dosError}
        />

        <TagInput
          label="DON'Ts - what this post type must never do"
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
            {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Post Type</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Anatomy Section Modal ──────────────────────────────────────────────────
function AnatomyModal({ existing, maxOrder, targetPostTypeId, onClose, onSaved }: {
  existing?: AnatomySection;
  maxOrder: number;
  targetPostTypeId?: string | null;
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
        body: JSON.stringify({
          section_name: sectionName,
          rule_description: ruleDescription,
          order_index: existing?.order_index ?? maxOrder + 1,
          applies_to_post_type_id: existing ? existing.applies_to_post_type_id : (targetPostTypeId ?? null)
        })
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
            placeholder="Tell the AI exactly what to write in this section..."
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
            {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Section</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Writing Mechanics Modal ────────────────────────────────────────────────
function WritingMechanicsModal({ existing, maxOrder, onClose, onSaved }: {
  existing?: WritingMechanic;
  maxOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show: showToast, ToastEl } = useToast();
  const [ruleName, setRuleName] = useState(existing?.rule_name ?? '');
  const [description, setDescription] = useState(existing?.description ?? existing?.prompt_directive ?? '');
  const [enabled, setEnabled] = useState<boolean>(existing ? existing.enabled === 1 : true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!ruleName.trim() || !description.trim()) {
      showToast('Rule name and description are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const url = existing ? `/api/writing-mechanics/${existing.id}` : '/api/writing-mechanics';
      const method = existing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_name: ruleName,
          description,
          prompt_directive: description,
          enabled: enabled ? 1 : 0,
          order_index: existing?.order_index ?? maxOrder + 1
        })
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
    <Modal title={existing ? `Edit Mechanic: ${existing.rule_name}` : 'New Writing Mechanic'} onClose={onClose}>
      {ToastEl}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Rule Name</label>
          <input
            value={ruleName}
            onChange={e => setRuleName(e.target.value)}
            placeholder="e.g. One-Sentence Paragraph Rule"
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Rule Instruction (Sent to Gemini AI)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Stagger line lengths unevenly down the screen to create a visual 'wave' that dynamically guides the reader's eye down the post."
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="mech-enabled"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="rounded accent-purple-600"
          />
          <label htmlFor="mech-enabled" className="text-xs font-medium cursor-pointer" style={{ color: 'var(--text-primary)' }}>
            Enable this rule in generation prompts
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Mechanic</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Settings Page ─────────────────────────────────────────────────────
export default function SettingsPage() {
  const { postTypes, anatomy, settings, refreshPostTypes, refreshAnatomy, refreshSettings } = useApp();
  const { show: showToast, ToastEl } = useToast();

  const [activeTab, setActiveTab] = useState<'about' | 'pillars' | 'anatomy' | 'tone' | 'mechanics'>('about');
  const [ptModal, setPtModal] = useState<{ open: boolean; existing?: PostType }>({ open: false });
  const [aModal, setAModal] = useState<{ open: boolean; existing?: AnatomySection; targetPostTypeId?: string | null }>({ open: false });
  const [wmModal, setWmModal] = useState<{ open: boolean; existing?: WritingMechanic }>({ open: false });
  
  const [writingMechanics, setWritingMechanics] = useState<WritingMechanic[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedAnatomyTab, setSelectedAnatomyTab] = useState<string>('default');
  const [customizing, setCustomizing] = useState(false);
  const [reverting, setReverting] = useState(false);

  // About Me context state
  const [aboutMe, setAboutMe] = useState(settings?.about_me ?? '');
  const [savingAboutMe, setSavingAboutMe] = useState(false);

  // Sync settings on load
  useEffect(() => {
    if (settings?.about_me) setAboutMe(settings.about_me);
    if (settings?.anatomy_scope) setAnatomyScope(settings.anatomy_scope);
    if (settings?.tone_profile) {
      setFormality(settings.tone_profile.formality ?? '');
      setSentenceLength(settings.tone_profile.sentenceLength ?? 'short');
      setBannedPhrases(settings.tone_profile.bannedPhrases ?? []);
      setLanguageMix(settings.tone_profile.languageMix ?? 'English');
    }
  }, [settings?.about_me, settings?.anatomy_scope, settings?.tone_profile]);

  // Tone form state
  const [formality, setFormality] = useState<string>(settings?.tone_profile?.formality ?? '');
  const [sentenceLength, setSentenceLength] = useState<'short' | 'medium' | 'long'>(settings?.tone_profile?.sentenceLength ?? 'short');
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(settings?.tone_profile?.bannedPhrases ?? []);
  const [languageMix, setLanguageMix] = useState<string>(settings?.tone_profile?.languageMix ?? 'English');
  const [savingTone, setSavingTone] = useState(false);
  const [anatomyScope, setAnatomyScope] = useState<'global' | 'per_post_type'>(settings?.anatomy_scope ?? 'global');

  const changeAnatomyScope = async (newScope: 'global' | 'per_post_type') => {
    setAnatomyScope(newScope);
    if (newScope === 'per_post_type') {
      setSelectedAnatomyTab('default');
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: settings?.frequency ?? 'daily',
          anatomy_scope: newScope,
          tone_profile: { formality, sentenceLength, bannedPhrases, languageMix },
          about_me: aboutMe
        })
      });
      if (res.ok) {
        await refreshSettings();
        showToast(`Anatomy scope updated to ${newScope === 'global' ? 'Global (all types)' : 'Per Post Type'}.`, 'success');
      }
    } catch (e) {
      showToast(String(e), 'error');
    }
  };

  const customizePostType = async (postTypeId: string) => {
    setCustomizing(true);
    try {
      const res = await fetch('/api/anatomy/customize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_type_id: postTypeId })
      });
      if (res.ok) {
        await refreshAnatomy();
        showToast('Custom anatomy created for this post type.', 'success');
      } else {
        const d = await res.json();
        showToast(d.error ?? 'Failed to customize anatomy.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setCustomizing(false);
    }
  };

  const revertPostType = async (postTypeId: string) => {
    if (!confirm('Revert to Default? All custom sections for this post type will be deleted.')) return;
    setReverting(true);
    try {
      const res = await fetch('/api/anatomy/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_type_id: postTypeId })
      });
      if (res.ok) {
        await refreshAnatomy();
        showToast('Reverted to Default anatomy.', 'success');
      } else {
        const d = await res.json();
        showToast(d.error ?? 'Failed to revert anatomy.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setReverting(false);
    }
  };

  const fetchMechanics = useCallback(async () => {
    try {
      const res = await fetch('/api/writing-mechanics');
      if (res.ok) setWritingMechanics(await res.json());
    } catch { /* fall through */ }
  }, []);

  const { refreshAll } = useApp();

  useEffect(() => {
    refreshAll();
    fetchMechanics();

    const handleStrategyUpdated = () => {
      refreshAll();
      fetchMechanics();
    };

    window.addEventListener('strategy_updated', handleStrategyUpdated);
    return () => window.removeEventListener('strategy_updated', handleStrategyUpdated);
  }, [fetchMechanics, refreshAll]);

  const saveAboutMe = async () => {
    setSavingAboutMe(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: settings?.frequency ?? 'daily',
          anatomy_scope: anatomyScope,
          tone_profile: { formality, sentenceLength, bannedPhrases, languageMix },
          about_me: aboutMe
        })
      });
      if (res.ok) {
        await refreshSettings();
        showToast('About Me / Brand Context saved successfully.', 'success');
      } else {
        const d = await res.json();
        showToast(d.error ?? 'Save failed.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSavingAboutMe(false);
    }
  };

  const saveTone = async () => {
    setSavingTone(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: settings?.frequency ?? 'daily',
          anatomy_scope: anatomyScope,
          tone_profile: { formality, sentenceLength, bannedPhrases, languageMix },
          about_me: aboutMe
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

  const deleteMechanic = async (id: string) => {
    if (!confirm('Delete this writing mechanic rule?')) return;
    const res = await fetch(`/api/writing-mechanics/${id}`, { method: 'DELETE' });
    if (res.ok) { await fetchMechanics(); showToast('Rule deleted.', 'success'); }
    else showToast('Delete failed.', 'error');
  };

  const toggleMechanic = async (mechanic: WritingMechanic) => {
    const newEnabled = mechanic.enabled === 1 ? 0 : 1;
    setWritingMechanics(prev => prev.map(m => m.id === mechanic.id ? { ...m, enabled: newEnabled } : m));
    await fetch(`/api/writing-mechanics/${mechanic.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newEnabled })
    });
  };

  const onDragEndAnatomy = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const isPerType = anatomyScope === 'per_post_type';
    const targetTypeId = isPerType && selectedAnatomyTab !== 'default' ? selectedAnatomyTab : null;
    const currentList = anatomy.filter(a =>
      targetTypeId ? a.applies_to_post_type_id === targetTypeId : !a.applies_to_post_type_id
    );

    const items = Array.from(currentList);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);

    const reordered = items.map((item, i) => ({ id: item.id, order_index: i + 1 }));

    await fetch('/api/anatomy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reordered)
    });
    await refreshAnatomy();
  }, [anatomy, anatomyScope, selectedAnatomyTab, refreshAnatomy]);

  const onDragEndMechanics = useCallback(async (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(writingMechanics);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const reordered = items.map((item, i) => ({ ...item, order_index: i }));
    setWritingMechanics(reordered);
    await fetch('/api/writing-mechanics', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reordered.map((item, i) => ({ id: item.id, order_index: i })))
    });
  }, [writingMechanics]);

  const selectStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    cursor: 'pointer',
  };

  const tabs = [
    { id: 'about' as const, label: 'About Me', icon: 'M' },
    { id: 'pillars' as const, label: 'Post Pillars', icon: 'P' },
    { id: 'anatomy' as const, label: 'Post Anatomy', icon: 'A' },
    { id: 'tone'    as const, label: 'Tone & Voice', icon: 'T' },
    { id: 'mechanics' as const, label: 'Writing Mechanics', icon: 'W' },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
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
          targetPostTypeId={aModal.targetPostTypeId}
          maxOrder={
            (anatomyScope === 'per_post_type' && selectedAnatomyTab !== 'default')
              ? anatomy.filter(a => a.applies_to_post_type_id === selectedAnatomyTab).length
              : anatomy.filter(a => !a.applies_to_post_type_id).length
          }
          onClose={() => setAModal({ open: false })}
          onSaved={refreshAnatomy}
        />
      )}
      {wmModal.open && (
        <WritingMechanicsModal
          existing={wmModal.existing}
          maxOrder={writingMechanics.length}
          onClose={() => setWmModal({ open: false })}
          onSaved={fetchMechanics}
        />
      )}

      {/* Page Header */}
      <div className="flex-shrink-0 border-b px-6 py-4"
        style={{ background: 'rgba(10,10,15,0.9)', borderColor: 'var(--border)', backdropFilter: 'blur(8px)' }}>
        <div className="flex items-center gap-3">
          <Settings size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="font-semibold text-base">Settings</h1>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b px-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
        <div className="flex gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2"
              style={{
                borderColor: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                background: 'transparent',
              }}
            >
              <span className="text-xs font-bold">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">

          {/* TAB 0: About Me / Context */}
          {activeTab === 'about' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="font-semibold text-base">About Me / Brand Context</h2>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    This background context is directly injected into Gemini AI prompts under <span className="font-mono text-purple-400 font-semibold">CONTEXT ABOUT ME</span>.
                    Whenever you update this section, all future calendar generation and post creation will automatically use your latest context.
                  </p>
                </div>
              </div>

              <div className="mt-5 mb-6">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Your Professional Bio &amp; Proof-of-Work Context
                </label>
                <textarea
                  value={aboutMe}
                  onChange={e => setAboutMe(e.target.value)}
                  rows={8}
                  placeholder="e.g. I am an AI Engineer (Software Engineering student, class of 2027) building in public..."
                  className="w-full px-4 py-3 rounded-xl border text-sm leading-relaxed focus:outline-none resize-y"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit'
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; }}
                />
              </div>

              <button
                onClick={saveAboutMe}
                disabled={savingAboutMe}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                {savingAboutMe ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save About Me Context</>}
              </button>
            </div>
          )}

          {/* TAB 1: Post Pillars */}
          {activeTab === 'pillars' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-semibold text-base">Post Pillar Types</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Content pillars with their DOs and DON&apos;Ts. Both are mandatory.
                  </p>
                </div>
                <button onClick={() => setPtModal({ open: true })}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  <Plus size={14} /> New Pillar
                </button>
              </div>

              <div className="space-y-3">
                {postTypes.length === 0 && (
                  <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>No post types yet. Add one above.</p>
                )}
                {postTypes.map(pt => (
                  <div key={pt.id} className="rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{pt.name}</span>
                        <div className="flex gap-3 mt-1">
                          <span className="text-xs" style={{ color: 'var(--success)' }}>+ {pt.dos.length} DOs</span>
                          <span className="text-xs" style={{ color: '#ef4444' }}>x {pt.donts.length} DON&apos;Ts</span>
                          {pt.core_focus && (
                            <span className="text-xs" style={{ color: 'var(--accent)' }}>* Core Focus set</span>
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
          )}

          {/* TAB 2: Post Anatomy */}
          {activeTab === 'anatomy' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-base">Post Anatomy Builder</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Configure section structure and instructions for Gemini AI generation.
                  </p>
                </div>
                {(anatomyScope === 'global' || selectedAnatomyTab === 'default' || anatomy.some(a => a.applies_to_post_type_id === selectedAnatomyTab)) && (
                  <button
                    onClick={() => setAModal({
                      open: true,
                      targetPostTypeId: (anatomyScope === 'per_post_type' && selectedAnatomyTab !== 'default') ? selectedAnatomyTab : null
                    })}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
                  >
                    <Plus size={14} /> Add Section
                  </button>
                )}
              </div>

              {/* Scope Dropdown */}
              <div className="flex items-center gap-3 mb-5 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="flex-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Anatomy Scope</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Global = same sections for all post types. Per Post Type = custom anatomy rules per post type with default fallback.
                  </p>
                </div>
                <select
                  value={anatomyScope}
                  onChange={e => changeAnatomyScope(e.target.value as 'global' | 'per_post_type')}
                  style={selectStyle}
                >
                  <option value="global">Global (all types)</option>
                  <option value="per_post_type">Per Post Type</option>
                </select>
              </div>

              {/* Per Post Type Secondary Pills Row */}
              {anatomyScope === 'per_post_type' && (
                <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 border-b" style={{ borderColor: 'var(--border)' }}>
                  {/* Default Tab Pill */}
                  <button
                    onClick={() => setSelectedAnatomyTab('default')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: selectedAnatomyTab === 'default' ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: selectedAnatomyTab === 'default' ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${selectedAnatomyTab === 'default' ? 'var(--accent)' : 'var(--border)'}`
                    }}
                  >
                    <span>Default</span>
                    <span className="text-[10px] opacity-75 font-mono">({anatomy.filter(a => !a.applies_to_post_type_id).length})</span>
                  </button>

                  {/* Post Type Tab Pills */}
                  {postTypes.map(pt => {
                    const isCustom = anatomy.some(a => a.applies_to_post_type_id === pt.id);
                    const isActive = selectedAnatomyTab === pt.id;
                    const customCount = anatomy.filter(a => a.applies_to_post_type_id === pt.id).length;

                    return (
                      <button
                        key={pt.id}
                        onClick={() => setSelectedAnatomyTab(pt.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
                        style={{
                          background: isActive ? 'var(--accent)' : 'var(--bg-elevated)',
                          color: isActive ? 'white' : 'var(--text-secondary)',
                          border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`
                        }}
                      >
                        <span>{pt.name}</span>
                        {isCustom ? (
                          <span
                            className="px-1.5 py-0.2 text-[9px] font-bold rounded uppercase tracking-wider"
                            style={{
                              background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(168, 85, 247, 0.2)',
                              color: isActive ? 'white' : '#c084fc',
                              border: isActive ? 'none' : '1px solid rgba(168, 85, 247, 0.4)'
                            }}
                          >
                            Custom ({customCount})
                          </span>
                        ) : (
                          <span className="text-[10px] opacity-60">(Default)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* SECTION LIST DISPLAY */}
              {(() => {
                const isPerType = anatomyScope === 'per_post_type';
                const activeTabId = isPerType ? selectedAnatomyTab : 'default';
                const isDefaultTab = activeTabId === 'default';

                if (isPerType && !isDefaultTab) {
                  const targetPt = postTypes.find(p => p.id === activeTabId);
                  const customSections = anatomy.filter(a => a.applies_to_post_type_id === activeTabId);
                  const isCustomized = customSections.length > 0;
                  const defaultSections = anatomy.filter(a => !a.applies_to_post_type_id);

                  if (!isCustomized) {
                    return (
                      <div className="space-y-4">
                        <div
                          className="p-4 rounded-xl border flex items-center justify-between gap-4"
                          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                        >
                          <div>
                            <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                              Using Default Anatomy for {targetPt?.name ?? 'this post type'}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              Currently using Default anatomy. Click Customize to override for this type only.
                            </p>
                          </div>
                          <button
                            onClick={() => customizePostType(activeTabId)}
                            disabled={customizing}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)', color: 'white' }}
                          >
                            {customizing ? (
                              <><Loader2 size={13} className="spinner" /> Customizing...</>
                            ) : (
                              <><Sparkles size={13} /> Customize This Type</>
                            )}
                          </button>
                        </div>

                        <div className="space-y-2 opacity-60">
                          <p className="text-[11px] font-semibold uppercase tracking-wider px-1" style={{ color: 'var(--text-muted)' }}>
                            Default Anatomy Preview (Read-Only)
                          </p>
                          {defaultSections.length === 0 && (
                            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No default anatomy sections defined.</p>
                          )}
                          {defaultSections.map((section, index) => (
                            <div
                              key={section.id}
                              className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                            >
                              <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>{section.section_name}</span>
                                <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{section.rule_description}</p>
                              </div>
                              <span className="text-[10px] italic px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                Following Default
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div
                        className="p-4 rounded-xl border flex items-center justify-between gap-4"
                        style={{ background: 'rgba(168, 85, 247, 0.08)', borderColor: 'rgba(168, 85, 247, 0.3)' }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="px-2 py-0.5 text-xs font-bold rounded flex-shrink-0"
                            style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}
                          >
                            Customized
                          </span>
                          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                            Independent anatomy override active for <strong>{targetPt?.name}</strong>.
                          </p>
                        </div>
                        <button
                          onClick={() => revertPostType(activeTabId)}
                          disabled={reverting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-red-900/20 disabled:opacity-50 flex-shrink-0"
                          style={{ border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                        >
                          {reverting ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
                          Revert to Default
                        </button>
                      </div>

                      <DragDropContext onDragEnd={onDragEndAnatomy}>
                        <Droppable droppableId={`anatomy_${activeTabId}`}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                              {customSections.map((section, index) => (
                                <Draggable key={section.id} draggableId={section.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                                      style={{
                                        background: snapshot.isDragging ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                                        border: `1px solid ${snapshot.isDragging ? 'var(--accent)' : 'var(--border)'}`,
                                        boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                                        ...provided.draggableProps.style,
                                      }}
                                    >
                                      <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing" style={{ color: 'var(--text-muted)' }}>
                                        <GripVertical size={14} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="text-xs font-semibold px-2 py-0.5 rounded"
                                            style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)44' }}
                                          >
                                            {index + 1}
                                          </span>
                                          <span className="font-medium text-sm">{section.section_name}</span>
                                        </div>
                                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{section.rule_description}</p>
                                      </div>
                                      <button
                                        onClick={() => setAModal({ open: true, existing: section, targetPostTypeId: activeTabId })}
                                        className="p-2 rounded-lg transition-colors hover:bg-white/5"
                                        style={{ color: 'var(--text-muted)' }}
                                      >
                                        <Pencil size={14} />
                                      </button>
                                      <button
                                        onClick={() => deleteAnatomy(section.id)}
                                        className="p-2 rounded-lg transition-colors hover:bg-red-900/20"
                                        style={{ color: '#ef4444' }}
                                      >
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
                  );
                }

                const defaultList = anatomy.filter(a => !a.applies_to_post_type_id);

                return (
                  <DragDropContext onDragEnd={onDragEndAnatomy}>
                    <Droppable droppableId="anatomy_default">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                          {defaultList.length === 0 && (
                            <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>No sections yet. Add one above.</p>
                          )}
                          {defaultList.map((section, index) => (
                            <Draggable key={section.id} draggableId={section.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                                  style={{
                                    background: snapshot.isDragging ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                                    border: `1px solid ${snapshot.isDragging ? 'var(--accent)' : 'var(--border)'}`,
                                    boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                                    ...provided.draggableProps.style,
                                  }}
                                >
                                  <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing" style={{ color: 'var(--text-muted)' }}>
                                    <GripVertical size={14} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="text-xs font-semibold px-2 py-0.5 rounded"
                                        style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)44' }}
                                      >
                                        {index + 1}
                                      </span>
                                      <span className="font-medium text-sm">{section.section_name}</span>
                                    </div>
                                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{section.rule_description}</p>
                                  </div>
                                  <button
                                    onClick={() => setAModal({ open: true, existing: section, targetPostTypeId: null })}
                                    className="p-2 rounded-lg transition-colors hover:bg-white/5"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => deleteAnatomy(section.id)}
                                    className="p-2 rounded-lg transition-colors hover:bg-red-900/20"
                                    style={{ color: '#ef4444' }}
                                  >
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
                );
              })()}
            </div>
          )}

          {/* TAB 3: Tone & Voice */}
          {activeTab === 'tone' && (
            <div>
              <h2 className="font-semibold text-base mb-1">Tone &amp; Voice Profile</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>Applied to every generation call regardless of post type.</p>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Language Mix</label>
                  <div className="relative">
                    <select
                      value={languageMix}
                      onChange={e => setLanguageMix(e.target.value)}
                      className="w-full appearance-none pr-8"
                      style={{ ...selectStyle, width: '100%' }}
                    >
                      <option value="English">English</option>
                      <option value="Roman Urdu">Roman Urdu</option>
                      <option value="Mix (English + Roman Urdu)">Mix (English + Roman Urdu)</option>
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

              <div className="mb-5">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Formality &amp; Tone Directives
                </label>
                <p className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Describe your desired tone and formality style (e.g. conversational yet authoritative, professional without stiff jargon).
                </p>
                <textarea
                  value={formality}
                  onChange={e => setFormality(e.target.value)}
                  placeholder="e.g. Conversational, direct, authentic. High energy with zero fluff or corporate jargon."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm resize-none focus:outline-none"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="mb-6">
                <TagInput
                  label="Banned Phrases - never use these in any post"
                  tags={bannedPhrases}
                  onChange={setBannedPhrases}
                  placeholder="Type a phrase and press Enter"
                  accentColor="#ef4444"
                />
              </div>

              <button onClick={saveTone} disabled={savingTone}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'white' }}>
                {savingTone ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Tone Profile</>}
              </button>
            </div>
          )}

          {/* TAB 4: Writing Mechanics */}
          {activeTab === 'mechanics' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-base">Writing Mechanics Rules</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Reusable formatting constraints &amp; writing principles. Enabled directives get injected into Gemini generation calls.
                  </p>
                </div>
                <button onClick={() => setWmModal({ open: true })}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  <Plus size={14} /> Add Mechanic
                </button>
              </div>

              <DragDropContext onDragEnd={onDragEndMechanics}>
                <Droppable droppableId="mechanics">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                      {writingMechanics.length === 0 && (
                        <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>
                          No writing mechanics defined. Add one above.
                        </p>
                      )}
                      {writingMechanics.map((mech, index) => (
                        <Draggable key={mech.id} draggableId={mech.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="rounded-xl p-4 transition-all"
                              style={{
                                background: snapshot.isDragging ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                                border: `1px solid ${snapshot.isDragging ? 'var(--accent)' : 'var(--border)'}`,
                                opacity: mech.enabled ? 1 : 0.6,
                                ...provided.draggableProps.style,
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing pt-1" style={{ color: 'var(--text-muted)' }}>
                                  <GripVertical size={14} />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                      {mech.rule_name}
                                    </span>
                                  </div>
                                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {mech.description || mech.prompt_directive}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    onClick={() => toggleMechanic(mech)}
                                    title={mech.enabled ? 'Disable directive' : 'Enable directive'}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                    style={{ color: mech.enabled ? 'var(--success)' : 'var(--text-muted)' }}
                                  >
                                    {mech.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                  </button>
                                  <button
                                    onClick={() => setWmModal({ open: true, existing: mech })}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                    style={{ color: 'var(--text-muted)' }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => deleteMechanic(mech.id)}
                                    className="p-1.5 rounded-lg transition-colors hover:bg-red-900/20"
                                    style={{ color: '#ef4444' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
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
          )}

        </div>
      </div>
    </div>
  );
}
