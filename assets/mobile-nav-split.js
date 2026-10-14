/**
 * Split mobile navigation interactions.
 * Does not modify theme MainNavigation open/close behaviour.
 * Native slide/accordion handlers are avoided via mobile-nav-split__* class names.
 */
(function () {
  const SELECTOR_DRAWER = '.mobile-navigation-drawer--split';
  const SELECTOR_ROOT = '[data-mobile-nav-split]';

  function initSplitNav(drawer) {
    if (!drawer || drawer.dataset.splitNavReady === 'true') return;

    const root = drawer.querySelector(SELECTOR_ROOT);
    if (!root) return;

    drawer.dataset.splitNavReady = 'true';

    const items = [...root.querySelectorAll('.mobile-nav-split__l1-item--has-children')];
    const panels = [...root.querySelectorAll('[data-split-panel]')];
    const emptyPanel = root.querySelector('[data-split-panel-empty]');
    const rightPane = root.querySelector('[data-split-right]');

    function hideAllPanels() {
      panels.forEach((panel) => {
        panel.hidden = true;
      });
      if (emptyPanel) emptyPanel.hidden = true;
    }

    function showPanel(index) {
      hideAllPanels();
      const panel = root.querySelector(`[data-split-panel="${index}"]`);
      if (panel) {
        panel.hidden = false;
      } else if (emptyPanel) {
        emptyPanel.hidden = false;
      }
      if (rightPane) rightPane.scrollTop = 0;
    }

    function setActiveItem(item, open) {
      items.forEach((el) => {
        const isTarget = el === item;
        const shouldOpen = isTarget && open;
        el.classList.toggle('mobile-nav-split__l1-item--open', shouldOpen);
        el.classList.toggle('is-active', isTarget);

        const l2 = el.querySelector('.mobile-nav-split__l2');
        if (l2) l2.hidden = !shouldOpen;

        const toggle = el.querySelector('[data-split-l1-toggle]');
        if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      });

      if (item && open) {
        showPanel(item.dataset.splitL1Index);
      }
    }

    root.addEventListener('click', (evt) => {
      const toggle = evt.target.closest('[data-split-l1-toggle]');
      if (!toggle || !root.contains(toggle)) return;

      evt.preventDefault();
      const item = toggle.closest('.mobile-nav-split__l1-item--has-children');
      if (!item) return;

      const willOpen = !item.classList.contains('mobile-nav-split__l1-item--open');
      setActiveItem(item, willOpen);

      // Keep panel visible even when collapsing accordion text under L1
      if (!willOpen) {
        showPanel(item.dataset.splitL1Index);
        item.classList.add('is-active');
      }
    });

    // Default: open first L1 that has children
    if (items.length > 0) {
      setActiveItem(items[0], true);
    } else if (emptyPanel) {
      hideAllPanels();
      emptyPanel.hidden = false;
    }

    // Load deferred images when drawer is first revealed
    const loadImages = () => {
      if (typeof theme !== 'undefined' && typeof theme.manuallyLoadImages === 'function') {
        theme.manuallyLoadImages(drawer);
      }
    };

    if (document.body.classList.contains('reveal-mobile-nav')) {
      loadImages();
    } else {
      const observer = new MutationObserver(() => {
        if (document.body.classList.contains('reveal-mobile-nav')) {
          loadImages();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function tryInit() {
    document.querySelectorAll(SELECTOR_DRAWER).forEach(initSplitNav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }

  // Theme creates the drawer asynchronously from a template
  const bootObserver = new MutationObserver(() => {
    if (document.querySelector(`${SELECTOR_DRAWER}:not([data-split-nav-ready="true"])`)) {
      tryInit();
    }
  });
  bootObserver.observe(document.documentElement, { childList: true, subtree: true });
})();
