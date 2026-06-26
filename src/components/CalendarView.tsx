/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LeaveApplication, PublicHoliday, User, Department } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, Users } from 'lucide-react';

interface CalendarViewProps {
  applications: LeaveApplication[];
  holidays: PublicHoliday[];
  users: User[];
  departments: Department[];
  defaultDepartment?: string;
  lang?: 'en' | 'zh';
}

export default function CalendarView({ applications, holidays, users, departments, defaultDepartment = 'All', lang = 'en' }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 6, 1)); // Default to July 2026, where we have seeded data
  const [selectedDept, setSelectedDept] = useState<string>(defaultDepartment);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = lang === 'zh' ? [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ] : [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Dynamic Departments list for filtering
  const departmentOptions = ['All', ...departments.map(d => d.department_name)];

  const getDepartmentLabel = (dept: string) => {
    if (dept === 'All') {
      return lang === 'zh' ? '全部部门' : 'All Departments';
    }
    if (lang === 'zh') {
      switch (dept) {
        case 'Engineering': return '技术研发部';
        case 'Sales': return '市场销售部';
        case 'HR & Admin': return '人事与行政部';
        default: return dept;
      }
    }
    return `${dept} Department`;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Days in month calculation
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Fill in blanks for the grid before the 1st of the month
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => null);

  // Total grid cells (blanks + days)
  const gridCells = [...blanks, ...daysArray];

  // Helper: Format YYYY-MM-DD
  const formatDateStr = (dayNum: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  };

  // Filter approved leaves for the current month & selected department
  const getLeavesForDate = (dateStr: string) => {
    return applications.filter(app => {
      if (app.status !== 'approved') return false;
      if (selectedDept !== 'All' && app.department !== selectedDept) return false;
      
      const start = new Date(app.startDate);
      const end = new Date(app.endDate);
      const current = new Date(dateStr);
      
      return current >= start && current <= end;
    });
  };

  // Get holiday for date
  const getHolidayForDate = (dateStr: string) => {
    return holidays.find(holiday => holiday.date === dateStr);
  };

  // Leave Type color helpers
  const getLeaveBadgeStyle = (type: string) => {
    switch (type) {
      case 'annual': return 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100';
      case 'sick': return 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100';
      case 'childcare': return 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100';
      case 'unpaid': return 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100';
      default: return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="calendar-widget">
      {/* Calendar Header Controls */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">{lang === 'zh' ? '团队请假日程表' : 'Leave Calendar'}</h3>
            <p className="text-xs text-slate-500">{lang === 'zh' ? '查看团队成员考勤出勤情况与新加坡法定公共假期安排' : 'View team availability and Singapore Public Holidays'}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-50 rounded-lg p-1 border border-slate-200">
            <Users className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 focus:ring-0 cursor-pointer outline-none pr-6 font-medium"
              id="calendar-dept-filter"
            >
              {departmentOptions.map(dept => (
                <option key={dept} value={dept}>{getDepartmentLabel(dept)}</option>
              ))}
            </select>
          </div>

          {/* Month Steppers */}
          <div className="flex items-center space-x-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button
              onClick={prevMonth}
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-md transition cursor-pointer"
              title="Previous Month"
              id="calendar-prev-month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-800 min-w-[100px] text-center select-none">
              {lang === 'zh' ? `${year}年 ${monthNames[month]}` : `${monthNames[month]} ${year}`}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-md transition cursor-pointer"
              title="Next Month"
              id="calendar-next-month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-5">
        {/* Days of week */}
        <div className="grid grid-cols-7 text-center border-b border-slate-100 pb-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <div>{lang === 'zh' ? '日' : 'Sun'}</div>
          <div>{lang === 'zh' ? '一' : 'Mon'}</div>
          <div>{lang === 'zh' ? '二' : 'Tue'}</div>
          <div>{lang === 'zh' ? '三' : 'Wed'}</div>
          <div>{lang === 'zh' ? '四' : 'Thu'}</div>
          <div>{lang === 'zh' ? '五' : 'Fri'}</div>
          <div>{lang === 'zh' ? '六' : 'Sat'}</div>
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {gridCells.map((dayNum, cellIndex) => {
            if (dayNum === null) {
              return <div key={`empty-${cellIndex}`} className="min-h-[75px] sm:min-h-[100px] bg-slate-50/50 rounded-lg border border-transparent"></div>;
            }

            const dateStr = formatDateStr(dayNum);
            const holiday = getHolidayForDate(dateStr);
            const leaves = getLeavesForDate(dateStr);
            
            const isToday = () => {
              const today = new Date();
              return today.getFullYear() === year && today.getMonth() === month && today.getDate() === dayNum;
            };

            const dayOfWeek = new Date(year, month, dayNum).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div
                key={`day-${dayNum}`}
                id={`calendar-cell-${dateStr}`}
                className={`min-h-[75px] sm:min-h-[100px] p-1.5 rounded-lg border transition-all duration-150 flex flex-col justify-between group ${
                  isToday() 
                    ? 'border-blue-500 bg-blue-50/30 shadow-sm ring-1 ring-blue-500' 
                    : isWeekend 
                    ? 'bg-slate-50 border-slate-100' 
                    : 'bg-white hover:border-slate-300 border-slate-200'
                } ${holiday ? 'bg-rose-50/20' : ''}`}
              >
                {/* Day Number and Holiday label */}
                <div className="flex items-start justify-between">
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full select-none ${
                    isToday() 
                      ? 'bg-blue-600 text-white' 
                      : isWeekend 
                      ? 'text-slate-400' 
                      : 'text-slate-700'
                  }`}>
                    {dayNum}
                  </span>
                  
                  {holiday && (
                    <span 
                      className="text-[10px] bg-rose-100 text-rose-800 font-medium px-1 rounded truncate max-w-[80%] block" 
                      title={holiday.name}
                    >
                      {holiday.name}
                    </span>
                  )}
                </div>

                {/* Leaves in this day */}
                <div className="mt-1 space-y-1 flex-grow overflow-y-auto max-h-[50px] scrollbar-thin">
                  {leaves.map((leave, idx) => (
                    <div
                      key={`${leave.id}-${idx}`}
                      className={`text-[9px] sm:text-[10px] leading-tight px-1 py-0.5 rounded border border-transparent truncate font-medium flex items-center justify-between ${getLeaveBadgeStyle(leave.leaveType)}`}
                      title={`${leave.userName} - ${leave.leaveType.toUpperCase()} Leave (${leave.requestedDays} days)`}
                    >
                      <span className="truncate">{leave.userName.split(' ')[0]}</span>
                      <span className="text-[8px] opacity-70 ml-1">
                        {leave.leaveType === 'annual' ? 'AL' : leave.leaveType === 'sick' ? 'SL' : leave.leaveType === 'childcare' ? 'CL' : 'OL'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500 font-medium justify-center sm:justify-start">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-sky-500"></span>
            <span>{lang === 'zh' ? '年假 (AL)' : 'Annual (AL)'}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500"></span>
            <span>{lang === 'zh' ? '带薪病假 (SL)' : 'Sick (SL)'}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
            <span>{lang === 'zh' ? '带薪育儿假 (CL)' : 'Childcare (CL)'}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
            <span>{lang === 'zh' ? '无薪假 (UL)' : 'Unpaid (UL)'}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-rose-200 bg-rose-100/40"></span>
            <span>{lang === 'zh' ? '公共假期' : 'Public Holiday'}</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-200"></span>
            <span>{lang === 'zh' ? '周末双休' : 'Weekend'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
