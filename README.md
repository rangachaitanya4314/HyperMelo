# HyperMelo

### Your music. Your lyrics. Your moment.

HyperMelo is a modern music and karaoke experience built to bring music discovery, playback, synchronized lyrics, multilingual lyric experiences, and creative sharing together in one place.

Designed around an immersive listening experience, HyperMelo combines an expressive music player with karaoke tools and lyric-focused features, with particular attention to regional music and multilingual audiences.

<p align="center">
  <strong>Discover · Listen · Read · Sing · Share</strong>
</p>

---

## Overview

Music is more than playback. It is the lyrics, the language, the emotion, and the moments people want to share.

HyperMelo aims to bring these parts of the experience together through:

- Music discovery and browsing.
- A dedicated Now Playing experience.
- Playback controls and queue management.
- Lyrics display and synchronized lyric progression.
- Multilingual lyric representations.
- Karaoke and sing-along experiences.
- Share Moment, designed around sharing selected lyric moments.
- An adaptive, artwork-inspired visual experience.

**Product website:** https://hypermelo.app

---

## Features

### 🎵 Music Discovery

Explore music through the catalogue and discovery experience.

- Search for tracks.
- Browse curated music collections.
- Explore music by mood and category.
- View track and artist information.
- Open selected tracks in the listening experience.

Catalogue availability depends on supported music providers and their access policies.

### 🎧 Immersive Now Playing

HyperMelo provides a dedicated listening interface designed around the currently playing track.

- Album artwork presentation.
- Playback controls.
- Previous and next track navigation.
- Shuffle and repeat controls.
- Queue access.
- Lyrics access.
- Contextual track actions.
- Artwork-inspired ambient visual styling.

The interface is designed to keep the listening experience focused while making secondary actions accessible.

### 📝 Lyrics Experience

Lyrics are an important part of HyperMelo.

The lyrics system supports:

- Synchronized, timestamped lyric lines when verified timing data is available.
- Plain lyrics when synchronized timestamps are unavailable.
- Playback-aware active-line progression.
- Lyric seeking where supported.
- Multilingual lyric representations.
- Native-script and romanized lyric distinctions.
- Explicit handling of unavailable or unresolved lyric data.

HyperMelo aims to distinguish verified native-script lyrics, transliteration, and translations rather than presenting them as interchangeable.

Lyrics availability and synchronization depend on the supported providers and the rights to access the relevant content.

### 🎤 Karaoke Mode

HyperMelo includes a dedicated karaoke experience.

Its capabilities include:

- Selecting tracks for a sing-along session.
- Displaying available lyrics.
- Following timestamped lyrics during playback.
- Seeking through lyric lines where supported.
- Handling plain lyrics when synchronized lyrics are unavailable.
- Recording-session interface and controls.

Karaoke functionality depends on the selected track, its playback source, and available lyric data.

**Vocal removal status:** HyperMelo has support for verified instrumental assets and experimental center-channel vocal suppression. Neural AI stem separation is not yet integrated for arbitrary tracks. Experimental suppression should not be treated as guaranteed vocal removal.

### ✨ Share Moment

Share Moment is designed to turn selected lyric moments into visual content.

Features include:

- Multiple visual templates.
- Lyric selection and timeline controls.
- Adjustable clip duration.
- Preview before export.
- Available lyric-language representations.
- Video export and supported device-sharing workflows.

Audio export behavior depends on the source track's licensing and usage rights. Commercial streaming previews may require silent visual exports rather than embedding protected audio.

Sharing through a device's native share interface does not guarantee direct posting to every social platform.

---

## Technology

HyperMelo's current web application is built around the following technologies:

| Technology | Purpose |
|---|---|
| React | User interface |
| TypeScript | Application logic and type safety |
| Vite | Development server and production build |
| CSS | Responsive interface and visual styling |
| Web Audio API | Browser audio processing capabilities |
| HTML Media APIs | Audio playback and media handling |
| Canvas API | Visual composition and media rendering |
| MediaRecorder API | Supported browser media recording and export |

The application also uses service modules for music catalogue access, playback-source resolution, lyrics retrieval, lyric processing, and sharing workflows.

The exact providers and capabilities available depend on configuration, network access, and provider policies.

---

## Architecture

HyperMelo separates the user experience from its underlying service responsibilities.

