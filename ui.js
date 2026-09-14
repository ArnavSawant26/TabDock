(() => {
  function mount(shadow, bridge) {
    const $ = (id) => shadow.getElementById(id);
    const shell = shadow.querySelector('.ftm-shell');
    const edge = $('edgeZone'); const sidebar = $('sidebar'); const scroll = $('tabScroll');
    const track = $('sliderTrack'); const thumb = $('sliderThumb'); const add = $('addBtn');
    let hideTimer; let dragging = false; let dragStartY = 0; let dragStartTop = 0; let pointerY = null; let retainOpenUntil = 0;
    const reportError = (error) => console.warn('Fullscreen Tab Manager:', error.message || error);
    const refreshSlider = () => { const th = track.clientHeight, ch = scroll.scrollHeight, vh = scroll.clientHeight; if (ch <= vh + 1 || !th) { track.style.opacity = '0'; return; } track.style.opacity = '1'; const h = Math.max(24, vh / ch * th), max = ch - vh; thumb.style.height = `${h}px`; thumb.style.top = `${scroll.scrollTop / max * (th - h)}px`; };
    const resetDockEffect = () => scroll.querySelectorAll('.tab').forEach((tab) => { tab.style.transform = ''; tab.style.zIndex = ''; });
    const applyDockEffect = (clientY) => scroll.querySelectorAll('.tab').forEach((tab) => { const r = tab.getBoundingClientRect(), t = Math.max(0, 1 - Math.abs(clientY - (r.top + r.height / 2)) / 60); tab.style.transform = `translateX(${6 * t}px) scale(${1 + .38 * t})`; tab.style.zIndex = t > .5 ? '5' : '1'; });
    const initialFor = (title) => (title || 'T').trim().charAt(0).toUpperCase() || 'T';

    function createTabElement(tab) {
      const item = document.createElement('div'); item.className = 'tab-item'; item.dataset.id = String(tab.id);
      const button = document.createElement('button'); button.className = `tab${tab.active ? ' active' : ''}`; button.type = 'button'; button.dataset.id = String(tab.id); button.title = tab.title; button.setAttribute('role', 'tab'); button.setAttribute('aria-label', tab.title); button.setAttribute('aria-selected', String(tab.active)); button.innerHTML = `<span class="tab-fallback" aria-hidden="true">${initialFor(tab.title)}</span><span class="tab-dot"></span>`;
      if (tab.favIconUrl) { const favicon = document.createElement('img'); favicon.className = 'tab-favicon'; favicon.alt = ''; favicon.src = tab.favIconUrl; favicon.addEventListener('load', () => button.classList.add('has-favicon')); favicon.addEventListener('error', () => favicon.remove()); button.prepend(favicon); }
      button.addEventListener('click', () => {
        if (tab.active) return;
        retainOpenUntil = Date.now() + 600;
        bridge.activateTab(tab.id).catch(reportError);
      });
      const close = document.createElement('button'); close.className = 'tab-close'; close.type = 'button'; close.title = `Close ${tab.title}`; close.setAttribute('aria-label', `Close ${tab.title}`); close.textContent = '×'; close.addEventListener('click', (event) => { event.stopPropagation(); bridge.closeTab(tab.id).catch(reportError); });
      item.append(button, close); return item;
    }

    function renderTabs(tabs) { const priorScroll = scroll.scrollTop; scroll.replaceChildren(...tabs.sort((a, b) => a.index - b.index).map(createTabElement)); scroll.scrollTop = priorScroll; requestAnimationFrame(() => { refreshSlider(); if (pointerY !== null) applyDockEffect(pointerY); }); }
    const setDockOpen = (open) => shell.classList.toggle('sidebar-open', Boolean(open));
    const openSidebar = () => { clearTimeout(hideTimer); if (!shell.classList.contains('sidebar-open')) { setDockOpen(true); bridge.setDockOpen(true).catch(reportError); } };
    const scheduleClose = () => { if (Date.now() < retainOpenUntil) return; clearTimeout(hideTimer); hideTimer = setTimeout(() => { setDockOpen(false); bridge.setDockOpen(false).catch(reportError); }, 120); };
    edge.addEventListener('mouseenter', openSidebar); edge.addEventListener('mouseleave', (event) => { if (!sidebar.contains(event.relatedTarget)) scheduleClose(); }); sidebar.addEventListener('mouseenter', openSidebar); sidebar.addEventListener('mouseleave', scheduleClose);
    add.addEventListener('click', () => { retainOpenUntil = Date.now() + 600; bridge.createTab().catch(reportError); });
    scroll.addEventListener('mousemove', (event) => { pointerY = event.clientY; applyDockEffect(pointerY); }); scroll.addEventListener('mouseleave', () => { pointerY = null; resetDockEffect(); }); scroll.addEventListener('scroll', () => { refreshSlider(); if (pointerY === null) resetDockEffect(); else applyDockEffect(pointerY); }); new ResizeObserver(refreshSlider).observe(scroll); window.addEventListener('resize', refreshSlider);
    thumb.addEventListener('pointerdown', (event) => { dragging = true; thumb.classList.add('dragging'); dragStartY = event.clientY; dragStartTop = scroll.scrollTop; thumb.setPointerCapture(event.pointerId); }); thumb.addEventListener('pointermove', (event) => { if (!dragging) return; const h = Math.max(24, scroll.clientHeight / scroll.scrollHeight * track.clientHeight), denominator = track.clientHeight - h; if (denominator > 0) scroll.scrollTop = dragStartTop + (event.clientY - dragStartY) / denominator * (scroll.scrollHeight - scroll.clientHeight); }); ['pointerup', 'pointercancel'].forEach((eventName) => thumb.addEventListener(eventName, () => { dragging = false; thumb.classList.remove('dragging'); })); track.addEventListener('pointerdown', (event) => { if (event.target === thumb || !track.clientHeight) return; scroll.scrollTop = (event.clientY - track.getBoundingClientRect().top) / track.clientHeight * (scroll.scrollHeight - scroll.clientHeight); }); requestAnimationFrame(refreshSlider);
    return { renderTabs, setDockOpen };
  }
  window.FullscreenTabManager.mount = mount;
  window.FullscreenTabManager.mountSidebar();
})();
