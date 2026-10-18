import type { TimedLyricLine } from '../types/music';

/**
 * SYNTHETIC TEST FIXTURE ONLY
 * ============================================================================
 * Specifically created for automated unit, CDP, and integration tests of
 * the HyperMelo Synchronized Lyric Engine.
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
    start_ms: 4000,
    end_ms: 8000,
    text: 'Walking down the neon corridor',
    original_language: 'en',
    karaoke: {
      native: 'Walking down the neon corridor',
      transliteration: 'Walking down the neon corridor'
    },
    listening_meaning: {
      en: 'Walking down the neon corridor',
      hi: 'नियॉन के गलियारे में चलते हुए',
      te: 'నియాన్ దారిలో నడుస్తూ',
      ta: 'நியோன் நடைபாதையில் நடக்கிறேன்',
      ml: 'നിയോൺ ഇടനാഴിയിലൂടെ നടക്കുന്നു'
    },
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
    start_ms: 9000,
    end_ms: 14500,
    text: 'Shadows dance against the midnight floor',
    original_language: 'en',
    karaoke: {
      native: 'Shadows dance against the midnight floor',
      transliteration: 'Shadows dance against the midnight floor'
    },
    listening_meaning: {
      en: 'Shadows dance against the midnight floor',
      hi: 'आधी रात के फर्श पर नाचती परछाइयां',
      te: 'అర్ధరాత్రి నేలపై నాట్యం చేసే నీడలు',
      ta: 'நள்ளிரவு தரையில் ஆடும் நிழல்கள்',
      ml: 'അർദ്ധരാത്രി തറയിൽ നൃത്തം ചെയ്യുന്ന നിഴലുകൾ'
    },
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
    start_ms: 16000,
    end_ms: 21000,
    text: 'Catch the rhythm in your beating heart',
    original_language: 'en',
    karaoke: {
      native: 'Catch the rhythm in your beating heart'
      // Note: transliteration intentionally omitted to test honest fallback!
    },
    listening_meaning: {
      en: 'Catch the rhythm in your beating heart',
      hi: 'धड़कते दिल में लय को महसूस करो',
      ta: 'துடிக்கும் இதயத்தில் தாளத்தைப் பிடி'
      // NOTE: Telugu and Malayalam intentionally omitted to verify honest "Translation unavailable" behavior
    },
    time: 16.0,
    duration: 5.0,
    translations: {
      en: 'Catch the rhythm in your beating heart',
      hi: 'धड़कते दिल में लय को महसूस करो',
      ta: 'துடிக்கும் இதயத்தில் தாளத்தைப் பிடி'
    }
  },
  {
    id: 'test-lyric-3',
    startTime: 22.0,
    endTime: 27.5,
    start_ms: 22000,
    end_ms: 27500,
    text: 'Every ending holds a brand new start',
    original_language: 'en',
    karaoke: {
      native: 'Every ending holds a brand new start',
      transliteration: 'Every ending holds a brand new start'
    },
    listening_meaning: {
      en: 'Every ending holds a brand new start',
      hi: 'हर अंत में एक नई शुरुआत होती है',
      te: 'ప్రతి ముగింపులో సరికొత్త ఆరంభం ఉంది',
      ta: 'ஒவ்வொரு முடிவிலும் புதிய தொடக்கம் உண்டு',
      ml: 'ഓരോ അവസാനത്തിലും ഒരു പുതിയ തുടക്കമുണ്ട്'
    },
    time: 22.0,
    duration: 5.5,
    translations: {
      en: 'Every ending holds a brand new start',
      hi: 'हर अंत में एक नई शुरुआत होती है',
      te: 'ప్రతి ముగింపులో సరికొత్త ఆరంభం ఉంది',
      ta: 'ஒவ்வொரு முடிவிலும் புதிய தொடக்கம் உண்டு',
      ml: 'ഓരോ അവസാനത്തിലും ఒక కొత్త തുടക്കമുണ്ട്'
    }
  },
  {
    id: 'test-lyric-4',
    startTime: 29.0,
    endTime: 35.0,
    start_ms: 29000,
    end_ms: 35000,
    text: 'Listen close until the morning light',
    original_language: 'en',
    karaoke: {
      native: 'Listen close until the morning light',
      transliteration: 'Listen close until the morning light'
    },
    listening_meaning: {
      en: 'Listen close until the morning light',
      hi: 'सुबह की रौशनी तक गौर से सुनो',
      te: 'ఉదయపు వెలుగు వచ్చే వరకు వింటూ ఉండు',
      ta: 'காலை வெளிச்சம் வரை உற்றுக் கேள்',
      ml: 'പ്രഭാത വെളിച്ചം വരെ ശ്രദ്ധിച്ചു കേൾക്കൂ'
    },
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

/**
 * Verified Multi-Language Dual-Mode Test Fixtures:
 * Demonstrates:
 * 1. Karaoke: Native script vs Roman Transliteration (Original words only!)
 * 2. Listening: Original words as primary line, poetic meaning in selected language below.
 */
