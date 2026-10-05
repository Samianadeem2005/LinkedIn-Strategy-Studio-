'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp, PostType, AnatomySection, ContentIntent, ThinkingFlowStep } from '@/context/AppContext';
import { DEFAULT_AVOID_WORDS } from '@/lib/constants';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import TagInput from '@/components/TagInput';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  Save,
  Loader2,
  Sparkles,
  Layers,
  Compass,
  CheckCircle2,
  Star,
  ListOrdered,
  FileText,
  Type
} from 'lucide-react';

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
  const [visualSuggestions, setVisualSuggestions] = useState<string[]>(() => {
    if (Array.isArray(existing?.visual_suggestions)) return existing.visual_suggestions;
    if (typeof existing?.visual_suggestions === 'string') {
      try {
        const parsed = JSON.parse(existing.visual_suggestions);
        return Array.isArray(parsed) ? parsed : [existing.visual_suggestions];
      } catch {
        return existing.visual_suggestions ? [existing.visual_suggestions] : [];
      }
    }
    return [];
  });
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
        body: JSON.stringify({ name, core_focus: coreFocus, visual_suggestions: visualSuggestions, dos, donts })
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
    <Modal
      title={existing ? `Edit: ${existing.name}` : 'New Post Type'}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Post Type</>}
          </button>
        </>
      }
    >
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
          />
          {nameError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{nameError}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            Core Focus
            <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>- what is this post type fundamentally for?</span>
          </label>
          <textarea
            value={coreFocus}
            onChange={e => setCoreFocus(e.target.value)}
            placeholder={`e.g. Educate the audience on one specific concept.`}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: coreFocusError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
          />
          {coreFocusError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{coreFocusError}</p>}
        </div>

        <TagInput
          label="Visual Suggestions"
          tags={visualSuggestions}
          onChange={setVisualSuggestions}
          placeholder="Type a rule and press Enter"
          accentColor="#8b5cf6"
        />

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
          accentColor="#A78BE0"
          error={dontsError}
        />
      </div>
    </Modal>
  );
}

