/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, LeaveBalance, LeaveType, PublicHoliday, LeaveApplication } from '../types';
import { calculateWorkingDays, isNonWorkingDay } from '../data/singaporeHolidays';
import { Calendar, Upload, AlertCircle, CheckCircle, FileText, X } from 'lucide-react';
import { translations } from '../data/translations';

interface NewApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  balance: LeaveBalance;
  holidays: PublicHoliday[];
  existingApplications: LeaveApplication[];
  onSubmit: (applicationData: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    halfDaySession?: 'AM' | 'PM';
    requestedDays: number;
    reason: string;
    attachmentName?: string;
  }) => void;
  lang?: 'en' | 'zh';
}

export default function NewApplicationModal({
  isOpen,
  onClose,
  currentUser,
  balance,
  holidays,
  existingApplications,
  onSubmit,
  lang = 'en'
}: NewApplicationModalProps) {
  const t = translations[lang];

  // Form States
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [halfDaySession, setHalfDaySession] = useState<'AM' | 'PM'>('AM');
  const [reason, setReason] = useState<string>('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentName, setAttachmentName] = useState<string>('');

  // Validation States
  const [workingDays, setWorkingDays] = useState<number>(0);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Auto-calculate working days and validate
  useEffect(() => {
    if (!startDate || !endDate) {
      setWorkingDays(0);
      setDateError(null);
      setBalanceError(null);
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setWorkingDays(0);
      setDateError(lang === 'zh' ? '开始日期必须早于或等于结束日期。' : 'Start date must be before or equal to End date.');
      return;
    }

    setDateError(null);

    // Calculate normal working days
    let days = calculateWorkingDays(startDate, endDate, holidays);

    // Overwrite for half-day
    if (isHalfDay) {
      if (startDate !== endDate) {
        setDateError(lang === 'zh' ? '半天假申请的开始和结束日期必须是同一天。' : 'Half-day leave must start and end on the same day.');
        setWorkingDays(0);
        return;
      }
      
      const isDayOff = isNonWorkingDay(startDate, holidays);
      if (isDayOff) {
        setDateError(lang === 'zh' ? '所选日期是周末或公共假期。' : 'The selected date is a weekend or public holiday.');
        setWorkingDays(0);
        return;
      }
      days = 0.5;
    } else {
      if (days === 0) {
        setDateError(lang === 'zh' ? '所选日期仅包含周末或新加坡法定公共假期。' : 'The selected dates contain only weekends or Singapore public holidays.');
      }
    }

    setWorkingDays(days);

    // Real-time balance check
    validateBalances(leaveType, days);
  }, [startDate, endDate, isHalfDay, halfDaySession, leaveType, holidays]);

  const validateBalances = (type: LeaveType, days: number) => {
    setBalanceError(null);

    if (days <= 0) return;

    if (type === 'annual') {
      const remainingAnnual = (balance.annualEntitled + balance.annualCarriedForward) - (balance.annualUsed + balance.annualPending);
      if (days > remainingAnnual) {
        setBalanceError(lang === 'zh' ? `年假余额不足。您仅剩 ${remainingAnnual.toFixed(1)} 天年假（包含结转额度）。` : `Insufficient Annual Leave. You only have ${remainingAnnual.toFixed(1)} days remaining (including carried forward).`);
      }
    } else if (type === 'sick') {
      const remainingSick = balance.sickEntitled - (balance.sickUsed + balance.sickPending);
      if (days > remainingSick) {
        setBalanceError(lang === 'zh' ? `带薪病假余额不足。您仅剩 ${remainingSick} 天。` : `Insufficient Outpatient Sick Leave. You have ${remainingSick} days remaining.`);
        return;
      }
      // Also check against combined hospitalisation cap
      const finalHosp = balance.hospEntitled ?? 60;
      const sickUsed = balance.sickUsed || 0;
      const sickPending = balance.sickPending || 0;
      const hospUsed = balance.hospUsed || 0;
      const hospPending = balance.hospPending || 0;
      const remainingHosp = finalHosp - sickUsed - sickPending - hospUsed - hospPending;
      if (days > remainingHosp) {
        setBalanceError(lang === 'zh' 
          ? `带薪住院假或合并医疗假余额不足。您仅剩 ${remainingHosp} 天（包含已使用的住院假）。` 
          : `Insufficient Combined Medical Leave. You only have ${remainingHosp} days remaining under the combined cap.`);
      }
    } else if (type === 'hospitalisation') {
      const finalHosp = balance.hospEntitled ?? 60;
      const sickUsed = balance.sickUsed || 0;
      const sickPending = balance.sickPending || 0;
      const hospUsed = balance.hospUsed || 0;
      const hospPending = balance.hospPending || 0;
      const remainingHosp = finalHosp - sickUsed - sickPending - hospUsed - hospPending;
      if (days > remainingHosp) {
        setBalanceError(lang === 'zh' 
          ? `带薪住院假或合并医疗假余额不足。您仅剩 ${remainingHosp} 天（包含已使用的病假）。` 
          : `Insufficient Hospitalisation / Combined Medical Leave. You only have ${remainingHosp} days remaining under the combined cap.`);
      }
    } else if (type === 'childcare') {
      if (!currentUser.hasChildcareEligible) {
        setBalanceError(lang === 'zh' ? '根据新加坡人力部（MOM）标准，您未注册为有资格享有育儿假的员工。请联系管理员核对。' : 'You are not registered as eligible for Childcare Leave under Ministry of Manpower (MOM) criteria. Please check with Admin.');
        return;
      }
      const remainingChildcare = balance.childcareEntitled - (balance.childcareUsed + balance.childcarePending);
      if (days > remainingChildcare) {
        setBalanceError(lang === 'zh' ? `育儿假余额不足。您仅剩 ${remainingChildcare} 天。` : `Insufficient Childcare Leave. You have ${remainingChildcare} days remaining.`);
      }
    }
  };

  // Pre-fill endDate if startDate is set and we change to half day
  useEffect(() => {
    if (isHalfDay && startDate) {
      setEndDate(startDate);
    }
  }, [isHalfDay, startDate]);

  // Handle Drag & Drop simulation
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setAttachment(file);
      setAttachmentName(file.name);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachment(file);
      setAttachmentName(file.name);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    setAttachmentName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (workingDays <= 0) return;
    if (balanceError || dateError) return;

    // Check overlaps
    const hasOverlap = existingApplications.some(app => {
      if (app.userId !== currentUser.id) return false;
      if (app.status === 'rejected' || app.status === 'cancelled') return false;

      const appStart = new Date(app.startDate);
      const appEnd = new Date(app.endDate);
      const reqStart = new Date(startDate);
      const reqEnd = new Date(endDate);

      return (reqStart <= appEnd && reqEnd >= appStart);
    });

    if (hasOverlap) {
      setDateError(lang === 'zh' ? '重叠冲突：您在这段日期内已有已批准或待审批的请假申请。' : 'Overlap Error: You have an active or pending leave application covering these dates.');
      return;
    }

    // Submit
    onSubmit({
      leaveType,
      startDate,
      endDate,
      isHalfDay,
      halfDaySession: isHalfDay ? halfDaySession : undefined,
      requestedDays: workingDays,
      reason,
      attachmentName: attachmentName || undefined
    });

    // Reset Form
    setLeaveType('annual');
    setStartDate('');
    setEndDate('');
    setIsHalfDay(false);
    setReason('');
    setAttachment(null);
    setAttachmentName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" id="apply-leave-modal">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-xl border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">{t.applyForLeave}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
            id="modal-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Leave Type */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t.leaveType}</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              id="apply-leave-type-select"
            >
              <option value="annual">{lang === 'zh' ? '年假 (AL)' : 'Annual Leave'}</option>
              <option value="sick">{lang === 'zh' ? '带薪病假 (SL / MC)' : 'Outpatient Sick Leave'}</option>
              <option value="hospitalisation">{lang === 'zh' ? '带薪住院病假 (HL)' : 'Hospitalisation Leave'}</option>
              <option value="childcare">{lang === 'zh' ? '育儿假 (CL)' : 'Childcare Leave (Singapore Government Funded)'}</option>
              <option value="unpaid">{lang === 'zh' ? '无薪假' : 'Unpaid Leave'}</option>
              <option value="other">{lang === 'zh' ? '其他假期 (丧假、婚假等)' : 'Other Leave (Compassionate, Marriage, etc.)'}</option>
            </select>
          </div>

          {/* Half Day Checkbox */}
          <div className="flex items-center space-x-2 py-1">
            <input
              type="checkbox"
              id="apply-half-day-checkbox"
              checked={isHalfDay}
              onChange={(e) => {
                setIsHalfDay(e.target.checked);
                if (e.target.checked && startDate) {
                  setEndDate(startDate);
                }
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="apply-half-day-checkbox" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
              {t.halfDayLabel}
            </label>
          </div>

          {/* Dates Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {isHalfDay ? (lang === 'zh' ? '请假日期' : 'Leave Date') : t.startDate}
              </label>
              <input
                type="date"
                required
                value={startDate}
                min="2026-01-01"
                max="2027-12-31"
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                id="apply-start-date"
              />
            </div>

            {!isHalfDay ? (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t.endDate}</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  min={startDate || '2026-01-01'}
                  max="2027-12-31"
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  id="apply-end-date"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{lang === 'zh' ? '半天时段' : 'Session'}</label>
                <div className="flex border border-slate-300 rounded-lg overflow-hidden h-9">
                  <button
                    type="button"
                    onClick={() => setHalfDaySession('AM')}
                    className={`flex-1 text-xs font-medium cursor-pointer ${halfDaySession === 'AM' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    id="apply-session-am"
                  >
                    {t.morningAM}
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDaySession('PM')}
                    className={`flex-1 text-xs font-medium cursor-pointer ${halfDaySession === 'PM' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    id="apply-session-pm"
                  >
                    {t.afternoonPM}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Working Days Status Indicator */}
          {workingDays > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-blue-800 font-medium">
              <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-blue-950">{t.calculatedLeaveDays.replace('{days}', workingDays.toString())}</span>
                <p className="text-blue-600 text-[11px] mt-0.5">{t.excludesWeekendsHolidays}</p>
              </div>
            </div>
          )}

          {/* Validation Warnings */}
          {dateError && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex items-start space-x-2 text-xs text-rose-800" id="date-error-alert">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <span>{dateError}</span>
            </div>
          )}

          {balanceError && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-start space-x-2 text-xs text-amber-800" id="balance-error-alert">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span>{balanceError}</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t.reasonLabel}</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.reasonPlaceholder}
              className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              id="apply-leave-reason"
            />
          </div>

          {/* Attachment Selector (Compulsory for sick leave / MC tracking) */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              {lang === 'zh' ? '证明附件' : 'Attachment'}{' '}
              {leaveType === 'sick' || leaveType === 'hospitalisation' ? (
                <span className="text-rose-500 font-bold">{lang === 'zh' ? '（强烈建议上传MC/住院证明）' : '(Highly Recommended for MC/Hospitalisation verification)'}</span>
              ) : (
                <span className="text-slate-400 font-normal">{lang === 'zh' ? '（可选）' : '(Optional)'}</span>
              )}
            </label>

            {attachmentName ? (
              <div className="flex items-center justify-between border border-emerald-200 bg-emerald-50/50 rounded-lg p-2.5 text-xs text-emerald-800">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-medium truncate max-w-[250px]">{attachmentName}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50/30'
                    : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
                }`}
                id="apply-attachment-dropzone"
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <p className="text-xs font-medium text-slate-700">
                  {lang === 'zh' ? '拖拽文件至此，或者 ' : 'Drag & drop files here, or '}
                  <span className="text-blue-600 font-bold">{t.browseText}</span>
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{t.supportFileTypes}</p>
                <input
                  type="file"
                  id="file-upload-input"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>

          {/* Submit/Cancel Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              id="apply-cancel-btn"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={workingDays <= 0 || !!balanceError || !!dateError}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-lg shadow-sm transition cursor-pointer ${
                workingDays <= 0 || !!balanceError || !!dateError
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/10'
              }`}
              id="apply-submit-btn"
            >
              {t.submitRequest}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
