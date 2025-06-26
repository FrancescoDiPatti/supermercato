import { Injectable } from '@angular/core';

export interface AnimationState {
  animatedProducts: Set<number>;
  animatedOffers: Set<number>;
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
    if (scrollContainers.length === 0) {
      return scrollListeners;
    }
    scrollContainers.forEach(container => {
      const element = container as HTMLElement;
      if (!element.offsetParent || element.scrollWidth <= element.clientWidth) {
        return;
      }
      const wheelListener = this.createWheelListener(container);
      container.addEventListener('wheel', wheelListener, { passive: false });
      scrollListeners.push({ element: container, listener: wheelListener });
      const dragState = this.createDragState();
      const mouseListeners = this.createMouseListeners(container, element, dragState);
      element.style.cursor = 'grab';
      container.addEventListener('mousedown', mouseListeners.mouseDown);
      container.addEventListener('mouseleave', mouseListeners.mouseLeave);
      container.addEventListener('mouseup', mouseListeners.mouseUp);
      container.addEventListener('mousemove', mouseListeners.mouseMove);
      scrollListeners.push(
        { element: container, listener: mouseListeners.mouseDown },
        { element: container, listener: mouseListeners.mouseLeave },
        { element: container, listener: mouseListeners.mouseUp },
        { element: container, listener: mouseListeners.mouseMove }
      );
    });
    return scrollListeners;
  }

  private createWheelListener(container: Element): EventListener {
    return (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += wheelEvent.deltaY * 8;
      }
    };
  }

  private createDragState() {
    return {
      isDown: false,
      startX: 0,
      scrollLeft: 0,
      hasMoved: false
    };
  }

  private createMouseListeners(container: Element, element: HTMLElement, dragState: any) {
    const mouseDown = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      dragState.isDown = true;
      dragState.hasMoved = false;
      container.classList.add('active');
      dragState.startX = mouseEvent.pageX - element.offsetLeft;
      dragState.scrollLeft = container.scrollLeft;
      element.style.cursor = 'grabbing';
      element.style.userSelect = 'none';
      e.preventDefault();
    };
    const mouseLeave = () => {
      this.resetDragState(container, element, dragState);
    };
    const mouseUp = () => {
      if (!dragState.isDown) return;
      this.resetDragState(container, element, dragState);
      if (dragState.hasMoved) {
        this.preventClicksAfterDrag(container);
      }
      dragState.hasMoved = false;
    };
    const mouseMove = (e: Event) => {
      if (!dragState.isDown) return;
      e.preventDefault();
      const mouseEvent = e as MouseEvent;
      const x = mouseEvent.pageX - element.offsetLeft;
      const walk = x - dragState.startX;
      if (Math.abs(walk) > 5) {
        dragState.hasMoved = true;
      }
      container.scrollLeft = dragState.scrollLeft - walk;
    };
    return { mouseDown, mouseLeave, mouseUp, mouseMove };
  }

  private resetDragState(container: Element, element: HTMLElement, dragState: any): void {
    dragState.isDown = false;
    container.classList.remove('active');
    element.style.cursor = 'grab';
    element.style.userSelect = '';
  }

  private preventClicksAfterDrag(container: Element): void {
    const preventClickHandler = (clickEvent: Event) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      clickEvent.stopImmediatePropagation();
    };
    const clickableElements = container.querySelectorAll('*');
    clickableElements.forEach(el => {
      el.addEventListener('click', preventClickHandler, { capture: true, once: true });
    });
    container.addEventListener('click', preventClickHandler, { capture: true, once: true });
    setTimeout(() => {
      clickableElements.forEach(el => {
        el.removeEventListener('click', preventClickHandler, { capture: true });
      });
      container.removeEventListener('click', preventClickHandler, { capture: true });
    }, 100);
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
  }

  /**
   * Start offer products animation
   */
  startOffersAnimation(offerProducts: any[], state: AnimationState): void {
    if (offerProducts.length === 0) return;
    
    offerProducts.forEach((product, index) => {
      setTimeout(() => {
        state.animatedOffers.add(product.id);
      }, index * 60);
    });
  }

  /**
   * Start products animation with optional delay from offers
   */
  startProductsAnimation(filteredProducts: any[], offerProducts: any[], state: AnimationState): void {
    if (filteredProducts.length === 0) return;
    
    const offerDelay = offerProducts.length > 0 ? offerProducts.length * 60 + 120 : 0;
    
    filteredProducts.forEach((product, index) => {
      setTimeout(() => {
        state.animatedProducts.add(product.id);
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
   * Create initial animation state
   */
  createAnimationState(): AnimationState {
    return {
      animatedProducts: new Set<number>(),
      animatedOffers: new Set<number>()
    };
  }

  // === SUPERMARKET DATA ===

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
