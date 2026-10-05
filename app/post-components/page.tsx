'use client';

import { useEffect, useState } from 'react';

interface ComponentRow {
  id: string;
  name: string;
  description: string | null;
  component_type: string;
  purpose: string | null;
  instructions: string;
  order_index: number;
  enabled: number;
  anatomy_ids?: string[];
}

interface AnatomyRow { id: string; name: string; }

const emptyForm = {
  name: '', component_type: '', purpose: '', description: '',
  instructions: '', order_index: 0, enabled: true, anatomy_ids: [] as string[]
};

export default function PostComponentsPage() {
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [anatomies, setAnatomies] = useState<AnatomyRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [componentsRes, anatomiesRes] = await Promise.all([
      fetch('/api/post-components'),
      fetch('/api/anatomy')
    ]);
    const componentRows = await componentsRes.json();
    const anatomyRows = await anatomiesRes.json();
    const mapped = await Promise.all((componentRows as ComponentRow[]).map(async component => {
      const mappingRes = await fetch(`/api/post-components/${component.id}/mappings`);
      const mappings = await mappingRes.json();
      return { ...component, anatomy_ids: (mappings as { anatomy_id: string }[]).map(row => row.anatomy_id) };
    }));
    setComponents(mapped);
    setAnatomies(anatomyRows);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function edit(component: ComponentRow) {
    setEditingId(component.id);
    setForm({
      name: component.name,
      component_type: component.component_type,
      purpose: component.purpose || '',
      description: component.description || '',
      instructions: component.instructions,
      order_index: component.order_index,
      enabled: component.enabled === 1,
      anatomy_ids: component.anatomy_ids || []
    });
  }

  async function save() {
    const url = editingId ? `/api/post-components/${editingId}` : '/api/post-components';
    const response = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (!response.ok) { alert((await response.json()).error || 'Could not save component.'); return; }
    const saved = await response.json();
    const id = editingId || saved.id;
    await fetch(`/api/post-components/${id}/mappings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anatomy_ids: form.anatomy_ids })
    });
    setForm(emptyForm);
    setEditingId(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this post component?')) return;
    await fetch(`/api/post-components/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Post Components</h1>
          <p className="text-sm opacity-70 mt-1">Reusable composition blocks, separate from Anatomy thinking journeys.</p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-purple-600 text-white" onClick={() => { setEditingId(null); setForm(emptyForm); }}>New Component</button>
      </div>

      <section className="rounded-xl border p-5 mb-8 space-y-4">
        <h2 className="font-semibold">{editingId ? 'Edit component' : 'Create component'}</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input
            className="border rounded p-2"
            placeholder="Name (e.g. Hook, Body, Proof)"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value, component_type: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
          />
          <input className="border rounded p-2 bg-gray-100" aria-label="Component type" readOnly value={form.component_type || 'auto-generated'} />
          <input className="border rounded p-2" placeholder="Purpose" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
          <input className="border rounded p-2" type="number" placeholder="Order" value={form.order_index} onChange={e => setForm({ ...form, order_index: Number(e.target.value) })} />
        </div>
        <input className="border rounded p-2 w-full" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        <textarea className="border rounded p-2 w-full min-h-24" placeholder="Instructions sent to Gemini" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /> Enabled</label>
        <div>
          <p className="text-sm font-medium mb-2">Applicable Anatomies</p>
          <div className="flex flex-wrap gap-2">
            {anatomies.map(anatomy => (
              <label key={anatomy.id} className="text-xs border rounded px-2 py-1">
                <input type="checkbox" className="mr-1" checked={form.anatomy_ids.includes(anatomy.id)} onChange={e => setForm({
                  ...form,
                  anatomy_ids: e.target.checked ? [...form.anatomy_ids, anatomy.id] : form.anatomy_ids.filter(id => id !== anatomy.id)
                })} />
                {anatomy.name}
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-lg bg-purple-600 text-white" onClick={() => void save()}>Save</button>
          {editingId && <button className="px-4 py-2 rounded-lg border" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>}
        </div>
      </section>

      {loading ? <p>Loading components...</p> : (
        <div className="grid md:grid-cols-2 gap-4">
          {components.map(component => (
            <article key={component.id} className="rounded-xl border p-5">
              <div className="flex justify-between gap-3">
                <div><h3 className="font-semibold">{component.name}</h3><p className="text-xs opacity-60">{component.component_type} · order {component.order_index}</p></div>
                <span className="text-xs">{component.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <p className="text-sm mt-3 opacity-80">{component.instructions}</p>
              <div className="flex gap-2 mt-4">
                <button className="text-sm underline" onClick={() => edit(component)}>Edit</button>
                <button className="text-sm underline text-red-600" onClick={() => void remove(component.id)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