export const TEST_HINDI_DUAL_MODE_FIXTURE: TimedLyricLine[] = [
  {
    id: 'hi-dual-0',
    startTime: 12.0,
    endTime: 18.0,
    start_ms: 12000,
    end_ms: 18000,
    text: 'तुम ही हो',
    original_language: 'hi',
    karaoke: {
      native: 'तुम ही हो',
      transliteration: 'Tum hi ho'
    },
    listening_meaning: {
      en: 'You alone are my life and sanctuary',
      hi: 'तुम ही मेरी ज़िंदगी और आसरा हो',
      te: 'నువ్వే ఉన్నావు, నా ప్రాణం నీవే',
      ta: 'நீ மட்டுமே என் வாழ்வும் அடைக்கலமும்',
      ml: 'നീ മാത്രമാണ് എന്റെ ജീവനും അഭയവും'
    },
    time: 12.0,
    duration: 6.0,
    words: [
      { text: 'तुम', start: 12.0, end: 14.0 },
      { text: 'ही', start: 14.0, end: 15.5 },
      { text: 'हो', start: 15.5, end: 18.0 }
    ],
    translations: {
      en: 'You alone are my life and sanctuary',
      hi: 'तुम ही हो',
      te: 'నువ్వే ఉన్నావు',
      ta: 'நீ மட்டுமே',
      ml: 'നീ മാത്രം'
    }
  },
  {
    id: 'hi-dual-1',
    startTime: 19.0,
    endTime: 25.0,
    start_ms: 19000,
    end_ms: 25000,
    text: 'अब तुम ही हो मेरी आशिक़ी',
    original_language: 'hi',
    karaoke: {
      native: 'अब तुम ही हो मेरी आशिक़ी',
      transliteration: 'Ab tum hi ho meri aashiqui'
    },
    listening_meaning: {
      en: 'Now you alone are my only devotion',
      hi: 'अब तुम ही मेरी एकमात्र मोहब्बत हो',
      te: 'ఇప్పుడు నా సర్వస్వం నువ్వే'
      // Note: ta and ml intentionally omitted to test honest fallback!
    },
    time: 19.0,
    duration: 6.0,
    translations: {
      en: 'Now you alone are my only devotion',
      hi: 'अब तुम ही हो मेरी आशिक़ी',
      te: 'ఇప్పుడు నా సర్వస్వం నువ్వే'
    }
  }
];

export const TEST_TELUGU_DUAL_MODE_FIXTURE: TimedLyricLine[] = [
  {
    id: 'te-dual-0',
    startTime: 24.5,
    endTime: 28.2,
    start_ms: 24500,
    end_ms: 28200,
    text: 'నీలి నీలి ఆకాశం ఇద్దామనుకున్నా',
    original_language: 'te',
    karaoke: {
      native: 'నీలి నీలి ఆకాశం ఇద్దామనుకున్నా',
      transliteration: 'Neeli neeli aakaasam iddaamanukunnaa'
    },
    listening_meaning: {
      en: 'I wanted to gift you the vast blue sky',
      hi: 'मैं तुम्हें यह नीला आसमान तोहफे में देना चाहता था',
      te: 'నీలి నీలి ఆకాశం ఇద్దామనుకున్నా',
      ta: 'நீல நீல வானத்தை உனக்கு பரிசளிக்க நினைத்தேன்',
      ml: 'നീല നീല ആകാശം നിനക്ക് സമ്മാനിക്കാൻ ഞാൻ ആഗ്രഹിച്ചു'
    },
    time: 24.5,
    duration: 3.7,
    translations: {
      en: 'I wanted to gift you the vast blue sky',
      hi: 'मैं तुम्हें यह नीला आसमान तोहफे में देना चाहता था',
      te: 'నీలి నీలి ఆకాశం ఇద్దామనుకున్నా',
      ta: 'நீல நீல வானத்தை உனக்கு பரிசளிக்க நினைத்தேன்',
      ml: 'നീല നീല ആകാശം നിനക്ക് സമ്മാനിക്കാൻ ഞാൻ ആഗ്രഹിച്ചു'
    }
  }
];

export const TEST_PLAIN_LYRICS_FIXTURE: TimedLyricLine[] = [
  {
    id: 'test-plain-0',
    startTime: -1,
    text: 'Just a plain lyric line without timestamps',
    original_language: 'en',
    karaoke: {
      native: 'Just a plain lyric line without timestamps'
    }
  },
  {
    id: 'test-plain-1',
    startTime: -1,
    text: 'Another plain lyric line without timestamps',
    original_language: 'en',
    karaoke: {
      native: 'Another plain lyric line without timestamps'
    }
  }
];
