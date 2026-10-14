/**
 * Returns a function, that, when invoked, will only be triggered at most once during
 * a given window of time.
 * @param {Function} fn - Callback function.
 * @param {number} [wait=300] - Time window (in milliseconds).
 * @returns {Function}
 */
function throttle(fn, wait = 300) {
  let throttleTimeoutId = -1;
  let tick = false;

  return () => {
    clearTimeout(throttleTimeoutId);
    throttleTimeoutId = setTimeout(fn, wait);

    if (!tick) {
      fn.call();
      tick = true;
      setTimeout(() => {
        tick = false;
      }, wait);
    }
  };
}

if (!customElements.get('sticky-atc')) {
  customElements.whenDefined('product-form').then(() => {
    class StickyAtc extends customElements.get('product-form') {
      constructor() {
        super();

        this.section = this.closest('.section-main-product');
        this.buyButtons = this.section.querySelector('.quantity-submit-row');
        if (!this.buyButtons) return;

        this.mainProductForm = this.section.querySelector('product-form');
        this.mainProductSubmitForm = this.mainProductForm.getSubmitForm();
        this.submitForm = this.getSubmitForm();
        this.imageContainer = this.querySelector('.sticky-atc__image');
        this.variantTitle = this.querySelector('.sticky-atc__details__variant__title');
        this.variantTitle?.toggleAttribute('hidden', !this.section.querySelector('variant-picker'));
        this.button = this.querySelector('.add-to-cart');

        this.throttledOnScroll = throttle(this.handleScroll.bind(this));
        window.addEventListener('scroll', this.throttledOnScroll);

        this.section.addEventListener('on:media-gallery:change', this.updateImage.bind(this));

        this.updateImage();
        this.updateAddToCartButton();
      }

      disconnectedCallback() {
        window.removeEventListener('scroll', this.throttledOnScroll);
      }

      /**
       * Handles submission of the product form.
       * @param {object} evt - Event object.
       */
      async handleSubmit(evt) {
        evt.preventDefault();

        const variantId = this.section.querySelector('.js-product-form input[name="id"]').value;
        if (!variantId) {
          const target = this.section.querySelector('#product-info');
          if (target && target.offsetParent) {
            evt.preventDefault();
            theme.scrollToRevealElement(target);
          }
          return;
        }

        // Validate main form
        const customFormValid = this.mainProductForm.validate();
        if (!customFormValid || !this.mainProductSubmitForm.reportValidity()) {
          evt.preventDefault();
          if (!customFormValid) {
            theme.scrollToRevealElement(this.mainProductForm);
          } else {
            const input = Array.from(this.mainProductSubmitForm.elements).find(
              (el) => !el.checkValidity()
            );
            setTimeout(() => theme.scrollToRevealElement(input), 100);
          }
          return;
        }

        // Clear copied data
        this.submitForm.querySelectorAll('[data-copied]').forEach((el) => el.remove());

        // Copy data
        const formData = new FormData(this.mainProductSubmitForm);
        for (const p of formData) {
          if (!this.submitForm.querySelector(`[name="${p[0]}"]`)) {
            const input = document.createElement('input');
            input.name = p[0];
            input.value = p[1];
            input.hidden = true;
            input.setAttribute('data-copied', '');
            this.submitForm.append(input);
          }
        }
        super.handleSubmit(evt);
      }

      /**
       * Determine visibility after scroll.
       */
      handleScroll() {
        const topOffset = document.querySelector('.pageheader--sticky') ? document.querySelector('.section-header').offsetHeight : 0;
        this.classList.toggle(
          'sticky-atc--out',
          this.buyButtons.getBoundingClientRect().bottom > topOffset
        );

        document.body.classList.toggle(
          'scrolled-to-bottom',
          window.scrollY + window.innerHeight + 100 > document.body.scrollHeight
        );
      }

      /**
       * Updates the image.
       */
      updateImage() {
        const mainImage = this.section.querySelector('.media-gallery .main-image .slider__item.is-active .product-media img');

        if (mainImage) {
          this.imageContainer.innerHTML = mainImage.outerHTML;
        } else {
          this.imageContainer.textContent = '';
        }
      }

      /**
       * Updates the add to cart button text.
       */
      updateAddToCartButton() {
        // If there is no variant selected, show unavailable-text
        const variantId = this.section.querySelector('.js-product-form input[name="id"]').value;
        if (!variantId) {
          this.button.innerHTML = this.button.dataset.unavailableText;
        }
      }
    }

    customElements.define('sticky-atc', StickyAtc);
  });
}
