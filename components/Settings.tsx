
import React, { useState } from 'react';
import { StoreSettings, CreditTerm } from '../types';
import { Save, Building2, Receipt, BadgePercent, Upload, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';

interface SettingsProps {
  settings: StoreSettings;
  onUpdateSettings: (settings: StoreSettings) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, currency, onCurrencyChange }) => {
  const [formData, setFormData] = useState<StoreSettings>(settings);
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'TAX' | 'RECEIPT'>('PROFILE');
  
  // Local state for new credit term
  const [newTerm, setNewTerm] = useState<Partial<CreditTerm>>({ name: '', days: 30, rate: 0 });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'taxRate' ? parseFloat(value) : value
    }));
    
    // Sync currency specifically if changed here
    if (name === 'currency') {
        onCurrencyChange(value);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, storeLogo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddTerm = () => {
      if (!newTerm.name || newTerm.days === undefined || newTerm.rate === undefined) return;
      const term: CreditTerm = {
          id: `term-${Date.now()}`,
          name: newTerm.name,
          days: Number(newTerm.days),
          rate: Number(newTerm.rate)
      };
      setFormData(prev => ({
          ...prev,
          creditTerms: [...(prev.creditTerms || []), term]
      }));
      setNewTerm({ name: '', days: 30, rate: 0 });
  };

  const handleRemoveTerm = (id: string) => {
      setFormData(prev => ({
          ...prev,
          creditTerms: prev.creditTerms.filter(t => t.id !== id)
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Settings</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage store profile, tax configuration, and preferences.</p>
        </div>
        <button 
          onClick={handleSubmit}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center transition shadow-sm font-medium"
        >
          <Save size={18} className="mr-2" /> Save Changes
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <button
                onClick={() => setActiveTab('PROFILE')}
                className={`w-full flex items-center p-3 rounded-lg text-sm font-medium transition-colors
                ${activeTab === 'PROFILE' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
                <Building2 size={18} className="mr-3"/> Brand & Profile
            </button>
            <button
                onClick={() => setActiveTab('TAX')}
                className={`w-full flex items-center p-3 rounded-lg text-sm font-medium transition-colors
                ${activeTab === 'TAX' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
                <BadgePercent size={18} className="mr-3"/> Regional, Tax & Credit
            </button>
            <button
                onClick={() => setActiveTab('RECEIPT')}
                className={`w-full flex items-center p-3 rounded-lg text-sm font-medium transition-colors
                ${activeTab === 'RECEIPT' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
                <Receipt size={18} className="mr-3"/> Receipt Template
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 md:p-8">
            {activeTab === 'PROFILE' && (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Brand Information</h3>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Brand Logo</label>
                            <div className="flex items-start space-x-4">
                                <div className="w-24 h-24 rounded-lg bg-slate-100 dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-500 flex items-center justify-center overflow-hidden relative">
                                    {formData.storeLogo ? (
                                        <img src={formData.storeLogo} alt="Store Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <ImageIcon className="text-slate-400" size={32} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <label className="cursor-pointer bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center transition">
                                        <Upload size={16} className="mr-2"/> Upload Logo
                                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                                    </label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                        Recommended: 200x200px PNG or JPG. This logo will appear on the sidebar and receipts.
                                    </p>
                                    {formData.storeLogo && (
                                        <button 
                                            onClick={() => setFormData({...formData, storeLogo: ''})}
                                            className="text-red-500 text-xs mt-2 hover:underline"
                                        >
                                            Remove Logo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Brand / Store Name</label>
                            <input 
                                type="text" 
                                name="storeName"
                                value={formData.storeName} 
                                onChange={handleChange}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                            <input 
                                type="text" 
                                name="storeAddress"
                                value={formData.storeAddress} 
                                onChange={handleChange}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                                <input 
                                    type="text" 
                                    name="storePhone"
                                    value={formData.storePhone} 
                                    onChange={handleChange}
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                                <input 
                                    type="email" 
                                    name="storeEmail"
                                    value={formData.storeEmail} 
                                    onChange={handleChange}
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'TAX' && (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Regional & Taxes</h3>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Currency</label>
                            <select 
                                name="currency"
                                value={formData.currency} 
                                onChange={handleChange}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="PHP">PHP (₱)</option>
                            </select>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Global display currency for prices and reports.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tax Name</label>
                                <input 
                                    type="text" 
                                    name="taxName"
                                    value={formData.taxName} 
                                    onChange={handleChange}
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                                    placeholder="e.g. VAT, GST, Sales Tax"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tax Rate (%)</label>
                                <input 
                                    type="number" 
                                    name="taxRate"
                                    value={formData.taxRate} 
                                    onChange={handleChange}
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tax Calculation Method</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition
                                    ${formData.taxType === 'INCLUSIVE' 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="taxType" 
                                        value="INCLUSIVE" 
                                        checked={formData.taxType === 'INCLUSIVE'} 
                                        onChange={() => setFormData({...formData, taxType: 'INCLUSIVE'})}
                                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <div className="ml-3">
                                        <span className="block text-sm font-bold text-slate-800 dark:text-white">Tax Included in Price (Inclusive)</span>
                                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            The product price displayed is the final price. Tax is extracted from this amount. Common for VAT.
                                        </span>
                                    </div>
                                </label>

                                <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition
                                    ${formData.taxType === 'EXCLUSIVE' 
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                >
                                    <input 
                                        type="radio" 
                                        name="taxType" 
                                        value="EXCLUSIVE" 
                                        checked={formData.taxType === 'EXCLUSIVE'} 
                                        onChange={() => setFormData({...formData, taxType: 'EXCLUSIVE'})}
                                        className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <div className="ml-3">
                                        <span className="block text-sm font-bold text-slate-800 dark:text-white">Tax Added to Price (Exclusive)</span>
                                        <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Tax is added on top of the product price at checkout. Common for Sales Tax (USA).
                                        </span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-4">Store Credit Terms (Payment Due Dates & Interest)</h4>
                            
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 mb-4 border border-slate-200 dark:border-slate-600">
                                <div className="grid grid-cols-7 gap-2 items-end">
                                    <div className="col-span-3">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Term Name</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Net 30"
                                            value={newTerm.name}
                                            onChange={e => setNewTerm({...newTerm, name: e.target.value})}
                                            className="w-full p-2 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Days to Pay</label>
                                        <input 
                                            type="number" 
                                            placeholder="30"
                                            min="0"
                                            value={newTerm.days}
                                            onChange={e => setNewTerm({...newTerm, days: parseInt(e.target.value)})}
                                            className="w-full p-2 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Markup %</label>
                                        <input 
                                            type="number" 
                                            placeholder="2"
                                            min="0"
                                            step="0.1"
                                            value={newTerm.rate}
                                            onChange={e => setNewTerm({...newTerm, rate: parseFloat(e.target.value)})}
                                            className="w-full p-2 text-sm border rounded bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <button 
                                            onClick={handleAddTerm}
                                            disabled={!newTerm.name}
                                            className="w-full p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                        <tr>
                                            <th className="p-3">Term Name</th>
                                            <th className="p-3">Due in (Days)</th>
                                            <th className="p-3 text-right">Interest / Markup</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {(formData.creditTerms || []).map(term => (
                                            <tr key={term.id} className="bg-white dark:bg-slate-800">
                                                <td className="p-3 text-slate-800 dark:text-white font-medium">{term.name}</td>
                                                <td className="p-3 text-slate-600 dark:text-slate-400">{term.days} Days</td>
                                                <td className="p-3 text-right text-slate-600 dark:text-slate-400">{term.rate}%</td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => handleRemoveTerm(term.id)} className="text-red-500 hover:text-red-700">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!formData.creditTerms || formData.creditTerms.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="p-4 text-center text-slate-400 italic">No credit terms defined. Store credit will have 0% markup.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'RECEIPT' && (
                <div className="space-y-6 animate-fade-in">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-2">Receipt Configuration</h3>
                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Receipt Header Message</label>
                            <input 
                                type="text" 
                                name="receiptHeader"
                                value={formData.receiptHeader || ''} 
                                onChange={handleChange}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                                placeholder="e.g. Thank you for shopping!"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Receipt Footer Message</label>
                            <textarea 
                                name="receiptFooter"
                                value={formData.receiptFooter || ''} 
                                onChange={handleChange}
                                rows={3}
                                className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400" 
                                placeholder="e.g. Return policy details or website URL"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
