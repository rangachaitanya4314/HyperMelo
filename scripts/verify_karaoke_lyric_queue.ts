import { getLyricQueueIndices, getActiveLyricIndex } from '../src/services/lyrics/lyricsService';
import type { TimedLyricLine } from '../src/types/music';

const lines: TimedLyricLine[] = [0, 4, 8, 12, 16, 20].map((startTime, index) => ({
  id: `line-${index}`,
  text: index === 3 || index === 4 ? 'Repeated words' : `Line ${index}`,
  startTime,
  endTime: startTime + 3
}));

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(getLyricQueueIndices(lines, 10).join(',') === '1,2,3,4', 'Queue should show previous, current, and next two lines.');
assert(getActiveLyricIndex(lines, 10) === 2, 'Playback time should select the current timestamped lyric.');
const pausedQueue = getLyricQueueIndices(lines, 10);
assert(pausedQueue.join(',') === '1,2,3,4', 'Pause should keep the queue at the frozen playback position.');
assert(getLyricQueueIndices(lines, 18).join(',') === '3,4,5', 'Seeking should reposition the queue to the new playback time.');
assert(lines[getLyricQueueIndices(lines, 18)[1]]?.id === 'line-4', 'Repeated text occurrences must retain distinct timeline entries.');
assert(getLyricQueueIndices(lines, 2).join(',') === '0,1,2', 'Before the first timestamp, show the upcoming lines without inventing an active line.');
assert(getLyricQueueIndices(lines, 40).length === 0, 'After the final line, do not keep stale lyrics visible.');

const untimed: TimedLyricLine[] = [
  { id: 'plain-1', text: 'First plain line', startTime: -1, time: -1 },
  { id: 'plain-2', text: 'Second plain line', startTime: -1, time: -1 }
];
assert(getLyricQueueIndices(untimed, 10).length === 0, 'Plain lyrics must not receive invented timestamps or a timed queue.');

console.log('PASS: karaoke lyric queue, timestamp progression, seeking, repeated lines, pause stability, and untimed lyrics');
