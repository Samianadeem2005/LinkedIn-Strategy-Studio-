'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface PostType {
  id: string;
  name: string;
  dos: string[];
  donts: string[];
  core_focus: string;
}

export interface AnatomySection {
  id: string;
  section_name: string;
  rule_description: string;
  order_index: number;
  applies_to_post_type_id: string | null;
}

export interface ToneProfile {
  formality: string;
  sentenceLength: 'short' | 'medium' | 'long';
  bannedPhrases: string[];
  languageMix: string;
}

export interface Settings {
  id: number;
  frequency: string;
  tone_profile: ToneProfile;
  anatomy_scope: 'global' | 'per_post_type';
  about_me?: string;
}

export interface WeeklyMapping {
  day_of_week: string;
  post_type_id: string | null;
  post_type_name: string | null;
  series_length: number;
  is_continuation_of: string | null;
}

export interface GenerationParams {
  rawNotes: string;
  selectedPostTypeId: string;
  postFormat: string;
  postDate: string;
  selectedHooks: string[];
  selectedHookIds: string[];
}

export interface GenerationResult {
  versions: any[];
  repeatWarning: string | null;
  postId: string | null;
  postFormat: string;
  characterCount: number;
}

interface AppContextType {
  postTypes: PostType[];
  anatomy: AnatomySection[];
  settings: Settings | null;
  weeklyMapping: WeeklyMapping[];
  loading: boolean;

  // Global background generation state
  generating: boolean;
  webSearchStatus: string | null;
  generationResult: GenerationResult | null;
  generationError: string | null;
  startWebSearchGenerate: (params: GenerationParams) => Promise<void>;
  startNotesGenerate: (params: GenerationParams) => Promise<void>;
  resetGenerationState: () => void;

  refreshPostTypes: () => Promise<void>;
  refreshAnatomy: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshWeeklyMapping: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [postTypes, setPostTypes] = useState<PostType[]>([]);
  const [anatomy, setAnatomy] = useState<AnatomySection[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [weeklyMapping, setWeeklyMapping] = useState<WeeklyMapping[]>([]);
  const [loading, setLoading] = useState(true);

  // Global generation state
  const [generating, setGenerating] = useState(false);
  const [webSearchStatus, setWebSearchStatus] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const resetGenerationState = useCallback(() => {
    setGenerationResult(null);
    setGenerationError(null);
  }, []);

  const CACHE_TTL_MS = 30 * 60 * 1000;
  const CACHE_KEY_PREFIX = 'ws_cache_';

  const getCachedResults = (query: string) => {
    try {
      const key = CACHE_KEY_PREFIX + query.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 80);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as { resultsText: string; resultCount: number; savedAt: number };
      if (Date.now() - entry.savedAt > CACHE_TTL_MS) { localStorage.removeItem(key); return null; }
      return entry;
    } catch { return null; }
  };

