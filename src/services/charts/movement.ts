// Chart Rank Movement Engine
// Calculates verifiable rank movements between comparable snapshots.
// Never fabricates position changes without deterministic snapshot comparison evidence.

import type { NormalizedChartTrack, ChartSnapshot, RankMovement } from './types';
import { computeTrackIdentity } from './identity';

export interface MovementSummary {
  updatedTracks: NormalizedChartTrack[];
  exitedTracks: Array<{ identity: string; title: string; previous_rank: number }>;
  newEntriesCount: number;
  risesCount: number;
  fallsCount: number;
  unchangedCount: number;
}

/**
 * Calculates rank movements for current tracks compared to a previous snapshot.
 * If previousSnapshot is null, movement is omitted or set to undefined (no fake movement claims).
 */
export function calculateRankMovements(
  currentTracks: NormalizedChartTrack[],
  previousSnapshot: ChartSnapshot | null
): MovementSummary {
  if (!previousSnapshot || !previousSnapshot.tracks || previousSnapshot.tracks.length === 0) {
    // No comparable previous snapshot: do not invent movements
    return {
      updatedTracks: currentTracks.map((track) => ({
        ...track,
        previous_rank: null,
        rank_movement: undefined
      })),
      exitedTracks: [],
      newEntriesCount: 0,
      risesCount: 0,
      fallsCount: 0,
      unchangedCount: 0
    };
  }

  // Build identity map for previous snapshot
  const prevRankMap = new Map<string, { rank: number; title: string }>();
  for (const prevTrack of previousSnapshot.tracks) {
    const id = computeTrackIdentity(prevTrack);
    prevRankMap.set(id, { rank: prevTrack.source_rank, title: prevTrack.title });
  }

  let newCount = 0;
  let risesCount = 0;
  let fallsCount = 0;
  let unchangedCount = 0;

  const currentIdentities = new Set<string>();

  const updatedTracks: NormalizedChartTrack[] = currentTracks.map((track) => {
    const id = computeTrackIdentity(track);
    currentIdentities.add(id);

    const prev = prevRankMap.get(id);

    if (!prev) {
      newCount++;
      return {
        ...track,
        previous_rank: null,
        rank_movement: 'new' as RankMovement
      };
    }

    const prevRank = prev.rank;
    let movement: RankMovement;

    if (track.source_rank < prevRank) {
      // Lower number = higher on chart (e.g., #5 -> #2 is up)
      movement = 'up';
      risesCount++;
    } else if (track.source_rank > prevRank) {
      // Higher number = lower on chart (e.g., #2 -> #5 is down)
      movement = 'down';
      fallsCount++;
    } else {
      movement = 'unchanged';
      unchangedCount++;
    }

    return {
      ...track,
      previous_rank: prevRank,
      rank_movement: movement
    };
  });

  // Calculate exited tracks (were in previous snapshot, but dropped off current)
  const exitedTracks: Array<{ identity: string; title: string; previous_rank: number }> = [];
  for (const [prevId, prevData] of prevRankMap.entries()) {
    if (!currentIdentities.has(prevId)) {
      exitedTracks.push({
        identity: prevId,
        title: prevData.title,
        previous_rank: prevData.rank
      });
    }
  }

  return {
    updatedTracks,
    exitedTracks,
    newEntriesCount: newCount,
    risesCount,
    fallsCount,
    unchangedCount
  };
}
