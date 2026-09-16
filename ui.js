(() => {
  function mount(shadow, bridge) {
    const $ = (id) => shadow.getElementById(id);

    const shell = shadow.querySelector('.ftm-shell');

    const edge = $('edgeZone');
    const sidebar = $('sidebar');
    const scroll = $('tabScroll');

    const track = $('sliderTrack');
    const thumb = $('sliderThumb');

    const add = $('addBtn');
    const dragHandle = $('dragHandle');

    let hideTimer;
    let draggingSlider = false;
    let isDraggingDock = false;

    let dragStartY = 0;
    let dragStartX = 0;

    let dragStartTop = 0;
    let dragStartLeft = 0;

    let pointerCoord = null;

    let lastWindowX = null;
    let lastWindowY = null;

    let retainOpenUntil = 0;

    let currentPosition = 'left';


    /* =====================================================
       ERROR HANDLING
       ===================================================== */

    const reportError = (error) => {
      const msg = error?.message || String(error || '');

      if (
        msg.includes('Receiving end does not exist') ||
        msg.includes('message port closed')
      ) {
        return;
      }

      console.debug(
        'Fullscreen Tab Manager:',
        msg
      );
    };


    /* =====================================================
       DOCK HOVER
       ===================================================== */

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


    /* =====================================================
       POSITION
       ===================================================== */

    const setPosition = (pos) => {
      currentPosition =
        (pos === 'right' || pos === 'bottom')
          ? pos
          : 'left';

      shell.dataset.position = currentPosition;

      requestAnimationFrame(() => {
        fitBottomDockToTabs();

        refreshSlider();

        const activeCoord =
          pointerCoord ??
          (
            scroll.matches(':hover')
              ? (
                  currentPosition === 'bottom'
                    ? lastWindowX
                    : lastWindowY
                )
              : null
          );

        if (activeCoord !== null) {
          applyDockEffect(activeCoord);
        }
      });
    };


    /* =====================================================
       SLIDER
       ===================================================== */

    const refreshSlider = () => {
      if (currentPosition === 'bottom') {
        const tw = track.clientWidth;
        const cw = scroll.scrollWidth;
        const vw = scroll.clientWidth;

        if (
          cw <= vw + 1 ||
          !tw
        ) {
          track.style.opacity = '0';
          return;
        }

        track.style.opacity = '1';

        const w = Math.max(
          24,
          (vw / cw) * tw
        );

        const max = cw - vw;

        thumb.style.width = `${w}px`;

        thumb.style.left =
          `${(scroll.scrollLeft / max) * (tw - w)}px`;

        thumb.style.height = '';
        thumb.style.top = '';

      } else {
        const th = track.clientHeight;
        const ch = scroll.scrollHeight;
        const vh = scroll.clientHeight;

        if (
          ch <= vh + 1 ||
          !th
        ) {
          track.style.opacity = '0';
          return;
        }

        track.style.opacity = '1';

        const h = Math.max(
          24,
          (vh / ch) * th
        );

        const max = ch - vh;

        thumb.style.height = `${h}px`;

        thumb.style.top =
          `${(scroll.scrollTop / max) * (th - h)}px`;

        thumb.style.width = '';
        thumb.style.left = '';
      }
    };


    /* =====================================================
       BOTTOM DOCK TAB FITTING
       ===================================================== */

    const fitBottomDockToTabs = () => {
      if (currentPosition !== 'bottom') {
        scroll.style.width = '';
        return;
      }

      const tabs =
        scroll.querySelectorAll('.tab-item');

      if (!tabs.length) {
        scroll.style.width = '';
        return;
      }

      const tabSize = 44;
      const gap = 10;

      /*
       * Left + right padding of the tab-scroll area.
       */
      const horizontalPadding = 28;

      /*
       * Maximum available width.
       *
       * Some space is intentionally reserved for
       * the drag handle, divider and add button.
       */
      const maxAvailable =
        Math.max(
          tabSize,
          Math.min(
            window.innerWidth - 100,
            760
          )
        );

      /*
       * Every tab slot is:
       *
       * 44px tab
       * +
       * 10px gap
       * =
       * 54px
       */
      const maxVisibleTabs =
        Math.max(
          1,
          Math.floor(
            (
              maxAvailable -
              horizontalPadding +
              gap
            ) /
            (tabSize + gap)
          )
        );

      /*
       * Never create space for a partial tab.
       */
      const visibleTabs =
        Math.min(
          tabs.length,
          maxVisibleTabs
        );

      const width =
        visibleTabs * tabSize +
        Math.max(
          0,
          visibleTabs - 1
        ) * gap +
        horizontalPadding;

      scroll.style.width =
        `${width}px`;
    };


    /* =====================================================
       MAGNIFICATION RESET
       ===================================================== */

    const resetDockEffect = () => {
      scroll
        .querySelectorAll('.tab-item')
        .forEach((item) => {
          item.style.transform = '';
          item.style.zIndex = '';
        });
    };


    /* =====================================================
       MAGNIFICATION
       ===================================================== */

    const applyDockEffect = (coord) => {
      if (coord === null) {
        resetDockEffect();
        return;
      }

      scroll
        .querySelectorAll('.tab-item')
        .forEach((item) => {
          const r =
            item.getBoundingClientRect();

          let t = 0;

          if (currentPosition === 'bottom') {
            t =
              Math.max(
                0,
                1 -
                Math.abs(
                  coord -
                  (r.left + r.width / 2)
                ) /
                60
              );

            item.style.transform =
              `translateY(${-6 * t}px) scale(${1 + .38 * t})`;

          } else if (currentPosition === 'right') {
            t =
              Math.max(
                0,
                1 -
                Math.abs(
                  coord -
                  (r.top + r.height / 2)
                ) /
                60
              );

            item.style.transform =
              `translateX(${-6 * t}px) scale(${1 + .38 * t})`;

          } else {
            t =
              Math.max(
                0,
                1 -
                Math.abs(
                  coord -
                  (r.top + r.height / 2)
                ) /
                60
              );

            item.style.transform =
              `translateX(${6 * t}px) scale(${1 + .38 * t})`;
          }

          item.style.zIndex =
            t > .5
              ? '5'
              : '1';
        });
    };


    /* =====================================================
       TAB FALLBACK
       ===================================================== */

    const initialFor = (title) =>
      (title || 'T')
        .trim()
        .charAt(0)
        .toUpperCase() || 'T';


    /* =====================================================
       CREATE TAB
       ===================================================== */

    function createTabElement(tab) {
      const item =
        document.createElement('div');

      item.className = 'tab-item';

      item.dataset.id =
        String(tab.id);

      item._tab = tab;


      /* Tab button */

      const button =
        document.createElement('button');

      button.className =
        `tab${tab.active ? ' active' : ''}`;

      button.type = 'button';

      button.dataset.id =
        String(tab.id);

      button.title =
        tab.title;

      button.setAttribute(
        'role',
        'tab'
      );

      button.setAttribute(
        'aria-label',
        tab.title
      );

      button.setAttribute(
        'aria-selected',
        String(tab.active)
      );

      button.innerHTML =
        `<span class="tab-fallback" aria-hidden="true">${initialFor(tab.title)}</span><span class="tab-dot"></span>`;


      /* Favicon */

      if (tab.favIconUrl) {
        const favicon =
          document.createElement('img');

        favicon.className =
          'tab-favicon';

        favicon.alt = '';

        favicon.src =
          tab.favIconUrl;

        const markFavicon = () => {
          if (favicon.naturalWidth > 0) {
            button.classList.add(
              'has-favicon'
            );
          }
        };

        favicon.addEventListener(
          'load',
          markFavicon
        );

        favicon.addEventListener(
          'error',
          () => {
            favicon.remove();

            button.classList.remove(
              'has-favicon'
            );
          }
        );

        if (favicon.complete) {
          markFavicon();
        }

        button.prepend(favicon);
      }


      /* Activate tab */

      button.addEventListener(
        'click',
        (e) => {
          e.stopPropagation();

          const currentTab =
            item._tab || tab;

          if (currentTab.active) {
            return;
          }

          retainOpenUntil =
            Date.now() + 1000;

          bridge
            .activateTab(currentTab.id)
            .catch(reportError);
        }
      );


      /* Close button */

      const close =
        document.createElement('button');

      close.className =
        'tab-close';

      close.type = 'button';

      close.title =
        `Close ${tab.title}`;

      close.setAttribute(
        'aria-label',
        `Close ${tab.title}`
      );

      close.textContent = '×';

      close.addEventListener(
        'click',
        (event) => {
          event.stopPropagation();

          const currentTab =
            item._tab || tab;

          bridge
            .closeTab(currentTab.id)
            .catch(reportError);
        }
      );


      item.append(
        button,
        close
      );

      return item;
    }


    /* =====================================================
       UPDATE EXISTING TAB
       ===================================================== */

    function updateTabElement(item, tab) {
      item.dataset.id =
        String(tab.id);

      item._tab = tab;

      const button =
        item.querySelector('.tab');

      if (!button) {
        return;
      }

      button.className =
        `tab${tab.active ? ' active' : ''}`;

      button.title =
        tab.title;

      button.setAttribute(
        'aria-label',
        tab.title
      );

      button.setAttribute(
        'aria-selected',
        String(tab.active)
      );


      const fallback =
        button.querySelector(
          '.tab-fallback'
        );

      if (fallback) {
        fallback.textContent =
          initialFor(tab.title);
      }


      let favicon =
        button.querySelector(
          '.tab-favicon'
        );


      if (tab.favIconUrl) {
        if (!favicon) {
          favicon =
            document.createElement('img');

          favicon.className =
            'tab-favicon';

          favicon.alt = '';

          const markFavicon = () => {
            if (
              favicon.naturalWidth > 0
            ) {
              button.classList.add(
                'has-favicon'
              );
            }
          };

          favicon.addEventListener(
            'load',
            markFavicon
          );

          favicon.addEventListener(
            'error',
            () => {
              favicon.remove();

              button.classList.remove(
                'has-favicon'
              );
            }
          );

          button.prepend(favicon);
        }


        if (
          favicon.src !==
          tab.favIconUrl
        ) {
          button.classList.remove(
            'has-favicon'
          );

          favicon.src =
            tab.favIconUrl;
        }


        if (
          favicon.complete &&
          favicon.naturalWidth > 0
        ) {
          button.classList.add(
            'has-favicon'
          );
        }

      } else if (favicon) {
        favicon.remove();

        button.classList.remove(
          'has-favicon'
        );
      }
    }


    /* =====================================================
       RENDER TABS
       ===================================================== */

    function renderTabs(tabs) {
      const sorted =
        [...tabs].sort(
          (a, b) =>
            a.index - b.index
        );


      const priorScrollTop =
        scroll.scrollTop;

      const priorScrollLeft =
        scroll.scrollLeft;


      const existingMap =
        new Map();


      Array
        .from(scroll.children)
        .forEach((child) => {
          if (child.dataset.id) {
            existingMap.set(
              child.dataset.id,
              child
            );
          }
        });


      const newChildren =
        sorted.map((tab) => {
          const idStr =
            String(tab.id);

          if (
            existingMap.has(idStr)
          ) {
            const item =
              existingMap.get(idStr);

            existingMap.delete(idStr);

            updateTabElement(
              item,
              tab
            );

            return item;
          }

          return createTabElement(
            tab
          );
        });


      existingMap.forEach(
        (child) =>
          child.remove()
      );


      newChildren.forEach(
        (child, idx) => {
          if (
            scroll.children[idx] !==
            child
          ) {
            scroll.insertBefore(
              child,
              scroll.children[idx] ||
                null
            );
          }
        }
      );


      scroll.scrollTop =
        priorScrollTop;

      scroll.scrollLeft =
        priorScrollLeft;


      requestAnimationFrame(() => {
        fitBottomDockToTabs();

        refreshSlider();

        const activeCoord =
          pointerCoord ??
          (
            scroll.matches(':hover')
              ? (
                  currentPosition === 'bottom'
                    ? lastWindowX
                    : lastWindowY
                )
              : null
          );

        if (activeCoord !== null) {
          applyDockEffect(
            activeCoord
          );
        }
      });
    }


    /* =====================================================
       OPEN / CLOSE
       ===================================================== */

    const setDockOpen = (open) => {
      const shouldBeOpen =
        Boolean(open);

      if (
        !shouldBeOpen &&
        (
          document.hidden ||
          isHoveringDock() ||
          isDraggingDock
        )
      ) {
        return;
      }

      shell.classList.toggle(
        'sidebar-open',
        shouldBeOpen
      );
    };


    const openSidebar = () => {
      clearTimeout(hideTimer);

      if (
        !shell.classList.contains(
          'sidebar-open'
        )
      ) {
        shell.classList.add(
          'sidebar-open'
        );

        bridge
          .setDockOpen(true)
          .catch(reportError);
      }
    };


    const scheduleClose = () => {
      if (
        document.hidden ||
        isDraggingDock
      ) {
        return;
      }

      if (
        Date.now() <
        retainOpenUntil
      ) {
        return;
      }

      if (isHoveringDock()) {
        return;
      }

      clearTimeout(hideTimer);

      hideTimer =
        setTimeout(() => {
          if (
            document.hidden ||
            isDraggingDock
          ) {
            return;
          }

          if (isHoveringDock()) {
            return;
          }

          shell.classList.remove(
            'sidebar-open'
          );

          bridge
            .setDockOpen(false)
            .catch(reportError);
        }, 150);
    };


    /* =====================================================
       DOCK REPOSITIONING
       ===================================================== */

    const dropZones =
      Array.from(
        shadow.querySelectorAll(
          '.drop-zone'
        )
      );


    const startDockDrag = () => {
      isDraggingDock = true;

      shell.classList.add(
        'dock-dragging'
      );

      clearTimeout(hideTimer);


      let targetPos =
        currentPosition;


      const onPointerMove = (e) => {
        let minDistance =
          Infinity;

        let bestTarget =
          targetPos;


        dropZones.forEach(
          (zone) => {
            const rect =
              zone.getBoundingClientRect();

            const centerX =
              rect.left +
              rect.width / 2;

            const centerY =
              rect.top +
              rect.height / 2;

            const dist =
              Math.hypot(
                e.clientX - centerX,
                e.clientY - centerY
              );

            if (
              dist < minDistance
            ) {
              minDistance =
                dist;

              bestTarget =
                zone.dataset.target;
            }
          }
        );


        dropZones.forEach(
          (zone) => {
            zone.classList.toggle(
              'active-drop',
              zone.dataset.target ===
                bestTarget
            );
          }
        );


        targetPos =
          bestTarget;
      };


      const onPointerUp = () => {
        window.removeEventListener(
          'pointermove',
          onPointerMove
        );

        window.removeEventListener(
          'pointerup',
          onPointerUp
        );


        isDraggingDock = false;

        shell.classList.remove(
          'dock-dragging'
        );


        dropZones.forEach(
          (z) =>
            z.classList.remove(
              'active-drop'
            )
        );


        if (
          targetPos &&
          targetPos !==
            currentPosition
        ) {
          setPosition(
            targetPos
          );

          bridge
            .setPosition(targetPos)
            .catch(reportError);
        }
      };


      window.addEventListener(
        'pointermove',
        onPointerMove
      );

      window.addEventListener(
        'pointerup',
        onPointerUp
      );
    };


    if (dragHandle) {
      dragHandle.addEventListener(
        'pointerdown',
        (e) => {
          e.preventDefault();

          startDockDrag();
        }
      );
    }


    /* =====================================================
       OPEN / CLOSE EVENTS
       ===================================================== */

    edge.addEventListener(
      'mouseenter',
      openSidebar
    );

    edge.addEventListener(
      'mouseleave',
      (event) => {
        if (
          !sidebar.contains(
            event.relatedTarget
          ) &&
          !isHoveringDock()
        ) {
          scheduleClose();
        }
      }
    );


    sidebar.addEventListener(
      'mouseenter',
      openSidebar
    );

    sidebar.addEventListener(
      'mouseleave',
      () => {
        if (!isHoveringDock()) {
          scheduleClose();
        }
      }
    );


    /* =====================================================
       MOUSE POSITION / MAGNIFICATION
       ===================================================== */

    window.addEventListener(
      'mousemove',
      (event) => {
        lastWindowX =
          event.clientX;

        lastWindowY =
          event.clientY;

        if (
          scroll.matches(':hover')
        ) {
          pointerCoord =
            currentPosition === 'bottom'
              ? event.clientX
              : event.clientY;

          applyDockEffect(
            pointerCoord
          );
        }
      },
      { passive:true }
    );


    /* =====================================================
       ADD TAB
       ===================================================== */

    add.addEventListener(
      'click',
      () => {
        retainOpenUntil =
          Date.now() + 1000;

        bridge
          .createTab()
          .catch(reportError);
      }
    );


    /* =====================================================
       NATIVE TRACKPAD / MOUSE SCROLLING
       ===================================================== */

    /*
     * IMPORTANT:
     *
     * There is intentionally NO wheel event handler here.
     *
     * The browser handles the trackpad/mouse wheel natively.
     * CSS scroll snapping keeps the final position aligned
     * with complete tabs.
     */


    /* =====================================================
       POINTER MAGNIFICATION
       ===================================================== */

    scroll.addEventListener(
      'mousemove',
      (event) => {
        pointerCoord =
          currentPosition === 'bottom'
            ? event.clientX
            : event.clientY;

        applyDockEffect(
          pointerCoord
        );
      }
    );


    scroll.addEventListener(
      'mouseleave',
      () => {
        pointerCoord = null;

        resetDockEffect();
      }
    );


    /* =====================================================
       SCROLL UPDATE
       ===================================================== */

    scroll.addEventListener(
      'scroll',
      () => {
        refreshSlider();

        if (
          pointerCoord === null
        ) {
          resetDockEffect();
        } else {
          applyDockEffect(
            pointerCoord
          );
        }
      }
    );


    /* =====================================================
       RESIZE
       ===================================================== */

    new ResizeObserver(
      () => {
        fitBottomDockToTabs();

        refreshSlider();
      }
    ).observe(scroll);


    window.addEventListener(
      'resize',
      () => {
        fitBottomDockToTabs();

        refreshSlider();
      }
    );


    /* =====================================================
       SLIDER DRAG
       ===================================================== */

    thumb.addEventListener(
      'pointerdown',
      (event) => {
        draggingSlider = true;

        thumb.classList.add(
          'dragging'
        );

        dragStartY =
          event.clientY;

        dragStartX =
          event.clientX;

        dragStartTop =
          scroll.scrollTop;

        dragStartLeft =
          scroll.scrollLeft;

        thumb.setPointerCapture(
          event.pointerId
        );
      }
    );


    thumb.addEventListener(
      'pointermove',
      (event) => {
        if (!draggingSlider) {
          return;
        }


        if (
          currentPosition === 'bottom'
        ) {
          const w =
            Math.max(
              24,
              (
                scroll.clientWidth /
                scroll.scrollWidth
              ) *
              track.clientWidth
            );

          const denominator =
            track.clientWidth -
            w;

          if (
            denominator > 0
          ) {
            scroll.scrollLeft =
              dragStartLeft +
              (
                (
                  event.clientX -
                  dragStartX
                ) /
                denominator
              ) *
              (
                scroll.scrollWidth -
                scroll.clientWidth
              );
          }

        } else {
          const h =
            Math.max(
              24,
              (
                scroll.clientHeight /
                scroll.scrollHeight
              ) *
              track.clientHeight
            );

          const denominator =
            track.clientHeight -
            h;

          if (
            denominator > 0
          ) {
            scroll.scrollTop =
              dragStartTop +
              (
                (
                  event.clientY -
                  dragStartY
                ) /
                denominator
              ) *
              (
                scroll.scrollHeight -
                scroll.clientHeight
              );
          }
        }
      }
    );


    ['pointerup', 'pointercancel']
      .forEach(
        (eventName) => {
          thumb.addEventListener(
            eventName,
            () => {
              draggingSlider = false;

              thumb.classList.remove(
                'dragging'
              );
            }
          );
        }
      );


    /* =====================================================
       SLIDER TRACK CLICK
       ===================================================== */

    track.addEventListener(
      'pointerdown',
      (event) => {
        if (
          event.target === thumb
        ) {
          return;
        }


        if (
          currentPosition === 'bottom'
        ) {
          if (
            !track.clientWidth
          ) {
            return;
          }

          scroll.scrollLeft =
            (
              (
                event.clientX -
                track.getBoundingClientRect().left
              ) /
              track.clientWidth
            ) *
            (
              scroll.scrollWidth -
              scroll.clientWidth
            );

        } else {
          if (
            !track.clientHeight
          ) {
            return;
          }

          scroll.scrollTop =
            (
              (
                event.clientY -
                track.getBoundingClientRect().top
              ) /
              track.clientHeight
            ) *
            (
              scroll.scrollHeight -
              scroll.clientHeight
            );
        }
      }
    );


    /* =====================================================
       INITIALIZATION
       ===================================================== */

    requestAnimationFrame(() => {
      fitBottomDockToTabs();
      refreshSlider();
    });


    return {
      renderTabs,
      setDockOpen,
      setPosition
    };
  }


  window.FullscreenTabManager.mount =
    mount;

  window.FullscreenTabManager.mountSidebar();
})();