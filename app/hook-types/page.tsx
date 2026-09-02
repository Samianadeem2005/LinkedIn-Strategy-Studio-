'use client';

import { useState, useEffect } from 'react';
import { Bookmark, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import TagInput from '@/components/TagInput';

interface HookType {
  id: string;
  name: string;
  description?: string;
  angles: string[];
  best_fit_pillars: string[];
}

const AVAILABLE_PILLARS = ['Value', 'Lead Magnet', 'Personal', 'Showcase', 'Authority'];

const PILLAR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Value: { bg: 'rgba(79, 110, 125, 0.12)', text: '#4f6e7d', border: 'rgba(79, 110, 125, 0.3)' },
  'Lead Magnet': { bg: 'rgba(201, 71, 49, 0.12)', text: '#c94731', border: 'rgba(201, 71, 49, 0.3)' },
  Personal: { bg: 'rgba(79, 110, 125, 0.12)', text: '#4f6e7d', border: 'rgba(79, 110, 125, 0.3)' },
  Showcase: { bg: 'rgba(201, 71, 49, 0.12)', text: '#c94731', border: 'rgba(201, 71, 49, 0.3)' },
  Authority: { bg: 'rgba(79, 110, 125, 0.12)', text: '#4f6e7d', border: 'rgba(79, 110, 125, 0.3)' },
};

