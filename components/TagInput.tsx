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

export default function TagInput({ label, tags, onChange, placeholder = 'Type and press Enter', accentColor = '#c94731', error }: TagInputProps) {
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
      <label className="block text-xs font-semibold mb-1.5 text-[#2c2c2c]">{label}</label>
      <div
        className={`min-h-[42px] px-3 py-2 rounded-xl border flex flex-wrap gap-2 items-center cursor-text transition-all duration-200 bg-[#f5f1f2] ${
          error ? 'border-[#c94731]' : 'border-[#4f6e7d]/20 focus-within:border-[#4f6e7d] focus-within:ring-2 focus-within:ring-[#4f6e7d]/20'
        }`}
        onClick={() => document.getElementById(`tag-input-${label}`)?.focus()}
      >
        {tags.map((tag, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#4f6e7d]/12 text-[#4f6e7d] border border-[#4f6e7d]/25 transition-all duration-150 hover:bg-[#4f6e7d]/20"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(i); }}
              className="hover:text-[#c94731] transition-colors cursor-pointer"
            >
              <X size={11} />
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
          className="flex-1 min-w-[100px] bg-transparent text-[#2c2c2c] text-xs placeholder-[#4f6e7d]/50 outline-none"
        />
        {inputValue && (
          <button
            type="button"
            onClick={add}
            className="w-5 h-5 rounded-full bg-[#c94731] text-white flex items-center justify-center cursor-pointer shadow-xs hover:bg-[#b83d28]"
          >
            <Plus size={11} />
          </button>
        )}
      </div>
      {error && <p className="text-xs mt-1 font-semibold text-[#c94731]">{error}</p>}
    </div>
  );
}
