import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

// Exported interfaces

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

// Constants

const SERVER_OFFSET_HOURS = 2;
const QUANTITY_UPDATE_INTERVAL = 100;
const DEFAULT_MAX_QUANTITY = 1000;

const MULTIPLIER_STEPS: MultiplierStep[] = [
  { threshold: 0, multiplier: 1 },
  { threshold: 2000, multiplier: 2 },
  { threshold: 4000, multiplier: 5 },
  { threshold: 6000, multiplier: 10 },
];

@Injectable({
  providedIn: 'root'
})
export class UiService {

  private timer: any = null;
  private activeBarcode: string | null = null;
  private readonly interval = QUANTITY_UPDATE_INTERVAL;
  private readonly multiplierSteps = MULTIPLIER_STEPS;
  private readonly serverOffsetHours = SERVER_OFFSET_HOURS;
  private readonly storageKey = 'inventoryData';
  private inventoryData = new BehaviorSubject<InventoryItem[]>([]);

  constructor() { 
    this.loadInventoryFromStorage();
  }

  // PUBLIC METHODS

  // Update product quantity
  updateInventoryFromProducts(products: any[], supermarketId: number): void {
    const currentInventory = [...this.inventoryData.value];
    const filteredInventory = currentInventory.filter(item => item.supermarketId !== supermarketId);
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

  // Available quantity for supermarket
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

  // Available quantity for single product
  getAvailableQuantity(barcode: string, supermarketId: number): number {
    const inventory = this.inventoryData.value;
    const item = inventory.find(item => 
      item.barcode === barcode && item.supermarketId === supermarketId
    );
    return item ? item.availableQuantity : 0;
  }

  // Reduce quantity after purchase
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

  // Check if quantity is available
  isQuantityAvailable(barcode: string, supermarketId: number, requestedQuantity: number): boolean {
    const availableQty = this.getAvailableQuantity(barcode, supermarketId);
    return requestedQuantity <= availableQty;
  }

  // QUANTITY UTILITIES

  // Calculate multiplier by time
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

  // Update product quantity with limits
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
      : DEFAULT_MAX_QUANTITY;
    const newQty = Math.max(0, Math.min(maxQty, currentQty + amount));
    const limitReached = amount > 0 && newQty === maxQty && currentQty + amount > maxQty;

    if (newQty !== quantities[barcode]) {
      quantities[barcode] = newQty;
    }
    return { newQuantity: newQty, quantities, limitReached };
  }

  // Start quantity timer
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

  // Stop quantity timer
  clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.activeBarcode = null;
    }
  }

  // SCROLL UTILITIES

  // Setup horizontal scroll with mouse drag and wheel
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

  // Remove scroll listeners
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

  // CONTAINER UTILITIES

  // Get the active container element from ViewChild
  getActiveContainer(viewChildRef?: { nativeElement: HTMLElement }): HTMLElement | null {
    if (viewChildRef?.nativeElement) {
      const containerEl = viewChildRef.nativeElement;
      if (containerEl.offsetParent !== null) {
        return containerEl;
      }
    }
    
    const mobileContainer = document.querySelector('.supermarkets-container.mobile') as HTMLElement;
    if (mobileContainer?.offsetParent !== null) {
      return mobileContainer;
    }
    
    const desktopContainer = document.querySelector('.supermarkets-container:not(.mobile)') as HTMLElement;
    return desktopContainer?.offsetParent !== null ? desktopContainer : null;
  }

  // Scroll to center selected card
  scrollToSelectedCard(container: HTMLElement, selectedCard: HTMLElement): void {
    if (container.scrollWidth <= container.clientWidth) return;
    const containerWidth = container.clientWidth;
    const cardWidth = selectedCard.offsetWidth;
    const cardLeft = selectedCard.offsetLeft;
    const cardCenter = cardLeft + (cardWidth / 2);
    const containerCenter = containerWidth / 2;
    const scrollLeft = cardCenter - containerCenter;
    const maxScroll = container.scrollWidth - containerWidth;
    const targetScroll = Math.max(0, Math.min(scrollLeft, maxScroll));
    
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });
  }

  // Center selected supermarket card
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
  
  // LOADING UTILITIES
  
  // Async operation with loading state
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

  // ANIMATION UTILITIES

  // Show all products
  showAllProducts(filteredProducts: any[], offerProducts: any[], state: AnimationState): void {
    offerProducts.forEach(product => {
      state.animatedOffers.add(product.id);
    });
    
    filteredProducts.forEach(product => {
      state.animatedProducts.add(product.id);
    });
  }

  // Show category products
  showCategoryProducts(filteredProducts: any[], state: AnimationState): void {
    state.animatedProducts.clear();
    filteredProducts.forEach(product => {
      state.animatedProducts.add(product.id);
    });
  }

  // Reset all animation
  resetAnimations(state: AnimationState): void {
    state.animatedProducts.clear();
    state.animatedOffers.clear();
  }

  // Create initial animation
  createAnimationState(): AnimationState {
    return {
      animatedProducts: new Set<number>(),
      animatedOffers: new Set<number>()
    };
  }

  // SUPERMARKET DATA MANAGEMENT

  // Initial data state
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

  // Clear supermarket data
  clearSupermarketData(state: SupermarketDataState): void {
    state.products = [];
    state.offerProducts = [];
    state.categories = [];
    state.selectedCategory = '';
    state.filteredProducts = [];
  }

  // Update product
  updateProducts(state: SupermarketDataState, products: any[]): void {
    state.products = products;
    state.filteredProducts = [...products];
  }

  // Update offer
  updateOfferProducts(state: SupermarketDataState, offerProducts: any[]): void {
    state.offerProducts = offerProducts;
  }

  // Update categories
  updateCategories(state: SupermarketDataState, categories: any[]): void {
    state.categories = categories;
  }

  // Set selected category
  setSelectedCategory(state: SupermarketDataState, categoryName: string): void {
    state.selectedCategory = categoryName;
  }

  // TIME UTILITIES

  // Server date adjustment
  adjustServerDate(serverDateString: string): Date {
    const serverDate = new Date(serverDateString);
    return new Date(serverDate.getTime() + (this.serverOffsetHours * 60 * 60 * 1000));
  }

  // PRIVATE METHODS

  // Load inventory from session storage
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

  // Save inventory to session storage
  private saveInventoryToStorage(): void {
    sessionStorage.setItem(this.storageKey, JSON.stringify(this.inventoryData.value));
  }

  // Wheel event listener horizontal scroll
  private createWheelListener(container: Element): EventListener {
    return (e: Event) => {
      const wheelEvent = e as WheelEvent;
      if (wheelEvent.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += wheelEvent.deltaY * 8;
      }
    };
  }

  // Mouse drag state init
  private createDragState() {
    return {
      isDown: false,
      startX: 0,
      scrollLeft: 0,
      hasMoved: false
    };
  }

  // Mouse event listeners for scrolling
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

  // Reset mouse drag state
  private resetDragState(container: Element, element: HTMLElement, dragState: any): void {
    dragState.isDown = false;
    container.classList.remove('active');
    element.style.cursor = 'grab';
    element.style.userSelect = '';
  }

  // Prevent clicks after drag
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
}
