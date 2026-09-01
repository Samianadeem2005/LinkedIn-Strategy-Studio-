'use client';

import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough as StrikeIcon,
  List,
  ListOrdered,
  Eraser,
  Copy,
  Calendar as ScheduleIcon,
  Send,
  Smartphone,
  Monitor,
  Smile,
  Globe,
  ThumbsUp,
  MessageSquare,
  Repeat,
  ImageIcon,
  Undo2,
  Redo2,
  ArrowUpDown
} from 'lucide-react';

import {
  toBoldSerif,
  toBoldSans,
  toItalicSerif,
  toItalicSans,
  toBoldItalicSerif,
  toBoldItalicSans,
  toSans,
  toUnderline,
  toStrikethrough,
  toBoldUnderline,
  toBoldStrikethrough,
  toScript,
  toDoubleStruck,
  toFullwidth,
  toUppercase,
  toLowercase,
  toNumberedList,
  toBulletList,
  toChecklist,
  toAscendingList,
  toDescendingList,
  unformatText
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
  { id: 'bold', label: 'Bold', fn: toBoldSerif },
  { id: 'bold_sans', label: 'Bold Sans', fn: toBoldSans },
  { id: 'italic', label: 'Italic', fn: toItalicSerif },
  { id: 'italic_sans', label: 'Italic Sans', fn: toItalicSans },
  { id: 'bold_italic', label: 'Bold Italic', fn: toBoldItalicSerif },
  { id: 'bold_italic_sans', label: 'Bold Italic Sans', fn: toBoldItalicSans },
  { id: 'sans', label: 'Sans', fn: toSans },
  { id: 'underline', label: 'Underline', fn: toUnderline },
  { id: 'strikethrough', label: 'Strikethrough', fn: toStrikethrough },
  { id: 'bold_underline', label: 'Bold Underline', fn: toBoldUnderline },
  { id: 'bold_strikethrough', label: 'Bold Strikethrough', fn: toBoldStrikethrough },
  { id: 'script', label: 'Script', fn: toScript },
  { id: 'doublestruck', label: 'Doublestruck', fn: toDoubleStruck },
  { id: 'fullwidth', label: 'Fullwidth', fn: toFullwidth },
  { id: 'uppercase', label: 'Uppercase', fn: toUppercase },
  { id: 'lowercase', label: 'Lowercase', fn: toLowercase },
  { id: 'numbered_list', label: 'Numbered List', fn: toNumberedList },
  { id: 'bullet_points', label: 'Bullet Points', fn: toBulletList },
  { id: 'checklist', label: 'Checklist', fn: toChecklist },
  { id: 'ascending_list', label: 'Ascending List', fn: toAscendingList },
  { id: 'descending_list', label: 'Descending List', fn: toDescendingList },
];

