/**
 * 'Open or scroll to' component
 * Wraps a button and triggers 'open' on a modal-dialog, or 'theme.scrollToRevealElement'
 */
if (!customElements.get('open-or-scroll-to')) {
  class OpenOrScrollTo extends HTMLElement {
    constructor() {
      super();

      const button = this.querySelector('button');
      button.addEventListener('click', this.handleClick.bind(this));

      const target = document.getElementById(this.dataset.targetId);
      if (target && target.matches('modal-dialog')) {
        button.setAttribute('aria-haspopup', 'dialog');
      }
    }

    handleClick(evt) {
      const target = document.getElementById(this.dataset.targetId);
      const button = evt.currentTarget;
      if (target.matches('modal-dialog')) {
        target.open(button);
      } else {
        theme.scrollToRevealElement(target);
      }
    }
  }

  customElements.define('open-or-scroll-to', OpenOrScrollTo);
}
