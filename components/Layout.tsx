
import React from 'react';
import { User, UserRole, StoreSettings, Permission } from '../types';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Settings, 
  LogOut, 
  Menu,
  ClipboardList,
  Contact,
  Sun,
  Moon,
  Globe,
  Receipt,
  ChevronDown
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentUser: User;
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  storeSettings?: StoreSettings;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentUser, 
  currentView, 
  onNavigate, 
  onLogout,
  isDarkMode,
  onToggleTheme,
  currency,
  onCurrencyChange,
  storeSettings
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Check permission helper
  const hasPermission = (permission: Permission) => {
      // Super admin bypass or check array
      return currentUser.role === UserRole.SUPER_ADMIN || currentUser.permissions?.includes(permission);
  };

  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: LayoutDashboard, 
      permission: 'VIEW_DASHBOARD' as Permission 
    },
    { 
      id: 'pos', 
      label: 'Point of Sale', 
      icon: ShoppingCart, 
      permission: 'POS' as Permission
    },
    { 
      id: 'sales', 
      label: 'Sales History', 
      icon: Receipt, 
      permission: 'VIEW_SALES_HISTORY' as Permission
    },
    { 
      id: 'inventory', 
      label: 'Inventory', 
      icon: Package, 
      permission: 'MANAGE_INVENTORY' as Permission
    },
    { 
      id: 'purchase-orders', 
      label: 'Purchase Orders', 
      icon: ClipboardList, 
      permission: 'MANAGE_PURCHASE_ORDERS' as Permission
    },
    { 
      id: 'customers', 
      label: 'Customers', 
      icon: Contact, 
      permission: 'MANAGE_CUSTOMERS' as Permission
    },
    { 
      id: 'users', 
      label: 'User Management', 
      icon: Users, 
      permission: 'MANAGE_USERS' as Permission
    },
    { 
        id: 'settings', 
        label: 'Settings', 
        icon: Settings, 
        permission: 'MANAGE_SETTINGS' as Permission
    }
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} 
        bg-slate-900 dark:bg-slate-950 text-white transition-all duration-300 flex flex-col shadow-xl z-20 shrink-0`}
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-800 dark:border-slate-800 h-16">
          {isSidebarOpen && (
              <div className="flex items-center gap-2 overflow-hidden">
                   {storeSettings?.storeLogo ? (
                       <img src={storeSettings.storeLogo} alt="Brand" className="w-8 h-8 object-contain rounded" />
                   ) : null}
                   <h1 className="font-bold text-xl tracking-tight text-blue-400 truncate">{storeSettings?.storeName || 'NEXUS'}</h1>
              </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 space-y-2 px-3 overflow-y-auto">
          {menuItems.filter(item => hasPermission(item.permission)).map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-colors group
                ${currentView === item.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <item.icon size={22} className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'}/>
              {isSidebarOpen && <span className="ml-3 font-medium whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          
          <button
            onClick={onToggleTheme}
            className={`w-full flex items-center p-2 rounded-lg transition-colors
             ${isSidebarOpen ? 'justify-start' : 'justify-center'}
             ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-800 text-slate-400 hover:text-white'}
            `}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
             {isSidebarOpen && <span className="ml-3 text-sm font-medium">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <div className={`flex items-center ${!isSidebarOpen && 'justify-center'}`}>
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-10 h-10 rounded-full border-2 border-blue-500"
            />
            {isSidebarOpen && (
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                <p className="text-xs text-slate-400 truncate">{currentUser.role.replace('_', ' ')}</p>
              </div>
            )}
          </div>
          <button 
            onClick={onLogout}
            className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-3' : 'justify-center'} py-2 rounded text-red-400 hover:bg-slate-800 transition-colors`}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="ml-3 text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 dark:bg-slate-900 transition-colors duration-300 relative">
        {/* Top Header */}
        <header className="shrink-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-end items-center px-6 shadow-sm z-10 transition-colors duration-300">
           <div className="relative group">
               <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors pointer-events-none"/>
               <select 
                 value={currency} 
                 onChange={(e) => onCurrencyChange(e.target.value)}
                 className="appearance-none bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-full py-2 pl-10 pr-10 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600 hover:border-slate-300 dark:hover:border-slate-500"
               >
                   <option value="USD">USD ($)</option>
                   <option value="EUR">EUR (€)</option>
                   <option value="GBP">GBP (£)</option>
                   <option value="PHP">PHP (₱)</option>
               </select>
               <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors"/>
           </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-6 md:p-8 min-h-full">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