export default function FormatterPage() {
  const { show: showToast, ToastEl } = useToast();

  const [text, setText] = useState<string>('jargon');

  // History stack for Undo/Redo
  const [history, setHistory] = useState<string[]>(['jargon']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Device preview mode
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Emoji popover
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // User profile details for preview
  const [userProfile] = useState({
    name: 'Samia Nadeem',
    headline: 'xNetsol Intern | I turn ideas into AI products | LLM Integration · AI Agents · MCP · RAG | BSSE’27'
  });

  const [savingDraft, setSavingDraft] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateTextWithHistory = (newVal: string) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newVal]);
    setHistoryIndex(prev => prev + 1);
    setText(newVal);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setText(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setText(history[historyIndex - 1]);
    }
  };

  // Format highlighted selection in main textarea
  const applyTransform = (transformFn: (str: string) => string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    let updated = '';
    if (start !== end) {
      const selected = text.substring(start, end);
      const transformed = transformFn(selected);
      updated = text.substring(0, start) + transformed + text.substring(end);
    } else {
      updated = transformFn(text);
    }

    updateTextWithHistory(updated);

    setTimeout(() => {
      textarea.focus();
    }, 50);
  };

  const handleClearFormatting = () => {
    applyTransform(unformatText);
    showToast('Formatting cleared.', 'info');
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
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_summary: firstLine,
          raw_notes_used: 'Created via LinkedIn Formatter Tool',
          versions: [{
            version: 1,
            sections: { Content: text },
            visualSuggestion: 'Created in Text Formatter'
          }],
          selected_version: 0,
          status: 'draft'
        })
      });

      if (res.ok) {
        showToast('Scheduled / Saved to Drafts!', 'success');
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
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#ffffff',
        color: '#1a1a2e',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '32px 24px',
        boxSizing: 'border-box'
      }}
    >
      {ToastEl}

      <div style={{ maxWidth: '1150px', margin: '0 auto' }}>
        {/* Centered Large Title & Subtitle Header */}
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px auto' }}>
          <h1
            style={{
              fontSize: '36px',
              fontWeight: 800,
              color: '#0f2942',
              letterSpacing: '-0.02em',
              margin: '0 0 10px 0'
            }}
          >
            LinkedIn Text Formatter
          </h1>
          <p style={{ fontSize: '14px', color: '#475569', margin: 0, lineHeight: '1.5' }}>
            Easily format the text of your LinkedIn post with bold, italic, underlined and more for free.
          </p>
        </div>

        {/* TOP SECTION: Two Columns Side-by-Side (50/50 Split) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '0',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            marginBottom: '48px'
          }}
        >
          {/* LEFT COLUMN: Text Editor & Separate Individual Toolbar Buttons */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              borderRight: '1px solid #e2e8f0',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Toolbar Row: Separate, individually visible square icon buttons */}
            <div
              style={{
                padding: '12px font-sans',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
                backgroundColor: '#ffffff'
              }}
            >
              {/* Bold */}
              <button
                onClick={() => applyTransform(toBoldSans)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  color: '#334155',
                  cursor: 'pointer'
                }}
                title="Bold"
              >
                B
              </button>

              {/* Italic */}
              <button
                onClick={() => applyTransform(toItalicSans)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontStyle: 'italic',
                  fontFamily: 'serif',
                  color: '#334155',
                  cursor: 'pointer'
                }}
                title="Italic"
              >
                I
              </button>

              {/* Underline */}
              <button
                onClick={() => applyTransform(toUnderline)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  textDecoration: 'underline',
                  color: '#334155',
                  cursor: 'pointer'
                }}
                title="Underline"
              >
                U
              </button>

              {/* Strikethrough */}
              <button
                onClick={() => applyTransform(toStrikethrough)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  textDecoration: 'line-through',
                  color: '#334155',
                  cursor: 'pointer'
                }}
                title="Strikethrough"
              >
                S
              </button>

              {/* Emoji */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    width: '32px',
                    height: '32px',
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

              {/* Image */}
              <button
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
                title="Image Insert"
              >
                <ImageIcon size={15} />
              </button>

              {/* Link */}
              <button
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
                title="Link Insert"
              >
                <Globe size={15} />
              </button>

              {/* Undo */}
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  opacity: historyIndex <= 0 ? 0.3 : 1,
                  cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer'
                }}
                title="Undo"
              >
                <Undo2 size={15} />
              </button>

              {/* Redo */}
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  opacity: historyIndex >= history.length - 1 ? 0.3 : 1,
                  cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer'
                }}
                title="Redo"
              >
                <Redo2 size={15} />
              </button>

              {/* Clear Formatting */}
              <button
                onClick={handleClearFormatting}
                style={{
                  width: '32px',
                  height: '32px',
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
                onClick={() => applyTransform(toBulletList)}
                style={{
                  width: '32px',
                  height: '32px',
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
                onClick={() => applyTransform(toNumberedList)}
                style={{
                  width: '32px',
                  height: '32px',
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

              {/* Sort / Checklist */}
              <button
                onClick={() => applyTransform(toChecklist)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  cursor: 'pointer'
                }}
                title="Checklist / Sort"
              >
                <ArrowUpDown size={15} />
              </button>
            </div>

            {/* Main Text Area (Clean Sans-Serif) */}
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

              {/* Schedule (Orange Button) */}
              <button
                onClick={handleSaveToDrafts}
                disabled={savingDraft}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  backgroundColor: '#ff7a00',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(255,122,0,0.2)'
                }}
              >
                <ScheduleIcon size={14} /> {savingDraft ? 'Saving...' : 'Schedule'}
              </button>

              {/* Post Now (Bright Blue Button) */}
              <button
                onClick={() => copyToClipboard(text, 'Formatted Post')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  backgroundColor: '#1b84ff',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(27,132,255,0.2)'
                }}
              >
                <Send size={14} /> Post now
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
                  maxWidth: previewMode === 'mobile' ? '340px' : '460px',
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
                  {/* Profile Avatar / DP Container */}
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

                {/* Post Text (Clean Sans-Serif) */}
                <div
                  style={{
                    fontSize: '13px',
                    lineHeight: '1.5',
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

        {/* BOTTOM SECTION: 3-COLUMN GRID OF STYLE VARIATIONS */}
        <div style={{ marginTop: '36px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2942', marginBottom: '24px' }}>
            All Unicode Style Variations
          </h2>

          {/* 3-Column Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '24px'
            }}
          >
            {ALL_STYLE_CARDS.map(card => {
              const formatted = card.fn(text);
              return (
                <div key={card.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    {card.label}
                  </label>
                  
                  {/* Clean Sans-Serif Formatted Box */}
                  <div
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#ffffff',
                      minHeight: '64px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      color: '#0f172a',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    {formatted}
                  </div>

                  {/* Soft Light-Blue Copy Text Button */}
                  <button
                    onClick={() => copyToClipboard(formatted, card.label)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
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
                    <Copy size={13} /> Copy text
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
