'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import {
  Smile,
  Globe,
  ThumbsUp,
  MessageSquare,
  Repeat,
  ImageIcon,
  Eraser,
  Copy,
  Calendar as ScheduleIcon,
  Send,
  Save,
  FileText,
  Smartphone,
  Monitor,
  List,
  ListOrdered,
  SquareCheck,
  ArrowUpDown,
  Type,
  ChevronDown
} from 'lucide-react';

import {
  toBoldSerif,
  toBoldSans,
  toItalicSerif,
  toItalicSans,
  toBoldItalicSerif,
  toBoldItalicSans,
  toSans,
  toScript,
  toDoubleStruck,
  toMonospace,
  toFullwidth,
  toUppercase,
  toLowercase,
  toNumberedList,
  toBulletList,
  toChecklist,
  toAscendingList,
  toDescendingList,
  unformatText,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrikethrough,
  applyFontToText
} from '@/lib/unicodeFormatter';

const EMOJI_LIST = [
  '🚀', '💡', '📌', '✅', '🔥', '📊', '🎯', '🧠', '⚡', '📈',
  '🎨', '🛠️', '📚', '✍️', '💻', '🌟', '💰', '📢', '🤝', '💎',
  '👇', '👉', '💬', '🎉', '🏆', '👀', '⏳', '✨', '🌍', '🛠'
];

interface StyleCardDef {
  id: string;
  label: string;
  fn: (text: string) => string;
}

const ALL_STYLE_CARDS: StyleCardDef[] = [
  { id: 'normal', label: 'Normal', fn: (t) => t },
  { id: 'bold', label: 'Bold Serif', fn: toBoldSerif },
  { id: 'bold_sans', label: 'Bold Sans', fn: toBoldSans },
  { id: 'italic', label: 'Italic Serif', fn: toItalicSerif },
  { id: 'italic_sans', label: 'Italic Sans', fn: toItalicSans },
  { id: 'bold_italic', label: 'Bold Italic Serif', fn: toBoldItalicSerif },
  { id: 'bold_italic_sans', label: 'Bold Italic Sans', fn: toBoldItalicSans },
  { id: 'sans', label: 'Sans Regular', fn: toSans },
  { id: 'script', label: 'Script', fn: toScript },
  { id: 'doublestruck', label: 'Double Struck', fn: toDoubleStruck },
  { id: 'monospace', label: 'Monospace', fn: toMonospace },
  { id: 'fullwidth', label: 'Fullwidth', fn: toFullwidth },
  { id: 'uppercase', label: 'Uppercase', fn: toUppercase },
  { id: 'lowercase', label: 'Lowercase', fn: toLowercase },
  { id: 'numbered_list', label: 'Numbered List', fn: toNumberedList },
  { id: 'bullet_points', label: 'Bullet Points', fn: toBulletList },
  { id: 'checklist', label: 'Checklist', fn: toChecklist },
  { id: 'ascending_list', label: 'Ascending List', fn: toAscendingList },
  { id: 'descending_list', label: 'Descending List', fn: toDescendingList },
];

interface FontOptionDef {
  id: string;
  label: string;
  sample: string;
}

const FONT_OPTIONS: FontOptionDef[] = [
  { id: 'normal', label: 'Normal', sample: 'Aa' },
  { id: 'bold', label: 'Bold Serif', sample: '𝗔a' },
  { id: 'bold_sans', label: 'Bold Sans', sample: '𝘼a' },
  { id: 'italic', label: 'Italic Serif', sample: '𝐴a' },
  { id: 'italic_sans', label: 'Italic Sans', sample: '𝘈a' },
  { id: 'bold_italic', label: 'Bold Italic Serif', sample: '𝐴a' },
  { id: 'bold_italic_sans', label: 'Bold Italic Sans', sample: '𝘼a' },
  { id: 'sans', label: 'Sans Regular', sample: '𝖠a' },
  { id: 'script', label: 'Script', sample: '𝒜a' },
  { id: 'doublestruck', label: 'Double Struck', sample: '𝔸a' },
  { id: 'monospace', label: 'Monospace', sample: '𝙰a' },
  { id: 'fullwidth', label: 'Fullwidth', sample: 'Ａa' },
  { id: 'strikethrough', label: 'Strikethrough', sample: 'S̶a̶' },
];

