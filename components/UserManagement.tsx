
import React, { useState } from 'react';
import { User, UserRole, Permission } from '../types';
import { ROLE_PERMISSIONS } from '../constants';
import { Shield, User as UserIcon, Mail, Plus, Edit2, Trash2, X, CheckCircle, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface UserManagementProps {
  users: User[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  currentUser: User;
}

const PERMISSIONS_LIST: { id: Permission; label: string; desc: string }[] = [
    { id: 'VIEW_DASHBOARD', label: 'View Dashboard', desc: 'See sales summary and business insights' },
    { id: 'MANAGE_INVENTORY', label: 'Manage Inventory', desc: 'Add, edit, delete products and adjust stock' },
    { id: 'POS', label: 'Point of Sale', desc: 'Process sales transactions' },
    { id: 'VIEW_SALES_HISTORY', label: 'Sales History', desc: 'View logs of all past sales and returns' },
    { id: 'MANAGE_CUSTOMERS', label: 'Manage Customers', desc: 'Create and edit customer profiles' },
    { id: 'MANAGE_PURCHASE_ORDERS', label: 'Purchase Orders', desc: 'Manage supplier orders' },
    { id: 'MANAGE_USERS', label: 'Manage Users', desc: 'Create and edit user accounts (Admin Only)' },
    { id: 'MANAGE_SETTINGS', label: 'Store Settings', desc: 'Configure taxes, store info, and receipts' },
];

const UserManagement: React.FC<UserManagementProps> = ({ users, onAddUser, onUpdateUser, onDeleteUser, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  const [formData, setFormData] = useState<Partial<User>>({
      name: '',
      email: '',
      role: UserRole.CASHIER,
      password: '',
      permissions: []
  });

  const handleOpenModal = (user?: User) => {
      if (user) {
          setEditingUser(user);
          setFormData({ 
              name: user.name, 
              email: user.email, 
              role: user.role,
              password: user.password,
              permissions: user.permissions || ROLE_PERMISSIONS[user.role]
          });
      } else {
          setEditingUser(null);
          // Default to cashier permissions
          setFormData({ 
              name: '', 
              email: '', 
              role: UserRole.CASHIER, 
              password: '',
              permissions: ROLE_PERMISSIONS[UserRole.CASHIER] 
          });
      }
      setShowPassword(false);
      setIsModalOpen(true);
  };

  const handleRoleChange = (role: UserRole) => {
      setFormData(prev => ({
          ...prev,
          role,
          // Auto-select defaults when role changes, but keep overrides if user specifically wants strict roles?
          // For dynamic UI, let's reset to defaults for that role to be helpful
          permissions: ROLE_PERMISSIONS[role]
      }));
  };

  const togglePermission = (perm: Permission) => {
      setFormData(prev => {
          const current = prev.permissions || [];
          if (current.includes(perm)) {
              return { ...prev, permissions: current.filter(p => p !== perm) };
          } else {
              return { ...prev, permissions: [...current, perm] };
          }
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.name || !formData.email || !formData.role) return;
      if (!editingUser && !formData.password) return; // Password required for new users

      const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`;

      if (editingUser) {
          onUpdateUser({
              ...editingUser,
              name: formData.name,
              email: formData.email,
              role: formData.role,
              password: formData.password || editingUser.password, // Keep old if empty
              permissions: formData.permissions || [],
              avatar: editingUser.avatar 
          });
      } else {
          onAddUser({
              id: `u-${Date.now()}`,
              name: formData.name,
              email: formData.email,
              role: formData.role,
              password: formData.password!,
              permissions: formData.permissions || [],
              avatar: avatar
          });
      }
      setIsModalOpen(false);
  };

  const initiateDelete = (user: User) => {
      if (user.id === currentUser.id) {
          alert("You cannot delete your own account.");
          return;
      }
      setUserToDelete(user);
  };

  const confirmDelete = () => {
      if (userToDelete) {
          onDeleteUser(userToDelete.id);
          setUserToDelete(null);
      }
  };

  const getRoleBadge = (role: UserRole) => {
      switch(role) {
          case UserRole.SUPER_ADMIN:
              return <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><Shield size={12} className="mr-1"/> Super Admin</span>;
          case UserRole.ADMIN:
              return <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><Lock size={12} className="mr-1"/> Admin</span>;
          case UserRole.CASHIER:
              return <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded text-xs font-bold flex items-center w-fit"><UserIcon size={12} className="mr-1"/> Cashier</span>;
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">User Management</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Control access, roles, and security.</p>
        </div>
        <button 
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition shadow-sm font-medium"
        >
            <Plus size={18} className="mr-2" /> Add New User
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">User Profile</th>
              <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Role</th>
              <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Access Level</th>
              <th className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                <td className="p-4">
                    <div className="flex items-center">
                        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full mr-3 border border-slate-200 dark:border-slate-600 object-cover" />
                        <div>
                            <div className="font-medium text-slate-800 dark:text-white flex items-center">
                                {user.name}
                                {user.id === currentUser.id && <span className="ml-2 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600">YOU</span>}
                            </div>
                            <div className="text-xs text-slate-400 flex items-center"><Mail size={10} className="mr-1"/> {user.email}</div>
                        </div>
                    </div>
                </td>
                <td className="p-4">
                  {getRoleBadge(user.role)}
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                    <div className="text-xs">
                        <span className="font-bold">{user.permissions?.length || 0}</span> permissions active
                    </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end space-x-2">
                      <button 
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded transition"
                        title="Edit User"
                      >
                        <Edit2 size={16} />
                      </button>
                      {user.id !== currentUser.id && (
                          <button 
                            onClick={() => initiateDelete(user)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-700/50 rounded-t-xl">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                          {editingUser ? 'Edit User Profile' : 'Create New User'}
                      </h3>
                      <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6">
                      <form id="userForm" onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-8">
                          {/* Left Column: Details */}
                          <div className="flex-1 space-y-5">
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name <span className="text-red-500">*</span></label>
                                  <input 
                                    type="text" 
                                    required
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    placeholder="John Doe"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address <span className="text-red-500">*</span></label>
                                  <input 
                                    type="email" 
                                    required
                                    value={formData.email} 
                                    onChange={e => setFormData({...formData, email: e.target.value})} 
                                    className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    placeholder="john@nexus.com"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password {editingUser && '(Leave blank to keep)'}</label>
                                  <div className="relative">
                                      <input 
                                        type={showPassword ? "text" : "password"}
                                        required={!editingUser}
                                        value={formData.password} 
                                        onChange={e => setFormData({...formData, password: e.target.value})} 
                                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        placeholder={editingUser ? "••••••••" : "Set password"}
                                      />
                                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                          {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                                      </button>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Role <span className="text-red-500">*</span></label>
                                  <div className="space-y-2">
                                      {[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CASHIER].map(role => (
                                          <label key={role} className={`flex items-center p-3 border rounded-lg cursor-pointer transition ${formData.role === role ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                                              <input 
                                                type="radio" 
                                                name="role" 
                                                value={role}
                                                checked={formData.role === role}
                                                onChange={() => handleRoleChange(role)}
                                                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                              />
                                              <div className="ml-3 flex-1">
                                                  <span className="block text-sm font-bold text-slate-800 dark:text-white uppercase">{role.replace('_', ' ')}</span>
                                                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                                                      {role === UserRole.SUPER_ADMIN ? 'Full system access.' : role === UserRole.ADMIN ? 'Manage store & users.' : 'Sales & basic ops.'}
                                                  </span>
                                              </div>
                                              {formData.role === role && <CheckCircle size={18} className="text-blue-500"/>}
                                          </label>
                                      ))}
                                  </div>
                              </div>
                          </div>

                          {/* Right Column: Dynamic Permissions */}
                          <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1 flex items-center">
                                  <Shield size={16} className="mr-2 text-blue-500"/> Permissions
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                                  Customizing these permissions overrides the role defaults.
                              </p>
                              
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                  {PERMISSIONS_LIST.map(perm => {
                                      const isChecked = formData.permissions?.includes(perm.id);
                                      return (
                                          <div key={perm.id} className="flex items-start">
                                              <div className="flex items-center h-5">
                                                  <input
                                                    id={`perm-${perm.id}`}
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => togglePermission(perm.id)}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                                                  />
                                              </div>
                                              <div className="ml-3 text-sm">
                                                  <label htmlFor={`perm-${perm.id}`} className={`font-medium cursor-pointer ${isChecked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                                                      {perm.label}
                                                  </label>
                                                  <p className="text-xs text-slate-500 dark:text-slate-500">{perm.desc}</p>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      </form>
                  </div>

                  <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-xl flex justify-end space-x-3">
                      <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)} 
                        className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                      >
                          Cancel
                      </button>
                      <button 
                        type="submit"
                        form="userForm"
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md transition"
                      >
                          {editingUser ? 'Save Changes' : 'Create User'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                          <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Delete User?</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                          Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-white">{userToDelete.name}</span>? 
                          This action cannot be undone.
                      </p>
                      <div className="flex space-x-3 w-full">
                          <button 
                              onClick={() => setUserToDelete(null)}
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

export default UserManagement;
