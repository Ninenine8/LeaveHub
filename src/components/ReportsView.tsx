/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LeaveApplication, User, LeaveBalance, Department } from '../types';
import { Download, Search, SlidersHorizontal, BarChart3, HelpCircle, CalendarRange, ArrowUpDown } from 'lucide-react';

interface ReportsViewProps {
  applications: LeaveApplication[];
  users: User[];
  balances: LeaveBalance[];
  departments: Department[];
  lang?: 'en' | 'zh';
}

export default function ReportsView({ applications, users, balances, departments, lang = 'en' }: ReportsViewProps) {
  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Sorting
  const [sortField, setSortField] = useState<'userName' | 'startDate' | 'requestedDays'>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filtered dataset
  const filteredApps = applications.filter(app => {
    // Only report on approved (or we can report on all and let them see status)
    const matchesSearch = app.userName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === 'All' || app.department === selectedDept;
    const matchesType = selectedType === 'All' || app.leaveType === selectedType;
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && (new Date(app.startDate) >= new Date(startDate));
    }
    if (endDate) {
      matchesDate = matchesDate && (new Date(app.endDate) <= new Date(endDate));
    }

    return matchesSearch && matchesDept && matchesType && matchesDate;
  });

  // Sorting logic
  const sortedApps = [...filteredApps].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'userName') {
      comparison = a.userName.localeCompare(b.userName);
    } else if (sortField === 'startDate') {
      comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    } else if (sortField === 'requestedDays') {
      comparison = a.requestedDays - b.requestedDays;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const toggleSort = (field: 'userName' | 'startDate' | 'requestedDays') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Metric aggregates for approved leaves
  const approvedFilteredApps = filteredApps.filter(app => app.status === 'approved');
  const totalApprovedDays = approvedFilteredApps.reduce((sum, app) => sum + app.requestedDays, 0);
  
  // Counts by leave type in filtered set
  const typeCounts = approvedFilteredApps.reduce((acc, app) => {
    acc[app.leaveType] = (acc[app.leaveType] || 0) + app.requestedDays;
    return acc;
  }, {} as { [key: string]: number });

  const totalTypesCount = Object.values(typeCounts).reduce((a,b) => a+b, 0) || 1;

  const getDeptLabel = (dept: string) => {
    if (lang === 'zh') {
      switch (dept) {
        case 'Engineering': return '技术研发部';
        case 'Sales': return '市场销售部';
        case 'HR & Admin': return '人事与行政部';
        default: return dept;
      }
    }
    return dept;
  };

  const getLeaveTypeLabel = (type: string) => {
    if (lang === 'zh') {
      switch (type) {
        case 'annual': return '年假 (AL)';
        case 'sick': return '带薪病假 (SL)';
        case 'childcare': return '育儿假 (CL)';
        case 'unpaid': return '无薪假 (UL)';
        case 'other': return '其他假 (OL)';
        default: return type.toUpperCase();
      }
    }
    return type.toUpperCase();
  };

  const getStatusLabel = (status: string) => {
    if (lang === 'zh') {
      switch (status) {
        case 'approved': return '已批准';
        case 'pending': return '待审批';
        case 'rejected': return '已拒绝';
        case 'cancelled': return '已取消';
        default: return status;
      }
    }
    return status;
  };

  // Export CSV Function
  const handleExportCSV = () => {
    const headers = lang === 'zh' ? [
      '员工姓名',
      '所属部门',
      '请假种类',
      '开始日期',
      '结束日期',
      '请假天数',
      '审批状态',
      '请假原因',
      '审批负责人',
      '审批评语'
    ] : [
      'Employee Name',
      'Department',
      'Leave Type',
      'Start Date',
      'End Date',
      'Leave Days',
      'Status',
      'Reason',
      'Manager Approver',
      'Manager Comments'
    ];

    const rows = sortedApps.map(app => [
      app.userName,
      getDeptLabel(app.department),
      getLeaveTypeLabel(app.leaveType),
      app.startDate,
      app.endDate,
      app.requestedDays,
      getStatusLabel(app.status),
      `"${(app.reason || '').replace(/"/g, '""')}"`,
      app.managerName || '',
      `"${(app.managerComments || '').replace(/"/g, '""')}"`
    ]);

    // Construct CSV content
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `leavehub_sg_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6" id="reports-view-root">
      
      {/* Search and Filters panel */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">{lang === 'zh' ? '统计报表搜索与筛选' : 'Report Search & Filters'}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* Query search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder={lang === 'zh' ? '搜索员工姓名...' : 'Search employee...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:bg-white"
              id="report-search"
            />
          </div>

          {/* Dept filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 cursor-pointer focus:outline-none focus:bg-white font-medium text-slate-700"
            id="report-dept"
          >
            <option value="All">{lang === 'zh' ? '全部部门' : 'All Departments'}</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.department_name}>
                {getDeptLabel(dept.department_name)}
              </option>
            ))}
          </select>

          {/* Leave type filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 cursor-pointer focus:outline-none focus:bg-white font-medium text-slate-700"
            id="report-type"
          >
            <option value="All">{lang === 'zh' ? '全部请假种类' : 'All Leave Types'}</option>
            <option value="annual">{lang === 'zh' ? '年假' : 'Annual Leave'}</option>
            <option value="sick">{lang === 'zh' ? '带薪病假' : 'Sick Leave'}</option>
            <option value="childcare">{lang === 'zh' ? '育儿假' : 'Childcare Leave'}</option>
            <option value="unpaid">{lang === 'zh' ? '无薪假' : 'Unpaid Leave'}</option>
            <option value="other">{lang === 'zh' ? '其他假' : 'Other Leave'}</option>
          </select>

          {/* Start Date */}
          <div className="flex items-center space-x-1 border border-slate-300 rounded-lg px-2 bg-slate-50">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-transparent border-none py-1.5 focus:ring-0 text-[11px]"
              title="From Date"
              id="report-start"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center space-x-1 border border-slate-300 rounded-lg px-2 bg-slate-50">
            <CalendarRange className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-transparent border-none py-1.5 focus:ring-0 text-[11px]"
              title="To Date"
              id="report-end"
            />
          </div>
        </div>
      </div>

      {/* Overview Analytics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric widgets */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 flex flex-col justify-between">
          <div>
            <h4 className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">{lang === 'zh' ? '筛选统计指标汇总' : 'Filtered Metrics Summary'}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{lang === 'zh' ? '符合当前筛选条件的已批准休假汇总' : 'Approved allocations within current filters'}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-slate-500 text-[11px]">{lang === 'zh' ? '已休假总天数:' : 'Total Days Taken:'}</span>
              <p className="text-2xl font-black text-slate-900 font-mono mt-0.5">{totalApprovedDays.toFixed(1)} <span className="text-xs font-semibold text-slate-400">{lang === 'zh' ? '天' : 'days'}</span></p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">{lang === 'zh' ? '已批准申请数:' : 'Approved Requests:'}</span>
              <p className="text-2xl font-black text-blue-600 font-mono mt-0.5">{approvedFilteredApps.length}</p>
            </div>
          </div>
          
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">{lang === 'zh' ? '符合筛选的申请总量（含所有状态）:' : 'Matching applications (all statuses):'}</span>
            <span className="font-bold text-slate-800">{filteredApps.length}</span>
          </div>
        </div>

        {/* Visual Leave-Type Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3 md:col-span-2">
          <div className="flex items-center space-x-1.5">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h4 className="text-slate-800 font-bold text-xs uppercase tracking-wider">{lang === 'zh' ? '各请假类别使用比例份额' : 'Leave Type Usage Share'}</h4>
          </div>
          
          <div className="space-y-2.5 pt-1 text-[11px]">
            {/* Annual */}
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">{lang === 'zh' ? '年假 (AL)' : 'Annual Leave (AL)'}</span>
                <span className="font-mono text-slate-500">{(typeCounts['annual'] || 0)} {lang === 'zh' ? '天' : 'days'} ({Math.round(((typeCounts['annual'] || 0) / totalTypesCount) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-sky-500 h-full rounded-full" style={{ width: `${((typeCounts['annual'] || 0) / totalTypesCount) * 100}%` }}></div>
              </div>
            </div>

            {/* Sick */}
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">{lang === 'zh' ? '带薪病假 (SL)' : 'Sick Leave (SL)'}</span>
                <span className="font-mono text-slate-500">{(typeCounts['sick'] || 0)} {lang === 'zh' ? '天' : 'days'} ({Math.round(((typeCounts['sick'] || 0) / totalTypesCount) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${((typeCounts['sick'] || 0) / totalTypesCount) * 100}%` }}></div>
              </div>
            </div>

            {/* Childcare */}
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">{lang === 'zh' ? '带薪育儿假 (CL)' : 'Childcare Leave (CL)'}</span>
                <span className="font-mono text-slate-500">{(typeCounts['childcare'] || 0)} {lang === 'zh' ? '天' : 'days'} ({Math.round(((typeCounts['childcare'] || 0) / totalTypesCount) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${((typeCounts['childcare'] || 0) / totalTypesCount) * 100}%` }}></div>
              </div>
            </div>

            {/* Unpaid & Other */}
            <div>
              <div className="flex justify-between font-bold mb-1">
                <span className="text-slate-700">{lang === 'zh' ? '无薪假/其他' : 'Unpaid / Other'}</span>
                <span className="font-mono text-slate-500">{((typeCounts['unpaid'] || 0) + (typeCounts['other'] || 0))} {lang === 'zh' ? '天' : 'days'} ({Math.round((((typeCounts['unpaid'] || 0) + (typeCounts['other'] || 0)) / totalTypesCount) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(((typeCounts['unpaid'] || 0) + (typeCounts['other'] || 0)) / totalTypesCount) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Leave Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" id="reports-table-card">
        {/* Table Title and Export Button */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">{lang === 'zh' ? '请假使用明细日志' : 'Leave Usage Logs'}</h4>
            <p className="text-[11px] text-slate-400">
              {lang === 'zh' ? `显示符合当前筛选条件的 ${sortedApps.length} 条记录。` : `Showing ${sortedApps.length} results matching active filters.`}
            </p>
          </div>
          
          <button
            onClick={handleExportCSV}
            disabled={sortedApps.length === 0}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition flex items-center space-x-1.5 cursor-pointer shadow-sm ${
              sortedApps.length === 0
                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900'
            }`}
            id="report-export-csv-btn"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'zh' ? '导出 CSV 报表' : 'Export to CSV'}</span>
          </button>
        </div>

        {/* Table representation */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-600">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="p-4 cursor-pointer select-none" onClick={() => toggleSort('userName')}>
                  <div className="flex items-center space-x-1">
                    <span>{lang === 'zh' ? '员工姓名' : 'Employee'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4">{lang === 'zh' ? '所属部门' : 'Department'}</th>
                <th className="p-4">{lang === 'zh' ? '请假类别' : 'Leave Type'}</th>
                <th className="p-4 cursor-pointer select-none" onClick={() => toggleSort('startDate')}>
                  <div className="flex items-center space-x-1">
                    <span>{lang === 'zh' ? '请假时段' : 'Dates'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4 cursor-pointer select-none text-center" onClick={() => toggleSort('requestedDays')}>
                  <div className="flex items-center space-x-1 justify-center">
                    <span>{lang === 'zh' ? '天数' : 'Days'}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-4">{lang === 'zh' ? '审批状态' : 'Status'}</th>
                <th className="p-4">{lang === 'zh' ? '主管审批批注/评语' : 'Approver Notes'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedApps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    {lang === 'zh' ? '未找到符合当前筛选条件的请假申请明细记录。' : 'No matching leave records found within the selected filters.'}
                  </td>
                </tr>
              ) : (
                sortedApps.map(app => (
                  <tr key={app.id} className="hover:bg-slate-50/50 transition duration-150">
                    <td className="p-4">
                      <span className="font-bold text-slate-800 block">{app.userName}</span>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">{getDeptLabel(app.department)}</td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wide">{getLeaveTypeLabel(app.leaveType)}</span>
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-700">
                      {app.startDate} {lang === 'zh' ? '至' : 'to'} {app.endDate}
                    </td>
                    <td className="p-4 text-center font-bold font-mono text-slate-900">
                      {app.requestedDays}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        app.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : app.status === 'pending' 
                          ? 'bg-amber-100 text-amber-800' 
                          : app.status === 'rejected' 
                          ? 'bg-rose-100 text-rose-800' 
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {getStatusLabel(app.status)}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 italic max-w-[200px] truncate" title={app.managerComments || ''}>
                      {app.managerComments || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
