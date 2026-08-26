'use client';

import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface TagInputProps {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  accentColor?: string;
  error?: string;
}

export default function TagInput({ label, tags, onChange, placeholder = 'Type and press Enter', accentColor = 'var(--accent)', error }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const add = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const remove = (idx: number) => onChange(tags.filter((_, i) => i !== idx));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !inputValue && tags.length) remove(tags.length - 1);
  };

  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="min-h-[42px] px-2 py-1.5 rounded-lg border flex flex-wrap gap-1.5 items-center cursor-text transition-colors"
        style={{ background: 'var(--bg-primary)', borderColor: error ? 'var(--danger)' : 'var(--border)' }}
        onClick={() => document.getElementById(`tag-input-${label}`)?.focus()}>
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
            style={{ background: accentColor + '22', color: accentColor, border: `1px solid ${accentColor}44` }}>
            {tag}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); }} className="hover:opacity-75">
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          id={`tag-input-${label}`}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => { if (inputValue.trim()) add(); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)', fontSize: '13px' }}
        />
        {inputValue && (
          <button type="button" onClick={add} className="p-0.5 rounded" style={{ color: accentColor }}>
            <Plus size={12} />
          </button>
        )}
      </div>
      {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}
