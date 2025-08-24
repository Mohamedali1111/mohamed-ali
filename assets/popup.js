/**
 * Gift Guide Product Modal - Production Ready Implementation
 * Features: Modal management, variant selection, add to cart with bonus product logic
 * Special: Auto-adds bonus product when Color=Black AND Size=Medium
 * 
 * DOM Structure Expected:
 * - Section wrapper: .grid-six-products[data-bonus-handle]
 * - Product tiles: .gg-product-tile[data-product-handle]
 * - Modal: [data-gg-modal]
 * - Modal elements: [data-gg-title], [data-gg-price], [data-gg-image], [data-gg-description]
 * - Form: [data-gg-form], submit button: [data-gg-submit]
 */

class GiftGuideModal {
  constructor() {
    this.modal = null;
    this.currentProduct = null;
    this.bonusHandle = null;
    this.variantMap = new Map();
    this.section = null;
    this.focusableElements = [];
    this.lastFocusedElement = null;
    
    this.init();
  }

  init() {
    // Find the grid section and get bonus handle
    this.section = document.querySelector('.grid-six-products');
    if (!this.section) {
      console.error('GiftGuideModal: Grid section not found');
      return;
    }

    this.bonusHandle = this.section.dataset.bonusHandle || 'dark-winter-jacket';
    this.modal = document.querySelector('[data-gg-modal]');
    
    if (!this.modal) {
      console.error('GiftGuideModal: Modal not found');
      return;
    }

    this.bindEvents();
    this.setupFocusTrap();
  }

