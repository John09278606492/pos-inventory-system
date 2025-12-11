import React, { useEffect, useState } from 'react';
import { Sale, Product, ReturnTransaction } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, ComposedChart } from 'recharts';
import { analyzeBusinessData } from '../services/geminiService';
import { TrendingUp, AlertTriangle, DollarSign, Package, PieChart as PieChartIcon, Calendar, ArrowDownRight } from 'lucide-react';

interface DashboardProps {
  sales: Sale[];
  products: Product[];
  returns: ReturnTransaction[];
  currency: string;
}

const Dashboard: React.FC<DashboardProps> = ({ sales, products, returns, currency }) => {
  const [insight, setInsight] = useState<string>('Loading AI insights...');

  const getCurrencySymbol = (code: string) => {
    switch(code) {
      case 'PHP': return '₱';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  };
  
  const symbol = getCurrencySymbol(currency);

  // --- Calculations ---

  // 1. Gross Revenue (from Sales)
  const grossRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);

  // 2. Total Refunds (from Returns)
  const totalRefunds = returns.reduce((acc, r) => acc + r.totalRefund, 0);

  // 3. Net Revenue
  const netRevenue = grossRevenue - totalRefunds;

  // 4. Net Profit Calculation
  // Gross Profit from Sales
  const grossProfit = sales.reduce((acc, s) => acc + s.totalProfit, 0);
  
  // Refunded Profit (We must reverse the profit gained from items that were returned)
  // Logic: For each returned item, find the original SaleItem to get (Price - Cost) * ReturnedQty
  const profitLostFromReturns = returns.reduce((totalLost, ret) => {
      const originalSale = sales.find(s => s.id === ret.originalSaleId);
      if (!originalSale) return totalLost; // Should not happen if data integrity is kept

      const returnLoss = ret.items.reduce((itemLost, retItem) => {
          const originalItem = originalSale.items.find(i => i.productId === retItem.productId);
          if (!originalItem) return itemLost;
          
          // Profit per unit = PriceAtSale - CostAtSale
          const unitProfit = originalItem.priceAtSale - originalItem.costAtSale;
          return itemLost + (unitProfit * retItem.quantity);
      }, 0);

      return totalLost + returnLoss;
  }, 0);

  const netProfit = grossProfit - profitLostFromReturns;

  const lowStockCount = products.filter(p => p.stock <= p.minStockLevel).length;
  
  // --- Chart Data Preparation ---

  // Sales Trend (Last 7 Days) - Net Revenue
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse();

  const salesData = last7Days.map(date => {
    // Sales on this day
    const daySales = sales.filter(s => new Date(s.timestamp).toISOString().split('T')[0] === date);
    const dayGross = daySales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    // Returns on this day
    const dayReturns = returns.filter(r => new Date(r.timestamp).toISOString().split('T')[0] === date);
    const dayRefunds = dayReturns.reduce((sum, r) => sum + r.totalRefund, 0);

    return {
      date: date.slice(5), // MM-DD
      amount: dayGross - dayRefunds // Net
    };
  });

  // Current Month Performance (Daily)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter for Current Month
  const currentMonthSales = sales.filter(s => {
      const d = new Date(s.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  
  const currentMonthReturns = returns.filter(r => {
      const d = new Date(r.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthDailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      
      // Sales for Day
      const daySales = currentMonthSales.filter(s => new Date(s.timestamp).getDate() === day);
      const dailyGross = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
      
      // Returns for Day
      const dayReturns = currentMonthReturns.filter(r => new Date(r.timestamp).getDate() === day);
      const dailyRefunds = dayReturns.reduce((acc, r) => acc + r.totalRefund, 0);
      
      // Profit Calculation for Day
      const dailyGrossProfit = daySales.reduce((acc, s) => acc + s.totalProfit, 0);
      
      const dailyReturnProfitLoss = dayReturns.reduce((totalLost, ret) => {
          const originalSale = sales.find(s => s.id === ret.originalSaleId); // Look in ALL sales for history
          if (!originalSale) return totalLost;
          return totalLost + ret.items.reduce((itemLost, retItem) => {
              const originalItem = originalSale.items.find(item => item.productId === retItem.productId);
              if (!originalItem) return itemLost;
              return itemLost + ((originalItem.priceAtSale - originalItem.costAtSale) * retItem.quantity);
          }, 0);
      }, 0);

      return {
          day: day.toString(),
          sales: dailyGross - dailyRefunds,
          profit: dailyGrossProfit - dailyReturnProfitLoss,
          transactions: daySales.length // Count sales transactions only for foot traffic approximation
      };
  });

  // Category Map Logic (Based on Net Sales)
  // We iterate sales to add, and returns to subtract from category totals
  const categoryMap: Record<string, number> = {};
  
  // Add Sales
  currentMonthSales.forEach(sale => {
      sale.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
              const cat = product.category || 'Uncategorized';
              const amount = item.quantity * item.priceAtSale;
              categoryMap[cat] = (categoryMap[cat] || 0) + amount;
          }
      });
  });

  // Subtract Returns
  currentMonthReturns.forEach(ret => {
      const originalSale = sales.find(s => s.id === ret.originalSaleId);
      if(originalSale) {
           ret.items.forEach(retItem => {
               const product = products.find(p => p.id === retItem.productId);
               if (product) {
                    const cat = product.category || 'Uncategorized';
                    const originalItem = originalSale.items.find(i => i.productId === retItem.productId);
                    if(originalItem) {
                        const refundVal = retItem.quantity * originalItem.priceAtSale;
                        categoryMap[cat] = (categoryMap[cat] || 0) - refundVal;
                    }
               }
           });
      }
  });

  // Convert map to array and remove negatives/zeros for chart
  const categoryData = Object.keys(categoryMap)
      .map(cat => ({
        name: cat,
        value: Math.max(0, categoryMap[cat])
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);

  // Palette for Pie Chart
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

  useEffect(() => {
    const fetchInsight = async () => {
      const text = await analyzeBusinessData(sales, products);
      setInsight(text);
    };
    fetchInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales.length, products]); 

  const formatCurrency = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Business Overview</h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">Real-time Data</span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
          <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mr-4">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Net Revenue</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{symbol}{formatCurrency(netRevenue)}</p>
            {totalRefunds > 0 && (
                <p className="text-xs text-slate-400 flex items-center">
                    <ArrowDownRight size={10} className="mr-0.5"/> {symbol}{formatCurrency(totalRefunds)} refunded
                </p>
            )}
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
          <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 mr-4">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Net Profit</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{symbol}{formatCurrency(netProfit)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
          <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 mr-4">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Low Stock Items</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{lowStockCount}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center">
          <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mr-4">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Products</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{products.length}</p>
          </div>
        </div>
      </div>

      {/* Row 2: Current Month Performance (New Chart) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                  <Calendar size={20} className="mr-2 text-slate-500"/>
                  Current Month Performance (Net)
              </h3>
              <div className="flex space-x-4 text-xs">
                  <span className="flex items-center text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-500 mr-1"></span> Sales ({symbol})</span>
                  <span className="flex items-center text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span> Profit ({symbol})</span>
                  <span className="flex items-center text-slate-500 dark:text-slate-400"><span className="w-2 h-2 rounded-full bg-orange-500 mr-1"></span> Trans. (#)</span>
              </div>
          </div>
          <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthDailyData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      
                      {/* Left Axis for Currency */}
                      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      
                      {/* Right Axis for Counts */}
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                      
                      <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none' }}
                          labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                          formatter={(value: number, name: string) => {
                              if (name === 'sales') return [`${symbol}${formatCurrency(value)}`, 'Net Sales'];
                              if (name === 'profit') return [`${symbol}${formatCurrency(value)}`, 'Net Profit'];
                              return [value, 'Transactions'];
                          }}
                          labelFormatter={(label) => `Day ${label}`}
                      />
                      
                      <Bar yAxisId="left" dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar yAxisId="left" dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Line yAxisId="right" type="monotone" dataKey="transactions" stroke="#f97316" strokeWidth={2} dot={{r: 3, fill: '#f97316'}} />
                  </ComposedChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Row 3: Trends & Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white flex items-center">
              <TrendingUp size={20} className="mr-2 text-slate-500"/>
              Sales Trend (Last 7 Days)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: number) => [`${symbol}${formatCurrency(value)}`, 'Net Revenue']}
                />
                <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ fill: '#3b82f6', r: 4 }} 
                    activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-white flex items-center">
                <PieChartIcon size={20} className="mr-2 text-slate-500"/>
                Monthly Category Sales
            </h3>
            <div className="h-80 w-full">
                {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value: number) => [`${symbol}${formatCurrency(value)}`, 'Net Revenue']}
                            />
                            <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom" 
                                align="center"
                                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <PieChartIcon size={48} className="opacity-20 mb-2"/>
                        <p>No sales data for this month</p>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* AI Insights Row */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center mb-4 space-x-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-lg">✨</span>
            </div>
            <h3 className="text-lg font-bold">Gemini Insights</h3>
          </div>
          <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm text-indigo-50 leading-relaxed min-h-[100px]">
             {insight.split('\n').map((line, i) => (
                <p key={i} className="mb-2 text-sm">{line}</p>
             ))}
          </div>
          <p className="text-xs text-indigo-200 mt-4 opacity-75 text-center">Powered by Google Gemini 2.5 Flash</p>
      </div>
    </div>
  );
};

export default Dashboard;