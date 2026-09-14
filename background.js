// The service worker is the only component that uses chrome.tabs.
const scheduledWindows = new Map();
const dockStateKey = (windowId) => `dock-open-${windowId}`;
const dockPosKey = (windowId) => `dock-pos-${windowId}`;

async function getDockOpen(windowId) {
  const state = await chrome.storage.session.get(dockStateKey(windowId));
  return Boolean(state[dockStateKey(windowId)]);
}

function setDockOpen(windowId, open) {
  return chrome.storage.session.set({ [dockStateKey(windowId)]: open });
}

async function getDockPos(windowId) {
  const state = await chrome.storage.session.get(dockPosKey(windowId));
  return state[dockPosKey(windowId)] || 'left';
}

function setDockPos(windowId, pos) {
  return chrome.storage.session.set({ [dockPosKey(windowId)]: pos });
}

function publicTab(tab) {
  return {
    id: tab.id,
    index: tab.index,
    title: tab.title || 'Untitled tab',
    favIconUrl: tab.favIconUrl || '',
    active: Boolean(tab.active)
  };
}

async function getWindowTabs(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  return tabs.map(publicTab);
}

async function sendWindowUpdate(windowId) {
  if (windowId == null || windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tabs, dockOpen, dockPosition] = await Promise.all([
      getWindowTabs(windowId),
      getDockOpen(windowId),
      getDockPos(windowId)
    ]);
    await Promise.all(tabs.map((tab) =>
      chrome.tabs.sendMessage(tab.id, { type: 'tabs-updated', tabs, dockOpen, dockPosition }).catch(() => undefined)
    ));
  } catch (error) {
    // A window can close between a tab event and its snapshot.
    console.debug('Unable to synchronize tab dock.', error);
  }
}

function scheduleWindowUpdate(windowId) {
  if (windowId == null || windowId === chrome.windows.WINDOW_ID_NONE || scheduledWindows.has(windowId)) return;
  scheduledWindows.set(windowId, setTimeout(() => {
    scheduledWindows.delete(windowId);
    sendWindowUpdate(windowId);
  }, 50));
}

async function tabInSenderWindow(tabId, sender) {
  if (!sender?.tab || !Number.isInteger(tabId)) throw new Error('Invalid tab request.');
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || tab.windowId !== sender.tab.windowId) throw new Error('That tab is not available.');
  return tab;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type || !sender.tab) return;

  (async () => {
    const windowId = sender.tab.windowId;
    if (message.type === 'get-tabs') {
      const [tabs, dockOpen, dockPosition] = await Promise.all([
        getWindowTabs(windowId),
        getDockOpen(windowId),
        getDockPos(windowId)
      ]);
      return { tabs, dockOpen, dockPosition };
    }
    if (message.type === 'set-dock-open') {
      await setDockOpen(windowId, Boolean(message.open));
      return {};
    }
    if (message.type === 'set-dock-pos') {
      await setDockPos(windowId, message.position || 'left');
      scheduleWindowUpdate(windowId);
      return {};
    }
    if (message.type === 'activate-tab') {
      const tab = await tabInSenderWindow(message.tabId, sender).catch(() => null);
      if (tab) {
        await setDockOpen(windowId, true);
        await chrome.tabs.update(message.tabId, { active: true }).catch(() => undefined);
      } else {
        scheduleWindowUpdate(windowId);
      }
      return {};
    }
    if (message.type === 'create-tab') {
      await chrome.tabs.create({ windowId, active: true }).catch(() => undefined);
      return {};
    }
    if (message.type === 'close-tab') {
      const tab = await tabInSenderWindow(message.tabId, sender).catch(() => null);
      if (tab) {
        await chrome.tabs.remove(message.tabId).catch(() => undefined);
      }
      scheduleWindowUpdate(windowId);
      return {};
    }
    throw new Error('Unknown tab-manager action.');
  })().then(
    (result) => sendResponse({ ok: true, ...result }),
    (error) => sendResponse({ ok: false, error: error.message || 'Chrome could not complete that action.' })
  );
  return true;
});

chrome.tabs.onCreated.addListener((tab) => scheduleWindowUpdate(tab.windowId));
chrome.tabs.onRemoved.addListener((_tabId, info) => scheduleWindowUpdate(info.windowId));
chrome.tabs.onActivated.addListener((info) => scheduleWindowUpdate(info.windowId));
chrome.tabs.onUpdated.addListener((_tabId, _changeInfo, tab) => scheduleWindowUpdate(tab.windowId));
chrome.tabs.onMoved.addListener((_tabId, info) => scheduleWindowUpdate(info.windowId));
chrome.tabs.onAttached.addListener((_tabId, info) => scheduleWindowUpdate(info.newWindowId));
chrome.tabs.onDetached.addListener((_tabId, info) => scheduleWindowUpdate(info.oldWindowId));
chrome.tabs.onReplaced.addListener((addedTabId) => chrome.tabs.get(addedTabId).then((tab) => scheduleWindowUpdate(tab.windowId)).catch(() => undefined));
chrome.windows.onFocusChanged.addListener((windowId) => scheduleWindowUpdate(windowId));
