
import React, { useState, useRef, useEffect } from 'react';
import { Sale, ReturnTransaction, User, Customer } from '../types';
import { Search, Calendar, Filter, Eye, RotateCcw, CheckCircle, AlertTriangle, User as UserIcon, CreditCard, Banknote, Smartphone, Wallet, X, ChevronDown, TrendingUp, ShoppingBag, ArrowDownRight, DollarSign, Coins } from 'lucide-react';

interface SalesHistoryProps {
  sales: Sale[];
  returns: ReturnTransaction[];
  users: User[];
  customers: Customer[];
  currency: string;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ 
  sales, 
  returns, 
  users, 
  customers, 
  currency 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Range State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'RETURNED' | 'PARTIAL'>('ALL');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const getCurrencySymbol = (code: string) => {
    switch(code) {
      case 'PHP': return '₱';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  };
  const symbol = getCurrencySymbol(currency);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateFilterRef.current && !dateFilterRef.current.contains(event.target as Node)) {
        setIsDateFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Date Presets Logic
  const applyDatePreset = (preset: 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR') => {
      const today = new Date();
      let start = new Date();
      let end = new Date();

      switch(preset) {
          case 'TODAY':
              // start/end are today
              break;
          case 'YESTERDAY':
              start.setDate(today.getDate() - 1);
              end.setDate(today.getDate() - 1);
              break;
          case 'LAST_7':
              start.setDate(today.getDate() - 7);
              break;
          case 'LAST_30':
              start.setDate(today.getDate() - 30);
              break;
          case 'THIS_MONTH':
              start = new Date(today.getFullYear(), today.getMonth(), 1);
              break;
          case 'LAST_MONTH':
              start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              end = new Date(today.getFullYear(), today.getMonth(), 0);
              break;
          case 'THIS_YEAR':
              start = new Date(today.getFullYear(), 0, 1);
              break;
      }
      
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
      setIsDateFilterOpen(false);
  };

  // Helper to check return status
  const getSaleStatus = (saleId: string) => {
    const saleReturns = returns.filter(r => r.originalSaleId === saleId);
    if (saleReturns.length === 0) return 'COMPLETED';
    
    // Check if fully returned
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return 'COMPLETED';
    
    const totalSold = sale.items.reduce((sum, i) => sum + i.quantity, 0);
    const totalReturned = saleReturns.reduce((sum, r) => sum + r.items.reduce((riSum, ri) => riSum + ri.quantity, 0), 0);
    
    if (totalReturned >= totalSold) return 'RETURNED'; // Fully Returned
    return 'PARTIAL'; // Partially Returned
  };

  const filteredSales = sales.filter(sale => {
    // Search Filter
    const searchMatch = 
      sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.customerName && sale.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      users.find(u => u.id === sale.cashierId)?.name.toLowerCase().includes(searchTerm.toLowerCase());

    // Date Range Filter
    let dateMatch = true;
    if (startDate || endDate) {
        const saleDate = new Date(sale.timestamp);
        saleDate.setHours(0,0,0,0);
        
        if (startDate) {
            const start = new Date(startDate);
            start.setHours(0,0,0,0);
            if (saleDate.getTime() < start.getTime()) dateMatch = false;
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23,59,59,999);
            if (saleDate.getTime() > end.getTime()) dateMatch = false;
        }
    }

    // Status Filter
    let statusMatch = true;
    if (statusFilter !== 'ALL') {
        const status = getSaleStatus(sale.id);
        if (statusFilter === 'COMPLETED' && status !== 'COMPLETED') statusMatch = false;
        if (statusFilter === 'RETURNED' && status !== 'RETURNED') statusMatch = false;
        if (statusFilter === 'PARTIAL' && status !== 'PARTIAL') statusMatch = false;
    }

    return searchMatch && dateMatch && statusMatch;
  }).sort((a, b) => b.timestamp - a.timestamp);

