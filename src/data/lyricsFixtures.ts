import type { TimedLyricLine } from '../types/music';

/**
 * SYNTHETIC TEST FIXTURE ONLY
 * ============================================================================
 * Specifically created for automated unit, CDP, and integration tests of
 * the NARO Synchronized Lyric Engine.
 *
 * DO NOT associate with any commercial music track.
 * DO NOT claim this belongs to Shot Down, Channa Mereya, or any real artist.
 * ============================================================================
 */
export const TEST_SYNCED_LYRICS_FIXTURE: TimedLyricLine[] = [
  {
    id: 'test-lyric-0',
    startTime: 4.0,
    endTime: 8.0,
    text: 'Walking down the neon corridor',
    time: 4.0,
    duration: 4.0,
    translations: {
      en: 'Walking down the neon corridor',
      hi: 'नियॉन के गलियारे में चलते हुए',
      te: 'నియాన్ దారిలో నడుస్తూ',
      ta: 'நியோன் நடைபாதையில் நடக்கிறேன்',
      ml: 'നിയോൺ ഇടനാഴിയിലൂടെ നടക്കുന്നു'
    }
  },
  {
    id: 'test-lyric-1',
    startTime: 9.0,
    endTime: 14.5,
    text: 'Shadows dance against the midnight floor',
    time: 9.0,
    duration: 5.5,
    translations: {
      en: 'Shadows dance against the midnight floor',
      hi: 'आधी रात के फर्श पर नाचती परछाइयां',
      te: 'అర్ధరాత్రి నేలపై నాట్యం చేసే నీడలు',
      ta: 'நள்ளிரவு தரையில் ஆடும் நிழல்கள்',
      ml: 'അർദ്ധരാത്രി തറയിൽ നൃത്തം ചെയ്യുന്ന നിഴലുകൾ'
    }
  },
  {
    id: 'test-lyric-2',
    startTime: 16.0,
    endTime: 21.0,
    text: 'Catch the rhythm in your beating heart',
    time: 16.0,
    duration: 5.0,
    translations: {
      en: 'Catch the rhythm in your beating heart',
      hi: 'धड़कते दिल में लय को महसूस करो',
      ta: 'துடிக்கும் இதயத்தில் தாளத்தைப் பிடி'
      // NOTE: Telugu and Malayalam intentionally omitted to verify honest "Translation unavailable" behavior
    }
  },
  {
    id: 'test-lyric-3',
    startTime: 22.0,
    endTime: 27.5,
    text: 'Every ending holds a brand new start',
    time: 22.0,
    duration: 5.5,
    translations: {
      en: 'Every ending holds a brand new start',
      hi: 'हर अंत में एक नई शुरुआत होती है',
      te: 'ప్రతి ముగింపులో సరికొత్త ఆరంభం ఉంది',
      ta: 'ஒவ்வொரு முடிவிலும் புதிய தொடக்கம் உண்டு',
      ml: 'ഓരോ അവസാനത്തിലും ഒരു പുതിയ തുടക്കമുണ്ട്'
    }
  },
  {
    id: 'test-lyric-4',
    startTime: 29.0,
    endTime: 35.0,
    text: 'Listen close until the morning light',
    time: 29.0,
    duration: 6.0,
    translations: {
      en: 'Listen close until the morning light',
      hi: 'सुबह की रौशनी तक गौर से सुनो',
      te: 'ఉదయపు వెలుగు వచ్చే వరకు వింటూ ఉండు',
      ta: 'காலை வெளிச்சம் வரை உற்றுக் கேள்',
      ml: 'പ്രഭാത വെളിച്ചം വരെ ശ്രദ്ധിച്ചു കേൾക്കൂ'
    }
  }
];

export const TEST_PLAIN_LYRICS_FIXTURE: TimedLyricLine[] = [
  {
    id: 'test-plain-0',
    startTime: -1,
    text: 'Just a plain lyric line without timestamps'
  },
  {
    id: 'test-plain-1',
    startTime: -1,
    text: 'Another plain lyric line without timestamps'
  }
];