  bindEvents() {
    // Product tile clicks
    const productTiles = this.section.querySelectorAll('.gg-product-tile');
    productTiles.forEach(tile => {
      tile.addEventListener('click', (e) => {
        const handle = tile.dataset.productHandle;
        if (handle) {
          this.openModal(handle);
        }
      });
    });

    // Modal close events
    const closeBtn = this.modal.querySelector('[data-gg-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    // Backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.closeModal();
      }
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isModalOpen()) {
        this.closeModal();
      }
    });

    // Form submission
    const form = this.modal.querySelector('[data-gg-form]');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddToCart(e));
    }
  }

  setupFocusTrap() {
    // Get all focusable elements in modal
    this.focusableElements = this.modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    // Handle tab key navigation
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.handleTabNavigation(e);
      }
    });
  }

  handleTabNavigation(e) {
    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  async openModal(handle) {
    try {
      this.showLoadingState();
      await this.loadProduct(handle);
      this.showModal();
    } catch (error) {
      console.error('Error opening modal:', error);
      this.showError('Failed to load product. Please try again.');
    } finally {
      this.hideLoadingState();
    }
  }

  async loadProduct(handle) {
    try {
      // Use the .js endpoint as specified
      const response = await fetch(`/products/${handle}.js`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const product = await response.json();
      this.currentProduct = product;
      this.buildVariantMap(product);
      this.populateModal(product);
      
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  buildVariantMap(product) {
    this.variantMap.clear();
    
    if (!product.variants || product.variants.length === 0) return;

    product.variants.forEach(variant => {
      const key = this.buildVariantKey(variant);
      this.variantMap.set(key, variant);
    });
  }

  buildVariantKey(variant) {
    const options = [
      variant.option1 || '',
      variant.option2 || '',
      variant.option3 || ''
    ];
    
    return options.map(opt => (opt || '').toLowerCase()).join('|');
  }

  populateModal(product) {
    // Set basic product info
    this.setElementText('[data-gg-title]', product.title);
    this.setElementText('[data-gg-description]', this.stripHtml(product.body_html || ''));
    
    // Set image
    const imageElement = this.modal.querySelector('[data-gg-image]');
    if (imageElement && product.featured_image) {
      imageElement.src = product.featured_image;
      imageElement.alt = product.title;
    }

    // Set initial price from first variant
    if (product.variants && product.variants.length > 0) {
      const firstVariant = product.variants[0];
      this.updatePrice(firstVariant.price);
    }

    // Build variant selectors
    this.buildVariantSelectors(product);
  }

  setElementText(selector, text) {
    const element = this.modal.querySelector(selector);
    if (element) {
      element.textContent = text;
    }
  }

  stripHtml(html) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  updatePrice(price) {
    const priceElement = this.modal.querySelector('[data-gg-price]');
    if (priceElement) {
      priceElement.textContent = this.formatPrice(price);
    }
  }

  formatPrice(price) {
    // Use Shopify.formatMoney if available, otherwise fallback
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(price);
    }
    
    // Fallback formatting
    const dollars = (price / 100).toFixed(2);
    return `$${dollars}`;
  }

  buildVariantSelectors(product) {
    const container = this.modal.querySelector('#variantSelectors');
    if (!container) return;

    container.innerHTML = '';

    if (!product.options || product.options.length === 0) return;

    product.options.forEach((option, index) => {
      const optionName = option.name;
      const optionValues = option.values;
      
      if (optionValues.length <= 1) return;

      const group = document.createElement('div');
      group.className = 'variant-group';

      const label = document.createElement('label');
      label.className = 'variant-label';
      label.textContent = optionName;
      label.setAttribute('for', `variant-${index}`);

      const select = document.createElement('select');
      select.className = 'variant-select gg-option';
      select.id = `variant-${index}`;
      select.name = `option${index + 1}`;
      select.setAttribute('data-option-position', index + 1);

      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = `Choose ${optionName}`;
      select.appendChild(defaultOption);

      // Add variant options
      optionValues.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      // Set default to first available value
      if (optionValues.length > 0) {
        select.value = optionValues[0];
      }

      // Add change listener for price updates
      select.addEventListener('change', () => this.handleOptionChange());

      group.appendChild(label);
      group.appendChild(select);
      container.appendChild(group);
    });

    // Trigger initial price update
    this.handleOptionChange();
  }

  handleOptionChange() {
    const variant = this.getSelectedVariant();
    if (variant) {
      this.updatePrice(variant.price);
    }
  }

  getSelectedVariant() {
    if (!this.currentProduct) return null;

    const selects = this.modal.querySelectorAll('.gg-option');
    const selectedOptions = [];

    selects.forEach(select => {
      const position = parseInt(select.dataset.optionPosition);
      const value = select.value;
      
      if (value) {
        selectedOptions[position - 1] = value;
      }
    });

    // Build the variant key
    const key = selectedOptions.map(opt => (opt || '').toLowerCase()).join('|');
    
    return this.variantMap.get(key);
  }

  shouldAddBonusProduct(selectedOptions) {
    if (!selectedOptions) return false;
    
    // Check if Color=Black AND Size=Medium (case-insensitive)
    const hasBlackColor = selectedOptions.some(value => 
      value && value.toLowerCase().includes('black')
    );
    
    const hasMediumSize = selectedOptions.some(value => 
      value && value.toLowerCase().includes('medium')
    );
    
    return hasBlackColor && hasMediumSize;
  }

  async handleAddToCart(e) {
    e.preventDefault();
    
    try {
      this.showLoadingState();
      
      const variant = this.getSelectedVariant();
      if (!variant) {
        throw new Error('Please select all required options');
      }

      const cartItems = [{
        id: variant.id,
        quantity: 1
      }];

      // Check if we should add bonus product
      if (this.shouldAddBonusProduct([variant.option1, variant.option2, variant.option3])) {
        const bonusProduct = await this.fetchBonusProduct();
        if (bonusProduct && bonusProduct.variants.length > 0) {
          // Add first available variant of bonus product
          cartItems.push({
            id: bonusProduct.variants[0].id,
            quantity: 1
          });
        }
      }

      // Add to cart
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: cartItems })
      });

      if (!response.ok) {
        const responseText = await response.text();
        console.error('Add to cart failed:', responseText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Success - redirect to cart
      window.location.href = '/cart';
      
    } catch (error) {
      console.error('Error adding to cart:', error);
      this.showError('Failed to add product to cart. Please try again.');
    } finally {
      this.hideLoadingState();
    }
  }

  async fetchBonusProduct() {
    try {
      const response = await fetch(`/products/${this.bonusHandle}.js`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching bonus product:', error);
      return null;
    }
  }

  showModal() {
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Store last focused element
    this.lastFocusedElement = document.activeElement;
    
    // Focus first focusable element
    if (this.focusableElements.length > 0) {
      this.focusableElements[0].focus();
    }
  }

  closeModal() {
    this.modal.classList.remove('active');
    document.body.style.overflow = '';
    this.currentProduct = null;
    this.variantMap.clear();
    
    // Reset form
    const form = this.modal.querySelector('[data-gg-form]');
    if (form) {
      form.reset();
    }
    
    // Clear variant selectors
    const variantSelectors = this.modal.querySelector('#variantSelectors');
    if (variantSelectors) {
      variantSelectors.innerHTML = '';
    }
    
    // Restore focus
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }

  isModalOpen() {
    return this.modal.classList.contains('active');
  }

  showLoadingState() {
    const submitBtn = this.modal.querySelector('[data-gg-submit]');
    if (submitBtn) {
      const btnText = submitBtn.querySelector('.btn-text');
      const spinner = submitBtn.querySelector('.loading-spinner');
      
      if (btnText) btnText.style.display = 'none';
      if (spinner) spinner.style.display = 'block';
      submitBtn.disabled = true;
    }
  }

  hideLoadingState() {
    const submitBtn = this.modal.querySelector('[data-gg-submit]');
    if (submitBtn) {
      const btnText = submitBtn.querySelector('.btn-text');
      const spinner = submitBtn.querySelector('.loading-spinner');
      
      if (btnText) btnText.style.display = 'inline';
      if (spinner) spinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  }

  showError(message) {
    // Simple error display - could be enhanced with a toast notification
    alert(message);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new GiftGuideModal();
});