```text
HyperMelo
│
├── React Application
│   ├── Discovery
│   ├── Search
│   ├── Library
│   ├── Now Playing
│   ├── Lyrics
│   ├── Karaoke
│   └── Share Moment
│
├── Playback Services
│   ├── Playback Controller
│   ├── Playback Source Resolution
│   └── Queue and Playback State
│
├── Lyrics Services
│   ├── Provider Orchestration
│   ├── Lyrics Validation
│   ├── Language Detection
│   ├── Script Classification
│   └── Playback Synchronization
│
├── Audio Services
│   ├── Web Audio Processing
│   └── Vocal Suppression Experiments
│
└── Backend Services
    ├── Catalogue and Provider Integration
    ├── Lyrics Ingestion
    └── API Services
```

This is a conceptual architecture overview, not a generated inventory of every source file.

---

## Getting Started

### Prerequisites

- Node.js with npm.
- Git.
- A supported desktop operating system.
- Network access for services and music providers that require it.

### 1. Clone the repository

```bash
git clone https://github.com/rangachaitanya4314/NARO.git
cd NARO
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the environment

Review the repository's existing environment example and application configuration before starting.

If the project requires provider credentials or backend configuration, supply them through local environment variables.

**Never commit API keys, provider credentials, tokens, or private configuration files.**

### 4. Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

### 5. Create a production build

```bash
npm run build
```

For TypeScript validation:

```bash
npx tsc --noEmit
```

---

## Testing

HyperMelo uses focused verification scripts and browser-based testing to validate important application behavior.

Areas of testing include:

- Playback and track switching.
- Lyrics retrieval and synchronization.
- Native-script and romanized lyric handling.
- Karaoke interactions.
- Responsive layouts.
- Share Moment preview and export behavior.
- Error handling and provider availability.

Run a verification script using the project's installed TypeScript runner when available:

```bash
npx tsx scripts/<verification-script>.ts
```

Use the actual script names present in the repository.

Browser-based end-to-end tests should be run against the relevant local application build and supported test environment.

---

## Project Status

HyperMelo is under active development.

| Area | Status |
|---|---|
| Music discovery and search | Implemented; provider-dependent |
| Now Playing experience | Implemented |
| Playback and queue | Implemented; source-dependent |
| Lyrics retrieval | Implemented; coverage varies |
| Synchronized lyrics | Supported when verified timing data exists |
| Multilingual lyric handling | Implemented with availability limitations |
| Karaoke experience | Implemented |
| Share Moment | Implemented with source-rights restrictions |
| Universal AI vocal separation | Not yet implemented |
| Android application packaging | Planned after web stabilization |

A feature being present in the interface does not necessarily mean every provider, track, language, or device supports it.

HyperMelo does not intentionally fabricate lyrics, translations, timestamps, or instrumental versions to create the appearance of complete coverage.

---

## Music, Lyrics and Content Rights

HyperMelo integrates with external music and content sources where supported.

- Music playback depends on the relevant provider's availability and terms.
- Lyrics may be subject to copyright and provider restrictions.
- Audio previews may be shorter than the original commercial recording.
- A preview must not be represented as a full-length track.
- Protected streams may restrict audio processing and recording.
- Share Moment respects source-audio restrictions.
- Users are responsible for complying with the applicable rights and terms when sharing content.

HyperMelo does not claim ownership of third-party music, lyrics, artwork, or trademarks.

---

## Android Roadmap

The current priority is stabilizing and completing the React web experience.

Android packaging is planned after the website reaches an approved level of stability. The intended direction is to reuse the React application and add native Android capabilities where appropriate, including background playback, media controls, audio focus, and native sharing.

The Android release should not be considered available until it has been built, tested, and officially released.

---

## Development Principles

HyperMelo follows a few important product principles:

1. **Accuracy over appearance** — do not fabricate lyrics, translations, timestamps, or playback availability.
2. **Shared solutions over isolated patches** — fix common services and workflows instead of adding song-specific workarounds.
3. **Playback integrity** — switching tracks must not accidentally continue playing unrelated audio.
4. **Multilingual respect** — distinguish native scripts, transliterations, and translations.
5. **Responsive design** — keep the listening and karaoke experience usable across screen sizes.
6. **Rights-aware sharing** — respect source-audio restrictions and content licensing.
7. **Regression testing** — protect existing features when introducing new functionality.

---

## Contributing

Contributions, bug reports, and thoughtful suggestions are welcome.

Before proposing a change:

1. Describe the problem or improvement.
2. Identify the affected feature.
3. Explain how the change can be tested.
4. Check that existing playback, lyrics, and sharing workflows remain intact.

For substantial changes, open an issue or discussion before starting implementation.

---

## Project

**HyperMelo**  
A music, lyrics, and karaoke experience.

Website: https://hypermelo.app  
Repository: https://github.com/rangachaitanya4314/HyperMelo

---

<p align="center">
  <strong>HyperMelo — Feel the music. Follow the lyrics. Sing your moment.</strong>
</p>
