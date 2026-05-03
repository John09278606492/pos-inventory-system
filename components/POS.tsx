import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { Product, CartItem, Sale, User, Customer, ReturnTransaction, ReturnItem, HoldTransaction, StoreSettings, CreditTerm, CreditAdjustment, UserRole, ToastMessage } from '../types';
import { Search, ShoppingCart, Minus, Plus, Trash2, CreditCard, Banknote, Smartphone, User as UserIcon, History, X, UserPlus, Calendar, Tag, Package, ChevronRight, RotateCcw, Wallet, Receipt, AlertCircle, Printer, CheckCircle, FileText, Settings, Footprints, PauseCircle, PlayCircle, Clock, Trash, Crown, ArrowRight, Percent, ChevronDown, ShieldCheck, AlertTriangle, ShieldAlert, Maximize, Minimize, Bell, Info, Scan, Star, Zap, Filter, CheckSquare, Square, ListFilter, ClipboardCheck } from 'lucide-react';

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
  onUrgentHoldClick?: (id: string) => void;
  urgentHolds?: HoldTransaction[];
  onAddCreditAdjustment?: (adj: CreditAdjustment) => void;
}

const SimpleBarcode = ({ value }: { value: string }) => {
    const bars = [];
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    const seededRandom = () => {
        const x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };
    for(let i=0; i<30; i++) {
        const r = seededRandom();
        let w = 2; 
        if (r > 0.66) w = 4;
        else if (r < 0.33) w = 1;
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

const getMatchScore = (text: string, query: string): number => {
    const t = text.toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;
    const tTokens = t.split(' ');
    const qTokens = q.split(' ');
    if (qTokens.length > 1) {
        const allTokensFound = qTokens.every(qt => tTokens.some(tt => tt.includes(qt)));
        if (allTokensFound) return 70;
    }
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
    if (q.length > 2 && matches / q.length > 0.8) return 40;
    return 0;
};

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
  onUrgentHoldClick,
  urgentHolds = [],
  onAddCreditAdjustment
}, ref) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'DIGITAL' | 'STORE_CREDIT'>('CARD');
  const [isScannerMode, setIsScannerMode] = useState(false);
  
  // Fullscreen State
  const posContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [localToasts, setLocalToasts] = useState<ToastMessage[]>([]);

  // Selection Feedback
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Frequent Items Calculation
  const frequentProducts = useMemo(() => {
    const salesCounts: Record<string, number> = {};
    sales.forEach(s => {
        s.items.forEach(i => {
            salesCounts[i.productId] = (salesCounts[i.productId] || 0) + i.quantity;
        });
    });
    return products
        .map(p => ({ ...p, count: salesCounts[p.id] || 0 }))
        .filter(p => p.count > 0 && p.stock > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
  }, [sales, products]);

  const showLocalToast = (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'SUCCESS') => {
      const id = Date.now().toString();
      setLocalToasts(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setLocalToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
  };

  const triggerToast = (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'SUCCESS') => {
      if (isFullscreen) showLocalToast(message, type);
      else showToast(message, type);
  };

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(() => createWalkInCustomer());
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [accountPaymentAmount, setAccountPaymentAmount] = useState<string>('');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState<'CASH' | 'CARD' | 'DIGITAL'>('CASH');
  const [completedPayment, setCompletedPayment] = useState<CreditAdjustment | null>(null);

  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedSaleForReturn, setSelectedSaleForReturn] = useState<Sale | null>(null);
  const [returnItemsState, setReturnItemsState] = useState<{id: string, qty: number, restock: boolean, reason: string}[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'DIGITAL' | 'STORE_CREDIT'>('CASH');

  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [printFormat, setPrintFormat] = useState<'80mm' | '58mm' | 'A4'>('80mm');

  const [amountTendered, setAmountTendered] = useState<string>('');
  const [selectedCreditTermId, setSelectedCreditTermId] = useState<string>('');

  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isHeldListOpen, setIsHeldListOpen] = useState(false);
  const [holdDuration, setHoldDuration] = useState(30); 
  const [holdNote, setHoldNote] = useState('');
  const [heldSearch, setHeldSearch] = useState('');
  const [, setTick] = useState(0);

  useEffect(() => {
      if (storeSettings.creditTerms && storeSettings.creditTerms.length > 0) {
          setSelectedCreditTermId(storeSettings.creditTerms[0].id);
      }
  }, [storeSettings.creditTerms]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!posContainerRef.current) return;
    if (!document.fullscreenElement) {
      posContainerRef.current.requestFullscreen().catch(err => {
        triggerToast(`Error enabling fullscreen: ${err.message}`, 'ERROR');
      });
    } else {
      document.exitFullscreen();
    }
  };

  useImperativeHandle(ref, () => ({
      triggerHold: () => {
          if (cart.length > 0) handleHoldClick();
      }
  }));

  useEffect(() => {
      if (resumeHoldId && onClearResumeHold) {
          const hold = heldTransactions.find(h => h.id === resumeHoldId);
          if (hold) {
              if (cart.length > 0) {
                  triggerToast("Cannot auto-resume: Current cart is not empty.", 'ERROR');
              } else {
                  setCart(hold.items);
                  setSelectedCustomer(hold.customer);
                  onResumeHold(hold.id);
                  triggerToast(`Transaction for ${hold.customer.name} resumed!`, 'SUCCESS');
              }
          }
          onClearResumeHold();
      }
  }, [resumeHoldId, heldTransactions, cart.length]);

  useEffect(() => {
      onCartUpdate(cart.length > 0);
  }, [cart]);

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

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard support for Scanner Mode
  useEffect(() => {
    if (isScannerMode && isSearchFocused === false) {
        searchInputRef.current?.focus();
    }
  }, [isScannerMode, isSearchFocused]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
        triggerToast("Product out of stock.", "ERROR");
        return;
    } 
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
            triggerToast("Cannot add more than available stock.", 'ERROR');
            return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    
    // Provide visual feedback
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 500);

    if (isScannerMode) {
        setSearchTerm('');
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && searchTerm.trim() !== '') {
          const exactMatch = products.find(p => p.sku.toLowerCase() === searchTerm.toLowerCase());
          if (exactMatch) {
              addToCart(exactMatch);
              setSearchTerm('');
              return;
          }
          if (suggestions.length > 0 && suggestions[0].type === 'PRODUCT') {
              addToCart(suggestions[0].item);
              setSearchTerm('');
              setIsSearchFocused(false);
          }
      }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        let newQty = item.quantity + delta;
        if (item.allowDecimal) newQty = Math.round(newQty * 1000) / 1000;
        if (delta > 0 && newQty > item.stock) return item; 
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
        if (!item.allowDecimal) newQty = Math.floor(newQty);
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

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let calculatedTax = 0;
  let finalTotal = cartSubtotal;

  if (storeSettings.taxRate > 0) {
      if (storeSettings.taxType === 'EXCLUSIVE') {
          calculatedTax = cartSubtotal * (storeSettings.taxRate / 100);
          finalTotal = cartSubtotal + calculatedTax;
      } else {
          calculatedTax = cartSubtotal - (cartSubtotal / (1 + storeSettings.taxRate / 100));
          finalTotal = cartSubtotal;
      }
  }

  let creditMarkupAmount = 0;
  let currentCreditTerm: CreditTerm | undefined;

  if (paymentMethod === 'STORE_CREDIT') {
      currentCreditTerm = storeSettings.creditTerms?.find(t => t.id === selectedCreditTermId);
      if (!currentCreditTerm && storeSettings.creditTerms?.length > 0) currentCreditTerm = storeSettings.creditTerms[0];
      const rate = currentCreditTerm ? currentCreditTerm.rate : (storeSettings.creditMarkupRate || 0);
      if (rate > 0) creditMarkupAmount = finalTotal * (rate / 100);
  }
  
  const finalPayableAmount = finalTotal + creditMarkupAmount;
  const tenderedNum = parseFloat(amountTendered) || 0;
  const changeDue = tenderedNum - finalPayableAmount;
  const potentialNewBalance = (selectedCustomer?.storeCredit || 0) - finalPayableAmount;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'CASH' && tenderedNum < finalPayableAmount) {
        triggerToast("Amount tendered is less than total.", 'ERROR');
        return;
    }
    if (paymentMethod === 'STORE_CREDIT') {
        if (!selectedCustomer) { triggerToast("Select customer for credit.", 'ERROR'); return; }
        if (selectedCustomer.type !== 'MEMBER') { triggerToast("Store Credit is for Members only.", 'ERROR'); return; }
        const limit = selectedCustomer.creditLimit || 0;
        if (potentialNewBalance < -limit) {
            const canBypass = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN;
            if (canBypass) {
                if (!window.confirm(`Credit limit exceeded by ${symbol}${Math.abs(potentialNewBalance + limit).toFixed(2)}. Bypass?`)) return;
            } else {
                triggerToast(`Transaction exceeds credit limit (${symbol}${limit}).`, 'ERROR');
                return;
            }
        }
    }
    if (selectedCustomer && !customers.find(c => c.id === selectedCustomer.id)) onAddCustomer(selectedCustomer);
    const costOfGoods = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
    const saleProfit = (cartSubtotal - costOfGoods) + creditMarkupAmount;
    let creditDueDate = undefined;
    if (paymentMethod === 'STORE_CREDIT' && currentCreditTerm) creditDueDate = Date.now() + (currentCreditTerm.days * 24 * 60 * 60 * 1000);
    const sale: Sale = {
      id: `sale-${Date.now()}`,
      timestamp: Date.now(),
      items: cart.map(item => ({ productId: item.id, productName: item.name, quantity: item.quantity, unit: item.unit, priceAtSale: item.price, costAtSale: item.cost })),
      subTotal: cartSubtotal, totalTax: calculatedTax, totalAmount: finalPayableAmount, totalProfit: saleProfit,
      taxName: storeSettings.taxName, taxRate: storeSettings.taxRate, taxType: storeSettings.taxType,
      creditMarkupRate: currentCreditTerm ? currentCreditTerm.rate : (storeSettings.creditMarkupRate || 0), creditMarkupAmount: creditMarkupAmount, creditTermName: currentCreditTerm ? currentCreditTerm.name : undefined, creditDueDate: creditDueDate,
      cashierId: currentUser.id, paymentMethod, customerId: selectedCustomer?.id, customerName: selectedCustomer?.name, amountTendered: paymentMethod === 'CASH' ? tenderedNum : undefined, change: paymentMethod === 'CASH' ? changeDue : undefined
    };
    onCompleteSale(sale);
    setCompletedSale(sale);
    setShowReceipt(true);
    setCart([]);
  };

  const handleOpenAccountPayment = () => {
      if (!selectedCustomer || selectedCustomer.type !== 'MEMBER') { triggerToast("Select a Member for payment.", 'ERROR'); return; }
      setIsPaymentModalOpen(true);
      setAccountPaymentAmount('');
      setAccountPaymentMethod('CASH');
  };

  const handleAccountPayment = () => {
      if (!onAddCreditAdjustment) return;
      const amount = parseFloat(accountPaymentAmount);
      if (isNaN(amount) || amount <= 0) { triggerToast("Enter valid amount.", 'ERROR'); return; }
      if (!selectedCustomer) return;
      const currentBalance = selectedCustomer.storeCredit || 0;
      const newBalance = currentBalance + amount;
      const adj: CreditAdjustment = { id: `pay-${Date.now()}`, customerId: selectedCustomer.id, customerName: selectedCustomer.name, amount: amount, type: 'ADD', paymentMethod: accountPaymentMethod, newBalance: newBalance, timestamp: Date.now(), userId: currentUser.id, userName: currentUser.name, reason: 'Account Payment (POS)' };
      onAddCreditAdjustment(adj);
      setSelectedCustomer({ ...selectedCustomer, storeCredit: newBalance });
      setCompletedPayment(adj);
      setShowReceipt(true);
      setIsPaymentModalOpen(false);
      setAccountPaymentAmount('');
  };

  const handleNewSale = () => {
      setShowReceipt(false); setCompletedSale(null); setCompletedPayment(null); setAmountTendered('');
      setSelectedCustomer(createWalkInCustomer()); setCustomerSearch('');
      if (paymentMethod === 'STORE_CREDIT') setPaymentMethod('CARD');
  };

  const handlePrintReceipt = () => window.print();
  
  const handleCreateCustomer = () => {
      if (!newCustomerName) return;
      const newCustomer: Customer = { id: `c-${Date.now()}`, name: newCustomerName, email: newCustomerEmail, phone: newCustomerPhone, totalSpent: 0, visitCount: 0, storeCredit: 0, type: 'MEMBER' };
      onAddCustomer(newCustomer);
      setSelectedCustomer(newCustomer);
      setIsCustomerModalOpen(false);
      setNewCustomerName(''); setNewCustomerEmail(''); setNewCustomerPhone('');
  }

  const handleHoldClick = () => {
      if (cart.length === 0) return;
      if (selectedCustomer && selectedCustomer.type === 'MEMBER') { triggerToast("Hold not available for Members.", 'ERROR'); return; }
      setIsHoldModalOpen(true);
  }

  const confirmHold = () => {
      if (!selectedCustomer) return;
      const hold: HoldTransaction = { id: `hold-${Date.now()}-${Math.floor(Math.random() * 1000)}`, items: [...cart], customer: selectedCustomer, timestamp: Date.now(), durationMinutes: holdDuration, expiryTime: Date.now() + (holdDuration * 60 * 1000), note: holdNote, cashierId: currentUser.id };
      onHoldTransaction(hold);
      setCart([]); setHoldNote(''); setHoldDuration(30); setAmountTendered('');
      setIsHoldModalOpen(false); setSelectedCustomer(createWalkInCustomer());
  }

  const resumeHold = (hold: HoldTransaction) => {
      setCart(hold.items);
      setSelectedCustomer(hold.customer);
      onResumeHold(hold.id);
      setIsHeldListOpen(false);
  }

  // --- Enhanced Return Logic ---
  
  const getReturnableQuantities = (sale: Sale) => {
      const returnableMap: Record<string, number> = {};
      sale.items.forEach(item => {
          returnableMap[item.productId] = item.quantity;
      });
      const previousReturnsForSale = returns.filter(r => r.originalSaleId === sale.id);
      previousReturnsForSale.forEach(ret => {
          ret.items.forEach(retItem => {
              if (returnableMap[retItem.productId] !== undefined) {
                  returnableMap[retItem.productId] = Math.max(0, returnableMap[retItem.productId] - retItem.quantity);
              }
          });
      });
      return returnableMap;
  };

  const initiateReturn = (sale: Sale) => {
    setSelectedSaleForReturn(sale);
    setReturnItemsState([]);
    const origCustomer = customers.find(c => c.id === sale.customerId);
    const isMember = origCustomer?.type === 'MEMBER';
    if (sale.paymentMethod === 'STORE_CREDIT' && isMember) {
        setRefundMethod('STORE_CREDIT');
    } else {
        setRefundMethod('CASH');
    }
    setIsReturnModalOpen(true);
    setIsOrdersModalOpen(false);
  };

  const toggleReturnItem = (productId: string, maxReturnable: number) => {
      if (maxReturnable <= 0) return;
      setReturnItemsState(prev => {
          const exists = prev.find(i => i.id === productId);
          if (exists) return prev.filter(i => i.id !== productId);
          return [...prev, { id: productId, qty: Math.min(1, maxReturnable), restock: true, reason: 'Defective' }];
      });
  };

  const returnableMap = useMemo(() => selectedSaleForReturn ? getReturnableQuantities(selectedSaleForReturn) : {}, [selectedSaleForReturn, returns]);

  const toggleReturnAll = () => {
      if (!selectedSaleForReturn) return;
      const allItemsWithQty = selectedSaleForReturn.items
        .filter(item => returnableMap[item.productId] > 0)
        .map(item => ({
            id: item.productId,
            qty: returnableMap[item.productId],
            restock: true,
            reason: 'Mass Return'
        }));
      if (returnItemsState.length === allItemsWithQty.length) setReturnItemsState([]);
      else setReturnItemsState(allItemsWithQty);
  };

  const updateReturnQty = (productId: string, qty: number) => {
      setReturnItemsState(prev => prev.map(i => i.id === productId ? { ...i, qty } : i));
  };

  const updateReturnField = (productId: string, field: 'restock' | 'reason', value: any) => {
      setReturnItemsState(prev => prev.map(i => i.id === productId ? { ...i, [field]: value } : i));
  };

  const submitReturn = () => {
      if (!selectedSaleForReturn || returnItemsState.length === 0) return;
      const validReturns = returnItemsState.filter(ri => ri.qty > 0);
      if (validReturns.length === 0) {
          triggerToast("Enter return quantity greater than 0.", "ERROR");
          return;
      }
      const items: ReturnItem[] = validReturns.map(ri => {
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
          id: `ret-${Date.now()}`, originalSaleId: selectedSaleForReturn.id, timestamp: Date.now(), items, totalRefund, refundMethod, cashierId: currentUser.id, customerId: selectedSaleForReturn.customerId
      };
      onProcessReturn(returnTx);
      setIsReturnModalOpen(false);
      triggerToast("Return processed successfully.", "SUCCESS");
  };

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
  const filteredProducts = products.filter(p => activeCategory === 'All' || p.category === activeCategory).map(p => ({ ...p, matchScore: searchTerm ? Math.max(getMatchScore(p.name, searchTerm), getMatchScore(p.sku, searchTerm)) : 1 })).filter(p => p.matchScore > 0).sort((a, b) => { if (searchTerm) return b.matchScore - a.matchScore; return a.name.localeCompare(b.name); });
  const filteredCustomers = customers.filter(c => !c.id.startsWith('walkin-') && (c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch) || c.email?.toLowerCase().includes(customerSearch.toLowerCase())));
  const filteredHeldTransactions = heldTransactions.filter(h => h.id.toLowerCase().includes(heldSearch.toLowerCase()) || h.customer.name.toLowerCase().includes(heldSearch.toLowerCase()) || h.note?.toLowerCase().includes(heldSearch.toLowerCase()));
  const canHold = selectedCustomer && selectedCustomer.type !== 'MEMBER';
  const isDebt = selectedCustomer && selectedCustomer.type === 'MEMBER' && (selectedCustomer.storeCredit || 0) < 0;
  const debtAmount = isDebt ? Math.abs(selectedCustomer!.storeCredit) : 0;
  const creditLimit = selectedCustomer?.creditLimit || 0;
  const currentCredit = selectedCustomer?.storeCredit || 0;
  const availableCredit = creditLimit + currentCredit;
  const usagePercentage = creditLimit > 0 ? Math.min(100, Math.max(0, (Math.abs(currentCredit < 0 ? currentCredit : 0) / creditLimit) * 100)) : 0;
  const previewBalance = (selectedCustomer?.storeCredit || 0) + (parseFloat(accountPaymentAmount) || 0);

  const inputClass = "w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400";

  return (
    <div ref={posContainerRef} className={`flex flex-col lg:flex-row gap-6 p-4 md:p-6 bg-slate-100 dark:bg-slate-900 ${isFullscreen ? 'h-screen w-screen overflow-auto relative' : 'h-[calc(100vh-100px)]'}`}>
      
      {/* Fullscreen Notifications Area */}
      {isFullscreen && (
          <div className="fixed top-4 right-4 z-[200] flex flex-col items-end gap-2 w-full max-sm:w-full max-w-sm pointer-events-none px-4">
              {urgentHolds.map(hold => {
                  const diff = Math.max(0, hold.expiryTime - Date.now());
                  const isCritical = diff < 60 * 1000;
                  return (
                      <div key={hold.id} onClick={() => onUrgentHoldClick?.(hold.id)} className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 cursor-pointer transition-all transform hover:scale-105 backdrop-blur-md border border-white/20 ${isCritical ? 'bg-red-600/90 text-white animate-pulse' : 'bg-amber-600/90 text-white'}`}>
                          <AlertCircle size={20} /><div className="flex flex-col items-start leading-tight"><span className="font-bold text-[10px] uppercase tracking-wider">{isCritical ? 'CRITICAL HOLD' : 'EXPIRING HOLD'}</span><span className="text-xs font-semibold">{hold.customer.name} • {Math.floor(diff/60000)}m left</span></div><PlayCircle size={16} className="ml-2"/>
                      </div>
                  );
              })}
              {localToasts.map(toast => (
                  <div key={toast.id} className={`pointer-events-auto flex items-center p-3 pl-4 rounded-lg shadow-xl animate-in slide-in-from-right-10 fade-in duration-300 w-full ${toast.type === 'SUCCESS' ? 'bg-emerald-600' : toast.type === 'ERROR' ? 'bg-red-600' : 'bg-blue-600'} text-white`}>
                      {toast.type === 'SUCCESS' ? <CheckCircle size={18} className="mr-3" /> : toast.type === 'ERROR' ? <AlertCircle size={18} className="mr-3" /> : <Info size={18} className="mr-3" />}<span className="font-medium text-sm flex-1 leading-tight">{toast.message}</span>
                  </div>
              ))}
          </div>
      )}

      <style>{`
        @media print {
            body * { visibility: hidden; }
            #receipt-content, #receipt-content * { visibility: visible; }
            #receipt-content { position: absolute; left: 0; top: 0; margin: 0; padding: 0; box-shadow: none; border: none; width: 100%; background: white; }
            .format-a4 { width: 100%; padding: 40px !important; font-size: 12pt !important; }
            .format-80mm { width: 100%; font-size: 12px; padding: 10px !important; }
            .format-58mm { width: 100%; font-size: 10px; padding: 5px !important; }
            .no-print { display: none !important; }
        }
        @keyframes addPulse {
            0% { transform: scale(1); }
            50% { transform: scale(0.95); opacity: 0.8; }
            100% { transform: scale(1); }
        }
        .animate-add-click { animation: addPulse 0.3s ease-out; }
      `}</style>
      
      {/* Product Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4 z-20 bg-white dark:bg-slate-800">
             <div className="flex justify-between items-center mb-2">
                 <div className="flex items-center gap-2"><div className="text-slate-800 dark:text-white font-bold hidden md:block">Terminal</div><button onClick={() => setIsScannerMode(!isScannerMode)} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold transition-colors ${isScannerMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}><Scan size={14}/> {isScannerMode ? 'Scanner ON' : 'Scanner Mode'}</button></div>
                 <div className="flex space-x-2"><button onClick={toggleFullscreen} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center text-sm font-medium shadow-sm transition">{isFullscreen ? <Minimize size={16} className="mr-2"/> : <Maximize size={16} className="mr-2"/>} {isFullscreen ? 'Exit' : 'Full'}</button><button onClick={() => setIsHeldListOpen(true)} className={`bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center text-sm font-medium shadow-sm transition ${heldTransactions.length > 0 ? 'border-orange-200 text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' : ''}`}><PauseCircle size={16} className="mr-2"/> Holds ({heldTransactions.length})</button><button onClick={() => setIsOrdersModalOpen(true)} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 px-3 py-1.5 rounded-lg flex items-center text-sm font-medium shadow-sm transition"><Receipt size={16} className="mr-2"/> Orders</button></div>
             </div>
             <div className="relative" ref={searchInputRef}><div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2 pointer-events-none"><Search className="text-slate-400" size={20} /></div><input type="text" placeholder={isScannerMode ? "Waiting for barcode scan..." : "Search products by name, SKU, or category..."} value={searchTerm} onFocus={() => setIsSearchFocused(true)} onKeyDown={handleSearchKeyPress} onChange={(e) => { setSearchTerm(e.target.value); setIsSearchFocused(true); }} className={`w-full pl-10 pr-12 py-3 rounded-xl border-2 transition-all focus:outline-none focus:ring-4 bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 ${isScannerMode ? 'border-indigo-500 focus:ring-indigo-500/20' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500/20 focus:border-blue-500'}`}/>{searchTerm && (<button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={20}/></button>)}{isSearchFocused && searchTerm && suggestions.length > 0 && (<div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden z-[60]">{suggestions.map((s, idx) => (<div key={idx} onClick={() => { if (s.type === 'CATEGORY') { setActiveCategory(s.item); setSearchTerm(''); setIsSearchFocused(false); } else { addToCart(s.item as Product); setIsSearchFocused(false); } }} className="flex items-center p-3 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors">{s.type === 'CATEGORY' ? (<><Tag size={18} className="text-blue-500 mr-3" /><div><p className="text-sm font-medium text-slate-800 dark:text-white">Category: <span className="text-blue-600 dark:text-blue-400">{s.item}</span></p></div></>) : (<><div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 mr-3 overflow-hidden shrink-0"><img src={(s.item as Product).imageUrl || "https://placehold.co/40?text=No+Img"} alt="" className="w-full h-full object-cover"/></div><div className="flex-1"><p className="text-sm font-medium text-slate-800 dark:text-white">{(s.item as Product).name}</p><div className="flex items-center text-xs text-slate-500 dark:text-slate-400"><span className="text-green-600 dark:text-green-400 font-bold">{symbol}{formatCurrency((s.item as Product).price)}</span>{(s.item as Product).unit && <span className="ml-1 text-slate-400">/ {(s.item as Product).unit}</span>}<span className="ml-auto text-[10px] font-mono opacity-50">{(s.item as Product).sku}</span></div></div></>)}</div>))}</div>)}</div>
             <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide"><button onClick={() => setActiveCategory('All')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${activeCategory === 'All' ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}><Zap size={12}/> All Products</button>{categories.filter(c => c !== 'All').map(cat => (<button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${activeCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>{cat}</button>))}</div>
          </div>

          {!searchTerm && activeCategory === 'All' && frequentProducts.length > 0 && (<div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-b border-slate-100 dark:border-slate-700"><div className="flex items-center gap-2 mb-2"><Star size={14} className="text-amber-500 fill-amber-500"/><span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Top Frequent Items</span></div><div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">{frequentProducts.map(p => (<div key={p.id} onClick={() => addToCart(p)} className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center gap-3 shrink-0 cursor-pointer hover:border-blue-400 hover:shadow-md transition active:scale-95 group"><div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 shrink-0 overflow-hidden"><img src={p.imageUrl || "https://placehold.co/40"} className="w-full h-full object-cover" alt=""/></div><div><p className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[80px]">{p.name}</p><p className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{symbol}{formatCurrency(p.price)}</p></div></div>))}</div></div>)}

          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 bg-slate-50/50 dark:bg-slate-900/50">
             {filteredProducts.length === 0 ? <div className="col-span-full flex flex-col items-center justify-center text-slate-400 mt-10"><Package size={48} className="mb-4 opacity-20"/><p>No products found</p></div> :
                filteredProducts.map(product => {
                    const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;
                    const isLow = product.stock <= product.minStockLevel && product.stock > 0;
                    const isOut = product.stock === 0;
                    const isLastAdded = lastAddedId === product.id;
                    return (
                        <div key={product.id} onClick={() => !isOut && addToCart(product)} className={`bg-white dark:bg-slate-800 rounded-xl p-2.5 shadow-sm border transition-all cursor-pointer select-none relative flex flex-col group ${isOut ? 'opacity-50 grayscale cursor-not-allowed border-slate-100 dark:border-slate-700' : 'border-slate-100 dark:border-slate-700 hover:border-blue-500 hover:shadow-lg active:scale-95'} ${isLastAdded ? 'ring-2 ring-emerald-500 animate-add-click' : ''}`}><div className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-lg mb-2 overflow-hidden relative"><img src={product.imageUrl || "https://placehold.co/300?text=No+Image"} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />{isLow && (<div className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm">LOW</div>)}{isOut && (<div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]"><span className="bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded">SOLD OUT</span></div>)}<div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-600 rounded-full mx-1.5 mb-1.5 overflow-hidden"><div className={`h-full ${isLow ? 'bg-orange-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, (product.stock / (product.minStockLevel * 3)) * 100)}%` }}></div></div></div><h4 className="font-bold text-slate-800 dark:text-white text-xs mb-1 line-clamp-1 h-4">{product.name}</h4><div className="flex items-end justify-between mt-auto"><div className="flex flex-col"><span className="text-blue-600 dark:text-blue-400 font-black text-sm">{symbol}{formatCurrency(product.price)}</span><span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{product.unit ? `Per ${product.unit}` : 'Piece'}</span></div><div className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${isOut ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400'}`}>{product.stock}</div></div>{!isOut && (<div className="absolute inset-0 bg-blue-600/0 hover:bg-blue-600/5 transition-colors pointer-events-none rounded-xl"></div>)}</div>
                    );
                })
             }
          </div>
      </div>
      
      {/* Cart Sidebar */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full lg:h-auto z-10">
         <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
             {(!selectedCustomer || selectedCustomer.id.startsWith('walkin-')) ? (
                 <div className="relative"><div className="flex space-x-2"><div className="relative flex-1"><UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Search Member..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full pl-9 pr-2 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500" /></div><button onClick={() => setIsCustomerModalOpen(true)} className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 p-2 rounded-lg transition shadow-sm"><UserPlus size={18} /></button></div><div className="mt-3 flex items-center justify-between"><div className="flex items-center text-xs text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-600/50 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 w-full"><Footprints size={12} className="mr-1.5 text-slate-400"/> <span>Default: <span className="font-semibold text-slate-600 dark:text-slate-300">Walk-in Customer</span></span></div></div>{customerSearch && (<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg max-h-48 overflow-y-auto z-20">{filteredCustomers.map(c => (<div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0"><p className="font-medium text-sm text-slate-800 dark:text-white">{c.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{c.phone || c.email}</p></div>))}</div>)}</div>
             ) : (
                 <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-800 p-4 rounded-xl border border-blue-100 dark:border-slate-600 shadow-sm relative overflow-hidden group"><div className="flex justify-between items-start mb-3 relative z-10"><div className="flex items-center"><div className="w-10 h-10 rounded-full bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-lg shadow-sm border border-blue-100 dark:border-slate-500 mr-3">{selectedCustomer.name.charAt(0).toUpperCase()}</div><div><p className="font-bold text-slate-800 dark:text-white text-sm flex items-center">{selectedCustomer.name}</p><div className="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedCustomer.type === 'WALK_IN' ? <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center"><Footprints size={10} className="mr-1"/> Walk-in</span> : <span className="bg-blue-200 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-medium">Member</span>}</div></div></div><button onClick={() => setSelectedCustomer(createWalkInCustomer())} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"><X size={16} /></button></div><div className="relative z-10 pt-2 border-t border-blue-200/50 dark:border-slate-600 space-y-2">{isDebt && (<div className="flex justify-between items-center text-xs font-bold text-red-600 dark:text-red-400 px-1"><span>Outstanding Balance</span><span>{symbol}{debtAmount.toFixed(2)}</span></div>)}{selectedCustomer.type === 'MEMBER' && (<div className="px-1 pt-1"><div className="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1"><span>Available Credit: <span className={`font-bold ${availableCredit < finalPayableAmount ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{symbol}{availableCredit.toFixed(2)}</span></span><span>Limit: {symbol}{creditLimit.toFixed(2)}</span></div><div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-500 ${usagePercentage > 90 ? 'bg-red-500' : usagePercentage > 75 ? 'bg-orange-400' : 'bg-green-500'}`} style={{ width: `${usagePercentage}%` }}></div></div>{paymentMethod === 'STORE_CREDIT' && potentialNewBalance < -creditLimit && (<div className="mt-2 flex items-center text-[10px] text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 p-1.5 rounded border border-red-100 dark:border-red-800"><ShieldAlert size={12} className="mr-1 shrink-0"/><span>Limit Exceeded by {symbol}{Math.abs(potentialNewBalance + creditLimit).toFixed(2)}</span></div>)}</div>)}{selectedCustomer.type === 'MEMBER' && (<div className="grid grid-cols-1 pt-1"><button onClick={handleOpenAccountPayment} className={`w-full py-2.5 text-xs font-bold rounded-lg transition flex items-center justify-center border shadow-sm ${isDebt ? 'text-red-100 bg-red-600 hover:bg-red-700 border-red-500' : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border-indigo-200 dark:border-indigo-800'}`}>{isDebt ? <ShieldCheck size={14} className="mr-1.5"/> : <Banknote size={14} className="mr-1.5"/>}{isDebt ? 'Pay Outstanding Debt' : 'Top-up Wallet'}</button></div>)}</div></div>
             )}
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-800">{cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50"><ShoppingCart size={48} /><p>Cart is empty</p></div> : cart.map(item => (<div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-100 dark:border-slate-700"><div className="flex-1 min-w-0 mr-3"><p className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{item.name} {item.unit && <span className="text-xs text-slate-500 dark:text-slate-400">({item.unit})</span>}</p><p className="text-xs text-slate-500 dark:text-slate-400">{symbol}{formatCurrency(item.price)} / unit</p></div><div className="flex items-center space-x-3"><div className="flex items-center bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 shadow-sm overflow-hidden"><button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 border-r border-slate-100 dark:border-slate-600"><Minus size={12}/></button><input type="number" min={item.allowDecimal ? "0.001" : "1"} step={item.allowDecimal ? "0.001" : "1"} max={item.stock} value={item.quantity === 0 ? '' : item.quantity} onChange={(e) => setItemQuantity(item.id, e.target.value)} onBlur={() => handleInputBlur(item.id, item.quantity)} onFocus={(e) => e.target.select()} className={`w-14 text-center text-sm font-semibold outline-none bg-transparent ${item.quantity > item.stock ? 'text-orange-500 dark:text-orange-400' : 'text-slate-800 dark:text-white'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}/><button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.stock} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed border-l border-slate-100 dark:border-slate-600"><Plus size={12}/></button></div><button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div></div>))}</div>
         <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-700 rounded-b-xl"><div className="grid grid-cols-4 gap-2 mb-4">{[ { id: 'CASH', icon: Banknote, label: 'Cash' }, { id: 'CARD', icon: CreditCard, label: 'Card' }, { id: 'DIGITAL', icon: Smartphone, label: 'App' }, { id: 'STORE_CREDIT', icon: Wallet, label: 'Credit' } ].map( method => (<button key={method.id} onClick={() => setPaymentMethod(method.id as any)} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-lg border text-[10px] font-medium transition ${paymentMethod === method.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-600'}`}><method.icon size={16} className="mb-1"/> {method.label}</button>))}</div>{paymentMethod === 'CASH' && (<div className="mb-4 p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Amount Tendered</label><div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2"><span className="text-slate-500 dark:text-slate-400 mr-2 font-bold">{symbol}</span><input type="number" min="0" step="0.01" value={amountTendered} onChange={e => setAmountTendered(e.target.value)} className="w-full bg-transparent outline-none font-bold text-slate-800 dark:text-white" placeholder="0.00" /></div><div className="mt-2 flex justify-between items-center px-1"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">Change Due</span><span className={`text-lg font-bold ${changeDue < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{symbol}{formatCurrency(Math.max(0, changeDue))}</span></div></div>)}{paymentMethod === 'STORE_CREDIT' && storeSettings.creditTerms && storeSettings.creditTerms.length > 0 && (<div className="mb-4 p-3 bg-indigo-50 dark:bg-slate-700/50 rounded-lg border border-indigo-100 dark:border-slate-600"><label className="block text-xs font-medium text-indigo-600 dark:text-slate-300 mb-1">Payment Term / Due Date</label><div className="relative"><select value={selectedCreditTermId} onChange={(e) => setSelectedCreditTermId(e.target.value)} className="w-full p-2 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-500 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">{storeSettings.creditTerms.map(term => (<option key={term.id} value={term.id}>{term.name} ({term.rate}% Interest) - {term.days} Days</option>))}</select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14}/></div></div>)}<div className="space-y-1 mb-4 border-t border-slate-200 dark:border-slate-600 pt-3"><div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400"><span>Subtotal</span><span>{symbol}{formatCurrency(cartSubtotal)}</span></div>{storeSettings.taxRate > 0 && (<div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400"><span>{storeSettings.taxName} ({storeSettings.taxRate}%) {storeSettings.taxType === 'EXCLUSIVE' ? 'Added' : 'Inc.'}</span><span>{symbol}{formatCurrency(calculatedTax)}</span></div>)}{creditMarkupAmount > 0 && (<div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400"><span>Credit Interest ({currentCreditTerm ? currentCreditTerm.rate : storeSettings.creditMarkupRate}%)</span><span>{symbol}{formatCurrency(creditMarkupAmount)}</span></div>)}<div className="flex justify-between items-center text-xl font-bold text-slate-800 dark:text-white pt-1"><span>Total</span><span>{symbol}{formatCurrency(finalPayableAmount)}</span></div></div><div className="grid grid-cols-4 gap-2"><button onClick={handleHoldClick} disabled={cart.length === 0 || !canHold} className={`col-span-1 py-3 rounded-lg font-bold flex flex-col items-center justify-center transition border ${cart.length > 0 && canHold ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-75'}`} title={!canHold ? "Hold not available for Members/Credit" : "Hold Transaction"}><PauseCircle size={20} className="mb-0.5"/><span className="text-[10px] uppercase">Hold</span></button><button onClick={handleCheckout} disabled={cart.length === 0 || (paymentMethod === 'CASH' && changeDue < 0)} className={`col-span-3 py-3 rounded-lg font-bold text-white shadow-lg transition ${cart.length > 0 && !(paymentMethod === 'CASH' && changeDue < 0) ? 'bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-1' : 'bg-slate-400 cursor-not-allowed'}`}>Complete Sale</button></div></div>
      </div>

      {/* Account Payment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200"><div className={`flex items-center mb-4 ${(selectedCustomer.storeCredit || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}><Banknote size={24} className="mr-2"/><h3 className="text-lg font-bold text-slate-800 dark:text-white">{(selectedCustomer.storeCredit || 0) < 0 ? 'Settle Outstanding Debt' : 'Add Store Credit'}</h3></div><div className={`p-4 rounded-lg mb-6 text-center border ${(selectedCustomer.storeCredit || 0) < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 text-red-700 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'}`}><p className="text-xs uppercase font-bold tracking-wider mb-1 opacity-80">{(selectedCustomer.storeCredit || 0) < 0 ? 'Total Amount Due' : 'Current Balance'}</p><p className="text-3xl font-bold">{symbol}{Math.abs(selectedCustomer.storeCredit || 0).toFixed(2)}{(selectedCustomer.storeCredit || 0) < 0 && <span className="text-sm font-medium ml-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-100 px-1.5 py-0.5 rounded align-middle">DR</span>}</p></div><div className="space-y-4"><div><div className="flex justify-between items-center mb-1"><label className="block text-xs font-medium text-slate-500 dark:text-slate-400">{(selectedCustomer.storeCredit || 0) < 0 ? 'Payment Amount' : 'Deposit Amount'} ({symbol}) <span className="text-red-500">*</span></label>{(selectedCustomer.storeCredit || 0) < 0 && (<button onClick={() => setAccountPaymentAmount(Math.abs(selectedCustomer.storeCredit || 0).toString())} className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">Pay Full Amount</button>)}</div><input type="number" min="0" step="0.01" autoFocus value={accountPaymentAmount} onChange={(e) => setAccountPaymentAmount(e.target.value)} className={inputClass} placeholder="0.00" />{accountPaymentAmount && (<div className="mt-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded flex justify-between items-center text-xs"><span className="text-slate-500 dark:text-slate-400">New Balance:</span><span className={`font-bold ${previewBalance < 0 ? 'text-red-500' : 'text-green-500'}`}>{symbol}{Math.abs(previewBalance).toFixed(2)} {previewBalance < 0 ? '(DR)' : '(CR)'}</span></div>)}</div><div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Payment Method</label><div className="flex space-x-2">{['CASH', 'CARD', 'DIGITAL'].map(m => (<button key={m} onClick={() => setAccountPaymentMethod(m as any)} className={`flex-1 py-2 text-xs font-bold rounded border transition ${accountPaymentMethod === m ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>{m}</button>))}</div></div></div><div className="flex justify-end space-x-2 mt-6"><button onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg">Cancel</button><button onClick={handleAccountPayment} className="px-4 py-2 text-sm bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md">{(selectedCustomer.storeCredit || 0) < 0 ? 'Confirm Payment' : 'Confirm Deposit'}</button></div></div></div>
      )}

      {/* Enhanced Return Modal */}
      {isReturnModalOpen && selectedSaleForReturn && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                              <RotateCcw size={20}/>
                          </div>
                          <div>
                              <h3 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">Process Items Return</h3>
                              <p className="text-xs text-slate-500 font-medium">Order #{selectedSaleForReturn.id.split('-')[1]} • {new Date(selectedSaleForReturn.timestamp).toLocaleDateString()}</p>
                          </div>
                      </div>
                      <button onClick={() => setIsReturnModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors"><X size={20}/></button>
                  </div>

                  <div className="px-6 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex flex-wrap gap-6 text-xs items-center">
                      <div className="flex items-center gap-1.5"><UserIcon size={14} className="text-slate-400"/><span className="font-bold">{selectedSaleForReturn.customerName || 'Guest'}</span></div>
                      <div className="flex items-center gap-1.5"><Banknote size={14} className="text-slate-400"/><span>Paid <span className="font-bold">{symbol}{selectedSaleForReturn.totalAmount.toFixed(2)}</span> via <span className="uppercase font-bold">{selectedSaleForReturn.paymentMethod}</span></span></div>
                      <button onClick={toggleReturnAll} className="ml-auto flex items-center gap-1.5 text-blue-600 font-bold hover:underline">
                        <ListFilter size={14}/>
                        {returnItemsState.length === selectedSaleForReturn.items.filter(i => returnableMap[i.productId] > 0).length ? 'Deselect All' : 'Select All Returnable'}
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                      {selectedSaleForReturn.items.map(item => {
                          const maxAvailable = returnableMap[item.productId] || 0;
                          const isSelected = returnItemsState.some(ri => ri.id === item.productId);
                          const stateItem = returnItemsState.find(ri => ri.id === item.productId);
                          const product = products.find(p => p.id === item.productId);
                          const allowDecimal = product?.allowDecimal || false;
                          
                          const rowStatusClass = maxAvailable === 0 ? 'opacity-60 grayscale bg-slate-50 dark:bg-slate-900/50' : isSelected ? 'border-red-500 ring-1 ring-red-500/20 bg-red-50/20 dark:bg-red-900/5' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300';

                          return (
                              <div key={item.productId} className={`p-4 rounded-xl border transition-all ${rowStatusClass}`}>
                                  <div className="flex items-center gap-4">
                                      <button disabled={maxAvailable === 0} onClick={() => toggleReturnItem(item.productId, maxAvailable)} className={`shrink-0 transition-colors ${maxAvailable === 0 ? 'text-slate-300' : isSelected ? 'text-red-600' : 'text-slate-300 hover:text-slate-400'}`}>
                                          {isSelected ? <CheckSquare size={24}/> : <Square size={24}/>}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.productName}</p>
                                          <div className="flex flex-wrap gap-x-3 text-xs mt-0.5">
                                              <span className="text-slate-500">Bought: <span className="font-bold text-slate-700 dark:text-slate-300">{item.quantity} {item.unit}</span></span>
                                              {maxAvailable < item.quantity && <span className="text-red-500 font-bold flex items-center"><RotateCcw size={10} className="mr-0.5"/> {item.quantity - maxAvailable} returned</span>}
                                              {maxAvailable > 0 && <span className="text-blue-600 font-bold">Avail: {maxAvailable} {item.unit}</span>}
                                          </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                          <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Refund / Unit</p>
                                          <p className="text-sm font-black text-slate-800 dark:text-white">{symbol}{item.priceAtSale}</p>
                                      </div>
                                      {isSelected && (
                                          <div className="flex items-center gap-2 bg-white dark:bg-slate-700 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 shadow-sm ml-2">
                                              <span className="text-xs font-black text-red-600 uppercase">Qty</span>
                                              <input type="number" step={allowDecimal ? "0.001" : "1"} min="0" max={maxAvailable} value={stateItem?.qty === 0 ? '' : stateItem?.qty} autoFocus onChange={(e) => {
                                                    const valStr = e.target.value;
                                                    if (valStr === '') { updateReturnQty(item.productId, 0); return; }
                                                    let val = parseFloat(valStr) || 0;
                                                    if (!allowDecimal) val = Math.floor(val);
                                                    const safeVal = Math.min(maxAvailable, Math.max(0, val));
                                                    updateReturnQty(item.productId, safeVal);
                                                }} className="w-20 p-0 text-lg font-black text-center bg-transparent border-0 outline-none text-red-700 dark:text-red-400" />
                                          </div>
                                      )}
                                  </div>
                                  {isSelected && (
                                      <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/30 flex flex-col md:flex-row gap-4">
                                          <div className="flex-1">
                                              <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Reason for Return</label>
                                              <div className="flex flex-wrap gap-2">
                                                  {['Defective', 'Wrong Item', 'Exchange', 'Cancel'].map(r => (
                                                      <button key={r} onClick={() => updateReturnField(item.productId, 'reason', r)} className={`px-2 py-1 rounded text-[10px] font-bold border transition ${stateItem?.reason === r ? 'bg-red-600 border-red-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}`}>{r}</button>
                                                  ))}
                                                  <input type="text" placeholder="Custom reason..." value={['Defective', 'Wrong Item', 'Exchange', 'Cancel'].includes(stateItem?.reason || '') ? '' : stateItem?.reason} onChange={(e) => updateReturnField(item.productId, 'reason', e.target.value)} className="flex-1 min-w-[120px] p-1.5 text-xs border rounded bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                              </div>
                                          </div>
                                          <div className="shrink-0 flex items-center">
                                              <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900/50 transition">
                                                  <div className="flex flex-col items-end"><span className="text-[10px] font-black uppercase text-slate-400">Inventory</span><span className="text-xs font-bold text-slate-700 dark:text-slate-300">Put back to stock?</span></div>
                                                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${stateItem?.restock ? 'bg-green-500' : 'bg-slate-300'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${stateItem?.restock ? 'translate-x-6' : 'translate-x-0 shadow-sm'}`}></div></div>
                                                  <input type="checkbox" checked={stateItem?.restock || false} onChange={(e) => updateReturnField(item.productId, 'restock', e.target.checked)} className="hidden"/>
                                              </label>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          );
                      })}
                      {selectedSaleForReturn.items.filter(i => returnableMap[i.productId] > 0).length === 0 && (
                          <div className="py-12 flex flex-col items-center justify-center text-slate-400"><ClipboardCheck size={64} className="opacity-10 mb-4"/><p className="font-bold">All items have already been returned.</p><button onClick={() => setIsReturnModalOpen(false)} className="mt-4 text-blue-600 font-bold hover:underline">Close Window</button></div>
                      )}
                  </div>

                  <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 flex flex-col gap-5">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                              <span className="text-xs font-black uppercase text-slate-400">Refund Destination</span>
                              <div className="flex gap-2">
                                  {(() => {
                                      const origCustomer = customers.find(c => c.id === selectedSaleForReturn.customerId);
                                      const isMember = origCustomer?.type === 'MEMBER';
                                      const methods = ['CASH', 'CARD', 'DIGITAL'];
                                      if (isMember) methods.push('STORE_CREDIT');
                                      return methods.map(m => (
                                          <button key={m} onClick={() => setRefundMethod(m as any)} className={`px-4 py-2 rounded-lg text-xs font-black border transition-all flex items-center gap-2 ${refundMethod === m ? 'bg-blue-600 text-white border-blue-600 shadow-md transform -translate-y-0.5' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}>
                                              {m === 'CASH' && <Banknote size={14}/>}{m === 'CARD' && <CreditCard size={14}/>}{m === 'DIGITAL' && <Smartphone size={14}/>}{m === 'STORE_CREDIT' && <Wallet size={14}/>}{m}
                                          </button>
                                      ));
                                  })()}
                              </div>
                          </div>
                          <div className="text-right">
                              <span className="text-xs font-black uppercase text-slate-400">Total Refund Amount</span>
                              <div className="text-4xl font-black text-red-600 tracking-tighter">{symbol}{returnItemsState.reduce((sum, ri) => { const orig = selectedSaleForReturn.items.find(i => i.productId === ri.id); return sum + (ri.qty * (orig?.priceAtSale || 0)); }, 0).toFixed(2)}</div>
                          </div>
                      </div>
                      <div className="flex gap-3 mt-2">
                          <button onClick={() => setIsReturnModalOpen(false)} className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors">Discard</button>
                          <button onClick={submitReturn} disabled={returnItemsState.length === 0 || !returnItemsState.some(ri => ri.qty > 0)} className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:shadow-none transition-all transform hover:-translate-y-0.5 active:translate-y-0 uppercase tracking-widest flex items-center justify-center gap-2">
                              <RotateCcw size={20}/> Complete Return Transaction
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Orders Modal */}
      {isOrdersModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
                      <h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Receipt className="mr-2" size={20}/> Recent Orders</h3>
                      <button onClick={() => setIsOrdersModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
                  </div>
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                          <input type="text" placeholder="Search orders by ID or customer..." value={ordersSearch} onChange={(e) => setOrdersSearch(e.target.value)} className={inputClass} />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-500 uppercase sticky top-0 border-b dark:border-slate-700">
                              <tr><th className="p-4">Order ID</th><th className="p-4">Date</th><th className="p-4">Customer</th><th className="p-4 text-right">Amount</th><th className="p-4 text-right">Action</th></tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-700">
                              {sales.filter(s => s.id.includes(ordersSearch) || s.customerName?.toLowerCase().includes(ordersSearch.toLowerCase())).sort((a,b) => b.timestamp - a.timestamp).map(s => (
                                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                      <td className="p-4 font-mono text-xs">{s.id.split('-')[1]}</td>
                                      <td className="p-4 text-xs">{new Date(s.timestamp).toLocaleString()}</td>
                                      <td className="p-4 text-sm font-medium">{s.customerName || 'Guest'}</td>
                                      <td className="p-4 text-right font-bold">{symbol}{formatCurrency(s.totalAmount)}</td>
                                      <td className="p-4 text-right"><button onClick={() => initiateReturn(s)} className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center justify-end w-full"><RotateCcw size={12} className="mr-1"/> Return Items</button></td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* Existing modals maintained */}
      {showReceipt && (completedSale || completedPayment) && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-10 duration-300"><div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl no-print"><h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Printer className="mr-2" size={20}/> Print Receipt</h3><button onClick={handleNewSale} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button></div><div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 no-print"><div className="flex justify-center space-x-2 mb-4">{(['80mm', '58mm', 'A4'] as const).map(fmt => (<button key={fmt} onClick={() => setPrintFormat(fmt)} className={`px-3 py-1.5 text-xs font-bold rounded border transition ${printFormat === fmt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>{fmt}</button>))}</div><button onClick={handlePrintReceipt} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md flex items-center justify-center transition"><Printer size={20} className="mr-2"/> Print Receipt</button></div><div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900 p-4 flex justify-center"><div id="receipt-content" className={`bg-white text-black shadow-lg mx-auto overflow-hidden flex flex-col ${printFormat === '80mm' ? 'w-[80mm] p-4 text-xs' : printFormat === '58mm' ? 'w-[58mm] p-2 text-[10px]' : 'w-[210mm] p-10 text-sm'}`}><div className="text-center mb-4">{storeSettings.storeLogo && (<div className="flex justify-center mb-2"><img src={storeSettings.storeLogo} alt="Logo" className="h-16 object-contain" /></div>)}<h1 className={`font-bold uppercase tracking-wider mb-1 ${printFormat === 'A4' ? 'text-2xl' : 'text-base'}`}>{storeSettings.storeName}</h1><div className="text-gray-500 space-y-0.5 leading-tight"><p>{storeSettings.storeAddress}</p><p>Tel: {storeSettings.storePhone}</p>{storeSettings.storeEmail && <p>{storeSettings.storeEmail}</p>}</div></div><div className="border-b border-dashed border-gray-400 mb-2"></div>{completedPayment && (<><div className="text-center mb-4"><h2 className="font-bold text-lg uppercase">Payment Receipt</h2><p className="text-gray-500">{new Date(completedPayment.timestamp).toLocaleString()}</p></div><div className="space-y-2 mb-4"><div className="flex justify-between"><span>Customer:</span><span className="font-bold">{completedPayment.customerName}</span></div><div className="flex justify-between"><span>Ref ID:</span><span>{completedPayment.id.split('-')[1]}</span></div><div className="border-b border-dashed border-gray-400 my-2"></div><div className="flex justify-between"><span>Previous Balance:</span><span>{symbol}{formatCurrency(completedPayment.newBalance - completedPayment.amount)}</span></div><div className="flex justify-between font-bold text-lg"><span>Amount Paid:</span><span>{symbol}{formatCurrency(completedPayment.amount)}</span></div><div className="flex justify-between text-gray-600"><span>Method:</span><span>{completedPayment.paymentMethod || 'CASH'}</span></div><div className="border-b border-dashed border-gray-400 my-2"></div><div className="flex justify-between font-bold"><span>New Balance:</span><span>{symbol}{formatCurrency(completedPayment.newBalance)}</span></div></div></>)}{completedSale && (<><div className="mb-2 space-y-1"><div className="flex justify-between"><span>Date: {new Date(completedSale.timestamp).toLocaleDateString()}</span><span>Time: {new Date(completedSale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><div className="flex justify-between"><span>Order #: {completedSale.id.split('-')[1]}</span><span>Cashier: {currentUser.name.split(' ')[0]}</span></div>{completedSale.customerName && (<div className="flex justify-between font-bold mt-1"><span>Customer:</span><span>{completedSale.customerName}</span></div>)}</div><div className="border-b border-dashed border-gray-400 mb-2"></div><div className="flex font-bold mb-1 pb-1 border-b border-gray-300"><span className="flex-1">Item</span><span className="w-8 text-center">Qty</span><span className="w-16 text-right">Price</span><span className="w-16 text-right">Total</span></div><div className="flex-1 mb-2">{completedSale.items.map((item, idx) => { const product = products.find(p => p.id === item.productId); return (<div key={idx} className="mb-2"><div className="font-bold">{item.productName}{item.unit && <span className="text-[10px] font-normal ml-1">({item.unit})</span>}</div>{product?.sku && <div className="text-[10px] text-gray-500 mb-0.5">SKU: {product.sku}</div>}<div className="flex"><span className="flex-1"></span><span className="w-8 text-center">{item.quantity}</span><span className="w-16 text-right">{symbol}{formatCurrency(item.priceAtSale)}</span><span className="w-16 text-right font-bold">{symbol}{formatCurrency(item.priceAtSale * item.quantity)}</span></div></div>); })}</div><div className="border-b border-dashed border-gray-400 mb-2"></div><div className="space-y-1 text-right mb-2"><div className="flex justify-between"><span>Subtotal</span><span>{symbol}{formatCurrency(completedSale.subTotal)}</span></div>{completedSale.taxRate && completedSale.taxRate > 0 && (<div className="flex justify-between text-gray-600 text-xs"><span>{completedSale.taxName} ({completedSale.taxRate}%){completedSale.taxType === 'INCLUSIVE' ? ' (Included)' : ' (Added)'}</span><span>{symbol}{formatCurrency(completedSale.totalTax)}</span></div>)}{completedSale.creditMarkupAmount && completedSale.creditMarkupAmount > 0 && (<div className="flex justify-between text-gray-600 text-xs"><span>Interest ({completedSale.creditMarkupRate}%) {completedSale.creditTermName}</span><span>{symbol}{formatCurrency(completedSale.creditMarkupAmount)}</span></div>)}<div className="flex justify-between font-bold text-lg border-t border-black pt-1 mt-1"><span>TOTAL</span><span>{symbol}{formatCurrency(completedSale.totalAmount)}</span></div></div><div className="mb-4 pt-1 border-t border-dashed border-gray-400"><div className="flex justify-between font-bold text-sm"><span>Payment Method:</span><span className="uppercase">{completedSale.paymentMethod.replace('_', ' ')}</span></div>{completedSale.paymentMethod === 'STORE_CREDIT' && completedSale.creditDueDate && (<div className="flex justify-between text-xs mt-1 font-medium"><span>Due Date:</span><span>{new Date(completedSale.creditDueDate).toLocaleDateString()}</span></div>)}{completedSale.paymentMethod === 'CASH' && completedSale.amountTendered !== undefined && (<><div className="flex justify-between text-xs mt-1"><span>Cash Tendered:</span><span>{symbol}{formatCurrency(completedSale.amountTendered)}</span></div><div className="flex justify-between text-xs"><span>Change:</span><span>{symbol}{formatCurrency(completedSale.change || 0)}</span></div></>)}</div></>)}<div className="text-center mt-auto">{storeSettings.receiptHeader && <p className="font-bold mb-1">{storeSettings.receiptHeader}</p>}{storeSettings.receiptFooter ? <p className="text-xs text-gray-500 mb-2 whitespace-pre-wrap">{storeSettings.receiptFooter}</p> : <p className="text-xs text-gray-500 mb-2">Thank you for your business!</p>}{completedSale && <SimpleBarcode value={completedSale.id.toUpperCase()} />}{completedPayment && <SimpleBarcode value={completedPayment.id.toUpperCase()} />}</div></div></div><div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 rounded-b-xl flex justify-center no-print"><button onClick={handleNewSale} className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Start New Sale</button></div></div></div>
        )}
        
        {isCustomerModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-sm:w-full max-w-sm p-6 animate-in slide-in-from-top-10 duration-200"><h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">New Customer</h3><div className="space-y-4"><div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name <span className="text-red-500">*</span></label><input type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} className={inputClass} placeholder="Full Name" /></div><div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Phone</label><input type="text" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} className={inputClass} /></div><div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label><input type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} className={inputClass} /></div><div className="flex justify-end space-x-2 pt-2"><button onClick={() => setIsCustomerModalOpen(false)} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg">Cancel</button><button onClick={handleCreateCustomer} disabled={!newCustomerName} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button></div></div></div>
            </div>
        )}

        {isHoldModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-sm:w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200"><div className="flex items-center text-orange-600 mb-4"><PauseCircle size={24} className="mr-2"/><h3 className="text-lg font-bold text-slate-800 dark:text-white">Hold Transaction</h3></div><p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Save current transaction to resume later. This will clear the current cart.</p><div className="space-y-4"><div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Customer</label><div className="font-bold text-slate-800 dark:text-white">{selectedCustomer?.name || 'Guest'}</div></div><div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Resume Within (Minutes)</label><div className="flex space-x-2 mb-2">{[15, 30, 60].map(m => (<button key={m} onClick={() => setHoldDuration(m)} className={`flex-1 py-2 text-sm font-medium rounded border ${holdDuration === m ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'}`}>{m}m</button>))}</div><input type="number" min="1" value={holdDuration || ''} onChange={e => setHoldDuration(Math.max(1, parseInt(e.target.value) || 0))} className={inputClass} placeholder="Custom minutes"/></div><div><label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Note (Optional)</label><input type="text" value={holdNote} onChange={e => setHoldNote(e.target.value)} className={inputClass} placeholder="e.g. Forgot wallet"/></div></div><div className="flex justify-end space-x-2 mt-6"><button onClick={() => setIsHoldModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg">Cancel</button><button onClick={confirmHold} className="px-4 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 shadow-md">Confirm Hold</button></div></div>
          </div>
        )}

        {isHeldListOpen && (
            <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"><div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl"><h3 className="font-bold text-slate-800 dark:text-white flex items-center"><PauseCircle className="mr-2 text-orange-500" size={20}/> Held Transactions</h3><button onClick={() => setIsHeldListOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button></div><div className="p-4 border-b border-slate-100 dark:border-slate-700"><div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search holds..." value={heldSearch} onChange={(e) => setHeldSearch(e.target.value)} className={inputClass} /></div></div><div className="flex-1 overflow-y-auto p-4 space-y-3">{filteredHeldTransactions.length === 0 ? <div className="text-center text-slate-400 py-8">No held transactions found.</div> : filteredHeldTransactions.map(h => { const timeLeft = h.expiryTime - Date.now(); const isExpired = timeLeft < 0; return (<div key={h.id} className={`p-4 rounded-lg border flex justify-between items-center ${isExpired ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800' : 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'}`}><div><div className="font-bold text-slate-800 dark:text-white">{h.customer.name}</div><div className="text-xs text-slate-500 dark:text-slate-400">{h.items.length} items • held {new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>{h.note && <div className="text-xs italic text-slate-500 mt-1">"{h.note}"</div>}<div className={`text-xs font-bold mt-1 ${isExpired ? 'text-red-500' : 'text-orange-500'}`}>{isExpired ? 'Expired' : `Expires in ${Math.ceil(timeLeft / 60000)} mins`}</div></div><div className="flex flex-col gap-2"><button onClick={() => resumeHold(h)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 shadow-sm flex items-center justify-center"><PlayCircle size={14} className="mr-1"/> Resume</button><button onClick={() => onVoidHold(h.id)} className="px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 text-xs font-bold rounded border border-red-200 dark:border-red-800 flex items-center justify-center"><Trash size={14} className="mr-1"/> Void</button></div></div>); })}</div></div>
            </div>
        )}
    </div>
  );
});

export default POS;