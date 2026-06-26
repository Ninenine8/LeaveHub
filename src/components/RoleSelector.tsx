/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User } from '../types';
import { Shield, Users, User as UserIcon } from 'lucide-react';

interface RoleSelectorProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  lang?: 'en' | 'zh';
}

export default function RoleSelector({ currentUser, allUsers, onSelectUser, lang = 'en' }: RoleSelectorProps) {
  // Demo users for quick access
  const demoUsers = [
    { id: 'usr_1', label: lang === 'zh' ? 'HR 管理员 (Sarah)' : 'HR Admin (Sarah)', icon: Shield, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'usr_2', label: lang === 'zh' ? '主管 (David)' : 'David (Manager)', icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { id: 'usr_4', label: lang === 'zh' ? '员工 (Marcus)' : 'Marcus (Employee)', icon: UserIcon, color: 'text-sky-600 bg-sky-50 border-sky-200' },
  ];

  return (
    <div className="bg-slate-50 border-y border-slate-200 px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs" id="role-selector-container">
      <div className="flex items-center space-x-2">
        <span className="font-semibold text-slate-500">
          {lang === 'zh' ? '演示账号快速切换：' : 'Demo Quick-Switch:'}
        </span>
        <span className="text-slate-400">|</span>
        <span className="text-slate-600">
          {lang === 'zh' ? '当前角色：' : 'Current:'}{' '}
          <strong className="text-slate-900">{currentUser.name}</strong> ({lang === 'zh' && currentUser.role === 'admin' ? '管理员' : lang === 'zh' && currentUser.role === 'manager' ? '主管' : lang === 'zh' ? '员工' : currentUser.role.toUpperCase()} - {currentUser.department})
        </span>
      </div>
      <div className="flex items-center space-x-2">
        {demoUsers.map((demo) => {
          const user = allUsers.find(u => u.id === demo.id);
          if (!user) return null;
          const Icon = demo.icon;
          const isSelected = currentUser.id === user.id;

          return (
            <button
              key={demo.id}
              id={`switch-demo-${demo.id}`}
              onClick={() => onSelectUser(user)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm font-medium'
                  : `bg-white hover:bg-slate-100 text-slate-700 border-slate-200`
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{demo.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
