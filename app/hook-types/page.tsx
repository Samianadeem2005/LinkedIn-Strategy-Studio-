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
  Value: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  'Lead Magnet': { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' },
  Personal: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' },
  Showcase: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' },
  Authority: { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.3)' },
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
    <div style={{ padding: '28px 36px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '10px',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Bookmark size={22} color="#fbbf24" />
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              Hook Types Management
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            Structured hook strategies, directional angles, and pillar pairings used live during AI post generation.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 18px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
            transition: 'all 0.2s ease',
          }}
        >
          <Plus size={18} />
          Add Hook Type
        </button>
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: '15px', textAlign: 'center', padding: '60px 0' }}>
          Loading Hook Types...
        </div>
      ) : error ? (
        <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '10px' }}>
          {error}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px',
        }}>
          {hookTypes.map(ht => (
            <div
              key={ht.id}
              style={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s ease',
              }}
            >
              <div>
                {/* Card Title & Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    {ht.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleOpenEdit(ht)}
                      title="Edit Hook Type"
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#94a3b8',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteId(ht.id)}
                      title="Delete Hook Type"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        color: '#f87171',
                        padding: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Pillar Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                  {ht.best_fit_pillars.map(pillar => {
                    const style = PILLAR_COLORS[pillar] || {
                      bg: 'rgba(148, 163, 184, 0.15)',
                      text: '#94a3b8',
                      border: 'rgba(148, 163, 184, 0.3)',
                    };
                    return (
                      <span
                        key={pillar}
                        style={{
                          background: style.bg,
                          color: style.text,
                          border: `1px solid ${style.border}`,
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: '20px',
                        }}
                      >
                        {pillar}
                      </span>
                    );
                  })}
                </div>

                {/* Directional Angles List */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid #1e293b',
                  borderRadius: '10px',
                  padding: '12px 14px',
                }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>
                    Directional Angles ({ht.angles?.length ?? 0}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(ht.angles || []).map((angle, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#e2e8f0', lineHeight: '1.4' }}>
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#60a5fa',
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0,
                          marginTop: '2px',
                        }}>
                          {idx + 1}
                        </span>
                        <span>{angle}</span>
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px',
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                {editingId ? 'Edit Hook Type' : 'Add New Hook Type'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
                  Hook Type Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Misconception"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Angles Tag Box */}
              <div>
                <TagInput
                  label="Directional Angles"
                  tags={formData.angles}
                  onChange={angles => setFormData(prev => ({ ...prev, angles }))}
                  placeholder="Type an angle and press Enter"
                  accentColor="#60a5fa"
                />
              </div>

              {/* Best-Fit Pillars */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  Best-Fit Pillars (Select all that apply)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {AVAILABLE_PILLARS.map(p => {
                    const isSelected = formData.best_fit_pillars.includes(p);
                    const style = PILLAR_COLORS[p] || { bg: '#1e293b', text: '#94a3b8', border: '#334155' };
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePillar(p)}
                        style={{
                          background: isSelected ? style.bg : '#1e293b',
                          color: isSelected ? style.text : '#64748b',
                          border: `1px solid ${isSelected ? style.border : '#334155'}`,
                          borderRadius: '20px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isSelected && <Check size={14} />}
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '28px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Save Hook Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '20px',
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            textAlign: 'center',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: '0 0 10px 0' }}>
              Delete Hook Type?
            </h3>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: '0 0 20px 0' }}>
              Are you sure you want to remove this hook type? This cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
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
