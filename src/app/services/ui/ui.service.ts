import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface MultiplierStep {
  threshold: number;
  multiplier: number;
}

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

export interface InventoryItem {
  barcode: string;
  supermarketId: number;
  availableQuantity: number;
  productId: number;
  productName: string;
}

@Injectable({
  providedIn: 'root'
})
export class UiService {

  private timer: any = null;
  private activeBarcode: string | null = null;
  private readonly interval = 100;
  private readonly multiplierSteps: MultiplierStep[] = [
    { threshold: 0, multiplier: 1 },
    { threshold: 2000, multiplier: 2 },
    { threshold: 4000, multiplier: 5 },
    { threshold: 6000, multiplier: 10 },
  ];

  // === TIME MANAGEMENT ===
  // Il server è indietro di 2 ore rispetto al client
  private readonly SERVER_OFFSET_HOURS = 2;

  // === INVENTORY MANAGEMENT ===
  private readonly storageKey = 'inventoryData';
  private inventoryData = new BehaviorSubject<InventoryItem[]>([]);
  public inventoryData$ = this.inventoryData.asObservable();

  constructor() { 
    this.loadInventoryFromStorage();
  }

  // === INVENTORY METHODS ===
  private loadInventoryFromStorage(): void {
    const data = sessionStorage.getItem(this.storageKey);
    if (data) {
      try {
        const inventory = JSON.parse(data);
        this.inventoryData.next(inventory);
      } catch (error) {
        console.error('Error loading inventory from storage:', error);
      }
    }
  }

