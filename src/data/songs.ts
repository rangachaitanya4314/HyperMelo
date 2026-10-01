import type { Song } from '../types/music';

export const JOSH_WOODWARD_SHOT_DOWN: Song = {
  id: 'josh-woodward-shot-down',
  title: 'Shot Down',
  artist: 'Josh Woodward',
  album: 'The Beautiful Machine',
  duration: 255, // 04:15 (exact 254.746s)
  fullTrackDuration: 255,
  isStreamPreview: false,
  fullLengthAvailable: true,
  previewAvailable: false,
  playbackAvailable: true,
  playbackType: 'full',
  playbackAvailability: 'full',
  playbackSourceType: 'open-license',
  playbackProvider: 'naro',
  karaokeReady: true,
  karaokeAvailable: true,
  karaokeAvailability: 'available',
  karaokeSource: {
    type: 'dedicated-instrumental',
    provider: 'naro',
    providerTrackId: 'josh-woodward-shot-down-novox',
    streamUrl: '/audio/josh-woodward-shot-down-novox.mp3',
    duration: 255,
    availability: 'available'
  },
  lyricsAvailable: false,
  lyricsSyncAvailable: false,
  genre: 'Indie Rock / Acoustic Pop',
  language: 'en',
  originalLanguage: 'en',
  bpm: 120,
  musicalKey: 'G Major',
  releaseYear: 2014,
  artwork: {
    palette: ['#38BDF8', '#1E293B', '#0F172A', '#F59E0B'],
    pattern: 'solaris',
    accentWarm: '#F59E0B',
    accentCool: '#38BDF8',
    accentCream: '#FEF3C7'
  },
  sections: [
    { type: 'verse', label: 'Verse 1', start: 0, end: 45 },
    { type: 'chorus', label: 'Chorus 1', start: 45, end: 85 },
    { type: 'verse', label: 'Verse 2', start: 85, end: 140 },
    { type: 'chorus', label: 'Chorus 2', start: 140, end: 180 },
    { type: 'bridge', label: 'Outro', start: 180, end: 255 }
  ],
  lyrics: {
    en: { chorusSnippet: 'Lyrics unavailable', lines: [] },
    hi: { chorusSnippet: 'गीत उपलब्ध नहीं हैं', lines: [] },
    te: { chorusSnippet: 'సాహిత్యం అందుబాటులో లేదు', lines: [] }
  },
  playbackSource: {
    provider: 'naro',
    providerTrackId: 'josh-woodward-shot-down',
    streamUrl: '/audio/josh-woodward-shot-down-vocal.mp3',
    format: 'mp3',
    isStreamPreview: false,
    playbackSourceType: 'open-license'
  },
  capabilities: {
    playback: true,
    playbackAvailable: true,
    playbackType: 'full',
    playbackSourceType: 'open-license',
    lyrics: false,
    lyricsAvailable: false,
    lyricsSyncAvailable: false,
    karaoke: true,
    karaokeAvailable: true,
    karaokeSource: {
      type: 'dedicated-instrumental',
      provider: 'naro',
      providerTrackId: 'josh-woodward-shot-down-novox',
      streamUrl: '/audio/josh-woodward-shot-down-novox.mp3',
      duration: 255,
      availability: 'available'
    },
    recording: true
  },
  attribution: {
    title: 'Shot Down',
    artist: 'Josh Woodward',
    album: 'The Beautiful Machine',
    license: 'CC BY 3.0 US',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/us/',
    source: 'Free Music Archive / Wikimedia Commons',
    sourceName: 'Free Music Archive / Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Josh_Woodward_-_03_-_Shot_Down.ogg',
    text: '"Shot Down" by Josh Woodward from The Beautiful Machine. Used under Creative Commons Attribution 3.0 US (CC BY 3.0 US). Source: Free Music Archive / Wikimedia Commons.',
    note: 'Openly licensed reference demo track. Not NARO-owned or commercial catalog asset.'
  }
};

