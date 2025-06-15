import { Injectable } from '@angular/core';

export interface AnimationState {
  animatedProducts: Set<number>;
  animatedOffers: Set<number>;
  productsLoading: boolean;
  offersLoading: boolean;
}

export interface SupermarketDataState {
  products: any[];
  offerProducts: any[];
  categories: any[];
  selectedCategory: string;
  filteredProducts: any[];
  purchaseHistory: any[];
}

@Injectable({
  providedIn: 'root'
})
export class UiService {

  constructor() { }

  // === SCREEN SIZE UTILITIES ===
  
  checkScreenSize(): boolean {
    return window.innerWidth >= 992;
  }

  // === SCROLL UTILITIES ===
  setupHorizontalScroll(containerSelector: string): Array<{ element: Element; listener: EventListener }> {
    const scrollListeners: Array<{ element: Element; listener: EventListener }> = [];

    const scrollContainers = document.querySelectorAll(containerSelector);
    scrollContainers.forEach(container => {      
      const wheelListener = (e: Event) => {
        const wheelEvent = e as WheelEvent;
        if (wheelEvent.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += wheelEvent.deltaY * 8;
        }
      };
      container.addEventListener('wheel', wheelListener, { passive: false });
      scrollListeners.push({ element: container, listener: wheelListener });
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      let hasMoved = false;
      const mouseDownListener = (e: Event) => {
        const mouseEvent = e as MouseEvent;
        isDown = true;
        hasMoved = false;
        container.classList.add('active');
        startX = mouseEvent.pageX - (container as HTMLElement).offsetLeft;
        scrollLeft = container.scrollLeft;
        (container as HTMLElement).style.cursor = 'grabbing';
        (container as HTMLElement).style.userSelect = 'none';
        
        e.preventDefault();
      };

      const mouseLeaveListener = (e: Event) => {
        isDown = false;
        container.classList.remove('active');
        (container as HTMLElement).style.cursor = 'grab';
        (container as HTMLElement).style.userSelect = '';
        hasMoved = false;
      };
      //
      const mouseUpListener = (e: Event) => {
        isDown = false;
        container.classList.remove('active');
        (container as HTMLElement).style.cursor = 'grab';
        (container as HTMLElement).style.userSelect = '';
        if (hasMoved) {
          const preventClickHandler = (clickEvent: Event) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            clickEvent.stopImmediatePropagation();
          };
          const clickableElements = container.querySelectorAll('*');
          clickableElements.forEach(element => {
            element.addEventListener('click', preventClickHandler, { capture: true, once: true });
          });
          container.addEventListener('click', preventClickHandler, { capture: true, once: true });
          setTimeout(() => {
            clickableElements.forEach(element => {
              element.removeEventListener('click', preventClickHandler, { capture: true });
            });
            container.removeEventListener('click', preventClickHandler, { capture: true });
          }, 100);
        }
        
        hasMoved = false;
      };

      const mouseMoveListener = (e: Event) => {
        if (!isDown) return;
        e.preventDefault();
        const mouseEvent = e as MouseEvent;
        const x = mouseEvent.pageX - (container as HTMLElement).offsetLeft;
        const walk = (x - startX);
        if (Math.abs(walk) > 5) {
          hasMoved = true;
        }
        
        container.scrollLeft = scrollLeft - walk;
      };
      (container as HTMLElement).style.cursor = 'grab';

      container.addEventListener('mousedown', mouseDownListener);
      container.addEventListener('mouseleave', mouseLeaveListener);
      container.addEventListener('mouseup', mouseUpListener);
      container.addEventListener('mousemove', mouseMoveListener);
      scrollListeners.push({ element: container, listener: mouseDownListener });
      scrollListeners.push({ element: container, listener: mouseLeaveListener });
      scrollListeners.push({ element: container, listener: mouseUpListener });
      scrollListeners.push({ element: container, listener: mouseMoveListener });
    });
    
