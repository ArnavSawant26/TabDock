(() => {
  function mount(shadow, bridge) {
    const $ = (id) => shadow.getElementById(id);
    const shell = shadow.querySelector('.ftm-shell');
    const edge = $('edgeZone'); const sidebar = $('sidebar'); const scroll = $('tabScroll');
    const track = $('sliderTrack'); const thumb = $('sliderThumb'); const add = $('addBtn');
    const dragHandle = $('dragHandle');

    let hideTimer; let draggingSlider = false; let isDraggingDock = false;
    let dragStartY = 0; let dragStartX = 0; let dragStartTop = 0; let dragStartLeft = 0;
    let pointerCoord = null; let lastWindowX = null; let lastWindowY = null;
    let retainOpenUntil = 0; let currentPosition = 'left';

    const reportError = (error) => {
      const msg = error?.message || String(error || '');
      if (msg.includes('Receiving end does not exist') || msg.includes('message port closed')) return;
      console.debug('Fullscreen Tab Manager:', msg);
    };

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

    const setPosition = (pos) => {
      currentPosition = (pos === 'right' || pos === 'bottom') ? pos : 'left';
      shell.dataset.position = currentPosition;
      requestAnimationFrame(() => {
        refreshSlider();
        const activeCoord = pointerCoord ?? (scroll.matches(':hover') ? (currentPosition === 'bottom' ? lastWindowX : lastWindowY) : null);
        if (activeCoord !== null) applyDockEffect(activeCoord);
      });
    };

    const refreshSlider = () => {
      if (currentPosition === 'bottom') {
        const tw = track.clientWidth, cw = scroll.scrollWidth, vw = scroll.clientWidth;
        if (cw <= vw + 1 || !tw) { track.style.opacity = '0'; return; }
        track.style.opacity = '1';
        const w = Math.max(24, (vw / cw) * tw), max = cw - vw;
        thumb.style.width = `${w}px`;
        thumb.style.left = `${(scroll.scrollLeft / max) * (tw - w)}px`;
        thumb.style.height = '';
        thumb.style.top = '';
      } else {
        const th = track.clientHeight, ch = scroll.scrollHeight, vh = scroll.clientHeight;
        if (ch <= vh + 1 || !th) { track.style.opacity = '0'; return; }
        track.style.opacity = '1';
        const h = Math.max(24, (vh / ch) * th), max = ch - vh;
        thumb.style.height = `${h}px`;
        thumb.style.top = `${(scroll.scrollTop / max) * (th - h)}px`;
        thumb.style.width = '';
        thumb.style.left = '';
      }
    };

    const resetDockEffect = () => scroll.querySelectorAll('.tab-item').forEach((item) => {
      item.style.transform = '';
      item.style.zIndex = '';
    });

    const applyDockEffect = (coord) => {
      if (coord === null) {
        resetDockEffect();
        return;
      }
      scroll.querySelectorAll('.tab-item').forEach((item) => {
        const r = item.getBoundingClientRect();
        let t = 0;
        if (currentPosition === 'bottom') {
          t = Math.max(0, 1 - Math.abs(coord - (r.left + r.width / 2)) / 60);
          item.style.transform = `translateY(${-6 * t}px) scale(${1 + .38 * t})`;
        } else if (currentPosition === 'right') {
          t = Math.max(0, 1 - Math.abs(coord - (r.top + r.height / 2)) / 60);
          item.style.transform = `translateX(${-6 * t}px) scale(${1 + .38 * t})`;
        } else {
          t = Math.max(0, 1 - Math.abs(coord - (r.top + r.height / 2)) / 60);
          item.style.transform = `translateX(${6 * t}px) scale(${1 + .38 * t})`;
        }
        item.style.zIndex = t > .5 ? '5' : '1';
      });
    };

    const initialFor = (title) => (title || 'T').trim().charAt(0).toUpperCase() || 'T';

    function createTabElement(tab) {
      const item = document.createElement('div');
      item.className = 'tab-item';
      item.dataset.id = String(tab.id);
      item._tab = tab;

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
        const markFavicon = () => {
          if (favicon.naturalWidth > 0) button.classList.add('has-favicon');
        };
        favicon.addEventListener('load', markFavicon);
        favicon.addEventListener('error', () => { favicon.remove(); button.classList.remove('has-favicon'); });
        if (favicon.complete) markFavicon();
        button.prepend(favicon);
      }

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const currentTab = item._tab || tab;
        if (currentTab.active) return;
        retainOpenUntil = Date.now() + 1000;
        bridge.activateTab(currentTab.id).catch(reportError);
      });

      const close = document.createElement('button');
      close.className = 'tab-close';
      close.type = 'button';
      close.title = `Close ${tab.title}`;
      close.setAttribute('aria-label', `Close ${tab.title}`);
      close.textContent = '×';
      close.addEventListener('click', (event) => {
        event.stopPropagation();
        const currentTab = item._tab || tab;
        bridge.closeTab(currentTab.id).catch(reportError);
      });

      item.append(button, close);
      return item;
    }

    function updateTabElement(item, tab) {
      item.dataset.id = String(tab.id);
      item._tab = tab;
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
            const markFavicon = () => {
              if (favicon.naturalWidth > 0) button.classList.add('has-favicon');
            };
            favicon.addEventListener('load', markFavicon);
            favicon.addEventListener('error', () => { favicon.remove(); button.classList.remove('has-favicon'); });
            button.prepend(favicon);
          }
          if (favicon.src !== tab.favIconUrl) {
            button.classList.remove('has-favicon');
            favicon.src = tab.favIconUrl;
          }
          if (favicon.complete && favicon.naturalWidth > 0) {
            button.classList.add('has-favicon');
          }
        } else if (favicon) {
          favicon.remove();
          button.classList.remove('has-favicon');
        }
      }
    }

    function renderTabs(tabs) {
      const sorted = [...tabs].sort((a, b) => a.index - b.index);
      const priorScrollTop = scroll.scrollTop;
      const priorScrollLeft = scroll.scrollLeft;
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

      scroll.scrollTop = priorScrollTop;
      scroll.scrollLeft = priorScrollLeft;
      requestAnimationFrame(() => {
        refreshSlider();
        const activeCoord = pointerCoord ?? (scroll.matches(':hover') ? (currentPosition === 'bottom' ? lastWindowX : lastWindowY) : null);
        if (activeCoord !== null) applyDockEffect(activeCoord);
      });
    }

    const setDockOpen = (open) => {
      const shouldBeOpen = Boolean(open);
      if (!shouldBeOpen && (document.hidden || isHoveringDock() || isDraggingDock)) {
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
      if (document.hidden || isDraggingDock) return;
      if (Date.now() < retainOpenUntil) return;
      if (isHoveringDock()) return;
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (document.hidden || isDraggingDock) return;
        if (isHoveringDock()) return;
        shell.classList.remove('sidebar-open');
        bridge.setDockOpen(false).catch(reportError);
      }, 150);
    };

    // --- Dock Repositioning Drag Logic ---
    const dropZones = Array.from(shadow.querySelectorAll('.drop-zone'));

    const startDockDrag = () => {
      isDraggingDock = true;
      shell.classList.add('dock-dragging');
      clearTimeout(hideTimer);

      let targetPos = currentPosition;

      const onPointerMove = (e) => {
        let minDistance = Infinity;
        let bestTarget = targetPos;

        dropZones.forEach((zone) => {
          const rect = zone.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
          if (dist < minDistance) {
            minDistance = dist;
            bestTarget = zone.dataset.target;
          }
        });

        dropZones.forEach((zone) => {
          zone.classList.toggle('active-drop', zone.dataset.target === bestTarget);
        });

        targetPos = bestTarget;
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        isDraggingDock = false;
        shell.classList.remove('dock-dragging');
        dropZones.forEach((z) => z.classList.remove('active-drop'));

        if (targetPos && targetPos !== currentPosition) {
          setPosition(targetPos);
          bridge.setPosition(targetPos).catch(reportError);
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    if (dragHandle) {
      dragHandle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startDockDrag();
      });
    }

    edge.addEventListener('mouseenter', openSidebar);
    edge.addEventListener('mouseleave', (event) => {
      if (!sidebar.contains(event.relatedTarget) && !isHoveringDock()) scheduleClose();
    });
    sidebar.addEventListener('mouseenter', openSidebar);
    sidebar.addEventListener('mouseleave', () => {
      if (!isHoveringDock()) scheduleClose();
    });

    window.addEventListener('mousemove', (event) => {
      lastWindowX = event.clientX;
      lastWindowY = event.clientY;
      if (scroll.matches(':hover')) {
        pointerCoord = currentPosition === 'bottom' ? event.clientX : event.clientY;
        applyDockEffect(pointerCoord);
      }
    }, { passive: true });

    add.addEventListener('click', () => {
      retainOpenUntil = Date.now() + 1000;
      bridge.createTab().catch(reportError);
    });

    scroll.addEventListener('wheel', (event) => {
      if (currentPosition === 'bottom') {
        event.preventDefault();
        const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        scroll.scrollLeft += delta;
        refreshSlider();
        if (pointerCoord !== null) applyDockEffect(pointerCoord);
      } else {
        if (scroll.scrollHeight > scroll.clientHeight) {
          event.preventDefault();
          scroll.scrollTop += event.deltaY;
          refreshSlider();
          if (pointerCoord !== null) applyDockEffect(pointerCoord);
        }
      }
    }, { passive: false });

    scroll.addEventListener('mousemove', (event) => {
      pointerCoord = currentPosition === 'bottom' ? event.clientX : event.clientY;
      applyDockEffect(pointerCoord);
    });
    scroll.addEventListener('mouseleave', () => {
      pointerCoord = null;
      resetDockEffect();
    });
    scroll.addEventListener('scroll', () => {
      refreshSlider();
      if (pointerCoord === null) resetDockEffect();
      else applyDockEffect(pointerCoord);
    });

    new ResizeObserver(refreshSlider).observe(scroll);
    window.addEventListener('resize', refreshSlider);

    thumb.addEventListener('pointerdown', (event) => {
      draggingSlider = true;
      thumb.classList.add('dragging');
      dragStartY = event.clientY;
      dragStartX = event.clientX;
      dragStartTop = scroll.scrollTop;
      dragStartLeft = scroll.scrollLeft;
      thumb.setPointerCapture(event.pointerId);
    });
    thumb.addEventListener('pointermove', (event) => {
      if (!draggingSlider) return;
      if (currentPosition === 'bottom') {
        const w = Math.max(24, (scroll.clientWidth / scroll.scrollWidth) * track.clientWidth);
        const denominator = track.clientWidth - w;
        if (denominator > 0) scroll.scrollLeft = dragStartLeft + ((event.clientX - dragStartX) / denominator) * (scroll.scrollWidth - scroll.clientWidth);
      } else {
        const h = Math.max(24, (scroll.clientHeight / scroll.scrollHeight) * track.clientHeight);
        const denominator = track.clientHeight - h;
        if (denominator > 0) scroll.scrollTop = dragStartTop + ((event.clientY - dragStartY) / denominator) * (scroll.scrollHeight - scroll.clientHeight);
      }
    });
    ['pointerup', 'pointercancel'].forEach((eventName) => thumb.addEventListener(eventName, () => {
      draggingSlider = false;
      thumb.classList.remove('dragging');
    }));
    track.addEventListener('pointerdown', (event) => {
      if (event.target === thumb) return;
      if (currentPosition === 'bottom') {
        if (!track.clientWidth) return;
        scroll.scrollLeft = ((event.clientX - track.getBoundingClientRect().left) / track.clientWidth) * (scroll.scrollWidth - scroll.clientWidth);
      } else {
        if (!track.clientHeight) return;
        scroll.scrollTop = ((event.clientY - track.getBoundingClientRect().top) / track.clientHeight) * (scroll.scrollHeight - scroll.clientHeight);
      }
    });

    requestAnimationFrame(refreshSlider);
    return { renderTabs, setDockOpen, setPosition };
  }

  window.FullscreenTabManager.mount = mount;
  window.FullscreenTabManager.mountSidebar();
})();
