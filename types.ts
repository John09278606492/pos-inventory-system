
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  CASHIER = 'CASHIER',
}

export type Permission = 
  | 'VIEW_DASHBOARD'
  | 'MANAGE_INVENTORY'
  | 'POS'
  | 'VIEW_SALES_HISTORY'
  | 'MANAGE_CUSTOMERS'
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS'
  | 'MANAGE_PURCHASE_ORDERS';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  avatar?: string;
  password?: string; // Optional for type compatibility, enforced in logic
  permissions: Permission[];
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
}

export interface CreditTerm {
  id: string;
  name: string; // e.g., "Net 30"
  days: number; // e.g., 30
  rate: number; // e.g., 5 (%)
}

export interface StoreSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  storeLogo?: string;
  taxRate: number; // percentage
  taxName: string; // e.g. "VAT"
  taxType: 'INCLUSIVE' | 'EXCLUSIVE'; 
  currency: string;
  receiptHeader?: string;
  receiptFooter?: string;
  creditMarkupRate?: number; // Legacy/Fallback
  creditTerms: CreditTerm[]; // New: List of dynamic terms
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  unit?: string; 
  category: string;
  description?: string;
  imageUrl?: string;
  minStockLevel: number;
  stockExpiryDate?: string;
  allowDecimal?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalSpent: number;
  visitCount: number;
  lastVisit?: number;
  storeCredit: number;
  type: 'MEMBER' | 'WALK_IN';
}

export interface CustomerSegment {
  id: string;
  name: string;
  description?: string;
  criteria: {
    minSpent?: number;
    maxSpent?: number;
    minVisits?: number;
    maxVisits?: number;
    daysSinceLastVisit?: number; 
  };
}

export interface CartItem extends Product {
  quantity: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unit?: string; 
  priceAtSale: number;
  costAtSale: number;
}

export interface Sale {
  id: string;
  timestamp: number;
  items: SaleItem[];
  
  // Financials
  subTotal: number; 
  totalTax: number; 
  totalAmount: number; 
  totalProfit: number;
  
  // Tax Snapshot 
  taxName?: string;
  taxRate?: number;
  taxType?: 'INCLUSIVE' | 'EXCLUSIVE';

  // Credit Markup Snapshot
  creditMarkupRate?: number;
  creditMarkupAmount?: number;
  creditTermName?: string; // New: Name of the term selected (e.g. "Net 30")
  creditDueDate?: number;  // New: Timestamp of due date

  cashierId: string;
  customerId?: string;
  customerName?: string;
  paymentMethod: 'CASH' | 'CARD' | 'DIGITAL' | 'STORE_CREDIT';
  amountTendered?: number;
  change?: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  lowStockCount: number;
  topSellingProduct: string;
}

export type PurchaseOrderStatus = 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit?: string; 
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  status: PurchaseOrderStatus;
  orderDate: number;
  expectedDate?: string;
  items: PurchaseOrderItem[];
  totalCost: number;
}

export type AdjustmentType = 'ADD' | 'REMOVE' | 'SET';

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  userId: string;
  userName: string;
  timestamp: number;
  type: AdjustmentType;
  quantity: number; 
  previousStock: number;
  newStock: number;
  reason: string;
  notes?: string;
}

export interface CreditAdjustment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  type: 'ADD' | 'DEDUCT';
  newBalance: number;
  timestamp: number;
  userId: string;
  userName: string;
  reason?: string;
  paymentMethod?: 'CASH' | 'CARD' | 'DIGITAL';
}

export interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  refundAmount: number;
  reason: string;
  restock: boolean;
}

export interface ReturnTransaction {
  id: string;
  originalSaleId: string;
  timestamp: number;
  items: ReturnItem[];
  totalRefund: number;
  refundMethod: 'CASH' | 'CARD' | 'DIGITAL' | 'STORE_CREDIT';
  cashierId: string;
  customerId?: string;
}

export interface HoldTransaction {
  id: string;
  items: CartItem[];
  customer: Customer; 
  timestamp: number;
  durationMinutes: number;
  expiryTime: number;
  note?: string;
  cashierId: string;
}

export interface PriceHistory {
  id: string;
  productId: string;
  type: 'PRICE' | 'COST'; 
  oldValue: number;
  newValue: number;
  userId: string;
  userName: string;
  timestamp: number;
}