  const saveCachedResults = (query: string, resultsText: string, resultCount: number) => {
    try {
      const key = CACHE_KEY_PREFIX + query.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 80);
      localStorage.setItem(key, JSON.stringify({ resultsText, resultCount, savedAt: Date.now() }));
    } catch {}
  };

  const startWebSearchGenerate = useCallback(async (params: GenerationParams) => {
    setGenerating(true);
    setGenerationResult(null);
    setGenerationError(null);

    try {
      let resultsText: string;
      let resultCount: number;

      const cached = getCachedResults(params.rawNotes);
      if (cached) {
        resultsText = cached.resultsText;
        resultCount = cached.resultCount;
        setWebSearchStatus(`⚡ Using cached results (${resultCount} sources) — generating post…`);
      } else {
        setWebSearchStatus('🔍 Searching the web…');
        const searchRes = await fetch('/api/web-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: params.rawNotes.trim() }),
        });
        const searchData = await searchRes.json();
        if (!searchRes.ok) {
          setGenerationError(searchData.error ?? 'Web search failed.');
          setGenerating(false);
          setWebSearchStatus(null);
          return;
        }

        resultsText = searchData.resultsText;
        resultCount = searchData.resultCount;
        saveCachedResults(params.rawNotes, resultsText, resultCount);
        setWebSearchStatus(`✅ Found ${resultCount} sources — generating post…`);
      }

      const genRes = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawNotes: params.rawNotes,
          postTypeId: params.selectedPostTypeId,
          postFormat: params.postFormat,
          date: params.postDate,
          webResults: resultsText,
          selectedHooks: params.selectedHooks,
          selectedHookIds: params.selectedHookIds
        }),
      });
      const data = await genRes.json();
      if (!genRes.ok) {
        setGenerationError(data.error ?? 'Generation failed.');
        setGenerating(false);
        setWebSearchStatus(null);
        return;
      }

      const resObj: GenerationResult = {
        versions: data.versions,
        repeatWarning: data.repeatWarning ?? null,
        postId: data.postId ?? null,
        postFormat: params.postFormat,
        characterCount: data.characterCount ?? 0
      };

      setGenerationResult(resObj);

      try {
        const existing = JSON.parse(sessionStorage.getItem('studio_page_state') ?? '{}');
        sessionStorage.setItem('studio_page_state', JSON.stringify({
          ...existing,
          versions: data.versions,
          activeVersion: 0,
          editedSections: data.versions[0]?.sections ?? {},
          rawNotes: params.rawNotes,
          selectedPostTypeId: params.selectedPostTypeId,
          postId: data.postId ?? null,
          postFormat: params.postFormat,
          postDate: params.postDate
        }));
      } catch {}

    } catch (e) {
      setGenerationError(String(e));
    } finally {
      setGenerating(false);
      setWebSearchStatus(null);
    }
  }, []);

  const startNotesGenerate = useCallback(async (params: GenerationParams) => {
    setGenerating(true);
    setGenerationResult(null);
    setGenerationError(null);
    setWebSearchStatus(null);

    try {
      const res = await fetch('/api/generate-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawNotes: params.rawNotes,
          postTypeId: params.selectedPostTypeId,
          postFormat: params.postFormat,
          date: params.postDate,
          selectedHooks: params.selectedHooks,
          selectedHookIds: params.selectedHookIds
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setGenerationError(data.error ?? 'Generation failed.');
        setGenerating(false);
        return;
      }

      const resObj: GenerationResult = {
        versions: data.versions,
        repeatWarning: data.repeatWarning ?? null,
        postId: data.postId ?? null,
        postFormat: params.postFormat,
        characterCount: data.characterCount ?? 0
      };

      setGenerationResult(resObj);

      try {
        const existing = JSON.parse(sessionStorage.getItem('studio_page_state') ?? '{}');
        sessionStorage.setItem('studio_page_state', JSON.stringify({
          ...existing,
          versions: data.versions,
          activeVersion: 0,
          editedSections: data.versions[0]?.sections ?? {},
          rawNotes: params.rawNotes,
          selectedPostTypeId: params.selectedPostTypeId,
          postId: data.postId ?? null,
          postFormat: params.postFormat,
          postDate: params.postDate
        }));
      } catch {}

    } catch (e) {
      setGenerationError(String(e));
    } finally {
      setGenerating(false);
    }
  }, []);

  const refreshPostTypes = useCallback(async () => {
    const res = await fetch('/api/post-types');
    if (res.ok) setPostTypes(await res.json());
  }, []);

  const refreshAnatomy = useCallback(async () => {
    const res = await fetch('/api/anatomy');
    if (res.ok) setAnatomy(await res.json());
  }, []);

  const refreshSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) setSettings(await res.json());
  }, []);

  const refreshWeeklyMapping = useCallback(async () => {
    const res = await fetch('/api/weekly-mapping');
    if (res.ok) setWeeklyMapping(await res.json());
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([refreshPostTypes(), refreshAnatomy(), refreshSettings(), refreshWeeklyMapping()]);
    setLoading(false);
  }, [refreshPostTypes, refreshAnatomy, refreshSettings, refreshWeeklyMapping]);

  useEffect(() => {
    refreshAll();

    const handleStrategyUpdated = () => {
      refreshAll();
    };

    window.addEventListener('strategy_updated', handleStrategyUpdated);
    return () => {
      window.removeEventListener('strategy_updated', handleStrategyUpdated);
    };
  }, [refreshAll]);

  return (
    <AppContext.Provider value={{
      postTypes,
      anatomy,
      settings,
      weeklyMapping,
      loading,
      generating,
      webSearchStatus,
      generationResult,
      generationError,
      startWebSearchGenerate,
      startNotesGenerate,
      resetGenerationState,
      refreshPostTypes,
      refreshAnatomy,
      refreshSettings,
      refreshWeeklyMapping,
      refreshAll
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
