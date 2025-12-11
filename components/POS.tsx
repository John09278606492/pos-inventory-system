
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Product, CartItem, Sale, User, Customer, ReturnTransaction, ReturnItem, HoldTransaction, StoreSettings, CreditTerm, CreditAdjustment } from '../types';
import { Search, ShoppingCart, Minus, Plus, Trash2, CreditCard, Banknote, Smartphone, User as UserIcon, History, X, UserPlus, Calendar, Tag, Package, ChevronRight, RotateCcw, Wallet, Receipt, AlertCircle, Printer, CheckCircle, FileText, Settings, Footprints, PauseCircle, PlayCircle, Clock, Trash, Crown, ArrowRight, Percent, ChevronDown } from 'lucide-react';

export interface POSRef {
    triggerHold: () => void;
}

interface POSProps {
  products: Product[];
  onCompleteSale: (sale: Sale) => void;
  currentUser: User;
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  sales: Sale[];
  returns: ReturnTransaction[];
  onProcessReturn: (ret: ReturnTransaction) => void;
  heldTransactions: HoldTransaction[];
  onHoldTransaction: (hold: HoldTransaction) => void;
  onResumeHold: (holdId: string) => void;
  onVoidHold: (holdId: string) => void;
  currency: string;
  showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO') => void;
  storeSettings: StoreSettings;
  onCartUpdate: (hasItems: boolean) => void;
  resumeHoldId?: string | null;
  onClearResumeHold?: () => void;
  onAddCreditAdjustment?: (adj: CreditAdjustment) => void;
}

// Simple Barcode Component for Visual Representation
const SimpleBarcode = ({ value }: { value: string }) => {
    // Generates a visual barcode pattern based on the input string
    const bars = [];
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    
    // Deterministic pseudo-random based on hash
    const seededRandom = () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };

    // Generate 30 bars
    for(let i=0; i<30; i++) {
        const r = seededRandom();
        let w = 2; // Default width
        if (r > 0.66) w = 4; // Thick
        else if (r < 0.33) w = 1; // Thin
        
        bars.push(w);
    }

    return (
        <div className="flex flex-col items-center justify-center w-full py-2">
            <div className="flex justify-center h-12">
                {bars.map((w, i) => (
                    <div key={i} style={{ 
                        width: `${w}px`, 
                        height: '100%', 
                        backgroundColor: 'black', 
                        marginLeft: '2px', 
                        marginRight: '2px' 
                    }}></div>
                ))}
            </div>
            <div className="text-[10px] font-mono mt-1 tracking-[0.3em] uppercase">{value}</div>
        </div>
    );
};

// Fuzzy matching utility
const getMatchScore = (text: string, query: string): number => {
    const t = text.toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return 0;
    
    if (t === q) return 100; // Exact
    if (t.startsWith(q)) return 80; // Starts with
    if (t.includes(q)) return 60; // Contains
    
    // Token match (e.g. "blue shirt" matches "shirt blue")
    const tTokens = t.split(' ');
    const qTokens = q.split(' ');
    if (qTokens.length > 1) {
        const allTokensFound = qTokens.every(qt => tTokens.some(tt => tt.includes(qt)));
        if (allTokensFound) return 70;
    }

    // Subsequence match (simple fuzzy for typos/abbreviations)
    let tIdx = 0;
    let qIdx = 0;
    let matches = 0;
    while (tIdx < t.length && qIdx < q.length) {
        if (t[tIdx] === q[qIdx]) {
            qIdx++;
            matches++;
        }
        tIdx++;
    }
    // High threshold for subsequence to avoid noise
    if (q.length > 2 && matches / q.length > 0.8) return 40;

    return 0;
};

