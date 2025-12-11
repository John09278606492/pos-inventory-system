import React, { useState } from 'react';
import { PurchaseOrder, Product, PurchaseOrderItem, PurchaseOrderStatus } from '../types';
import { 
  Plus, Search, Calendar, Truck, CheckCircle, XCircle, AlertCircle, FileText, Trash2, Minus 
} from 'lucide-react';

interface PurchaseOrdersProps {
  orders: PurchaseOrder[];
  products: Product[];
  onSaveOrder: (order: PurchaseOrder) => void;
  onUpdateStatus: (orderId: string, status: PurchaseOrderStatus) => void;
  onDeleteOrder: (orderId: string) => void;
  currency: string;
}

const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({ 
  orders, 
  products, 
  onSaveOrder, 
  onUpdateStatus,
  onDeleteOrder,
  currency
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  
  // New Item State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemCost, setItemCost] = useState(0);

  const getCurrencySymbol = (code: string) => {
    switch(code) {
      case 'PHP': return '₱';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  };
  const symbol = getCurrencySymbol(currency);

  const handleOpenModal = (order?: PurchaseOrder) => {
    if (order) {
      setEditingId(order.id);
      setSupplier(order.supplier);
      setExpectedDate(order.expectedDate || '');
      setOrderItems(order.items);
    } else {
      setEditingId(null);
      setSupplier('');
      setExpectedDate('');
      setOrderItems([]);
    }
    setIsModalOpen(true);
    // Reset item input
    setSelectedProductId('');
    setItemQuantity(1);
    setItemCost(0);
  };

  const handleAddItem = () => {
    if (!selectedProductId || itemQuantity <= 0 || itemCost <= 0) return;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const newItem: PurchaseOrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: itemQuantity,
      unitCost: itemCost
    };

    setOrderItems([...orderItems, newItem]);
    
    // Reset inputs
    setSelectedProductId('');
    setItemQuantity(1);
    setItemCost(0);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...orderItems];
    newItems.splice(index, 1);
    setOrderItems(newItems);
  };

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const product = products.find(p => p.id === id);
    if (product) {
      setItemCost(product.cost); // Default to current cost
    }
  };

  const handleSubmit = () => {
    if (!supplier || orderItems.length === 0) return;

    const totalCost = orderItems.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);

    const order: PurchaseOrder = {
      id: editingId || `po-${Date.now()}`,
      supplier,
      status: editingId ? (orders.find(o => o.id === editingId)?.status || 'PENDING') : 'PENDING',
      orderDate: editingId ? (orders.find(o => o.id === editingId)?.orderDate || Date.now()) : Date.now(),
      expectedDate,
      items: orderItems,
      totalCost
    };

    onSaveOrder(order);
    setIsModalOpen(false);
  };

  const getStatusColor = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300';
      case 'ORDERED': return 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300';
      case 'RECEIVED': return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
      case 'CANCELLED': return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const filteredOrders = orders.filter(o => 
    o.supplier.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Purchase Orders</h2>
          <p className="text-slate-500 text-sm mt-1">Manage restocking and supplier deliveries</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm"
        >
          <Plus size={18} className="mr-2" /> New Order
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search by supplier or PO ID..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 dark:text-white shadow-sm placeholder-slate-400 dark:placeholder-slate-500"
        />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">PO Number</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Supplier</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Date</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm">Status</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Total Cost</th>
              <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredOrders.length === 0 ? (
               <tr><td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400">No purchase orders found.</td></tr>
            ) : (
              filteredOrders.map(order => (
                <tr key={order.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                  <td className="p-4 font-medium text-slate-800 dark:text-white">#{order.id.split('-')[1] || order.id}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{order.supplier}</td>
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-center">
                      <Calendar size={14} className="mr-2 opacity-50"/>
                      {new Date(order.orderDate).toLocaleDateString()}
                    </div>
                    {order.expectedDate && (
                      <div className="text-xs text-slate-400 mt-1">
                        Exp: {order.expectedDate}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 text-right font-medium text-slate-800 dark:text-white">{symbol}{order.totalCost.toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {order.status === 'PENDING' && (
                        <button 
                          title="Mark as Ordered"
                          onClick={() => onUpdateStatus(order.id, 'ORDERED')} 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                        >
                          <Truck size={18} />
                        </button>
                      )}
                      
                      {order.status === 'ORDERED' && (
                        <button 
                          title="Receive Items"
                          onClick={() => onUpdateStatus(order.id, 'RECEIVED')} 
                          className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                        >
                          <CheckCircle size={18} />
                        </button>
                      )}

                      {(order.status === 'PENDING' || order.status === 'ORDERED') && (
                        <>
                          <button 
                            title="Edit"
                            onClick={() => handleOpenModal(order)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded"
                          >
                            <FileText size={18} />
                          </button>
                          <button 
                            title="Cancel Order"
                            onClick={() => onUpdateStatus(order.id, 'CANCELLED')} 
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                      
                      {order.status === 'CANCELLED' && (
                          <button
                            title="Delete"
                            onClick={() => onDeleteOrder(order.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded"
                          >
                              <Trash2 size={18} />
                          </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                {editingId ? 'Edit Purchase Order' : 'New Purchase Order'}
              </h3>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Supplier <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={supplier} 
                    onChange={e => setSupplier(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expected Delivery</label>
                  <input 
                    type="date" 
                    value={expectedDate} 
                    onChange={e => setExpectedDate(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:[color-scheme:dark]" 
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <h4 className="font-bold text-slate-800 dark:text-white mb-3">Order Items</h4>
                
                {/* Add Item Form */}
                <div className="flex flex-col md:flex-row gap-2 items-end mb-4 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg border border-slate-200 dark:border-slate-600">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Product</label>
                    <select 
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    >
                      <option value="">Select Product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Qty</label>
                    <input 
                      type="number" 
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(parseInt(e.target.value) || 0)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Unit Cost</label>
                    <input 
                      type="number" 
                      min="0"
                      step="0.01"
                      value={itemCost}
                      onChange={(e) => setItemCost(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                  </div>
                  <button 
                    onClick={handleAddItem}
                    disabled={!selectedProductId || itemQuantity <= 0}
                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                {/* Items List */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-2 pl-3">Product</th>
                        <th className="p-2 text-center">Qty</th>
                        <th className="p-2 text-right">Cost</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {orderItems.map((item, index) => (
                        <tr key={index} className="bg-white dark:bg-slate-800">
                          <td className="p-2 pl-3 text-slate-800 dark:text-white">{item.productName}</td>
                          <td className="p-2 text-center text-slate-600 dark:text-slate-300">{item.quantity}</td>
                          <td className="p-2 text-right text-slate-600 dark:text-slate-300">{symbol}{item.unitCost.toFixed(2)}</td>
                          <td className="p-2 text-right font-medium text-slate-800 dark:text-white">{symbol}{(item.quantity * item.unitCost).toFixed(2)}</td>
                          <td className="p-2 text-center">
                            <button 
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-500 hover:text-red-700 p-1 rounded"
                            >
                              <Minus size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {orderItems.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">No items added</td></tr>
                      )}
                    </tbody>
                    {orderItems.length > 0 && (
                      <tfoot className="bg-slate-50 dark:bg-slate-800 font-bold text-slate-800 dark:text-white border-t border-slate-200 dark:border-slate-700">
                        <tr>
                          <td colSpan={3} className="p-2 text-right">Total:</td>
                          <td className="p-2 text-right">{symbol}{orderItems.reduce((acc, i) => acc + (i.quantity * i.unitCost), 0).toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition"
              >
                Save Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;