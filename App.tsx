import React, { useState, useEffect, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS, { POSRef } from './components/POS';
import UserManagement from './components/UserManagement';
import PurchaseOrders from './components/PurchaseOrders';
import Customers from './components/Customers';
import SalesHistory from './components/SalesHistory';
import Settings from './components/Settings';
import Login from './components/Login';
import ToastContainer from './components/Toast';
import { User, Product, Sale, UserRole, PurchaseOrder, PurchaseOrderStatus, Customer, StockAdjustment, ReturnTransaction, CustomerSegment, CreditAdjustment, HoldTransaction, ToastMessage, StoreSettings, PriceHistory } from './types';
import { INITIAL_USERS, INITIAL_PRODUCTS, INITIAL_PURCHASE_ORDERS, INITIAL_CUSTOMERS, INITIAL_STOCK_ADJUSTMENTS, INITIAL_RETURNS, INITIAL_SEGMENTS, INITIAL_CREDIT_ADJUSTMENTS, INITIAL_STORE_SETTINGS, INITIAL_PRICE_HISTORY, ROLE_PERMISSIONS } from './constants';
import { AlertCircle, PlayCircle, Clock, Bell } from 'lucide-react';

const App: React.FC = () => {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('nexus_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Currency State (Derived from settings but also can be switched via header)
  const [currency, setCurrency] = useState(() => {
    return localStorage.getItem('nexus_currency') || 'USD';
  });

  // Store Settings
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
      const saved = localStorage.getItem('nexus_store_settings');
      return saved ? JSON.parse(saved) : INITIAL_STORE_SETTINGS;
  });

  // Toasts State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO' = 'SUCCESS') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Theme Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nexus_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nexus_theme', 'light');
    }
  }, [isDarkMode]);

  // Currency Persistence
  useEffect(() => {
    localStorage.setItem('nexus_currency', currency);
  }, [currency]);

  // Settings Persistence
  useEffect(() => {
      localStorage.setItem('nexus_store_settings', JSON.stringify(storeSettings));
  }, [storeSettings]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  
  // Data State (Mocking a database)
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('nexus_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });
  
  // Users state with Migration Logic for new fields
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('nexus_users');
    if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: Ensure users have passwords and permissions
        return parsed.map((u: any) => ({
            ...u,
            password: u.password || '1234',
            permissions: u.permissions || ROLE_PERMISSIONS[u.role as UserRole] || []
        }));
    }
    return INITIAL_USERS;
  });
  
  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('nexus_sales');
    return saved ? JSON.parse(saved) : [];
  });

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const saved = localStorage.getItem('nexus_purchase_orders');
    return saved ? JSON.parse(saved) : INITIAL_PURCHASE_ORDERS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('nexus_customers');
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [segments, setSegments] = useState<CustomerSegment[]>(() => {
    const saved = localStorage.getItem('nexus_customer_segments');
    return saved ? JSON.parse(saved) : INITIAL_SEGMENTS;
  });

  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(() => {
    const saved = localStorage.getItem('nexus_stock_adjustments');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_ADJUSTMENTS;
  });

  const [returns, setReturns] = useState<ReturnTransaction[]>(() => {
    const saved = localStorage.getItem('nexus_returns');
    return saved ? JSON.parse(saved) : INITIAL_RETURNS;
  });

  const [creditAdjustments, setCreditAdjustments] = useState<CreditAdjustment[]>(() => {
    const saved = localStorage.getItem('nexus_credit_adjustments');
    return saved ? JSON.parse(saved) : INITIAL_CREDIT_ADJUSTMENTS;
  });

  const [heldTransactions, setHeldTransactions] = useState<HoldTransaction[]>(() => {
    const saved = localStorage.getItem('nexus_held_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>(() => {
    const saved = localStorage.getItem('nexus_price_history');
    return saved ? JSON.parse(saved) : INITIAL_PRICE_HISTORY;
  });

  // POS State & Refs
  const [posHasItems, setPosHasItems] = useState(false);
  const posRef = useRef<POSRef>(null);
  
  // Urgent Hold Notification State (Array)
  const [urgentHolds, setUrgentHolds] = useState<HoldTransaction[]>([]);
  const [resumeHoldId, setResumeHoldId] = useState<string | null>(null);
  const [, setTick] = useState(0); // Force update for timer

  // Persistence
  useEffect(() => {
    localStorage.setItem('nexus_products', JSON.stringify(products));
    localStorage.setItem('nexus_users', JSON.stringify(users));
    localStorage.setItem('nexus_sales', JSON.stringify(sales));
    localStorage.setItem('nexus_purchase_orders', JSON.stringify(purchaseOrders));
    localStorage.setItem('nexus_customers', JSON.stringify(customers));
    localStorage.setItem('nexus_customer_segments', JSON.stringify(segments));
    localStorage.setItem('nexus_stock_adjustments', JSON.stringify(stockAdjustments));
    localStorage.setItem('nexus_returns', JSON.stringify(returns));
    localStorage.setItem('nexus_credit_adjustments', JSON.stringify(creditAdjustments));
    localStorage.setItem('nexus_held_transactions', JSON.stringify(heldTransactions));
    localStorage.setItem('nexus_price_history', JSON.stringify(priceHistory));
  }, [products, users, sales, purchaseOrders, customers, segments, stockAdjustments, returns, creditAdjustments, heldTransactions, priceHistory]);

  // Monitor Urgent Holds
  useEffect(() => {
      const interval = setInterval(() => {
          setTick(t => t + 1); // Force re-render for countdown
          
          if (heldTransactions.length === 0) {
              setUrgentHolds([]);
              return;
          }

          const now = Date.now();
          // Find ALL holds expiring in less than 5 minutes (300000ms) but not yet expired
          const urgents = heldTransactions
              .filter(h => h.expiryTime > now && (h.expiryTime - now) < 5 * 60 * 1000)
              .sort((a, b) => a.expiryTime - b.expiryTime); // Sort by soonest expiry first

          setUrgentHolds(urgents);
      }, 1000);

      return () => clearInterval(interval);
  }, [heldTransactions]);

  // Handle Role-Based View Access
  useEffect(() => {
    if (currentUser) {
        // Simple redirect if user is on a page they no longer have permission for
        // Ideally, Layout handles visibility, but this handles initial load/state changes
        // For now, we trust Layout to hide links, and if they are on a dead link, they see empty content or we could redirect to Dashboard
    }
  }, [currentUser, currentView]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    
    // Smart Redirect based on permissions
    if (user.permissions.includes('VIEW_DASHBOARD')) setCurrentView('dashboard');
    else if (user.permissions.includes('POS')) setCurrentView('pos');
    else if (user.permissions.includes('MANAGE_INVENTORY')) setCurrentView('inventory');
    else setCurrentView('dashboard'); // Fallback

    showToast(`Access Granted. Welcome back, ${user.name}!`, 'SUCCESS');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    showToast('Logged out successfully. See you soon!', 'INFO');
  };

  const handleNavigate = (view: string) => {
      // Validation Logic: Prevent navigating away from POS if items are in cart
      if (currentView === 'pos' && posHasItems && view !== 'pos') {
          showToast("Active transaction detected. Please Hold or Complete it first.", 'ERROR');
          // Trigger the Hold Modal inside POS to guide the user
          posRef.current?.triggerHold();
          return;
      }
      setCurrentView(view);
  };

  const handleUpdateSettings = (newSettings: StoreSettings) => {
      setStoreSettings(newSettings);
      showToast("Store settings updated successfully.", 'SUCCESS');
  };

  const handleSaleComplete = (newSale: Sale) => {
    setSales(prev => [...prev, newSale]);
    setProducts(prev => prev.map(p => {
        const soldItem = newSale.items.find(i => i.productId === p.id);
        if (soldItem) {
            return { ...p, stock: p.stock - soldItem.quantity };
        }
        return p;
    }));

    if (newSale.customerId) {
      setCustomers(prev => prev.map(c => {
        if (c.id === newSale.customerId) {
          let newCredit = c.storeCredit || 0;
          if (newSale.paymentMethod === 'STORE_CREDIT') {
              newCredit = Math.max(0, newCredit - newSale.totalAmount);
          }
          return {
            ...c,
            visitCount: c.visitCount + 1,
            totalSpent: c.totalSpent + newSale.totalAmount,
            lastVisit: newSale.timestamp,
            storeCredit: newCredit
          };
        }
        return c;
      }));
    }
    showToast(`Sale #${newSale.id.split('-')[1]} completed successfully!`, 'SUCCESS');
  };

  const handleProcessReturn = (returnTx: ReturnTransaction) => {
      setReturns(prev => [...prev, returnTx]);
      let restockedCount = 0;
      setProducts(prev => prev.map(p => {
          const returnItem = returnTx.items.find(ri => ri.productId === p.id);
          if (returnItem && returnItem.restock) {
              restockedCount += returnItem.quantity;
              return { ...p, stock: p.stock + returnItem.quantity };
          }
          return p;
      }));

      if (returnTx.customerId) {
          setCustomers(prev => prev.map(c => {
              if (c.id === returnTx.customerId) {
                  const updatedCredit = returnTx.refundMethod === 'STORE_CREDIT' 
                    ? (c.storeCredit || 0) + returnTx.totalRefund 
                    : c.storeCredit;
                  const updatedTotalSpent = Math.max(0, c.totalSpent - returnTx.totalRefund);
                  return { 
                      ...c, 
                      storeCredit: updatedCredit,
                      totalSpent: updatedTotalSpent
                  };
              }
              return c;
          }));
      }

      showToast(`Return processed. ${restockedCount} items restocked.`, 'SUCCESS');
  };

  const handleSaveOrder = (order: PurchaseOrder) => {
    let isNew = false;
    setPurchaseOrders(prev => {
      const existingIndex = prev.findIndex(o => o.id === order.id);
      if (existingIndex >= 0) {
        const newOrders = [...prev];
        newOrders[existingIndex] = order;
        return newOrders;
      }
      isNew = true;
      return [order, ...prev];
    });
    showToast(`Purchase Order ${isNew ? 'created' : 'updated'} successfully.`, 'SUCCESS');
  };

  const handleDeleteOrder = (orderId: string) => {
    setPurchaseOrders(prev => prev.filter(o => o.id !== orderId));
    showToast('Purchase Order deleted.', 'INFO');
  };

  const handleUpdatePOStatus = (orderId: string, newStatus: PurchaseOrderStatus) => {
    let updatedOrder: PurchaseOrder | undefined;

    setPurchaseOrders(prev => {
      const newOrders = prev.map(o => {
          if (o.id === orderId) {
              updatedOrder = { ...o, status: newStatus };
              return updatedOrder;
          }
          return o;
      });
      return newOrders;
    });

    const order = purchaseOrders.find(o => o.id === orderId);
    if (order && newStatus === 'RECEIVED' && order.status !== 'RECEIVED') {
        setProducts(prevProducts => {
            const updatedProducts = [...prevProducts];
            order.items.forEach(item => {
                const productIndex = updatedProducts.findIndex(p => p.id === item.productId);
                if (productIndex >= 0) {
                    updatedProducts[productIndex] = {
                        ...updatedProducts[productIndex],
                        stock: updatedProducts[productIndex].stock + item.quantity
                    };
                }
            });
            return updatedProducts;
        });
        showToast('Inventory stock updated from received order.', 'SUCCESS');
    } else {
        showToast(`Order status updated to ${newStatus}.`, 'SUCCESS');
    }
  };

  const handleAdjustStock = (adjustment: StockAdjustment) => {
      setStockAdjustments(prev => [...prev, adjustment]);
      setProducts(prev => prev.map(p => {
          if (p.id === adjustment.productId) {
              return { ...p, stock: adjustment.newStock };
          }
          return p;
      }));
      showToast(`Stock adjusted for ${adjustment.productName}.`, 'SUCCESS');
  };

  const handleBulkAdjustStock = (adjustments: StockAdjustment[]) => {
      setStockAdjustments(prev => [...prev, ...adjustments]);
      
      const adjMap = new Map<string, number>();
      adjustments.forEach(a => adjMap.set(a.productId, a.newStock));

      setProducts(prev => prev.map(p => {
          if (adjMap.has(p.id)) {
              return { ...p, stock: adjMap.get(p.id)! };
          }
          return p;
      }));
      showToast(`Bulk updated ${adjustments.length} products.`, 'SUCCESS');
  };

  // Customer Management Handlers
  const handleAddCustomer = (customer: Customer) => {
      setCustomers(prev => [...prev, customer]);
      showToast('Customer profile created.', 'SUCCESS');
  };

  const handleUpdateCustomer = (customer: Customer) => {
      setCustomers(prev => prev.map(c => c.id === customer.id ? customer : c));
      showToast('Customer profile updated.', 'SUCCESS');
  };

  const handleDeleteCustomer = (id: string) => {
      setCustomers(prev => prev.filter(c => c.id !== id));
      showToast('Customer profile deleted.', 'INFO');
  };

  const handleAddSegment = (segment: CustomerSegment) => {
      setSegments(prev => [...prev, segment]);
      showToast('Customer segment created.', 'SUCCESS');
  };

  const handleDeleteSegment = (id: string) => {
      setSegments(prev => prev.filter(s => s.id !== id));
      showToast('Customer segment deleted.', 'INFO');
  };

  const handleAddCreditAdjustment = (adj: CreditAdjustment) => {
      setCreditAdjustments(prev => [...prev, adj]);
      setCustomers(prev => prev.map(c => {
          if (c.id === adj.customerId) {
              return { ...c, storeCredit: adj.newBalance };
          }
          return c;
      }));
      showToast(`Store credit ${adj.type === 'ADD' ? 'added' : 'deducted'} successfully.`, 'SUCCESS');
  }

  // User Management Handlers
  const handleAddUser = (newUser: User) => {
      if (users.find(u => u.email === newUser.email)) {
          showToast('Email already in use.', 'ERROR');
          return;
      }
      setUsers(prev => [...prev, newUser]);
      showToast(`User ${newUser.name} created.`, 'SUCCESS');
  };

  const handleUpdateUser = (updatedUser: User) => {
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      if (currentUser?.id === updatedUser.id) {
          setCurrentUser(updatedUser); // Update active session if editing self
      }
      showToast(`User ${updatedUser.name} updated.`, 'SUCCESS');
  };

  const handleDeleteUser = (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
      showToast('User removed.', 'INFO');
  };

  const handleHoldTransaction = (hold: HoldTransaction) => {
      setHeldTransactions(prev => [...prev, hold]);
      setProducts(prev => prev.map(p => {
          const item = hold.items.find(i => i.id === p.id);
          if (item) {
              return { ...p, stock: p.stock - item.quantity };
          }
          return p;
      }));
      showToast('Transaction held successfully.', 'SUCCESS');
  };

  const handleResumeHold = (holdId: string) => {
      const hold = heldTransactions.find(h => h.id === holdId);
      if (hold) {
          setHeldTransactions(prev => prev.filter(h => h.id !== holdId));
          setProducts(prev => prev.map(p => {
              const item = hold.items.find(i => i.id === p.id);
              if (item) {
                  return { ...p, stock: p.stock + item.quantity };
              }
              return p;
          }));
          // Toast is handled in POS component when cart is populated
      }
  };

  const handleVoidHold = (holdId: string) => {
      const hold = heldTransactions.find(h => h.id === holdId);
      if (hold) {
          setHeldTransactions(prev => prev.filter(h => h.id !== holdId));
          setProducts(prev => prev.map(p => {
              const item = hold.items.find(i => i.id === p.id);
              if (item) {
                  return { ...p, stock: p.stock + item.quantity };
              }
              return p;
          }));
          showToast('Hold transaction voided. Stock returned.', 'INFO');
      }
  };

  const handleLogPriceChange = (log: PriceHistory) => {
      setPriceHistory(prev => [...prev, log]);
  };

  // Floating Notification Handler for a specific hold
  const handleUrgentHoldClick = (holdId: string) => {
      setResumeHoldId(holdId);
      setCurrentView('pos');
  };

  return (
    <>
      {/* Root Layout Wrapper */}
      {!currentUser ? (
        <Login 
          users={users} 
          onLogin={handleLogin} 
          isDarkMode={isDarkMode}
          onToggleTheme={toggleTheme}
        />
      ) : (
        <>
          {/* Floating Notifications Stack */}
          {urgentHolds.length > 0 && (
              <div className="fixed top-20 right-4 z-[50] flex flex-col items-end gap-2 w-full max-w-sm pointer-events-none">
                  {urgentHolds.slice(0, 3).map(hold => {
                      const diff = Math.max(0, hold.expiryTime - Date.now());
                      const isCritical = diff < 60 * 1000; // Less than 1 minute
                      
                      return (
                      <div 
                        key={hold.id}
                        onClick={() => handleUrgentHoldClick(hold.id)}
                        className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg flex items-center space-x-3 cursor-pointer transition-all transform hover:scale-105 hover:-translate-x-1 w-auto backdrop-blur-md border border-white/20
                            ${isCritical 
                                ? 'bg-red-500/95 hover:bg-red-600 text-white shadow-red-500/30' 
                                : 'bg-amber-500/95 hover:bg-amber-600 text-white shadow-amber-500/30'}`}
                      >
                          <AlertCircle className={`shrink-0 ${isCritical ? 'animate-pulse' : ''}`} size={20} />
                          <div className="flex flex-col items-start leading-tight">
                              <span className="font-bold text-[10px] uppercase tracking-wider opacity-90">{isCritical ? 'Expiring Now!' : 'Expiring Soon'}</span>
                              <span className="text-xs font-semibold">
                                  {hold.customer.name} • 
                                  {(() => {
                                      const m = Math.floor(diff / 60000);
                                      const s = Math.floor((diff % 60000) / 1000);
                                      return ` ${m}:${s.toString().padStart(2, '0')}`;
                                  })()}
                              </span>
                          </div>
                          <div className="pl-3 border-l border-white/20 flex items-center font-bold text-xs shrink-0">
                              <PlayCircle size={16} className="mr-1"/> Resume
                          </div>
                      </div>
                  )})}
                  
                  {urgentHolds.length > 3 && (
                      <div className="bg-slate-800/90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm shadow-md flex items-center">
                          <Bell size={12} className="mr-1.5"/> +{urgentHolds.length - 3} more urgent
                      </div>
                  )}
              </div>
          )}

          <Layout 
            currentUser={currentUser} 
            currentView={currentView} 
            onNavigate={handleNavigate} 
            onLogout={handleLogout}
            isDarkMode={isDarkMode}
            onToggleTheme={toggleTheme}
            currency={currency}
            onCurrencyChange={setCurrency}
            storeSettings={storeSettings}
          >
            {currentView === 'dashboard' && (
              <Dashboard 
                sales={sales} 
                products={products} 
                returns={returns}
                currency={currency} 
              />
            )}
            
            {currentView === 'inventory' && (
              <Inventory 
                products={products} 
                setProducts={setProducts} 
                stockAdjustments={stockAdjustments}
                onAdjustStock={handleAdjustStock}
                onBulkAdjustStock={handleBulkAdjustStock}
                currentUser={currentUser}
                currency={currency}
                showToast={showToast}
                returns={returns}
                customers={customers}
                sales={sales}
                priceHistory={priceHistory}
                onLogPriceChange={handleLogPriceChange}
              />
            )}
            
            {currentView === 'pos' && (
              <POS 
                ref={posRef}
                products={products} 
                onCompleteSale={handleSaleComplete} 
                currentUser={currentUser} 
                customers={customers}
                onAddCustomer={handleAddCustomer}
                sales={sales}
                returns={returns}
                onProcessReturn={handleProcessReturn}
                heldTransactions={heldTransactions}
                onHoldTransaction={handleHoldTransaction}
                onResumeHold={handleResumeHold}
                onVoidHold={handleVoidHold}
                currency={currency}
                showToast={showToast}
                storeSettings={storeSettings}
                onCartUpdate={setPosHasItems}
                resumeHoldId={resumeHoldId}
                onClearResumeHold={() => setResumeHoldId(null)}
              />
            )}

            {currentView === 'sales' && (
              <SalesHistory 
                sales={sales}
                returns={returns}
                users={users}
                customers={customers}
                currency={currency}
              />
            )}
            
            {currentView === 'customers' && (
              <Customers 
                customers={customers}
                onAddCustomer={handleAddCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                sales={sales}
                returns={returns}
                segments={segments}
                onAddSegment={handleAddSegment}
                onDeleteSegment={handleDeleteSegment}
                currentUser={currentUser}
                creditAdjustments={creditAdjustments}
                onAddCreditAdjustment={handleAddCreditAdjustment}
                currency={currency}
              />
            )}

            {currentView === 'purchase-orders' && (
              <PurchaseOrders 
                orders={purchaseOrders} 
                products={products}
                onSaveOrder={handleSaveOrder}
                onUpdateStatus={handleUpdatePOStatus}
                onDeleteOrder={handleDeleteOrder}
                currency={currency}
              />
            )}
            
            {currentView === 'users' && (
              <UserManagement 
                users={users} 
                onAddUser={handleAddUser}
                onUpdateUser={handleUpdateUser}
                onDeleteUser={handleDeleteUser}
                currentUser={currentUser}
              />
            )}

            {currentView === 'settings' && (
                <Settings 
                    settings={storeSettings}
                    onUpdateSettings={handleUpdateSettings}
                    currency={currency}
                    onCurrencyChange={setCurrency}
                />
            )}
          </Layout>
        </>
      )}
      
      {/* Toast Container remains mounted at root level */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
};

export default App;