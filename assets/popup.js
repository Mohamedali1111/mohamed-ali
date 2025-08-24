/**
 * Product Modal and Add to Cart Functionality
 * Features: Modal management, variant selection, add to cart with bonus product logic
 * Special: Auto-adds bonus product when Color=Black AND Size=Medium
 */

class ProductModal {
  constructor() {
    this.modal = document.getElementById('productModal');
    this.currentProduct = null;
    this.bonusHandle = null;
    this.init();
  }

  init() {
    // Get bonus handle from section data attribute
    const section = document.querySelector('.grid-six-products');
    if (section) {
      this.bonusHandle = section.dataset.bonusHandle || 'dark-winter-jacket';
    }

    // Bind event listeners
    this.bindEvents();
  }

  bindEvents() {
    // Close modal on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('active')) {
        this.close();
      }
    });

    // Prevent form submission on Enter key in select elements
    this.modal.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'SELECT') {
        e.preventDefault();
      }
    });
  }

  async open(productHandle) {
    try {
      this.showLoadingState();
      
      // Fetch product data
      const product = await this.fetchProduct(productHandle);
      if (!product) {
        throw new Error('Failed to fetch product data');
      }

      this.currentProduct = product;
      this.populateModal(product);
      this.show();
      
    } catch (error) {
      console.error('Error opening product modal:', error);
      this.showError('Failed to load product. Please try again.');
    } finally {
      this.hideLoadingState();
    }
  }

  close() {
    this.modal.classList.remove('active');
    this.currentProduct = null;
    
    // Reset form
    const form = document.getElementById('productForm');
    if (form) {
      form.reset();
    }
    
    // Clear variant selectors
    const variantSelectors = document.getElementById('variantSelectors');
    if (variantSelectors) {
      variantSelectors.innerHTML = '';
    }
  }

  show() {
    this.modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Focus first focusable element
    const firstFocusable = this.modal.querySelector('button, select, input');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  async fetchProduct(handle) {
    try {
      const response = await fetch(`/products/${handle}.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.product;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  populateModal(product) {
    // Set basic product info
    document.getElementById('modalTitle').textContent = product.title;
    document.getElementById('modalImage').src = product.featured_image || '';
    document.getElementById('modalImage').alt = product.title;
    document.getElementById('modalDescription').textContent = this.stripHtml(product.body_html || '');
    document.getElementById('modalPrice').textContent = this.formatMoney(product.price);

    // Build variant selectors
    this.buildVariantSelectors(product);
  }

  stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }

  formatMoney(cents) {
    // Use Shopify.formatMoney if available, otherwise fallback
    if (typeof Shopify !== 'undefined' && Shopify.formatMoney) {
      return Shopify.formatMoney(cents);
    }
    
    // Fallback formatting
    const dollars = (cents / 100).toFixed(2);
    return `$${dollars}`;
  }

  buildVariantSelectors(product) {
    const container = document.getElementById('variantSelectors');
    container.innerHTML = '';

    if (!product.options || product.options.length === 0) {
      return;
    }

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
      select.className = 'variant-select';
      select.id = `variant-${index}`;
      select.name = `option${index + 1}`;
      select.setAttribute('data-option-index', index);

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

      group.appendChild(label);
      group.appendChild(select);
      container.appendChild(group);
    });
  }

  getSelectedVariant() {
    if (!this.currentProduct) return null;

    const selects = this.modal.querySelectorAll('.variant-select');
    const selectedOptions = {};

    selects.forEach(select => {
      const optionIndex = parseInt(select.dataset.optionIndex);
      const optionName = `option${optionIndex + 1}`;
      selectedOptions[optionName] = select.value;
    });

    // Find matching variant
    const variant = this.currentProduct.variants.find(v => {
      return Object.keys(selectedOptions).every(key => {
        return !selectedOptions[key] || v[key] === selectedOptions[key];
      });
    });

    return variant;
  }

  shouldAddBonusProduct(selectedOptions) {
    if (!selectedOptions) return false;
    
    // Check if Color=Black AND Size=Medium (case-insensitive)
    const hasBlackColor = Object.values(selectedOptions).some(value => 
      value && value.toLowerCase().includes('black')
    );
    
    const hasMediumSize = Object.values(selectedOptions).some(value => 
      value && value.toLowerCase().includes('medium')
    );
    
    return hasBlackColor && hasMediumSize;
  }

  async addToCart(event) {
    event.preventDefault();
    
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
      if (this.shouldAddBonusProduct(variant)) {
        const bonusProduct = await this.fetchProduct(this.bonusHandle);
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

  showLoadingState() {
    const btn = document.getElementById('addToCartBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.loading-spinner');
    
    btn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'block';
  }

  hideLoadingState() {
    const btn = document.getElementById('addToCartBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.loading-spinner');
    
    btn.disabled = false;
    btnText.style.display = 'inline';
    spinner.style.display = 'none';
  }

  showError(message) {
    // Simple error display - could be enhanced with a toast notification
    alert(message);
  }
}

// Global functions for onclick handlers
let productModal;

function openProductModal(handle) {
  if (!productModal) {
    productModal = new ProductModal();
  }
  productModal.open(handle);
}

function closeProductModal() {
  if (productModal) {
    productModal.close();
  }
}

function addToCart(event) {
  if (productModal) {
    productModal.addToCart(event);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  productModal = new ProductModal();
});
