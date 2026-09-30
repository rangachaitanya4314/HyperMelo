// ============================================================================
// NARO DEVELOPMENT AUDIO FIXTURE GENERATOR
// ============================================================================
// NOTICE: THIS SCRIPT GENERATES PROCEDURAL SYNTHETIC AUDIO WAVEFORMS FOR
// LOCAL DEVELOPMENT, AUDIO DSP VERIFICATION, AND TIMELINE SEEKING TESTS ONLY.
//
// IT DOES NOT CONTAIN, DOWNLOAD, EXTRACT, OR REPLACE REAL LICENSED RECORDINGS.
// THE GENERATED AUDIO IS COMPOSED ENTIRELY OF SYNTHETIC SINE WAVES, TRIANGLE WAVES,
// EXPONENTIAL NOISE ENVELOPES, AND HARMONIC PROGRESSIONS.
//
// ASSETS GENERATED HERE MUST ALWAYS BE TAGGED WITH:
//   playbackSourceType: 'dev-fixture'
// AND MUST NEVER BE PRESENTED TO USERS AS LICENSED PRODUCTION FULL SONGS.
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

function generateTrack(
  filename: string,
  durationSec: number,
  bpm: number,
  chordRoots: number[],
  chordTones: number[][]
) {
  const sampleRate = 22050;
  const numChannels = 2; // Stereo
  const bytesPerSample = 2; // 16-bit
  const totalSamples = sampleRate * durationSec;
  const dataByteLength = totalSamples * numChannels * bytesPerSample;

  const buffer = Buffer.alloc(44 + dataByteLength);

  // RIFF Chunk
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write('WAVE', 8);

  // fmt Subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);

  // data Subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataByteLength, 40);

  const beatDuration = 60 / bpm;
  let offset = 44;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const currentBeat = t / beatDuration;
    const measure = Math.floor(currentBeat / 4);
    const chordIndex = measure % chordRoots.length;
    const roots = chordRoots[chordIndex];
    const tones = chordTones[chordIndex];

    // 1. Stereo Warm Pad (Left & Right out of phase for stereo width)
    let padLeft = 0;
    let padRight = 0;
    for (let k = 0; k < tones.length; k++) {
      const f = tones[k];
      const phL = 2 * Math.PI * f * t;
      const phR = 2 * Math.PI * f * t + (k * 0.45);
      padLeft += Math.sin(phL) * 0.12;
      padRight += Math.sin(phR) * 0.12;
    }

    // 2. Bass (Center-anchored fundamental)
    const bassFreq = roots * 0.5;
    const bass = (Math.sin(2 * Math.PI * bassFreq * t) + 0.3 * Math.sin(4 * Math.PI * bassFreq * t)) * 0.22;

    // 3. Rhythm Percussion (Kick on 0 & 2, Snare on 1 & 3, Hi-hat on half-beats)
    const beatFraction = currentBeat % 1.0;
    const beatInMeasure = Math.floor(currentBeat) % 4;

    let kick = 0;
    if ((beatInMeasure === 0 || beatInMeasure === 2) && beatFraction < 0.25) {
      const kEnv = Math.exp(-beatFraction * 20);
      kick = Math.sin(2 * Math.PI * 62 * beatFraction) * kEnv * 0.28;
    }

    let snareL = 0;
    let snareR = 0;
    if ((beatInMeasure === 1 || beatInMeasure === 3) && beatFraction < 0.2) {
      const sEnv = Math.exp(-beatFraction * 24);
      snareL = (Math.random() * 2 - 1) * sEnv * 0.18;
      snareR = (Math.random() * 2 - 1) * sEnv * 0.18;
    }

    let hihatL = 0;
    let hihatR = 0;
    const hatFraction = (currentBeat * 2) % 1.0;
    if (hatFraction < 0.08) {
      const hEnv = Math.exp(-hatFraction * 40);
      hihatL = (Math.random() * 2 - 1) * hEnv * 0.07;
      hihatR = (Math.random() * 2 - 1) * hEnv * 0.07;
    }

    // 4. Centered Lead Vocal Melody (L = R, can be cancelled by L - R for DSP verification)
    let vocalLead = 0;
    if (t >= 8 && t <= durationSec - 10) {
      const noteIdx = Math.floor(currentBeat / 2) % tones.length;
      const leadFreq = tones[noteIdx] * 1.5;
      const vibrato = 1.0 + 0.015 * Math.sin(2 * Math.PI * 5.2 * t);
      const vPh = 2 * Math.PI * leadFreq * vibrato * t;
      vocalLead = (Math.sin(vPh) * 0.5 + Math.sin(2 * vPh) * 0.25 + Math.sin(3 * vPh) * 0.1) * 0.32;
    }

    const outLeft = padLeft + bass + kick + snareL + hihatL + vocalLead;
    const outRight = padRight + bass + kick + snareR + hihatR + vocalLead;

    const sampleL = Math.max(-32768, Math.min(32767, Math.floor(outLeft * 28000)));
    const sampleR = Math.max(-32768, Math.min(32767, Math.floor(outRight * 28000)));

    buffer.writeInt16LE(sampleL, offset);
    buffer.writeInt16LE(sampleR, offset + 2);
    offset += 4;
  }

  const outPath = path.resolve('public', 'audio', filename);
  fs.writeFileSync(outPath, buffer);
  console.log(`✓ [DEV-FIXTURE] Generated ${durationSec}s stereo WAV fixture: ${outPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// 1. Midnight Drive Dev Fixture (195s, 88 BPM, Dm - Bb - F - C)
generateTrack(
  'midnight-drive.wav',
  195,
  88,
  [146.83, 116.54, 87.31, 130.81],
  [
    [146.83, 174.61, 220.0, 293.66],
    [116.54, 146.83, 174.61, 233.08],
    [87.31, 130.81, 174.61, 220.0],
    [130.81, 164.81, 196.0, 261.63]
  ]
);

// 2. Channa Mereya Dev Fixture (289s, 86 BPM, F#m - D - A - E)
// Synthetic test waveform matching section intervals for clock & DSP testing
generateTrack(
  'channa-mereya-full.wav',
  289,
  86,
  [92.5, 73.42, 110.0, 82.41], // F#2, D2, A2, E2
  [
    [185.0, 220.0, 277.18, 369.99],  // F#m: F#, A, C#, F#4
    [146.83, 185.0, 220.0, 293.66],  // D: D, F#, A, D4
    [220.0, 277.18, 329.63, 440.0],  // A: A, C#, E, A4
    [164.81, 207.65, 246.94, 329.63] // E: E, G#, B, E4
  ]
);