// ── Content Intent Modal ───────────────────────────────────────────────────
function ContentIntentModal({ existing, postTypes, targetPillarId, onClose, onSaved }: {
  existing?: ContentIntent;
  postTypes: PostType[];
  targetPillarId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show: showToast, ToastEl } = useToast();
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [postTypeId, setPostTypeId] = useState(existing?.post_type_id || targetPillarId || (postTypes[0]?.id ?? ''));
  const [priority, setPriority] = useState(existing?.priority ?? 1);
  const [isDefault, setIsDefault] = useState(existing ? existing.is_default === 1 : false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [displayNameError, setDisplayNameError] = useState('');

  const handleDisplayNameChange = (val: string) => {
    setDisplayName(val);
    if (!existing) {
      setName(val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_'));
    }
  };

  const save = async () => {
    let ok = true;
    if (!displayName.trim()) { setDisplayNameError('Display name is required.'); ok = false; } else setDisplayNameError('');
    if (!name.trim()) { setNameError('Code key is required.'); ok = false; } else setNameError('');
    if (!postTypeId) { showToast('Pillar is required.', 'error'); ok = false; }
    if (!ok) return;

    setSaving(true);
    try {
      const url = existing ? `/api/content-intents/${existing.id}` : '/api/content-intents';
      const method = existing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim().toLowerCase().replace(/\s+/g, '_'),
          display_name: displayName.trim(),
          description: description.trim(),
          post_type_id: postTypeId,
          priority: Number(priority),
          is_default: isDefault
        })
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
    <Modal
      title={existing ? `Edit Intent: ${existing.display_name}` : 'New Content Intent'}
      onClose={onClose}
      width="max-w-xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Intent</>}
          </button>
        </>
      }
    >
      {ToastEl}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Display Name</label>
            <input
              value={displayName}
              onChange={e => handleDisplayNameChange(e.target.value)}
              placeholder="e.g. Industry Observation"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ background: 'var(--bg-primary)', borderColor: displayNameError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
            />
            {displayNameError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{displayNameError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Code Key</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. industry_observation"
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none"
              style={{ background: 'var(--bg-primary)', borderColor: nameError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
            />
            {nameError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{nameError}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Assigned Pillar</label>
            <select
              value={postTypeId}
              onChange={e => setPostTypeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {postTypes.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Priority (Sort Order)</label>
            <input
              type="number"
              value={priority}
              onChange={e => setPriority(Number(e.target.value))}
              min={1}
              max={99}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description & Reader Outcome</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What should the reader get from this post? (e.g. Actionable explanation of why a failure happens...)"
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
          <input
            type="checkbox"
            id="intent-default"
            checked={isDefault}
            onChange={e => setIsDefault(e.target.checked)}
            className="rounded accent-purple-600 cursor-pointer"
          />
          <label htmlFor="intent-default" className="text-xs font-medium cursor-pointer" style={{ color: 'var(--text-primary)' }}>
            Default intent for this pillar when input notes are ambiguous
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ── Rich Post Anatomy Modal ────────────────────────────────────────────────
function AnatomyModal({ existing, postTypes, contentIntents, targetPostTypeId, onClose, onSaved }: {
  existing?: AnatomySection;
  postTypes: PostType[];
  contentIntents: ContentIntent[];
  targetPostTypeId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show: showToast, ToastEl } = useToast();
  const [name, setName] = useState(existing?.name || existing?.section_name || '');
  const [postTypeId, setPostTypeId] = useState(
    existing?.post_type_id || existing?.applies_to_post_type_id || targetPostTypeId || (postTypes[0]?.id ?? '')
  );
  const [purpose, setPurpose] = useState(existing?.purpose || existing?.rule_description || '');
  const [writingStyle, setWritingStyle] = useState(
    existing?.writing_style || 'Paragraph-led. Natural prose. Do not force numbered lists. Let ideas flow naturally.'
  );
  const [constraints, setConstraints] = useState(existing?.constraints ?? '');
  const [thinkingFlowSteps, setThinkingFlowSteps] = useState<ThinkingFlowStep[]>(() => {
    if (existing?.thinkingFlowList && existing.thinkingFlowList.length > 0) {
      return existing.thinkingFlowList.map((step, index) => typeof step === 'string'
        ? { name: `Step ${index + 1}`, instruction: step, purpose: '' }
        : step);
    }
    if (existing?.thinking_flow) {
      try {
        const parsed = JSON.parse(existing.thinking_flow);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((step, index) => typeof step === 'string'
            ? { name: `Step ${index + 1}`, instruction: step, purpose: '' }
            : { name: step.name || `Step ${index + 1}`, instruction: step.instruction || '', purpose: step.purpose || '' });
        }
      } catch {}
      const lines = existing.thinking_flow.split('\n').map(s => s.trim()).filter(Boolean);
      if (lines.length > 0) return lines.map((instruction, index) => ({ name: `Step ${index + 1}`, instruction, purpose: '' }));
    }
    return [
      { name: 'Opening thought', instruction: 'Open with the core observation or moment.', purpose: '' },
      { name: 'Evidence', instruction: 'Provide concrete evidence or context.', purpose: '' },
      { name: 'Meaning', instruction: 'Explain the mechanism or why it matters.', purpose: '' },
      { name: 'Implication', instruction: 'Deliver the practical takeaway or implication.', purpose: '' }
    ];
  });

  const [selectedIntentIds, setSelectedIntentIds] = useState<string[]>(existing?.intent_ids || []);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [purposeError, setPurposeError] = useState('');

  // Eligible intents for the currently selected pillar
  const pillarIntents = contentIntents.filter(ci => ci.post_type_id === postTypeId);

  const handleStepChange = (index: number, field: keyof ThinkingFlowStep, val: string) => {
    setThinkingFlowSteps(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleAddStep = () => {
    setThinkingFlowSteps(prev => [...prev, { name: `Step ${prev.length + 1}`, instruction: '', purpose: '' }]);
  };

  const handleRemoveStep = (index: number) => {
    setThinkingFlowSteps(prev => prev.filter((_, i) => i !== index));
  };

  const toggleIntent = (id: string) => {
    setSelectedIntentIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const save = async () => {
    let ok = true;
    if (!name.trim()) { setNameError('Anatomy name is required.'); ok = false; } else setNameError('');
    if (!purpose.trim()) { setPurposeError('Purpose is required.'); ok = false; } else setPurposeError('');
    const validSteps = thinkingFlowSteps.filter(s => s.instruction.trim()).map(s => ({
      name: s.name.trim() || 'Step',
      instruction: s.instruction.trim(),
      purpose: s.purpose.trim()
    }));
    if (validSteps.length === 0) {
      showToast('Add at least one thinking flow step.', 'error');
      ok = false;
    }
    if (!ok) return;

    setSaving(true);
    try {
      const url = existing ? `/api/anatomy/${existing.id}` : '/api/anatomy';
      const method = existing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          purpose: purpose.trim(),
          thinking_flow: validSteps,
          writing_style: writingStyle.trim(),
          constraints: constraints.trim() || null,
          post_type_id: postTypeId,
          intent_ids: selectedIntentIds,
          order_index: existing?.order_index ?? 0
        })
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
    <Modal
      title={existing ? `Edit Anatomy: ${existing.name || existing.section_name}` : 'New Thinking Journey Anatomy'}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5 cursor-pointer"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Anatomy</>}
          </button>
        </>
      }
    >
      {ToastEl}
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Anatomy Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Industry Observation"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ background: 'var(--bg-primary)', borderColor: nameError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
            />
            {nameError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{nameError}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Pillar</label>
            <select
              value={postTypeId}
              onChange={e => setPostTypeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {postTypes.map(pt => (
                <option key={pt.id} value={pt.id}>{pt.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Strategic Purpose</label>
          <textarea
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder="e.g. Build authority through an original interpretation of a current industry or company pattern."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: purposeError ? 'var(--danger)' : 'var(--border)', color: 'var(--text-primary)' }}
          />
          {purposeError && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{purposeError}</p>}
        </div>

        {/* Thinking Flow Steps */}
        <div className="border rounded-xl p-3.5 space-y-2.5" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <ListOrdered size={14} className="text-[#A78BE0]" /> Thinking Flow (Mental Roadmap)
              </span>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                The sequence of thoughts Gemini develops. These are NOT visible headings in the post.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddStep}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border hover:bg-white/10 cursor-pointer"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              <Plus size={12} /> Add Step
            </button>
          </div>

          <div className="space-y-2 pt-1">
            {thinkingFlowSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-5 text-center text-xs font-mono font-bold text-[#A78BE0]">{idx + 1}.</span>
                <input
                  value={step.name}
                  onChange={e => handleStepChange(idx, 'name', e.target.value)}
                  placeholder={`Step ${idx + 1} name...`}
                  className="w-32 px-3 py-1.5 rounded-lg border text-xs focus:outline-none"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <input
                  value={step.instruction}
                  onChange={e => handleStepChange(idx, 'instruction', e.target.value)}
                  placeholder={`Step ${idx + 1} thought...`}
                  className="flex-1 px-3 py-1.5 rounded-lg border text-xs focus:outline-none"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <input
                  value={step.purpose}
                  onChange={e => handleStepChange(idx, 'purpose', e.target.value)}
                  placeholder="Purpose"
                  className="w-28 px-3 py-1.5 rounded-lg border text-xs focus:outline-none"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                {thinkingFlowSteps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStep(idx)}
                    className="p-1 rounded text-red-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                    title="Remove step"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Writing Style */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Writing Style Guidance</label>
          <textarea
            value={writingStyle}
            onChange={e => setWritingStyle(e.target.value)}
            placeholder="e.g. Paragraph-led. Natural cadence. Avoid numbered listicles. Let ideas flow naturally."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none resize-none"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Eligible Content Intents */}
        <div className="border rounded-xl p-3.5 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
          <span className="text-xs font-bold block" style={{ color: 'var(--text-primary)' }}>
            Mapped Content Intents (When should this anatomy be eligible?)
          </span>
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Select the intents from &quot;{postTypes.find(p => p.id === postTypeId)?.name}&quot; that can rotate into this anatomy.
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {pillarIntents.length === 0 && (
              <span className="text-xs text-stone-400">No intents defined for this pillar yet.</span>
            )}
            {pillarIntents.map(intent => {
              const isChecked = selectedIntentIds.includes(intent.id);
              return (
                <button
                  type="button"
                  key={intent.id}
                  onClick={() => toggleIntent(intent.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-[#A78BE0] text-white border-[#A78BE0] shadow-xs'
                      : 'bg-white/5 border-stone-200 text-stone-700 hover:border-stone-400'
                  }`}
                >
                  <CheckCircle2 size={13} className={isChecked ? 'opacity-100' : 'opacity-30'} />
                  <span>{intent.display_name}</span>
                </button>
              );
            })}
          </div>
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
    <Modal
      title={existing ? `Edit Mechanic: ${existing.rule_name}` : 'New Writing Mechanic'}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}>
            {saving ? <><Loader2 size={14} className="spinner" /> Saving...</> : <><Save size={14} /> Save Mechanic</>}
          </button>
        </>
      }
    >
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
            placeholder="e.g. Format with short paragraphs and single line breaks between thoughts."
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
            className="rounded accent-purple-600 cursor-pointer"
          />
          <label htmlFor="mech-enabled" className="text-xs font-medium cursor-pointer" style={{ color: 'var(--text-primary)' }}>
            Enable this rule in generation prompts
          </label>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Settings Page Content ──────────────────────────────────────────────
function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  const {
    postTypes,
    contentIntents,
    anatomy,
    settings,
    refreshPostTypes,
    refreshContentIntents,
    refreshAnatomy,
    refreshSettings
  } = useApp();
  const { show: showToast, ToastEl } = useToast();

  const [activeTab, setActiveTab] = useState<'about' | 'pillars' | 'intents' | 'anatomy' | 'tone' | 'mechanics'>('about');
  const [ptModal, setPtModal] = useState<{ open: boolean; existing?: PostType }>({ open: false });
  const [ciModal, setCiModal] = useState<{ open: boolean; existing?: ContentIntent; targetPillarId?: string }>({ open: false });
  const [aModal, setAModal] = useState<{ open: boolean; existing?: AnatomySection; targetPostTypeId?: string | null }>({ open: false });
  const [wmModal, setWmModal] = useState<{ open: boolean; existing?: WritingMechanic }>({ open: false });

  const [selectedIntentPillar, setSelectedIntentPillar] = useState<string>('all');
  const [selectedAnatomyPillar, setSelectedAnatomyPillar] = useState<string>('all');
  const [writingMechanics, setWritingMechanics] = useState<WritingMechanic[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  // About Me context state
  const [aboutMe, setAboutMe] = useState(settings?.about_me ?? '');
  const [savingAboutMe, setSavingAboutMe] = useState(false);

  // Tone form state
  const [formality, setFormality] = useState<string>(settings?.tone_profile?.formality ?? '');
  const [sentenceLength, setSentenceLength] = useState<'short' | 'medium' | 'long'>(settings?.tone_profile?.sentenceLength ?? 'short');
  const [bannedPhrases, setBannedPhrases] = useState<string[]>(settings?.tone_profile?.bannedPhrases ?? []);
  const [languageMix, setLanguageMix] = useState<string>(settings?.tone_profile?.languageMix ?? 'English');
  const [vocabularyLevel, setVocabularyLevel] = useState<string>(settings?.tone_profile?.vocabularyLevel ?? 'simple');
  const [avoidWords, setAvoidWords] = useState<string[]>(settings?.tone_profile?.avoidWords && settings?.tone_profile?.avoidWords.length > 0 ? settings.tone_profile.avoidWords : DEFAULT_AVOID_WORDS);
  const [savingTone, setSavingTone] = useState(false);

  // Reactive sync of activeTab from URL search param (?tab=...)
  useEffect(() => {
    if (tabParam && ['about', 'pillars', 'intents', 'anatomy', 'tone', 'mechanics'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  // Sync settings on load
  useEffect(() => {
    if (settings?.about_me) setAboutMe(settings.about_me);
    if (settings?.tone_profile) {
      setFormality(settings.tone_profile.formality ?? '');
      setSentenceLength(settings.tone_profile.sentenceLength ?? 'short');
      setBannedPhrases(settings.tone_profile.bannedPhrases ?? []);
      setLanguageMix(settings.tone_profile.languageMix ?? 'English');
      setVocabularyLevel(settings.tone_profile.vocabularyLevel ?? 'simple');
      setAvoidWords(settings.tone_profile.avoidWords && settings.tone_profile.avoidWords.length > 0 ? settings.tone_profile.avoidWords : DEFAULT_AVOID_WORDS);
    }
  }, [settings?.about_me, settings?.tone_profile]);

  const fetchMechanics = useCallback(async () => {
    try {
      const res = await fetch('/api/writing-mechanics');
      if (res.ok) setWritingMechanics(await res.json());
    } catch { /* fall through */ }
  }, []);

  useEffect(() => {
    fetchMechanics();
  }, [fetchMechanics]);

  const saveAboutMe = async () => {
    setSavingAboutMe(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frequency: settings?.frequency ?? 'daily',
          anatomy_scope: 'per_post_type',
          tone_profile: { formality, sentenceLength, bannedPhrases, languageMix, vocabularyLevel, avoidWords },
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
          anatomy_scope: 'per_post_type',
          tone_profile: { formality, sentenceLength, bannedPhrases, languageMix, vocabularyLevel, avoidWords },
          about_me: aboutMe
        })
      });
      if (res.ok) { await refreshSettings(); showToast('Tone profile saved.', 'success'); }
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

  const deleteIntent = async (id: string) => {
    if (!confirm('Delete this content intent?')) return;
    try {
      const res = await fetch(`/api/content-intents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await refreshContentIntents();
        await refreshAnatomy();
        showToast('Content intent deleted.', 'success');
      } else {
        const d = await res.json();
        showToast(d.error ?? 'Delete failed.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    }
  };

  const deleteAnatomy = async (id: string) => {
    if (!confirm('Delete this anatomy?')) return;
    const res = await fetch(`/api/anatomy/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshAnatomy();
      showToast('Anatomy deleted.', 'success');
    } else {
      showToast('Delete failed.', 'error');
    }
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

  const tabs = [
    { id: 'about' as const, label: 'About Me', icon: FileText },
    { id: 'pillars' as const, label: 'Post Pillars', icon: Layers },
    { id: 'intents' as const, label: 'Content Intents', icon: Compass },
    { id: 'anatomy' as const, label: 'Post Anatomy', icon: ListOrdered },
    { id: 'tone' as const, label: 'Tone & Voice', icon: Sparkles },
    { id: 'mechanics' as const, label: 'Writing Mechanics', icon: Type },
  ];

  // Filtered lists
  const filteredIntents = selectedIntentPillar === 'all'
    ? contentIntents
    : contentIntents.filter(ci => ci.post_type_id === selectedIntentPillar);

  const filteredAnatomies = selectedAnatomyPillar === 'all'
    ? anatomy
    : anatomy.filter(a => a.post_type_id === selectedAnatomyPillar || a.applies_to_post_type_id === selectedAnatomyPillar);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FBFBFC]">
      {ToastEl}

      {ptModal.open && (
        <PostTypeModal
          existing={ptModal.existing}
          onClose={() => setPtModal({ open: false })}
          onSaved={refreshPostTypes}
        />
      )}

      {ciModal.open && (
        <ContentIntentModal
          existing={ciModal.existing}
          postTypes={postTypes}
          targetPillarId={ciModal.targetPillarId}
          onClose={() => setCiModal({ open: false })}
          onSaved={refreshContentIntents}
        />
      )}

      {aModal.open && (
        <AnatomyModal
          existing={aModal.existing}
          postTypes={postTypes}
          contentIntents={contentIntents}
          targetPostTypeId={aModal.targetPostTypeId}
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

      {/* Header & Horizontal Tab Bar */}
      <div className="shrink-0 px-8 pt-6 pb-0 border-b border-[#8B8A93]/15 bg-white">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h1 className="font-extrabold text-xl sm:text-2xl text-[#1C1C1E] tracking-tight">
              <span>System Settings</span> <span className="font-serif-italic font-normal" style={{ color: '#776497' }}>& Architecture Directives</span>
            </h1>
            <p className="text-xs text-[#8B8A93] mt-0.5">
              Pillar → Content Intent → Anatomy thinking flow hierarchy.
            </p>
          </div>
        </div>

        {/* Tab Navigation Row */}
        <div className="flex items-center gap-1 overflow-x-auto pb-[-1px]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  router.replace(`/settings?tab=${tab.id}`, { scroll: false });
                }}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#776497] text-[#1C1C1E] bg-[#A78BE0]/10 rounded-t-lg'
                    : 'border-transparent text-[#8B8A93] hover:text-[#1C1C1E] hover:bg-[#EEECF1]/50'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[#776497]' : 'text-[#8B8A93]'} />
                <span>{tab.label}</span>
                {tab.id === 'intents' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#A78BE0]/20 text-[#776497]">
                    {contentIntents.length}
                  </span>
                )}
                {tab.id === 'anatomy' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#776497]/20 text-[#776497]">
                    {anatomy.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Body - scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">

          {/* TAB 0: About Me / Context */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base text-[#1C1C1E]">About Me & Proof-of-Work Context</h2>
                  <p className="text-xs text-[#8B8A93] mt-1 leading-relaxed">
                    This context is injected into Gemini under <span className="font-mono text-[#776497] font-semibold">ROLE / AUTHOR CONTEXT</span>.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-[#8B8A93]/15 bg-white shadow-xs">
                <textarea
                  value={aboutMe}
                  onChange={e => setAboutMe(e.target.value)}
                  rows={8}
                  placeholder="e.g. I am an AI Engineer building in public..."
                  className="w-full p-3 rounded-xl border border-[#8B8A93]/20 bg-white text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#A78BE0]/40 resize-y font-sans text-[#1C1C1E]"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={saveAboutMe}
                    disabled={savingAboutMe}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer bg-[#A78BE0] text-white hover:bg-[#9070CC] shadow-xs"
                  >
                    {savingAboutMe ? <><Loader2 size={13} className="spinner" /> Saving...</> : <><Save size={13} /> Save About Me Context</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: Post Pillars */}
          {activeTab === 'pillars' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base text-[#1C1C1E]">Post Pillars (Why are we posting?)</h2>
                  <p className="text-xs text-[#8B8A93] mt-0.5">
                    The 5 strategic pillars with their mandatory Core Focus, DOs, and DON&apos;Ts.
                  </p>
                </div>
                <button
                  onClick={() => setPtModal({ open: true })}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#A78BE0] hover:bg-[#9070CC] transition-all cursor-pointer shadow-xs"
                >
                  <Plus size={14} /> New Pillar
                </button>
              </div>

              <div className="space-y-3">
                {postTypes.map(pt => (
                  <div key={pt.id} className="p-4 rounded-2xl border border-[#8B8A93]/15 bg-white shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-sm text-[#1C1C1E]">{pt.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#A78BE0]/15 text-[#776497]">
                          {contentIntents.filter(ci => ci.post_type_id === pt.id).length} Intents
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#D6EC72]/40 text-[#556912]">
                          {anatomy.filter(a => a.post_type_id === pt.id || a.applies_to_post_type_id === pt.id).length} Anatomies
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setPtModal({ open: true, existing: pt })} className="p-1.5 rounded-lg hover:bg-stone-100 text-[#8B8A93] cursor-pointer">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deletePostType(pt.id)} disabled={deleting === pt.id} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer">
                          {deleting === pt.id ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                    {pt.core_focus && (
                      <p className="text-xs text-[#8B8A93] leading-relaxed line-clamp-2">
                        <strong className="text-[#1C1C1E]">Core Focus:</strong> {pt.core_focus}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Content Intents Taxonomy */}
          {activeTab === 'intents' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-base text-[#1C1C1E]">Content Intents Taxonomy</h2>
                  <p className="text-xs text-[#8B8A93] mt-0.5">
                    What should the reader get from this post? Inferred deterministically from notes, or manually picked.
                  </p>
                </div>
                <button
                  onClick={() => setCiModal({ open: true, targetPillarId: selectedIntentPillar !== 'all' ? selectedIntentPillar : undefined })}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#A78BE0] hover:bg-[#9070CC] transition-all cursor-pointer shadow-xs"
                >
                  <Plus size={14} /> New Intent
                </button>
              </div>

              {/* Pillar Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedIntentPillar('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedIntentPillar === 'all'
                      ? 'bg-[#1C1C1E] text-white shadow-xs'
                      : 'bg-white border border-[#8B8A93]/20 text-[#8B8A93] hover:text-[#1C1C1E]'
                  }`}
                >
                  All Pillars ({contentIntents.length})
                </button>
                {postTypes.map(pt => (
                  <button
                    key={pt.id}
                    onClick={() => setSelectedIntentPillar(pt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      selectedIntentPillar === pt.id
                        ? 'bg-[#776497] text-white shadow-xs'
                        : 'bg-white border border-[#8B8A93]/20 text-[#8B8A93] hover:text-[#1C1C1E]'
                    }`}
                  >
                    {pt.name} ({contentIntents.filter(ci => ci.post_type_id === pt.id).length})
                  </button>
                ))}
              </div>

              {/* Intents Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredIntents.map(intent => {
                  const mappedAnatomies = anatomy.filter(a => a.intent_ids?.includes(intent.id));
                  const ptName = postTypes.find(p => p.id === intent.post_type_id)?.name || 'General';

                  return (
                    <div key={intent.id} className="p-4 rounded-2xl border border-[#8B8A93]/15 bg-white shadow-2xs flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#1C1C1E] flex items-center gap-1.5">
                            {intent.display_name}
                            {intent.is_default === 1 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] px-2 py-0.2 rounded-full font-bold bg-[#D6EC72]/50 text-[#556912]" title="Default intent for this pillar">
                                <Star size={10} /> Default
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                            {ptName}
                          </span>
                        </div>

                        <div className="font-mono text-[10px] text-[#A78BE0] font-semibold">
                          key: {intent.name}
                        </div>

                        <p className="text-xs text-[#8B8A93] leading-relaxed">
                          {intent.description || 'No description provided.'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[11px] text-[#8B8A93]">
                          Eligible anatomies: <strong className="text-[#1C1C1E]">{mappedAnatomies.length}</strong>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCiModal({ open: true, existing: intent })}
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-[#8B8A93] cursor-pointer"
                            title="Edit Intent"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteIntent(intent.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"
                            title="Delete Intent"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Post Anatomy (Thinking Journeys) */}
          {activeTab === 'anatomy' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-base text-[#1C1C1E]">Post Anatomy (Thinking Journeys)</h2>
                  <p className="text-xs text-[#8B8A93] mt-0.5">
                    How the idea develops. Backend deterministically rotates anatomies to keep content fresh.
                  </p>
                </div>
                <button
                  onClick={() => setAModal({ open: true, targetPostTypeId: selectedAnatomyPillar !== 'all' ? selectedAnatomyPillar : null })}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#A78BE0] hover:bg-[#9070CC] transition-all cursor-pointer shadow-xs"
                >
                  <Plus size={14} /> New Anatomy
                </button>
              </div>

              {/* Pillar Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedAnatomyPillar('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    selectedAnatomyPillar === 'all'
                      ? 'bg-[#1C1C1E] text-white shadow-xs'
                      : 'bg-white border border-[#8B8A93]/20 text-[#8B8A93] hover:text-[#1C1C1E]'
                  }`}
                >
                  All Pillars ({anatomy.length})
                </button>
                {postTypes.map(pt => (
                  <button
                    key={pt.id}
                    onClick={() => setSelectedAnatomyPillar(pt.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      selectedAnatomyPillar === pt.id
                        ? 'bg-[#776497] text-white shadow-xs'
                        : 'bg-white border border-[#8B8A93]/20 text-[#8B8A93] hover:text-[#1C1C1E]'
                    }`}
                  >
                    {pt.name} ({anatomy.filter(a => a.post_type_id === pt.id || a.applies_to_post_type_id === pt.id).length})
                  </button>
                ))}
              </div>

              {/* Rich Anatomies List */}
              <div className="space-y-4">
                {filteredAnatomies.map(anat => {
                  const ptName = postTypes.find(p => p.id === (anat.post_type_id || anat.applies_to_post_type_id))?.name || 'General';
                  const steps = anat.thinkingFlowList || [];

                  return (
                    <div key={anat.id} className="p-5 rounded-2xl border border-[#8B8A93]/15 bg-white shadow-2xs space-y-4">
                      {/* Anatomy Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-[#1C1C1E]">{anat.name || anat.section_name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 text-stone-700">
                            {ptName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAModal({ open: true, existing: anat })}
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-[#8B8A93] cursor-pointer"
                            title="Edit Anatomy"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteAnatomy(anat.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer"
                            title="Delete Anatomy"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Purpose */}
                      {anat.purpose && (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8B8A93]">Purpose</span>
                          <p className="text-xs text-[#1C1C1E] mt-0.5 leading-relaxed font-medium">
                            {anat.purpose}
                          </p>
                        </div>
                      )}

                      {/* Thinking Flow Steps */}
                      {steps.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A78BE0] flex items-center gap-1">
                            <ListOrdered size={12} /> Thinking Flow Journey
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {steps.map((step, sIdx) => (
                              <div key={sIdx} className="p-2.5 rounded-xl border border-stone-100 bg-[#FBFBFC] text-xs text-stone-700 leading-snug">
                                <span className="font-bold text-[#A78BE0] mr-1.5">{sIdx + 1}.</span>
                                {typeof step === 'string' ? step : `${step.name}: ${step.instruction}`}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Writing Style & Mapped Intents */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-stone-100 text-[11px]">
                        {anat.writing_style && (
                          <div className="text-[#8B8A93]">
                            <strong className="text-stone-700">Style:</strong> {anat.writing_style}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-stone-400">Intents:</span>
                          {anat.intents && anat.intents.length > 0 ? (
                            anat.intents.map(it => (
                              <span key={it.id} className="px-2 py-0.5 rounded font-mono text-[10px] bg-stone-100 text-stone-600 font-semibold">
                                {it.display_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-400 italic">Universal to pillar</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Tone & Voice */}
          {activeTab === 'tone' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-bold text-base text-[#1C1C1E]">Tone & Voice Profile</h2>
                <p className="text-xs text-[#8B8A93] mt-0.5">
                  Natural, conversational engineering voice directives.
                </p>
              </div>

              <div className="p-5 rounded-2xl border border-[#8B8A93]/15 bg-white shadow-xs space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Formality Directive</label>
                  <textarea
                    value={formality}
                    onChange={e => setFormality(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none resize-none text-[#1C1C1E]"
                    style={{ borderColor: 'var(--border)' }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Sentence Length</label>
                    <select
                      value={sentenceLength}
                      onChange={e => setSentenceLength(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border text-xs text-[#1C1C1E]"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <option value="short">Short & Scannable</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Vocabulary Level</label>
                    <input
                      value={vocabularyLevel}
                      onChange={e => setVocabularyLevel(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-xs text-[#1C1C1E]"
                      style={{ borderColor: 'var(--border)' }}
                    />
                  </div>
                </div>

                <TagInput
                  label="Banned Phrases & Tropes (Always Avoided)"
                  tags={bannedPhrases}
                  onChange={setBannedPhrases}
                  placeholder="Type a banned trope and press Enter"
                  accentColor="#A78BE0"
                />

                <TagInput
                  label="Prohibited Formal/Essay Words (Simple Vocabulary Rule)"
                  tags={avoidWords}
                  onChange={setAvoidWords}
                  placeholder="Type an essay word to avoid and press Enter"
                  accentColor="#A78BE0"
                />

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={saveTone}
                    disabled={savingTone}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer bg-[#A78BE0] text-white hover:bg-[#9070CC] shadow-xs"
                  >
                    {savingTone ? <><Loader2 size={13} className="spinner" /> Saving...</> : <><Save size={13} /> Save Tone Profile</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Writing Mechanics */}
          {activeTab === 'mechanics' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base text-[#1C1C1E]">Writing Mechanics Directives</h2>
                  <p className="text-xs text-[#8B8A93] mt-0.5">
                    Formatting and rhythm constraints injected into the generation prompt.
                  </p>
                </div>
                <button
                  onClick={() => setWmModal({ open: true })}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#A78BE0] hover:bg-[#9070CC] transition-all cursor-pointer shadow-xs"
                >
                  <Plus size={14} /> New Mechanic
                </button>
              </div>

              <div className="space-y-3">
                {writingMechanics.map(m => (
                  <div key={m.id} className="p-4 rounded-2xl border border-[#8B8A93]/15 bg-white shadow-2xs flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1C1C1E]">{m.rule_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${m.enabled === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                          {m.enabled === 1 ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-[#8B8A93] mt-1 leading-relaxed">
                        {m.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMechanic(m)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-stone-200 hover:bg-stone-50 cursor-pointer"
                      >
                        {m.enabled === 1 ? 'Disable' : 'Enable'}
                      </button>
                      <button onClick={() => setWmModal({ open: true, existing: m })} className="p-1.5 rounded-lg hover:bg-stone-100 text-[#8B8A93] cursor-pointer">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteMechanic(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="spinner text-[#A78BE0]" size={28} />
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
