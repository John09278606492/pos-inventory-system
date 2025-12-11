import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, StockAdjustment, AdjustmentType, User, ReturnTransaction, Customer, Sale, PriceHistory } from '../types';
import { generateProductDescription, suggestRestock } from '../services/geminiService';
import { Plus, Edit2, Trash2, Search, Wand2, RefreshCw, AlertCircle, AlertTriangle, CheckCircle, ClipboardEdit, History, X, ArrowRight, RotateCcw, ClipboardList, Filter, ArrowUp, ArrowDown, ChevronsUpDown, XCircle, ChevronDown, Check, TrendingUp, DollarSign, BarChart3, Package, Eye, Tags, ArrowBigUp, ArrowBigDown, Printer, FileSpreadsheet, Upload, Image as ImageIcon, ArrowRightLeft, Boxes, Scale, CheckSquare, Layers } from 'lucide-react';

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

type SortField = 'name' | 'sku' | 'category' | 'price' | 'stock' | 'stockExpiryDate' | 'cost' | 'margin';
type SortDirection = 'asc' | 'desc';

const Inventory: React.FC<InventoryProps> = ({ products, setProducts, stockAdjustments, onAdjustStock, onBulkAdjustStock, currentUser, currency, showToast, returns, customers, sales, priceHistory, onLogPriceChange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStockStatus, setFilterStockStatus] = useState<'ALL' | 'LOW' | 'OUT' | 'IN'>('ALL');
  const [filterExpiry, setFilterExpiry] = useState<'ALL' | 'EXPIRED' | 'SOON' | 'VALID'>('ALL');

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Adjustment State
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [selectedProductForAdj, setSelectedProductForAdj] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<AdjustmentType>('ADD');
  const [adjQuantity, setAdjQuantity] = useState(0);
  const [adjReason, setAdjReason] = useState('Stock Count Correction');
  const [adjNotes, setAdjNotes] = useState('');

  // Bulk Adjustment State
  const [isBulkAdjModalOpen, setIsBulkAdjModalOpen] = useState(false);
  const [bulkAdjType, setBulkAdjType] = useState<AdjustmentType>('ADD');
  const [bulkAdjQuantity, setBulkAdjQuantity] = useState(0);
  const [bulkAdjReason, setBulkAdjReason] = useState('Stock Count Correction');
  const [bulkAdjNotes, setBulkAdjNotes] = useState('');

  // Conversion State
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [convSourceId, setConvSourceId] = useState('');
  const [convTargetId, setConvTargetId] = useState('');
  const [convSourceQty, setConvSourceQty] = useState(1);
  const [convTargetQty, setConvTargetQty] = useState(1);

  // Detailed View State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [historyFilterType, setHistoryFilterType] = useState<AdjustmentType | 'ALL'>('ALL');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyView, setHistoryView] = useState<'ADJUSTMENTS' | 'RETURNS' | 'PRICE'>('ADJUSTMENTS');

  // Category & Unit Dropdown State
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', price: 0, cost: 0, stock: 0, unit: '', category: '', description: '', minStockLevel: 5, stockExpiryDate: '', imageUrl: '', allowDecimal: false
  });

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
  const formatNumber = (val: number) => val.toLocaleString('en-US', { maximumFractionDigits: 3 });

  const categories = useMemo(() => {
      const cats = new Set(products.map(p => p.category).filter(Boolean));
      return ['ALL', ...Array.from(cats).sort()];
  }, [products]);

  // Unique categories for the dropdown (excluding ALL)
  const uniqueCategories = useMemo(() => {
      const cats = new Set(products.map(p => p.category).filter(Boolean));
      return Array.from(cats).sort();
  }, [products]);

  // Unique units for the dropdown
  const uniqueUnits = useMemo(() => {
      const productUnits = new Set(products.map(p => p.unit).filter(Boolean) as string[]);
      const defaultUnits = ['pcs', 'kg', 'g', 'mg', 'l', 'ml', 'box', 'pack', 'sack', 'bottle', 'can', 'jar', 'm', 'cm', 'roll', 'set', 'pair', 'dozen', 'bundle', 'tray'];
      defaultUnits.forEach(u => productUnits.add(u));
      return Array.from(productUnits).sort();
  }, [products]);

  // Total Calculations for Top Cards
  const totalItems = products.reduce((acc, p) => acc + p.stock, 0);
  const totalValueRetail = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
  const totalValueCost = products.reduce((acc, p) => acc + (p.cost * p.stock), 0);

  // Click outside to close dropdowns
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
              setIsCategoryDropdownOpen(false);
          }
          if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
              setIsUnitDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData(product);
    } else {
      setEditingProduct(null);
      setFormData({
         name: '', sku: '', price: 0, cost: 0, stock: 0, unit: 'pcs', category: '', description: '', minStockLevel: 5, stockExpiryDate: '', imageUrl: '', allowDecimal: false
      });
    }
    setIsModalOpen(true);
    setIsCategoryDropdownOpen(false);
    setIsUnitDropdownOpen(false);
  };

  const handleOpenAdjModal = (product: Product) => {
      setSelectedProductForAdj(product);
      setAdjType('ADD');
      setAdjQuantity(0);
      setAdjReason('Stock Count Correction');
      setAdjNotes('');
      setIsAdjModalOpen(true);
  }

  const handleOpenConversionModal = () => {
      setConvSourceId('');
      setConvTargetId('');
      setConvSourceQty(1);
      setConvTargetQty(1);
      setIsConversionModalOpen(true);
  };

  const handleOpenDetails = (product: Product) => {
      setSelectedProductDetails(product);
      // Reset filters & view
      setHistoryFilterType('ALL');
      setHistoryStartDate('');
      setHistoryEndDate('');
      setHistoryView('ADJUSTMENTS');
      setIsDetailsModalOpen(true);
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB Limit
         showToast("Image too large. Please use an image under 2MB.", 'ERROR');
         return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitAdjustment = () => {
      if (!selectedProductForAdj) return;

      let newStock = selectedProductForAdj.stock;
      
      // Calculate new stock with float precision if needed
      if (adjType === 'ADD') newStock = parseFloat((selectedProductForAdj.stock + adjQuantity).toFixed(3));
      if (adjType === 'REMOVE') newStock = parseFloat((selectedProductForAdj.stock - adjQuantity).toFixed(3));
      if (adjType === 'SET') newStock = adjQuantity;

      // Prevent negative stock unless desired, for now block it
      if (newStock < 0) {
          showToast("Stock cannot be negative.", 'ERROR');
          return;
      }

      const adjustment: StockAdjustment = {
          id: `adj-${Date.now()}`,
          productId: selectedProductForAdj.id,
          productName: selectedProductForAdj.name,
          userId: currentUser.id,
          userName: currentUser.name,
          timestamp: Date.now(),
          type: adjType,
          quantity: adjQuantity,
          previousStock: selectedProductForAdj.stock,
          newStock: newStock,
          reason: adjReason,
          notes: adjNotes
      };

      onAdjustStock(adjustment);
      setIsAdjModalOpen(false);
  }

  const handleBulkSubmit = () => {
      if (bulkAdjQuantity <= 0 && bulkAdjType !== 'SET') {
          showToast("Quantity must be greater than zero.", 'ERROR');
          return;
      }
      if (bulkAdjType === 'SET' && bulkAdjQuantity < 0) {
          showToast("Stock cannot be negative.", 'ERROR');
          return;
      }

      const timestamp = Date.now();
      const adjustments: StockAdjustment[] = [];

      selectedIds.forEach(id => {
          const product = products.find(p => p.id === id);
          if (!product) return;

          let delta = bulkAdjQuantity;
          let newStock = product.stock;

          // If product doesn't allow decimal, floor the delta for operations to avoid fractional stocks
          // For SET, we just use the rounded quantity
          const qty = product.allowDecimal ? delta : Math.round(delta);

          if (bulkAdjType === 'ADD') {
              newStock = parseFloat((product.stock + qty).toFixed(3));
          } else if (bulkAdjType === 'REMOVE') {
              newStock = parseFloat((product.stock - qty).toFixed(3));
          } else if (bulkAdjType === 'SET') {
              newStock = qty;
          }

          if (newStock < 0) newStock = 0; // Prevent negative stock

          adjustments.push({
              id: `adj-bulk-${id}-${timestamp}`,
              productId: product.id,
              productName: product.name,
              userId: currentUser.id,
              userName: currentUser.name,
              timestamp: timestamp,
              type: bulkAdjType,
              quantity: qty,
              previousStock: product.stock,
              newStock: newStock,
              reason: bulkAdjReason,
              notes: bulkAdjNotes ? `[Bulk] ${bulkAdjNotes}` : '[Bulk Update]'
          });
      });

      onBulkAdjustStock(adjustments);
      setIsBulkAdjModalOpen(false);
      setSelectedIds(new Set()); // Clear selection
      setBulkAdjQuantity(0);
      setBulkAdjNotes('');
  };

  const handleConvertStock = () => {
      const sourceProd = products.find(p => p.id === convSourceId);
      const targetProd = products.find(p => p.id === convTargetId);

      if (!sourceProd || !targetProd) {
          showToast("Please select both source and target products.", 'ERROR');
          return;
      }
      if (sourceProd.id === targetProd.id) {
          showToast("Source and target cannot be the same.", 'ERROR');
          return;
      }
      if (convSourceQty <= 0) {
          showToast("Source quantity must be greater than zero.", 'ERROR');
          return;
      }
      if (convTargetQty <= 0) {
          showToast("Target quantity must be greater than zero.", 'ERROR');
          return;
      }
      if (sourceProd.stock < convSourceQty) {
          showToast(`Insufficient stock in ${sourceProd.name}.`, 'ERROR');
          return;
      }

      const timestamp = Date.now();

      // 1. Remove from Source
      const sourceAdj: StockAdjustment = {
          id: `adj-conv-src-${timestamp}`,
          productId: sourceProd.id,
          productName: sourceProd.name,
          userId: currentUser.id,
          userName: currentUser.name,
          timestamp: timestamp,
          type: 'REMOVE',
          quantity: convSourceQty,
          previousStock: sourceProd.stock,
          newStock: parseFloat((sourceProd.stock - convSourceQty).toFixed(3)),
          reason: `Conversion to ${targetProd.name}`,
          notes: `Repacked/Converted ${convSourceQty} units to ${convTargetQty} units of ${targetProd.name}`
      };

      // 2. Add to Target
      const targetAdj: StockAdjustment = {
          id: `adj-conv-tgt-${timestamp}`,
          productId: targetProd.id,
          productName: targetProd.name,
          userId: currentUser.id,
          userName: currentUser.name,
          timestamp: timestamp, // same timestamp ensures logical grouping
          type: 'ADD',
          quantity: convTargetQty,
          previousStock: targetProd.stock,
          newStock: parseFloat((targetProd.stock + convTargetQty).toFixed(3)),
          reason: `Conversion from ${sourceProd.name}`,
          notes: `Repacked/Converted from ${convSourceQty} units of ${sourceProd.name}`
      };

      onAdjustStock(sourceAdj);
      onAdjustStock(targetAdj);
      
      showToast(`Successfully converted ${convSourceQty} ${sourceProd.name} to ${convTargetQty} ${targetProd.name}`, 'SUCCESS');
      setIsConversionModalOpen(false);
  };

  const handleSave = () => {
    if (!formData.name || !formData.price || !formData.category) {
        showToast("Please fill in required fields (Name, Category, Price)", 'ERROR');
        return; 
    }

    if (editingProduct) {
      // Check for price/cost changes for history logging
      if (formData.price !== editingProduct.price) {
          onLogPriceChange({
              id: `ph-${Date.now()}-price`,
              productId: editingProduct.id,
              type: 'PRICE',
              oldValue: editingProduct.price,
              newValue: formData.price || 0,
              userId: currentUser.id,
              userName: currentUser.name,
              timestamp: Date.now()
          });
      }
      if (formData.cost !== editingProduct.cost) {
          onLogPriceChange({
              id: `ph-${Date.now()}-cost`,
              productId: editingProduct.id,
              type: 'COST',
              oldValue: editingProduct.cost,
              newValue: formData.cost || 0,
              userId: currentUser.id,
              userName: currentUser.name,
              timestamp: Date.now()
          });
      }

      setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...formData } as Product : p));
      showToast("Product updated successfully.", 'SUCCESS');
    } else {
      const newProduct: Product = {
        id: `p-${Date.now()}`,
        ...formData as Product
      };
      setProducts(prev => [...prev, newProduct]);
      showToast("New product created.", 'SUCCESS');
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast("Product deleted.", 'INFO');
    }
  };

  const handleGenerateDescription = async () => {
    if (!formData.name || !formData.category) {
        showToast("Please enter a Name and Category first.", 'ERROR');
        return;
    }
    const desc = await generateProductDescription(formData.name, formData.category);
    setFormData(prev => ({ ...prev, description: desc }));
    showToast("Description generated with AI.", 'SUCCESS');
  };

  const handleRestockCheck = async () => {
      setIsLoadingAi(true);
      const suggestions = await suggestRestock(products);
      setAiSuggestions(suggestions);
      setIsLoadingAi(false);
      showToast("Inventory analyzed by AI.", 'SUCCESS');
  }

  const getDaysUntilExpiry = (dateString?: string) => {
      if (!dateString) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Parse YYYY-MM-DD explicitly to avoid timezone issues
      const [year, month, day] = dateString.split('-').map(Number);
      const expiry = new Date(year, month - 1, day);
      
      const diffTime = expiry.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (days: number | null) => {
      if (days === null) return 'NONE';
      if (days < 0) return 'EXPIRED';
      if (days <= 30) return 'WARNING';
      return 'OK';
  };

  // --- Filtering & Sorting Logic ---

  const handleSort = (field: SortField) => {
      if (sortField === field) {
          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
          setSortField(field);
          setSortDirection('asc');
      }
  };

  const processedProducts = useMemo(() => {
      let filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Category Filter
      if (filterCategory !== 'ALL') {
          filtered = filtered.filter(p => p.category === filterCategory);
      }

      // Stock Status Filter
      if (filterStockStatus !== 'ALL') {
          if (filterStockStatus === 'OUT') filtered = filtered.filter(p => p.stock === 0);
          if (filterStockStatus === 'LOW') filtered = filtered.filter(p => p.stock > 0 && p.stock <= p.minStockLevel);
          if (filterStockStatus === 'IN') filtered = filtered.filter(p => p.stock > p.minStockLevel);
      }

      // Expiry Filter
      if (filterExpiry !== 'ALL') {
          filtered = filtered.filter(p => {
              const days = getDaysUntilExpiry(p.stockExpiryDate);
              if (filterExpiry === 'EXPIRED') return days !== null && days < 0;
              if (filterExpiry === 'SOON') return days !== null && days >= 0 && days <= 30;
              if (filterExpiry === 'VALID') return days === null || days > 30;
              return true;
          });
      }

      // Sorting
      return filtered.sort((a, b) => {
          let valA: any = a[sortField];
          let valB: any = b[sortField];

          // Computed fields for sort
          if (sortField === 'margin') {
              valA = a.price > 0 ? ((a.price - a.cost) / a.price) : 0;
              valB = b.price > 0 ? ((b.price - b.cost) / b.price) : 0;
          }

          // Handle special string cases for case-insensitive sort
          if (typeof valA === 'string') valA = valA.toLowerCase();
          if (typeof valB === 'string') valB = valB.toLowerCase();

          // Handle Date strings
          if (sortField === 'stockExpiryDate') {
              valA = valA ? new Date(valA).getTime() : (sortDirection === 'asc' ? 9999999999999 : -1); // Push nulls to end
              valB = valB ? new Date(valB).getTime() : (sortDirection === 'asc' ? 9999999999999 : -1);
          }

          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
      });

  }, [products, searchTerm, filterCategory, filterStockStatus, filterExpiry, sortField, sortDirection]);

  // Selection Logic
  const handleSelectAll = () => {
      if (selectedIds.size === processedProducts.length && processedProducts.length > 0) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(processedProducts.map(p => p.id)));
      }
  };

  const handleSelectRow = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const handleOpenBulkModal = () => {
      setBulkAdjType('ADD');
      setBulkAdjQuantity(0);
      setBulkAdjReason('Stock Count Correction');
      setBulkAdjNotes('');
      setIsBulkAdjModalOpen(true);
  };

  // Derived stats for top banners
  const expiringProducts = products.filter(p => {
    const days = getDaysUntilExpiry(p.stockExpiryDate);
    return days !== null && days >= 0 && days <= 30;
  });

  const expiredProducts = products.filter(p => {
      const days = getDaysUntilExpiry(p.stockExpiryDate);
      return days !== null && days < 0;
  });

  const lowStockProducts = products.filter(p => p.stock <= p.minStockLevel);

  const reasons = [
      'Stock Count Correction',
      'Received Shipment',
      'Damaged Goods',
      'Expired Stock',
      'Theft / Loss',
      'Return to Vendor',
      'Customer Return',
      'Promotion / Demo',
      'Other'
  ];

  // --- Financial Calculation Helper ---
  const getProductFinancials = (p: Product) => {
    let unitsSold = 0;
    let revenue = 0;
    let costOfGoodsSold = 0;

    sales.forEach(sale => {
        const item = sale.items.find(i => i.productId === p.id);
        if (item) {
            unitsSold += item.quantity;
            revenue += (item.priceAtSale * item.quantity);
            costOfGoodsSold += (item.costAtSale * item.quantity);
        }
    });

    let unitsReturned = 0;
    let refunded = 0;
    let profitReversal = 0;

    returns.forEach(ret => {
        const item = ret.items.find(i => i.productId === p.id);
        if (item) {
            unitsReturned += item.quantity;
            refunded += item.refundAmount;
            const originalSale = sales.find(s => s.id === ret.originalSaleId);
            const originalItem = originalSale?.items.find(i => i.productId === p.id);
            if (originalItem) {
                const unitProfit = originalItem.priceAtSale - originalItem.costAtSale;
                profitReversal += (unitProfit * item.quantity);
            }
        }
    });

    const netProfit = (revenue - costOfGoodsSold) - profitReversal;

    return {
        unitsSold,
        revenue,
        unitsReturned,
        refunded,
        netProfit,
        assetValue: p.cost * p.stock,
        retailValue: p.price * p.stock
    };
  };

  // --- Print Preparation ---
  const printCategories = useMemo(() => {
    const cats: Record<string, Product[]> = {};
    processedProducts.forEach(p => {
        const c = p.category || 'Uncategorized';
        if (!cats[c]) cats[c] = [];
        cats[c].push(p);
    });
    return cats;
  }, [processedProducts]);

  const printTotals = useMemo(() => {
    return processedProducts.reduce((acc, p) => {
        const stats = getProductFinancials(p);
        return {
            stock: acc.stock + p.stock,
            assetValue: acc.assetValue + stats.assetValue,
            retailValue: acc.retailValue + stats.retailValue,
            unitsSold: acc.unitsSold + stats.unitsSold,
            revenue: acc.revenue + stats.revenue,
            unitsReturned: acc.unitsReturned + stats.unitsReturned,
            refunded: acc.refunded + stats.refunded,
            netProfit: acc.netProfit + stats.netProfit
        };
    }, {
        stock: 0, assetValue: 0, retailValue: 0, unitsSold: 0, revenue: 0, unitsReturned: 0, refunded: 0, netProfit: 0
    });
  }, [processedProducts, sales, returns]);


  // --- Export & Print Handlers ---

  const handlePrint = () => {
      window.print();
  };

  const handleExport = () => {
    // 1. Group products by category to create a hierarchy
    const productsByCategory: Record<string, Product[]> = {};
    processedProducts.forEach(p => {
        const cat = p.category || 'Uncategorized';
        if (!productsByCategory[cat]) productsByCategory[cat] = [];
        productsByCategory[cat].push(p);
    });

    // 2. Define Columns with strict types for formatting
    const columns = [
         { header: 'Product Name', key: 'name' },
         { header: 'SKU', key: 'sku' },
         { header: 'Unit', key: 'unit' },
         { header: 'Description', key: 'description' },
         { header: 'Cost Price', key: 'cost', type: 'currency' },
         { header: 'Selling Price', key: 'price', type: 'currency' },
         { header: 'Margin %', key: 'margin', type: 'percent' },
         { header: 'Stock', key: 'stock', type: 'number' },
         { header: 'Status', key: 'status' },
         { header: 'Asset Value', key: 'assetValue', type: 'currency' },
         { header: 'Retail Value', key: 'retailValue', type: 'currency' },
         { header: 'Units Sold', key: 'unitsSold', type: 'number' },
         { header: 'Total Revenue', key: 'revenue', type: 'currency' },
         { header: 'Units Returned', key: 'unitsReturned', type: 'number' },
         { header: 'Total Refunded', key: 'refunded', type: 'currency' },
         { header: 'Net Profit', key: 'netProfit', type: 'currency' },
         { header: 'Expiry Date', key: 'expiry' }
    ];

    let tableRows = '';
    
    // 3. Build HTML Rows with Hierarchy
    Object.keys(productsByCategory).sort().forEach(category => {
        // Category Header Row (Hierarchy Level 1)
        tableRows += `<tr style="background-color: #e0e7ff;">
            <td colspan="${columns.length}" style="font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; font-size: 14px; text-transform: uppercase;">${category}</td>
        </tr>`;

        productsByCategory[category].forEach(p => {
            const stats = getProductFinancials(p);
            const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(2) : '0.00';
            
            let stockStatus = 'In Stock';
            if (p.stock === 0) stockStatus = 'Out of Stock';
            else if (p.stock <= p.minStockLevel) stockStatus = 'Low Stock';

            const values: Record<string, any> = {
                name: p.name,
                sku: p.sku,
                unit: p.unit || '',
                description: p.description || '',
                cost: p.cost,
                price: p.price,
                margin: margin,
                stock: p.stock,
                status: stockStatus,
                assetValue: stats.assetValue,
                retailValue: stats.retailValue,
                unitsSold: stats.unitsSold,
                revenue: stats.revenue,
                unitsReturned: stats.unitsReturned,
                refunded: stats.refunded,
                netProfit: stats.netProfit,
                expiry: p.stockExpiryDate || 'N/A'
            };

            // Product Row
            tableRows += `<tr>
                ${columns.map(col => {
                    let val = values[col.key];
                    let align = 'left';
                    let bgColor = '#ffffff';
                    
                    if (col.type === 'currency') {
                        val = typeof val === 'number' ? val.toFixed(2) : val;
                        align = 'right';
                    }
                    if (col.type === 'number') {
                         align = 'center';
                    }
                    if (col.type === 'percent') {
                         val = val + '%';
                         align = 'right';
                    }
                    
                    // Specific highlighting
                    if (col.key === 'netProfit') {
                        bgColor = parseFloat(val) >= 0 ? '#ecfdf5' : '#fef2f2'; // Green or Red tint
                    }

                    return `<td style="border: 1px solid #e2e8f0; padding: 8px; text-align: ${align}; vertical-align: top; background-color: ${bgColor}; mso-number-format:${col.type === 'currency' ? '\\#\\,\\#\\#0\\.00' : '@'};">${val}</td>`;
                }).join('')}
            </tr>`;
        });
    });

    // Append Grand Totals Row
    tableRows += `<tr style="font-weight: bold; background-color: #f1f5f9; border-top: 2px solid #334155;">
        <td colspan="7" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; text-transform: uppercase;">GRAND TOTALS</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${printTotals.stock.toFixed(3).replace(/\.?0+$/, '')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px;"></td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00'">${printTotals.assetValue.toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00'">${printTotals.retailValue.toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${printTotals.unitsSold.toFixed(3).replace(/\.?0+$/, '')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00'">${printTotals.revenue.toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center;">${printTotals.unitsReturned.toFixed(3).replace(/\.?0+$/, '')}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00'">${printTotals.refunded.toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; mso-number-format:'\\#\\,\\#\\#0\\.00'; color: ${printTotals.netProfit >= 0 ? 'green' : 'red'};">${printTotals.netProfit.toFixed(2)}</td>
        <td style="border: 1px solid #cbd5e1; padding: 10px;"></td>
    </tr>`;

    // 4. Construct complete HTML document for Excel
    const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Detailed Inventory</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; }
                table { border-collapse: collapse; width: 100%; }
                th { background-color: #f1f5f9; color: #334155; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: left; position: sticky; top: 0; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        ${columns.map(c => `<th style="text-align: ${c.type === 'currency' || c.type === 'percent' ? 'right' : (c.type === 'number' ? 'center' : 'left')}">${c.header}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `;

    // 5. Create Blob as XLS (Excel will interpret HTML table)
    const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `detailed_inventory_export_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // History Filtering Logic
  const getFilteredHistory = () => {
    if (!selectedProductDetails) return [];
    
    return stockAdjustments.filter(a => {
        if (a.productId !== selectedProductDetails.id) return false;
        
        // Type Filter
        if (historyFilterType !== 'ALL' && a.type !== historyFilterType) return false;
        
        // Date Range Filter
        if (historyStartDate) {
            const start = new Date(historyStartDate).setHours(0,0,0,0);
            if (a.timestamp < start) return false;
        }
        if (historyEndDate) {
            const end = new Date(historyEndDate).setHours(23,59,59,999);
            if (a.timestamp > end) return false;
        }
        
        return true;
    }).sort((a,b) => b.timestamp - a.timestamp);
  };

  // Get Product Returns Logic
  const getProductReturns = () => {
      if (!selectedProductDetails) return [];

      return returns.flatMap(ret => {
          const item = ret.items.find(i => i.productId === selectedProductDetails.id);
          if (!item) return [];

          const customerName = customers.find(c => c.id === ret.customerId)?.name || 'Guest';

          return [{
              ...item,
              returnId: ret.id,
              originalSaleId: ret.originalSaleId,
              timestamp: ret.timestamp,
              customerName,
              refundMethod: ret.refundMethod
          }];
      }).sort((a, b) => b.timestamp - a.timestamp);
  };

  // Get Price History Logic
  const getProductPriceHistory = () => {
      if (!selectedProductDetails) return [];
      return priceHistory
        .filter(ph => ph.productId === selectedProductDetails.id)
        .sort((a, b) => b.timestamp - a.timestamp);
  };

  const filteredHistory = getFilteredHistory();
  const productReturns = getProductReturns();
  const productPrices = getProductPriceHistory();

  const getSourceProductForConv = () => products.find(p => p.id === convSourceId);
  const isConvSourceQtyInvalid = getSourceProductForConv() ? convSourceQty > (getSourceProductForConv()?.stock || 0) : false;

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
            @page { size: landscape; margin: 10mm; }
            
            html, body, #root, main, .flex, .flex-col, .overflow-hidden, .overflow-auto, .overflow-y-auto {
                background-color: white !important;
                height: auto !important;
                width: 100% !important;
                overflow: visible !important;
                display: block !important;
                position: static !important;
            }

            body * {
                visibility: hidden;
            }

            .printable-area, .printable-area * {
                visibility: visible !important;
            }

            .printable-area {
                display: block !important;
                position: absolute !important;
                top: 0;
                left: 0;
                width: 100%;
                margin: 0;
                padding: 0;
            }
            
            .no-print {
                display: none !important;
            }

            table { width: 100%; border-collapse: collapse; }
            th, td { 
                border: 1px solid #000; 
                padding: 4px 8px; 
                font-size: 10pt; 
                color: black;
            }
            th { background-color: #f0f0f0 !important; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .positive-profit { color: black !important; }
            .negative-profit { color: black !important; font-style: italic; }
        }
      `}</style>

      {/* ... Header and Action Buttons ... */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Inventory</h2>
        <div className="flex space-x-2">
            <button 
                onClick={handlePrint}
                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg flex items-center transition shadow-sm"
                title="Print Inventory"
            >
                <Printer size={18} />
            </button>
            <button 
                onClick={handleExport}
                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg flex items-center transition shadow-sm"
                title="Export Detailed Excel"
            >
                <FileSpreadsheet size={18} />
            </button>
            <button 
                onClick={handleOpenConversionModal}
                className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg flex items-center transition shadow-sm"
                title="Convert Stock / Repack"
            >
                <Boxes size={18} className="mr-2"/> Convert
            </button>
            <button 
                onClick={handleRestockCheck}
                disabled={isLoadingAi}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
            >
                <RefreshCw size={18} className={`mr-2 ${isLoadingAi ? 'animate-spin' : ''}`} />
                {isLoadingAi ? 'Analyzing...' : 'AI Restock Check'}
            </button>
            <button 
                onClick={() => handleOpenModal()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
            >
                <Plus size={18} className="mr-2" /> Add Product
            </button>
        </div>
      </div>

      {/* Overview Cards (Hidden on Print) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
          {/* ... Existing Cards ... */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full mr-4">
                  <Tags size={24} />
              </div>
              <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Unique Products</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{products.length}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full mr-4">
                  <Package size={24} />
              </div>
              <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total Stock Units</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{formatNumber(totalItems)}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full mr-4">
                  <DollarSign size={24} />
              </div>
              <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total Value (Retail)</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{symbol}{formatCurrency(totalValueRetail)}</p>
              </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full mr-4">
                  <BarChart3 size={24} />
              </div>
              <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Total Cost (Assets)</p>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{symbol}{formatCurrency(totalValueCost)}</p>
              </div>
          </div>
      </div>

      {/* Alerts */}
      {(expiringProducts.length > 0 || expiredProducts.length > 0 || lowStockProducts.length > 0) && (
        <div className="space-y-2 no-print">
            {/* ... Alert Logic ... */}
            {expiredProducts.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg flex items-start">
                    <AlertCircle className="text-red-600 dark:text-red-400 mr-3 mt-0.5 shrink-0" size={20} />
                    <div>
                        <h4 className="font-semibold text-red-800 dark:text-red-300 mb-1">Critical: {expiredProducts.length} Products Expired</h4>
                        <div className="text-sm text-red-700 dark:text-red-400">
                             Remove expired items to maintain inventory quality.
                        </div>
                    </div>
                </div>
            )}
            
            {expiringProducts.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg flex items-start">
                    <AlertTriangle className="text-amber-600 dark:text-amber-400 mr-3 mt-0.5 shrink-0" size={20} />
                    <div>
                        <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Attention: {expiringProducts.length} Products Expiring Soon</h4>
                        <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-400">
                            {expiringProducts.slice(0, 3).map(p => (
                                <li key={p.id}>
                                    <span className="font-medium">{p.name}</span> expires in <span className="font-bold">{getDaysUntilExpiry(p.stockExpiryDate)} days</span>
                                </li>
                            ))}
                            {expiringProducts.length > 3 && <li>...and {expiringProducts.length - 3} more</li>}
                        </ul>
                    </div>
                </div>
            )}

            {lowStockProducts.length > 0 && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-lg flex items-start">
                    <AlertCircle className="text-orange-600 dark:text-orange-400 mr-3 mt-0.5 shrink-0" size={20} />
                    <div>
                        <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-1">Stock Alert: {lowStockProducts.length} Items Low</h4>
                        <ul className="list-disc list-inside text-sm text-orange-700 dark:text-orange-400">
                            {lowStockProducts.slice(0, 3).map(p => (
                                <li key={p.id}>
                                    <span className="font-medium">{p.name}</span>: {p.stock} left (Threshold: {p.minStockLevel})
                                </li>
                            ))}
                            {lowStockProducts.length > 3 && <li>...and {lowStockProducts.length - 3} more</li>}
                        </ul>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4 rounded-lg no-print">
              <h4 className="font-semibold text-purple-800 dark:text-purple-300 mb-2 flex items-center"><Wand2 size={16} className="mr-2"/> AI Restock Suggestions</h4>
              <ul className="list-disc list-inside text-sm text-purple-700 dark:text-purple-400">
                  {aiSuggestions.map((s, idx) => (
                      <li key={idx}><strong>{s.productName}</strong>: {s.suggestedAction}</li>
                  ))}
              </ul>
              <button onClick={() => setAiSuggestions([])} className="text-xs text-slate-500 dark:text-slate-400 underline mt-2">Dismiss</button>
          </div>
      )}

      {/* Advanced Search & Filter Bar */}
      <div className="flex flex-col gap-4 no-print">
          <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search by name or SKU..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white shadow-sm placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center shadow-sm transition
                ${isFilterOpen ? 'bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                  <Filter size={20} className="mr-2"/> Filters
                  {(filterCategory !== 'ALL' || filterStockStatus !== 'ALL' || filterExpiry !== 'ALL') && (
                      <span className="ml-2 w-2 h-2 rounded-full bg-blue-500"></span>
                  )}
              </button>
          </div>

          {/* Collapsible Filter Panel */}
          {isFilterOpen && (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                      {/* ... Filters Content ... */}
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Category</label>
                          <select 
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                              {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Stock Status</label>
                          <select 
                            value={filterStockStatus}
                            onChange={(e) => setFilterStockStatus(e.target.value as any)}
                            className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                              <option value="ALL">All Status</option>
                              <option value="IN">In Stock</option>
                              <option value="LOW">Low Stock</option>
                              <option value="OUT">Out of Stock</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Expiry Status</label>
                          <select 
                            value={filterExpiry}
                            onChange={(e) => setFilterExpiry(e.target.value as any)}
                            className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                              <option value="ALL">All Dates</option>
                              <option value="VALID">Valid</option>
                              <option value="SOON">Expiring Soon (30d)</option>
                              <option value="EXPIRED">Expired</option>
                          </select>
                      </div>
                      <button 
                        onClick={() => {
                            setFilterCategory('ALL');
                            setFilterStockStatus('ALL');
                            setFilterExpiry('ALL');
                            setSearchTerm('');
                        }}
                        className="px-4 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 transition flex items-center justify-center"
                      >
                          <XCircle size={16} className="mr-2"/> Clear All
                      </button>
                  </div>
              </div>
          )}
      </div>

      {/* Main Table (Screen Only) */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 w-12 text-center">
                    <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={processedProducts.length > 0 && selectedIds.size === processedProducts.length}
                        onChange={handleSelectAll}
                    />
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition" onClick={() => handleSort('name')}>
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Product
                        {sortField === 'name' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden sm:table-cell" onClick={() => handleSort('sku')}>
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        SKU
                        {sortField === 'sku' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden md:table-cell" onClick={() => handleSort('category')}>
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Category
                        {sortField === 'category' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden lg:table-cell" onClick={() => handleSort('stockExpiryDate')}>
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Expiry
                        {sortField === 'stockExpiryDate' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden md:table-cell" onClick={() => handleSort('cost')}>
                    <div className="flex items-center justify-end text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Cost
                        {sortField === 'cost' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition" onClick={() => handleSort('price')}>
                    <div className="flex items-center justify-end text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Price
                        {sortField === 'price' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden lg:table-cell" onClick={() => handleSort('margin')}>
                    <div className="flex items-center justify-end text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Margin
                        {sortField === 'margin' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition" onClick={() => handleSort('stock')}>
                    <div className="flex items-center justify-center text-slate-600 dark:text-slate-400 text-sm font-semibold">
                        Stock
                        {sortField === 'stock' ? (sortDirection === 'asc' ? <ArrowUp size={14} className="ml-1"/> : <ArrowDown size={14} className="ml-1"/>) : <ChevronsUpDown size={14} className="ml-1 opacity-50"/>}
                    </div>
                </th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-400 text-sm text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {processedProducts.map(product => {
                const days = getDaysUntilExpiry(product.stockExpiryDate);
                const status = getExpiryStatus(days);
                const isLowStock = product.stock <= product.minStockLevel;
                const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;
                
                return (
                    <tr key={product.id} className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition ${selectedIds.has(product.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                    <td className="p-4 w-12 text-center">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedIds.has(product.id)}
                            onChange={() => handleSelectRow(product.id)}
                        />
                    </td>
                    <td className="p-4">
                        <div className="flex items-center">
                            <img src={product.imageUrl || "https://placehold.co/40?text=No+Img"} alt="" className="w-10 h-10 rounded object-cover mr-3 bg-slate-200 no-print" />
                            <div>
                                <p className="font-medium text-slate-900 dark:text-white">{product.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] no-print">{product.description}</p>
                            </div>
                        </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-300 hidden sm:table-cell">{product.sku}</td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-300 hidden md:table-cell">
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-medium text-slate-600 dark:text-slate-300 print:bg-transparent print:p-0">
                            {product.category}
                        </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                        {status === 'NONE' ? (
                            <div className="flex items-center text-slate-400">
                                <span className="text-xs italic">N/A</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-start w-32">
                                {status === 'EXPIRED' && (
                                    <div className="flex items-center text-red-600 dark:text-red-400 mb-0.5 bg-red-50 dark:bg-red-900/50 px-1.5 py-0.5 rounded print:bg-transparent print:p-0">
                                        <AlertCircle size={12} className="mr-1" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Expired</span>
                                    </div>
                                )}
                                {status === 'WARNING' && (
                                    <div className="flex items-center text-amber-600 dark:text-amber-400 mb-0.5 bg-amber-50 dark:bg-amber-900/50 px-1.5 py-0.5 rounded print:bg-transparent print:p-0">
                                        <AlertTriangle size={12} className="mr-1" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Warning</span>
                                    </div>
                                )}
                                {status === 'OK' && (
                                    <div className="flex items-center text-green-600 dark:text-green-400 mb-0.5 bg-green-50 dark:bg-green-900/50 px-1.5 py-0.5 rounded print:bg-transparent print:p-0">
                                        <CheckCircle size={12} className="mr-1" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Valid</span>
                                    </div>
                                )}
                                
                                <div className={`text-sm font-medium mt-0.5 ${status === 'EXPIRED' ? 'text-red-800 dark:text-red-300 line-through opacity-75' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {product.stockExpiryDate}
                                </div>
                            </div>
                        )}
                    </td>
                    <td className="p-4 text-sm text-slate-500 dark:text-slate-400 text-right tabular-nums hidden md:table-cell">{symbol}{formatCurrency(product.cost)}</td>
                    <td className="p-4 text-sm font-medium text-slate-900 dark:text-white text-right tabular-nums">
                        {symbol}{formatCurrency(product.price)}
                        {product.unit && <span className="text-xs text-slate-400 block font-normal">/{product.unit}</span>}
                    </td>
                    <td className="p-4 text-sm text-right tabular-nums hidden lg:table-cell">
                        <span className={`font-medium ${margin >= 50 ? 'text-green-600 dark:text-green-400' : margin >= 20 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-500'}`}>
                            {margin.toFixed(1)}%
                        </span>
                    </td>
                    <td className="p-4 text-center">
                        <div className="flex flex-col items-center justify-center group relative">
                            <div className="flex items-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center print:bg-transparent print:p-0
                                    ${isLowStock ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' : 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'}`}>
                                    {isLowStock && <AlertCircle size={10} className="mr-1" />}
                                    {product.stock} {product.unit && <span className="ml-1 opacity-75">{product.unit}</span>}
                                </span>
                                <button 
                                    onClick={() => handleOpenAdjModal(product)}
                                    title="Adjust Stock Level"
                                    className="ml-2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-700 rounded transition-colors no-print"
                                >
                                    <ClipboardEdit size={14} />
                                </button>
                            </div>
                            {isLowStock && (
                                <span className="text-[10px] text-red-500 dark:text-red-400 font-medium mt-1">Low (Min: {product.minStockLevel})</span>
                            )}
                        </div>
                    </td>
                    <td className="p-4 text-right no-print">
                        <div className="flex items-center justify-end space-x-2">
                             <button onClick={() => handleOpenDetails(product)} className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 p-1" title="View Details">
                                <Eye size={18} />
                            </button>
                            <button onClick={() => handleOpenModal(product)} className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 p-1" title="Edit Product">
                                <Edit2 size={18} />
                            </button>
                            <button onClick={() => handleDelete(product.id)} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1" title="Delete Product">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </td>
                    </tr>
                );
              })}
              {processedProducts.length === 0 && (
                  <tr><td colSpan={11} className="p-8 text-center text-slate-500 dark:text-slate-400">No products found matching filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-6 py-3 rounded-full shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-6 animate-in slide-in-from-bottom-10">
              <div className="flex items-center font-bold">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">{selectedIds.size}</span>
                  Selected
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex gap-2">
                  <button 
                    onClick={handleOpenBulkModal}
                    className="flex items-center px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-medium transition"
                  >
                      <Layers size={16} className="mr-2"/> Adjust Stock
                  </button>
                  <button 
                    onClick={() => setSelectedIds(new Set())}
                    className="flex items-center px-4 py-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-full text-sm font-medium transition"
                  >
                      Cancel
                  </button>
              </div>
          </div>
      )}

      {/* Printable Area (Maintained) */}
      <div className="printable-area hidden">
        {/* ... (Print logic preserved as is from original file, omitted for brevity but assumed present) ... */}
        {/* Re-inserting simplified print block for context */}
        <div className="p-6 border-b border-gray-300 mb-4">
            <h1 className="text-2xl font-bold mb-2">Detailed Inventory Report</h1>
            <div className="flex justify-between text-sm text-gray-600">
                <div>
                    <p>Generated by: {currentUser.name}</p>
                    <p>Date: {new Date().toLocaleString()}</p>
                </div>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Unit</th>
                    <th>Desc</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Margin</th>
                    <th className="text-center">Stock</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Asset Val</th>
                    <th className="text-right">Retail Val</th>
                    <th className="text-center">Sold</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-center">Ret.</th>
                    <th className="text-right">Refund</th>
                    <th className="text-right">Profit</th>
                    <th>Expiry</th>
                </tr>
            </thead>
            <tbody>
                {Object.keys(printCategories).sort().map(category => (
                    <React.Fragment key={category}>
                        <tr className="category-header">
                            <td colSpan={17}>{category}</td>
                        </tr>
                        {printCategories[category].map(p => {
                            const stats = getProductFinancials(p);
                            const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(1) + '%' : '0.0%';
                            
                            let stockStatus = 'In Stock';
                            if (p.stock === 0) stockStatus = 'Out of Stock';
                            else if (p.stock <= p.minStockLevel) stockStatus = 'Low Stock';

                            return (
                                <tr key={p.id}>
                                    <td>{p.name}</td>
                                    <td>{p.sku}</td>
                                    <td>{p.unit}</td>
                                    <td>{p.description}</td>
                                    <td className="text-right">{symbol}{formatCurrency(p.cost)}</td>
                                    <td className="text-right">{symbol}{formatCurrency(p.price)}</td>
                                    <td className="text-right">{margin}</td>
                                    <td className="text-center">{p.stock}</td>
                                    <td className="text-center">{stockStatus}</td>
                                    <td className="text-right">{symbol}{formatCurrency(stats.assetValue)}</td>
                                    <td className="text-right">{symbol}{formatCurrency(stats.retailValue)}</td>
                                    <td className="text-center">{formatNumber(stats.unitsSold)}</td>
                                    <td className="text-right">{symbol}{formatCurrency(stats.revenue)}</td>
                                    <td className="text-center">{formatNumber(stats.unitsReturned)}</td>
                                    <td className="text-right">{symbol}{formatCurrency(stats.refunded)}</td>
                                    <td className={`text-right ${stats.netProfit >= 0 ? 'positive-profit' : 'negative-profit'}`}>
                                        {symbol}{formatCurrency(stats.netProfit)}
                                    </td>
                                    <td>{p.stockExpiryDate || 'N/A'}</td>
                                </tr>
                            );
                        })}
                    </React.Fragment>
                ))}
                <tr className="totals-row">
                    <td colSpan={7} className="text-right">GRAND TOTALS</td>
                    <td className="text-center">{formatNumber(printTotals.stock)}</td>
                    <td></td>
                    <td className="text-right">{symbol}{formatCurrency(printTotals.assetValue)}</td>
                    <td className="text-right">{symbol}{formatCurrency(printTotals.retailValue)}</td>
                    <td className="text-center">{formatNumber(printTotals.unitsSold)}</td>
                    <td className="text-right">{symbol}{formatCurrency(printTotals.revenue)}</td>
                    <td className="text-center">{formatNumber(printTotals.unitsReturned)}</td>
                    <td className="text-right">{symbol}{formatCurrency(printTotals.refunded)}</td>
                    <td className={`text-right ${printTotals.netProfit >= 0 ? 'positive-profit' : 'negative-profit'}`}>
                        {symbol}{formatCurrency(printTotals.netProfit)}
                    </td>
                    <td></td>
                </tr>
            </tbody>
        </table>
      </div>

      {/* Stock Adjustment Modal (Single) */}
      {isAdjModalOpen && selectedProductForAdj && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white">Adjust Stock Level</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">for {selectedProductForAdj.name}</p>
                  </div>
                  <div className="p-6 space-y-4">
                      {/* ... Adjustment Form ... */}
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adjustment Type</label>
                          <div className="flex space-x-2">
                              {['ADD', 'REMOVE', 'SET'].map(t => (
                                  <button
                                    key={t}
                                    onClick={() => setAdjType(t as AdjustmentType)}
                                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition
                                    ${adjType === t 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                  >
                                      {t}
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                              {adjType === 'SET' ? 'New Total Quantity' : 'Quantity to ' + (adjType === 'ADD' ? 'Add' : 'Remove')} <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input 
                                type="number" 
                                min="0"
                                step={selectedProductForAdj.allowDecimal ? "0.001" : "1"}
                                value={adjQuantity}
                                onChange={(e) => setAdjQuantity(parseFloat(e.target.value) || 0)}
                                className="w-full p-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold text-center bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            />
                            {selectedProductForAdj.unit && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                                    {selectedProductForAdj.unit}
                                </span>
                            )}
                          </div>
                      </div>
                      
                      {/* Preview Calculation */}
                      <div className="flex items-center justify-center bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="text-center">
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Old</p>
                              <p className="font-bold text-slate-700 dark:text-slate-300">{selectedProductForAdj.stock}</p>
                          </div>
                          <ArrowRight size={16} className="mx-4 text-slate-400" />
                          <div className="text-center">
                              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">New</p>
                              <p className="font-bold text-blue-600 dark:text-blue-400 text-xl">
                                  {adjType === 'ADD' ? (selectedProductForAdj.stock + adjQuantity).toFixed(3).replace(/\.?0+$/, '') :
                                   adjType === 'REMOVE' ? (selectedProductForAdj.stock - adjQuantity).toFixed(3).replace(/\.?0+$/, '') :
                                   adjQuantity.toFixed(3).replace(/\.?0+$/, '')}
                              </p>
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason <span className="text-red-500">*</span></label>
                          <select 
                            value={adjReason}
                            onChange={(e) => setAdjReason(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          >
                              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (Optional)</label>
                          <textarea 
                            rows={2}
                            value={adjNotes}
                            onChange={(e) => setAdjNotes(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            placeholder="Additional details..."
                          />
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                      <button onClick={() => setIsAdjModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition">Cancel</button>
                      <button 
                        onClick={handleSubmitAdjustment}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition"
                      >
                          Confirm Adjustment
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Bulk Stock Adjustment Modal */}
      {isBulkAdjModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 rounded-t-2xl">
                      <div>
                          <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300 flex items-center">
                              <Layers size={20} className="mr-2"/> Bulk Stock Adjustment
                          </h3>
                          <p className="text-sm text-blue-700 dark:text-blue-400">Apply to {selectedIds.size} selected items</p>
                      </div>
                      <button onClick={() => setIsBulkAdjModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Action</label>
                          <div className="flex space-x-2">
                              {['ADD', 'REMOVE', 'SET'].map(t => (
                                  <button
                                    key={t}
                                    onClick={() => setBulkAdjType(t as AdjustmentType)}
                                    className={`flex-1 py-2 text-sm font-bold rounded-lg border transition
                                    ${bulkAdjType === t 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                        : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                                  >
                                      {t}
                                  </button>
                              ))}
                          </div>
                      </div>
                      
                      <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800 flex items-start text-xs text-amber-800 dark:text-amber-300">
                          <AlertCircle size={14} className="mr-2 shrink-0 mt-0.5"/>
                          <span>
                              {bulkAdjType === 'SET' 
                                  ? `Warning: This will set the stock of ALL ${selectedIds.size} items to the quantity below.`
                                  : `This will ${bulkAdjType === 'ADD' ? 'add to' : 'subtract from'} the current stock of each selected item.`
                              }
                          </span>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity <span className="text-red-500">*</span></label>
                          <input 
                              type="number" 
                              min="0"
                              step="0.001"
                              value={bulkAdjQuantity}
                              onChange={(e) => setBulkAdjQuantity(parseFloat(e.target.value) || 0)}
                              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold text-center bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Reason <span className="text-red-500">*</span></label>
                          <select 
                            value={bulkAdjReason}
                            onChange={(e) => setBulkAdjReason(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                          >
                              {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Notes (Optional)</label>
                          <textarea 
                            rows={2}
                            value={bulkAdjNotes}
                            onChange={(e) => setBulkAdjNotes(e.target.value)}
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                            placeholder="Bulk adjustment notes..."
                          />
                      </div>
                  </div>
                  <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                      <button onClick={() => setIsBulkAdjModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition">Cancel</button>
                      <button 
                        onClick={handleBulkSubmit}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition"
                      >
                          Confirm Bulk Update
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* ... Stock Conversion Modal and Product Details Modal (Preserved) ... */}
      {/* (Previous modals like Conversion, Details, Product Form remain unchanged in logic but included in file content) */}
      {isConversionModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl">
                  {/* ... Conversion Modal Content ... */}
                  {/* Reuse existing content from original file */}
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center">
                          <ArrowRightLeft className="mr-2" size={24}/> Product Conversion / Repacking
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Convert stock from one product to another (e.g., Bulk to Units).</p>
                  </div>
                  <div className="p-8">
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                          {/* Source Side */}
                          <div className="flex-1 w-full bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                              <h4 className="font-bold text-red-700 dark:text-red-400 mb-3 text-sm uppercase">Source (Deduct)</h4>
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Product <span className="text-red-500">*</span></label>
                                      <select 
                                          value={convSourceId}
                                          onChange={(e) => setConvSourceId(e.target.value)}
                                          className="w-full p-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                      >
                                          <option value="">Select Source Product</option>
                                          {products.filter(p => p.id !== convTargetId).map(p => (
                                              <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                                  {p.name} {p.unit ? `(${p.unit})` : ''} - Stock: {p.stock} {p.stock <= 0 ? '(Out)' : ''}
                                              </option>
                                          ))}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Quantity to Convert <span className="text-red-500">*</span></label>
                                      <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0"
                                            step={getSourceProductForConv()?.allowDecimal ? "0.001" : "1"}
                                            max={getSourceProductForConv()?.stock}
                                            value={convSourceQty === 0 ? '' : convSourceQty}
                                            onChange={(e) => {
                                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                                setConvSourceQty(val);
                                            }}
                                            className={`w-full p-2 border rounded-lg font-bold text-center outline-none focus:ring-2 
                                                ${isConvSourceQtyInvalid 
                                                    ? 'border-red-500 text-red-600 focus:ring-red-500 bg-red-50 dark:bg-red-900/20' 
                                                    : 'border-slate-200 text-slate-800 dark:text-white focus:ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600'}`}
                                        />
                                        {getSourceProductForConv()?.unit && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                                {getSourceProductForConv()?.unit}
                                            </span>
                                        )}
                                      </div>
                                      {isConvSourceQtyInvalid && (
                                          <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-1 text-center animate-pulse">
                                              Max available: {getSourceProductForConv()?.stock}
                                          </p>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {/* Arrow Icon */}
                          <div className="shrink-0 flex flex-col items-center justify-center">
                              <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-full">
                                  <ArrowRight size={24} className="text-slate-400 hidden md:block" />
                                  <ArrowDown size={24} className="text-slate-400 md:hidden" />
                              </div>
                          </div>

                          {/* Target Side */}
                          <div className="flex-1 w-full bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
                              <h4 className="font-bold text-green-700 dark:text-green-400 mb-3 text-sm uppercase">Target (Add)</h4>
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Product <span className="text-red-500">*</span></label>
                                      <select 
                                          value={convTargetId}
                                          onChange={(e) => setConvTargetId(e.target.value)}
                                          className="w-full p-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                      >
                                          <option value="">Select Target Product</option>
                                          {products.filter(p => p.id !== convSourceId).map(p => (
                                              <option key={p.id} value={p.id}>{p.name} {p.unit ? `(${p.unit})` : ''}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Quantity to Receive <span className="text-red-500">*</span></label>
                                      <div className="relative">
                                        <input 
                                            type="number" 
                                            min="0"
                                            step="0.001"
                                            value={convTargetQty}
                                            onChange={(e) => setConvTargetQty(parseFloat(e.target.value) || 0)}
                                            className="w-full p-2 border rounded-lg font-bold text-center text-green-600 dark:text-green-400 bg-white dark:bg-slate-700 dark:border-slate-600"
                                        />
                                        {products.find(p => p.id === convTargetId)?.unit && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                                {products.find(p => p.id === convTargetId)?.unit}
                                            </span>
                                        )}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Summary/Preview */}
                      {convSourceId && convTargetId && (
                           <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                               Converting <span className="font-bold">{convSourceQty} {products.find(p => p.id === convSourceId)?.unit}</span> of {products.find(p => p.id === convSourceId)?.name} into <span className="font-bold">{convTargetQty} {products.find(p => p.id === convTargetId)?.unit}</span> of {products.find(p => p.id === convTargetId)?.name}.
                           </div>
                      )}
                  </div>

                  <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                      <button 
                          onClick={() => setIsConversionModalOpen(false)} 
                          className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={handleConvertStock}
                          disabled={!convSourceId || !convTargetId || convSourceQty <= 0 || convTargetQty <= 0 || isConvSourceQtyInvalid}
                          className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          Confirm Conversion
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Product Details & History Modal (Maintained) */}
      {isDetailsModalOpen && selectedProductDetails && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                  {/* ... Header with Product Info ... */}
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
                      <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                              <div className="w-20 h-20 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden flex-shrink-0">
                                  <img src={selectedProductDetails.imageUrl || "https://placehold.co/100?text=Product"} alt={selectedProductDetails.name} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                  <div className="flex items-center gap-2 mb-1">
                                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">{selectedProductDetails.name}</h3>
                                      <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded font-medium">{selectedProductDetails.category}</span>
                                  </div>
                                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">{selectedProductDetails.description}</p>
                                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                      <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 font-mono">SKU: {selectedProductDetails.sku}</span>
                                      {selectedProductDetails.unit && (
                                          <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-bold">
                                              Unit: {selectedProductDetails.unit}
                                          </span>
                                      )}
                                      {selectedProductDetails.stockExpiryDate && (
                                          <span className="flex items-center">
                                              <History size={12} className="mr-1"/> Exp: {selectedProductDetails.stockExpiryDate}
                                          </span>
                                      )}
                                      {selectedProductDetails.allowDecimal && (
                                          <span className="flex items-center bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded font-medium">
                                              <Scale size={12} className="mr-1"/> Decimal Qty
                                          </span>
                                      )}
                                  </div>
                              </div>
                          </div>
                          <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={24}/></button>
                      </div>
                  </div>

                  {/* ... Key Stats Grid ... */}
                  <div className="grid grid-cols-5 border-b border-slate-200 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                      <div className="p-4 text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Stock Level</p>
                          <div className={`text-xl font-bold ${selectedProductDetails.stock <= selectedProductDetails.minStockLevel ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                              {selectedProductDetails.stock} <span className="text-xs font-normal text-slate-400">{selectedProductDetails.unit || ''}</span>
                          </div>
                          <p className="text-[10px] text-slate-400">Min: {selectedProductDetails.minStockLevel}</p>
                      </div>
                      <div className="p-4 text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Unit Cost</p>
                          <div className="text-xl font-bold text-slate-600 dark:text-slate-300">{symbol}{formatCurrency(selectedProductDetails.cost)}</div>
                      </div>
                      <div className="p-4 text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Sales Price</p>
                          <div className="text-xl font-bold text-slate-800 dark:text-white">{symbol}{formatCurrency(selectedProductDetails.price)}</div>
                      </div>
                      <div className="p-4 text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Profit Margin</p>
                          <div className="text-xl font-bold text-green-600 dark:text-green-400">
                              {selectedProductDetails.price > 0 
                                ? (((selectedProductDetails.price - selectedProductDetails.cost) / selectedProductDetails.price) * 100).toFixed(1)
                                : '0.0'}%
                          </div>
                      </div>
                      <div className="p-4 text-center">
                          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-medium">Total Asset Value</p>
                          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                              {symbol}{formatCurrency(selectedProductDetails.stock * selectedProductDetails.cost)}
                          </div>
                      </div>
                  </div>

                  {/* ... Sales Performance Snippet ... */}
                  <div className="bg-slate-50 dark:bg-slate-700/30 p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm px-6">
                      <span className="text-slate-500 dark:text-slate-400">Sales Performance (All time)</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                          {formatNumber(sales.reduce((acc, sale) => {
                              const item = sale.items.find(i => i.productId === selectedProductDetails.id);
                              return acc + (item ? item.quantity : 0);
                          }, 0))} units sold
                      </span>
                  </div>

                  {/* ... Tabs ... */}
                  <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                      <button 
                        onClick={() => setHistoryView('ADJUSTMENTS')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center
                        ${historyView === 'ADJUSTMENTS' 
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                      >
                          <ClipboardList size={16} className="mr-2"/> Stock Adjustments
                      </button>
                      <button 
                        onClick={() => setHistoryView('RETURNS')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center
                        ${historyView === 'RETURNS' 
                            ? 'border-red-600 text-red-600 dark:text-red-400 dark:border-red-400' 
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                      >
                          <RotateCcw size={16} className="mr-2"/> Customer Returns
                      </button>
                      <button 
                        onClick={() => setHistoryView('PRICE')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center
                        ${historyView === 'PRICE' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' 
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                      >
                          <TrendingUp size={16} className="mr-2"/> Price Logs
                      </button>
                  </div>

                  {/* ... History Views (Maintained) ... */}
                  {historyView === 'ADJUSTMENTS' && (
                    <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-800">
                        {/* Filters */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-end">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Type</label>
                                <select 
                                    value={historyFilterType}
                                    onChange={(e) => setHistoryFilterType(e.target.value as AdjustmentType | 'ALL')}
                                    className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 w-32 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="ALL">All Types</option>
                                    <option value="ADD">Add</option>
                                    <option value="REMOVE">Remove</option>
                                    <option value="SET">Set</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                                <input 
                                    type="date" 
                                    value={historyStartDate}
                                    onChange={(e) => setHistoryStartDate(e.target.value)}
                                    className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:[color-scheme:dark]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                                <input 
                                    type="date" 
                                    value={historyEndDate}
                                    onChange={(e) => setHistoryEndDate(e.target.value)}
                                    className="p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:[color-scheme:dark]"
                                />
                            </div>
                            <button 
                                onClick={() => {
                                    setHistoryFilterType('ALL');
                                    setHistoryStartDate('');
                                    setHistoryEndDate('');
                                }}
                                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline pb-2 px-2"
                            >
                                Clear
                            </button>
                        </div>

                        <div className="p-0 overflow-y-auto flex-1">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Reason</th>
                                        <th className="px-4 py-3 text-right">Prev. Stock</th>
                                        <th className="px-4 py-3 text-right">Adjustment</th>
                                        <th className="px-4 py-3 text-right">New Stock</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {filteredHistory.map(adj => (
                                        <tr key={adj.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                {new Date(adj.timestamp).toLocaleDateString()}
                                                <div className="text-xs text-slate-400">{new Date(adj.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                                                {adj.userName}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                                                    ${adj.type === 'ADD' ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300' :
                                                    adj.type === 'REMOVE' ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300' :
                                                    'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'}`}>
                                                    {adj.type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                                {adj.reason}
                                                {adj.notes && <div className="text-xs text-slate-400 italic mt-0.5 max-w-[200px] truncate">{adj.notes}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                                                {adj.previousStock}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium dark:text-white">
                                                {adj.type === 'ADD' ? `+${adj.quantity}` :
                                                adj.type === 'REMOVE' ? `-${adj.quantity}` :
                                                (adj.quantity - adj.previousStock > 0 ? `+${(adj.quantity - adj.previousStock).toFixed(3).replace(/\.?0+$/, '')}` : `${(adj.quantity - adj.previousStock).toFixed(3).replace(/\.?0+$/, '')}`)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300">
                                                {adj.newStock}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredHistory.length === 0 && (
                                        <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No adjustment history found matching filters.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                  )}

                  {historyView === 'RETURNS' && (
                       <div className="p-0 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
                          <table className="w-full text-left">
                              <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                  <tr>
                                      <th className="px-4 py-3">Date</th>
                                      <th className="px-4 py-3">Return ID</th>
                                      <th className="px-4 py-3">Customer</th>
                                      <th className="px-4 py-3">Reason</th>
                                      <th className="px-4 py-3 text-center">Restocked</th>
                                      <th className="px-4 py-3 text-right">Qty</th>
                                      <th className="px-4 py-3 text-right">Refund</th>
                                  </tr>
                              </thead>
                              <tbody className="text-sm">
                                  {productReturns.map((retItem, idx) => (
                                      <tr key={`${retItem.returnId}-${idx}`} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                              {new Date(retItem.timestamp).toLocaleDateString()}
                                              <div className="text-xs text-slate-400">{new Date(retItem.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                          </td>
                                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                              #{retItem.returnId.split('-')[1]}
                                              <div className="text-xs text-slate-400">Sale: #{retItem.originalSaleId.split('-')[1]}</div>
                                          </td>
                                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                                              {retItem.customerName}
                                          </td>
                                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                              {retItem.reason}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                              {retItem.restock ? (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400">
                                                      <CheckCircle size={10} className="mr-1"/> Yes
                                                  </span>
                                              ) : (
                                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400">
                                                      <X size={10} className="mr-1"/> No
                                                  </span>
                                              )}
                                          </td>
                                          <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                              {retItem.quantity}
                                          </td>
                                          <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-medium">
                                              -{symbol}{formatCurrency(retItem.refundAmount)}
                                          </td>
                                      </tr>
                                  ))}
                                  {productReturns.length === 0 && (
                                      <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">No returns recorded for this product.</td></tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  )}

                  {historyView === 'PRICE' && (
                        <div className="p-0 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">User</th>
                                        <th className="px-4 py-3">Change Type</th>
                                        <th className="px-4 py-3 text-right">Old Value</th>
                                        <th className="px-4 py-3 text-center"></th>
                                        <th className="px-4 py-3 text-right">New Value</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {productPrices.length === 0 ? (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">No price or cost history recorded.</td></tr>
                                    ) : (
                                        productPrices.map(ph => (
                                            <tr key={ph.id} className="border-b border-slate-50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                    {new Date(ph.timestamp).toLocaleDateString()}
                                                    <div className="text-xs text-slate-400">{new Date(ph.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                                                    {ph.userName}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded
                                                        ${ph.type === 'PRICE' 
                                                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' 
                                                            : 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'}`}>
                                                        {ph.type === 'PRICE' ? 'Selling Price' : 'Unit Cost'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                                                    {symbol}{formatCurrency(ph.oldValue)}
                                                </td>
                                                <td className="px-4 py-3 text-center text-slate-400">
                                                    <div className="flex justify-center">
                                                        {ph.newValue > ph.oldValue ? (
                                                            <ArrowBigUp size={16} className={ph.type === 'PRICE' ? 'text-green-500' : 'text-orange-500'} fill="currentColor" />
                                                        ) : (
                                                            <ArrowBigDown size={16} className={ph.type === 'PRICE' ? 'text-red-500' : 'text-green-500'} fill="currentColor" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-white">
                                                    {symbol}{formatCurrency(ph.newValue)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                  )}
              </div>
          </div>
      )}

      {/* Product Modal (Same as before) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Product Image</label>
                  <div className="flex items-start space-x-4">
                      <div className="w-24 h-24 rounded-lg bg-slate-100 dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-500 flex items-center justify-center overflow-hidden relative shrink-0">
                          {formData.imageUrl ? (
                              <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                              <ImageIcon className="text-slate-400" size={32} />
                          )}
                      </div>
                      <div className="flex-1">
                          <div className="flex flex-col gap-2">
                               <label className="cursor-pointer bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center transition w-fit">
                                  <Upload size={16} className="mr-2"/> Upload Image
                                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                              </label>
                              <input
                                  type="text"
                                  placeholder="Or paste image URL..."
                                  value={formData.imageUrl || ''}
                                  onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                                  className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                              />
                          </div>
                          {formData.imageUrl && (
                              <button
                                  onClick={() => setFormData({...formData, imageUrl: ''})}
                                  className="text-red-500 text-xs mt-2 hover:underline"
                              >
                                  Remove Image
                              </button>
                          )}
                      </div>
                  </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Product Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">SKU</label>
                <input 
                  type="text" 
                  value={formData.sku} 
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category <span className="text-red-500">*</span></label>
                <div className="relative" ref={categoryDropdownRef}>
                    <input 
                      type="text" 
                      value={formData.category} 
                      onChange={e => {
                          setFormData({...formData, category: e.target.value});
                          setIsCategoryDropdownOpen(true);
                      }}
                      onFocus={() => setIsCategoryDropdownOpen(true)}
                      className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                      placeholder="Select or type to create..."
                    />
                    <button
                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        type="button"
                    >
                        <ChevronDown size={16} />
                    </button>
                    {isCategoryDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {uniqueCategories.filter(c => c.toLowerCase().includes(formData.category?.toLowerCase() || '')).map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                        setFormData({...formData, category: c});
                                        setIsCategoryDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                                >
                                    {c}
                                    {formData.category === c && <Check size={14} className="text-blue-500" />}
                                </button>
                            ))}
                            {!uniqueCategories.includes(formData.category || '') && formData.category && (
                                <button
                                    type="button"
                                    onClick={() => setIsCategoryDropdownOpen(false)}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 font-medium"
                                >
                                    + Create "{formData.category}"
                                </button>
                            )}
                            {uniqueCategories.filter(c => c.toLowerCase().includes(formData.category?.toLowerCase() || '')).length === 0 && !formData.category && (
                                <div className="px-3 py-2 text-sm text-slate-400 italic">Type to create new category</div>
                            )}
                        </div>
                    )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price ({symbol}) <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  value={formData.price} 
                  onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cost ({symbol}) <span className="text-red-500">*</span></label>
                <input 
                  type="number" 
                  value={formData.cost} 
                  onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Stock</label>
                <div className="flex space-x-2">
                    <input 
                      type="number" 
                      value={formData.stock} 
                      onChange={e => setFormData({...formData, stock: parseFloat(e.target.value)})}
                      step={formData.allowDecimal ? "0.001" : "1"}
                      className="w-2/3 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                    />
                    <div className="w-1/3 relative" ref={unitDropdownRef}>
                        <input 
                            type="text"
                            value={formData.unit || ''}
                            onChange={e => {
                                setFormData({...formData, unit: e.target.value});
                                setIsUnitDropdownOpen(true);
                            }}
                            onFocus={() => setIsUnitDropdownOpen(true)}
                            placeholder="Unit"
                            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400"
                        />
                        <button
                            onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            type="button"
                        >
                            <ChevronDown size={16} />
                        </button>
                        {isUnitDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {uniqueUnits.filter(u => u.toLowerCase().includes((formData.unit || '').toLowerCase())).map(u => (
                                    <button
                                        key={u}
                                        type="button"
                                        onClick={() => {
                                            setFormData({...formData, unit: u});
                                            setIsUnitDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                                    >
                                        {u}
                                        {formData.unit === u && <Check size={14} className="text-blue-500" />}
                                    </button>
                                ))}
                                {!uniqueUnits.includes(formData.unit || '') && formData.unit && (
                                    <button
                                        type="button"
                                        onClick={() => setIsUnitDropdownOpen(false)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-slate-600 text-blue-600 dark:text-blue-400 font-medium"
                                    >
                                        + Use "{formData.unit}"
                                    </button>
                                )}
                                {uniqueUnits.filter(u => u.toLowerCase().includes((formData.unit || '').toLowerCase())).length === 0 && !formData.unit && (
                                    <div className="px-3 py-2 text-sm text-slate-400 italic">Type to create new unit</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center mt-2">
                    <input 
                        type="checkbox" 
                        id="allowDecimal"
                        checked={formData.allowDecimal || false}
                        onChange={e => setFormData({...formData, allowDecimal: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="allowDecimal" className="ml-2 text-sm text-slate-700 dark:text-slate-300 flex items-center">
                        <Scale size={14} className="mr-1"/> Allow Decimal Quantity (e.g. Weight/Volume)
                    </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Low Stock Alert Threshold</label>
                <input 
                  type="number" 
                  value={formData.minStockLevel} 
                  onChange={e => setFormData({...formData, minStockLevel: parseInt(e.target.value)})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                <input 
                  type="date" 
                  value={formData.stockExpiryDate || ''} 
                  onChange={e => setFormData({...formData, stockExpiryDate: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:[color-scheme:dark]" 
                />
              </div>

              <div className="md:col-span-2">
                 <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                    <button 
                        type="button" 
                        onClick={handleGenerateDescription}
                        className="text-xs flex items-center text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 font-semibold"
                    >
                        <Wand2 size={12} className="mr-1"/> Generate with AI
                    </button>
                 </div>
                <textarea 
                  rows={3}
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;