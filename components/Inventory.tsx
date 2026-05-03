import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, StockAdjustment, User, ReturnTransaction, Sale, Customer, PriceHistory, UserRole } from '../types';
import { Search, Plus, Filter, Package, AlertTriangle, Edit2, Trash2, Activity, ChevronDown, History, RefreshCw, Save, X, Sparkles, TrendingUp, DollarSign, FileText, ChevronRight, ArrowRight, User as UserIcon, Image as ImageIcon, Tag, TrendingDown, RotateCcw, CheckSquare, Square, Printer, Layers, Barcode, SlidersHorizontal, Calendar, Info, Box, Download } from 'lucide-react';
import { generateProductDescription, suggestRestock } from '../services/geminiService';

interface InventoryProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  stockAdjustments: StockAdjustment[];
  onAdjustStock: (adjustment: StockAdjustment) => void;
  onBulkAdjustStock: (adjustments: StockAdjustment[]) => void;
  currentUser: User;
  currency: string;
  showToast: (message: string, type: 'SUCCESS' | 'ERROR' | 'INFO') => void;
  returns: ReturnTransaction[];
  customers: Customer[];
  sales: Sale[];
  priceHistory: PriceHistory[];
  onLogPriceChange: (log: PriceHistory) => void;
}

// Simple Barcode Component for Labels
const LabelBarcode = ({ value }: { value: string }) => {
    // Deterministic visual representation based on string hash
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
    // Generate 25 bars
    for(let i=0; i<25; i++) {
        const r = seededRandom();
        let w = 4; 
        if (r > 0.7) w = 8;
        else if (r < 0.3) w = 2;
        bars.push(w);
    }
    return (
        <div className="flex flex-col items-center justify-center w-full">
            <div className="flex justify-center h-8 overflow-hidden">
                {bars.map((w, i) => (
                    <div key={i} style={{ 
                        width: `${w}px`, 
                        height: '100%', 
                        backgroundColor: 'black', 
                        marginLeft: '1px', 
                        marginRight: '1px' 
                    }}></div>
                ))}
            </div>
            <div className="text-[10px] font-mono tracking-widest uppercase mt-0.5 text-black">{value}</div>
        </div>
    );
};