// Helper for default unique walk-in customer
const createWalkInCustomer = (): Customer => ({
    id: `walkin-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: 'Walk-in Customer',
    totalSpent: 0,
    visitCount: 0,
    storeCredit: 0,
    type: 'WALK_IN'
});

const POS = forwardRef<POSRef, POSProps>(({ 
  products, 
  onCompleteSale, 
  currentUser, 
  customers, 
  onAddCustomer, 
  sales, 
  returns,
  onProcessReturn,
  heldTransactions,
  onHoldTransaction,
  onResumeHold,
  onVoidHold,
  currency,
  showToast,
  storeSettings,
  onCartUpdate,
  resumeHoldId,
  onClearResumeHold,
  onAddCreditAdjustment
}, ref) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'DIGITAL' | 'STORE_CREDIT'>('CARD');
  
  // Search & Suggestions State
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => createWalkInCustomer());
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  // New Customer Form
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  // Account Payment (Credit) State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [accountPaymentAmount, setAccountPaymentAmount] = useState<string>('');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState<'CASH' | 'CARD' | 'DIGITAL'>('CASH');
  const [completedPayment, setCompletedPayment] = useState<CreditAdjustment | null>(null);

  // Orders & Returns State
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnItemsState, setReturnItemsState] = useState<{id: string, qty: number, restock: boolean, reason: string}[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'DIGITAL' | 'STORE_CREDIT'>('CASH');
  
  // Returns History Log State
  const [isReturnsHistoryOpen, setIsReturnsHistoryOpen] = useState(false);
  const [returnsSearchTerm, setReturnsSearchTerm] = useState('');

  // Receipt State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [printFormat, setPrintFormat] = useState<'80mm' | '58mm' | 'A4'>('80mm');

  // Cash Change State
  const [amountTendered, setAmountTendered] = useState<string>('');

  // Credit Terms State
  const [selectedCreditTermId, setSelectedCreditTermId] = useState<string>('');

  // Hold Transaction State
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isHeldListOpen, setIsHeldListOpen] = useState(false);
  const [holdDuration, setHoldDuration] = useState(30); // minutes
  const [holdNote, setHoldNote] = useState('');
  const [heldSearch, setHeldSearch] = useState('');
  const [, setTick] = useState(0);

  // Initialize selected credit term
  useEffect(() => {
      if (storeSettings.creditTerms && storeSettings.creditTerms.length > 0) {
          setSelectedCreditTermId(storeSettings.creditTerms[0].id);
      }
  }, [storeSettings.creditTerms]);

  // Expose triggerHold to parent
  useImperativeHandle(ref, () => ({
      triggerHold: () => {
          if (cart.length > 0) {
              handleHoldClick();
          }
      }
  }));

  // Resume Hold from Prop (Notification)
  useEffect(() => {
      if (resumeHoldId && onClearResumeHold) {
          const hold = heldTransactions.find(h => h.id === resumeHoldId);
          
          if (hold) {
              if (cart.length > 0) {
                  showToast("Cannot auto-resume: Current cart is not empty. Please hold or clear current items first.", 'ERROR');
              } else {
                  // Resume logic duplicated here to ensure access to scope
                  setCart(hold.items);
                  setSelectedCustomer(hold.customer);
                  onResumeHold(hold.id);
                  showToast(`Transaction for ${hold.customer.name} resumed!`, 'SUCCESS');
              }
          }
          // Clear the trigger
          onClearResumeHold();
      }
  }, [resumeHoldId, heldTransactions, cart.length, onResumeHold, onClearResumeHold, showToast]);

  // Update parent on cart status
  useEffect(() => {
      onCartUpdate(cart.length > 0);
  }, [cart, onCartUpdate]);

  const categories: string[] = ['All', ...Array.from(new Set(products.map(p => p.category))) as string[]];

  const getCurrencySymbol = (code: string) => {
    switch(code) {
      case 'PHP': return '₱';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  };
  const symbol = getCurrencySymbol(currency);
  const formatCurrency = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Timer Effect
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000); 
    return () => clearInterval(timer);
  }, []);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return; 

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
            showToast("Cannot add more than available stock.", 'ERROR');
            return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchTerm(''); 
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        let newQty = item.quantity + delta;

        // Round to avoid float precision issues
        if (item.allowDecimal) {
            newQty = Math.round(newQty * 1000) / 1000;
        }

        if (delta > 0 && newQty > item.stock) {
            return item; 
        }
        return { ...item, quantity: Math.max(item.allowDecimal ? 0.001 : 1, newQty) };
      }
      return item;
    }));
  };

  const setItemQuantity = (id: string, value: string) => {
    if (value === '') {
        setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: 0 } : item));
        return;
    }
    const qty = parseFloat(value);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        let newQty = isNaN(qty) ? 0 : qty;
        newQty = Math.min(newQty, item.stock);
        
        // Enforce integer if decimal not allowed
        if (!item.allowDecimal) {
            newQty = Math.floor(newQty);
        }

        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleInputBlur = (id: string, currentQty: number) => {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    const minQty = item.allowDecimal ? 0.001 : 1;
    if (currentQty < minQty) {
        setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: minQty } : i));
    }
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Financial Calculations based on Tax Settings
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  let calculatedTax = 0;
  let finalTotal = cartSubtotal;

  if (storeSettings.taxRate > 0) {
      if (storeSettings.taxType === 'EXCLUSIVE') {
          // Add tax on top
          calculatedTax = cartSubtotal * (storeSettings.taxRate / 100);
          finalTotal = cartSubtotal + calculatedTax;
      } else {
          // Tax included (extract it)
          calculatedTax = cartSubtotal - (cartSubtotal / (1 + storeSettings.taxRate / 100));
          finalTotal = cartSubtotal;
      }
  }

  // Credit Markup Logic (Dynamic Terms)
  let creditMarkupAmount = 0;
  let currentCreditTerm: CreditTerm | undefined;

  if (paymentMethod === 'STORE_CREDIT') {
      currentCreditTerm = storeSettings.creditTerms?.find(t => t.id === selectedCreditTermId);
      // Fallback if no term selected but array exists
      if (!currentCreditTerm && storeSettings.creditTerms?.length > 0) {
          currentCreditTerm = storeSettings.creditTerms[0];
      }

      const rate = currentCreditTerm ? currentCreditTerm.rate : (storeSettings.creditMarkupRate || 0);
      if (rate > 0) {
          creditMarkupAmount = finalTotal * (rate / 100);
      }
  }
  
  const finalPayableAmount = finalTotal + creditMarkupAmount;
  
  const tenderedNum = parseFloat(amountTendered) || 0;
  const changeDue = tenderedNum - finalPayableAmount;

  const handleCheckout = () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'CASH' && tenderedNum < finalPayableAmount) {
        showToast("Amount tendered is less than the total amount.", 'ERROR');
        return;
    }

    if (paymentMethod === 'STORE_CREDIT') {
        if (!selectedCustomer) {
            showToast("Please select a customer to use Store Credit.", 'ERROR');
            return;
        }
        if (selectedCustomer.type !== 'MEMBER') {
            showToast("Store Credit is reserved for registered Members only.", 'ERROR');
            return;
        }
        // Removed check for insufficient funds to allow debt (negative balance)
    }

    if (selectedCustomer && !customers.find(c => c.id === selectedCustomer.id)) {
        onAddCustomer(selectedCustomer);
    }

    // Profit calculation: (Revenue - Cost) + Markup Interest
    const costOfGoods = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const saleProfit = (cartSubtotal - costOfGoods) + creditMarkupAmount;

    // Calculate Due Date
    let creditDueDate = undefined;
    if (paymentMethod === 'STORE_CREDIT' && currentCreditTerm) {
        const days = currentCreditTerm.days;
        creditDueDate = Date.now() + (days * 24 * 60 * 60 * 1000);
    }

    const sale: Sale = {
      id: `sale-${Date.now()}`,
      timestamp: Date.now(),
      items: cart.map(item => ({
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        unit: item.unit,
        priceAtSale: item.price,
        costAtSale: item.cost
      })),
      
      // Financials
      subTotal: cartSubtotal,
      totalTax: calculatedTax,
      totalAmount: finalPayableAmount,
      totalProfit: saleProfit,
      
      // Snapshot Tax Settings
      taxName: storeSettings.taxName,
      taxRate: storeSettings.taxRate,
      taxType: storeSettings.taxType,

      // Snapshot Credit Markup & Terms
      creditMarkupRate: currentCreditTerm ? currentCreditTerm.rate : (storeSettings.creditMarkupRate || 0),
      creditMarkupAmount: creditMarkupAmount,
      creditTermName: currentCreditTerm ? currentCreditTerm.name : undefined,
      creditDueDate: creditDueDate,

      cashierId: currentUser.id,
      paymentMethod,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      amountTendered: paymentMethod === 'CASH' ? tenderedNum : undefined,
      change: paymentMethod === 'CASH' ? changeDue : undefined
    };

    onCompleteSale(sale);
    setCompletedSale(sale);
    setShowReceipt(true);
    setCart([]);
  };

  // --- Account Payment Logic ---
  const handleOpenAccountPayment = () => {
      if (!selectedCustomer || selectedCustomer.type !== 'MEMBER') {
          showToast("Please select a Member to accept account payment.", 'ERROR');
          return;
      }
      setIsPaymentModalOpen(true);
      setAccountPaymentAmount('');
      setAccountPaymentMethod('CASH');
  };

  const handleAccountPayment = () => {
      if (!onAddCreditAdjustment) return;
      
      const amount = parseFloat(accountPaymentAmount);
      if (isNaN(amount) || amount <= 0) {
          showToast("Please enter a valid amount.", 'ERROR');
          return;
      }

      if (!selectedCustomer) return;

      const currentBalance = selectedCustomer.storeCredit || 0;
      const newBalance = currentBalance + amount;

      const adj: CreditAdjustment = {
          id: `pay-${Date.now()}`,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: amount,
          type: 'ADD',
          paymentMethod: accountPaymentMethod,
          newBalance: newBalance,
          timestamp: Date.now(),
          userId: currentUser.id,
          userName: currentUser.name,
          reason: 'Account Payment (POS)'
      };

      onAddCreditAdjustment(adj);
      
      // Update local state immediately for UI
      setSelectedCustomer({ ...selectedCustomer, storeCredit: newBalance });
      
      // Show Receipt
      setCompletedPayment(adj);
      setShowReceipt(true);
      
      // Close Modal
      setIsPaymentModalOpen(false);
      setAccountPaymentAmount('');
  };

  const handleNewSale = () => {
      setShowReceipt(false);
      setCompletedSale(null);
      setCompletedPayment(null);
      setAmountTendered('');
      setSelectedCustomer(createWalkInCustomer());
      setCustomerSearch('');
      if (paymentMethod === 'STORE_CREDIT') setPaymentMethod('CARD');
  };

  const handlePrintReceipt = () => {
      window.print();
  };
  
  const handleCreateCustomer = () => {
      if (!newCustomerName) return;
      const newCustomer: Customer = {
          id: `c-${Date.now()}`,
          name: newCustomerName,
          email: newCustomerEmail,
          phone: newCustomerPhone,
          totalSpent: 0,
          visitCount: 0,
          storeCredit: 0,
          type: 'MEMBER'
      };
      onAddCustomer(newCustomer);
      setSelectedCustomer(newCustomer);
      setIsCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerEmail('');
      setNewCustomerPhone('');
  }

  const handleHoldClick = () => {
      if (cart.length === 0) return;
      if (selectedCustomer && selectedCustomer.type === 'MEMBER') {
          showToast("Hold transactions are not available for Member customers.", 'ERROR');
          return;
      }
      setIsHoldModalOpen(true);
  }

  const confirmHold = () => {
      if (!selectedCustomer) return;
      const hold: HoldTransaction = {
          id: `hold-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          items: [...cart],
          customer: selectedCustomer,
          timestamp: Date.now(),
          durationMinutes: holdDuration,
          expiryTime: Date.now() + (holdDuration * 60 * 1000),
          note: holdNote,
          cashierId: currentUser.id
      };
      onHoldTransaction(hold);
      setCart([]);
      setHoldNote('');
      setHoldDuration(30);
      setAmountTendered('');
      setIsHoldModalOpen(false);
      setSelectedCustomer(createWalkInCustomer());
  }

  const resumeHold = (hold: HoldTransaction) => {
      setCart(hold.items);
      setSelectedCustomer(hold.customer);
      onResumeHold(hold.id);
      setIsHeldListOpen(false);
  }

  const initiateReturn = (sale: Sale) => {
      setSelectedSaleForReturn(sale);
      setReturnItemsState([]);
      setRefundMethod(sale.paymentMethod === 'STORE_CREDIT' ? 'STORE_CREDIT' : 'CASH');
      setIsReturnModalOpen(true);
      setIsOrdersModalOpen(false);
      setIsReturnsHistoryOpen(false);
  }

  const toggleReturnItem = (itemId: string, maxQty: number) => {
      setReturnItemsState(prev => {
          const exists = prev.find(i => i.id === itemId);
          if (exists) {
              return prev.filter(i => i.id !== itemId);
          } else {
              // Default to 1, or maxQty if less than 1 (e.g. 0.5 remaining)
              const initialQty = Math.min(1, maxQty);
              return [...prev, { id: itemId, qty: initialQty, restock: true, reason: 'Changed Mind' }];
          }
      });
  }

  const updateReturnQty = (itemId: string, delta: number, maxQty: number, allowDecimal: boolean) => {
      setReturnItemsState(prev => prev.map(i => {
          if (i.id === itemId) {
              let newQty = i.qty + delta;
              if (allowDecimal) {
                  newQty = Math.round(newQty * 1000) / 1000;
              }
              const minQty = allowDecimal ? 0.001 : 1;
              newQty = Math.max(minQty, Math.min(newQty, maxQty)); // Ensure within bounds
              return { ...i, qty: newQty };
          }
          return i;
      }));
  }

  const updateReturnField = (itemId: string, field: 'restock' | 'reason', value: any) => {
      setReturnItemsState(prev => prev.map(i => {
          if (i.id === itemId) {
              return { ...i, [field]: value };
          }
          return i;
      }));
  }

  const submitReturn = () => {
      if (!selectedSaleForReturn || returnItemsState.length === 0) return;
      const items: ReturnItem[] = returnItemsState.map(ri => {
          const originalItem = selectedSaleForReturn.items.find(i => i.productId === ri.id);
          return {
              productId: ri.id,
              productName: originalItem?.productName || 'Unknown',
              quantity: ri.qty,
              refundAmount: (originalItem?.priceAtSale || 0) * ri.qty,
              reason: ri.reason,
              restock: ri.restock
          };
      });
      const totalRefund = items.reduce((sum, i) => sum + i.refundAmount, 0);
      const returnTx: ReturnTransaction = {
          id: `ret-${Date.now()}`,
          originalSaleId: selectedSaleForReturn.id,
          timestamp: Date.now(),
          items,
          totalRefund,
          refundMethod,
          cashierId: currentUser.id,
          customerId: selectedSaleForReturn.customerId
      };
      onProcessReturn(returnTx);
      setIsReturnModalOpen(false);
  }

  // ... (getSuggestions, suggestions, filteredProducts, filteredCustomers, etc. logic same as previous) ...
  const getSuggestions = () => {
    if (!searchTerm) return [];
    const results: { type: 'PRODUCT' | 'CATEGORY', item: any, score: number }[] = [];
    categories.forEach((cat: string) => {
      if (cat === 'All') return;
      const score = getMatchScore(cat, searchTerm);
      if (score > 40) results.push({ type: 'CATEGORY', item: cat, score: score + 10 });
    });
    products.forEach(p => {
       const nameScore = getMatchScore(p.name, searchTerm);
       const skuScore = getMatchScore(p.sku, searchTerm);
       const score = Math.max(nameScore, skuScore);
       if (score > 0) results.push({ type: 'PRODUCT', item: p, score });
    });
    return results.sort((a, b) => b.score - a.score).slice(0, 6);
  };

  const suggestions = getSuggestions();

  const filteredProducts = products
    .filter(p => activeCategory === 'All' || p.category === activeCategory)
    .map(p => ({
        ...p,
        matchScore: searchTerm ? Math.max(getMatchScore(p.name, searchTerm), getMatchScore(p.sku, searchTerm)) : 1
    }))
    .filter(p => p.matchScore > 0)
    .sort((a, b) => {
        if (searchTerm) return b.matchScore - a.matchScore;
        return a.name.localeCompare(b.name);
    });

  const filteredCustomers = customers.filter(c => 
     !c.id.startsWith('walkin-') &&
     (c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
     c.phone?.includes(customerSearch) || 
     c.email?.toLowerCase().includes(customerSearch.toLowerCase()))
  );
  
  const filteredOrders = sales.filter(s => 
      s.id.toLowerCase().includes(ordersSearch.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(ordersSearch.toLowerCase())
  ).sort((a,b) => b.timestamp - a.timestamp);

  const filteredHeldTransactions = heldTransactions.filter(h => 
      h.id.toLowerCase().includes(heldSearch.toLowerCase()) ||
      h.customer.name.toLowerCase().includes(heldSearch.toLowerCase()) ||
      h.note?.toLowerCase().includes(heldSearch.toLowerCase())
  );

  const filteredReturns = returns.filter(r => 
      r.id.toLowerCase().includes(returnsSearchTerm.toLowerCase()) ||
      r.originalSaleId.toLowerCase().includes(returnsSearchTerm.toLowerCase()) ||
      customers.find(c => c.id === r.customerId)?.name.toLowerCase().includes(returnsSearchTerm.toLowerCase())
  ).sort((a, b) => b.timestamp - a.timestamp);

  const canHold = selectedCustomer && selectedCustomer.type !== 'MEMBER';

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] gap-6">
      {/* ... (Print Styles Preserved) ... */}
      <style>{`
        @media print {
            body * { visibility: hidden; }
            #receipt-content, #receipt-content * { visibility: visible; }
            #receipt-content {
                position: absolute; left: 0; top: 0; margin: 0; padding: 0;
                box-shadow: none; border: none; width: 100%; background: white;
            }
            .format-a4 { width: 100%; padding: 40px !important; font-size: 12pt !important; }
            .format-80mm { width: 100%; font-size: 12px; padding: 10px !important; }
            .format-58mm { width: 100%; font-size: 10px; padding: 5px !important; }
            .no-print { display: none !important; }
        }
      `}</style>
      
      {/* Product Grid - Preserved */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
          {/* ... Header & Search Components from previous version ... */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4 z-20 bg-white dark:bg-slate-800">
             <div className="flex justify-between items-center mb-2">
                 <div className="text-slate-800 dark:text-white font-bold hidden md:block">Products</div>
                 <div className="flex space-x-2">
                   <button onClick={() => setIsHeldListOpen(true)} className={`bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center text-sm font-medium shadow-sm transition ${heldTransactions.length > 0 ? 'border-orange-200 text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' : ''}`}>
                       <PauseCircle size={16} className="mr-2"/> Holds ({heldTransactions.length})
                   </button>
                   <button onClick={() => setIsOrdersModalOpen(true)} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center text-sm font-medium shadow-sm transition">
                       <Receipt size={16} className="mr-2"/> Recent Orders
                   </button>
                   <button onClick={() => setIsReturnsHistoryOpen(true)} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center text-sm font-medium shadow-sm transition">
                       <RotateCcw size={16} className="mr-2"/> Returns History
                   </button>
                 </div>
             </div>

             <div className="relative" ref={searchInputRef}>
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search products by name, SKU, or category..." 
                  value={searchTerm}
                  onFocus={() => setIsSearchFocused(true)}
                  onChange={(e) => { setSearchTerm(e.target.value); setIsSearchFocused(true); }}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                />
                {isSearchFocused && searchTerm && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-30">
                        {suggestions.map((s, idx) => (
                            <div 
                                key={idx}
                                onClick={() => {
                                    if (s.type === 'CATEGORY') {
                                        setActiveCategory(s.item);
                                        setSearchTerm('');
                                        setIsSearchFocused(false);
                                    } else {
                                        addToCart(s.item as Product);
                                        setIsSearchFocused(false);
                                    }
                                }}
                                className="flex items-center p-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors"
                            >
                                {s.type === 'CATEGORY' ? (
                                    <>
                                        <Tag size={18} className="text-blue-500 mr-3" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-800 dark:text-white">Category: <span className="text-blue-600 dark:text-blue-400">{s.item}</span></p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 mr-3 overflow-hidden shrink-0">
                                             <img src={(s.item as Product).imageUrl || "https://placehold.co/40?text=No+Img"} alt="" className="w-full h-full object-cover"/>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-800 dark:text-white">{(s.item as Product).name}</p>
                                            <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                                                <span className="text-green-600 dark:text-green-400 font-bold">{symbol}{formatCurrency((s.item as Product).price)}</span>
                                                {(s.item as Product).unit && <span className="ml-1 text-slate-400">/ {(s.item as Product).unit}</span>}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
             </div>
             <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${activeCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>{cat}</button>
                ))}
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 bg-slate-50/50 dark:bg-slate-900/50">
             {filteredProducts.length === 0 ? (
                 <div className="col-span-full flex flex-col items-center justify-center text-slate-400 mt-10"><Package size={48} className="mb-4 opacity-20"/><p>No products found</p></div>
             ) : (
                filteredProducts.map(product => (
                    <div key={product.id} onClick={() => addToCart(product)} className={`bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm hover:shadow-md cursor-pointer border border-slate-100 dark:border-slate-700 transition-all active:scale-95 flex flex-col group ${product.stock === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}>
                        <div className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-lg mb-3 overflow-hidden relative">
                            <img src={product.imageUrl || "https://placehold.co/300?text=No+Image"} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            {product.stock <= product.minStockLevel && product.stock > 0 && (<div className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">LOW</div>)}
                            {product.stock === 0 && (<div className="absolute inset-0 bg-black/10 flex items-center justify-center"><span className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded">OUT OF STOCK</span></div>)}
                        </div>
                        <h4 className="font-semibold text-slate-800 dark:text-white text-sm mb-1 truncate">{product.name}</h4>
                        <div className="flex justify-between items-center mt-auto">
                            <div className="flex flex-col">
                                <span className="text-blue-600 dark:text-blue-400 font-bold">{symbol}{formatCurrency(product.price)}</span>
                                {product.unit && <span className="text-[10px] text-slate-400 font-medium">/ {product.unit}</span>}
                            </div>
                            <span className={`text-xs ${product.stock === 0 ? 'text-red-500 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>{product.stock === 0 ? 'Out of Stock' : `${product.stock} left`}</span>
                        </div>
                    </div>
                ))
             )}
          </div>
      </div>
      
      {/* Cart Sidebar */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full lg:h-auto z-10">
         {/* Customer Selection Logic */}
         <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
             {(!selectedCustomer || selectedCustomer.id.startsWith('walkin-')) ? (
                 <div className="relative">
                     <div className="flex space-x-2">
                        <div className="relative flex-1">
                             <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                             <input type="text" placeholder="Search Member..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full pl-9 pr-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white dark:bg-slate-700 dark:text-white dark:placeholder-slate-400" />
                        </div>
                        <button onClick={() => setIsCustomerModalOpen(true)} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 p-2 rounded-lg transition shadow-sm"><UserPlus size={18} /></button>
                     </div>
                     <div className="mt-3 flex items-center justify-between">
                         <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-600/50 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 w-full">
                             <Footprints size={12} className="mr-1.5 text-slate-400"/> <span>Default: <span className="font-semibold text-slate-600 dark:text-slate-300">Walk-in Customer</span></span>
                         </div>
                     </div>
                     {customerSearch && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg max-h-48 overflow-y-auto z-20">
                             {filteredCustomers.map(c => (
                                 <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0">
                                     <p className="font-medium text-sm text-slate-800 dark:text-white">{c.name}</p>
                                     <p className="text-xs text-slate-500 dark:text-slate-400">{c.phone || c.email}</p>
                                 </div>
                             ))}
                        </div>
                     )}
                 </div>
             ) : (
                 <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-800 p-4 rounded-xl border border-blue-100 dark:border-slate-600 shadow-sm relative overflow-hidden group">
                     <div className="flex justify-between items-start mb-3 relative z-10">
                        <div className="flex items-center">
                           <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-lg shadow-sm border border-blue-100 dark:border-slate-500 mr-3">{selectedCustomer.name.charAt(0).toUpperCase()}</div>
                           <div>
                                <p className="font-bold text-slate-800 dark:text-white text-sm flex items-center">{selectedCustomer.name}</p>
                                <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {selectedCustomer.type === 'WALK_IN' ? <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center"><Footprints size={10} className="mr-1"/> Walk-in</span> : <span className="bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-medium">Member</span>}
                                </div>
                           </div>
                        </div>
                        <button onClick={() => setSelectedCustomer(createWalkInCustomer())} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"><X size={16} /></button>
                     </div>
                     <div className="relative z-10 pt-2 border-t border-blue-200/50 dark:border-slate-600 space-y-2">
                        {selectedCustomer.lastVisit && <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 px-1"><span className="flex items-center"><Calendar size={12} className="mr-1.5 opacity-60"/> Last Visit</span><span className="font-medium">{new Date(selectedCustomer.lastVisit).toLocaleDateString()}</span></div>}
                        
                        {/* Action Buttons for Selected Customer */}
                        {selectedCustomer.type === 'MEMBER' && (
                            <div className="grid grid-cols-1 pt-1">
                                <button 
                                    onClick={handleOpenAccountPayment}
                                    className={`w-full py-2 text-xs font-bold rounded transition flex items-center justify-center
                                    ${(selectedCustomer.storeCredit || 0) < 0 
                                        ? 'text-red-100 bg-red-600 hover:bg-red-700 shadow-sm border border-red-500' 
                                        : 'text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900/70'}`}
                                >
                                    <Banknote size={14} className="mr-1.5"/> 
                                    {(selectedCustomer.storeCredit || 0) < 0 ? 'Pay Outstanding Debt' : 'Top-up Wallet'}
                                </button>
                            </div>
                        )}
                     </div>
                 </div>
             )}
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-800">
             {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50"><ShoppingCart size={48} /><p>Cart is empty</p></div> : 
             cart.map(item => (
                 <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                          {item.name} {item.unit && <span className="text-xs text-slate-500 dark:text-slate-400">({item.unit})</span>}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{symbol}{formatCurrency(item.price)} / unit</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 border-r border-slate-100 dark:border-slate-600"><Minus size={12}/></button>
                        <input 
                            type="number" 
                            min={item.allowDecimal ? "0.001" : "1"} 
                            step={item.allowDecimal ? "0.001" : "1"}
                            max={item.stock} 
                            value={item.quantity === 0 ? '' : item.quantity} 
                            onChange={(e) => setItemQuantity(item.id, e.target.value)} 
                            onBlur={() => handleInputBlur(item.id, item.quantity)} 
                            onFocus={(e) => e.target.select()} 
                            className={`w-14 text-center text-sm font-semibold outline-none bg-transparent ${item.quantity > item.stock ? 'text-orange-500 dark:text-orange-400' : 'text-slate-800 dark:text-white'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                        />
                        <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.stock} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-100 dark:border-slate-600"><Plus size={12}/></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                 </div>
             ))}
         </div>

         {/* Checkout Section */}
         <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 rounded-b-xl">
             <div className="grid grid-cols-4 gap-2 mb-4">
                {[ { id: 'CASH', icon: Banknote, label: 'Cash' }, { id: 'CARD', icon: CreditCard, label: 'Card' }, { id: 'DIGITAL', icon: Smartphone, label: 'App' }, { id: 'STORE_CREDIT', icon: Wallet, label: 'Credit' } ].map( method => (
                    <button key={method.id} onClick={() => setPaymentMethod(method.id as any)} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-medium transition ${paymentMethod === method.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-600'}`}>
                        <method.icon size={16} className="mb-1"/> {method.label}
                    </button>
                ))}
             </div>
             
             {paymentMethod === 'CASH' && (
                 <div className="mb-4 p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                     <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amount Tendered</label>
                     <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2">
                        <span className="text-slate-500 dark:text-slate-400 mr-2 font-bold">{symbol}</span>
                        <input type="number" min="0" step="0.01" value={amountTendered} onChange={e => setAmountTendered(e.target.value)} className="w-full bg-transparent outline-none font-bold text-slate-800 dark:text-white" placeholder="0.00" />
                     </div>
                     <div className="mt-2 flex justify-between items-center px-1">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Change Due</span>
                        <span className={`text-lg font-bold ${changeDue < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{symbol}{formatCurrency(Math.max(0, changeDue))}</span>
                     </div>
                 </div>
             )}

             {/* Credit Term Selection */}
             {paymentMethod === 'STORE_CREDIT' && storeSettings.creditTerms && storeSettings.creditTerms.length > 0 && (
                 <div className="mb-4 p-3 bg-indigo-50 dark:bg-slate-700/50 rounded-lg border border-indigo-100 dark:border-slate-600">
                     <label className="block text-xs font-medium text-indigo-600 dark:text-slate-300 mb-1">Payment Term / Due Date</label>
                     <div className="relative">
                         <select 
                            value={selectedCreditTermId} 
                            onChange={(e) => setSelectedCreditTermId(e.target.value)}
                            className="w-full p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-500 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                         >
                             {storeSettings.creditTerms.map(term => (
                                 <option key={term.id} value={term.id}>
                                     {term.name} ({term.rate}% Interest) - {term.days} Days
                                 </option>
                             ))}
                         </select>
                         <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14}/>
                     </div>
                 </div>
             )}
             
             {/* Total Calculation Display */}
             <div className="space-y-1 mb-4 border-t border-slate-200 dark:border-slate-600 pt-3">
                 <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>{symbol}{formatCurrency(cartSubtotal)}</span>
                 </div>
                 
                 {storeSettings.taxRate > 0 && (
                     <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                        <span>{storeSettings.taxName} ({storeSettings.taxRate}%) {storeSettings.taxType === 'EXCLUSIVE' ? 'Added' : 'Inc.'}</span>
                        <span>{symbol}{formatCurrency(calculatedTax)}</span>
                     </div>
                 )}

                 {creditMarkupAmount > 0 && (
                     <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                        <span>Credit Interest ({currentCreditTerm ? currentCreditTerm.rate : storeSettings.creditMarkupRate}%)</span>
                        <span>{symbol}{formatCurrency(creditMarkupAmount)}</span>
                     </div>
                 )}

                 <div className="flex justify-between items-center text-xl font-bold text-slate-800 dark:text-white pt-1">
                    <span>Total</span>
                    <span>{symbol}{formatCurrency(finalPayableAmount)}</span>
                 </div>
             </div>

             <div className="grid grid-cols-4 gap-2">
                  <button onClick={handleHoldClick} disabled={cart.length === 0 || !canHold} className={`col-span-1 py-3 rounded-lg font-bold flex flex-col items-center justify-center transition border ${cart.length > 0 && canHold ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-75'}`} title={!canHold ? "Hold not available for Members/Credit" : "Hold Transaction"}>
                      <PauseCircle size={20} className="mb-0.5"/><span className="text-[10px] uppercase">Hold</span>
                  </button>
                  <button onClick={handleCheckout} disabled={cart.length === 0 || (paymentMethod === 'CASH' && changeDue < 0)} className={`col-span-3 py-3 rounded-lg font-bold text-white shadow-lg transition ${cart.length > 0 && !(paymentMethod === 'CASH' && changeDue < 0) ? 'bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-1' : 'bg-slate-400 cursor-not-allowed'}`}>
                    Complete Sale
                  </button>
             </div>
         </div>
      </div>

      {/* Account Payment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <div className={`flex items-center mb-4 ${(selectedCustomer.storeCredit || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                      <Banknote size={24} className="mr-2"/>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                          {(selectedCustomer.storeCredit || 0) < 0 ? 'Pay Customer Debt' : 'Top-up Wallet'}
                      </h3>
                  </div>
                  
                  {/* Current Balance Display */}
                  <div className={`p-4 rounded-lg mb-6 text-center border ${(selectedCustomer.storeCredit || 0) < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800 text-green-700 dark:text-green-300'}`}>
                      <p className="text-xs uppercase font-bold tracking-wider mb-1">{(selectedCustomer.storeCredit || 0) < 0 ? 'Total Amount Due' : 'Current Balance'}</p>
                      <p className="text-2xl font-bold">
                          {symbol}{Math.abs(selectedCustomer.storeCredit || 0).toFixed(2)}
                          {(selectedCustomer.storeCredit || 0) < 0 && <span className="text-sm font-medium ml-1">(DR)</span>}
                      </p>
                  </div>

                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                              {(selectedCustomer.storeCredit || 0) < 0 ? 'Payment Amount' : 'Deposit Amount'} ({symbol}) <span className="text-red-500">*</span>
                          </label>
                          <input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            autoFocus
                            value={accountPaymentAmount}
                            onChange={(e) => setAccountPaymentAmount(e.target.value)}
                            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                            placeholder="0.00"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Payment Method</label>
                          <div className="flex space-x-2">
                              {['CASH', 'CARD', 'DIGITAL'].map(m => (
                                  <button
                                    key={m}
                                    onClick={() => setAccountPaymentMethod(m as any)}
                                    className={`flex-1 py-2 text-xs font-bold rounded border transition 
                                        ${accountPaymentMethod === m 
                                            ? 'bg-indigo-600 text-white border-indigo-600' 
                                            : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                  >
                                      {m}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-6">
                      <button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                      <button onClick={handleAccountPayment} className="px-4 py-2 text-sm bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">
                          {(selectedCustomer.storeCredit || 0) < 0 ? 'Confirm Payment' : 'Confirm Deposit'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Receipt Modal with Updated Store Settings */}
      {showReceipt && (completedSale || completedPayment) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
            {/* ... Receipt Header ... */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl no-print">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Printer className="mr-2" size={20}/> Print Receipt</h3>
                <button onClick={handleNewSale} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 no-print">
                <div className="flex justify-center space-x-2 mb-4">
                    {(['80mm', '58mm', 'A4'] as const).map(fmt => (
                        <button key={fmt} onClick={() => setPrintFormat(fmt)} className={`px-3 py-1.5 text-xs font-bold rounded border transition ${printFormat === fmt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>{fmt}</button>
                    ))}
                </div>
                <button onClick={handlePrintReceipt} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md flex items-center justify-center transition"><Printer size={20} className="mr-2"/> Print Receipt</button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900 p-4 flex justify-center">
                <div id="receipt-content" className={`bg-white text-black shadow-lg mx-auto overflow-hidden flex flex-col 
                    ${printFormat === '80mm' ? 'w-[80mm] p-4 text-xs' : 
                      printFormat === '58mm' ? 'w-[58mm] p-2 text-[10px]' : 
                      'w-[210mm] p-10 text-sm'}`}>
                        
                        {/* Store Branding */}
                        <div className="text-center mb-4">
                            {storeSettings.storeLogo && (
                                <div className="flex justify-center mb-2">
                                    <img src={storeSettings.storeLogo} alt="Logo" className="h-16 object-contain" />
                                </div>
                            )}
                            <h1 className={`font-bold uppercase tracking-wider mb-1 ${printFormat === 'A4' ? 'text-2xl' : 'text-base'}`}>{storeSettings.storeName}</h1>
                            <div className="text-gray-500 space-y-0.5 leading-tight">
                                <p>{storeSettings.storeAddress}</p>
                                <p>Tel: {storeSettings.storePhone}</p>
                                {storeSettings.storeEmail && <p>{storeSettings.storeEmail}</p>}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-b border-dashed border-gray-400 mb-2"></div>

                        {/* --- PAYMENT RECEIPT --- */}
                        {completedPayment && (
                            <>
                                <div className="text-center mb-4">
                                    <h2 className="font-bold text-lg uppercase">Payment Receipt</h2>
                                    <p className="text-gray-500">{new Date(completedPayment.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between">
                                        <span>Customer:</span>
                                        <span className="font-bold">{completedPayment.customerName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Ref ID:</span>
                                        <span>{completedPayment.id.split('-')[1]}</span>
                                    </div>
                                    <div className="border-b border-dashed border-gray-400 my-2"></div>
                                    <div className="flex justify-between">
                                        <span>Previous Balance:</span>
                                        <span>{symbol}{formatCurrency(completedPayment.newBalance - completedPayment.amount)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Amount Paid:</span>
                                        <span>{symbol}{formatCurrency(completedPayment.amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-gray-600">
                                        <span>Method:</span>
                                        <span>{completedPayment.paymentMethod || 'CASH'}</span>
                                    </div>
                                    <div className="border-b border-dashed border-gray-400 my-2"></div>
                                    <div className="flex justify-between font-bold">
                                        <span>New Balance:</span>
                                        <span>{symbol}{formatCurrency(completedPayment.newBalance)}</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* --- SALES RECEIPT --- */}
                        {completedSale && (
                            <>
                                <div className="mb-2 space-y-1">
                                    <div className="flex justify-between">
                                        <span>Date: {new Date(completedSale.timestamp).toLocaleDateString()}</span>
                                        <span>Time: {new Date(completedSale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Order #: {completedSale.id.split('-')[1]}</span>
                                        <span>Cashier: {currentUser.name.split(' ')[0]}</span>
                                    </div>
                                    {completedSale.customerName && (
                                        <div className="flex justify-between font-bold mt-1">
                                            <span>Customer:</span>
                                            <span>{completedSale.customerName}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="border-b border-dashed border-gray-400 mb-2"></div>

                                <div className="flex font-bold mb-1 pb-1 border-b border-gray-300">
                                    <span className="flex-1">Item</span>
                                    <span className="w-8 text-center">Qty</span>
                                    <span className="w-16 text-right">Price</span>
                                    <span className="w-16 text-right">Total</span>
                                </div>

                                <div className="flex-1 mb-2">
                                    {completedSale.items.map((item, idx) => {
                                        const product = products.find(p => p.id === item.productId);
                                        return (
                                            <div key={idx} className="mb-2">
                                                <div className="font-bold">
                                                    {item.productName} 
                                                    {item.unit && <span className="text-[10px] font-normal ml-1">({item.unit})</span>}
                                                </div>
                                                {product?.sku && <div className="text-[10px] text-gray-500 mb-0.5">SKU: {product.sku}</div>}
                                                <div className="flex">
                                                    <span className="flex-1"></span>
                                                    <span className="w-8 text-center">{item.quantity}</span>
                                                    <span className="w-16 text-right">{symbol}{formatCurrency(item.priceAtSale)}</span>
                                                    <span className="w-16 text-right font-bold">{symbol}{formatCurrency(item.priceAtSale * item.quantity)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="border-b border-dashed border-gray-400 mb-2"></div>

                                <div className="space-y-1 text-right mb-2">
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span>{symbol}{formatCurrency(completedSale.subTotal)}</span>
                                    </div>
                                    
                                    {completedSale.taxRate && completedSale.taxRate > 0 && (
                                        <div className="flex justify-between text-gray-600 text-xs">
                                            <span>
                                                {completedSale.taxName} ({completedSale.taxRate}%) 
                                                {completedSale.taxType === 'INCLUSIVE' ? ' (Included)' : ' (Added)'}
                                            </span>
                                            <span>{symbol}{formatCurrency(completedSale.totalTax)}</span>
                                        </div>
                                    )}

                                    {completedSale.creditMarkupAmount && completedSale.creditMarkupAmount > 0 && (
                                        <div className="flex justify-between text-gray-600 text-xs">
                                            <span>Interest ({completedSale.creditMarkupRate}%) {completedSale.creditTermName}</span>
                                            <span>{symbol}{formatCurrency(completedSale.creditMarkupAmount)}</span>
                                        </div>
                                    )}

                                    <div className="flex justify-between font-bold text-lg border-t border-black pt-1 mt-1">
                                        <span>TOTAL</span>
                                        <span>{symbol}{formatCurrency(completedSale.totalAmount)}</span>
                                    </div>
                                </div>

                                <div className="mb-4 pt-1 border-t border-dashed border-gray-400">
                                    <div className="flex justify-between font-bold text-sm">
                                        <span>Payment Method:</span>
                                        <span className="uppercase">{completedSale.paymentMethod.replace('_', ' ')}</span>
                                    </div>
                                    
                                    {completedSale.paymentMethod === 'STORE_CREDIT' && completedSale.creditDueDate && (
                                        <div className="flex justify-between text-xs mt-1 font-medium">
                                            <span>Due Date:</span>
                                            <span>{new Date(completedSale.creditDueDate).toLocaleDateString()}</span>
                                        </div>
                                    )}

                                    {completedSale.paymentMethod === 'CASH' && completedSale.amountTendered !== undefined && (
                                        <>
                                            <div className="flex justify-between text-xs mt-1">
                                                <span>Cash Tendered:</span>
                                                <span>{symbol}{formatCurrency(completedSale.amountTendered)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span>Change:</span>
                                                <span>{symbol}{formatCurrency(completedSale.change || 0)}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Footer */}
                        <div className="text-center mt-auto">
                            {storeSettings.receiptHeader && <p className="font-bold mb-1">{storeSettings.receiptHeader}</p>}
                            {storeSettings.receiptFooter ? <p className="text-xs text-gray-500 mb-2 whitespace-pre-wrap">{storeSettings.receiptFooter}</p> : <p className="text-xs text-gray-500 mb-2">Thank you for your business!</p>}
                            
                            {/* Barcode */}
                            {completedSale && <SimpleBarcode value={completedSale.id.toUpperCase()} />}
                            {completedPayment && <SimpleBarcode value={completedPayment.id.toUpperCase()} />}
                        </div>
                </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 rounded-b-xl flex justify-center no-print">
                <button onClick={handleNewSale} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Start New Sale</button>
            </div>
            </div>
        </div>
        )}
        
        {/* ... (Existing Modals: Customer, Hold, Returns, Orders - Preserved) ... */}
        {/* Render hidden Modals (Existing modals maintained) */}
        {isCustomerModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
                    <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">New Customer</h3>
                    <div className="space-y-4">
                        <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name <span className="text-red-500">*</span></label><input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" placeholder="Full Name" /></div>
                        <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Phone</label><input type="text" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" /></div>
                        <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label><input type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" /></div>
                        <div className="flex justify-end space-x-2 pt-2"><button onClick={() => setIsCustomerModalOpen(false)} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg">Cancel</button><button onClick={handleCreateCustomer} disabled={!newCustomerName} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button></div>
                    </div>
                </div>
            </div>
        )}

        {isHoldModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6">
                  <div className="flex items-center text-orange-600 mb-4"><PauseCircle size={24} className="mr-2"/><h3 className="text-lg font-bold text-slate-800 dark:text-white">Hold Transaction</h3></div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Temporarily save this cart. Inventory will be reserved until expiry.</p>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Hold Duration (Minutes) <span className="text-red-500">*</span></label>
                          <div className="flex space-x-2 mb-2">
                              {[15, 30, 60, 120].map(mins => (
                                  <button key={mins} onClick={() => setHoldDuration(mins)} className={`flex-1 py-2 text-xs font-bold rounded border transition ${holdDuration === mins ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>{mins}m</button>
                              ))}
                          </div>
                          <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">Custom</span>
                              <input 
                                type="number" 
                                min="1" 
                                value={holdDuration === 0 ? '' : holdDuration} 
                                onChange={(e) => setHoldDuration(e.target.value === '' ? 0 : parseInt(e.target.value))} 
                                className="w-full p-2 pl-16 pr-10 border rounded-lg outline-none focus:border-orange-500 text-sm font-medium text-slate-700 dark:text-white bg-white dark:bg-slate-700 dark:border-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">minutes</span>
                          </div>
                      </div>
                      <div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Note (Optional)</label><input type="text" value={holdNote} onChange={(e) => setHoldNote(e.target.value)} className="w-full p-2 border rounded-lg outline-none focus:border-orange-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" placeholder="e.g. Forgot wallet" /></div>
                  </div>
                  <div className="flex justify-end space-x-2 mt-6"><button onClick={() => setIsHoldModalOpen(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg">Cancel</button><button onClick={confirmHold} className="px-4 py-2 text-sm bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700">Confirm Hold</button></div>
              </div>
          </div>
        )}
      
       {/* (Other existing modals - Orders, Returns, Held Transactions - should be preserved here) */}
       {isHeldListOpen && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-orange-50 dark:bg-orange-900/30 rounded-t-xl">
                        <h3 className="font-bold text-orange-900 dark:text-orange-300 flex items-center">
                            <PauseCircle className="mr-2" size={20}/>
                            Held Transactions
                        </h3>
                        <button onClick={() => setIsHeldListOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"/></button>
                    </div>
                    
                    {/* Search Input for Held Transactions */}
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                placeholder="Search by ID, Name or Note..."
                                value={heldSearch}
                                onChange={(e) => setHeldSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-4 space-y-3">
                         {filteredHeldTransactions.length === 0 ? (
                             <div className="text-center py-10 text-slate-400">
                                 <PauseCircle size={48} className="mx-auto mb-2 opacity-20"/>
                                 <p>No matching held transactions found.</p>
                             </div>
                         ) : (
                             filteredHeldTransactions.map(hold => {
                                 const now = Date.now();
                                 const isExpired = now > hold.expiryTime;
                                 const totalAmount = hold.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                                 
                                 // Calculate Countdown
                                 const diff = hold.expiryTime - now;
                                 const secondsLeft = Math.max(0, Math.floor(diff / 1000));
                                 const h = Math.floor(secondsLeft / 3600);
                                 const m = Math.floor((secondsLeft % 3600) / 60);
                                 const s = secondsLeft % 60;
                                 
                                 const countdownString = h > 0 
                                     ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
                                     : `${m}:${s.toString().padStart(2, '0')}`;

                                 return (
                                     <div key={hold.id} className={`border rounded-lg p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-4
                                         ${isExpired ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:shadow-sm'}`}>
                                         
                                         <div className="flex-1">
                                             <div className="flex items-center mb-1">
                                                 <span className={`font-bold mr-2 ${isExpired ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-white'}`}>
                                                     {hold.customer.name}
                                                 </span>
                                                 {isExpired && (
                                                     <span className="text-[10px] font-bold bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 px-1.5 py-0.5 rounded">EXPIRED</span>
                                                 )}
                                             </div>
                                             <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                                 <span className="font-mono bg-slate-100 dark:bg-slate-600 px-1 rounded mr-2">#{hold.id.split('-').slice(1).join('-')}</span>
                                                 {hold.note && <span>• {hold.note} </span>}
                                                 • {new Date(hold.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                             </div>
                                             <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                                 {hold.items.length} Items • <span className="text-slate-900 dark:text-white">{symbol}{formatCurrency(totalAmount)}</span>
                                             </div>
                                         </div>

                                         <div className="flex flex-col items-end gap-2">
                                             {!isExpired ? (
                                                 <div className="flex items-center text-orange-600 dark:text-orange-300 text-xs font-bold bg-orange-100 dark:bg-orange-900/50 px-2 py-1 rounded tabular-nums">
                                                     <Clock size={12} className="mr-1"/> {countdownString}
                                                 </div>
                                             ) : (
                                                 <div className="flex items-center text-red-600 dark:text-red-300 text-xs font-bold bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded">
                                                     <AlertCircle size={12} className="mr-1"/> Expired
                                                 </div>
                                             )}

                                             <div className="flex space-x-2">
                                                 <button 
                                                    onClick={() => onVoidHold(hold.id)}
                                                    className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center transition"
                                                 >
                                                     <Trash size={12} className="mr-1"/> Void
                                                 </button>
                                                 {!isExpired && (
                                                     <button 
                                                        onClick={() => resumeHold(hold)}
                                                        className="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded hover:bg-green-700 flex items-center shadow-sm transition"
                                                     >
                                                         <PlayCircle size={12} className="mr-1"/> Resume
                                                     </button>
                                                 )}
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })
                         )}
                    </div>
               </div>
           </div>
      )}

      {/* Returns History Modal (Preserved) */}
      {isReturnsHistoryOpen && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-red-50 dark:bg-red-900/30 rounded-t-xl">
                        <h3 className="font-bold text-red-800 dark:text-red-300 flex items-center">
                            <RotateCcw className="mr-2" size={20}/>
                            Returns History Log
                        </h3>
                        <button onClick={() => setIsReturnsHistoryOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"/></button>
                    </div>
                    
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                placeholder="Search by Return ID, Sale ID or Customer..."
                                value={returnsSearchTerm}
                                onChange={(e) => setReturnsSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-4 space-y-4">
                         {filteredReturns.length === 0 ? (
                             <div className="text-center py-10 text-slate-400">
                                 <RotateCcw size={48} className="mx-auto mb-2 opacity-20"/>
                                 <p>No returns found.</p>
                             </div>
                         ) : (
                             filteredReturns.map(ret => {
                                 const customerName = customers.find(c => c.id === ret.customerId)?.name || 'Guest / Walk-in';
                                 
                                 return (
                                     <div key={ret.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition">
                                         <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 dark:border-slate-700/50">
                                             <div>
                                                 <div className="flex items-center gap-2 mb-1">
                                                     <span className="font-bold text-slate-800 dark:text-white">Return #{ret.id.split('-')[1]}</span>
                                                     <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                                        Sale #{ret.originalSaleId.split('-')[1]}
                                                     </span>
                                                 </div>
                                                 <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-3">
                                                     <span className="flex items-center"><Calendar size={12} className="mr-1"/> {new Date(ret.timestamp).toLocaleDateString()}</span>
                                                     <span className="flex items-center"><UserIcon size={12} className="mr-1"/> {customerName}</span>
                                                 </div>
                                             </div>
                                             <div className="text-right">
                                                 <div className="font-bold text-red-600 dark:text-red-400 text-lg">-{symbol}{formatCurrency(ret.totalRefund)}</div>
                                                 <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                     Refund via {ret.refundMethod.replace('_', ' ')}
                                                 </div>
                                             </div>
                                         </div>
                                         
                                         <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
                                             <p className="text-xs font-bold text-slate-400 uppercase mb-2">Returned Items</p>
                                             <div className="space-y-2">
                                                 {ret.items.map((item, idx) => (
                                                     <div key={idx} className="flex justify-between items-center text-sm">
                                                         <div className="flex-1">
                                                             <span className="font-medium text-slate-700 dark:text-slate-300">{item.productName}</span>
                                                             <span className="text-slate-400 mx-2">x{item.quantity}</span>
                                                         </div>
                                                         <div className="flex items-center gap-4">
                                                             <span className="text-xs px-2 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400">
                                                                 Reason: {item.reason}
                                                             </span>
                                                             {item.restock ? (
                                                                 <span className="flex items-center text-xs text-green-600 dark:text-green-400 font-medium">
                                                                     <CheckCircle size={12} className="mr-1"/> Restocked
                                                                 </span>
                                                             ) : (
                                                                 <span className="flex items-center text-xs text-red-500 dark:text-red-400 font-medium">
                                                                     <Trash size={12} className="mr-1"/> Discarded
                                                                 </span>
                                                             )}
                                                             <span className="font-medium text-slate-700 dark:text-slate-300 w-16 text-right">
                                                                 {symbol}{formatCurrency(item.refundAmount)}
                                                             </span>
                                                         </div>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     </div>
                                 );
                             })
                         )}
                    </div>
               </div>
           </div>
      )}

      {/* Orders List Modal (Preserved) */}
      {isOrdersModalOpen && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                            <Receipt className="mr-2 text-slate-500" size={20}/>
                            Recent Sales & Returns
                        </h3>
                        <button onClick={() => setIsOrdersModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"/></button>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                         <input 
                            type="text"
                            placeholder="Search orders by ID or Customer Name..."
                            value={ordersSearch}
                            onChange={(e) => setOrdersSearch(e.target.value)}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                         />
                    </div>
                    <div className="overflow-y-auto flex-1 p-4 space-y-3">
                         {filteredOrders.length === 0 ? (
                             <div className="text-center py-10 text-slate-400">No sales found.</div>
                         ) : (
                             filteredOrders.map(sale => {
                                 // Calculate Return Stats for this sale
                                 const relatedReturns = returns.filter(r => r.originalSaleId === sale.id);
                                 const totalReturned = relatedReturns.reduce((sum, r) => sum + r.totalRefund, 0);
                                 const netAmount = sale.totalAmount - totalReturned;
                                 const isFullyReturned = netAmount <= 0.01; // tolerance
                                 const hasReturns = totalReturned > 0;

                                 return (
                                     <div key={sale.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition bg-white dark:bg-slate-800">
                                         <div className="flex justify-between items-start mb-2">
                                             <div>
                                                 <div className="flex items-center gap-2">
                                                     <span className="font-bold text-slate-700 dark:text-slate-200">#{sale.id.split('-')[1]}</span>
                                                     {hasReturns && (
                                                         <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isFullyReturned ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400'}`}>
                                                             {isFullyReturned ? 'FULLY RETURNED' : 'PARTIAL RETURN'}
                                                         </span>
                                                     )}
                                                 </div>
                                                 <div className="text-xs text-slate-500 dark:text-slate-400">{new Date(sale.timestamp).toLocaleString()}</div>
                                             </div>
                                             <div className="text-right">
                                                 {hasReturns ? (
                                                     <>
                                                         <div className="text-xs text-slate-400 line-through decoration-slate-400">{symbol}{formatCurrency(sale.totalAmount)}</div>
                                                         <div className="font-bold text-blue-600 dark:text-blue-400">{symbol}{formatCurrency(netAmount)}</div>
                                                         <div className="text-[10px] text-red-500 font-medium">-{symbol}{formatCurrency(totalReturned)} refunded</div>
                                                     </>
                                                 ) : (
                                                     <div className="font-bold text-blue-600 dark:text-blue-400">{symbol}{formatCurrency(sale.totalAmount)}</div>
                                                 )}
                                                 <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sale.paymentMethod.replace('_', ' ')}</div>
                                             </div>
                                         </div>
                                         {/* Action Buttons for Order */}
                                         <div className="mt-2 flex justify-end">
                                             <button 
                                                onClick={() => initiateReturn(sale)}
                                                className="px-3 py-1.5 text-xs font-medium bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-700 dark:text-slate-300 transition"
                                             >
                                                 Process Return
                                             </button>
                                         </div>
                                     </div>
                                 );
                             })
                         )}
                    </div>
               </div>
           </div>
      )}
    </div>
  );
});

export default POS;
