'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { FileText, Trash2, Copy, Loader2, Sparkles, Save, Check, Calendar, Type } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface PostVersion {
  version: number;
  sections: Record<string, string>;
  visualSuggestion?: string;
  resources?: string[];
}

interface PostItem {
  id: string;
  date: string;
  post_type_id: string;
  post_type_name: string;
  topic_summary: string;
  raw_notes_used: string;
  versions: PostVersion[];
  selected_version: number;
  status: string;
  post_format?: string;
  character_count?: number;
  created_at: string;
}

const formatNames: Record<string, string> = {
  'text_post': 'Text Post (600–1,200 chars)',
  'image_post': 'Image Post (900–1,500 chars)',
  'carousel': 'Carousel (1,200–1,500 chars)',
  'video_post': 'Video Post (500–800 chars)'
};

const extractUnifiedText = (sections: Record<string, string>): string => {
  if (!sections) return '';
  if (sections.Content) return sections.Content;
  if (sections.FullPost) return sections.FullPost;
  return Object.values(sections)
    .map(val => (typeof val === 'string' ? val.trim() : ''))
    .filter(Boolean)
    .join('\n\n');
};

export default function DraftsPage() {
  const router = useRouter();
  const { show: showToast, ToastEl } = useToast();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Local state for draft text edits
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleFormatDraft = (post: PostItem) => {
    const activeVer = post.versions[post.selected_version || 0] || post.versions[0];
    const textToFormat = editedTexts[post.id] !== undefined
      ? editedTexts[post.id]
      : extractUnifiedText(activeVer?.sections || {});

    try {
      sessionStorage.setItem('format_input_text', textToFormat);
      sessionStorage.setItem('format_draft_id', post.id);
    } catch { }
    router.push(`/formatter?draftId=${post.id}`);
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts?limit=100');
      if (res.ok) {
        const data: PostItem[] = await res.json();
        setPosts(data);

        // Initialize edited text map
        const initialTexts: Record<string, string> = {};
        data.forEach(post => {
          const activeVer = post.versions[post.selected_version || 0] || post.versions[0];
          initialTexts[post.id] = extractUnifiedText(activeVer?.sections || {});
        });
        setEditedTexts(initialTexts);
      } else {
        showToast('Failed to load drafts.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleTextChange = (postId: string, text: string) => {
    setEditedTexts(prev => ({ ...prev, [postId]: text }));
    setSavedStatus(prev => ({ ...prev, [postId]: false }));
  };

  const handleDateChange = async (postId: string, newDate: string) => {
    if (!newDate) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate })
      });
      if (res.ok) {
        showToast('Draft date updated!', 'success');
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, date: newDate } : p));
      } else {
        showToast('Failed to update date.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    }
  };

  const handleSaveDraft = async (post: PostItem) => {
    const textToSave = editedTexts[post.id];
    if (textToSave === undefined) return;

    setSavingIds(prev => ({ ...prev, [post.id]: true }));
    try {
      const updatedVersions = [...(post.versions || [])];
      const targetIndex = post.selected_version || 0;

      // Save all together under unified content section, completely removing anatomy labels
      updatedVersions[targetIndex] = {
        ...updatedVersions[targetIndex],
        sections: { Content: textToSave }
      };

      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versions: updatedVersions,
          character_count: textToSave.length
        })
      });

      if (res.ok) {
        showToast('Draft content saved!', 'success');
        setSavedStatus(prev => ({ ...prev, [post.id]: true }));

        // Update local posts array
        setPosts(prev => prev.map(p => {
          if (p.id === post.id) {
            return {
              ...p,
              versions: updatedVersions,
              character_count: textToSave.length
            };
          }
          return p;
        }));
      } else {
        showToast('Failed to save draft content.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSavingIds(prev => ({ ...prev, [post.id]: false }));
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Draft deleted.', 'info');
        setPosts(prev => prev.filter(p => p.id !== id));
      } else {
        showToast('Failed to delete draft.', 'error');
      }
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setActionLoadingId(null);
      setDeleteConfirmId(null);
    }
  };

  const handleCopyText = (post: PostItem) => {
    const activeVer = post.versions[post.selected_version || 0] || post.versions[0];
    const currentText = editedTexts[post.id] !== undefined
      ? editedTexts[post.id]
      : extractUnifiedText(activeVer?.sections || {});

    if (!currentText.trim()) {
      showToast('No content available to copy.', 'error');
      return;
    }

    const textToCopy = currentText.replace(/\r\n/g, '\n');
    console.log('[Copy Text Debug] Copying exact text length:', textToCopy.length, 'has double newlines:', textToCopy.includes('\n\n'));
    navigator.clipboard.writeText(textToCopy);
    showToast('Draft text copied to clipboard!', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {ToastEl}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#2C2C2C]">
              <span>Saved</span> <span className="font-serif-italic font-normal">Drafts</span>
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#8B8A93]/10 text-[#8B8A93] border border-[#8B8A93]/20">
              {posts.length} saved
            </span>
          </div>
          <p className="text-xs text-[#8B8A93] mt-0.5">
            Your generated posts saved as drafts. Edit text directly in unified scrollable cards.
          </p>
        </div>

        <Link href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#A78BE0] text-white hover:bg-[#9070CC] shadow-sm">
          <Sparkles size={14} /> Open Studio
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={24} className="spinner" />
          <p className="text-sm">Loading drafts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border p-8"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <FileText size={40} className="mb-3" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
            No saved drafts found
          </h3>
          <p className="text-xs max-w-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Generate posts in Studio and click &quot;Save to Drafts&quot; to store them here.
          </p>
          <Link href="/" className="px-4 py-2 rounded-lg text-xs font-medium" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            Go to Studio
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {posts.map(post => {
            const activeVer = post.versions[post.selected_version || 0] || post.versions[0];
            const formatLabel = formatNames[post.post_format || 'text_post'] || 'Text Post';
            const currentText = editedTexts[post.id] !== undefined ? editedTexts[post.id] : extractUnifiedText(activeVer?.sections || {});
            const savedText = extractUnifiedText(activeVer?.sections || {});
            const isModified = currentText !== savedText;
            const isSaving = savingIds[post.id] || false;
            const isJustSaved = savedStatus[post.id] || false;

            const postDate = post.date || post.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10);
            const formattedDateStr = postDate ? new Date(postDate.includes('T') ? postDate : postDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Set Date';

            return (
              <div key={post.id} className="rounded-2xl border p-5 flex flex-col justify-between transition-all hover:border-purple-500/40"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>

                <div>
                  {/* Badges Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                        {post.post_type_name || 'Pillar Post'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                        {formatLabel.split(' ')[0]} {formatLabel.split(' ')[1]}
                      </span>
                      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {currentText.length} chars
                      </span>
                    </div>

                    {/* Interactive Date Picker */}
                    <input
                      type="date"
                      value={postDate.slice(0, 10)}
                      onChange={(e) => handleDateChange(post.id, e.target.value)}
                      className="px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-all hover:bg-white/10 hover:border-purple-500/50 cursor-pointer outline-none"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border)',
                        color: 'var(--text-muted)',
                        colorScheme: 'dark',
                        fontSize: '11px'
                      }}
                      title="Click to change date"
                    />
                  </div>

                  {/* Title / Topic */}
                  <h3 className="font-semibold text-sm mb-3 leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {post.topic_summary || 'Untitled Draft'}
                  </h3>

                  {/* Unified Scrollable & Editable Text Box */}
                  <div className="relative mb-4">
                    <textarea
                      value={currentText}
                      onChange={(e) => handleTextChange(post.id, e.target.value)}
                      onBlur={() => {
                        if (isModified) handleSaveDraft(post);
                      }}
                      rows={7}
                      placeholder="Draft content..."
                      className="w-full p-3.5 rounded-xl border text-xs leading-relaxed transition-all overflow-y-auto focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      style={{
                        background: 'var(--bg-primary)',
                        borderColor: isModified ? 'var(--accent)' : 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                        resize: 'vertical',
                        minHeight: '150px',
                        maxHeight: '280px',
                        whiteSpace: 'pre-wrap'
                      }}
                    />
                    {isModified && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-semibold"
                        style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.4)' }}>
                        Unsaved changes
                      </span>
                    )}
                  </div>

                  {/* Visual Suggestion badge */}
                  {activeVer?.visualSuggestion && (
                    <p className="text-[11px] italic mb-2" style={{ color: 'var(--text-muted)' }}>
                      🎨 Visual: {activeVer.visualSuggestion}
                    </p>
                  )}

                  {/* Resources preview */}
                  {activeVer?.resources && activeVer.resources.length > 0 && (
                    <div className="mb-4 text-[11px]" style={{ color: '#60a5fa' }}>
                      <strong className="block mb-0.5">📚 Resources ({activeVer.resources.length}):</strong>
                      {activeVer.resources.slice(0, 2).map((res, i) => (
                        <p key={i} className="truncate">• {res}</p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleCopyText(post)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                      style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                      title="Copy full draft text">
                      <Copy size={13} /> Copy Text
                    </button>

                    <button onClick={() => handleFormatDraft(post)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#8B8A93]/15 text-[#8B8A93] border border-[#8B8A93]/30 hover:bg-[#8B8A93]/25"
                      title="Open and format this draft in LinkedIn Formatter">
                      <Type size={13} /> Format Draft
                    </button>

                    {isModified && (
                      <button onClick={() => handleSaveDraft(post)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                        title="Save changes to database">
                        {isSaving ? <Loader2 size={13} className="spinner" /> : <Save size={13} />}
                        <span>Save</span>
                      </button>
                    )}

                    {!isModified && isJustSaved && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2 py-1 rounded">
                        <Check size={13} /> Saved
                      </span>
                    )}
                  </div>

                  {deleteConfirmId === post.id ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleDelete(post.id)}
                        disabled={actionLoadingId === post.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-sm"
                        title="Click to confirm deletion">
                        {actionLoadingId === post.id ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
                        <span>Confirm Delete?</span>
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10"
                        title="Cancel deletion">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(post.id)}
                      disabled={actionLoadingId === post.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-red-500/10 text-red-400 border"
                      style={{ borderColor: 'var(--border)' }}
                      title="Delete draft">
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}