const Inventory: React.FC<InventoryProps> = ({
  products,
  setProducts,
  onAdjustStock,
  onBulkAdjustStock,
  currentUser,
  currency,
  showToast,
  stockAdjustments,
  onLogPriceChange,
  priceHistory,
  returns,
  sales
}) => {
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
      categories: [] as string[],
      suppliers: [] as string[],
      stockRange: { min: '' as string | number, max: '' as string | number }
  });
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false); // Renamed from isHistoryOpen
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkPrintOpen, setIsBulkPrintOpen] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'STOCK' | 'PRICE' | 'RETURNS'>('STOCK');
  
  // Dropdown state for category input
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null); // Renamed from historyProduct

  // Forms
  const [productForm, setProductForm] = useState<Partial<Product>>({
    name: '', sku: '', barcode: '', category: '', price: 0, cost: 0, stock: 0, minStockLevel: 5, unit: 'pcs', description: '', imageUrl: '', stockExpiryDate: '', supplier: ''
  });
  
  const [adjForm, setAdjForm] = useState({
      quantity: 0,
      type: 'ADD' as 'ADD' | 'REMOVE' | 'SET',
      reason: '',
      notes: ''
  });

  // Bulk Edit Form
  const [bulkEditForm, setBulkEditForm] = useState<{
      category: string;
      minStockLevel: string;
      supplier: string;
      priceAdjustment: string; // Percentage (+10, -5)
  }>({ category: '', minStockLevel: '', supplier: '', priceAdjustment: '' });

  // AI State
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [restockSuggestions, setRestockSuggestions] = useState<any[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const getCurrencySymbol = (code: string) => {
    switch(code) {
      case 'PHP': return '₱';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  };
  const symbol = getCurrencySymbol(currency);

  // Derived Lists for Filters
  const uniqueCategories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort(), [products]);
  const uniqueSuppliers = useMemo(() => Array.from(new Set(products.map(p => p.supplier).filter(Boolean) as string[])).sort(), [products]);
  
  // Input suggestions for Add/Edit Modal
  const inputSuggestions = ['All', ...uniqueCategories].filter(c => c !== 'All').sort();

  // Filter Logic
  const filteredProducts = products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchTerm));
      
      const matchCategory = activeFilters.categories.length === 0 || activeFilters.categories.includes(p.category);
      const matchSupplier = activeFilters.suppliers.length === 0 || (p.supplier && activeFilters.suppliers.includes(p.supplier));
      
      const min = activeFilters.stockRange.min === '' ? -Infinity : Number(activeFilters.stockRange.min);
      const max = activeFilters.stockRange.max === '' ? Infinity : Number(activeFilters.stockRange.max);
      const matchStock = p.stock >= min && p.stock <= max;

      return matchSearch && matchCategory && matchSupplier && matchStock;
  });

  const hasActiveFilters = activeFilters.categories.length > 0 || activeFilters.suppliers.length > 0 || activeFilters.stockRange.min !== '' || activeFilters.stockRange.max !== '';

  const toggleFilterItem = (type: 'categories' | 'suppliers', value: string) => {
      setActiveFilters(prev => {
          const list = prev[type];
          if (list.includes(value)) {
              return { ...prev, [type]: list.filter(item => item !== value) };
          } else {
              return { ...prev, [type]: [...list, value] };
          }
      });
  };

  const clearAllFilters = () => {
      setActiveFilters({
          categories: [],
          suppliers: [],
          stockRange: { min: '', max: '' }
      });
      setSearchTerm('');
  };

  // --- Selection Logic ---
  const handleSelectAll = () => {
      if (selectedIds.size === filteredProducts.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredProducts.map(p => p.id)));
      }
  };

  const handleSelectRow = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const handleOpenModal = (product?: Product) => {
      if (product) {
          setEditingProduct(product);
          setProductForm(product);
      } else {
          setEditingProduct(null);
          setProductForm({ name: '', sku: '', barcode: '', category: 'General', price: 0, cost: 0, stock: 0, minStockLevel: 5, unit: 'pcs', description: '', imageUrl: '', stockExpiryDate: '', supplier: '' });
      }
      setIsProductModalOpen(true);
      setShowCategoryDropdown(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductForm(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = () => {
      if (!productForm.name || !productForm.sku || productForm.price === undefined) {
          showToast("Name, SKU, and Price are required.", 'ERROR');
          return;
      }

      if (editingProduct) {
          // Check for price change to log history
          if (editingProduct.price !== productForm.price) {
              onLogPriceChange({
                  id: `ph-${Date.now()}`,
                  productId: editingProduct.id,
                  type: 'PRICE',
                  oldValue: editingProduct.price,
                  newValue: productForm.price!,
                  userId: currentUser.id,
                  userName: currentUser.name,
                  timestamp: Date.now()
              });
          }
          if (editingProduct.cost !== productForm.cost) {
              onLogPriceChange({
                  id: `ph-${Date.now()}-c`,
                  productId: editingProduct.id,
                  type: 'COST',
                  oldValue: editingProduct.cost,
                  newValue: productForm.cost!,
                  userId: currentUser.id,
                  userName: currentUser.name,
                  timestamp: Date.now()
              });
          }

          setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...productForm } as Product : p));
          showToast("Product updated successfully.", 'SUCCESS');
      } else {
          const newProduct: Product = {
              id: `p-${Date.now()}`,
              ...productForm as Product
          };
          setProducts(prev => [...prev, newProduct]);
          showToast("Product created successfully.", 'SUCCESS');
      }
      setIsProductModalOpen(false);
  };

  const handleDelete = (id: string) => {
      if (window.confirm("Are you sure you want to delete this product?")) {
          setProducts(prev => prev.filter(p => p.id !== id));
          showToast("Product deleted.", 'INFO');
      }
  };

  const handleOpenAdjModal = (product: Product) => {
      setSelectedProduct(product);
      setAdjForm({ quantity: 0, type: 'ADD', reason: '', notes: '' });
      setIsAdjModalOpen(true);
  };

  const handleViewDetails = (product: Product) => {
      setDetailProduct(product);
      setActiveHistoryTab('STOCK');
      setIsDetailOpen(true);
  };

  const handleSubmitAdjustment = () => {
      if (!selectedProduct || adjForm.quantity < 0) return; // Allow 0 for SET, but usually checks > 0

      let newStock = selectedProduct.stock;
      if (adjForm.type === 'ADD') newStock += adjForm.quantity;
      if (adjForm.type === 'REMOVE') newStock = Math.max(0, newStock - adjForm.quantity);
      if (adjForm.type === 'SET') newStock = adjForm.quantity;

      onAdjustStock({
          id: `adj-${Date.now()}`,
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          userId: currentUser.id,
          userName: currentUser.name,
          timestamp: Date.now(),
          type: adjForm.type,
          quantity: adjForm.quantity,
          previousStock: selectedProduct.stock,
          newStock,
          reason: adjForm.reason || 'Manual Adjustment',
          notes: adjForm.notes
      });
      setIsAdjModalOpen(false);
  };

  const handleGenerateDescription = async () => {
      if (!productForm.name || !productForm.category) {
          showToast("Please enter product name and category first.", 'ERROR');
          return;
      }
      setIsGeneratingDesc(true);
      const desc = await generateProductDescription(productForm.name, productForm.category);
      setProductForm(prev => ({ ...prev, description: desc }));
      setIsGeneratingDesc(false);
  };

  const handleOpenInsights = async () => {
      setIsInsightsOpen(true);
      setIsLoadingSuggestions(true);
      const suggestions = await suggestRestock(products);
      setRestockSuggestions(suggestions);
      setIsLoadingSuggestions(false);
  };

  const handleExportInventory = () => {
      const dataToExport = selectedIds.size > 0 
          ? products.filter(p => selectedIds.has(p.id)) 
          : products;

      const totalValueCost = dataToExport.reduce((sum, p) => sum + (p.cost * p.stock), 0);
      const totalValueRetail = dataToExport.reduce((sum, p) => sum + (p.price * p.stock), 0);

      // Create HTML Table for Excel
      let tableContent = `
          <tr style="height: 40px;"><td colspan="13" style="font-size: 16px; font-weight: bold; background-color: #e2e8f0; text-align: center; vertical-align: middle;">Inventory Export - ${new Date().toLocaleDateString()}</td></tr>
          <tr>
              <td colspan="3" style="font-weight: bold;">Total Items: ${dataToExport.length}</td>
              <td colspan="3" style="font-weight: bold;">Total Cost Value: ${currency} ${totalValueCost.toFixed(2)}</td>
              <td colspan="7" style="font-weight: bold;">Total Retail Value: ${currency} ${totalValueRetail.toFixed(2)}</td>
          </tr>
          <tr><td colspan="13"></td></tr>
          <tr style="background-color: #1e293b; color: white; font-weight: bold;">
              <th style="padding: 10px; border: 1px solid #ccc;">Product Name</th>
              <th style="padding: 10px; border: 1px solid #ccc;">SKU</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Barcode</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Category</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Supplier</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Stock Qty</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Unit</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Cost Price (${currency})</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Selling Price (${currency})</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Margin (%)</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Total Cost Val</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Total Retail Val</th>
              <th style="padding: 10px; border: 1px solid #ccc;">Status</th>
          </tr>
      `;

      dataToExport.forEach(p => {
          const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
          const status = p.stock === 0 ? 'Out of Stock' : p.stock <= p.minStockLevel ? 'Low Stock' : 'Active';
          const statusColor = p.stock === 0 ? '#fee2e2' : p.stock <= p.minStockLevel ? '#ffedd5' : '#ffffff'; // Light red, orange, white

          tableContent += `
              <tr style="background-color: ${statusColor};">
                  <td style="border: 1px solid #ccc;">${p.name}</td>
                  <td style="border: 1px solid #ccc; mso-number-format:'@'">${p.sku}</td>
                  <td style="border: 1px solid #ccc; mso-number-format:'@'">${p.barcode || '-'}</td>
                  <td style="border: 1px solid #ccc;">${p.category}</td>
                  <td style="border: 1px solid #ccc;">${p.supplier || '-'}</td>
                  <td style="border: 1px solid #ccc; font-weight: bold;">${p.stock}</td>
                  <td style="border: 1px solid #ccc;">${p.unit || 'pcs'}</td>
                  <td style="border: 1px solid #ccc;">${p.cost.toFixed(2)}</td>
                  <td style="border: 1px solid #ccc;">${p.price.toFixed(2)}</td>
                  <td style="border: 1px solid #ccc;">${margin.toFixed(1)}%</td>
                  <td style="border: 1px solid #ccc;">${(p.cost * p.stock).toFixed(2)}</td>
                  <td style="border: 1px solid #ccc;">${(p.price * p.stock).toFixed(2)}</td>
                  <td style="border: 1px solid #ccc;">${status}</td>
              </tr>
          `;
      });

      const fullTemplate = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
              <!--[if gte mso 9]>
              <xml>
                  <x:ExcelWorkbook>
                      <x:ExcelWorksheets>
                          <x:ExcelWorksheet>
                              <x:Name>Inventory Export</x:Name>
                              <x:WorksheetOptions>
                                  <x:DisplayGridlines/>
                              </x:WorksheetOptions>
                          </x:ExcelWorksheet>
                      </x:ExcelWorksheets>
                  </x:ExcelWorkbook>
              </xml>
              <![endif]-->
              <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
          </head>
          <body>
              <table>${tableContent}</table>
          </body>
          </html>
      `;

      const blob = new Blob([fullTemplate], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Inventory_Export_${new Date().toISOString().split('T')[0]}.xls`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast("Inventory exported successfully!", "SUCCESS");
  };

  const getProductHistory = (productId: string) => {
      return stockAdjustments
          .filter(a => a.productId === productId)
          .sort((a, b) => b.timestamp - a.timestamp);
  };

  const getProductPriceHistory = (productId: string) => {
      return priceHistory
          .filter(h => h.productId === productId)
          .sort((a, b) => b.timestamp - a.timestamp);
  };

  const getProductReturnHistory = (productId: string) => {
      return returns
          .filter(r => r.items.some(i => i.productId === productId))
          .sort((a, b) => b.timestamp - a.timestamp);
  };

  // --- Bulk Actions ---
  const handleBulkEditSubmit = () => {
      if (selectedIds.size === 0) return;

      setProducts(prev => prev.map(p => {
          if (!selectedIds.has(p.id)) return p;

          const updated = { ...p };
          if (bulkEditForm.category) updated.category = bulkEditForm.category;
          if (bulkEditForm.supplier) updated.supplier = bulkEditForm.supplier;
          if (bulkEditForm.minStockLevel) updated.minStockLevel = parseInt(bulkEditForm.minStockLevel);
          if (bulkEditForm.priceAdjustment) {
              const adjustment = parseFloat(bulkEditForm.priceAdjustment);
              if (!isNaN(adjustment)) {
                  updated.price = updated.price * (1 + (adjustment / 100));
                  // Log price change for each
                  onLogPriceChange({
                      id: `ph-bulk-${Date.now()}-${p.id}`,
                      productId: p.id,
                      type: 'PRICE',
                      oldValue: p.price,
                      newValue: updated.price,
                      userId: currentUser.id,
                      userName: currentUser.name,
                      timestamp: Date.now()
                  });
              }
          }
          return updated;
      }));

      showToast(`Updated ${selectedIds.size} products.`, 'SUCCESS');
      setIsBulkEditOpen(false);
      setSelectedIds(new Set());
      setBulkEditForm({ category: '', minStockLevel: '', supplier: '', priceAdjustment: '' });
  };

  const handlePrintLabels = () => {
      window.print();
  };

  const inputClass = "w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500";

  return (
    <div className="space-y-6">
       
       {/* Styles for Printing */}
       <style>{`
        @media print {
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 100%; 
                margin: 0;
                padding: 20px;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 15px;
            }
            .label-item {
                border: 1px dashed #ccc;
                padding: 10px;
                text-align: center;
                break-inside: avoid;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 140px;
            }
            .no-print { display: none !important; }
        }
       `}</style>

       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Inventory</h2>
          <p className="text-slate-500 text-sm mt-1">Manage products, stock levels, and pricing.</p>
        </div>
        <div className="flex space-x-2">
            <button 
              onClick={handleExportInventory}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
              title="Export to Excel"
            >
              <Download size={18} className="mr-2" /> Export XLS
            </button>
            <button 
              onClick={handleOpenInsights}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
            >
              <Sparkles size={18} className="mr-2" /> AI Insights
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
            >
              <Plus size={18} className="mr-2" /> Add Product
            </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search by Name, SKU, or Barcode..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center px-4 py-2.5 rounded-lg border transition-colors ${showFilters || hasActiveFilters ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                  <SlidersHorizontal size={18} className="mr-2" /> Filters {hasActiveFilters && <span className="ml-1 w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>}
              </button>
          </div>

          {/* Expanded Filters Panel */}
          {showFilters && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
                  <div>
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center"><Tag size={16} className="mr-2"/> Categories</h4>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {uniqueCategories.map(cat => (
                              <button 
                                  key={cat} 
                                  onClick={() => toggleFilterItem('categories', cat)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeFilters.categories.includes(cat) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-blue-300'}`}
                              >
                                  {cat}
                              </button>
                          ))}
                      </div>
                  </div>
                  <div>
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center"><Package size={16} className="mr-2"/> Suppliers</h4>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {uniqueSuppliers.length === 0 ? <span className="text-xs text-slate-400 italic">No suppliers found</span> : uniqueSuppliers.map(sup => (
                              <button 
                                  key={sup} 
                                  onClick={() => toggleFilterItem('suppliers', sup)}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${activeFilters.suppliers.includes(sup) ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-purple-300'}`}
                              >
                                  {sup}
                              </button>
                          ))}
                      </div>
                  </div>
                  <div>
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center"><Activity size={16} className="mr-2"/> Stock Range</h4>
                      <div className="flex items-center gap-2">
                          <input 
                              type="number" 
                              placeholder="Min" 
                              value={activeFilters.stockRange.min}
                              onChange={(e) => setActiveFilters({...activeFilters, stockRange: { ...activeFilters.stockRange, min: e.target.value }})}
                              className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white"
                          />
                          <span className="text-slate-400">-</span>
                          <input 
                              type="number" 
                              placeholder="Max" 
                              value={activeFilters.stockRange.max}
                              onChange={(e) => setActiveFilters({...activeFilters, stockRange: { ...activeFilters.stockRange, max: e.target.value }})}
                              className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-white"
                          />
                      </div>
                  </div>
              </div>
          )}

          {/* Active Filter Chips */}
          {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Active Filters:</span>
                  {activeFilters.categories.map(cat => (
                      <span key={`cat-${cat}`} className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold flex items-center">
                          Category: {cat}
                          <button onClick={() => toggleFilterItem('categories', cat)} className="ml-2 hover:text-blue-900"><X size={12}/></button>
                      </span>
                  ))}
                  {activeFilters.suppliers.map(sup => (
                      <span key={`sup-${sup}`} className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-3 py-1 rounded-full text-xs font-bold flex items-center">
                          Supplier: {sup}
                          <button onClick={() => toggleFilterItem('suppliers', sup)} className="ml-2 hover:text-purple-900"><X size={12}/></button>
                      </span>
                  ))}
                  {(activeFilters.stockRange.min !== '' || activeFilters.stockRange.max !== '') && (
                      <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-bold flex items-center">
                          Stock: {activeFilters.stockRange.min || '0'} - {activeFilters.stockRange.max || '∞'}
                          <button onClick={() => setActiveFilters({...activeFilters, stockRange: { min: '', max: '' }})} className="ml-2 hover:text-emerald-900"><X size={12}/></button>
                      </span>
                  )}
                  <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 hover:underline font-medium ml-auto">Clear All</button>
              </div>
          )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 w-10">
                    <button onClick={handleSelectAll} className="flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        {selectedIds.size > 0 && selectedIds.size === filteredProducts.length ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                    </button>
                </th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Product Name</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">SKU / Barcode</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Category</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Price / Cost</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Margin</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-center">Stock</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredProducts.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">No products found matching your filters.</td></tr>
                ) : (
                    filteredProducts.map(product => {
                        const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;
                        const isLow = product.stock <= product.minStockLevel && product.stock > 0;
                        const isOut = product.stock === 0;
                        const isSelected = selectedIds.has(product.id);

                        return (
                            <tr key={product.id} className={`border-b border-slate-100 dark:border-slate-700 transition ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                <td className="p-4">
                                    <button onClick={() => handleSelectRow(product.id)} className="flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                        {isSelected ? <CheckSquare size={20} className="text-blue-600"/> : <Square size={20}/>}
                                    </button>
                                </td>
                                <td onClick={() => handleViewDetails(product)} className="p-4 cursor-pointer">
                                    <div className="flex items-center">
                                        <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 mr-3 overflow-hidden shrink-0">
                                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover"/> : <Package className="w-5 h-5 m-auto text-slate-400"/>}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{product.name}</div>
                                            {product.stockExpiryDate && <div className="text-[10px] text-orange-500">Exp: {product.stockExpiryDate}</div>}
                                        </div>
                                    </div>
                                </td>
                                <td onClick={() => handleViewDetails(product)} className="p-4 cursor-pointer">
                                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300 uppercase font-bold">{product.sku}</div>
                                      {product.barcode && <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{product.barcode}</div>}
                                </td>
                                <td onClick={() => handleViewDetails(product)} className="p-4 cursor-pointer">
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700/50 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                                          {product.category}
                                      </span>
                                </td>
                                <td onClick={() => handleViewDetails(product)} className="p-4 text-right cursor-pointer">
                                      <div className="font-black text-slate-900 dark:text-white">{symbol}{product.price.toFixed(2)}</div>
                                      <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Cost: {symbol}{product.cost.toFixed(2)}</div>
                                </td>
                                <td onClick={() => handleViewDetails(product)} className="p-4 text-right cursor-pointer">
                                      <span className={`text-xs font-black px-2 py-1 rounded-lg ${
                                          margin > 40 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                          margin > 15 ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400' :
                                          'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400'
                                      }`}>
                                          {margin.toFixed(1)}%
                                      </span>
                                </td>
                                <td className="p-4 text-center font-black">
                                      <button onClick={() => handleOpenAdjModal(product)} className={`px-2.5 py-1.5 rounded-lg border transition text-xs flex items-center justify-center mx-auto min-w-[70px] ${
                                          isOut ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-500/20 dark:border-red-900/50 dark:text-red-400' : 
                                          isLow ? 'border-orange-200 bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:border-orange-900/50 dark:text-orange-400' : 
                                          'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                                      }`}>
                                          {product.stock} <span className="text-[9px] font-normal opacity-60 uppercase ml-1">{product.unit}</span>
                                      </button>
                                </td>
                                <td className="p-4 text-right">
                                      <div className="flex items-center justify-end space-x-1">
                                          <button onClick={() => handleViewDetails(product)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 rounded-lg" title="Product Details & History"><History size={16}/></button>
                                          <button onClick={() => handleOpenModal(product)} className="p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-lg" title="Edit"><Edit2 size={16}/></button>
                                          <button onClick={() => handleDelete(product.id)} className="p-2 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg" title="Delete"><Trash2 size={16}/></button>
                                      </div>
                                </td>
                            </tr>
                        );
                    })
                )}
            </tbody>
          </table>
          
          {/* Bulk Action Toolbar */}
          {selectedIds.size > 0 && (
              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white rounded-full shadow-xl px-6 py-3 flex items-center gap-4 z-10 animate-in slide-in-from-bottom-10 fade-in duration-300">
                  <span className="font-bold text-sm whitespace-nowrap">{selectedIds.size} Selected</span>
                  <div className="h-4 w-[1px] bg-slate-700"></div>
                  <button onClick={() => setIsBulkEditOpen(true)} className="flex items-center text-sm font-medium hover:text-blue-400 transition"><Layers size={16} className="mr-2"/> Bulk Edit</button>
                  <button onClick={() => setIsBulkPrintOpen(true)} className="flex items-center text-sm font-medium hover:text-blue-400 transition"><Printer size={16} className="mr-2"/> Print Labels</button>
                  <div className="h-4 w-[1px] bg-slate-700"></div>
                  <button onClick={() => setSelectedIds(new Set())} className="p-1 hover:bg-slate-800 rounded-full"><X size={16}/></button>
              </div>
          )}
      </div>

      {/* Detailed View Modal */}
      {isDetailOpen && detailProduct && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
                      <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-lg bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                              {detailProduct.imageUrl ? (
                                  <img src={detailProduct.imageUrl} alt={detailProduct.name} className="w-full h-full object-cover" />
                              ) : (
                                  <Package className="text-slate-400" size={32} />
                              )}
                          </div>
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">{detailProduct.name}</h3>
                                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      {detailProduct.category}
                                  </span>
                              </div>
                              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <span className="font-mono bg-slate-200 dark:bg-slate-600 px-1.5 rounded text-slate-700 dark:text-slate-300">{detailProduct.sku}</span>
                                  {detailProduct.barcode && <span className="font-mono text-xs opacity-75 border-l border-slate-300 pl-2">Barcode: {detailProduct.barcode}</span>}
                              </p>
                          </div>
                      </div>
                      <button onClick={() => setIsDetailOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"><X size={20}/></button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-6">
                      
                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Selling Price</p>
                              <p className="text-lg font-black text-slate-800 dark:text-white">{symbol}{detailProduct.price.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Cost Price</p>
                              <p className="text-lg font-medium text-slate-700 dark:text-slate-300">{symbol}{detailProduct.cost.toFixed(2)}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Current Stock</p>
                              <p className={`text-lg font-black ${detailProduct.stock <= detailProduct.minStockLevel ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                                  {detailProduct.stock} <span className="text-xs font-normal text-slate-500">{detailProduct.unit}</span>
                              </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-600">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-1">Alert Level</p>
                              <p className="text-lg font-medium text-orange-600 dark:text-orange-400">{detailProduct.minStockLevel} <span className="text-xs font-normal text-slate-500">units</span></p>
                          </div>
                      </div>

                      {/* Detailed Info Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                          <div className="space-y-4">
                              <div>
                                  <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2 flex items-center"><Info size={16} className="mr-2 text-blue-500"/> Product Information</h4>
                                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                                      <div className="flex justify-between p-3 text-sm">
                                          <span className="text-slate-500 dark:text-slate-400">Supplier</span>
                                          <span className="font-medium text-slate-800 dark:text-white">{detailProduct.supplier || 'N/A'}</span>
                                      </div>
                                      <div className="flex justify-between p-3 text-sm">
                                          <span className="text-slate-500 dark:text-slate-400">Unit Type</span>
                                          <span className="font-medium text-slate-800 dark:text-white">{detailProduct.unit || 'Piece'}</span>
                                      </div>
                                      <div className="flex justify-between p-3 text-sm">
                                          <span className="text-slate-500 dark:text-slate-400">Stock Expiry</span>
                                          <span className={`font-medium ${detailProduct.stockExpiryDate ? 'text-slate-800 dark:text-white' : 'text-slate-400 italic'}`}>
                                              {detailProduct.stockExpiryDate ? new Date(detailProduct.stockExpiryDate).toLocaleDateString() : 'None'}
                                          </span>
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div>
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2 flex items-center"><FileText size={16} className="mr-2 text-indigo-500"/> Description</h4>
                              <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300 min-h-[105px] italic">
                                  {detailProduct.description || "No description available."}
                              </div>
                          </div>
                      </div>

                      {/* History Section */}
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                          <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center"><History size={20} className="mr-2"/> Activity History</h4>
                          
                          {/* Tabs */}
                          <div className="flex border-b border-slate-200 dark:border-slate-700 mb-4 gap-6">
                              <button 
                                  onClick={() => setActiveHistoryTab('STOCK')}
                                  className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeHistoryTab === 'STOCK' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                              >
                                  Stock Changes
                              </button>
                              <button 
                                  onClick={() => setActiveHistoryTab('PRICE')}
                                  className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeHistoryTab === 'PRICE' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                              >
                                  Price History
                              </button>
                              <button 
                                  onClick={() => setActiveHistoryTab('RETURNS')}
                                  className={`py-2 text-sm font-bold border-b-2 transition-colors ${activeHistoryTab === 'RETURNS' ? 'border-blue-600 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                              >
                                  Return History
                              </button>
                          </div>

                          <div className="min-h-[200px]">
                              {activeHistoryTab === 'STOCK' && (
                                  getProductHistory(detailProduct.id).length === 0 ? (
                                      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                          <Box size={32} className="opacity-20 mb-2"/>
                                          <p className="text-sm">No stock history recorded.</p>
                                      </div>
                                  ) : (
                                      <table className="w-full text-left text-xs border-collapse">
                                          <thead className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 dark:text-slate-400 uppercase">
                                              <tr>
                                                  <th className="p-3 border-b dark:border-slate-700">Date</th>
                                                  <th className="p-3 border-b dark:border-slate-700">Type</th>
                                                  <th className="p-3 border-b dark:border-slate-700 text-right">Qty</th>
                                                  <th className="p-3 border-b dark:border-slate-700 text-center">Stock</th>
                                                  <th className="p-3 border-b dark:border-slate-700">User / Reason</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                              {getProductHistory(detailProduct.id).map(adj => (
                                                  <tr key={adj.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                      <td className="p-3 text-slate-600 dark:text-slate-300">
                                                          {new Date(adj.timestamp).toLocaleDateString()} <span className="text-slate-400">{new Date(adj.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                      </td>
                                                      <td className="p-3">
                                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                              adj.type === 'ADD' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                              adj.type === 'REMOVE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                          }`}>
                                                              {adj.type}
                                                          </span>
                                                      </td>
                                                      <td className={`p-3 text-right font-bold ${adj.type === 'ADD' ? 'text-green-600 dark:text-green-400' : adj.type === 'REMOVE' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                          {adj.type === 'ADD' ? '+' : adj.type === 'REMOVE' ? '-' : ''}{adj.quantity}
                                                      </td>
                                                      <td className="p-3 text-center">
                                                          <div className="flex items-center justify-center gap-1">
                                                              <span className="text-slate-400 line-through">{adj.previousStock}</span>
                                                              <ArrowRight size={10} className="text-slate-300"/>
                                                              <span className="font-bold text-slate-800 dark:text-white">{adj.newStock}</span>
                                                          </div>
                                                      </td>
                                                      <td className="p-3 max-w-[200px]">
                                                          <div className="font-medium text-slate-800 dark:text-white truncate">{adj.userName}</div>
                                                          <div className="text-slate-500 italic truncate text-[10px]">{adj.reason}</div>
                                                      </td>
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  )
                              )}
                              
                              {activeHistoryTab === 'PRICE' && (
                                  getProductPriceHistory(detailProduct.id).length === 0 ? (
                                      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                          <Tag size={32} className="opacity-20 mb-2"/>
                                          <p className="text-sm">No price changes recorded.</p>
                                      </div>
                                  ) : (
                                      <table className="w-full text-left text-xs border-collapse">
                                          <thead className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 dark:text-slate-400 uppercase">
                                              <tr>
                                                  <th className="p-3 border-b dark:border-slate-700">Date</th>
                                                  <th className="p-3 border-b dark:border-slate-700">User</th>
                                                  <th className="p-3 border-b dark:border-slate-700">Type</th>
                                                  <th className="p-3 border-b dark:border-slate-700 text-right">Old</th>
                                                  <th className="p-3 border-b dark:border-slate-700 text-right">New</th>
                                                  <th className="p-3 border-b dark:border-slate-700 text-right">Change</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                              {getProductPriceHistory(detailProduct.id).map(log => {
                                                  const diff = log.newValue - log.oldValue;
                                                  const isIncrease = diff > 0;
                                                  return (
                                                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                          <td className="p-3 text-slate-600 dark:text-slate-300">
                                                              {new Date(log.timestamp).toLocaleDateString()} <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                          </td>
                                                          <td className="p-3 font-medium text-slate-800 dark:text-white">{log.userName}</td>
                                                          <td className="p-3 uppercase font-bold text-[10px] text-slate-500">{log.type}</td>
                                                          <td className="p-3 text-right text-slate-500">{symbol}{log.oldValue.toFixed(2)}</td>
                                                          <td className="p-3 text-right font-bold text-slate-800 dark:text-white">{symbol}{log.newValue.toFixed(2)}</td>
                                                          <td className={`p-3 text-right font-bold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                                                              {isIncrease ? '+' : ''}{Math.abs((diff / log.oldValue) * 100).toFixed(1)}%
                                                          </td>
                                                      </tr>
                                                  );
                                              })}
                                          </tbody>
                                      </table>
                                  )
                              )}

                              {activeHistoryTab === 'RETURNS' && (
                                  getProductReturnHistory(detailProduct.id).length === 0 ? (
                                      <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                          <RotateCcw size={32} className="opacity-20 mb-2"/>
                                          <p className="text-sm">No returns recorded.</p>
                                      </div>
                                  ) : (
                                      <table className="w-full text-left text-xs border-collapse">
                                          <thead className="bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 dark:text-slate-400 uppercase">
                                              <tr>
                                                  <th className="p-3 border-b dark:border-slate-700">Date</th>
                                                  <th className="p-3 border-b dark:border-slate-700">Order Ref</th>
                                                  <th className="p-3 border-b dark:border-slate-700 text-center">Qty</th>
                                                  <th className="p-3 border-b dark:border-slate-700">Reason</th>
                                                  <th className="p-3 border-b dark:border-slate-700 text-center">Restocked</th>
                                              </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                              {getProductReturnHistory(detailProduct.id).map(ret => {
                                                  const item = ret.items.find(i => i.productId === detailProduct.id);
                                                  if (!item) return null;
                                                  return (
                                                      <tr key={ret.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                          <td className="p-3 text-slate-600 dark:text-slate-300">
                                                              {new Date(ret.timestamp).toLocaleDateString()}
                                                          </td>
                                                          <td className="p-3 font-mono text-blue-600 dark:text-blue-400">#{ret.originalSaleId.split('-')[1]}</td>
                                                          <td className="p-3 text-center font-bold text-red-600 dark:text-red-400">{item.quantity}</td>
                                                          <td className="p-3 text-slate-600 dark:text-slate-300">{item.reason}</td>
                                                          <td className="p-3 text-center">
                                                              {item.restock ? <span className="text-green-600 font-bold">YES</span> : <span className="text-slate-400">NO</span>}
                                                          </td>
                                                      </tr>
                                                  );
                                              })}
                                          </tbody>
                                      </table>
                                  )
                              )}
                          </div>
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end">
                      <button onClick={() => setIsDetailOpen(false)} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition">Close</button>
                  </div>
              </div>
          </div>
      )}

      {/* Add/Edit Product Modal */}
      {isProductModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                      <button onClick={() => setIsProductModalOpen(false)}><X className="text-slate-400 hover:text-slate-600" size={24} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Product Name <span className="text-red-500">*</span></label>
                              <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} className={inputClass} />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">SKU <span className="text-red-500">*</span></label>
                              <input type="text" value={productForm.sku} onChange={e => setProductForm({...productForm, sku: e.target.value})} className={inputClass} />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Barcode</label>
                              <input type="text" value={productForm.barcode || ''} onChange={e => setProductForm({...productForm, barcode: e.target.value})} className={inputClass} placeholder="Scan or enter barcode" />
                          </div>
                          <div className="col-span-2 md:col-span-1 relative group">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Category</label>
                              <div className="relative">
                                  <input 
                                      type="text" 
                                      value={productForm.category} 
                                      onChange={e => {
                                          setProductForm({...productForm, category: e.target.value});
                                          setShowCategoryDropdown(true);
                                      }}
                                      onFocus={() => setShowCategoryDropdown(true)}
                                      onBlur={() => setTimeout(() => setShowCategoryDropdown(false), 200)}
                                      className={inputClass}
                                      placeholder="Select or create..."
                                  />
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                      <ChevronDown size={14} />
                                  </div>
                                  
                                  {showCategoryDropdown && (
                                      <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                          {inputSuggestions
                                              .filter(c => c.toLowerCase().includes((productForm.category || '').toLowerCase()))
                                              .map(c => (
                                              <div 
                                                  key={c}
                                                  onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      setProductForm({...productForm, category: c});
                                                      setShowCategoryDropdown(false);
                                                  }}
                                                  className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm text-slate-700 dark:text-slate-200"
                                              >
                                                  {c}
                                              </div>
                                          ))}
                                          
                                          {productForm.category && !inputSuggestions.some(c => c.toLowerCase() === productForm.category?.toLowerCase()) && (
                                              <div 
                                                  onMouseDown={(e) => {
                                                      e.preventDefault();
                                                      setShowCategoryDropdown(false);
                                                  }}
                                                  className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer text-sm text-blue-600 dark:text-blue-400 font-bold border-t border-slate-100 dark:border-slate-600 flex items-center"
                                              >
                                                  <Plus size={14} className="mr-1"/> Create "{productForm.category}"
                                              </div>
                                          )}
                                      </div>
                                  )}
                              </div>
                          </div>
                          <div className="col-span-2 md:col-span-1">
                               <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Unit</label>
                               <input type="text" value={productForm.unit} onChange={e => setProductForm({...productForm, unit: e.target.value})} className={inputClass} />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Selling Price <span className="text-red-500">*</span></label>
                              <input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: parseFloat(e.target.value)})} className={inputClass} />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Cost Price</label>
                              <input type="number" step="0.01" value={productForm.cost} onChange={e => setProductForm({...productForm, cost: parseFloat(e.target.value)})} className={inputClass} />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Current Stock</label>
                              <input type="number" value={productForm.stock} onChange={e => setProductForm({...productForm, stock: parseInt(e.target.value)})} disabled={!!editingProduct} className={`${inputClass} disabled:opacity-50`} />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Min Stock Level</label>
                              <input type="number" value={productForm.minStockLevel} onChange={e => setProductForm({...productForm, minStockLevel: parseInt(e.target.value)})} className={inputClass} />
                          </div>
                          {/* New Field */}
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Stock Expiry Date</label>
                              <input type="date" value={productForm.stockExpiryDate || ''} onChange={e => setProductForm({...productForm, stockExpiryDate: e.target.value})} className={`${inputClass} dark:[color-scheme:dark]`} />
                          </div>
                          {/* Supplier Field */}
                          <div className="col-span-2 md:col-span-1">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Supplier</label>
                              <input type="text" value={productForm.supplier || ''} onChange={e => setProductForm({...productForm, supplier: e.target.value})} className={inputClass} placeholder="Supplier Name" />
                          </div>
                           <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">Product Image</label>
                              <div className="flex items-start space-x-4">
                                  <div className="relative w-24 h-24 rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden shrink-0 group">
                                      {productForm.imageUrl ? (
                                          <>
                                              <img src={productForm.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                              <button 
                                                  onClick={() => setProductForm({...productForm, imageUrl: ''})}
                                                  className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                                  title="Remove Image"
                                              >
                                                  <X size={20} />
                                              </button>
                                          </>
                                      ) : (
                                          <div className="flex flex-col items-center text-slate-400">
                                              <ImageIcon size={24} className="mb-1" />
                                              <span className="text-[10px] font-medium">No Image</span>
                                          </div>
                                      )}
                                  </div>
                                  <div className="flex-1 space-y-3">
                                      <div>
                                          <input 
                                              type="file" 
                                              accept="image/*"
                                              onChange={handleImageUpload}
                                              className="block w-full text-xs text-slate-500 dark:text-slate-400
                                                  file:mr-4 file:py-2 file:px-4
                                                  file:rounded-lg file:border-0
                                                  file:text-xs file:font-bold
                                                  file:bg-blue-50 file:text-blue-700
                                                  hover:file:bg-blue-100
                                                  dark:file:bg-blue-900/30 dark:file:text-blue-300
                                                  cursor-pointer"
                                          />
                                      </div>
                                      <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">URL</span>
                                          <input 
                                              type="text" 
                                              value={productForm.imageUrl} 
                                              onChange={e => setProductForm({...productForm, imageUrl: e.target.value})} 
                                              className={inputClass}
                                              placeholder="https://example.com/image.png" 
                                          />
                                      </div>
                                  </div>
                              </div>
                          </div>
                          <div className="col-span-2">
                              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 flex justify-between">
                                  <span>Description</span>
                                  <button onClick={handleGenerateDescription} disabled={isGeneratingDesc} className="text-blue-600 flex items-center hover:underline disabled:opacity-50">
                                      {isGeneratingDesc ? <RefreshCw className="animate-spin mr-1" size={12}/> : <Sparkles size={12} className="mr-1"/>} 
                                      {isGeneratingDesc ? 'Generating...' : 'Generate with AI'}
                                  </button>
                              </label>
                              <textarea rows={3} value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} className={inputClass} />
                          </div>
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end space-x-3">
                      <button onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition">Cancel</button>
                      <button onClick={handleSaveProduct} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition">Save Product</button>
                  </div>
              </div>
          </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-white flex items-center"><Layers className="mr-2" size={20}/> Bulk Edit Products</h3>
                  <p className="text-sm text-slate-500 mb-6">Editing {selectedIds.size} selected items. Leave fields blank to keep current values.</p>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Category</label>
                          <input type="text" placeholder="No Change" value={bulkEditForm.category} onChange={e => setBulkEditForm({...bulkEditForm, category: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Supplier</label>
                          <input type="text" placeholder="No Change" value={bulkEditForm.supplier} onChange={e => setBulkEditForm({...bulkEditForm, supplier: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Min Stock Level</label>
                          <input type="number" placeholder="No Change" value={bulkEditForm.minStockLevel} onChange={e => setBulkEditForm({...bulkEditForm, minStockLevel: e.target.value})} className={inputClass} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Price Adjustment (%)</label>
                          <div className="flex items-center">
                              <input type="number" placeholder="0" value={bulkEditForm.priceAdjustment} onChange={e => setBulkEditForm({...bulkEditForm, priceAdjustment: e.target.value})} className={inputClass} />
                              <span className="ml-2 text-sm text-slate-500">%</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Example: '10' increases price by 10%. '-5' decreases by 5%.</p>
                      </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                      <button onClick={() => setIsBulkEditOpen(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                      <button onClick={handleBulkEditSubmit} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700">Apply Changes</button>
                  </div>
              </div>
          </div>
      )}

      {/* Bulk Print Labels Modal */}
      {isBulkPrintOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
                      <h3 className="font-bold text-slate-800 dark:text-white flex items-center"><Printer className="mr-2" size={20}/> Print Barcode Labels</h3>
                      <div className="flex gap-2">
                          <button onClick={handlePrintLabels} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition">Print Now</button>
                          <button onClick={() => setIsBulkPrintOpen(false)}><X className="text-slate-400 hover:text-slate-600" size={24} /></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900 p-8">
                      <div id="print-area" className="bg-white text-black w-full min-h-full p-4 grid grid-cols-3 gap-4 shadow-lg mx-auto max-w-[210mm]">
                          {products.filter(p => selectedIds.has(p.id)).map(product => (
                              <div key={product.id} className="label-item border border-dashed border-slate-300 p-4 flex flex-col items-center justify-center text-center h-[140px] rounded-lg bg-white">
                                  <div className="font-bold text-sm mb-1 truncate w-full px-2 text-black">{product.name}</div>
                                  <div className="font-black text-lg mb-1 text-black">{symbol}{product.price.toFixed(2)}</div>
                                  <LabelBarcode value={product.barcode || product.sku} />
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjModalOpen && selectedProduct && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                  <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Adjust Stock: {selectedProduct.name}</h3>
                  <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg mb-4 text-center">
                      <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Current Stock</span>
                      <span className="text-2xl font-black text-slate-800 dark:text-white">{selectedProduct.stock} {selectedProduct.unit}</span>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Action</label>
                          <div className="flex space-x-2">
                              <button onClick={() => setAdjForm({...adjForm, type: 'ADD'})} className={`flex-1 py-2 text-xs font-bold rounded border ${adjForm.type === 'ADD' ? 'bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' : 'dark:border-slate-600 dark:text-slate-300'}`}>ADD</button>
                              <button onClick={() => setAdjForm({...adjForm, type: 'REMOVE'})} className={`flex-1 py-2 text-xs font-bold rounded border ${adjForm.type === 'REMOVE' ? 'bg-red-100 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400' : 'dark:border-slate-600 dark:text-slate-300'}`}>REMOVE</button>
                              <button onClick={() => setAdjForm({...adjForm, type: 'SET'})} className={`flex-1 py-2 text-xs font-bold rounded border ${adjForm.type === 'SET' ? 'bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400' : 'dark:border-slate-600 dark:text-slate-300'}`}>SET</button>
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Quantity</label>
                          <input type="number" min="0" value={adjForm.quantity} onChange={e => setAdjForm({...adjForm, quantity: parseInt(e.target.value)})} className={`text-lg font-bold text-center ${inputClass}`} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Reason</label>
                          <input type="text" value={adjForm.reason} onChange={e => setAdjForm({...adjForm, reason: e.target.value})} className={inputClass} placeholder="e.g. Damage, Restock, Count" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Notes</label>
                          <input type="text" value={adjForm.notes} onChange={e => setAdjForm({...adjForm, notes: e.target.value})} className={inputClass} placeholder="Optional details..." />
                      </div>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                      <button onClick={() => setIsAdjModalOpen(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                      <button onClick={handleSubmitAdjustment} className="px-6 py-2 bg-slate-900 dark:bg-blue-600 text-white font-bold rounded-lg shadow-md">Confirm</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}

export default Inventory;