let playwrightModule = null;

async function getPlaywright() {
  if (playwrightModule) {
    return playwrightModule;
  }

  playwrightModule = await import("playwright");
  return playwrightModule;
}

const sessionState = {
  status: "idle",
  browser: null,
  context: null,
  page: null,
  cmsUrl:
    process.env.CMS_URL ||
    "https://tracuu.thithucdientu.gov.vn/search-manager/search-profiles",
  lastError: null,
  readyAt: null,
  openedAt: null
};

function publicState() {
  return {
    status: sessionState.status,
    cmsUrl: sessionState.cmsUrl,
    lastError: sessionState.lastError,
    readyAt: sessionState.readyAt,
    openedAt: sessionState.openedAt
  };
}

async function cleanupSession() {
  const browser = sessionState.browser;
  sessionState.browser = null;
  sessionState.context = null;
  sessionState.page = null;
  sessionState.readyAt = null;
  sessionState.openedAt = null;

  if (browser) {
    await browser.close().catch(() => {});
  }
}

export async function openCmsSession() {
  await cleanupSession();

  sessionState.status = "opening";
  sessionState.lastError = null;

  try {
    const { chromium } = await getPlaywright();
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    await page.goto(sessionState.cmsUrl);

    sessionState.browser = browser;
    sessionState.context = context;
    sessionState.page = page;
    sessionState.status = "awaiting_login";
    sessionState.openedAt = new Date().toISOString();

    return publicState();
  } catch (error) {
    await cleanupSession();
    sessionState.status = "error";
    sessionState.lastError = error.message;
    throw error;
  }
}

export function getCmsSessionState() {
  return publicState();
}

export function getCmsPageOrThrow() {
  if (!sessionState.page) {
    throw new Error("Chua mo phien CMS");
  }

  return sessionState.page;
}

export async function confirmCmsLogin() {
  if (!sessionState.page) {
    throw new Error("Chua mo phien CMS");
  }

  sessionState.status = "ready";
  sessionState.readyAt = new Date().toISOString();
  sessionState.lastError = null;
  return publicState();
}

export function isCmsReady() {
  return sessionState.status === "ready";
}

export async function closeCmsSession() {
  await cleanupSession();
  sessionState.status = "idle";
  sessionState.lastError = null;
  return publicState();
}
