/* eslint-disable no-else-return */
/**
 * Size Guide
 *
 * Note: See 'shopify:section:select' in theme-editor.js for editing while selected
 * Note: See 'shopify:block:select' in theme-editor.js for tab handling on selection
 */
if (!customElements.get('size-guide')) {
  class SizeGuide extends HTMLElement {
    constructor() {
      super();

      // Select first tab
      this.querySelector('.tablist__tab')?.click();

      // Wrap values for conversion
      if (this.querySelector('.size-guide-unit-converter__input')) {
        this.querySelectorAll('.size-guide-table-container :is(td, th)').forEach(SizeGuide.wrapConvertible);
      }

      // Default conversions
      this.querySelectorAll('.size-guide-unit-converter__input:checked').forEach((el) => {
        const table = el.closest('.size-guide-table-container').querySelector('table');
        SizeGuide.convertTo(el.value, table);
      });

      this.querySelectorAll('.size-guide-table').forEach((el) => {
        // Add missing cells
        SizeGuide.insertMissingCells(el);

        // Set helper CSS
        const columnCount = el.querySelectorAll('tr:first-child :is(td, th)').length - 1;
        el.style.setProperty('--table-column-count', columnCount);
      });

      // Add events
      this.addEventListener('change', SizeGuide.handleChange);
    }

    /**
     * Add any missing cells to create an even grid.
     * @param {HTMLElement} table - Table to process.
     */
    static insertMissingCells(table) {
      const allCells = [...table.querySelectorAll('.size-guide-cell')];

      // Find the largest column index in the table
      const maxIndex = allCells.reduce((max, cell) => {
        const colVal = parseInt(cell.getAttribute('data-size-guide-column'), 10);
        return colVal > max ? colVal : max;
      }, 0);

      const rows = table.querySelectorAll('tr');
      rows.forEach((row) => {
        // Create a Map of existing cells in this row
        const rowCells = [...row.querySelectorAll('.size-guide-cell')];
        const cellMap = new Map(
          rowCells.map((cell) => [parseInt(cell.getAttribute('data-size-guide-column'), 10), cell])
        );

        // Ensure every index from 0 to maxIndex has a cell
        let lastCell = null;
        for (let i = 0; i <= maxIndex; i += 1) {
          let currentCell = cellMap.get(i);

          if (!currentCell) {
            const isHeader = row.querySelector('th');
            currentCell = document.createElement(isHeader ? 'th' : 'td');
            currentCell.className = 'size-guide-cell';
            currentCell.setAttribute('data-size-guide-column', i);

            if (lastCell) {
              lastCell.after(currentCell);
            } else {
              row.prepend(currentCell);
            }
          }

          lastCell = currentCell;
        }
      });
    }

    /**
     * Wrap convertible elements inside a table cell.
     * @param {HTMLElement} cell - Table cell to look at.
     */
    static wrapConvertible(cell) {
      cell.innerHTML = cell.textContent.replace(
        /([-+]?(?:\d+|\d*\.\d+))(\s?)("|in|cm|lb|kg|g|oz)/gi,
        (fullMatch, number, space, unit) => `<span class="size-guide-unit-convertible" data-number="${number}" data-unit="${unit.toLowerCase()}" data-space="${space}">${fullMatch}</span>`
      );
    }

    /**
     * Handles 'change' events on the cart items element.
     * @param {object} evt - Event object.
     */
    static handleChange(evt) {
      if (evt.target.classList.contains('size-guide-unit-converter__input')) {
        const table = evt.target.closest('.size-guide-table-container').querySelector('table');
        SizeGuide.convertTo(evt.target.value, table);
      }
    }

    /**
     * Converts all values inside to metric or imperial.
     * @param {string} unit - Unit to convert to - 'metric' or 'imperial'.
     * @param {Element} table - Table element containing values to convert.
     */
    static convertTo(unit, table) {
      if (!table || !['metric', 'imperial'].includes(unit)) return;

      const precision = parseInt(table.dataset.precision, 10);

      // unit conversions
      const IN_TO_CM = 2.54;
      const LB_TO_KG = 0.45359237;
      const OZ_TO_G = 28.349523125;

      /**
       * Helper - Format using unary plus operator to remove trailing zeroes
       * @param {number} num - Number to format
       * @param {string} suffix - Unit to append
       * @param {string} space - Space between value and unit ('true' or 'false')
       * @returns {Array} - [Formatted number, new unit]
       */
      function formatNumber(num, suffix, space) {
        const rounded = Number(num).toFixed(precision);
        return `${+rounded}${space}${suffix}`;
      }

      /**
       * Helper - Convert one [value, unit] to desired system
       * @param {string} numStr - Number as string
       * @param {string} fromUnit - Unit to convert from
       * @param {string} target - System to convert to
       * @param {string} space - Space between value and unit ('true' or 'false')
       * @returns {string|null} - Formatted string or null
       */
      function convertSingle(numStr, fromUnit, target, space) {
        const n = Number(numStr);
        if (!Number.isFinite(n)) return null;
        const fu = fromUnit;

        // If the unit is already in the target system, return original
        if (target === 'metric' && (fu === 'cm' || fu === 'kg' || fu === 'g')) return `${numStr}${space}${fromUnit}`;
        if (target === 'imperial' && (fu === '"' || fu === 'in' || fu === 'lb' || fu === 'oz')) return `${numStr}${space}${fromUnit}`;

        // Convert
        if (fu === '"') return formatNumber(n * IN_TO_CM, 'cm', ''); // '1"' to '2.5cm'
        if (fu === 'in') return formatNumber(n * IN_TO_CM, 'cm', space);
        if (fu === 'cm') return formatNumber(n / IN_TO_CM, '"', '');
        if (fu === 'lb') return formatNumber(n * LB_TO_KG, 'kg', space);
        if (fu === 'kg') return formatNumber(n / LB_TO_KG, 'lb', space);
        if (fu === 'oz') return formatNumber(n * OZ_TO_G, 'g', space);
        if (fu === 'g') return formatNumber(n / OZ_TO_G, 'oz', space);

        return null;
      }

      // Process all table cells
      const convertibles = table.querySelectorAll('.size-guide-unit-convertible');
      convertibles.forEach((convertible) => {
        // Store original unit
        if (!convertible.dataset.originalContent) {
          convertible.dataset.originalContent = convertible.textContent;
        }

        // Convert and display
        const converted = convertSingle(
          convertible.dataset.number,
          convertible.dataset.unit,
          unit,
          convertible.dataset.space
        );

        if (converted !== null) {
          convertible.textContent = converted;
        }
      });
    }
  }

  customElements.define('size-guide', SizeGuide);
}
