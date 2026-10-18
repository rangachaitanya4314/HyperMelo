// Predictive Smart Search Engine for HyperMelo
// Provides instant synchronous prefix matching, multilingual tokenization,
// ranked result scoring (exact > prefix > word-boundary > contains),
// and persistent recent-search management.

import type { Song } from '../../types/music';
import { getAllCuratedSongs } from '../../data/curatedCatalog';
import { MOOD_CATALOG } from '../../data/moodCatalog';
import { SONGS, ANIRUDH_GAALI_VAALUGA, JOSH_WOODWARD_SHOT_DOWN } from '../../data/songs';
import { ALL_ARTISTS, type ArtistProfile } from '../../data/artistCatalog';
import { isArtistMatch } from '../../shared/track';

export interface GroupedSearchResults {
  songs: Song[];
  artists: ArtistProfile[];
  recentSearches: string[];
  popularSuggestions: string[];
}

export const POPULAR_SEARCH_SUGGESTIONS: string[] = [
  'Imagine Dragons',
  'Arijit Singh',
  'Anirudh Ravichander',
  'Sia',
  'Bones',
  'Chaleya',
  'Unstoppable',
  'Hukum',
  'Kesariya',
  'Dua Lipa'
];

const RECENT_SEARCHES_KEY = 'hypermelo_recent_searches';

/**
 * Normalizes text for search: removes diacritics/accents, lowercases, removes excess whitespace and punctuation
 */
export function normalizeSearchQuery(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // replace punctuation with spaces while preserving Unicode letters/numbers
    .replace(/\s+/g, ' ')
    .trim();
}

class PredictiveSearchService {
  private indexedTracks: Song[] = [];
  private indexedArtists: ArtistProfile[] = [];
  private isIndexed = false;

  private ensureIndexed(): void {
    if (this.isIndexed) return;

    const seen = new Set<string>();
    const allTracks: Song[] = [];

    const rawList: Song[] = [
      ANIRUDH_GAALI_VAALUGA,
      JOSH_WOODWARD_SHOT_DOWN,
      ...SONGS,
      ...getAllCuratedSongs(),
      ...Object.values(MOOD_CATALOG).flat()
    ];

    for (const track of rawList) {
      if (!track?.id || !track.title) continue;
      const dedupeKey = `${track.title.toLowerCase().trim()}---${(track.artist || '').toLowerCase().trim()}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        allTracks.push(track);
      }
    }

    this.indexedTracks = allTracks;
    this.indexedArtists = ALL_ARTISTS;
    this.isIndexed = true;
  }

  /**
   * Performs instant synchronous predictive search across tracks and artists.
   * Ranks exact matches first, then prefix matches, then word-level prefix matches, then fuzzy substrings.
   */
  public searchLocal(query: string, limit = 15): GroupedSearchResults {
    this.ensureIndexed();
    const cleanQ = normalizeSearchQuery(query);

    if (!cleanQ) {
      return {
        songs: [],
        artists: [],
        recentSearches: this.getRecentSearches(),
        popularSuggestions: POPULAR_SEARCH_SUGGESTIONS
      };
    }

    // 1. Score and rank tracks
    const scoredSongs: { song: Song; score: number }[] = [];
    for (const song of this.indexedTracks) {
      const normTitle = normalizeSearchQuery(song.title);
      const normArtist = normalizeSearchQuery(song.artist);
      const normAlbum = normalizeSearchQuery(song.album || '');

      let score = 0;

      // Exact title match
      if (normTitle === cleanQ) {
        score = 100;
      } else if (normArtist === cleanQ) {
        score = 90;
      } else if (normTitle.startsWith(cleanQ)) {
        score = 80;
      } else if (normTitle.split(' ').some((word) => word.startsWith(cleanQ))) {
        // e.g. typing "bon" matches "Bones"
        score = 70;
      } else if (isArtistMatch(song.artist, cleanQ)) {
        score = 65;
      } else if (normArtist.startsWith(cleanQ)) {
        score = 60;
      } else if (normArtist.split(' ').some((word) => word.startsWith(cleanQ))) {
        score = 50;
      } else if (normTitle.includes(cleanQ)) {
        score = 40;
      } else if (cleanQ.length > 3 && normArtist.split(' ').some((word) => word.includes(cleanQ))) {
        score = 30;
      } else if (normAlbum.startsWith(cleanQ) || normAlbum.includes(cleanQ)) {
        score = 20;
      }

      if (score > 0) {
        scoredSongs.push({ song, score });
      }
    }

    scoredSongs.sort((a, b) => b.score - a.score);
    const matchedSongs = scoredSongs.slice(0, limit).map((s) => s.song);

    // 2. Score and rank artists
    const scoredArtists: { artist: ArtistProfile; score: number }[] = [];
    for (const artist of this.indexedArtists) {
      const normName = normalizeSearchQuery(artist.name);
      const normGenre = normalizeSearchQuery(artist.genre || '');

      let score = 0;
      if (normName === cleanQ) {
        score = 100;
      } else if (normName.startsWith(cleanQ)) {
        score = 80;
      } else if (normName.split(' ').some((word) => word.startsWith(cleanQ))) {
        score = 65;
      } else if (isArtistMatch(artist.name, cleanQ)) {
        score = 50;
      } else if (normGenre.includes(cleanQ)) {
        score = 30;
      }

      if (score > 0) {
        scoredArtists.push({ artist, score });
      }
    }

    scoredArtists.sort((a, b) => b.score - a.score);
    const matchedArtists = scoredArtists.slice(0, 5).map((a) => a.artist);

    return {
      songs: matchedSongs,
      artists: matchedArtists,
      recentSearches: this.getRecentSearches(),
      popularSuggestions: POPULAR_SEARCH_SUGGESTIONS
    };
  }

  // =========================================================================
  // RECENT SEARCHES MANAGEMENT
  // =========================================================================

  private memoryRecentSearches: string[] = [];

  public getRecentSearches(): string[] {
    if (typeof window === 'undefined') {
      return [...this.memoryRecentSearches];
    }
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 8);
        }
      }
    } catch {
      // ignore JSON error
    }
    return [...this.memoryRecentSearches];
  }

  public addRecentSearch(rawQuery: string): void {
    const clean = rawQuery.trim();
    if (!clean || clean.length < 2) return;

    if (typeof window === 'undefined') {
      const filtered = this.memoryRecentSearches.filter(
        (item) => item.toLowerCase() !== clean.toLowerCase()
      );
      this.memoryRecentSearches = [clean, ...filtered].slice(0, 8);
      return;
    }

    try {
      const current = this.getRecentSearches();
      const filtered = current.filter((item) => item.toLowerCase() !== clean.toLowerCase());
      const updated = [clean, ...filtered].slice(0, 8);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      this.memoryRecentSearches = updated;
    } catch {
      // ignore storage error
    }
  }

  public removeRecentSearch(queryToRemove: string): void {
    if (typeof window === 'undefined') {
      this.memoryRecentSearches = this.memoryRecentSearches.filter(
        (item) => item.toLowerCase() !== queryToRemove.toLowerCase()
      );
      return;
    }
    try {
      const current = this.getRecentSearches();
      const updated = current.filter(
        (item) => item.toLowerCase() !== queryToRemove.toLowerCase()
      );
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      this.memoryRecentSearches = updated;
    } catch {
      // ignore storage error
    }
  }

  public clearRecentSearches(): void {
    this.memoryRecentSearches = [];
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore storage error
    }
  }
}

export const predictiveSearchService = new PredictiveSearchService();
