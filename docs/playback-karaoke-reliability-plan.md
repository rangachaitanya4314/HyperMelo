# Playback and karaoke reliability — proposed changes

This draft PR tracks a targeted reliability review. **No production playback behavior has been changed yet.**

## Confirmed code observations

- `PlaybackController.acquirePlaybackLock(ownerId)` unconditionally replaces the current lock owner and returns `true`. Concurrent playback features could therefore steal each other's lock.
- `karaokePlaybackService.loadBackingSource(song, startTime)` awaits `playbackController.load` without checking whether a newer song request has superseded it.
- The synthesizer-based karaoke clock uses `Date.now()`, which can diverge from the Web Audio clock.

## Implementation plan

1. Add regression tests for competing playback-lock owners and release behavior.
2. Make karaoke source loading generation-aware so stale async completions cannot publish state.
3. Add tests for rapid track switching and for stop/dispose during pending loads.
4. Review synthesizer timing against `AudioContext.currentTime` and correct any verified drift.
5. Run lint, TypeScript build, and relevant browser tests before requesting review.

## Safety

Keep all changes on this branch. Do not merge until tests and manual playback/karaoke checks pass.
