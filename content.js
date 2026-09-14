(() => {
  const ROOT_ID = 'fullscreen-tab-manager-root';
  let uiController = null;

  function requestBackground(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!response?.ok) return reject(new Error(response?.error || 'The tab manager is unavailable.'));
        resolve(response);
      });
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'tabs-updated') {
      uiController?.renderTabs(message.tabs);
      uiController?.setDockOpen(message.dockOpen);
    }
  });

  async function mountSidebar() {
    if (document.getElementById(ROOT_ID)) return;

    const host = document.createElement('div');
    host.id = ROOT_ID;
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    document.documentElement.append(host);

    const shadow = host.attachShadow({ mode: 'open' });
    try {
      const [markup, styles] = await Promise.all([
        fetch(chrome.runtime.getURL('ui.html')).then((response) => response.text()),
        fetch(chrome.runtime.getURL('ui.css')).then((response) => response.text())
      ]);

      // ui.html is a fragment, keeping injected UI isolated from page markup.
      shadow.innerHTML = `<style>${styles}</style>${markup}`;
      uiController = window.FullscreenTabManager.mount(shadow, {
        getTabs: () => requestBackground({ type: 'get-tabs' }),
        activateTab: (tabId) => requestBackground({ type: 'activate-tab', tabId }),
        createTab: () => requestBackground({ type: 'create-tab' }),
        closeTab: (tabId) => requestBackground({ type: 'close-tab', tabId }),
        setDockOpen: (open) => requestBackground({ type: 'set-dock-open', open })
      });
      const response = await requestBackground({ type: 'get-tabs' });
      uiController.renderTabs(response.tabs);
      uiController.setDockOpen(response.dockOpen);
    } catch (error) {
      host.remove();
      console.error('Fullscreen Tab Manager could not mount.', error);
    }
  }

  window.FullscreenTabManager = { mountSidebar };
})();
