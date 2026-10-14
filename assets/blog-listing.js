(() => {
  class BlogListing {
    constructor(root) {
      this.root = root;
      this.grid = root.querySelector('[data-blog-listing-grid]');
      this.footer = root.querySelector('.blog-listing__footer');
      this.searchInput = root.querySelector('.blog-listing__search');
      this.tagGroup = root.querySelector('[data-tag-group]');
      this.tagToggle = root.querySelector('[data-tag-toggle]');

      this.sectionId = root.dataset.sectionId;
      this.sourceBlogUrl = root.dataset.sourceBlogUrl || root.dataset.blogUrl || '';
      this.urlBlogUrl = root.dataset.urlBlogUrl || root.dataset.blogUrl || '';
      this.searchUrl = root.dataset.searchUrl || '/search';
      this.useNativeTags = root.dataset.useNativeTags === 'true';
      this.sectionConfig = {
        postsPerPage: Math.max(1, Number(root.dataset.postsPerPage) || 8),
        sourceBlogHandle: root.dataset.blogHandle || ''
      };
      this.currentPage = Number(root.dataset.currentPage || 1);
      this.totalPages = Number(root.dataset.totalPages || 1);
      this.isLoading = false;
      this.searchAbortController = null;

      this.state = {
        q: '',
        tag: root.dataset.activeTag || '',
        categoryPath: '',
        year: root.dataset.activeYear || ''
      };

      this.cacheElements();
      this.initFromUrl();
      this.bindEvents();
      this.bootstrapFromUrl();
    }

    cacheElements() {
      this.filterButtons = Array.from(this.root.querySelectorAll('[data-filter-button]'));
      this.loadMoreButton = this.root.querySelector('[data-load-more]');
    }

    isYearTagValue(value) {
      return /^\d{4}$/.test(String(value || '').trim()) &&
        Number(value) > 1999 &&
        Number(value) < 2101;
    }

    /**
     * categoryPath stays category-only.
     * Combined path is computed fresh each time: sale+2025
     */
    getCategoryPath() {
      if (this.state.categoryPath) return this.state.categoryPath;
      if (!this.state.tag) return '';
      return this.state.tag.trim().toLowerCase().replace(/\s+/g, '-');
    }

    getCombinedTaggedPath() {
      const parts = [];
      const categoryPath = this.getCategoryPath();

      if (categoryPath) parts.push(categoryPath);
      if (this.state.year) parts.push(String(this.state.year));

      return parts.join('+');
    }

    getTaggedFetchUrl() {
      const combined = this.getCombinedTaggedPath();
      if (!combined || !this.sourceBlogUrl) return '';
      return `${this.sourceBlogUrl}/tagged/${combined}`;
    }

    initFromUrl() {
      try {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        const taggedMatch = url.pathname.match(/\/tagged\/(.+)$/);

        if (this.useNativeTags && taggedMatch && taggedMatch[1]) {
          this.applyTagsFromPath(taggedMatch[1]);
        } else {
          const tagParam = params.get('tag');
          if (tagParam) {
            this.applyCategoryTagFromValue(tagParam);
          } else if (this.root.dataset.activeTag) {
            this.applyCategoryTagFromValue(this.root.dataset.activeTag);
          }

          const yearParam = params.get('year') || this.root.dataset.activeYear || '';
          if (yearParam && this.isYearTagValue(yearParam)) {
            this.state.year = yearParam;
          }
        }

        this.state.q = params.get('q') || '';

        if (this.searchInput && this.state.q) this.searchInput.value = this.state.q;

        this.syncFilterButtons();
      } catch (e) {
        // ignore URL parse errors
      }
    }

    applyTagsFromPath(tagPath) {
      this.clearTagState();
      this.clearYearState();

      const parts = decodeURIComponent(tagPath)
        .split('+')
        .map((part) => part.trim())
        .filter(Boolean);

      parts.forEach((part) => {
        if (this.isYearTagValue(part)) {
          this.state.year = part;
          return;
        }

        const matchedButton = this.filterButtons.find((button) => {
          if (button.dataset.filterType !== 'tag' || !button.dataset.tagPath) {
            return false;
          }

          return (
            this.normalizeTagPath(button.dataset.tagPath) === this.normalizeTagPath(part)
          );
        });

        if (matchedButton) {
          this.setCategoryTagFromButton(matchedButton);
        } else {
          this.state.tag = part;
          this.state.categoryPath = part;
        }
      });
    }

    applyCategoryTagFromValue(tagValue) {
      if (this.isYearTagValue(tagValue)) {
        this.state.year = tagValue;
        return;
      }

      const normalizedValue = this.normalizeTagValue(tagValue);
      const matchedButton = this.filterButtons.find((button) => {
        if (button.dataset.filterType !== 'tag' || !button.dataset.filterValue) {
          return false;
        }

        return this.normalizeTagValue(button.dataset.filterValue) === normalizedValue;
      });

      if (matchedButton) {
        this.setCategoryTagFromButton(matchedButton);
      } else {
        this.state.tag = tagValue;
        this.state.categoryPath = tagValue.trim().toLowerCase().replace(/\s+/g, '-');
      }
    }

    setCategoryTagFromButton(button) {
      this.state.tag = button.dataset.filterValue || '';
      this.state.categoryPath = button.dataset.tagPath || '';

      if (!this.state.categoryPath && this.state.tag) {
        this.state.categoryPath = this.state.tag.trim().toLowerCase().replace(/\s+/g, '-');
      }
    }

    normalizeTagPath(path) {
      if (!path) return '';

      try {
        return decodeURIComponent(path).toLowerCase();
      } catch (e) {
        return path.toLowerCase();
      }
    }

    normalizeTagValue(value) {
      if (!value) return '';

      try {
        return decodeURIComponent(value).trim().toLowerCase();
      } catch (e) {
        return value.trim().toLowerCase();
      }
    }

    bootstrapFromUrl() {
      if (this.state.q) {
        this.clearTagState();
        this.clearYearState();
        this.syncFilterButtons();
        this.fetchSection({ page: 1, replace: true, updateHistory: false });
        return;
      }

      const needsAjax =
        !this.useNativeTags && Boolean(this.getCombinedTaggedPath());

      if (needsAjax) {
        this.fetchSection({ page: 1, replace: true, updateHistory: false });
      }
    }

    clearTagState() {
      this.state.tag = '';
      this.state.categoryPath = '';
    }

    clearYearState() {
      this.state.year = '';
    }

    clearSearchState() {
      this.state.q = '';
      if (this.searchInput) {
        this.searchInput.value = '';
      }
    }

    bindEvents() {
      if (this.searchInput) {
        const handler = this.debounce((event) => {
          const nextQuery = event.target.value.trim();

          if (nextQuery === this.state.q) return;

          this.state.q = nextQuery;

          if (this.state.q) {
            this.clearTagState();
            this.clearYearState();
            this.syncFilterButtons();
          }

          this.pushSecondaryState();
          this.fetchSection({ page: 1, replace: true, updateHistory: false });
        }, 300);
        this.searchInput.addEventListener('input', handler);
      }

      this.root.addEventListener('click', (event) => {
        const button = event.target.closest('[data-filter-button]');
        if (!button || !this.root.contains(button)) return;

        const filterType = button.dataset.filterType;
        if (!filterType) return;

        if (filterType === 'tag') {
          this.handleTagChange(button);
          return;
        }

        if (filterType === 'year') {
          this.handleYearChange(button);
        }
      });

      if (this.tagToggle) {
        this.tagToggle.addEventListener('click', () => {
          const isExpanded = this.tagGroup.classList.contains(
            'blog-listing__chip-group--expanded'
          );

          this.tagGroup.classList.toggle('blog-listing__chip-group--expanded', !isExpanded);
          this.tagGroup.classList.toggle('blog-listing__chip-group--collapsed', isExpanded);
          this.tagToggle.textContent = isExpanded ? 'View more' : 'Collapse';
        });
      }

      this.root.addEventListener('click', (event) => {
        const loadMoreButton = event.target.closest('[data-load-more]');
        if (!loadMoreButton || !this.root.contains(loadMoreButton)) return;
        this.handleLoadMore();
      });
    }

    handleTagChange(button) {
      const nextTag = button.dataset.filterValue || '';

      if (nextTag === this.state.tag) return;

      this.clearSearchState();

      if (nextTag === '') {
        this.clearTagState();
      } else {
        this.setCategoryTagFromButton(button);
      }

      this.syncFilterButtons();
      this.pushSecondaryState();
      this.fetchSection({ page: 1, replace: true, updateHistory: false });
    }

    handleYearChange(button) {
      const nextYear = button.dataset.filterValue || '';

      if (nextYear === this.state.year) return;

      this.clearSearchState();
      this.state.year = nextYear;
      this.root.dataset.activeYear = this.state.year;
      this.syncFilterButtons();
      this.pushSecondaryState();
      this.fetchSection({ page: 1, replace: true, updateHistory: false });
    }

    syncFilterButtons() {
      this.filterButtons.forEach((button) => {
        const filterType = button.dataset.filterType;
        const filterValue = button.dataset.filterValue || '';
        const currentValue = this.state[filterType] || '';

        button.classList.toggle('blog-listing__chip--active', currentValue === filterValue);
      });
    }

    debounce(fn, delay) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    pushSecondaryState() {
      try {
        const url = this.buildHistoryUrl(this.currentPage);
        window.history.replaceState({}, '', url.toString());
      } catch (e) {
        // ignore history errors
      }
    }

    buildSectionUrl(page) {
      if (this.state.q) {
        const url = new URL(this.searchUrl, window.location.origin);
        url.searchParams.set('q', this.state.q);
        url.searchParams.set('type', 'article');
        url.searchParams.set('section_id', 'blog-listing');
        url.searchParams.set('bl_per_page', String(this.sectionConfig.postsPerPage));

        if (this.sectionConfig.sourceBlogHandle) {
          url.searchParams.set('bl_blog', this.sectionConfig.sourceBlogHandle);
        }

        if (this.state.year) {
          url.searchParams.set('year', this.state.year);
        }

        if (page > 1) {
          url.searchParams.set('page', String(page));
        }

        return url;
      }

      let basePath;
      let sectionIdParam = this.sectionId;
      let useSectionsByFilenameFallback = false;
      const combinedPath = this.getCombinedTaggedPath();
      const hasTaggedFilter = Boolean(combinedPath);

      if (this.useNativeTags) {
        basePath = hasTaggedFilter
          ? `${this.urlBlogUrl}/tagged/${combinedPath}`
          : this.urlBlogUrl;
      } else if (hasTaggedFilter) {
        basePath = this.getTaggedFetchUrl();

        if (!sectionIdParam) {
          useSectionsByFilenameFallback = true;
        }
      } else {
        basePath = this.urlBlogUrl;
      }

      if (!basePath) {
        throw new Error('Missing blog URL for section fetch');
      }

      const url = new URL(basePath, window.location.origin);

      if (useSectionsByFilenameFallback) {
        url.searchParams.set('sections', 'blog-listing');
      } else {
        url.searchParams.set('section_id', sectionIdParam);
      }

      url.searchParams.set('bl_per_page', String(this.sectionConfig.postsPerPage));

      if (this.sectionConfig.sourceBlogHandle) {
        url.searchParams.set('bl_blog', this.sectionConfig.sourceBlogHandle);
      }

      // Backup for Liquid when Section Rendering drops current_tags context.
      if (this.state.tag) {
        url.searchParams.set('tag', this.state.tag);
      }
      if (this.state.year) {
        url.searchParams.set('year', this.state.year);
      }

      if (page > 1) {
        url.searchParams.set('page', String(page));
      }

      return url;
    }

    async parseSectionResponse(response) {
      const text = await response.text();

      try {
        const json = JSON.parse(text);

        if (json && typeof json === 'object') {
          return (
            json.blog_listing ||
            json['blog-listing'] ||
            Object.values(json)[0] ||
            ''
          );
        }
      } catch (e) {
        // not JSON, fall through to HTML
      }

      return text;
    }

    findSectionRoot(doc) {
      return (
        doc.querySelector(`#blog-listing-${this.sectionId}`) ||
        doc.querySelector('#shopify-section-blog-listing') ||
        doc.querySelector('.blog-listing--search-results') ||
        doc.querySelector('.blog-listing')
      );
    }

    buildHistoryUrl(page) {
      let url;
      const combinedPath = this.getCombinedTaggedPath();

      if (this.useNativeTags && combinedPath) {
        url = new URL(`${this.urlBlogUrl}/tagged/${combinedPath}`, window.location.origin);
      } else {
        url = new URL(this.urlBlogUrl, window.location.origin);

        if (this.state.tag) {
          url.searchParams.set('tag', this.state.tag);
        } else {
          url.searchParams.delete('tag');
        }

        if (this.state.year) {
          url.searchParams.set('year', this.state.year);
        } else {
          url.searchParams.delete('year');
        }
      }

      if (this.state.q) url.searchParams.set('q', this.state.q);
      else url.searchParams.delete('q');

      url.searchParams.delete('sort');
      url.searchParams.delete('section_id');

      if (page <= 1) {
        url.searchParams.delete('page');
      } else {
        url.searchParams.set('page', String(page));
      }

      return url;
    }

    async fetchSection({ page = 1, replace = false, updateHistory = false } = {}) {
      if (this.searchAbortController) {
        this.searchAbortController.abort('Existing request not needed');
      }

      this.searchAbortController = new AbortController();
      const abortSignal = this.searchAbortController.signal;
      this.isLoading = true;

      if (this.loadMoreButton) {
        this.loadMoreButton.disabled = true;
      }

      try {
        const requestUrl = this.buildSectionUrl(page);
        const response = await fetch(requestUrl.toString(), {
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          },
          signal: abortSignal
        });

        if (!response.ok) {
          throw new Error('Section request failed');
        }

        const html = await this.parseSectionResponse(response);

        if (!html) {
          throw new Error('Empty section response');
        }

        const doc = new DOMParser().parseFromString(html, 'text/html');
        const newSection = this.findSectionRoot(doc);

        if (!newSection) {
          throw new Error('Section HTML not found');
        }

        this.applyFetchedSection(newSection, { page, replace });
        this.applySearchBlogFilter();
        this.applyActiveTagFilters();

        if (updateHistory) {
          const historyUrl = this.buildHistoryUrl(page);
          window.history.pushState({ blogListing: true }, '', historyUrl.toString());
        }

        // Search: /search drops bl_blog in Liquid, so we filter in JS.
        // If this page had no matches for the current blog but more pages exist, keep fetching.
        if (
          this.state.q &&
          this.sectionConfig.sourceBlogHandle &&
          this.currentPage < this.totalPages
        ) {
          const visibleCount = this.grid
            ? this.grid.querySelectorAll('[data-article-card]:not([hidden])').length
            : 0;
          const needMore =
            replace
              ? visibleCount < this.sectionConfig.postsPerPage
              : visibleCount === 0;

          if (needMore && visibleCount < this.sectionConfig.postsPerPage) {
            await this.fetchSection({
              page: this.currentPage + 1,
              replace: false,
              updateHistory: false
            });
            return;
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') return;

        console.error('[blog-listing]', e.message || e);

        if (this.loadMoreButton) {
          this.loadMoreButton.disabled = false;
        }
      } finally {
        if (this.searchAbortController && this.searchAbortController.signal === abortSignal) {
          this.searchAbortController = null;
        }
        this.isLoading = false;
      }
    }

    getCardBlogHandle(card) {
      const fromData = (card.dataset.articleBlogHandle || '').trim();
      if (fromData) return fromData;

      const link = card.querySelector('a[href*="/blogs/"]');
      if (!link) return '';

      const match = link.getAttribute('href').match(/\/blogs\/([^/?#]+)/);
      return match ? decodeURIComponent(match[1]) : '';
    }

    /**
     * Per-page Search filter.
     * Shopify /search?section_id=... does not expose custom bl_blog to Liquid,
     * so filtering must happen here using the page section's source blog handle.
     */
    applySearchBlogFilter() {
      if (!this.grid || !this.state.q) return;

      const want = (this.sectionConfig.sourceBlogHandle || '').trim();
      this.root.dataset.filterBlogHandle = want;

      if (!want) return;

      const cards = Array.from(this.grid.querySelectorAll('[data-article-card]'));
      let visibleCount = 0;

      cards.forEach((card) => {
        const handle = this.getCardBlogHandle(card);
        if (handle !== want) {
          card.remove();
          return;
        }
        visibleCount += 1;
      });

      const existingEmpty =
        this.grid.querySelector('[data-empty-search]') ||
        this.grid.querySelector('[data-empty-filtered]');

      if (visibleCount === 0) {
        if (existingEmpty) {
          existingEmpty.textContent = `No articles found for "${this.state.q}".`;
          existingEmpty.hidden = false;
        } else if (this.currentPage >= this.totalPages) {
          this.grid.innerHTML = '';
          const empty = document.createElement('div');
          empty.className = 'blog-listing__empty';
          empty.dataset.emptySearch = '';
          empty.textContent = `No articles found for "${this.state.q}".`;
          this.grid.appendChild(empty);
        }
      } else if (existingEmpty) {
        existingEmpty.remove();
      }
    }

    applyFetchedSection(newSection, { page, replace }) {
      const newGrid = newSection.querySelector('[data-blog-listing-grid]');
      const newFooter = newSection.querySelector('.blog-listing__footer');

      if (!newGrid) {
        throw new Error('Grid HTML not found');
      }

      this.currentPage = Number(newSection.dataset.currentPage || page);
      this.totalPages = Number(newSection.dataset.totalPages || this.totalPages);
      this.root.dataset.activeTag = this.state.tag;
      this.root.dataset.activeYear = this.state.year;
      this.root.dataset.searchQuery = this.state.q;
      this.root.dataset.currentPage = String(this.currentPage);
      this.root.dataset.totalPages = String(this.totalPages);

      if (this.state.q && this.sectionConfig.sourceBlogHandle) {
        this.root.dataset.filterBlogHandle = this.sectionConfig.sourceBlogHandle;
      }

      if (replace) {
        this.grid.innerHTML = newGrid.innerHTML;
      } else {
        const existingIds = new Set(
          Array.from(this.grid.querySelectorAll('[data-article-card]')).map(
            (card) => card.dataset.publishedAt + card.dataset.title
          )
        );

        Array.from(newGrid.querySelectorAll('[data-article-card]')).forEach((card) => {
          const key = card.dataset.publishedAt + card.dataset.title;
          if (existingIds.has(key)) return;
          this.grid.appendChild(card);
        });
      }

      if (newFooter && this.footer) {
        this.footer.innerHTML = newFooter.innerHTML;
      }

      this.cacheElements();
    }

    cardMatchesActiveFilters(card) {
      const tags = (card.dataset.tags || '')
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);

      if (this.state.tag) {
        const want = this.state.tag.trim().toLowerCase();
        if (!tags.includes(want)) return false;
      }

      if (this.state.year) {
        const wantYear = String(this.state.year).trim().toLowerCase();
        if (!tags.includes(wantYear)) return false;
      }

      return true;
    }

    buildEmptyFilterMessage() {
      if (this.state.tag && this.state.year) {
        return `No articles match “${this.state.tag}” + “${this.state.year}”.`;
      }
      if (this.state.tag) {
        return `No articles match “${this.state.tag}”.`;
      }
      if (this.state.year) {
        return `No articles match “${this.state.year}”.`;
      }
      return 'No articles found.';
    }

    /**
     * AND filter safety: Tag + Year must both exist on the article.
     * Shopify /tagged/a+b can return unfiltered results when the combo is empty.
     */
    applyActiveTagFilters() {
      if (!this.grid) return;
      if (!this.state.tag && !this.state.year) return;

      const cards = Array.from(this.grid.querySelectorAll('[data-article-card]'));
      let visibleCount = 0;

      cards.forEach((card) => {
        const ok = this.cardMatchesActiveFilters(card);
        card.hidden = !ok;
        if (ok) visibleCount += 1;
      });

      const existingEmpty = this.grid.querySelector('[data-empty-filtered]');

      if (visibleCount === 0) {
        cards.forEach((card) => card.remove());

        if (existingEmpty) {
          existingEmpty.textContent = this.buildEmptyFilterMessage();
        } else {
          this.grid.innerHTML = '';
          const empty = document.createElement('div');
          empty.className = 'blog-listing__empty';
          empty.dataset.emptyFiltered = '';
          empty.textContent = this.buildEmptyFilterMessage();
          this.grid.appendChild(empty);
        }

        if (this.footer) {
          this.footer.innerHTML = '';
          this.loadMoreButton = null;
        }
      } else if (existingEmpty) {
        existingEmpty.remove();
      }
    }

    async handleLoadMore() {
      if (this.currentPage >= this.totalPages) return;

      await this.fetchSection({
        page: this.currentPage + 1,
        replace: false,
        updateHistory: false
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.blog-listing').forEach((section) => {
      new BlogListing(section);
    });
  });
})();
