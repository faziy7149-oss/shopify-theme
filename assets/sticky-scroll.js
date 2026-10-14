if (!customElements.get('sticky-scroll')) {
  class StickyScroll extends HTMLElement {
    constructor() {
      super();
      this.lastScrollY = window.scrollY;
      this.currentTop = 0;
      this.boundInit = this.init.bind(this);
      this.boundOnScroll = this.onScroll.bind(this);
      this.init();
    }

    connectedCallback() {
      window.addEventListener('on:debounced-resize', this.boundInit);
    }

    disconnectedCallback() {
      window.removeEventListener('on:debounced-resize', this.boundInit);
      window.removeEventListener('scroll', this.boundOnScroll);
    }

    init() {
      const computedStyle = getComputedStyle(this);

      // Sticky - attach if unattached
      if (computedStyle.position === 'sticky' && !this.attached) {
        this.initialOffset = parseInt(computedStyle.top, 10) || 0;
        window.addEventListener('scroll', this.boundOnScroll, { passive: true });
        this.attached = true;

      // Not sticky - detach if attached
      } else if (computedStyle.position !== 'sticky' && this.attached) {
        this.style.top = '';
        window.removeEventListener('scroll', this.boundOnScroll);
        this.attached = false;
      }
    }

    onScroll() {
      // Only update on requestAnimationFrame
      if (!this.waitingToUpdate) {
        window.requestAnimationFrame(() => {
          this.updatePosition();
          this.waitingToUpdate = false;
        });
        this.waitingToUpdate = true;
      }
    }

    updatePosition() {
      const scrollDelta = window.scrollY - this.lastScrollY;
      const viewportHeight = window.innerHeight;
      const elementHeight = this.offsetHeight;

      // Do not set top if element is taller than the viewport
      if (elementHeight <= viewportHeight) {
        this.style.top = '';
        this.lastScrollY = window.scrollY;
        return;
      }

      const minTop = viewportHeight - elementHeight;
      const maxTop = this.initialOffset;

      this.currentTop -= scrollDelta;
      this.currentTop = Math.max(minTop, Math.min(maxTop, this.currentTop));

      this.style.top = `${this.currentTop}px`;
      this.lastScrollY = window.scrollY;
    }
  }

  customElements.define('sticky-scroll', StickyScroll);
}
