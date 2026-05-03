import React, { useState } from 'react';
import { Customer, Sale, ReturnTransaction, CustomerSegment, User, UserRole, CreditAdjustment } from '../types';
import { Search, Plus, User as UserIcon, Phone, Mail, Edit2, Trash2, Wallet, History, CreditCard, ArrowRight, RotateCcw, ShoppingBag, X, Calendar, PieChart, Users, ChevronRight, Filter, TrendingUp, TrendingDown, Receipt, Footprints, Crown, Wand2, AlertTriangle, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';

interface CustomersProps {
  customers: Customer[];
  onAddCustomer: (customer: Customer) => void;
  onUpdateCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  sales: Sale[];
  returns: ReturnTransaction[];
  segments: CustomerSegment[];
  onAddSegment: (segment: CustomerSegment) => void;
  onDeleteSegment: (id: string) => void;
  currentUser: User;
  creditAdjustments: CreditAdjustment[];
  onAddCreditAdjustment: (adj: CreditAdjustment) => void;
  currency: string;
}

const Customers: React.FC<CustomersProps> = ({ 
  customers, 
  onAddCustomer, 
  onUpdateCustomer, 
  onDeleteCustomer,
  sales,
  returns,
  segments,
  onAddSegment,
  onDeleteSegment,
  currentUser,
  creditAdjustments,
  onAddCreditAdjustment,
  currency
}) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'SEGMENTS'>('LIST');
  const [listTypeFilter, setListTypeFilter] = useState<'ALL' | 'MEMBER' | 'WALK_IN'>('MEMBER');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [isSegmentListOpen, setIsSegmentListOpen] = useState(false);

  // Deletion State
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<CustomerSegment | null>(null);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'WALLET' | 'HISTORY'>('PROFILE');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'SALE' | 'RETURN' | 'CREDIT'>('ALL');

  // Customer Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '', email: '', phone: '', storeCredit: 0, type: 'MEMBER', creditLimit: 0
  });

  // Segment Form State
  const [segmentData, setSegmentData] = useState<Partial<CustomerSegment>>({
      name: '', description: '', criteria: {}
  });

  // Credit Adjustment State
  const [creditAdjAmount, setCreditAdjAmount] = useState<string>('');
  const [creditAdjType, setCreditAdjType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [creditAdjReason, setCreditAdjReason] = useState('');

  // Permissions
  const canManageSegments = currentUser.role === UserRole.SUPER_ADMIN || currentUser.role === UserRole.ADMIN;

  const getCurrencySymbol = (code: string) => {
    switch(code) {
      case 'PHP': return '₱';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  };
  const symbol = getCurrencySymbol(currency);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setFormData(customer);
      setSelectedCustomer(customer); // Used for identifying update vs create
    } else {
      setFormData({ name: '', email: '', phone: '', storeCredit: 0, type: 'MEMBER', creditLimit: 0 });
      setSelectedCustomer(null);
    }
    setIsModalOpen(true);
  };

  const handleOpenDetails = (customer: Customer) => {
      setSelectedCustomer(customer);
      setFormData(customer);
      setActiveTab('PROFILE');
      setHistoryFilter('ALL'); // Reset filter when opening
      setIsDetailsModalOpen(true);
      setCreditAdjAmount('');
      setCreditAdjReason('');
      setCreditAdjType('ADD');
  };

  const handleSubmit = () => {
    if (!formData.name) return;

    if (selectedCustomer && isModalOpen) {
        // Edit mode from main table
        onUpdateCustomer({ ...selectedCustomer, ...formData } as Customer);
    } else if (selectedCustomer && isDetailsModalOpen) {
        // Edit mode from Details modal
        const updated = { ...selectedCustomer, ...formData } as Customer;
        onUpdateCustomer(updated);
        setSelectedCustomer(updated); // Update local state immediately
    } else {
        // Create mode
        const newCustomer: Customer = {
            id: `c-${Date.now()}`,
            totalSpent: 0,
            visitCount: 0,
            storeCredit: 0,
            type: formData.type || 'MEMBER',
            ...formData as Customer
        };
        onAddCustomer(newCustomer);
    }
    setIsModalOpen(false);
  };

  const initiateDelete = (id: string) => {
      setCustomerToDelete(id);
  };

  const confirmDelete = () => {
      if (customerToDelete) {
          onDeleteCustomer(customerToDelete);
          setCustomerToDelete(null);
          setIsDetailsModalOpen(false); // Close details if open
      }
  };

  const handleAdjustCredit = () => {
      if (!selectedCustomer || !creditAdjAmount) return;
      const amount = parseFloat(creditAdjAmount);
      if (isNaN(amount) || amount <= 0) {
          alert("Please enter a valid amount greater than 0.");
          return;
      }

      const currentCredit = selectedCustomer.storeCredit || 0;
      
      let newCredit = currentCredit;
      if (creditAdjType === 'ADD') {
          newCredit += amount;
      } else {
          // Allow negative balance via manual adjustment (correction/debt)
          newCredit -= amount;
      }

      // Create log object
      const adjustment: CreditAdjustment = {
          id: `cadj-${Date.now()}`,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          amount: amount,
          type: creditAdjType,
          newBalance: newCredit,
          timestamp: Date.now(),
          userId: currentUser.id,
          userName: currentUser.name,
          reason: creditAdjReason || (creditAdjType === 'ADD' ? 'Manual Deposit / Adjustment' : 'Correction / Manual Deduction')
      };

      // Call parent handler which updates logs AND customer balance
      onAddCreditAdjustment(adjustment);
      
      // Update local view immediately to reflect change without re-opening modal
      setSelectedCustomer({ ...selectedCustomer, storeCredit: newCredit });
      setCreditAdjAmount('');
      setCreditAdjReason('');
  };

  const handleQuickAdd = (amount: number) => {
      setCreditAdjAmount(amount.toString());
  };

  // --- Segment Logic ---

  const checkSegmentMatch = (customer: Customer, criteria: CustomerSegment['criteria']) => {
      if (criteria.minSpent !== undefined && customer.totalSpent < criteria.minSpent) return false;
      if (criteria.maxSpent !== undefined && customer.totalSpent > criteria.maxSpent) return false;
      if (criteria.minVisits !== undefined && customer.visitCount < criteria.minVisits) return false;
      if (criteria.maxVisits !== undefined && customer.visitCount > criteria.maxVisits) return false;
      
      if (criteria.daysSinceLastVisit !== undefined) {
          if (!customer.lastVisit) return true; // Never visited is arguably "at risk" or "new"
          const daysAgo = (Date.now() - customer.lastVisit) / (1000 * 60 * 60 * 24);
          if (daysAgo < criteria.daysSinceLastVisit) return false;
      }

      return true;
  };

  const getSegmentCount = (segment: CustomerSegment) => {
      return customers.filter(c => checkSegmentMatch(c, segment.criteria)).length;
  };

  const getSegmentCustomers = (segment: CustomerSegment) => {
      return customers.filter(c => checkSegmentMatch(c, segment.criteria));
  };

  const handleCreateSegment = () => {
      if (!segmentData.name) return;
      
      const newSegment: CustomerSegment = {
          id: `seg-${Date.now()}`,
          name: segmentData.name,
          description: segmentData.description,
          criteria: segmentData.criteria || {}
      };
      
      onAddSegment(newSegment);
      setIsSegmentModalOpen(false);
      setSegmentData({ name: '', description: '', criteria: {} });
  };

  const handleDeleteSegmentAction = (id: string) => {
      if (window.confirm("Are you sure you want to delete this segment?")) {
          onDeleteSegment(id);
          setIsSegmentListOpen(false);
          setSelectedSegment(null);
      }
  };

  const openSegmentList = (segment: CustomerSegment) => {
      setSelectedSegment(segment);
      setIsSegmentListOpen(true);
  };


  // --- Filtering ---

  const filteredCustomers = customers.filter(c => {
    // Search match
    const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone?.includes(searchTerm);
    
    // Type match
    const matchType = listTypeFilter === 'ALL' || c.type === listTypeFilter;

    return matchSearch && matchType;
  });

  const customerHistory = selectedCustomer 
      ? [
          ...sales.filter(s => s.customerId === selectedCustomer.id).map(s => ({ ...s, historyType: 'SALE', date: s.timestamp })),
          ...returns.filter(r => r.customerId === selectedCustomer.id).map(r => ({ ...r, historyType: 'RETURN', date: r.timestamp })),
          ...creditAdjustments.filter(a => a.customerId === selectedCustomer.id).map(a => ({ ...a, historyType: 'CREDIT', date: a.timestamp }))
        ].sort((a, b) => b.date - a.date)
      : [];

  const filteredHistory = customerHistory.filter(item => {
      if (historyFilter === 'ALL') return true;
      return item.historyType === historyFilter;
  });

  const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 bg-white dark:bg-slate-700 dark:text-white placeholder-slate-400 dark:placeholder-slate-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Customers</h2>
            <p className="text-slate-500 text-sm mt-1">Manage profiles, store credit, and segments</p>
        </div>
        <div className="flex space-x-2">
            <div className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg p-1 flex">
                <button 
                    onClick={() => setViewMode('LIST')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'LIST' ? 'bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    List
                </button>
                <button 
                    onClick={() => setViewMode('SEGMENTS')}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === 'SEGMENTS' ? 'bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Segments
                </button>
            </div>
            {viewMode === 'LIST' && (
                <button 
                onClick={() => handleOpenModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
                >
                <Plus size={18} className="mr-2" /> Add Customer
                </button>
            )}
            {viewMode === 'SEGMENTS' && canManageSegments && (
                <button 
                onClick={() => setIsSegmentModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
                >
                <Plus size={18} className="mr-2" /> New Segment
                </button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mr-4">
                  <UserIcon size={24} />
              </div>
              <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Customers</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">{customers.length}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full mr-4">
                  <Wallet size={24} />
              </div>
              <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Store Credit</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {symbol}{customers.reduce((sum, c) => sum + (c.type === 'MEMBER' && c.storeCredit > 0 ? c.storeCredit : 0), 0).toFixed(2)}
                  </p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full mr-4">
                  <ShoppingBag size={24} />
              </div>
              <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Lifetime Sales</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">
                      {symbol}{customers.reduce((sum, c) => sum + c.totalSpent, 0).toFixed(2)}
                  </p>
              </div>
          </div>
      </div>

      {viewMode === 'LIST' && (
          <>
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                {/* List Filters */}
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                    <button 
                        onClick={() => setListTypeFilter('MEMBER')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center ${listTypeFilter === 'MEMBER' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Crown size={16} className="mr-2" /> Members
                    </button>
                    <button 
                        onClick={() => setListTypeFilter('WALK_IN')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center ${listTypeFilter === 'WALK_IN' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        <Footprints size={16} className="mr-2" /> Walk-ins
                    </button>
                    <button 
                        onClick={() => setListTypeFilter('ALL')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${listTypeFilter === 'ALL' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        All
                    </button>
                </div>

                <div className="relative w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                    type="text" 
                    placeholder="Search customers..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-80 pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 dark:text-white shadow-sm placeholder-slate-400 dark:placeholder-slate-500 transition-all"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Customer</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Type</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Contact</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-center">Visits</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Total Spent</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Store Credit / Due</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Credit Remaining</th>
                    <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredCustomers.map(customer => {
                        const remaining = (customer.creditLimit || 0) + (customer.storeCredit || 0);
                        return (
                            <tr key={customer.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                <td className="p-4">
                                    <div className="font-medium text-slate-900 dark:text-white">{customer.name}</div>
                                    <div className="text-xs text-slate-400">ID: {customer.id.split('-')[1]}</div>
                                </td>
                                <td className="p-4">
                                    {customer.type === 'WALK_IN' ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            <Footprints size={12} className="mr-1" /> Walk-in
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                                            <Crown size={12} className="mr-1" /> Member
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                                    {customer.email && <div className="flex items-center mb-1"><Mail size={12} className="mr-1.5 opacity-70"/> {customer.email}</div>}
                                    {customer.phone && <div className="flex items-center"><Phone size={12} className="mr-1.5 opacity-70"/> {customer.phone}</div>}
                                    {!customer.email && !customer.phone && <span className="text-slate-400 italic">No contact info</span>}
                                </td>
                                <td className="p-4 text-center text-sm text-slate-600 dark:text-slate-300">
                                    <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full text-xs font-semibold">{customer.visitCount}</span>
                                </td>
                                <td className="p-4 text-right font-medium text-slate-800 dark:text-white">
                                    {symbol}{customer.totalSpent.toFixed(2)}
                                </td>
                                <td className="p-4 text-right">
                                    {customer.type === 'MEMBER' ? (
                                        <span className={`font-bold ${customer.storeCredit > 0 ? 'text-blue-600 dark:text-blue-400' : customer.storeCredit < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {symbol}{Math.abs(customer.storeCredit || 0).toFixed(2)}
                                            {customer.storeCredit < 0 && <span className="text-[10px] ml-1 uppercase">(Due)</span>}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 dark:text-slate-600 text-xs italic">N/A</span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    {customer.type === 'MEMBER' ? (
                                        <span className={`font-medium ${remaining < 50 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                                            {symbol}{remaining.toFixed(2)}
                                        </span>
                                    ) : '-'}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end space-x-2">
                                        <button 
                                            onClick={() => handleOpenDetails(customer)}
                                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded flex items-center text-xs font-medium"
                                        >
                                            Details <ArrowRight size={14} className="ml-1"/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {filteredCustomers.length === 0 && (
                        <tr><td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">No customers found.</td></tr>
                    )}
                </tbody>
                </table>
            </div>
          </>
      )}

      {/* Segment UI */}
      {viewMode === 'SEGMENTS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {segments.map(segment => {
                  const count = getSegmentCount(segment);
                  return (
                      <div 
                        key={segment.id}
                        onClick={() => openSegmentList(segment)}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition cursor-pointer group"
                      >
                          <div className="flex justify-between items-start mb-4">
                              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                  <PieChart size={24} />
                              </div>
                              <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full text-xs font-bold">
                                  {count} Customers
                              </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{segment.name}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 h-10 overflow-hidden line-clamp-2">
                              {segment.description || 'No description provided.'}
                          </p>
                          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mt-auto">
                              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Criteria</p>
                              <div className="flex flex-wrap gap-2">
                                  {segment.criteria.minSpent !== undefined && (
                                      <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-100 dark:border-green-800">
                                          &gt; {symbol}{segment.criteria.minSpent} Spent
                                      </span>
                                  )}
                                  {segment.criteria.maxSpent !== undefined && (
                                      <span className="text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-100 dark:border-green-800">
                                          &lt; {symbol}{segment.criteria.maxSpent} Spent
                                      </span>
                                  )}
                                  {segment.criteria.minVisits !== undefined && (
                                      <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border border-blue-100 dark:border-blue-800">
                                          &gt; {segment.criteria.minVisits} Visits
                                      </span>
                                  )}
                                  {segment.criteria.daysSinceLastVisit !== undefined && (
                                      <span className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded border border-amber-100 dark:border-amber-800">
                                          No visit {segment.criteria.daysSinceLastVisit}+ days
                                      </span>
                                  )}
                              </div>
                          </div>
                      </div>
                  );
              })}
              {canManageSegments && (
                  <button 
                    onClick={() => setIsSegmentModalOpen(true)}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
                  >
                      <Plus size={32} className="mb-2" />
                      <span className="font-medium">Create New Segment</span>
                  </button>
              )}
          </div>
      )}

      {/* Add/Edit Customer Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">{selectedCustomer ? 'Edit Customer' : 'New Customer'}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                          <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} placeholder="Jane Doe" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                              <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputClass} placeholder="555-0123" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                              <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className={inputClass} placeholder="jane@example.com" />
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Customer Type</label>
                          <div className="flex space-x-4">
                              <label className={`flex-1 p-3 border rounded-lg cursor-pointer flex items-center justify-center transition ${formData.type === 'MEMBER' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700 dark:border-slate-600'}`}>
                                  <input type="radio" name="type" value="MEMBER" checked={formData.type === 'MEMBER'} onChange={() => setFormData({...formData, type: 'MEMBER'})} className="hidden" />
                                  <Crown size={18} className="mr-2"/> Member
                              </label>
                              <label className={`flex-1 p-3 border rounded-lg cursor-pointer flex items-center justify-center transition ${formData.type === 'WALK_IN' ? 'bg-slate-200 border-slate-400 text-slate-800 dark:bg-slate-700 dark:text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-700 dark:border-slate-600'}`}>
                                  <input type="radio" name="type" value="WALK_IN" checked={formData.type === 'WALK_IN'} onChange={() => setFormData({...formData, type: 'WALK_IN'})} className="hidden" />
                                  <Footprints size={18} className="mr-2"/> Walk-in
                              </label>
                          </div>
                      </div>

                      {formData.type === 'MEMBER' && (
                          <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Credit Limit</label>
                              <input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: parseFloat(e.target.value)})} className={inputClass} />
                              <p className="text-xs text-slate-500 mt-1">Maximum negative balance allowed.</p>
                          </div>
                      )}
                  </div>

                  <div className="flex justify-end space-x-3 mt-8">
                      <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                      <button onClick={handleSubmit} disabled={!formData.name} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md disabled:opacity-50 transition">
                          {selectedCustomer ? 'Save Changes' : 'Create Customer'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Customer Details Modal */}
      {isDetailsModalOpen && selectedCustomer && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
                      <div className="flex items-center">
                          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-300 text-2xl font-bold mr-4 border border-blue-200 dark:border-slate-600">
                              {selectedCustomer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                              <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
                                  {selectedCustomer.name}
                                  {selectedCustomer.type === 'MEMBER' && <Crown size={18} className="ml-2 text-amber-500 fill-amber-500" />}
                              </h2>
                              <div className="flex items-center text-sm text-slate-500 dark:text-slate-400 mt-1 space-x-4">
                                  <span className="flex items-center"><UserIcon size={14} className="mr-1"/> ID: {selectedCustomer.id.split('-')[1]}</span>
                                  <span className="flex items-center"><Calendar size={14} className="mr-1"/> Last Visit: {selectedCustomer.lastVisit ? new Date(selectedCustomer.lastVisit).toLocaleDateString() : 'Never'}</span>
                              </div>
                          </div>
                      </div>
                      <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
                      <button onClick={() => setActiveTab('PROFILE')} className={`py-4 px-2 text-sm font-medium border-b-2 transition mr-4 ${activeTab === 'PROFILE' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Profile Details</button>
                      {selectedCustomer.type === 'MEMBER' && (
                          <button onClick={() => setActiveTab('WALLET')} className={`py-4 px-2 text-sm font-medium border-b-2 transition mr-4 ${activeTab === 'WALLET' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Store Credit / Wallet</button>
                      )}
                      <button onClick={() => setActiveTab('HISTORY')} className={`py-4 px-2 text-sm font-medium border-b-2 transition ${activeTab === 'HISTORY' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Transaction History</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                      {activeTab === 'PROFILE' && (
                          <div className="space-y-6">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                                      <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                                      <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className={inputClass} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                                      <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputClass} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Customer Type</label>
                                      <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className={inputClass} disabled>
                                          <option value="MEMBER">Member</option>
                                          <option value="WALK_IN">Walk-in</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-700">
                                  <button onClick={() => initiateDelete(selectedCustomer.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center">
                                      <Trash2 size={16} className="mr-2"/> Delete Customer
                                  </button>
                                  <button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-md transition flex items-center">
                                      <Edit2 size={16} className="mr-2"/> Save Changes
                                  </button>
                              </div>
                          </div>
                      )}

                      {activeTab === 'WALLET' && selectedCustomer.type === 'MEMBER' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                              <div className="md:col-span-1 bg-slate-50 dark:bg-slate-700/50 p-6 rounded-xl border border-slate-200 dark:border-slate-600 text-center">
                                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Current Balance</p>
                                  <p className={`text-4xl font-black mb-1 ${selectedCustomer.storeCredit < 0 ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                                      {symbol}{Math.abs(selectedCustomer.storeCredit || 0).toFixed(2)}
                                  </p>
                                  {selectedCustomer.storeCredit < 0 && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">PAYMENT DUE</span>}
                                  
                                  <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-600">
                                      <p className="text-xs font-medium text-slate-500 mb-1">Credit Limit</p>
                                      <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{symbol}{selectedCustomer.creditLimit?.toFixed(2)}</p>
                                  </div>
                              </div>

                              <div className="md:col-span-2 space-y-4">
                                  <h4 className="font-bold text-slate-800 dark:text-white mb-4">Manual Adjustment</h4>
                                  <div className="flex space-x-4 mb-4">
                                      <button 
                                          onClick={() => setCreditAdjType('ADD')}
                                          className={`flex-1 py-3 rounded-lg border font-medium text-sm transition ${creditAdjType === 'ADD' ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                      >
                                          Add Credit (Deposit)
                                      </button>
                                      <button 
                                          onClick={() => setCreditAdjType('DEDUCT')}
                                          className={`flex-1 py-3 rounded-lg border font-medium text-sm transition ${creditAdjType === 'DEDUCT' ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                      >
                                          Deduct Credit (Correction)
                                      </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
                                          <input type="number" min="0" step="0.01" value={creditAdjAmount} onChange={e => setCreditAdjAmount(e.target.value)} className={inputClass} placeholder="0.00" />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-medium text-slate-500 mb-1">Reason / Note</label>
                                          <input type="text" value={creditAdjReason} onChange={e => setCreditAdjReason(e.target.value)} className={inputClass} placeholder="e.g. Refund, Bonus" />
                                      </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                      {[10, 20, 50, 100].map(amt => (
                                          <button key={amt} onClick={() => handleQuickAdd(amt)} className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-xs font-medium rounded hover:bg-slate-200 dark:hover:bg-slate-600">
                                              +{amt}
                                          </button>
                                      ))}
                                  </div>

                                  <button onClick={handleAdjustCredit} disabled={!creditAdjAmount} className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-blue-700 disabled:opacity-50 transition">
                                      Confirm Adjustment
                                  </button>
                              </div>
                          </div>
                      )}

                      {activeTab === 'HISTORY' && (
                          <div className="space-y-4">
                              <div className="flex space-x-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                                  {['ALL', 'SALE', 'RETURN', 'CREDIT'].map(filter => (
                                      <button 
                                          key={filter}
                                          onClick={() => setHistoryFilter(filter as any)}
                                          className={`px-3 py-1 text-xs font-bold rounded-full transition ${historyFilter === filter ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                      >
                                          {filter}
                                      </button>
                                  ))}
                              </div>

                              <div className="space-y-3">
                                  {filteredHistory.length === 0 ? (
                                      <p className="text-center text-slate-400 py-8">No history found.</p>
                                  ) : (
                                      filteredHistory.map((item: any) => (
                                          <div key={item.id} className="flex items-center p-3 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                                              <div className={`p-2 rounded-full mr-3 ${item.historyType === 'SALE' ? 'bg-blue-100 text-blue-600' : item.historyType === 'RETURN' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                  {item.historyType === 'SALE' ? <ShoppingBag size={16}/> : item.historyType === 'RETURN' ? <RotateCcw size={16}/> : <Wallet size={16}/>}
                                              </div>
                                              <div className="flex-1">
                                                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                      {item.historyType === 'SALE' ? 'Purchase' : item.historyType === 'RETURN' ? 'Return' : item.type === 'ADD' ? 'Credit Added' : 'Credit Deducted'}
                                                  </p>
                                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                                      {new Date(item.timestamp || item.date).toLocaleString()} • ID: {item.id.split('-')[1]}
                                                  </p>
                                                  {item.reason && <p className="text-xs italic text-slate-400">"{item.reason}"</p>}
                                              </div>
                                              <div className="text-right">
                                                  <p className={`font-bold ${item.historyType === 'RETURN' || (item.historyType === 'CREDIT' && item.type === 'DEDUCT') ? 'text-red-600' : 'text-slate-800 dark:text-white'}`}>
                                                      {item.historyType === 'RETURN' || (item.historyType === 'CREDIT' && item.type === 'DEDUCT') ? '-' : '+'}{symbol}
                                                      {(item.totalAmount || item.totalRefund || item.amount).toFixed(2)}
                                                  </p>
                                                  {item.historyType === 'SALE' && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500">{item.items.length} items</span>}
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* New Segment Modal */}
      {isSegmentModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Create Customer Segment</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Segment Name <span className="text-red-500">*</span></label>
                          <input type="text" value={segmentData.name} onChange={e => setSegmentData({...segmentData, name: e.target.value})} className={inputClass} placeholder="e.g. VIP Customers" />
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
                          <textarea rows={2} value={segmentData.description} onChange={e => setSegmentData({...segmentData, description: e.target.value})} className={inputClass} placeholder="Describe this group..." />
                      </div>
                      
                      <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Criteria (Leave blank to ignore)</p>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Min Spent ({symbol})</label>
                                  <input type="number" value={segmentData.criteria?.minSpent || ''} onChange={e => setSegmentData({...segmentData, criteria: {...segmentData.criteria, minSpent: parseFloat(e.target.value)}})} className={inputClass} />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Max Spent ({symbol})</label>
                                  <input type="number" value={segmentData.criteria?.maxSpent || ''} onChange={e => setSegmentData({...segmentData, criteria: {...segmentData.criteria, maxSpent: parseFloat(e.target.value)}})} className={inputClass} />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Min Visits</label>
                                  <input type="number" value={segmentData.criteria?.minVisits || ''} onChange={e => setSegmentData({...segmentData, criteria: {...segmentData.criteria, minVisits: parseInt(e.target.value)}})} className={inputClass} />
                              </div>
                              <div>
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Days Since Last Visit</label>
                                  <input type="number" value={segmentData.criteria?.daysSinceLastVisit || ''} onChange={e => setSegmentData({...segmentData, criteria: {...segmentData.criteria, daysSinceLastVisit: parseInt(e.target.value)}})} className={inputClass} />
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                      <button onClick={() => setIsSegmentModalOpen(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                      <button onClick={handleCreateSegment} disabled={!segmentData.name} className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md disabled:opacity-50 transition">
                          Create Segment
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Segment List Modal */}
      {isSegmentListOpen && selectedSegment && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20 rounded-t-xl">
                      <div>
                          <h3 className="font-bold text-slate-800 dark:text-white flex items-center">
                              <PieChart className="mr-2 text-indigo-500" size={20}/> {selectedSegment.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{getSegmentCustomers(selectedSegment).length} customers matched</p>
                      </div>
                      <div className="flex items-center space-x-2">
                          {canManageSegments && (
                              <button 
                                  onClick={() => handleDeleteSegmentAction(selectedSegment.id)}
                                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded transition"
                                  title="Delete Segment"
                              >
                                  <Trash2 size={18} />
                              </button>
                          )}
                          <button onClick={() => setIsSegmentListOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded"><X size={24}/></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {getSegmentCustomers(selectedSegment).length === 0 ? (
                          <p className="text-center text-slate-400 py-8">No customers match these criteria currently.</p>
                      ) : (
                          getSegmentCustomers(selectedSegment).map(c => (
                              <div key={c.id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                  <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs mr-3">
                                          {c.name.charAt(0)}
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-slate-800 dark:text-white">{c.name}</p>
                                          <p className="text-xs text-slate-500 dark:text-slate-400">{c.email || c.phone || 'No contact'}</p>
                                      </div>
                                  </div>
                                  <div className="text-right text-xs">
                                      <p className="font-bold text-slate-700 dark:text-slate-300">{symbol}{c.totalSpent.toFixed(2)}</p>
                                      <p className="text-slate-400">{c.visitCount} visits</p>
                                  </div>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                          <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Delete Customer?</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                          Are you sure you want to delete this profile? All history and store credit data will be unlinked.
                      </p>
                      <div className="flex space-x-3 w-full">
                          <button 
                              onClick={() => setCustomerToDelete(null)}
                              className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                          >
                              Cancel
                          </button>
                          <button 
                              onClick={confirmDelete}
                              className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-md transition"
                          >
                              Delete
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Customers;