export default function HookTypesPage() {
  const [hookTypes, setHookTypes] = useState<HookType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    angles: string[];
    best_fit_pillars: string[];
  }>({
    name: '',
    angles: [],
    best_fit_pillars: [],
  });

  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchHookTypes();
  }, []);

  async function fetchHookTypes() {
    try {
      setLoading(true);
      const res = await fetch('/api/hook-types');
      if (!res.ok) throw new Error('Failed to fetch hook types');
      const data = await res.json();
      setHookTypes(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingId(null);
    setFormData({
      name: '',
      angles: [],
      best_fit_pillars: ['Value'],
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(ht: HookType) {
    setEditingId(ht.id);
    setFormData({
      name: ht.name,
      angles: ht.angles || [],
      best_fit_pillars: ht.best_fit_pillars || [],
    });
    setIsModalOpen(true);
  }

  function togglePillar(pillar: string) {
    setFormData(prev => {
      const exists = prev.best_fit_pillars.includes(pillar);
      const updated = exists
        ? prev.best_fit_pillars.filter(p => p !== pillar)
        : [...prev.best_fit_pillars, pillar];
      return { ...prev, best_fit_pillars: updated };
    });
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      alert('Please enter hook type name.');
      return;
    }
    if (!formData.angles || formData.angles.length === 0) {
      alert('Please add at least one directional angle.');
      return;
    }

    try {
      setSaving(true);
      const url = editingId ? `/api/hook-types/${editingId}` : '/api/hook-types';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          angles: formData.angles,
          best_fit_pillars: formData.best_fit_pillars,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save hook type');
      }

      setIsModalOpen(false);
      await fetchHookTypes();
    } catch (err) {
      alert(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/hook-types/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteId(null);
      await fetchHookTypes();
    } catch (err) {
      alert(String(err));
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-[#4f6e7d]/12 border border-[#4f6e7d]/20 flex items-center justify-center text-[#4f6e7d]">
              <Bookmark size={20} />
            </div>
            <h1 className="text-2xl font-extrabold text-[#2c2c2c] tracking-tight">
              Hook Types Management
            </h1>
          </div>
          <p className="text-sm font-medium text-[#4f6e7d] ml-13">
            Structured hook strategies, directional angles, and pillar pairings used live during AI post generation.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-[#c94731] hover:bg-[#b83d28] hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Plus size={16} />
          Add Hook Type
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-sm font-medium text-[#4f6e7d]">
          Loading Hook Types...
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-[#c94731]/10 border border-[#c94731]/30 text-[#c94731] text-sm font-semibold">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hookTypes.map(ht => (
            <div
              key={ht.id}
              className="mosaic-card p-6 flex flex-col justify-between"
            >
              <div>
                {/* Card Title & Actions */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-[#2c2c2c] tracking-tight">
                    {ht.name}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(ht)}
                      title="Edit Hook Type"
                      className="w-7 h-7 rounded-full border border-[#4f6e7d]/20 text-[#4f6e7d] hover:bg-[#4f6e7d] hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteId(ht.id)}
                      title="Delete Hook Type"
                      className="w-7 h-7 rounded-full border border-[#c94731]/20 text-[#c94731] hover:bg-[#c94731] hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-xs"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Pillar Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {ht.best_fit_pillars.map(pillar => {
                    const style = PILLAR_COLORS[pillar] || {
                      bg: 'rgba(79, 110, 125, 0.12)',
                      text: '#4f6e7d',
                      border: 'rgba(79, 110, 125, 0.25)',
                    };
                    return (
                      <span
                        key={pillar}
                        style={{
                          backgroundColor: style.bg,
                          color: style.text,
                          borderColor: style.border,
                        }}
                        className="px-3 py-1 rounded-full text-xs font-semibold border"
                      >
                        {pillar}
                      </span>
                    );
                  })}
                </div>

                {/* Directional Angles List */}
                <div className="p-4 rounded-2xl bg-[#f5f1f2] border border-[#4f6e7d]/15">
                  <div className="text-[11px] uppercase tracking-wider font-extrabold text-[#4f6e7d] mb-2.5">
                    Directional Angles ({ht.angles?.length ?? 0}):
                  </div>
                  <div className="flex flex-col gap-2">
                    {(ht.angles || []).map((angle, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-[#2c2c2c] leading-relaxed">
                        <span className="w-5 h-5 rounded-full bg-[#4f6e7d]/15 text-[#4f6e7d] flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="font-medium">{angle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#2c2c2c]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-[#4f6e7d]/20 rounded-3xl w-full max-w-lg p-6 shadow-[0_8px_30px_rgba(44,44,44,0.08)]">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#4f6e7d]/15">
              <h2 className="text-lg font-bold text-[#2c2c2c]">
                {editingId ? 'Edit Hook Type' : 'Add New Hook Type'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full border border-[#4f6e7d]/20 text-[#4f6e7d] hover:bg-[#4f6e7d] hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[#2c2c2c] mb-1.5">
                  Hook Type Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Misconception"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#4f6e7d]/20 bg-[#f5f1f2] text-[#2c2c2c] text-sm focus:outline-none focus:ring-2 focus:ring-[#4f6e7d]/20 focus:border-[#4f6e7d] transition-all"
                />
              </div>

              {/* Angles Tag Box */}
              <div>
                <TagInput
                  label="Directional Angles"
                  tags={formData.angles}
                  onChange={angles => setFormData(prev => ({ ...prev, angles }))}
                  placeholder="Type an angle and press Enter"
                  accentColor="#c94731"
                />
              </div>

              {/* Best-Fit Pillars */}
              <div>
                <label className="block text-xs font-semibold text-[#2c2c2c] mb-2">
                  Best-Fit Pillars (Select all that apply)
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_PILLARS.map(p => {
                    const isSelected = formData.best_fit_pillars.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePillar(p)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${isSelected
                            ? 'bg-[#c94731] text-white border-[#c94731] shadow-xs'
                            : 'bg-[#f5f1f2] text-[#4f6e7d] border-[#4f6e7d]/20 hover:border-[#4f6e7d]/40'
                          }`}
                      >
                        {isSelected && <Check size={13} />}
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[#4f6e7d]/15">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#4f6e7d]/25 text-[#4f6e7d] bg-white hover:bg-[#4f6e7d]/10 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#c94731] hover:bg-[#b83d28] transition-all cursor-pointer shadow-md disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save Hook Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-[#2c2c2c]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white border border-[#4f6e7d]/20 rounded-3xl w-full max-w-sm p-6 text-center shadow-[0_8px_30px_rgba(44,44,44,0.08)]">
            <h3 className="text-base font-bold text-[#2c2c2c] mb-2">
              Delete Hook Type?
            </h3>
            <p className="text-xs text-[#4f6e7d] mb-6">
              Are you sure you want to remove this hook type? This cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl border border-[#4f6e7d]/25 text-[#4f6e7d] bg-white hover:bg-[#4f6e7d]/10 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#c94731] hover:bg-[#b83d28] transition-all cursor-pointer shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