export default function FormatterPage() {
  const { show: showToast, ToastEl } = useToast();

  const [text, setText] = useState<string>('');

  // History stack for Undo/Redo
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Device preview mode
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Emoji popover
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Custom Font Dropdown State & Hover Preview Refs
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);
  const [hoveredFontId, setHoveredFontId] = useState<string | null>(null);
  const fontDropdownRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const originalTextBeforeHoverRef = useRef<string | null>(null);

  // User profile details for preview
  const [userProfile] = useState({
    name: 'Samia Nadeem',
    headline: 'xNetsol Intern | I turn ideas into AI products | LLM Integration · AI Agents · MCP · RAG | BSSE’27'
  });

  const [savingDraft, setSavingDraft] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitializedRef = useRef(false);

  // Check for text and draft ID transferred from Drafts or Content Studio on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const draftIdFromUrl = urlParams.get('draftId');
      const draftIdFromStorage = sessionStorage.getItem('format_draft_id');
      const activeDraftId = draftIdFromUrl || draftIdFromStorage;

      if (activeDraftId) {
        setEditingDraftId(activeDraftId);
      }

      const transferredText = sessionStorage.getItem('format_input_text');
      if (transferredText && transferredText.trim()) {
        setText(transferredText);
        setHistory([transferredText]);
        setHistoryIndex(0);
        showToast(activeDraftId ? 'Loaded draft into Formatter!' : 'Loaded post text into Formatter!', 'success');
      }
    } catch { }
  }, [showToast]);

  const handleClearDraftContext = () => {
    setEditingDraftId(null);
    try {
      sessionStorage.removeItem('format_draft_id');
    } catch { }
    showToast('Switched to new draft mode.', 'info');
  };

  const updateTextWithHistory = (newVal: string) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newVal]);
    setHistoryIndex(prev => prev + 1);
    setText(newVal);
  };

  // Format highlighted selection in main textarea ONLY
  const applyTransformToSelection = (transformFn: (str: string) => string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      showToast('Please select/highlight text in the editor first.', 'info');
      return;
    }

    const selected = text.substring(start, end);
    const transformed = transformFn(selected);
    const updated = text.substring(0, start) + transformed + text.substring(end);

    updateTextWithHistory(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + transformed.length);
    }, 50);
  };

  // Toggle custom font dropdown & capture selection snapshot
  const toggleFontDropdown = () => {
    if (isFontDropdownOpen) {
      closeFontDropdown();
      return;
    }

    const textarea = textareaRef.current;
    let start = 0;
    let end = text.length;

    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      start = textarea.selectionStart;
      end = textarea.selectionEnd;
    }

    savedSelectionRef.current = { start, end };
    originalTextBeforeHoverRef.current = text;
    setIsFontDropdownOpen(true);
  };

  const closeFontDropdown = () => {
    if (originalTextBeforeHoverRef.current !== null) {
      setText(originalTextBeforeHoverRef.current);
    }
    savedSelectionRef.current = null;
    originalTextBeforeHoverRef.current = null;
    setHoveredFontId(null);
    setIsFontDropdownOpen(false);
  };

  // Live hover preview handler: applies font style on hover
  const handleFontOptionHover = (fontId: string) => {
    setHoveredFontId(fontId);

    if (!savedSelectionRef.current || originalTextBeforeHoverRef.current === null) return;

    const { start, end } = savedSelectionRef.current;
    const baseText = originalTextBeforeHoverRef.current;
    const targetSlice = baseText.substring(start, end);
    const transformedSlice = applyFontToText(targetSlice, fontId);
    const previewFullText = baseText.substring(0, start) + transformedSlice + baseText.substring(end);

    setText(previewFullText);
  };

  // Mouse leave dropdown panel handler -> reverts preview back to original text
  const handleFontDropdownMouseLeave = () => {
    setHoveredFontId(null);
    if (originalTextBeforeHoverRef.current !== null) {
      setText(originalTextBeforeHoverRef.current);
    }
  };

  // Click handler -> permanently applies font style to history & text
  const handleFontOptionSelect = (fontId: string) => {
    if (!savedSelectionRef.current || originalTextBeforeHoverRef.current === null) {
      closeFontDropdown();
      return;
    }

    const { start, end } = savedSelectionRef.current;
    const baseText = originalTextBeforeHoverRef.current;
    const targetSlice = baseText.substring(start, end);
    const transformedSlice = applyFontToText(targetSlice, fontId);
    const finalFullText = baseText.substring(0, start) + transformedSlice + baseText.substring(end);

    updateTextWithHistory(finalFullText);

    savedSelectionRef.current = null;
    originalTextBeforeHoverRef.current = null;
    setHoveredFontId(null);
    setIsFontDropdownOpen(false);

    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(start, start + transformedSlice.length);
      }
    }, 50);
  };

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target as Node)) {
        if (isFontDropdownOpen) {
          closeFontDropdown();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFontDropdownOpen]);

  const handleClearFormatting = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) {
      applyTransformToSelection(unformatText);
    } else {
      updateTextWithHistory(unformatText(text));
      showToast('All text formatting cleared.', 'info');
    }
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const updated = text.substring(0, start) + emoji + text.substring(end);
    updateTextWithHistory(updated);
    setShowEmojiPicker(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 50);
  };

  const copyToClipboard = (str: string, styleName?: string) => {
    if (!str.trim()) {
      showToast('No text to copy.', 'error');
      return;
    }
    const textToCopy = str.replace(/\r\n/g, '\n');
    navigator.clipboard.writeText(textToCopy);
    showToast(`${styleName ? `${styleName} text` : 'Text'} copied to clipboard!`, 'success');
  };

  const handleSaveToDrafts = async () => {
    if (!text.trim()) {
      showToast('No text to save.', 'error');
      return;
    }

    setSavingDraft(true);
    try {
      const firstLine = text.split('\n')[0]?.slice(0, 60) || 'Formatted Post Draft';
      let versionsPayload: any[] = [{
        version: 1,
        sections: { Content: text },
        visualSuggestion: 'Formatted in Text Formatter'
      }];

      let res: Response;
      if (editingDraftId) {
        // Fetch existing post to preserve visual suggestions, resources, etc.
        try {
          const fetchExisting = await fetch(`/api/posts/${editingDraftId}`);
          if (fetchExisting.ok) {
            const existingPost = await fetchExisting.json();
            if (existingPost?.versions && Array.isArray(existingPost.versions) && existingPost.versions.length > 0) {
              const targetIdx = existingPost.selected_version || 0;
              const existingVer = existingPost.versions[targetIdx] || existingPost.versions[0];
              const updatedVer = {
                ...existingVer,
                sections: { Content: text }
              };
              const newVersionsList = [...existingPost.versions];
              newVersionsList[targetIdx] = updatedVer;
              versionsPayload = newVersionsList;
            }
          }
        } catch { }

        // OVERRIDE existing draft in database (preserving visual suggestions and resources)
        res = await fetch(`/api/posts/${editingDraftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_summary: firstLine,
            versions: versionsPayload,
            character_count: text.length
          })
        });
      } else {
        // Create NEW draft in database
        res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic_summary: firstLine,
            raw_notes_used: 'Created via LinkedIn Formatter Tool',
            versions: versionsPayload,
            selected_version: 0,
            status: 'draft'
          })
        });
      }

      if (res.ok) {
        showToast(editingDraftId ? 'Existing draft overridden and updated!' : 'Saved to Drafts!', 'success');
      } else {
        showToast('Failed to save draft.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-transparent text-[#1C1C1E] p-6 max-w-7xl mx-auto font-sans animate-fade-in"
    >
      {ToastEl}

      <div style={{ maxWidth: '1150px', margin: '0 auto' }}>
        {/* Centered Large Title & Subtitle Header */}
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px auto' }}>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1C1C1E] tracking-tight mb-2">
            Format & Craft <span className="font-serif-italic font-normal">your LinkedIn posts</span>
          </h1>
          <p style={{ fontSize: '14px', color: '#8B8A93', margin: 0, lineHeight: '1.5' }}>
            Format your LinkedIn posts with bold, italic, underlined, custom fonts and multi-styling.
          </p>
        </div>

        {/* TOP SECTION: Two Columns Side-by-Side (50/50 Split) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '0',
            border: '1px solid rgba(255, 255, 255, 0.70)',
            borderRadius: '24px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.89)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.8), 0 10px 30px -5px rgba(0, 0, 0, 0.03)',
            marginBottom: '48px'
          }}
        >
          {/* LEFT COLUMN: Text Editor & Toolbar Controls */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderRight: '1px solid rgba(139, 138, 147, 0.15)',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Toolbar Row */}
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(139, 138, 147, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
                backgroundColor: '#EEECF1'
              }}
            >
              {/* Bold (Supports multi-formatting) */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTransformToSelection(toggleBold)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#1e293b',
                  cursor: 'pointer'
                }}
                title="Bold (Applies to selection)"
              >
                B
              </button>

              {/* Italic (Supports multi-formatting) */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTransformToSelection(toggleItalic)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontStyle: 'italic',
                  fontFamily: 'serif',
                  color: '#1e293b',
                  cursor: 'pointer'
                }}
                title="Italic (Applies to selection)"
              >
                I
              </button>

              {/* Underline (Supports multi-formatting) */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTransformToSelection(toggleUnderline)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  textDecoration: 'underline',
                  color: '#1e293b',
                  cursor: 'pointer'
                }}
                title="Underline (Applies to selection)"
              >
                U
              </button>

              {/* Emoji Popover */}
              <div style={{ position: 'relative' }}>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                  title="Insert Emoji"
                >
                  <Smile size={15} />
                </button>

                {showEmojiPicker && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '100%',
                      marginTop: '6px',
                      width: '240px',
                      padding: '10px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      zIndex: 40,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(6, 1fr)',
                      gap: '6px'
                    }}
                  >
                    {EMOJI_LIST.map(emoji => (
                      <button
                        key={emoji}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertEmoji(emoji)}
                        style={{
                          padding: '4px',
                          fontSize: '16px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Font Dropdown with Live Hover Preview */}
              <div style={{ position: 'relative' }} ref={fontDropdownRef}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleFontDropdown();
                  }}
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    backgroundColor: isFontDropdownOpen ? '#e2e8f0' : '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                  title="Select Font Style (Hover options to live preview)"
                >
                  <Type size={14} />
                  <span>Font Style</span>
                  <ChevronDown
                    size={14}
                    style={{
                      transform: isFontDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s ease'
                    }}
                  />
                </button>

                {isFontDropdownOpen && (
                  <div
                    onMouseLeave={handleFontDropdownMouseLeave}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: '6px',
                      width: '210px',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      zIndex: 50,
                      padding: '6px'
                    }}
                  >
                    {FONT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => handleFontOptionHover(opt.id)}
                        onClick={() => handleFontOptionSelect(opt.id)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: hoveredFontId === opt.id ? '#e0f2fe' : 'transparent',
                          color: hoveredFontId === opt.id ? '#0284c7' : '#1e293b',
                          fontSize: '12px',
                          fontWeight: 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background-color 0.1s ease'
                        }}
                      >
                        <span>{opt.label}</span>
                        <span style={{ fontSize: '12px', opacity: 0.85, fontWeight: 600 }}>{opt.sample}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Clear Formatting */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClearFormatting}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  cursor: 'pointer'
                }}
                title="Clear Formatting"
              >
                <Eraser size={15} />
              </button>

              {/* Bullet List */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTransformToSelection(toBulletList)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer'
                }}
                title="Bullet Points"
              >
                <List size={15} />
              </button>

              {/* Numbered List */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTransformToSelection(toNumberedList)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer'
                }}
                title="Numbered List"
              >
                <ListOrdered size={15} />
              </button>

              {/* Checkbox List */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTransformToSelection(toChecklist)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer'
                }}
                title="Checkbox List (☐)"
              >
                <SquareCheck size={15} />
              </button>
            </div>

            {/* Main Text Area */}
            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Write or paste your LinkedIn post here..."
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '240px',
                  padding: '8px',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#0f172a',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  whiteSpace: 'pre-wrap'
                }}
              />
            </div>

            {/* Bottom Row of 3 Buttons Side-by-Side */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: '#ffffff'
              }}
            >
              {/* Copy text (Light Sky-Blue Button) */}
              <button
                onClick={() => copyToClipboard(text, 'Post')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: '1px solid #bae6fd',
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Copy size={14} /> Copy text
              </button>

              {/* Draft now (Terracotta Primary Button) */}
              <button
                onClick={handleSaveToDrafts}
                disabled={savingDraft}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-white bg-[#A78BE0] hover:bg-[#9070CC] cursor-pointer shadow-sm disabled:opacity-40"
              >
                <Save size={14} /> {savingDraft ? 'Saving Draft...' : 'Draft now'}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Live LinkedIn Post Preview */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              backgroundColor: '#f5f5f0'
            }}
          >
            {/* Post Preview Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f5f5f0'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Post Preview
              </span>

              {/* Device Width Toggle Icons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => setPreviewMode('mobile')}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: previewMode === 'mobile' ? '#f1f5f9' : '#ffffff',
                    color: previewMode === 'mobile' ? '#0f172a' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Mobile Preview"
                >
                  <Smartphone size={14} />
                </button>
                <button
                  onClick={() => setPreviewMode('desktop')}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: previewMode === 'desktop' ? '#f1f5f9' : '#ffffff',
                    color: previewMode === 'desktop' ? '#0f172a' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Desktop Preview"
                >
                  <Monitor size={14} />
                </button>
              </div>
            </div>

            {/* LinkedIn Card Background Area */}
            <div style={{ padding: '24px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: previewMode === 'mobile' ? '360px' : '460px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  padding: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                }}
              >
                {/* Profile Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                    <img
                      src="/profile.jpg"
                      alt={userProfile.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src.endsWith('/profile.jpg')) {
                          target.src = '/profile.png';
                        } else {
                          target.style.display = 'none';
                          if (target.nextElementSibling) {
                            (target.nextElementSibling as HTMLElement).style.display = 'flex';
                          }
                        }
                      }}
                    />
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        backgroundColor: '#0077b5',
                        color: '#ffffff',
                        fontWeight: 'bold',
                        display: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                      }}
                    >
                      {userProfile.name[0] || 'S'}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#000000' }}>
                      {userProfile.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '2px' }} title={userProfile.headline}>
                      {userProfile.headline}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#9ca3af' }}>
                      <span>12h</span>
                      <span>•</span>
                      <Globe size={10} />
                    </div>
                  </div>
                </div>

                {/* Post Text */}
                <div
                  style={{
                    fontSize: previewMode === 'mobile' ? '15px' : '14px',
                    lineHeight: previewMode === 'mobile' ? '1.4' : '1.5',
                    letterSpacing: previewMode === 'mobile' ? '-0.1px' : 'normal',
                    color: '#111827',
                    marginBottom: '16px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                  }}
                >
                  {text || <span style={{ fontStyle: 'italic', color: '#9ca3af' }}>Your post text will appear here...</span>}
                </div>

                {/* Reactions Row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11px',
                    color: '#6b7280',
                    borderBottom: '1px solid #f3f4f6',
                    paddingBottom: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#0077b5', color: '#fff', fontSize: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '14px' }}>👍</span>
                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#e11d48', color: '#fff', fontSize: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', lineHeight: '14px' }}>❤️</span>
                    <span style={{ fontWeight: 600, color: '#374151', marginLeft: '2px' }}>57</span>
                  </div>
                  <div>
                    <span>24 comments</span> • <span>6 reposts</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', paddingTop: '4px' }}>
                  <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px', border: 'none', backgroundColor: 'transparent', fontSize: '11px', fontWeight: 600, color: '#4b5563', cursor: 'pointer', borderRadius: '4px' }}>
                    <ThumbsUp size={13} /> Like
                  </button>
                  <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px', border: 'none', backgroundColor: 'transparent', fontSize: '11px', fontWeight: 600, color: '#4b5563', cursor: 'pointer', borderRadius: '4px' }}>
                    <MessageSquare size={13} /> Comment
                  </button>
                  <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px', border: 'none', backgroundColor: 'transparent', fontSize: '11px', fontWeight: 600, color: '#4b5563', cursor: 'pointer', borderRadius: '4px' }}>
                    <Repeat size={13} /> Repost
                  </button>
                  <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px', border: 'none', backgroundColor: 'transparent', fontSize: '11px', fontWeight: 600, color: '#4b5563', cursor: 'pointer', borderRadius: '4px' }}>
                    <Send size={13} /> Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