export const SONGS: Song[] = [
  {
    id: 'midnight-drive',
    title: 'Midnight Drive',
    artist: 'Aarav',
    duration: 195, // 03:15
    genre: 'Late-Night Synth / Indie R&B',
    language: 'en',
    originalLanguage: 'en',
    bpm: 88,
    musicalKey: 'D Minor',
    karaokeReady: true,
    artwork: {
      palette: ['#E7A58D', '#1D2538', '#0F172A', '#8FA8C8'],
      pattern: 'orbital',
      accentWarm: '#E7A58D',
      accentCool: '#8FA8C8'
    },
    sections: [
      {
        type: 'verse',
        label: 'Verse 1',
        start: 12,
        end: 46
      },
      {
        type: 'chorus',
        label: 'Chorus',
        start: 48,
        end: 81 // 00:48 — 01:21
      },
      {
        type: 'bridge',
        label: 'Bridge',
        start: 84,
        end: 112
      }
    ],
    lyrics: {
      en: {
        chorusSnippet: 'I only wished for you, and everything was possible',
        lines: [
          {
            time: 48,
            duration: 8,
            text: 'I only wished for you',
            words: [
              { text: 'I', start: 48.0, end: 49.0 },
              { text: 'only', start: 49.0, end: 50.2 },
              { text: 'wished', start: 50.2, end: 51.6 },
              { text: 'for', start: 51.6, end: 52.8 },
              { text: 'you', start: 52.8, end: 55.5 }
            ]
          },
          {
            time: 56,
            duration: 9,
            text: 'and everything was possible',
            words: [
              { text: 'and', start: 56.0, end: 57.0 },
              { text: 'everything', start: 57.0, end: 59.2 },
              { text: 'was', start: 59.2, end: 60.5 },
              { text: 'possible', start: 60.5, end: 64.5 }
            ]
          },
          {
            time: 65,
            duration: 8,
            text: 'under the velvet city neon',
            words: [
              { text: 'under', start: 65.0, end: 66.5 },
              { text: 'the', start: 66.5, end: 67.2 },
              { text: 'velvet', start: 67.2, end: 68.8 },
              { text: 'city', start: 68.8, end: 70.2 },
              { text: 'neon', start: 70.2, end: 72.8 }
            ]
          },
          {
            time: 73,
            duration: 8,
            text: 'we held the quiet storm inside',
            words: [
              { text: 'we', start: 73.0, end: 74.0 },
              { text: 'held', start: 74.0, end: 75.2 },
              { text: 'the', start: 75.2, end: 76.0 },
              { text: 'quiet', start: 76.0, end: 77.6 },
              { text: 'storm', start: 77.6, end: 79.2 },
              { text: 'inside', start: 79.2, end: 81.0 }
            ]
          }
        ]
      },
      hi: {
        chorusSnippet: 'मैंने तुम्हें चाहा, और सब कुछ मुमकिन था',
        lines: [
          {
            time: 48,
            duration: 8,
            text: 'मैंने तुम्हें चाहा',
            words: [
              { text: 'मैंने', start: 48.0, end: 50.0 },
              { text: 'तुम्हें', start: 50.0, end: 52.2 },
              { text: 'चाहा', start: 52.2, end: 55.5 }
            ]
          },
          {
            time: 56,
            duration: 9,
            text: 'और सब कुछ मुमकिन था',
            words: [
              { text: 'और', start: 56.0, end: 57.5 },
              { text: 'सब', start: 57.5, end: 59.0 },
              { text: 'कुछ', start: 59.0, end: 60.5 },
              { text: 'मुमकिन', start: 60.5, end: 62.5 },
              { text: 'था', start: 62.5, end: 64.5 }
            ]
          },
          {
            time: 65,
            duration: 8,
            text: 'शहर की मखमली रौशनी तले',
            words: [
              { text: 'शहर', start: 65.0, end: 66.8 },
              { text: 'की', start: 66.8, end: 67.8 },
              { text: 'मखमली', start: 67.8, end: 70.0 },
              { text: 'रौशनी', start: 70.0, end: 71.8 },
              { text: 'तले', start: 71.8, end: 72.8 }
            ]
          },
          {
            time: 73,
            duration: 8,
            text: 'एक ठहरा हुआ तूफ़ान था दिल में',
            words: [
              { text: 'एक', start: 73.0, end: 74.0 },
              { text: 'ठहरा', start: 74.0, end: 75.8 },
              { text: 'हुआ', start: 75.8, end: 76.8 },
              { text: 'तूफ़ान', start: 76.8, end: 78.5 },
              { text: 'था', start: 78.5, end: 79.5 },
              { text: 'दिल', start: 79.5, end: 80.2 },
              { text: 'में', start: 80.2, end: 81.0 }
            ]
          }
        ]
      },
      te: {
        chorusSnippet: 'నిన్నే కోరుకున్నా, మరి అంతా సాధ్యమైంది',
        lines: [
          {
            time: 48,
            duration: 8,
            text: 'నిన్నే కోరుకున్నా',
            words: [
              { text: 'నిన్నే', start: 48.0, end: 51.0 },
              { text: 'కోరుకున్నా', start: 51.0, end: 55.5 }
            ]
          },
          {
            time: 56,
            duration: 9,
            text: 'మరి అంతా సాధ్యమైంది',
            words: [
              { text: 'మరి', start: 56.0, end: 57.5 },
              { text: 'అంతా', start: 57.5, end: 60.0 },
              { text: 'సాధ్యమైంది', start: 60.0, end: 64.5 }
            ]
          },
          {
            time: 65,
            duration: 8,
            text: 'రేయి రంగుల వెన్నెల బాటలో',
            words: [
              { text: 'రేయి', start: 65.0, end: 67.0 },
              { text: 'రంగుల', start: 67.0, end: 69.5 },
              { text: 'వెన్నెల', start: 69.5, end: 71.5 },
              { text: 'బాటలో', start: 71.5, end: 72.8 }
            ]
          },
          {
            time: 73,
            duration: 8,
            text: 'గుండెల్లో దాచిన మౌన రాగమే',
            words: [
              { text: 'గుండెల్లో', start: 73.0, end: 75.2 },
              { text: 'దాచిన', start: 75.2, end: 77.0 },
              { text: 'మౌన', start: 77.0, end: 78.8 },
              { text: 'రాగమే', start: 78.8, end: 81.0 }
            ]
          }
        ]
      }
    },
    audioSignature: {
      chordProgression: ['Dm', 'Bb', 'F', 'C'],
      tempo: 88,
      baseFreq: 146.83 // D3
    }
  },
  {
    id: 'neeve',
    title: 'Neeve',
    artist: 'Anika',
    duration: 182, // 03:02
    genre: 'Telugu Indie Melodic',
    language: 'te',
    originalLanguage: 'te',
    bpm: 76,
    musicalKey: 'G Major',
    karaokeReady: true,
    artwork: {
      palette: ['#F4DFC9', '#374151', '#111827', '#E7A58D'],
      pattern: 'echo',
      accentWarm: '#F4DFC9',
      accentCool: '#8FA8C8'
    },
    sections: [
      {
        type: 'verse',
        label: 'Verse 1',
        start: 10,
        end: 38
      },
      {
        type: 'chorus',
        label: 'Chorus',
        start: 40,
        end: 74
      },
      {
        type: 'bridge',
        label: 'Bridge',
        start: 78,
        end: 105
      }
    ],
    lyrics: {
      en: {
        chorusSnippet: 'In the silent night, you are the light that guides',
        lines: [
          {
            time: 40,
            duration: 8,
            text: 'In the silent night',
            words: [
              { text: 'In', start: 40.0, end: 41.2 },
              { text: 'the', start: 41.2, end: 42.0 },
              { text: 'silent', start: 42.0, end: 44.0 },
              { text: 'night', start: 44.0, end: 47.0 }
            ]
          },
          {
            time: 48,
            duration: 9,
            text: 'you are the light that guides',
            words: [
              { text: 'you', start: 48.0, end: 49.2 },
              { text: 'are', start: 49.2, end: 50.0 },
              { text: 'the', start: 50.0, end: 50.8 },
              { text: 'light', start: 50.8, end: 52.8 },
              { text: 'that', start: 52.8, end: 53.8 },
              { text: 'guides', start: 53.8, end: 56.5 }
            ]
          },
          {
            time: 58,
            duration: 8,
            text: 'every breath echoes your name',
            words: [
              { text: 'every', start: 58.0, end: 59.8 },
              { text: 'breath', start: 59.8, end: 61.2 },
              { text: 'echoes', start: 61.2, end: 63.2 },
              { text: 'your', start: 63.2, end: 64.2 },
              { text: 'name', start: 64.2, end: 66.0 }
            ]
          },
          {
            time: 67,
            duration: 7,
            text: 'until the morning dawn arrives',
            words: [
              { text: 'until', start: 67.0, end: 68.5 },
              { text: 'the', start: 68.5, end: 69.2 },
              { text: 'morning', start: 69.2, end: 71.0 },
              { text: 'dawn', start: 71.0, end: 72.2 },
              { text: 'arrives', start: 72.2, end: 74.0 }
            ]
          }
        ]
      },
      hi: {
        chorusSnippet: 'इस ख़ामोश रात में, तुम ही तो रौशनी हो',
        lines: [
          {
            time: 40,
            duration: 8,
            text: 'इस ख़ामोश रात में',
            words: [
              { text: 'इस', start: 40.0, end: 41.5 },
              { text: 'ख़ामोश', start: 41.5, end: 43.8 },
              { text: 'रात', start: 43.8, end: 45.5 },
              { text: 'में', start: 45.5, end: 47.0 }
            ]
          },
          {
            time: 48,
            duration: 9,
            text: 'तुम ही तो रौशनी हो',
            words: [
              { text: 'तुम', start: 48.0, end: 49.8 },
              { text: 'ही', start: 49.8, end: 50.8 },
              { text: 'तो', start: 50.8, end: 51.8 },
              { text: 'रौशनी', start: 51.8, end: 54.2 },
              { text: 'हो', start: 54.2, end: 56.5 }
            ]
          },
          {
            time: 58,
            duration: 8,
            text: 'हर सांस में तेरा नाम है',
            words: [
              { text: 'हर', start: 58.0, end: 59.5 },
              { text: 'सांस', start: 59.5, end: 61.2 },
              { text: 'में', start: 61.2, end: 62.2 },
              { text: 'तेरा', start: 62.2, end: 63.8 },
              { text: 'नाम', start: 63.8, end: 65.0 },
              { text: 'है', start: 65.0, end: 66.0 }
            ]
          },
          {
            time: 67,
            duration: 7,
            text: 'जब तक सवेरा न आए',
            words: [
              { text: 'जब', start: 67.0, end: 68.2 },
              { text: 'तक', start: 68.2, end: 69.2 },
              { text: 'सवेरा', start: 69.2, end: 71.5 },
              { text: 'न', start: 71.5, end: 72.5 },
              { text: 'आए', start: 72.5, end: 74.0 }
            ]
          }
        ]
      },
      te: {
        chorusSnippet: 'ఈ నిశ్శబ్ద రేయిలో, నువ్వే నా వెలుగు జాడ',
        lines: [
          {
            time: 40,
            duration: 8,
            text: 'ఈ నిశ్శబ్ద రేయిలో',
            words: [
              { text: 'ఈ', start: 40.0, end: 41.5 },
              { text: 'నిశ్శబ్ద', start: 41.5, end: 44.2 },
              { text: 'రేయిలో', start: 44.2, end: 47.0 }
            ]
          },
          {
            time: 48,
            duration: 9,
            text: 'నువ్వే నా వెలుగు జాడ',
            words: [
              { text: 'నువ్వే', start: 48.0, end: 50.8 },
              { text: 'నా', start: 50.8, end: 52.0 },
              { text: 'వెలుగు', start: 52.0, end: 54.5 },
              { text: 'జాడ', start: 54.5, end: 56.5 }
            ]
          },
          {
            time: 58,
            duration: 8,
            text: 'ప్రతి శ్వాసలో నీ జపమే',
            words: [
              { text: 'ప్రతి', start: 58.0, end: 60.0 },
              { text: 'శ్వాసలో', start: 60.0, end: 62.8 },
              { text: 'నీ', start: 62.8, end: 64.0 },
              { text: 'జపమే', start: 64.0, end: 66.0 }
            ]
          },
          {
            time: 67,
            duration: 7,
            text: 'ఉదయించే వెలుగుల వరకు',
            words: [
              { text: 'ఉదయించే', start: 67.0, end: 69.8 },
              { text: 'వెలుగుల', start: 69.8, end: 72.0 },
              { text: 'వరకు', start: 72.0, end: 74.0 }
            ]
          }
        ]
      }
    },
    audioSignature: {
      chordProgression: ['G', 'Em', 'C', 'D'],
      tempo: 76,
      baseFreq: 196.00 // G3
    }
  },
  {
    id: 'vennela',
    title: 'Vennela',
    artist: 'Rishi',
    duration: 210, // 03:30
    genre: 'Acoustic Moonlit Soul',
    language: 'te',
    originalLanguage: 'te',
    bpm: 72,
    musicalKey: 'A Minor',
    karaokeReady: true,
    artwork: {
      palette: ['#8FA8C8', '#1E293B', '#090D16', '#F4DFC9'],
      pattern: 'geometric',
      accentWarm: '#F4DFC9',
      accentCool: '#8FA8C8'
    },
    sections: [
      {
        type: 'verse',
        label: 'Verse 1',
        start: 14,
        end: 50
      },
      {
        type: 'chorus',
        label: 'Chorus',
        start: 52,
        end: 88
      },
      {
        type: 'bridge',
        label: 'Bridge',
        start: 92,
        end: 122
      }
    ],
    lyrics: {
      en: {
        chorusSnippet: 'Silver moonlight washes away all the tears of yesterday',
        lines: [
          {
            time: 52,
            duration: 8,
            text: 'Silver moonlight washes away',
            words: [
              { text: 'Silver', start: 52.0, end: 53.8 },
              { text: 'moonlight', start: 53.8, end: 55.8 },
              { text: 'washes', start: 55.8, end: 57.5 },
              { text: 'away', start: 57.5, end: 60.0 }
            ]
          },
          {
            time: 61,
            duration: 9,
            text: 'all the tears of yesterday',
            words: [
              { text: 'all', start: 61.0, end: 62.0 },
              { text: 'the', start: 62.0, end: 62.8 },
              { text: 'tears', start: 62.8, end: 64.5 },
              { text: 'of', start: 64.5, end: 65.5 },
              { text: 'yesterday', start: 65.5, end: 69.0 }
            ]
          },
          {
            time: 70,
            duration: 9,
            text: 'stay with me until the morning',
            words: [
              { text: 'stay', start: 70.0, end: 71.5 },
              { text: 'with', start: 71.5, end: 72.8 },
              { text: 'me', start: 72.8, end: 74.0 },
              { text: 'until', start: 74.0, end: 75.8 },
              { text: 'the', start: 75.8, end: 76.5 },
              { text: 'morning', start: 76.5, end: 79.0 }
            ]
          },
          {
            time: 80,
            duration: 8,
            text: 'let the silence heal our heart',
            words: [
              { text: 'let', start: 80.0, end: 81.2 },
              { text: 'the', start: 81.2, end: 82.0 },
              { text: 'silence', start: 82.0, end: 84.0 },
              { text: 'heal', start: 84.0, end: 85.5 },
              { text: 'our', start: 85.5, end: 86.5 },
              { text: 'heart', start: 86.5, end: 88.0 }
            ]
          }
        ]
      },
      hi: {
        chorusSnippet: 'चाँदनी की ये नरम चादर, बहा ले गई कल के सारे आँसू',
        lines: [
          {
            time: 52,
            duration: 8,
            text: 'चाँदनी की ये नरम चादर',
            words: [
              { text: 'चाँदनी', start: 52.0, end: 54.0 },
              { text: 'की', start: 54.0, end: 55.0 },
              { text: 'ये', start: 55.0, end: 56.0 },
              { text: 'नरम', start: 56.0, end: 57.5 },
              { text: 'चादर', start: 57.5, end: 60.0 }
            ]
          },
          {
            time: 61,
            duration: 9,
            text: 'बहा ले गई कल के सारे आँसू',
            words: [
              { text: 'बहा', start: 61.0, end: 62.5 },
              { text: 'ले', start: 62.5, end: 63.5 },
              { text: 'गई', start: 63.5, end: 64.5 },
              { text: 'कल', start: 64.5, end: 65.8 },
              { text: 'के', start: 65.8, end: 66.8 },
              { text: 'सारे', start: 66.8, end: 68.0 },
              { text: 'आँसू', start: 68.0, end: 70.0 }
            ]
          },
          {
            time: 70,
            duration: 9,
            text: 'सुबह तक यूँ ही ठहर जा',
            words: [
              { text: 'सुबह', start: 70.0, end: 72.0 },
              { text: 'तक', start: 72.0, end: 73.2 },
              { text: 'यूँ', start: 73.2, end: 74.2 },
              { text: 'ही', start: 74.2, end: 75.2 },
              { text: 'ठहर', start: 75.2, end: 77.2 },
              { text: 'जा', start: 77.2, end: 79.0 }
            ]
          },
          {
            time: 80,
            duration: 8,
            text: 'ख़ामोशी को ज़ख़्म भरने दे',
            words: [
              { text: 'ख़ामोशी', start: 80.0, end: 82.5 },
              { text: 'को', start: 82.5, end: 83.5 },
              { text: 'ज़ख़्म', start: 83.5, end: 85.5 },
              { text: 'भरने', start: 85.5, end: 87.0 },
              { text: 'दे', start: 87.0, end: 88.0 }
            ]
          }
        ]
      },
      te: {
        chorusSnippet: 'వెన్నెల కురిసే వేళలో, కరిగిపోయే నిన్నటి కన్నీరు',
        lines: [
          {
            time: 52,
            duration: 8,
            text: 'వెన్నెల కురిసే వేళలో',
            words: [
              { text: 'వెన్నెల', start: 52.0, end: 54.5 },
              { text: 'కురిసే', start: 54.5, end: 57.0 },
              { text: 'వేళలో', start: 57.0, end: 60.0 }
            ]
          },
          {
            time: 61,
            duration: 9,
            text: 'కరిగిపోయే నిన్నటి కన్నీరు',
            words: [
              { text: 'కరిగిపోయే', start: 61.0, end: 64.0 },
              { text: 'నిన్నటి', start: 64.0, end: 66.5 },
              { text: 'కన్నీరు', start: 66.5, end: 70.0 }
            ]
          },
          {
            time: 70,
            duration: 9,
            text: 'ఉదయం దాకా తోడుగా ఉండు',
            words: [
              { text: 'ఉదయం', start: 70.0, end: 72.5 },
              { text: 'దాకా', start: 72.5, end: 74.5 },
              { text: 'తోడుగా', start: 74.5, end: 77.0 },
              { text: 'ఉండు', start: 77.0, end: 79.0 }
            ]
          },
          {
            time: 80,
            duration: 8,
            text: 'ఈ మౌనం మన గాయం మాన్పనీ',
            words: [
              { text: 'ఈ', start: 80.0, end: 81.2 },
              { text: 'మౌనం', start: 81.2, end: 83.2 },
              { text: 'మన', start: 83.2, end: 84.5 },
              { text: 'గాయం', start: 84.5, end: 86.5 },
              { text: 'మాన్పనీ', start: 86.5, end: 88.0 }
            ]
          }
        ]
      }
    },
    audioSignature: {
      chordProgression: ['Am', 'F', 'C', 'G'],
      tempo: 72,
      baseFreq: 220.00 // A3
    }
  },
  {
    id: 'khaab',
    title: 'Khaab',
    artist: 'Mira',
    duration: 188, // 03:08
    genre: 'Dream Ambient Pop',
    language: 'hi',
    originalLanguage: 'hi',
    bpm: 82,
    musicalKey: 'F# Minor',
    karaokeReady: true,
    artwork: {
      palette: ['#E7A58D', '#2A1B28', '#0F0B13', '#F4DFC9'],
      pattern: 'solaris',
      accentWarm: '#E7A58D',
      accentCool: '#8FA8C8'
    },
    sections: [
      {
        type: 'verse',
        label: 'Verse 1',
        start: 10,
        end: 44
      },
      {
        type: 'chorus',
        label: 'Chorus',
        start: 46,
        end: 80
      },
      {
        type: 'bridge',
        label: 'Bridge',
        start: 84,
        end: 114
      }
    ],
    lyrics: {
      en: {
        chorusSnippet: 'A dream adrift in twilight, longing for dawn to stay',
        lines: [
          {
            time: 46,
            duration: 8,
            text: 'A dream adrift in twilight',
            words: [
              { text: 'A', start: 46.0, end: 47.0 },
              { text: 'dream', start: 47.0, end: 48.5 },
              { text: 'adrift', start: 48.5, end: 50.5 },
              { text: 'in', start: 50.5, end: 51.5 },
              { text: 'twilight', start: 51.5, end: 54.0 }
            ]
          },
          {
            time: 55,
            duration: 9,
            text: 'longing for dawn to stay',
            words: [
              { text: 'longing', start: 55.0, end: 57.0 },
              { text: 'for', start: 57.0, end: 58.0 },
              { text: 'dawn', start: 58.0, end: 60.0 },
              { text: 'to', start: 60.0, end: 61.0 },
              { text: 'stay', start: 61.0, end: 63.5 }
            ]
          },
          {
            time: 64,
            duration: 8,
            text: 'we dissolve into the echoes',
            words: [
              { text: 'we', start: 64.0, end: 65.0 },
              { text: 'dissolve', start: 65.0, end: 67.2 },
              { text: 'into', start: 67.2, end: 68.8 },
              { text: 'the', start: 68.8, end: 69.8 },
              { text: 'echoes', start: 69.8, end: 72.0 }
            ]
          },
          {
            time: 73,
            duration: 7,
            text: 'where time forgets its way',
            words: [
              { text: 'where', start: 73.0, end: 74.5 },
              { text: 'time', start: 74.5, end: 76.0 },
              { text: 'forgets', start: 76.0, end: 78.0 },
              { text: 'its', start: 78.0, end: 78.8 },
              { text: 'way', start: 78.8, end: 80.0 }
            ]
          }
        ]
      },
      hi: {
        chorusSnippet: 'शाम की धुंध में तैरता इक ख्वाब, सुबह की चाहत लिए बैठा है',
        lines: [
          {
            time: 46,
            duration: 8,
            text: 'शाम की धुंध में तैरता इक ख्वाब',
            words: [
              { text: 'शाम', start: 46.0, end: 47.8 },
              { text: 'की', start: 47.8, end: 48.8 },
              { text: 'धुंध', start: 48.8, end: 50.2 },
              { text: 'में', start: 50.2, end: 51.2 },
              { text: 'तैरता', start: 51.2, end: 52.8 },
              { text: 'इक', start: 52.8, end: 53.5 },
              { text: 'ख्वाब', start: 53.5, end: 54.5 }
            ]
          },
          {
            time: 55,
            duration: 9,
            text: 'सुबह की चाहत लिए बैठा है',
            words: [
              { text: 'सुबह', start: 55.0, end: 56.8 },
              { text: 'की', start: 56.8, end: 57.8 },
              { text: 'चाहत', start: 57.8, end: 59.8 },
              { text: 'लिए', start: 59.8, end: 61.2 },
              { text: 'बैठा', start: 61.2, end: 62.5 },
              { text: 'है', start: 62.5, end: 63.5 }
            ]
          },
          {
            time: 64,
            duration: 8,
            text: 'हम गूंज में पिघलते गए',
            words: [
              { text: 'हम', start: 64.0, end: 65.5 },
              { text: 'गूंज', start: 65.5, end: 67.2 },
              { text: 'में', start: 67.2, end: 68.2 },
              { text: 'पिघलते', start: 68.2, end: 70.5 },
              { text: 'गए', start: 70.5, end: 72.0 }
            ]
          },
          {
            time: 73,
            duration: 7,
            text: 'जहाँ वक़्त भी रास्ता भूल गया',
            words: [
              { text: 'जहाँ', start: 73.0, end: 74.5 },
              { text: 'वक़्त', start: 74.5, end: 76.0 },
              { text: 'भी', start: 76.0, end: 76.8 },
              { text: 'रास्ता', start: 76.8, end: 78.5 },
              { text: 'भूल', start: 78.5, end: 79.5 },
              { text: 'गया', start: 79.5, end: 80.0 }
            ]
          }
        ]
      },
      te: {
        chorusSnippet: 'సంధ్య వేళలో తేలే కల, ఉదయపు వెలుగుకై ఎదురుచూపు',
        lines: [
          {
            time: 46,
            duration: 8,
            text: 'సంధ్య వేళలో తేలే కల',
            words: [
              { text: 'సంధ్య', start: 46.0, end: 48.0 },
              { text: 'వేళలో', start: 48.0, end: 50.5 },
              { text: 'తేలే', start: 50.5, end: 52.5 },
              { text: 'కల', start: 52.5, end: 54.5 }
            ]
          },
          {
            time: 55,
            duration: 9,
            text: 'ఉదయపు వెలుగుకై ఎదురుచూపు',
            words: [
              { text: 'ఉదయపు', start: 55.0, end: 57.5 },
              { text: 'వెలుగుకై', start: 57.5, end: 60.5 },
              { text: 'ఎదురుచూపు', start: 60.5, end: 63.5 }
            ]
          },
          {
            time: 64,
            duration: 8,
            text: 'ప్రతిధ్వనులలో లీనమైపోయాం',
            words: [
              { text: 'ప్రతిధ్వనులలో', start: 64.0, end: 68.0 },
              { text: 'లీనమైపోయాం', start: 68.0, end: 72.0 }
            ]
          },
          {
            time: 73,
            duration: 7,
            text: 'కాలమే దారి మరిచే వేళ',
            words: [
              { text: 'కాలమే', start: 73.0, end: 75.5 },
              { text: 'దారి', start: 75.5, end: 77.5 },
              { text: 'మరిచే', start: 77.5, end: 79.0 },
              { text: 'వేళ', start: 79.0, end: 80.0 }
            ]
          }
        ]
      }
    },
    audioSignature: {
      chordProgression: ['F#m', 'D', 'A', 'E'],
      tempo: 82,
      baseFreq: 185.00 // F#3
    }
  }
];