  private saveInventoryToStorage(): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify(this.inventoryData.value));
  }

  /**
   * Aggiorna le quantità disponibili da una lista di prodotti
   */
  updateInventoryFromProducts(products: any[], supermarketId: number): void {
    const currentInventory = [...this.inventoryData.value];
    
    // Rimuovi elementi esistenti per questo supermercato
    const filteredInventory = currentInventory.filter(item => item.supermarketId !== supermarketId);
    
    // Aggiungi nuovi elementi
    const newInventoryItems = products
      .filter((product: any) => product.barcode && product.quantity !== undefined)
      .map((product: any) => ({
        barcode: product.barcode,
        supermarketId: supermarketId,
        availableQuantity: Math.max(0, product.quantity || 0),
        productId: product.id,
        productName: product.name
      }));
    
    const updatedInventory = [...filteredInventory, ...newInventoryItems];
    this.inventoryData.next(updatedInventory);
    this.saveInventoryToStorage();
  }

  /**
   * Ottiene le quantità disponibili per un supermercato specifico
   */
  getAvailableQuantities(supermarketId: number): { [barcode: string]: number } {
    const inventory = this.inventoryData.value;
    const quantities: { [barcode: string]: number } = {};
    
    inventory
      .filter(item => item.supermarketId === supermarketId)
      .forEach(item => {
        quantities[item.barcode] = item.availableQuantity;
      });
    
    return quantities;
  }

  /**
   * Ottiene la quantità disponibile per un prodotto specifico
   */
  getAvailableQuantity(barcode: string, supermarketId: number): number {
    const inventory = this.inventoryData.value;
    const item = inventory.find(item => 
      item.barcode === barcode && item.supermarketId === supermarketId
    );
    return item ? item.availableQuantity : 0;
  }

  /**
   * Riduce la quantità disponibile dopo un acquisto
   */
  reduceQuantity(barcode: string, supermarketId: number, purchasedQuantity: number): void {
    const currentInventory = [...this.inventoryData.value];
    const itemIndex = currentInventory.findIndex(item => 
      item.barcode === barcode && item.supermarketId === supermarketId
    );
    
    if (itemIndex >= 0) {
      const currentQty = currentInventory[itemIndex].availableQuantity;
      currentInventory[itemIndex].availableQuantity = Math.max(0, currentQty - purchasedQuantity);
      this.inventoryData.next(currentInventory);
      this.saveInventoryToStorage();
    }
  }

  /**
   * Verifica se una quantità è disponibile
   */
  isQuantityAvailable(barcode: string, supermarketId: number, requestedQuantity: number): boolean {
    const availableQty = this.getAvailableQuantity(barcode, supermarketId);
    return requestedQuantity <= availableQty;
  }

  /**
   * Ottiene la quantità massima che può essere aggiunta al carrello
   */
  getMaxAddableQuantity(barcode: string, supermarketId: number, currentCartQuantity: number = 0): number {
    const availableQty = this.getAvailableQuantity(barcode, supermarketId);
    return Math.max(0, availableQty - currentCartQuantity);
  }

  /**
   * Resetta l'inventario (per testing o admin)
   */
  clearInventory(): void {
    this.inventoryData.next([]);
    sessionStorage.removeItem(this.storageKey);
  }

  /**
   * Ottiene tutti gli elementi dell'inventario
   */
  getAllInventoryItems(): InventoryItem[] {
    return this.inventoryData.value;
  }

  /**
   * Aggiorna singolo item dell'inventario
   */
  updateInventoryItem(barcode: string, supermarketId: number, newQuantity: number): void {
    const currentInventory = [...this.inventoryData.value];
    const itemIndex = currentInventory.findIndex(item => 
      item.barcode === barcode && item.supermarketId === supermarketId
    );
    
    if (itemIndex >= 0) {
      currentInventory[itemIndex].availableQuantity = Math.max(0, newQuantity);
      this.inventoryData.next(currentInventory);
      this.saveInventoryToStorage();
    }
  }

  // === QUANTITY MANAGEMENT ===
  private getMultiplier(elapsed: number): number {
    let selectedStep = this.multiplierSteps[0];
    for (let i = this.multiplierSteps.length - 1; i >= 0; i--) {
      if (elapsed >= this.multiplierSteps[i].threshold) {
        selectedStep = this.multiplierSteps[i];
        break;
      }
    }
    return selectedStep.multiplier;
  }

  updateQuantity(
    currentQuantities: { [barcode: string]: number }, 
    barcode: string, 
    amount: number,
    availableQuantities?: { [barcode: string]: number }
  ): { newQuantity: number, quantities: { [barcode: string]: number }, limitReached?: boolean } {
    const quantities = { ...currentQuantities };
    const currentQty = quantities[barcode] || 0;
    const maxQty = availableQuantities && availableQuantities[barcode] !== undefined 
      ? availableQuantities[barcode] 
      : 1000; // Default fallback limit
    
    const newQty = Math.max(0, Math.min(maxQty, currentQty + amount));
    const limitReached = amount > 0 && newQty === maxQty && currentQty + amount > maxQty;
    
    if (newQty !== quantities[barcode]) {
      quantities[barcode] = newQty;
    }
    return { newQuantity: newQty, quantities, limitReached };
  }

  startTimer(barcode: string, isIncrement: boolean, onUpdate: (barcode: string, amount: number) => void): void {
    this.clearTimer();
    this.activeBarcode = barcode;
    const startTime = Date.now();

    this.timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const multiplier = this.getMultiplier(elapsed);
      const amount = (isIncrement ? 1 : -1) * multiplier;
      onUpdate(barcode, amount);
    }, this.interval);
  }

  clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.activeBarcode = null;
    }
  }

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

  // === TIME UTILITIES ===

  /**
   * Converte una data dal server aggiungendo 2 ore per l'ora locale
   */
  adjustServerDate(serverDateString: string): Date {
    const serverDate = new Date(serverDateString);
    return new Date(serverDate.getTime() + (this.SERVER_OFFSET_HOURS * 60 * 60 * 1000));
  }

  /**
   * Formatta una data del server in formato breve italiano (dd/mm/yyyy)
   */
  formatServerDateShort(serverDateString: string): string {
    const adjustedDate = this.adjustServerDate(serverDateString);
    return adjustedDate.toLocaleDateString('it-IT');
  }

  /**
   * Formatta una data del server con ora completa
   */
  formatServerDate(serverDateString: string, options: Intl.DateTimeFormatOptions = {}): string {
    const adjustedDate = this.adjustServerDate(serverDateString);
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };
    return adjustedDate.toLocaleDateString('it-IT', defaultOptions);
  }
}
