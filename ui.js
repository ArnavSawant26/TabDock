(() => {
  function mount(shadow, bridge) {
    const $ = (id) => shadow.getElementById(id);
    const shell = shadow.querySelector('.ftm-shell');
    const edge = $('edgeZone'); const sidebar = $('sidebar'); const scroll = $('tabScroll');
    const track = $('sliderTrack'); const thumb = $('sliderThumb'); const add = $('addBtn');
    let hideTimer; let dragging = false; let dragStartY = 0; let dragStartTop = 0;
    let pointerY = null; let lastWindowY = null; let retainOpenUntil = 0;

    const reportError = (error) => console.warn('Fullscreen Tab Manager:', error.message || error);

    const isHoveringDock = () => {
      try {
        return Boolean(
          shell.matches(':hover') ||
          sidebar.matches(':hover') ||
          edge.matches(':hover')
        );
      } catch (e) {
        return false;
      }
    };

    const refreshSlider = () => {
      const th = track.clientHeight, ch = scroll.scrollHeight, vh = scroll.clientHeight;
      if (ch <= vh + 1 || !th) { track.style.opacity = '0'; return; }
      track.style.opacity = '1';
      const h = Math.max(24, vh / ch * th), max = ch - vh;
      thumb.style.height = `${h}px`;
      thumb.style.top = `${scroll.scrollTop / max * (th - h)}px`;
    };

    const resetDockEffect = () => scroll.querySelectorAll('.tab').forEach((tab) => {
      tab.style.transform = '';
      tab.style.zIndex = '';
    });

    const applyDockEffect = (clientY) => {
      if (clientY === null) {
        resetDockEffect();
        return;
      }
      scroll.querySelectorAll('.tab').forEach((tab) => {
        const r = tab.getBoundingClientRect();
        const t = Math.max(0, 1 - Math.abs(clientY - (r.top + r.height / 2)) / 60);
        tab.style.transform = `translateX(${6 * t}px) scale(${1 + .38 * t})`;
        tab.style.zIndex = t > .5 ? '5' : '1';
      });
    };

    const initialFor = (title) => (title || 'T').trim().charAt(0).toUpperCase() || 'T';

    function createTabElement(tab) {
      const item = document.createElement('div');
      item.className = 'tab-item';
      item.dataset.id = String(tab.id);

      const button = document.createElement('button');
      button.className = `tab${tab.active ? ' active' : ''}`;
      button.type = 'button';
      button.dataset.id = String(tab.id);
      button.title = tab.title;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-label', tab.title);
      button.setAttribute('aria-selected', String(tab.active));
      button.innerHTML = `<span class="tab-fallback" aria-hidden="true">${initialFor(tab.title)}</span><span class="tab-dot"></span>`;

      if (tab.favIconUrl) {
        const favicon = document.createElement('img');
        favicon.className = 'tab-favicon';
        favicon.alt = '';
        favicon.src = tab.favIconUrl;
        favicon.addEventListener('load', () => button.classList.add('has-favicon'));
        favicon.addEventListener('error', () => { favicon.remove(); button.classList.remove('has-favicon'); });
        button.prepend(favicon);
      }

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (tab.active) return;
        retainOpenUntil = Date.now() + 1000;
        bridge.activateTab(tab.id).catch(reportError);
      });

      const close = document.createElement('button');
      close.className = 'tab-close';
      close.type = 'button';
      close.title = `Close ${tab.title}`;
      close.setAttribute('aria-label', `Close ${tab.title}`);
      close.textContent = '×';
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        bridge.closeTab(tab.id).catch(reportError);
      });

      item.append(button, close);
      return item;
    }

    function updateTabElement(item, tab) {
      item.dataset.id = String(tab.id);
      const button = item.querySelector('.tab');
      if (button) {
        button.className = `tab${tab.active ? ' active' : ''}`;
        button.title = tab.title;
        button.setAttribute('aria-label', tab.title);
        button.setAttribute('aria-selected', String(tab.active));
        const fallback = button.querySelector('.tab-fallback');
        if (fallback) fallback.textContent = initialFor(tab.title);

        let favicon = button.querySelector('.tab-favicon');
        if (tab.favIconUrl) {
          if (!favicon) {
            favicon = document.createElement('img');
            favicon.className = 'tab-favicon';
            favicon.alt = '';
            favicon.addEventListener('load', () => button.classList.add('has-favicon'));
            favicon.addEventListener('error', () => { favicon.remove(); button.classList.remove('has-favicon'); });
            button.prepend(favicon);
          }
          if (favicon.src !== tab.favIconUrl) {
            favicon.src = tab.favIconUrl;
          }
        } else if (favicon) {
          favicon.remove();
          button.classList.remove('has-favicon');
        }
      }
    }

    function renderTabs(tabs) {
      const sorted = [...tabs].sort((a, b) => a.index - b.index);
      const priorScroll = scroll.scrollTop;
      const existingMap = new Map();
      Array.from(scroll.children).forEach((child) => {
        if (child.dataset.id) existingMap.set(child.dataset.id, child);
      });

      const newChildren = sorted.map((tab) => {
        const idStr = String(tab.id);
        if (existingMap.has(idStr)) {
          const item = existingMap.get(idStr);
          existingMap.delete(idStr);
          updateTabElement(item, tab);
          return item;
        }
        return createTabElement(tab);
      });

      existingMap.forEach((child) => child.remove());

      newChildren.forEach((child, idx) => {
        if (scroll.children[idx] !== child) {
          scroll.insertBefore(child, scroll.children[idx] || null);
        }
      });

      scroll.scrollTop = priorScroll;
      requestAnimationFrame(() => {
        refreshSlider();
        const activeY = pointerY ?? (scroll.matches(':hover') ? lastWindowY : null);
        if (activeY !== null) applyDockEffect(activeY);
      });
    }

    const setDockOpen = (open) => {
      const shouldBeOpen = Boolean(open);
      if (!shouldBeOpen && (document.hidden || isHoveringDock())) {
        return;
      }
      shell.classList.toggle('sidebar-open', shouldBeOpen);
    };

    const openSidebar = () => {
      clearTimeout(hideTimer);
      if (!shell.classList.contains('sidebar-open')) {
        shell.classList.add('sidebar-open');
        bridge.setDockOpen(true).catch(reportError);
      }
    };

    const scheduleClose = () => {
      if (document.hidden) return;
      if (Date.now() < retainOpenUntil) return;
      if (isHoveringDock()) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (document.hidden) return;
        if (isHoveringDock()) return;
        shell.classList.remove('sidebar-open');
        bridge.setDockOpen(false).catch(reportError);
      }, 150);
    };

    edge.addEventListener('mouseenter', openSidebar);
    edge.addEventListener('mouseleave', (event) => {
      if (!sidebar.contains(event.relatedTarget) && !isHoveringDock()) scheduleClose();
    });
    sidebar.addEventListener('mouseenter', openSidebar);
    sidebar.addEventListener('mouseleave', () => {
      if (!isHoveringDock()) scheduleClose();
    });

    window.addEventListener('mousemove', (event) => {
      lastWindowY = event.clientY;
      if (scroll.matches(':hover')) {
        pointerY = event.clientY;
        applyDockEffect(pointerY);
      }
    }, { passive: true });

    add.addEventListener('click', () => {
      retainOpenUntil = Date.now() + 1000;
      bridge.createTab().catch(reportError);
    });

    scroll.addEventListener('mousemove', (event) => {
      pointerY = event.clientY;
      applyDockEffect(pointerY);
    });
    scroll.addEventListener('mouseleave', () => {
      pointerY = null;
      resetDockEffect();
    });
    scroll.addEventListener('scroll', () => {
      refreshSlider();
      if (pointerY === null) resetDockEffect();
      else applyDockEffect(pointerY);
    });

    new ResizeObserver(refreshSlider).observe(scroll);
    window.addEventListener('resize', refreshSlider);

    thumb.addEventListener('pointerdown', (event) => {
      dragging = true;
      thumb.classList.add('dragging');
      dragStartY = event.clientY;
      dragStartTop = scroll.scrollTop;
      thumb.setPointerCapture(event.pointerId);
    });
    thumb.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const h = Math.max(24, scroll.clientHeight / scroll.scrollHeight * track.clientHeight);
      const denominator = track.clientHeight - h;
      if (denominator > 0) scroll.scrollTop = dragStartTop + (event.clientY - dragStartY) / denominator * (scroll.scrollHeight - scroll.clientHeight);
    });
    ['pointerup', 'pointercancel'].forEach((eventName) => thumb.addEventListener(eventName, () => {
      dragging = false;
      thumb.classList.remove('dragging');
    }));
    track.addEventListener('pointerdown', (event) => {
      if (event.target === thumb || !track.clientHeight) return;
      scroll.scrollTop = (event.clientY - track.getBoundingClientRect().top) / track.clientHeight * (scroll.scrollHeight - scroll.clientHeight);
    });

    requestAnimationFrame(refreshSlider);
    return { renderTabs, setDockOpen };
  }

  window.FullscreenTabManager.mount = mount;
  window.FullscreenTabManager.mountSidebar();
})();
