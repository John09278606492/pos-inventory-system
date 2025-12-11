
import { User, UserRole, Product, PurchaseOrder, Customer, StockAdjustment, ReturnTransaction, CustomerSegment, CreditAdjustment, StoreSettings, PriceHistory, Permission } from './types';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    [UserRole.SUPER_ADMIN]: [
        'VIEW_DASHBOARD', 'MANAGE_INVENTORY', 'POS', 'VIEW_SALES_HISTORY', 
        'MANAGE_CUSTOMERS', 'MANAGE_USERS', 'MANAGE_SETTINGS', 'MANAGE_PURCHASE_ORDERS'
    ],
    [UserRole.ADMIN]: [
        'VIEW_DASHBOARD', 'MANAGE_INVENTORY', 'POS', 'VIEW_SALES_HISTORY', 
        'MANAGE_CUSTOMERS', 'MANAGE_PURCHASE_ORDERS'
    ],
    [UserRole.CASHIER]: [
        'POS', 'VIEW_SALES_HISTORY', 'MANAGE_CUSTOMERS'
    ]
};

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Alice Super',
    email: 'alice@nexus.com',
    role: UserRole.SUPER_ADMIN,
    avatar: 'https://ui-avatars.com/api/?name=Alice+Super&background=random',
    password: '123',
    permissions: ROLE_PERMISSIONS[UserRole.SUPER_ADMIN]
  },
  {
    id: 'u2',
    name: 'Bob Admin',
    email: 'bob@nexus.com',
    role: UserRole.ADMIN,
    avatar: 'https://ui-avatars.com/api/?name=Bob+Admin&background=random',
    password: '123',
    permissions: ROLE_PERMISSIONS[UserRole.ADMIN]
  },
  {
    id: 'u3',
    name: 'Charlie Cashier',
    email: 'charlie@nexus.com',
    role: UserRole.CASHIER,
    avatar: 'https://ui-avatars.com/api/?name=Charlie+Cashier&background=random',
    password: '123',
    permissions: ROLE_PERMISSIONS[UserRole.CASHIER]
  }
];

export const INITIAL_STORE_SETTINGS: StoreSettings = {
  storeName: 'Nexus Store',
  storeAddress: '123 Commerce St, Tech City, TC 90210',
  storePhone: '(555) 123-4567',
  storeEmail: 'contact@nexus-store.com',
  storeLogo: '',
  taxRate: 10,
  taxName: 'VAT',
  taxType: 'INCLUSIVE',
  currency: 'USD',
  receiptHeader: 'Thank you for shopping with us!',
  receiptFooter: 'Visit us online at www.nexus-store.com',
  creditMarkupRate: 0,
  creditTerms: [
      { id: 'term-1', name: 'Immediate / 7 Days', days: 7, rate: 0 },
      { id: 'term-2', name: 'Net 30', days: 30, rate: 2 },
      { id: 'term-3', name: 'Net 60', days: 60, rate: 5 },
  ]
};

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-0123',
    totalSpent: 450.50,
    visitCount: 5,
    lastVisit: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
    storeCredit: 0,
    type: 'MEMBER'
  },
  {
    id: 'c2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-0987',
    totalSpent: 1250.00,
    visitCount: 12,
    lastVisit: Date.now() - 1000 * 60 * 60 * 24 * 1, // 1 day ago
    storeCredit: 50.00,
    type: 'MEMBER'
  },
  {
    id: 'c3',
    name: 'Corporate Account',
    email: 'purchasing@corp.com',
    phone: '555-9999',
    totalSpent: 5000.00,
    visitCount: 2,
    lastVisit: Date.now() - 1000 * 60 * 60 * 24 * 15, // 15 days ago
    storeCredit: 0,
    type: 'MEMBER'
  }
];