  // --- Summary Calculations ---
  const totalOrders = filteredSales.length;
  const grossSales = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);

  // Calculate refunds specifically linked to the filtered sales
  const filteredSaleIds = new Set(filteredSales.map(s => s.id));
  const relatedReturns = returns.filter(r => filteredSaleIds.has(r.originalSaleId));
  const totalRefunded = relatedReturns.reduce((sum, r) => sum + r.totalRefund, 0);

  const netSales = grossSales - totalRefunded;

  // Profit Calculations
  const grossProfit = filteredSales.reduce((sum, s) => sum + s.totalProfit, 0);
  
  // Calculate Profit Lost from Returns (Need to check original sale items for cost basis)
  const profitLost = relatedReturns.reduce((acc, ret) => {
      const originalSale = sales.find(s => s.id === ret.originalSaleId);
      if (!originalSale) return acc;

      const returnProfitLoss = ret.items.reduce((pLoss, rItem) => {
          const originalItem = originalSale.items.find(i => i.productId === rItem.productId);
          if (!originalItem) return pLoss;
          
          const unitProfit = originalItem.priceAtSale - originalItem.costAtSale;
          return pLoss + (unitProfit * rItem.quantity);
      }, 0);
      
      return acc + returnProfitLoss;
  }, 0);

  const netProfit = grossProfit - profitLost;


  const getPaymentIcon = (method: string) => {
      switch(method) {
          case 'CASH': return <Banknote size={14} className="mr-1"/>;
          case 'CARD': return <CreditCard size={14} className="mr-1"/>;
          case 'DIGITAL': return <Smartphone size={14} className="mr-1"/>;
          case 'STORE_CREDIT': return <Wallet size={14} className="mr-1"/>;
          default: return null;
      }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'COMPLETED': return (
              <span className="flex items-center text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                  <CheckCircle size={12} className="mr-1"/> Completed
              </span>
          );
          case 'RETURNED': return (
              <span className="flex items-center text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-1 rounded">
                  <RotateCcw size={12} className="mr-1"/> Fully Returned
              </span>
          );
          case 'PARTIAL': return (
              <span className="flex items-center text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded">
                  <AlertTriangle size={12} className="mr-1"/> Partial Return
              </span>
          );
          default: return null;
      }
  };

  const saleReturns = selectedSale ? returns.filter(r => r.originalSaleId === selectedSale.id) : [];

  // Calculation for the modal
  const modalTotalRefunded = saleReturns.reduce((sum, r) => sum + r.totalRefund, 0);
  const modalNetTotal = selectedSale ? selectedSale.totalAmount - modalTotalRefunded : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Sales History</h2>
          <p className="text-slate-500 text-sm mt-1">View transaction logs, summaries, and detailed return information.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Search</label>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Order ID, Customer, or Cashier..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-700 dark:text-white dark:placeholder-slate-400"
                />
            </div>
          </div>
          
          {/* Unified Date Range Picker */}
          <div className="relative w-full md:w-auto" ref={dateFilterRef}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Date Range</label>
              <button
                  onClick={() => setIsDateFilterOpen(!isDateFilterOpen)}
                  className="w-full md:w-64 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-600 transition"
              >
                  <span className="text-sm flex items-center truncate">
                      <Calendar size={16} className="mr-2 text-slate-400 shrink-0"/>
                      {startDate && endDate ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}` : 
                       startDate ? `From ${new Date(startDate).toLocaleDateString()}` :
                       endDate ? `Until ${new Date(endDate).toLocaleDateString()}` :
                       'All Dates'}
                  </span>
                  <ChevronDown size={14} className="ml-2 text-slate-400 shrink-0" />
              </button>

              {isDateFilterOpen && (
                  <div className="absolute right-0 md:left-auto md:right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-30 p-4">
                      <div className="flex space-x-2 mb-4">
                          <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                              <input 
                                  type="date" 
                                  value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  max={endDate}
                                  className="w-full p-2 text-sm border rounded-lg bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:[color-scheme:dark]"
                              />
                          </div>
                          <div className="flex-1">
                              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                              <input 
                                  type="date" 
                                  value={endDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  min={startDate}
                                  className="w-full p-2 text-sm border rounded-lg bg-slate-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:[color-scheme:dark]"
                              />
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                           <button onClick={() => applyDatePreset('TODAY')} className="px-2 py-1.5 text-xs text-center rounded bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition">Today</button>
                           <button onClick={() => applyDatePreset('YESTERDAY')} className="px-2 py-1.5 text-xs text-center rounded bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition">Yesterday</button>
                           <button onClick={() => applyDatePreset('LAST_7')} className="px-2 py-1.5 text-xs text-center rounded bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition">Last 7 Days</button>
                           <button onClick={() => applyDatePreset('LAST_30')} className="px-2 py-1.5 text-xs text-center rounded bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition">Last 30 Days</button>
                           <button onClick={() => applyDatePreset('THIS_MONTH')} className="px-2 py-1.5 text-xs text-center rounded bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition">This Month</button>
                           <button onClick={() => applyDatePreset('LAST_MONTH')} className="px-2 py-1.5 text-xs text-center rounded bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition">Last Month</button>
                           <button onClick={() => applyDatePreset('THIS_YEAR')} className="col-span-2 px-2 py-1.5 text-xs text-center rounded bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition">This Year</button>
                      </div>
                       <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end items-center">
                          <button 
                              onClick={() => { setStartDate(''); setEndDate(''); }}
                              className="text-xs text-red-500 hover:underline mr-auto"
                          >
                              Reset Range
                          </button>
                          <button 
                              onClick={() => setIsDateFilterOpen(false)}
                              className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition"
                          >
                              Done
                          </button>
                       </div>
                  </div>
              )}
          </div>

          <div className="w-full md:w-48">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
              <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full pl-10 pr-8 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-700 dark:text-white appearance-none min-w-[150px]"
                  >
                      <option value="ALL">All Sales</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PARTIAL">Partial Return</option>
                      <option value="RETURNED">Fully Returned</option>
                  </select>
              </div>
          </div>
          <button 
             onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); setStatusFilter('ALL'); }}
             className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap bg-slate-100 dark:bg-slate-700/50 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
              Clear
          </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-4">
                <ShoppingBag size={20} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Orders</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{totalOrders}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mr-4">
                <DollarSign size={20} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Gross Sales</p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{symbol}{grossSales.toFixed(2)}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
             <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mr-4">
                <RotateCcw size={20} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Refunds</p>
                <p className="text-lg font-bold text-red-600 dark:text-red-400">-{symbol}{totalRefunded.toFixed(2)}</p>
            </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mr-4">
                <Coins size={20} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Net Sales</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{symbol}{netSales.toFixed(2)}</p>
            </div>
        </div>
         <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-4">
                <TrendingUp size={20} />
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Net Profit</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{symbol}{netProfit.toFixed(2)}</p>
            </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Sale ID</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Date & Time</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Customer</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Cashier</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Status</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Amount</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredSales.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400">No sales transactions found matching filters.</td></tr>
            ) : (
                filteredSales.map(sale => {
                    const status = getSaleStatus(sale.id);
                    const cashierName = users.find(u => u.id === sale.cashierId)?.name || 'Unknown';
                    const customerName = sale.customerName || 'Guest / Walk-in';

                    return (
                        <tr key={sale.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                            <td className="p-4 font-mono text-xs text-slate-600 dark:text-slate-400">#{sale.id.split('-')[1]}</td>
                            <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                                {new Date(sale.timestamp).toLocaleDateString()}
                                <div className="text-xs text-slate-400">{new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                            </td>
                            <td className="p-4 text-sm font-medium text-slate-800 dark:text-white">
                                <div className="flex items-center">
                                    <UserIcon size={14} className="mr-2 text-slate-400"/>
                                    {customerName}
                                </div>
                            </td>
                            <td className="p-4 text-sm text-slate-600 dark:text-slate-300">{cashierName.split(' ')[0]}</td>
                            <td className="p-4">
                                {getStatusBadge(status)}
                            </td>
                            <td className="p-4 text-right">
                                <div className="font-bold text-slate-800 dark:text-white">{symbol}{sale.totalAmount.toFixed(2)}</div>
                                <div className="flex items-center justify-end text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {getPaymentIcon(sale.paymentMethod)} {sale.paymentMethod.replace('_', ' ')}
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <button 
                                  onClick={() => setSelectedSale(sale)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded"
                                >
                                    <Eye size={18} />
                                </button>
                            </td>
                        </tr>
                    );
                })
            )}
          </tbody>
        </table>
      </div>

      {/* Sales Details Modal */}
      {selectedSale && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
                      <div>
                          <h3 className="font-bold text-slate-800 dark:text-white">Transaction Details</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">#{selectedSale.id}</p>
                      </div>
                      <button onClick={() => setSelectedSale(null)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"/></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Date</p>
                              <p className="font-medium text-slate-800 dark:text-white">{new Date(selectedSale.timestamp).toLocaleString()}</p>
                          </div>
                          <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Customer</p>
                              <p className="font-medium text-slate-800 dark:text-white">{selectedSale.customerName || 'Guest'}</p>
                          </div>
                          <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Cashier</p>
                              <p className="font-medium text-slate-800 dark:text-white">{users.find(u => u.id === selectedSale.cashierId)?.name || 'Unknown'}</p>
                          </div>
                          <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Status</p>
                              <div className="mt-1">{getStatusBadge(getSaleStatus(selectedSale.id))}</div>
                          </div>
                      </div>

                      <div className="mb-6">
                          <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-100 dark:border-slate-700 pb-2">Items Purchased</h4>
                          <div className="space-y-2">
                              {selectedSale.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between text-sm">
                                      <div>
                                          <span className="font-medium text-slate-800 dark:text-white">{item.productName}</span>
                                          <span className="text-slate-500 dark:text-slate-400 text-xs ml-2">x{item.quantity}</span>
                                      </div>
                                      <div className="text-slate-800 dark:text-white font-medium">
                                          {symbol}{(item.priceAtSale * item.quantity).toFixed(2)}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {saleReturns.length > 0 && (
                          <div className="mb-6 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-100 dark:border-red-800">
                              <h4 className="font-bold text-sm text-red-800 dark:text-red-300 mb-2 border-b border-red-200 dark:border-red-800 pb-1">Returns History</h4>
                              {saleReturns.map(ret => (
                                  <div key={ret.id} className="mb-2 last:mb-0">
                                      <div className="flex justify-between text-xs font-bold text-red-700 dark:text-red-400 mb-1">
                                          <span>Return #{ret.id.split('-')[1]} ({new Date(ret.timestamp).toLocaleDateString()})</span>
                                          <span>-{symbol}{ret.totalRefund.toFixed(2)}</span>
                                      </div>
                                      <ul className="pl-2 space-y-1">
                                          {ret.items.map((item, i) => (
                                              <li key={i} className="text-xs text-red-600 dark:text-red-300 flex justify-between">
                                                  <span>{item.productName} (x{item.quantity})</span>
                                                  <span className="italic opacity-75">{item.reason}</span>
                                              </li>
                                          ))}
                                      </ul>
                                  </div>
                              ))}
                          </div>
                      )}
                      
                      <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                              <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                              <span className="font-medium text-slate-800 dark:text-white">{symbol}{selectedSale.subTotal.toFixed(2)}</span>
                          </div>
                          {selectedSale.totalTax > 0 && (
                             <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">
                                    {selectedSale.taxName} ({selectedSale.taxRate}%) 
                                    {selectedSale.taxType === 'INCLUSIVE' ? ' (Inc.)' : ' (Add.)'}
                                </span>
                                <span className="font-medium text-slate-800 dark:text-white">{symbol}{selectedSale.totalTax.toFixed(2)}</span>
                             </div>
                          )}
                          {selectedSale.creditMarkupAmount && selectedSale.creditMarkupAmount > 0 && (
                             <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">
                                    Credit Interest ({selectedSale.creditMarkupRate}%) {selectedSale.creditTermName ? `(${selectedSale.creditTermName})` : ''}
                                </span>
                                <span className="font-medium text-slate-800 dark:text-white">{symbol}{selectedSale.creditMarkupAmount.toFixed(2)}</span>
                             </div>
                          )}
                          
                          {selectedSale.paymentMethod === 'STORE_CREDIT' && selectedSale.creditDueDate && (
                              <div className="flex justify-between text-sm text-indigo-600 dark:text-indigo-400">
                                  <span>Payment Due Date</span>
                                  <span className="font-bold">{new Date(selectedSale.creditDueDate).toLocaleDateString()}</span>
                              </div>
                          )}

                          <div className="flex justify-between text-lg font-bold border-t border-slate-100 dark:border-slate-700 pt-2">
                              <span className="text-slate-800 dark:text-white">Total Paid</span>
                              <span className="text-blue-600 dark:text-blue-400">{symbol}{selectedSale.totalAmount.toFixed(2)}</span>
                          </div>
                          {saleReturns.length > 0 && (
                              <div className="flex justify-between text-sm font-bold text-red-600 dark:text-red-400 pt-1">
                                  <span>Total Refunded</span>
                                  <span>-{symbol}{modalTotalRefunded.toFixed(2)}</span>
                              </div>
                          )}
                          {saleReturns.length > 0 && (
                              <div className="flex justify-between text-lg font-bold border-t-2 border-slate-200 dark:border-slate-600 pt-2 mt-2">
                                  <span className="text-slate-800 dark:text-white">Net Total</span>
                                  <span className="text-emerald-600 dark:text-emerald-400">{symbol}{(modalNetTotal).toFixed(2)}</span>
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end">
                      <button onClick={() => setSelectedSale(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600">Close</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SalesHistory;
