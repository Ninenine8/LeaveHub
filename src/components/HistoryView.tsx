/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LeaveApplication, User } from '../types';
import { Trash2, Search, Filter, RefreshCcw, Info, ArrowRight } from 'lucide-react';
import { translations } from '../data/translations';

interface HistoryViewProps {
  currentUser: User;
  applications: LeaveApplication[];
  onCancelRequest: (applicationId: string) => void;
  lang?: 'en' | 'zh';
}

export default function HistoryView({ currentUser, applications, onCancelRequest, lang = 'en' }: HistoryViewProps) {
  const t = translations[lang];
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Get current user's leaves
  const personalRequests = applications.filter(app => app.userId === currentUser.id);

  // Filter applications
  const filteredPersonalRequests = personalRequests.filter(app => {
    const matchesStatus = filterStatus === 'All' || app.status === filterStatus;
    const matchesSearch = app.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          app.leaveType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800 font-bold border border-amber-200';
      case 'approved': return 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-200';
      case 'rejected': return 'bg-rose-100 text-rose-800 font-bold border border-rose-200';
      case 'cancelled': return 'bg-slate-100 text-slate-400 font-medium border border-slate-200';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusLabel = (status: string) => {
    if (lang === 'zh') {
      switch (status) {
        case 'pending': return '待审批';
        case 'approved': return '已批准';
        case 'rejected': return '已拒绝';
        case 'cancelled': return '已取消';
        default: return status;
      }
    }
    return status.toUpperCase();
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'annual': return lang === 'zh' ? '年假' : 'Annual Leave';
      case 'sick': return lang === 'zh' ? '带薪病假' : 'Sick Leave';
      case 'childcare': return lang === 'zh' ? '育儿假' : 'Childcare Leave';
      case 'unpaid': return lang === 'zh' ? '无薪假' : 'Unpaid Leave';
      default: return type.toUpperCase();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="personal-history-root">
      {/* Header and filters */}
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">{t.myLeaveHistory}</h3>
          <p className="text-xs text-slate-500">{lang === 'zh' ? '跟踪您已提交的申请、主管评语及最新审批状态。' : 'Track your submitted applications, approver comments, and status updates.'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={lang === 'zh' ? '搜索申请原因、类型...' : 'Search by reason, type...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white border rounded-lg pl-8 pr-3 py-1.5 focus:outline-none w-[180px]"
              id="history-search"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-1">
            <Filter className="w-3 h-3 text-slate-400 ml-1" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs bg-transparent border-none focus:ring-0 cursor-pointer text-slate-600 font-medium outline-none pr-5 py-0.5"
              id="history-status-filter"
            >
              <option value="All">{lang === 'zh' ? '所有审批状态' : 'All Statuses'}</option>
              <option value="pending">{lang === 'zh' ? '待审批' : 'Pending'}</option>
              <option value="approved">{lang === 'zh' ? '已批准' : 'Approved'}</option>
              <option value="rejected">{lang === 'zh' ? '已拒绝' : 'Rejected'}</option>
              <option value="cancelled">{lang === 'zh' ? '已取消' : 'Cancelled'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests list/table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
            <tr>
              <th className="p-4">{lang === 'zh' ? '申请日期' : 'Requested Date'}</th>
              <th className="p-4">{lang === 'zh' ? '休假种类' : 'Leave Category'}</th>
              <th className="p-4">{lang === 'zh' ? '请假时段' : 'Duration'}</th>
              <th className="p-4 text-center">{lang === 'zh' ? '共计工作日' : 'Total Working Days'}</th>
              <th className="p-4">{lang === 'zh' ? '请假事由' : 'Reason'}</th>
              <th className="p-4">{lang === 'zh' ? '审批状态 / 评语' : 'Approver Status'}</th>
              <th className="p-4 text-right">{lang === 'zh' ? '自助操作' : 'Self Service'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPersonalRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                  {lang === 'zh' ? '未找到符合筛选条件的请假申请。' : 'No personal leave applications match these filters.'}
                </td>
              </tr>
            ) : (
              filteredPersonalRequests.slice().reverse().map(app => (
                <tr key={app.id} className="hover:bg-slate-50/20 transition" id={`history-row-${app.id}`}>
                  <td className="p-4 font-medium text-slate-500 font-mono">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-slate-800">{getLeaveTypeLabel(app.leaveType)}</span>
                    {app.isHalfDay && (
                      <span className="bg-sky-50 text-sky-700 text-[9px] px-1 rounded ml-1 border border-sky-100">
                        {app.halfDaySession} {lang === 'zh' ? '半天假' : 'Half-Day'}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-1.5 font-mono text-slate-600">
                      <span>{app.startDate}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span>{app.endDate}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center font-bold font-mono text-slate-800">
                    {app.requestedDays}
                  </td>
                  <td className="p-4">
                    <div className="max-w-[180px] truncate" title={app.reason}>
                      {app.reason}
                    </div>
                    {app.attachmentName && (
                      <span className="text-[10px] text-blue-500 font-bold block mt-0.5 truncate">
                        📎 {app.attachmentName}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="space-y-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide inline-block ${getStatusBadgeStyle(app.status)}`}>
                        {getStatusLabel(app.status)}
                      </span>
                      {app.managerComments && (
                        <p className="text-[10px] text-slate-400 italic font-medium max-w-[150px] truncate" title={app.managerComments}>
                          "{app.managerComments}"
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    {app.status === 'pending' ? (
                      <button
                        onClick={() => {
                          if (confirm(lang === 'zh' ? '您确定要撤销这笔待审批的请假申请吗？' : 'Are you sure you want to cancel this pending leave request?')) {
                            onCancelRequest(app.id);
                          }
                        }}
                        className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded transition cursor-pointer flex items-center space-x-1 text-[10px] font-bold ml-auto"
                        id={`cancel-request-btn-${app.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'zh' ? '撤销申请' : 'Cancel Request'}</span>
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[10px] italic">{lang === 'zh' ? '已完成' : 'Finalized'}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