    return scrollListeners;
  }

  removeScrollListeners(scrollListeners: Array<{ element: Element; listener: EventListener }>): void {
    scrollListeners.forEach(({ element, listener }) => {
      element.removeEventListener('wheel', listener);
      element.removeEventListener('mousedown', listener);
      element.removeEventListener('mouseleave', listener);
      element.removeEventListener('mouseup', listener);
      element.removeEventListener('mousemove', listener);
      (element as HTMLElement).style.cursor = '';
      (element as HTMLElement).style.userSelect = '';
      element.classList.remove('active');
    });
  }

  // === CONTAINER AND ELEMENT UTILITIES ===
  
  /**
   * Get the active container element from ViewChild reference or document queries
   */
  getActiveContainer(viewChildRef?: { nativeElement: HTMLElement }): HTMLElement | null {
    // Try ViewChild reference first
    if (viewChildRef?.nativeElement) {
      const containerEl = viewChildRef.nativeElement;
      if (containerEl.offsetParent !== null) {
        return containerEl;
      }
    }
    
    // Fallback to document queries
    const mobileContainer = document.querySelector('.supermarkets-container.mobile') as HTMLElement;
    if (mobileContainer?.offsetParent !== null) {
      return mobileContainer;
    }
    
    const desktopContainer = document.querySelector('.supermarkets-container:not(.mobile)') as HTMLElement;
    return desktopContainer?.offsetParent !== null ? desktopContainer : null;
  }

  /**
   * Scroll to center a selected card within a container
   */
  scrollToSelectedCard(container: HTMLElement, selectedCard: HTMLElement): void {
    if (container.scrollWidth <= container.clientWidth) return;
    
    const containerWidth = container.clientWidth;
    const cardWidth = selectedCard.offsetWidth;
    const cardLeft = selectedCard.offsetLeft;
    
    // Calculate the scroll position to center the card
    const cardCenter = cardLeft + (cardWidth / 2);
    const containerCenter = containerWidth / 2;
    const scrollLeft = cardCenter - containerCenter;
    
    // Ensure we don't scroll beyond bounds
    const maxScroll = container.scrollWidth - containerWidth;
    const targetScroll = Math.max(0, Math.min(scrollLeft, maxScroll));
    
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }

  /**
   * Center a selected supermarket card in the container
   */
  centerSelectedItem<T extends { id: number }>(
    items: T[], 
    selectedItem: T, 
    viewChildRef?: { nativeElement: HTMLElement },
    cardSelector: string = '.supermarket-card'
  ): void {
    setTimeout(() => {
      const container = this.getActiveContainer(viewChildRef);
      if (!container) return;
      
      const selectedIndex = items.findIndex(item => item.id === selectedItem.id);
      const cards = container.querySelectorAll(cardSelector);
      
      if (selectedIndex === -1 || !cards[selectedIndex]) return;
      
      this.scrollToSelectedCard(container, cards[selectedIndex] as HTMLElement);
    }, 100);
  }

  // === MODAL AND UI UTILITIES ===
  
  openModal(modalElement: any, resetCallback?: () => void): void {
    if (resetCallback) {
      resetCallback();
    }
    setTimeout(() => {
      if (modalElement) {
        modalElement.isOpen = true;
      }
    }, 100);
  }

  closeModal(modalElement: any, clearCallback?: () => void): void {
    if (modalElement) {
      modalElement.isOpen = false;
    }
    if (clearCallback) {
      clearCallback();
    }
  }  // === LOADING STATE UTILITIES ===
  
  async executeWithLoading<T>(
    loadingStateCallback: (loading: boolean) => void,
    asyncOperation: () => Promise<T>
  ): Promise<T | null> {
    loadingStateCallback(true);
    try {
      return await asyncOperation();
    } catch (error) {
      console.error('Operation failed:', error);
      return null;
    } finally {
      loadingStateCallback(false);
    }
  }

  // === ANIMATION UTILITIES (moved from AnimationService) ===

  /**
   * Reset all animation states
   */
  resetAnimations(state: AnimationState): void {
    state.animatedProducts.clear();
    state.animatedOffers.clear();
    state.productsLoading = false;
    state.offersLoading = false;
  }

  /**
   * Start offer products animation
   */
  startOffersAnimation(offerProducts: any[], state: AnimationState): void {
    if (offerProducts.length === 0) return;
    
    state.offersLoading = true;
    offerProducts.forEach((product, index) => {
      setTimeout(() => {
        state.animatedOffers.add(product.id);
        if (index === offerProducts.length - 1) {
          state.offersLoading = false;
        }
      }, index * 60);
    });
  }

  /**
   * Start products animation with optional delay from offers
   */
  startProductsAnimation(filteredProducts: any[], offerProducts: any[], state: AnimationState): void {
    if (filteredProducts.length === 0) return;
    
    const offerDelay = offerProducts.length > 0 ? offerProducts.length * 60 + 120 : 0;
    state.productsLoading = true;
    
    filteredProducts.forEach((product, index) => {
      setTimeout(() => {
        state.animatedProducts.add(product.id);
        if (index === filteredProducts.length - 1) {
          state.productsLoading = false;
        }
      }, offerDelay + index * 50);
    });
  }

  /**
   * Start all product animations (offers + products)
   */
  startAllProductAnimations(filteredProducts: any[], offerProducts: any[], state: AnimationState): void {
    this.startOffersAnimation(offerProducts, state);
    this.startProductsAnimation(filteredProducts, offerProducts, state);
  }

  /**
   * Start category filter animations
   */
  startCategoryAnimation(filteredProducts: any[], state: AnimationState): void {
    state.animatedProducts.clear();
    filteredProducts.forEach((product, index) => {
      setTimeout(() => state.animatedProducts.add(product.id), index * 30);
    });
  }

  /**
   * Check if product is animated
   */
  isProductAnimated(productId: number, state: AnimationState): boolean {
    return state.animatedProducts.has(productId);
  }

  /**
   * Check if offer is animated
   */
  isOfferAnimated(productId: number, state: AnimationState): boolean {
    return state.animatedOffers.has(productId);
  }

  /**
   * Create initial animation state
   */
  createAnimationState(): AnimationState {
    return {
      animatedProducts: new Set<number>(),
      animatedOffers: new Set<number>(),
      productsLoading: false,
      offersLoading: false
    };
  }

  // === SUPERMARKET DATA UTILITIES (moved from SupermarketDataService) ===

  /**
   * Create initial supermarket data state
   */
  createDataState(): SupermarketDataState {
    return {
      products: [],
      offerProducts: [],
      categories: [],
      selectedCategory: '',
      filteredProducts: [],
      purchaseHistory: []
    };
  }

  /**
   * Clear all supermarket-related data
   */
  clearSupermarketData(state: SupermarketDataState): void {
    state.products = [];
    state.offerProducts = [];
    state.categories = [];
    state.selectedCategory = '';
    state.filteredProducts = [];
  }

  /**
   * Update products and filtered products
   */
  updateProducts(state: SupermarketDataState, products: any[]): void {
    state.products = products;
    state.filteredProducts = [...products];
  }

  /**
   * Update offer products
   */
  updateOfferProducts(state: SupermarketDataState, offerProducts: any[]): void {
    state.offerProducts = offerProducts;
  }

  /**
   * Update categories
   */
  updateCategories(state: SupermarketDataState, categories: any[]): void {
    state.categories = categories;
  }

  /**
   * Update filtered products based on category
   */
  updateFilteredProducts(state: SupermarketDataState, filteredProducts: any[]): void {
    state.filteredProducts = filteredProducts;
  }

  /**
   * Update purchase history
   */
  updatePurchaseHistory(state: SupermarketDataState, purchaseHistory: any[]): void {
    state.purchaseHistory = purchaseHistory;
  }

  /**
   * Set selected category
   */
  setSelectedCategory(state: SupermarketDataState, categoryName: string): void {
    state.selectedCategory = categoryName;
  }
}
