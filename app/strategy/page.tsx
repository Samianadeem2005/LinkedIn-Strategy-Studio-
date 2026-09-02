'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/components/Toast';
import { LayoutGrid, Save, Loader2, Plus, Trash2, X, Check, Layers } from 'lucide-react';

interface PillarRule {
  id: string;
  name: string;
  pillar_ids: string[];
  pillar_names: string[];
  target_count: number;
  used_this_week: number;
  is_hybrid: boolean;
}

export default function StrategyPage() {
  const { postTypes } = useApp();
  const { show: showToast, ToastEl } = useToast();

  const [pillarRules, setPillarRules] = useState<PillarRule[]>([]);
  const [basePostTypes, setBasePostTypes] = useState<{ id: string; name: string }[]>([]);
  const [savingQuotas, setSavingQuotas] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedPillarIds, setSelectedPillarIds] = useState<string[]>([]);
  const [customRuleName, setCustomRuleName] = useState('');
  const [customTargetCount, setCustomTargetCount] = useState(2);
  const [creatingRule, setCreatingRule] = useState(false);

  const fetchQuotas = async (preserveLocalTargets = false) => {
    try {
      const res = await fetch('/api/pillar-quotas');
      if (res.ok) {
        const data = await res.json();
        if (data.rules) {
          if (preserveLocalTargets) {
            setPillarRules(prev => {
              const localMap: Record<string, number> = {};
              prev.forEach(r => { localMap[r.id] = r.target_count; });

              return data.rules.map((r: PillarRule) => ({
                ...r,
                target_count: localMap[r.id] !== undefined ? localMap[r.id] : r.target_count
              }));
            });
          } else {
            setPillarRules(data.rules);
          }
        }
        if (data.basePostTypes) setBasePostTypes(data.basePostTypes);
      }
    } catch { /* fall through */ }
  };

  useEffect(() => {
    fetchQuotas();
  }, [postTypes]);

  const handleTogglePillar = (id: string) => {
    const nextSelected = selectedPillarIds.includes(id)
      ? selectedPillarIds.filter(item => item !== id)
      : [...selectedPillarIds, id];
    setSelectedPillarIds(nextSelected);

    const selectedNames = basePostTypes
      .filter(pt => nextSelected.includes(pt.id))
      .map(pt => pt.name);
    setCustomRuleName(selectedNames.join(' + '));
  };

  const handleCreateRule = async () => {
    if (!customRuleName.trim()) {
      showToast('Enter a rule name.', 'error');
      return;
    }
    if (selectedPillarIds.length === 0) {
      showToast('Select at least one content pillar.', 'error');
      return;
    }

    setCreatingRule(true);
    try {
      // Save current unsaved local target counts first
      if (pillarRules.length > 0) {
        await fetch('/api/pillar-quotas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rules: pillarRules.map(r => ({ id: r.id, target_count: r.target_count }))
          })
        });
      }

      // Create new rule
      const res = await fetch('/api/pillar-quotas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customRuleName.trim(),
          pillar_ids: selectedPillarIds,
          target_count: customTargetCount
        })
      });

      if (res.ok) {
        showToast(`Rule "${customRuleName}" created!`, 'success');
        setShowModal(false);
        setSelectedPillarIds([]);
        setCustomRuleName('');
        setCustomTargetCount(2);
        fetchQuotas(true);
      } else {
        const d = await res.json();
        showToast(d.error ?? 'Failed to create rule.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (id: string, name: string) => {
    if (!confirm(`Delete rule "${name}"?`)) return;
    try {
      const res = await fetch(`/api/pillar-quotas?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Rule "${name}" deleted.`, 'info');
        setPillarRules(prev => prev.filter(r => r.id !== id));
      } else {
        showToast('Failed to delete rule.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    }
  };

  const saveWeeklyQuotas = async () => {
    setSavingQuotas(true);
    try {
      const res = await fetch('/api/pillar-quotas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rules: pillarRules.map(r => ({ id: r.id, target_count: r.target_count }))
        })
      });
      if (res.ok) {
        showToast('Weekly pillar quotas saved.', 'success');
        fetchQuotas();
      } else {
        const d = await res.json();
        showToast(d.error ?? 'Save failed.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSavingQuotas(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {ToastEl}

      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#2C2C2C]">
          <span>Pillar Strategy</span> <span className="font-serif-italic font-normal" style={{ color: '#776497' }}>& Quotas</span>
        </h1>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-base text-[#2C2C2C]">
              Weekly Target Quotas
            </h3>
            <p className="text-xs text-[#8B8A93]">
              Configure weekly target quotas for individual pillars or merged combinations (e.g. Value + Authority).
            </p>
          </div>

          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm flex-shrink-0 cursor-pointer text-white bg-[#A78BE0] hover:bg-[#9070CC]">
            <Plus size={14} /> Combine / Add Pillar Rule
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {pillarRules.map((rule, rIdx) => {
            const isQuotaReached = rule.used_this_week >= rule.target_count && rule.target_count > 0;
            const cardBg = rIdx % 3 === 0
              ? 'linear-gradient(135deg, rgba(187,178,245,0.15) 0%, rgba(255,255,255,0.96) 100%)'
              : rIdx % 3 === 1
                ? 'linear-gradient(135deg, rgba(214,236,114,0.18) 0%, rgba(255,255,255,0.96) 100%)'
                : 'linear-gradient(135deg, rgba(210,212,218,0.22) 0%, rgba(255,255,255,0.96) 100%)';
            const cardBorder = rIdx % 3 === 0 ? 'rgba(187,178,245,0.35)' : rIdx % 3 === 1 ? 'rgba(214,236,114,0.40)' : 'rgba(210,212,218,0.35)';

            return (
              <div key={rule.id} className="flex items-center justify-between px-5 py-4 rounded-2xl border transition-all hover:shadow-md"
                style={{ background: cardBg, borderColor: cardBorder }}>

                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0"
                    style={{ background: rule.is_hybrid ? 'rgba(168, 85, 247, 0.2)' : 'rgba(124, 58, 237, 0.15)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                    {rule.is_hybrid ? <Layers size={18} /> : rule.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{rule.name}</h4>
                      {rule.is_hybrid && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid #c084fc' }}>
                          Merged Combo
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Status this week: <strong style={{ color: isQuotaReached ? '#ef4444' : 'var(--accent)' }}>{rule.used_this_week} of {rule.target_count} posts saved</strong>
                      </p>

                      {rule.pillar_names.length > 0 && (
                        <div className="flex gap-1 ml-2">
                          {rule.pillar_names.map(pName => (
                            <span key={pName} className="text-[10px] px-1.5 py-0.2 rounded"
                              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                              {pName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Target / Week:</span>
                    <input
                      type="number"
                      min={0}
                      max={7}
                      value={rule.target_count}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setPillarRules(prev => prev.map(item => item.id === rule.id ? { ...item, target_count: val } : item));
                      }}
                      className="w-16 text-center text-sm font-bold rounded-lg px-2 py-1.5"
                      style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <button onClick={() => handleDeleteRule(rule.id, rule.name)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors border"
                    style={{ borderColor: 'var(--border)' }}
                    title={`Delete "${rule.name}" rule`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={saveWeeklyQuotas} disabled={savingQuotas}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
            style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 16px var(--accent-glow)' }}>
            {savingQuotas ? <><Loader2 size={14} className="spinner" /> Saving…</> : <><Save size={14} /> Save Weekly Quotas</>}
          </button>
        </div>
      </div>

      {/* Pop-up Modal: Combine / Add Pillar Rule */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-lg rounded-2xl border p-6 animate-scale-in relative shadow-2xl"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

            <button onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border transition-colors hover:bg-white/5"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(124, 58, 237, 0.2)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Combine / Create Pillar Rule</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Merge 1 or more content pillars into a single weekly quota option.
                </p>
              </div>
            </div>

            {/* Checkbox Selection */}
            <div className="space-y-3 mb-5">
              <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Select Content Pillars to Merge
              </label>

              <div className="grid grid-cols-2 gap-2.5">
                {basePostTypes.map(pt => {
                  const isChecked = selectedPillarIds.includes(pt.id);
                  return (
                    <label key={pt.id}
                      onClick={() => handleTogglePillar(pt.id)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all select-none ${isChecked ? 'border-purple-500 bg-purple-500/10' : 'border-gray-800 hover:border-gray-700'
                        }`}>
                      <input type="checkbox" checked={isChecked} onChange={() => { }} className="hidden" />
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${isChecked ? 'bg-purple-600 border-purple-500' : 'border-gray-600'
                        }`}>
                        {isChecked && <Check size={10} className="text-white" />}
                      </div>
                      <span className="text-xs font-semibold" style={{ color: isChecked ? 'var(--accent)' : 'var(--text-primary)' }}>
                        {pt.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Rule Name Input */}
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Pillar Option Name in Studio
              </label>
              <input
                type="text"
                value={customRuleName}
                onChange={e => setCustomRuleName(e.target.value)}
                placeholder="e.g. Value + Authority"
                className="w-full text-sm font-semibold rounded-xl px-3.5 py-2.5"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Target Count Input */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Target Posts per Week
              </label>
              <input
                type="number"
                min={1}
                max={7}
                value={customTargetCount}
                onChange={e => setCustomTargetCount(parseInt(e.target.value) || 1)}
                className="w-full text-sm font-semibold rounded-xl px-3.5 py-2.5"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleCreateRule} disabled={creatingRule}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold shadow-sm"
                style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 10px rgba(108,99,255,0.3)' }}>
                {creatingRule ? <Loader2 size={13} className="spinner" /> : null}
                Save Pillar Rule
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}


