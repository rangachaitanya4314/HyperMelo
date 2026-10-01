// Frontend Facade / Adapter for PlaybackSourceResolver
// Delegates to backend PlaybackSourceResolver

import type { Song } from '../../shared';
import { playbackSourceResolver as backendResolver } from '../../backend/services/PlaybackSourceResolver';

export class PlaybackSourceResolver {
  public async resolvePlaybackSource(song: Song | null): Promise<Song> {
    return backendResolver.resolvePlaybackSource(song);
  }
}

export const playbackSourceResolver = new PlaybackSourceResolver();