export const INITIAL_SEGMENTS: CustomerSegment[] = [
  {
    id: 'seg-1',
    name: 'VIP Customers',
    description: 'High spenders who have spent over $1,000.',
    criteria: {
      minSpent: 1000
    }
  },
  {
    id: 'seg-2',
    name: 'Frequent Visitors',
    description: 'Customers with more than 10 visits.',
    criteria: {
      minVisits: 10
    }
  },
  {
    id: 'seg-3',
    name: 'At Risk',
    description: 'Customers who have not visited in over 30 days.',
    criteria: {
      daysSinceLastVisit: 30
    }
  }
];

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date) => date.toISOString().split('T')[0];

const today = new Date();
const futureDate = new Date(); futureDate.setDate(today.getDate() + 20); // 20 days from now (Expiring Soon)
const pastDate = new Date(); pastDate.setDate(today.getDate() - 30); // 30 days ago (Expired)

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Wireless Headphones',
    sku: 'WH-001',
    price: 99.99,
    cost: 45.00,
    stock: 25,
    category: 'Electronics',
    minStockLevel: 10,
    description: 'High quality noise cancelling headphones.',
    imageUrl: 'https://picsum.photos/seed/headphones/300/300',
    unit: 'pcs'
  },
  {
    id: 'p2',
    name: 'Mechanical Keyboard',
    sku: 'MK-104',
    price: 149.50,
    cost: 80.00,
    stock: 8,
    category: 'Electronics',
    minStockLevel: 5,
    description: 'Clicky blue switches with RGB backlight.',
    imageUrl: 'https://picsum.photos/seed/keyboard/300/300',
    unit: 'pcs'
  },
  {
    id: 'p3',
    name: 'Ergonomic Mouse',
    sku: 'EM-22',
    price: 59.99,
    cost: 25.00,
    stock: 50,
    category: 'Electronics',
    minStockLevel: 15,
    description: 'Vertical mouse to reduce wrist strain.',
    imageUrl: 'https://picsum.photos/seed/mouse/300/300',
    unit: 'pcs'
  },
  {
    id: 'p4',
    name: 'Organic Matcha Tea',
    sku: 'TEA-09',
    price: 24.99,
    cost: 10.50,
    stock: 45,
    category: 'Groceries',
    minStockLevel: 20,
    description: 'Premium ceremonial grade matcha powder. (Expiring Soon)',
    imageUrl: 'https://picsum.photos/seed/matcha/300/300',
    stockExpiryDate: formatDate(futureDate),
    unit: 'tin'
  },
  {
      id: 'p5',
      name: 'Vitamin C Supplements',
      sku: 'HLT-005',
      price: 15.99,
      cost: 5.00,
      stock: 60,
      category: 'Health',
      minStockLevel: 10,
      description: 'Immune support supplements, 100 count. (Expired)',
      imageUrl: 'https://picsum.photos/seed/vitamins/300/300',
      stockExpiryDate: formatDate(pastDate),
      unit: 'bottle'
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 'po-1001',
    supplier: 'Tech Supplies Inc.',
    status: 'RECEIVED',
    orderDate: Date.now() - 1000 * 60 * 60 * 24 * 10, // 10 days ago
    expectedDate: '2023-10-25',
    items: [
      { productId: 'p1', productName: 'Wireless Headphones', quantity: 10, unitCost: 42.00 }
    ],
    totalCost: 420.00
  },
  {
    id: 'po-1002',
    supplier: 'Office Essentials',
    status: 'ORDERED',
    orderDate: Date.now() - 1000 * 60 * 60 * 24 * 2, // 2 days ago
    expectedDate: '2023-11-05',
    items: [
      { productId: 'p3', productName: 'Ergonomic Mouse', quantity: 20, unitCost: 24.50 },
      { productId: 'p2', productName: 'Mechanical Keyboard', quantity: 5, unitCost: 78.00 }
    ],
    totalCost: 880.00
  }
];

export const INITIAL_STOCK_ADJUSTMENTS: StockAdjustment[] = [];

export const INITIAL_RETURNS: ReturnTransaction[] = [];

export const INITIAL_CREDIT_ADJUSTMENTS: CreditAdjustment[] = [];

export const INITIAL_PRICE_HISTORY: PriceHistory[] = [];
