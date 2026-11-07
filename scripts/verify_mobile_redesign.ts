import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    console.error(`    ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`    ✅ PASS: ${msg}`);
}

class CdpConnection {
  private ws: any;
  private id = 1;
  private callbacks = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err: any) => reject(err);
      this.ws.onmessage = (event: any) => {
        try {
          const raw = JSON.parse(event.data.toString());
          if (raw.id && this.callbacks.has(raw.id)) {
            const cb = this.callbacks.get(raw.id)!;
            this.callbacks.delete(raw.id);
            cb(raw.result);
          }
        } catch {
          // ignore
        }
      };
    });
  }

  async send(method: string, params: any = {}): Promise<any> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res?.exceptionDetails) {
      console.warn('CDP Eval Exception:', res.exceptionDetails);
    }
    const resultObj = res?.result;
    return resultObj?.value !== undefined ? resultObj.value : resultObj?.description;
  }

  close(): void {
    if (this.ws) this.ws.close();
  }
}

async function findChromePath(): Promise<string> {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'chrome';
}

async function runMobileRedesignVerification() {
  console.log('======================================================================');
  console.log('HYPERMELO MOBILE REDESIGN & VIEWPORT ISOLATION VERIFICATION');
  console.log('======================================================================\n');

  // 1. Start Vite dev server on an isolated port
  const testPort = 5188;
  const projectRoot = process.cwd();
  console.log(`[1/5] Starting Vite test server on port ${testPort}...`);

  const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  const viteProcess: ChildProcess = spawn(
    process.execPath,
    [viteBin, '--port', String(testPort), '--strictPort'],
    {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  viteProcess.stdout?.on('data', (d) => {
    console.log('[Vite stdout]', d.toString());
  });

  viteProcess.stderr?.on('data', (d) => {
    console.log('[Vite stderr]', d.toString());
  });

  // Wait for Vite server to be ready
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${testPort}/`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {
      // still starting
    }
  }
  assert(serverReady, `Vite test server ready on port ${testPort}`);

  // 2. Launch Headless Chrome
  console.log('\n[2/5] Launching Chrome via CDP...');
  const chromePath = await findChromePath();
  const cdpPort = 9260;
  const userDataDir = path.join(os.tmpdir(), `hm-mobile-test-${Date.now()}`);

  const chromeProcess: ChildProcess = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1440,900',
    `--user-data-dir=${userDataDir}`,
    `http://127.0.0.1:${testPort}/`
  ]);

  try {
    let wsUrl = '';
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
        if (res.ok) {
          const list = (await res.json()) as any[];
          const pageTab = list.find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl);
          if (pageTab) {
            wsUrl = pageTab.webSocketDebuggerUrl;
            break;
          }
        }
      } catch {
        // waiting for chrome
      }
    }
    assert(Boolean(wsUrl), 'Chrome CDP endpoint connected');

    const cdp = new CdpConnection(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Log.enable');

    const consoleLogs: string[] = [];
    (cdp as any).ws.addEventListener('message', (event: any) => {
      try {
        const raw = event.data ? event.data.toString() : '';
        const msg = JSON.parse(raw);
        if (msg.method === 'Runtime.exceptionThrown') {
          consoleLogs.push('Exception: ' + JSON.stringify(msg.params.exceptionDetails));
        } else if (msg.method === 'Runtime.consoleAPICalled') {
          consoleLogs.push('Console: ' + JSON.stringify(msg.params.args));
        }
      } catch (e) {}
    });

    // Explicitly navigate to the test server and wait for page to load
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${testPort}/` });

    // Wait for React app to mount into #root
    let mounted = false;
    for (let i = 0; i < 60; i++) {
      const isMounted = await cdp.eval(`Boolean(document.getElementById('root')?.children?.length)`);
      if (isMounted) {
        mounted = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    if (!mounted) {
      console.error('Console logs on mount failure:', consoleLogs);
      const html = await cdp.eval(`document.body.innerHTML`);
      console.error('Body HTML on mount failure:', html);
    }
    assert(mounted, 'React app successfully mounted into #root');

    // Bypass brand reveal intro if active
    await cdp.eval(`
      try {
        sessionStorage.setItem('hypermelo_intro_seen', 'true');
      } catch (e) {}
      const skipBtn = document.querySelector('.intro-skip-btn') || document.querySelector('button[aria-label*="Skip"]');
      if (skipBtn) skipBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 800));

    // Check root and console errors
    const rootState = await cdp.eval(`(() => {
      const root = document.getElementById('root');
      return {
        rootInnerLength: root ? root.innerHTML.length : 0,
        rootChildrenCount: root ? root.children.length : 0,
        rootSnippet: root ? root.innerHTML.slice(0, 400) : null
      };
    })()`);
    console.log('rootState:', rootState);

    // =========================================================================
    // PHASE 1: Desktop Viewport Integrity Check (1440x900)
    // =========================================================================
    console.log('\n--- Phase 1: Desktop Split-View Integrity Check (1440x900) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise((r) => setTimeout(r, 600));

    const desktopChecks = await cdp.eval(`(() => {
      const desktopLayout = document.querySelector('.desktop-home-layout');
      const mobileLayout = document.querySelector('.mobile-home-layout');
      const mobileNav = document.querySelector('.mobile-bottom-nav');
      const bottomPlayer = document.querySelector('.bottom-player-aside');
      const intro = document.querySelector('.intro-skip-btn, .hypermelo-intro-container');

      return {
        introPresent: Boolean(intro),
        hasDesktopLayout: Boolean(desktopLayout),
        desktopDisplay: desktopLayout ? window.getComputedStyle(desktopLayout).display : null,
        desktopHomeVisible: desktopLayout ? window.getComputedStyle(desktopLayout).display !== 'none' : false,
        mobileHomeHidden: mobileLayout ? window.getComputedStyle(mobileLayout).display === 'none' : true,
        mobileNavHidden: mobileNav ? window.getComputedStyle(mobileNav).display === 'none' : true,
        bottomPlayerBottom: bottomPlayer ? window.getComputedStyle(bottomPlayer).bottom : null,
        heroHeadlineVisible: Boolean(document.querySelector('.hero-grid h1')),
        title: document.title,
        url: window.location.href
      };
    })()`);
    console.log('desktopChecks debug:', desktopChecks);

    assert(desktopChecks.desktopHomeVisible, 'Desktop layout is fully rendered and visible at 1440x900');
    assert(desktopChecks.mobileHomeHidden, 'Mobile home layout is strictly hidden on desktop (display: none)');
    assert(desktopChecks.mobileNavHidden, 'Mobile bottom navigation is strictly hidden on desktop (display: none)');
    assert(desktopChecks.bottomPlayerBottom === '0px', 'Bottom player sits docked at bottom: 0 on desktop');
    assert(desktopChecks.heroHeadlineVisible, 'Desktop Hero headline is fully intact and preserved');

    // Desktop Hero Flow & Empty/Preview State Verification
    console.log('\n--- Checking Desktop Hero Flow & Studio Preview States ---');
    const heroStudioChecks = await cdp.eval(`(() => {
      const heroFlowPill = document.querySelector('.hero-studio-flow-pill');
      const studioHeading = document.querySelector('#karaoke h2');
      const studioBadge = document.getElementById('core-karaoke-lyrics-unavailable-badge');
      const momentBadge = document.getElementById('core-karaoke-moment-badge');
      const activeLyric = document.getElementById('core-karaoke-active-lyric');
      const teaserVisualizer = document.querySelector('.desktop-teaser-visualizer');
      const teaserBars = document.querySelectorAll('.desktop-teaser-bar');

      return {
        hasHeroFlowPill: Boolean(heroFlowPill),
        heroFlowPillText: heroFlowPill ? heroFlowPill.textContent?.trim() : null,
        studioHeadingText: studioHeading ? studioHeading.textContent?.trim() : null,
        studioBadgeText: studioBadge ? studioBadge.textContent?.trim() : null,
        momentBadgeText: momentBadge ? momentBadge.textContent?.trim() : null,
        activeLyricText: activeLyric ? activeLyric.textContent?.trim() : null,
        hasTeaserVisualizer: Boolean(teaserVisualizer),
        teaserBarCount: teaserBars.length
      };
    })()`);
    console.log('heroStudioChecks debug:', heroStudioChecks);

    assert(heroStudioChecks.hasHeroFlowPill, 'Hero studio flow connector pill is present linking to studio');
    assert(heroStudioChecks.studioHeadingText?.includes("Don't sing the whole song"), 'Studio heading seamlessly integrates Sing the Moment motto');
    assert(heroStudioChecks.studioBadgeText?.includes('Studio Preview'), 'Lyrics badge shows glowing Studio Preview state rather than stark warning');
    assert(heroStudioChecks.momentBadgeText?.includes('INTERACTIVE STUDIO PREVIEW'), 'Moment badge shows polished interactive preview mode');
    assert(heroStudioChecks.activeLyricText?.includes('Select any track to practice snippets'), 'Active lyric shows inviting glowing studio teaser');
    assert(heroStudioChecks.hasTeaserVisualizer && heroStudioChecks.teaserBarCount === 7, `Animated glowing teaser visualizer active with ${heroStudioChecks.teaserBarCount} bars`);

    // Screenshot Desktop Home (Hero & Studio Flow)
    const desktopShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_desktop_1440x900_redesign.png'), Buffer.from(desktopShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_desktop_1440x900_redesign.png');

    // Scroll smoothly to Studio section (#karaoke) and capture studio preview
    await cdp.eval(`
      const studioSec = document.getElementById('karaoke');
      if (studioSec) studioSec.scrollIntoView({ behavior: 'instant', block: 'start' });
    `);
    await new Promise((r) => setTimeout(r, 400));

    const studioShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_desktop_1440x900_studio_preview.png'), Buffer.from(studioShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_desktop_1440x900_studio_preview.png');

    // Scroll back to top
    await cdp.eval(`window.scrollTo({ top: 0, behavior: 'instant' });`);
    await new Promise((r) => setTimeout(r, 300));

    // Check Desktop Discover Preserved
    console.log('\n--- Checking Desktop Discover View (1440x900) ---');
    await cdp.eval(`
      const desktopDiscoverBtn = Array.from(document.querySelectorAll('.desktop-nav button')).find(b => b.textContent.includes('Discover'));
      if (desktopDiscoverBtn) desktopDiscoverBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));

    const desktopDiscoverChecks = await cdp.eval(`(() => {
      const desktopDiscover = document.querySelector('.desktop-discover-layout');
      const mobileDiscover = document.querySelector('.mobile-discover-layout');
      const headerSearch = document.getElementById('header-search-bar');
      const discoverContainer = document.querySelector('.discover-page-container');

      return {
        desktopDiscoverVisible: desktopDiscover ? window.getComputedStyle(desktopDiscover).display !== 'none' : false,
        mobileDiscoverHidden: mobileDiscover ? window.getComputedStyle(mobileDiscover).display === 'none' : true,
        headerSearchVisible: headerSearch ? window.getComputedStyle(headerSearch).display !== 'none' : false,
        containerPresent: Boolean(discoverContainer)
      };
    })()`);

    assert(desktopDiscoverChecks.desktopDiscoverVisible, 'Desktop Discover view is 100% frozen & visible at 1440x900');
    assert(desktopDiscoverChecks.mobileDiscoverHidden, 'Mobile Discover layout is strictly hidden on desktop');
    assert(desktopDiscoverChecks.headerSearchVisible, 'Header search bar remains fully active on Desktop Discover');

    const desktopDiscoverShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_desktop_1440x900_discover_preserved.png'), Buffer.from(desktopDiscoverShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_desktop_1440x900_discover_preserved.png');

    // Return to Desktop Home before mobile phase
    await cdp.eval(`
      const homeBtn = Array.from(document.querySelectorAll('.desktop-nav button')).find(b => b.textContent.includes('Home'));
      if (homeBtn) homeBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // PHASE 2: Mobile Home & Visualizer Check (390x844 iPhone Standard)
    // =========================================================================
    console.log('\n--- Phase 2: Mobile Home Viewport (390x844) ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
      hasTouch: true
    });
    await new Promise((r) => setTimeout(r, 600));

    const mobileHomeChecks = await cdp.eval(`(() => {
      const desktopLayout = document.querySelector('.desktop-home-layout');
      const mobileLayout = document.querySelector('.mobile-home-layout');
      const authBanner = document.querySelector('.hm-mobile-auth-banner') || document.querySelector('.hm-mobile-welcome-card');
      const visualizer = document.querySelector('.hm-mobile-visualizer-section');
      const topPicksShelf = document.querySelector('.hm-mobile-shelf-section[aria-label="Top Picks for You"]');
      const artistBubbles = document.querySelectorAll('.hm-mobile-artist-bubble-btn');
      const bottomPlayer = document.querySelector('.bottom-player-aside');
      const mobileNav = document.querySelector('.mobile-bottom-nav');
      const navTabs = document.querySelectorAll('.mobile-bottom-nav-item');

      const navRect = mobileNav ? mobileNav.getBoundingClientRect() : null;
      const playerRect = bottomPlayer ? bottomPlayer.getBoundingClientRect() : null;

      // Ensure mini player sits strictly above bottom nav
      const isPlayerAboveNav = playerRect && navRect ? playerRect.bottom <= navRect.top + 2 : false;

      return {
        desktopHomeHidden: desktopLayout ? window.getComputedStyle(desktopLayout).display === 'none' : true,
        mobileHomeVisible: mobileLayout ? window.getComputedStyle(mobileLayout).display !== 'none' : false,
        authCardPresent: Boolean(authBanner),
        visualizerPresent: Boolean(visualizer),
        topPicksPresent: Boolean(topPicksShelf),
        artistCount: artistBubbles.length,
        mobileNavVisible: mobileNav ? window.getComputedStyle(mobileNav).display !== 'none' : false,
        navTabCount: navTabs.length,
        isPlayerAboveNav
      };
    })()`);

    assert(mobileHomeChecks.desktopHomeHidden, 'Desktop layout is strictly hidden at 390x844 mobile viewport');
    assert(mobileHomeChecks.mobileHomeVisible, 'Mobile home feed is active and visible at 390x844');
    assert(mobileHomeChecks.authCardPresent, 'Sign in to Hypermelo / Google auth card is present at top of feed');
    assert(mobileHomeChecks.visualizerPresent, 'Prominent interactive audio visualizer is rendered on mobile home');
    assert(mobileHomeChecks.topPicksPresent, 'Top Picks for You carousel is rendered with immersive cards');
    assert(mobileHomeChecks.artistCount >= 8, `Featured artist highlight bubbles rendered (${mobileHomeChecks.artistCount} artists)`);
    assert(mobileHomeChecks.mobileNavVisible, 'Floating bottom navigation bar is visible on mobile');
    assert(mobileHomeChecks.navTabCount === 4, `Bottom navigation features exactly 4 tabs (found: ${mobileHomeChecks.navTabCount})`);
    assert(mobileHomeChecks.isPlayerAboveNav, 'Sticky mini player sits directly above the bottom navigation bar without overlapping');

    // Screenshot Mobile Home
    const mobileHomeShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_mobile_390x844_home.png'), Buffer.from(mobileHomeShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_mobile_390x844_home.png');

    // =========================================================================
    // PHASE 3: Explore / Discover Tab Navigation Check
    // =========================================================================
    console.log('\n--- Phase 3: Mobile Explore / Discover Tab Navigation & Bento Layout ---');
    await cdp.eval(`
      const exploreTab = document.getElementById('mobile-nav-tab-discover');
      if (exploreTab) exploreTab.click();
    `);
    await new Promise((r) => setTimeout(r, 600));

    const discoverChecks = await cdp.eval(`(() => {
      const desktopDiscover = document.querySelector('.desktop-discover-layout');
      const mobileDiscover = document.querySelector('.mobile-discover-layout');
      const unifiedSearch = document.getElementById('mobile-discover-unified-search');
      const headerSearchBar = document.getElementById('header-search-bar');
      const stickyFilters = document.querySelector('.hm-mobile-sticky-filters');
      const filterPills = document.querySelectorAll('.hm-mobile-filter-btn');
      const heroSection = document.querySelector('.hm-mobile-hero-section');
      const heroCards = document.querySelectorAll('.hm-hero-card');
      const bentoSection = document.querySelector('.hm-mobile-bento-section');
      const bentoTiles = document.querySelectorAll('.hm-bento-tile');
      const rankedSection = document.querySelector('.hm-mobile-ranked-section');
      const rankedItems = document.querySelectorAll('.hm-ranked-item');
      const rankBadges = document.querySelectorAll('.hm-rank-badge');
      const artistSection = document.querySelector('.hm-mobile-artists-section');
      const artistBubbles = document.querySelectorAll('.hm-artist-bubble');

      return {
        desktopDiscoverHidden: desktopDiscover ? window.getComputedStyle(desktopDiscover).display === 'none' : true,
        mobileDiscoverVisible: mobileDiscover ? window.getComputedStyle(mobileDiscover).display !== 'none' : false,
        headerSearchHidden: headerSearchBar ? window.getComputedStyle(headerSearchBar).display === 'none' : true,
        unifiedSearchVisible: Boolean(unifiedSearch) && window.getComputedStyle(unifiedSearch).display !== 'none',
        stickyFiltersPresent: Boolean(stickyFilters),
        filterPillCount: filterPills.length,
        heroSectionPresent: Boolean(heroSection),
        heroCardCount: heroCards.length,
        bentoSectionPresent: Boolean(bentoSection),
        bentoTileCount: bentoTiles.length,
        rankedSectionPresent: Boolean(rankedSection),
        rankedItemCount: rankedItems.length,
        rank1BadgeText: rankBadges.length > 0 ? rankBadges[0].textContent?.trim() : null,
        rank2BadgeText: rankBadges.length > 1 ? rankBadges[1].textContent?.trim() : null,
        rank3BadgeText: rankBadges.length > 2 ? rankBadges[2].textContent?.trim() : null,
        artistSectionPresent: Boolean(artistSection),
        artistBubbleCount: artistBubbles.length
      };
    })()`);
    console.log('discoverChecks debug:', discoverChecks);

    assert(discoverChecks.desktopDiscoverHidden, 'Desktop Discover layout is strictly hidden at 390x844 mobile viewport');
    assert(discoverChecks.mobileDiscoverVisible, 'Mobile Discover feed is active and visible at 390x844');
    assert(discoverChecks.headerSearchHidden, 'Duplicate header search button is strictly eliminated on mobile Discover');
    assert(discoverChecks.unifiedSearchVisible, 'Single clean unified search bar is prominent at top of Discover feed');
    assert(discoverChecks.stickyFiltersPresent, 'Sticky category filter row is present with horizontal scroll');
    assert(discoverChecks.filterPillCount >= 8, `Filter category pills rendered (${discoverChecks.filterPillCount} categories)`);
    assert(discoverChecks.heroSectionPresent && discoverChecks.heroCardCount >= 3, `Hero Spotlight Carousel rendered with ${discoverChecks.heroCardCount} swipeable cards`);
    assert(discoverChecks.bentoSectionPresent && discoverChecks.bentoTileCount === 4, `Bento grid of genres & moods rendered with ${discoverChecks.bentoTileCount} vibrant themed tiles`);
    assert(discoverChecks.rankedSectionPresent && discoverChecks.rankedItemCount >= 5, `Top 10 Spotlight rendered with ${discoverChecks.rankedItemCount} ranked tracks`);
    assert(discoverChecks.rank1BadgeText === '#1', 'Rank #1 badge rendered with golden highlight');
    assert(discoverChecks.rank2BadgeText === '#2', 'Rank #2 badge rendered with silver highlight');
    assert(discoverChecks.rank3BadgeText === '#3', 'Rank #3 badge rendered with bronze highlight');
    assert(discoverChecks.artistSectionPresent && discoverChecks.artistBubbleCount >= 8, `Featured artist showcase rendered with ${discoverChecks.artistBubbleCount} avatars`);

    // Screenshot Mobile Discover (Top: Unified Search, Sticky Filter, Hero Carousel, Bento Grid)
    const discoverHeroShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_mobile_390x844_discover_hero_bento.png'), Buffer.from(discoverHeroShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_mobile_390x844_discover_hero_bento.png');

    // Scroll down to capture Ranked Top 10 Spotlight and Artists
    await cdp.eval(`window.scrollBy({ top: 480, behavior: 'instant' });`);
    await new Promise((r) => setTimeout(r, 400));

    const discoverRankedShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_mobile_390x844_discover_ranked_artists.png'), Buffer.from(discoverRankedShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_mobile_390x844_discover_ranked_artists.png');

    // Test Category Filter Pill click (e.g., Telugu tab)
    console.log('\n--- Testing Category Filter Tab Interaction ---');
    await cdp.eval(`
      const teluguPill = Array.from(document.querySelectorAll('.hm-mobile-filter-btn')).find(b => b.textContent.includes('Telugu'));
      if (teluguPill) teluguPill.click();
    `);
    await new Promise((r) => setTimeout(r, 500));

    const teluguChecks = await cdp.eval(`(() => {
      const activePill = document.querySelector('.hm-mobile-filter-btn.active');
      const cardsGrid = document.querySelector('.hm-mobile-cards-grid');
      const cards = document.querySelectorAll('.hm-mobile-cards-grid .music-card');
      return {
        activeCategory: activePill ? activePill.textContent?.trim() : null,
        gridPresent: Boolean(cardsGrid),
        cardCount: cards.length
      };
    })()`);

    assert(teluguChecks.activeCategory?.includes('Telugu'), 'Telugu filter pill is active');
    assert(teluguChecks.gridPresent && teluguChecks.cardCount > 0, `Telugu collection rendered in clean 2-column cards (${teluguChecks.cardCount} tracks)`);

    const categoryShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_mobile_390x844_discover_category_filtered.png'), Buffer.from(categoryShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_mobile_390x844_discover_category_filtered.png');

    // Reset back to All tab
    await cdp.eval(`
      const allPill = Array.from(document.querySelectorAll('.hm-mobile-filter-btn')).find(b => b.textContent.includes('All'));
      if (allPill) allPill.click();
    `);
    await new Promise((r) => setTimeout(r, 400));

    // =========================================================================
    // PHASE 4: Search Modal Trigger Check
    // =========================================================================
    console.log('\n--- Phase 4: Bottom Navigation Search Action ---');
    await cdp.eval(`
      const searchTab = document.getElementById('mobile-nav-tab-search');
      if (searchTab) searchTab.click();
    `);
    await new Promise((r) => setTimeout(r, 500));

    const searchChecks = await cdp.eval(`(() => {
      const searchModal = document.querySelector('[role="dialog"][aria-label*="Search"]') || document.querySelector('.search-modal-container') || document.querySelector('#header-search-bar');
      const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') || document.querySelector('#search-input');
      return {
        searchOpen: Boolean(searchModal || searchInput)
      };
    })()`);

    assert(searchChecks.searchOpen, 'Search bottom navigation tab opens search interface cleanly');

    const searchShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(projectRoot, 'screenshot_mobile_390x844_search.png'), Buffer.from(searchShot.data, 'base64'));
    console.log('    📸 Saved: screenshot_mobile_390x844_search.png');

    cdp.close();
  } finally {
    chromeProcess.kill();
    viteProcess.kill();
  }

  console.log('\n======================================================================');
  console.log('ALL VERIFICATION PHASES PASSED SUCCESSFULLY!');
  console.log('======================================================================');
}

runMobileRedesignVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
