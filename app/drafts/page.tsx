'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { FileText, Trash2, Copy, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface PostVersion {
  version: number;
  sections: Record<string, string>;
  visualSuggestion?: string;
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

export default function DraftsPage() {
  const { show: showToast, ToastEl } = useToast();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts?limit=100');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
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
    }
  };

  const handleCopyText = (post: PostItem) => {
    const activeVer = post.versions[post.selected_version || 0] || post.versions[0];
    if (!activeVer || !activeVer.sections) {
      showToast('No content available to copy.', 'error');
      return;
    }

    const text = Object.entries(activeVer.sections)
      .map(([heading, body]) => `${heading.toUpperCase()}\n${body}`)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    showToast('Draft text copied to clipboard!', 'success');
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {ToastEl}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent), #a78bfa)', color: 'white' }}>
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Drafts</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'var(--bg-elevated)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                {posts.length} saved
              </span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Your generated posts saved as drafts.
            </p>
          </div>
        </div>

        <Link href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 16px var(--accent-glow)' }}>
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
            const charCount = post.character_count || (activeVer?.sections ? Object.values(activeVer.sections).reduce((a, b) => a + (b?.length || 0), 0) : 0);

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
                        {charCount} chars
                      </span>
                    </div>

                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Title / Topic */}
                  <h3 className="font-semibold text-sm mb-2 leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {post.topic_summary || 'Untitled Draft'}
                  </h3>

                  {/* Section Previews */}
                  {activeVer?.sections && (
                    <div className="space-y-2 mb-4 p-3.5 rounded-xl border text-xs leading-relaxed"
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}>
                      {Object.entries(activeVer.sections).slice(0, 2).map(([secName, secText]) => (
                        <div key={secName} className="line-clamp-3">
                          <strong style={{ color: 'var(--accent)' }}>{secName}: </strong>
                          <span style={{ color: 'var(--text-secondary)' }}>{secText}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Visual Suggestion badge */}
                  {activeVer?.visualSuggestion && (
                    <p className="text-[11px] italic mb-4" style={{ color: 'var(--text-muted)' }}>
                      🎨 Visual: {activeVer.visualSuggestion}
                    </p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
                  <button onClick={() => handleCopyText(post)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    title="Copy full draft text">
                    <Copy size={13} /> Copy Text
                  </button>

                  <button onClick={() => handleDelete(post.id)}
                    disabled={actionLoadingId === post.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-red-500/10 text-red-400 border"
                    style={{ borderColor: 'var(--border)' }}
                    title="Delete draft">
                    {actionLoadingId === post.id ? <Loader2 size={13} className="spinner" /> : <Trash2 size={13} />}
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
