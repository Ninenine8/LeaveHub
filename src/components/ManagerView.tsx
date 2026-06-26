/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LeaveApplication, User, Department, PublicHoliday } from '../types';
import { CheckCircle2, XCircle, AlertTriangle, FileText, MessageSquare, ArrowRight, CornerDownRight, Users, Calendar, Building, ListFilter } from 'lucide-react';
import CalendarView from './CalendarView';

interface ManagerViewProps {
  currentUser: User;
  applications: LeaveApplication[];
  users: User[];
  departments: Department[];
  holidays: PublicHoliday[];
  onAction: (applicationId: string, status: 'approved' | 'rejected', comment: string) => void;
  lang?: 'en' | 'zh';
}

export default function ManagerView({ currentUser, applications, users, departments, holidays, onAction, lang = 'en' }: ManagerViewProps) {
  const [activeTab, setActiveTab] = useState<'approvals' | 'team' | 'calendar'>('approvals');

  // Pending applications assigned to this manager or in their department (for department-level visibility)
  const pendingRequests = applications.filter(
    app => app.status === 'pending' && (
      app.managerId === currentUser.id || 
      (currentUser.role === 'manager' && users.find(u => u.id === app.userId)?.departmentId === currentUser.departmentId)
    )
  );

  // Team members under this manager's scope (same department or direct report)
  const teamMembers = users.filter(
    u => u.departmentId === currentUser.departmentId || u.managerId === currentUser.id
  );

  // Group team members by department
  const teamByDept: { [deptName: string]: User[] } = {};
  teamMembers.forEach(member => {
    const deptName = member.department || 'Other';
    if (!teamByDept[deptName]) {
      teamByDept[deptName] = [];
    }
    teamByDept[deptName].push(member);
  });

  // States for comments (mapped by application id)
  const [comments, setComments] = useState<{ [key: string]: string }>({});

  const handleCommentChange = (appId: string, value: string) => {
    setComments(prev => ({ ...prev, [appId]: value }));
  };

  const getLeaveTypeStyle = (type: string) => {
    switch (type) {
      case 'annual': return 'bg-sky-100 text-sky-800 font-medium border border-sky-200';
      case 'sick': return 'bg-rose-100 text-rose-800 font-medium border border-rose-200';
      case 'childcare': return 'bg-emerald-100 text-emerald-800 font-medium border border-emerald-200';
      case 'unpaid': return 'bg-amber-100 text-amber-800 font-medium border border-amber-200';
      default: return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    if (lang === 'zh') {
      switch (type) {
        case 'annual': return '年假 (AL)';
        case 'sick': return '带薪病假 (SL)';
        case 'childcare': return '育儿假 (CL)';
        case 'unpaid': return '无薪假 (UL)';
        default: return type.toUpperCase();
      }
    }
    return type.toUpperCase();
  };

  // Check overlap with other approved leaves in same department
  const checkClashes = (request: LeaveApplication) => {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);

    const overlappingApprovals = applications.filter(app => {
      if (app.id === request.id) return false;
      if (app.status !== 'approved') return false;
      if (app.department !== request.department) return false; // same department

      const approvedStart = new Date(app.startDate);
      const approvedEnd = new Date(app.endDate);

      return (start <= approvedEnd && end >= approvedStart);
    });

    return overlappingApprovals;
  };

  return (
    <div className="space-y-6" id="manager-view-container">
      {/* Intro Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{lang === 'zh' ? '主管审批控制台' : 'Approvals Dashboard'}</h2>
          <p className="text-xs text-slate-500">{lang === 'zh' ? '审核您部门员工提交的请假申请，并协调好团队工作交接' : 'Review leave applications from your department and coordinate coverage'}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 text-blue-800 px-4 py-2.5 rounded-lg text-xs font-semibold">
          {lang === 'zh' ? '待审核申请' : 'Pending Reviews'}: <span className="bg-blue-600 text-white px-2 py-0.5 rounded ml-1 text-[11px]">{pendingRequests.length}</span>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200" id="manager-tabs">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center space-x-2 px-4 py-2 border-b-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'approvals'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-approvals"
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? '待我审核的请假' : 'Pending Approvals'}</span>
          <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px]">
            {pendingRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center space-x-2 px-4 py-2 border-b-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'team'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-team"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? '我的部门团队' : 'My Department Team'}</span>
          <span className="bg-slate-100 text-slate-600 rounded-full px-1.5 py-0.5 text-[10px]">
            {teamMembers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center space-x-2 px-4 py-2 border-b-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'calendar'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
          id="btn-tab-calendar"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? '团队请假日程表' : 'Team Leave Calendar'}</span>
        </button>
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
            {lang === 'zh' ? `待处理请假申请 (${pendingRequests.length})` : `Pending Leave Requests (${pendingRequests.length})`}
          </h3>

          {pendingRequests.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center" id="no-pending-approvals-card">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2.5" />
              <h4 className="text-sm font-bold text-slate-800">{lang === 'zh' ? '所有申请已批复完毕！' : 'No Pending Approvals!'}</h4>
              <p className="text-xs text-slate-500 mt-1">{lang === 'zh' ? '太棒了！您所在部门的所有请假申请都已审核处理完毕。' : 'Excellent! All leave requests in your department have been resolved.'}</p>
            </div>
          ) : (
            <div className="grid gap-4" id="pending-approvals-grid">
              {pendingRequests.map(req => {
                const clashes = checkClashes(req);
                const hasClash = clashes.length > 0;
                const appComments = comments[req.id] || '';

                return (
                  <div key={req.id} id={`pending-card-${req.id}`} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition duration-200">
                    {/* Card Header: Employee & Request overview */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-blue-100 text-blue-700 font-bold rounded-full flex items-center justify-center text-xs">
                          {req.userName.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{req.userName}</h4>
                          <p className="text-[11px] text-slate-500">
                            {lang === 'zh' ? (
                              req.department === 'Engineering' ? '技术研发部' : req.department === 'Sales' ? '市场销售部' : req.department === 'HR & Admin' ? '人事与行政部' : req.department
                            ) : req.department} {lang === 'zh' ? '' : 'Department'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2.5 py-1 rounded-full uppercase tracking-wider ${getLeaveTypeStyle(req.leaveType)}`}>
                          {getLeaveTypeLabel(req.leaveType)}
                        </span>
                        <span className="text-xs font-bold text-slate-700 bg-slate-200 px-2 py-1 rounded">
                          {req.requestedDays} {lang === 'zh' ? '天' : (req.requestedDays === 1 ? 'day' : 'days')}
                        </span>
                      </div>
                    </div>

                    {/* Card Body: Dates, details, and attachments */}
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Dates & Reason */}
                        <div className="space-y-3">
                          <div className="flex items-center text-xs font-semibold text-slate-700 space-x-2 bg-slate-50 p-2 rounded border border-slate-100">
                            <span className="bg-white border px-1.5 py-0.5 rounded">{req.startDate}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                            <span className="bg-white border px-1.5 py-0.5 rounded">{req.endDate}</span>
                            {req.isHalfDay && (
                              <span className="bg-amber-100 text-amber-800 text-[10px] px-1 rounded ml-1 font-bold">
                                {lang === 'zh' ? `半天 (${req.halfDaySession})` : `Half-day (${req.halfDaySession})`}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{lang === 'zh' ? '请假原因:' : 'Reason:'}</span>
                            <p className="text-xs text-slate-700 italic">"{req.reason}"</p>
                          </div>

                          {req.attachmentName && (
                            <div className="flex items-center space-x-1.5 text-blue-600 hover:text-blue-800 transition text-xs font-bold cursor-pointer">
                              <FileText className="w-4 h-4 shrink-0" />
                              <span>{lang === 'zh' ? '证明附件' : 'Attachment'}: {req.attachmentName}</span>
                            </div>
                          )}
                        </div>

                        {/* Conflict Checker */}
                        <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4 space-y-2">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">{lang === 'zh' ? '考勤冲突与出勤检查:' : 'Coverage & Clash Check:'}</span>
                          {hasClash ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1.5">
                              <div className="flex items-center space-x-1 text-amber-950 font-bold">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                <span>{lang === 'zh' ? '考勤人数冲突警告' : 'Manpower Clash Warning'}</span>
                              </div>
                              <p className="text-[11px] text-amber-700">{lang === 'zh' ? '以下同部门的同事在此期间已被批准休假，请注意在岗人手：' : 'The following colleagues from the same department are already approved to be away on these dates:'}</p>
                              <div className="space-y-1 mt-1 pl-1">
                                {clashes.map(clash => (
                                  <div key={clash.id} className="flex items-center space-x-1.5 text-[11px] text-amber-950 font-semibold">
                                    <CornerDownRight className="w-3 h-3 text-amber-500" />
                                    <span>{clash.userName} ({clash.startDate} {lang === 'zh' ? '至' : 'to'} {clash.endDate})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800">
                              <span className="font-bold text-emerald-950 block">✓ {lang === 'zh' ? '无部门出勤冲突' : 'No Department Clashes'}</span>
                              <p className="text-[11px] text-emerald-600 mt-0.5">
                                {lang === 'zh' ? `在此休假期间，${req.department === 'Engineering' ? '技术研发' : req.department === 'Sales' ? '市场销售' : req.department === 'HR & Admin' ? '人事与行政' : req.department}团队没有其他批准休假的人员。` : `No other approved absences in the ${req.department} team during this period.`}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions and Approver Comments */}
                      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-end gap-3 justify-between">
                        {/* Comments Input */}
                        <div className="w-full sm:max-w-md relative">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{lang === 'zh' ? '主管审批批注评语' : 'Approver Comments'}</span>
                          <div className="relative">
                            <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              value={appComments}
                              onChange={(e) => handleCommentChange(req.id, e.target.value)}
                              placeholder={lang === 'zh' ? '添加主管评语（可选，例如工作交接叮嘱）...' : 'Add comment (optional, e.g. cover details or congratulations)...'}
                              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              id={`pending-comment-${req.id}`}
                            />
                          </div>
                        </div>

                        {/* Approval buttons */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => onAction(req.id, 'rejected', appComments)}
                            className="px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-lg border border-rose-200 transition flex items-center space-x-1.5 cursor-pointer"
                            id={`reject-btn-${req.id}`}
                          >
                            <XCircle className="w-4 h-4" />
                            <span>{lang === 'zh' ? '拒绝申请' : 'Reject'}</span>
                          </button>
                          <button
                            onClick={() => onAction(req.id, 'approved', appComments)}
                            className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold rounded-lg transition shadow-sm hover:shadow shadow-emerald-600/10 flex items-center space-x-1.5 cursor-pointer"
                            id={`approve-btn-${req.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{lang === 'zh' ? '批准同意' : 'Approve'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY DEPARTMENT TEAM */}
      {activeTab === 'team' && (
        <div className="space-y-6" id="manager-team-tab">
          {Object.keys(teamByDept).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-800">{lang === 'zh' ? '未找到团队成员' : 'No Team Members Found'}</h4>
              <p className="text-xs text-slate-500 mt-1">{lang === 'zh' ? '目前没有员工分配到您的管理部门下。' : 'There are no employees assigned to your department scope.'}</p>
            </div>
          ) : (
            Object.keys(teamByDept).map(deptName => (
              <div key={deptName} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Building className="w-4 h-4 text-blue-600" />
                    <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">{deptName}</h3>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full font-mono">
                    {teamByDept[deptName].length} {teamByDept[deptName].length === 1 ? 'member' : 'members'}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {teamByDept[deptName].map(member => {
                    const isDeptHead = departments.some(d => d.department_head_user_id === member.id);
                    return (
                      <div key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-50 text-blue-700 font-bold rounded-full flex items-center justify-center">
                            {member.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h4 className="font-bold text-slate-800">{member.name}</h4>
                              {isDeptHead && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                  Dept Head
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">{member.email} • <span className="capitalize">{member.role}</span></p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Status:</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              (member.employment_status || (member.isActive ? 'Active' : 'Inactive')) === 'Active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {member.employment_status || (member.isActive ? 'Active' : 'Inactive')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: TEAM LEAVE CALENDAR */}
      {activeTab === 'calendar' && (
        <div id="manager-calendar-tab">
          <CalendarView
            applications={applications}
            holidays={holidays}
            users={users}
            departments={departments}
            defaultDepartment={currentUser.department || 'All'}
            lang={lang}
          />
        </div>
      )}

    </div>
  );
}
