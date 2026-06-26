/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, LeaveBalance, CompanySettings, PublicHoliday, AuditLog, Department, LeaveApplication } from '../types';
import { Plus, Edit2, ShieldAlert, Settings, Calendar, History, Trash, Save, Check, UserMinus, UserPlus, RefreshCw, AlertCircle, Search, Eye, EyeOff, Building } from 'lucide-react';
import { calculateProratedLeave, RoundingRule, calculateMedicalEntitlements } from '../utils/leaveProration';

interface AdminViewProps {
  users: User[];
  balances: LeaveBalance[];
  settings: CompanySettings;
  holidays: PublicHoliday[];
  auditLogs: AuditLog[];
  departments: Department[];
  applications: LeaveApplication[];
  onAddEmployee: (user: Omit<User, 'id'>, initialBalances: Partial<LeaveBalance>) => void;
  onUpdateEmployee: (userId: string, updatedUser: Partial<User>, updatedBalance?: Partial<LeaveBalance>) => void;
  onAdjustBalance: (userId: string, updates: Partial<LeaveBalance>) => void;
  onUpdateSettings: (settings: CompanySettings) => void;
  onAddHoliday: (holiday: PublicHoliday) => void;
  onDeleteHoliday: (date: string) => void;
  onResetDatabase: () => void;
  onAddDepartment: (dept: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => void;
  onUpdateDepartment: (deptId: string, updatedDept: Partial<Department>) => void;
  onDeleteDepartment: (deptId: string) => void;
  lang?: 'en' | 'zh';
}

type AdminTab = 'employees' | 'departments' | 'settings' | 'holidays' | 'audit';

export default function AdminView({
  users,
  balances,
  settings,
  holidays,
  auditLogs,
  departments,
  applications,
  onAddEmployee,
  onUpdateEmployee,
  onAdjustBalance,
  onUpdateSettings,
  onAddHoliday,
  onDeleteHoliday,
  onResetDatabase,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  lang = 'en'
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('employees');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form toggles
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [selectedAdjustUser, setSelectedAdjustUser] = useState<User | null>(null);

  // Edit Employee Form Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [selectedEditUser, setSelectedEditUser] = useState<User | null>(null);

  // Date calculation helper
  const calculateProbationDates = (joinDateStr: string, periodVal: number, periodUnit: 'Days' | 'Months') => {
    if (!joinDateStr) return { start: '', end: '', confirmation: '' };
    try {
      const startDate = new Date(joinDateStr);
      if (isNaN(startDate.getTime())) return { start: '', end: '', confirmation: '' };

      const endDate = new Date(joinDateStr);
      if (periodUnit === 'Months') {
        endDate.setMonth(endDate.getMonth() + periodVal);
        endDate.setDate(endDate.getDate() - 1);
      } else {
        endDate.setDate(endDate.getDate() + periodVal - 1);
      }

      const endStr = endDate.toISOString().split('T')[0];
      
      const confDate = new Date(endDate);
      confDate.setDate(confDate.getDate() + 1);
      const confStr = confDate.toISOString().split('T')[0];

      return {
        start: joinDateStr,
        end: endStr,
        confirmation: confStr
      };
    } catch (e) {
      return { start: joinDateStr, end: '', confirmation: '' };
    }
  };

  // --- NEW EMPLOYEE FORM FIELDS ---
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpEmail, setNewEmpEmail] = useState<string>('');
  const [newEmpRole, setNewEmpRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [newEmpDept, setNewEmpDept] = useState<string>('Engineering');
  const [newEmpJoinDate, setNewEmpJoinDate] = useState<string>('2026-07-01'); // default custom seed test date
  const [newEmpChildcare, setNewEmpChildcare] = useState<boolean>(false);
  const [newEmpAnnual, setNewEmpAnnual] = useState<number>(14);
  const [newEmpMobile, setNewEmpMobile] = useState<string>('');
  const [newEmpTitle, setNewEmpTitle] = useState<string>('Software Engineer');
  const [newEmpManagerId, setNewEmpManagerId] = useState<string>('');
  const [newEmpType, setNewEmpType] = useState<'Full-time' | 'Part-time' | 'Contract'>('Full-time');
  const [newEmpStatus, setNewEmpStatus] = useState<'Active' | 'Inactive'>('Active');

  // Singapore Proration states for New Employee form
  const [newEmpLeaveYear, setNewEmpLeaveYear] = useState<number>(2026);
  const [newEmpRoundingRule, setNewEmpRoundingRule] = useState<RoundingRule>(settings.prorateRoundingRule || 'none');
  const [newEmpOverrideCalculated, setNewEmpOverrideCalculated] = useState<boolean>(false);
  const [newEmpAnnualFinal, setNewEmpAnnualFinal] = useState<number>(14);
  const [newEmpManualAdjustment, setNewEmpManualAdjustment] = useState<number>(0);

  const [newProbRequired, setNewProbRequired] = useState<boolean>(true);
  const [newProbPeriod, setNewProbPeriod] = useState<number>(3);
  const [newProbUnit, setNewProbUnit] = useState<'Days' | 'Months'>('Months');
  const [newProbStart, setNewProbStart] = useState<string>('2026-07-01');
  const [newProbEnd, setNewProbEnd] = useState<string>('2026-09-30');
  const [newConfDate, setNewConfDate] = useState<string>('2026-10-01');
  const [newConfStatus, setNewConfStatus] = useState<'On Probation' | 'Confirmed' | 'Extended' | 'Failed Probation' | 'Not Applicable'>('On Probation');
  const [newProbExtended, setNewProbExtended] = useState<boolean>(false);
  const [newExtensionPeriod, setNewExtensionPeriod] = useState<number>(0);
  const [newExtensionReason, setNewExtensionReason] = useState<string>('');
  const [newProbNotes, setNewProbNotes] = useState<string>('');

  // --- EDIT EMPLOYEE FORM FIELDS ---
  const [editEmpCustomId, setEditEmpCustomId] = useState<string>('');
  const [editEmpName, setEditEmpName] = useState<string>('');
  const [editEmpEmail, setEditEmpEmail] = useState<string>('');
  const [editEmpDept, setEditEmpDept] = useState<string>('');
   const [editEmpRole, setEditEmpRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [editEmpTitle, setEditEmpTitle] = useState<string>('');
  const [editEmpManagerId, setEditEmpManagerId] = useState<string>('');
  const [editEmpJoinDate, setEditEmpJoinDate] = useState<string>('');
  const [editEmpType, setEditEmpType] = useState<'Full-time' | 'Part-time' | 'Contract'>('Full-time');
  const [editEmpStatus, setEditEmpStatus] = useState<'Active' | 'Inactive'>('Active');
  const [editEmpChildcare, setEditEmpChildcare] = useState<boolean>(false);

  // New rich department state linkers
  const [newEmpDeptId, setNewEmpDeptId] = useState<string>('');
  const [editEmpDeptId, setEditEmpDeptId] = useState<string>('');

  // Singapore Proration states for Edit Employee Form
  const [editEmpAnnual, setEditEmpAnnual] = useState<number>(14);
  const [editEmpLeaveYear, setEditEmpLeaveYear] = useState<number>(2026);
  const [editEmpRoundingRule, setEditEmpRoundingRule] = useState<RoundingRule>('none');
  const [editEmpOverrideCalculated, setEditEmpOverrideCalculated] = useState<boolean>(false);
  const [editEmpAnnualFinal, setEditEmpAnnualFinal] = useState<number>(14);
  const [editEmpManualAdjustment, setEditEmpManualAdjustment] = useState<number>(0);
  const [showOverrideWarning, setShowOverrideWarning] = useState<boolean>(false);
  const [lastSystemCalculated, setLastSystemCalculated] = useState<number>(14);

  const [editProbRequired, setEditProbRequired] = useState<boolean>(true);
  const [editProbPeriod, setEditProbPeriod] = useState<number>(3);
  const [editProbUnit, setEditProbUnit] = useState<'Days' | 'Months'>('Months');
  const [editProbStart, setEditProbStart] = useState<string>('');
  const [editProbEnd, setEditProbEnd] = useState<string>('');
  const [editConfDate, setEditConfDate] = useState<string>('');
  const [editConfStatus, setEditConfStatus] = useState<'On Probation' | 'Confirmed' | 'Extended' | 'Failed Probation' | 'Not Applicable'>('On Probation');
  const [editProbExtended, setEditProbExtended] = useState<boolean>(false);
  const [editExtensionPeriod, setEditExtensionPeriod] = useState<number>(0);
  const [editExtensionReason, setEditExtensionReason] = useState<string>('');
  const [editProbNotes, setEditProbNotes] = useState<string>('');

  // Sync settings.prorateRoundingRule if it changes
  useEffect(() => {
    if (settings.prorateRoundingRule) {
      setNewEmpRoundingRule(settings.prorateRoundingRule);
    }
  }, [settings.prorateRoundingRule]);

  // Set default New Employee Department on mount or list update
  useEffect(() => {
    const activeDepts = departments.filter(d => d.status === 'Active');
    if (activeDepts.length > 0 && !newEmpDeptId) {
      setNewEmpDeptId(activeDepts[0].id);
      setNewEmpDept(activeDepts[0].department_name);
    }
  }, [departments, newEmpDeptId]);

  // Reactive calculation for New Employee
  const { 
    completedMonths: newCompletedMonths, 
    systemCalculated: newSystemCalculated, 
    roundedCalculated: newRoundedCalculated, 
    formulaStr: newFormulaStr 
  } = calculateProratedLeave(
    newEmpJoinDate,
    newEmpAnnual,
    newEmpLeaveYear,
    newEmpRoundingRule
  );

  useEffect(() => {
    if (settings.prorateNewJoiners) {
      if (!newEmpOverrideCalculated) {
        setNewEmpAnnualFinal(newRoundedCalculated);
      }
    } else {
      if (!newEmpOverrideCalculated) {
        setNewEmpAnnualFinal(newEmpAnnual);
      }
    }
  }, [newRoundedCalculated, newEmpAnnual, newEmpOverrideCalculated, settings.prorateNewJoiners]);

  // Reactive calculation for Edit Employee
  const { 
    completedMonths: editCompletedMonths, 
    systemCalculated: editSystemCalculated, 
    roundedCalculated: editRoundedCalculated, 
    formulaStr: editFormulaStr 
  } = calculateProratedLeave(
    editEmpJoinDate,
    editEmpAnnual,
    editEmpLeaveYear,
    editEmpRoundingRule
  );

  useEffect(() => {
    if (selectedEditUser) {
      if (lastSystemCalculated !== editRoundedCalculated) {
        if (editEmpOverrideCalculated) {
          setShowOverrideWarning(true);
        } else {
          setEditEmpAnnualFinal(editRoundedCalculated);
        }
        setLastSystemCalculated(editRoundedCalculated);
      }
    }
  }, [editRoundedCalculated, editEmpOverrideCalculated, selectedEditUser, lastSystemCalculated]);

  // Auto calculate new employee probation dates reactively
  useEffect(() => {
    if (newEmpJoinDate && newProbRequired) {
      const dates = calculateProbationDates(newEmpJoinDate, newProbPeriod, newProbUnit);
      setNewProbStart(dates.start);
      setNewProbEnd(dates.end);
      setNewConfDate(dates.confirmation);
    } else if (!newProbRequired) {
      setNewConfStatus('Not Applicable');
    }
  }, [newEmpJoinDate, newProbPeriod, newProbUnit, newProbRequired]);

  // Auto calculate edit employee probation dates reactively
  useEffect(() => {
    if (editEmpJoinDate && editProbRequired) {
      const dates = calculateProbationDates(editEmpJoinDate, editProbPeriod, editProbUnit);
      setEditProbStart(dates.start);
      setEditProbEnd(dates.end);
      setEditConfDate(dates.confirmation);
    } else if (!editProbRequired) {
      setEditConfStatus('Not Applicable');
    }
  }, [editEmpJoinDate, editProbPeriod, editProbUnit, editProbRequired]);

  // Manual Adjustment Form State
  const [adjAnnualEntitled, setAdjAnnualEntitled] = useState<number>(0);
  const [adjAnnualCarried, setAdjAnnualCarried] = useState<number>(0);
  const [adjSickEntitled, setAdjSickEntitled] = useState<number>(0);
  const [adjChildcareEntitled, setAdjChildcareEntitled] = useState<number>(0);

  // New Custom Holiday Form State
  const [holidayDate, setHolidayDate] = useState<string>('');
  const [holidayName, setHolidayName] = useState<string>('');

  // Department Management States
  const [deptSearchQuery, setDeptSearchQuery] = useState<string>('');
  const [deptStatusFilter, setDeptStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [showAddDeptModal, setShowAddDeptModal] = useState<boolean>(false);
  const [showEditDeptModal, setShowEditDeptModal] = useState<boolean>(false);
  const [selectedDeptToEdit, setSelectedDeptToEdit] = useState<Department | null>(null);

  // Department Form States
  const [deptName, setDeptName] = useState<string>('');
  const [deptCode, setDeptCode] = useState<string>('');
  const [deptHeadId, setDeptHeadId] = useState<string>('');
  const [deptDesc, setDeptDesc] = useState<string>('');
  const [deptStatus, setDeptStatus] = useState<'Active' | 'Inactive'>('Active');

  // Company Settings Form State
  const [settCarryForwardMax, setSettCarryForwardMax] = useState<number>(settings.annualLeaveCarryForwardMax);
  const [settProrate, setSettProrate] = useState<boolean>(settings.prorateNewJoiners);
  const [settAnnual, setSettAnnual] = useState<number>(settings.standardAnnualLeave);
  const [settSick, setSettSick] = useState<number>(settings.standardSickLeave);
  const [settChildcare, setSettChildcare] = useState<number>(settings.standardChildcareLeave);
  const [settRoundingRule, setSettRoundingRule] = useState<'none' | 'down-05' | 'up-05' | 'nearest-whole' | 'up-whole'>(settings.prorateRoundingRule || 'none');
  const [settGrantMedical, setSettGrantMedical] = useState<'mom' | 'confirmation' | 'custom'>(settings.grantMedicalOnConfirmation || 'mom');
  const [settCustomMedicalRule, setSettCustomMedicalRule] = useState<'grant-5-sick' | 'grant-full' | 'grant-prorated-pre3' | 'require-manual'>(settings.customMedicalRule || 'grant-5-sick');
  const [settUseDeptHead, setSettUseDeptHead] = useState<boolean>(settings.useDeptHeadAsDefaultApprover !== false);

  // Sync settings when they update from server
  useEffect(() => {
    setSettCarryForwardMax(settings.annualLeaveCarryForwardMax);
    setSettProrate(!!settings.prorateNewJoiners);
    setSettAnnual(settings.standardAnnualLeave);
    setSettSick(settings.standardSickLeave);
    setSettChildcare(settings.standardChildcareLeave);
    setSettRoundingRule(settings.prorateRoundingRule || 'none');
    setSettGrantMedical(settings.grantMedicalOnConfirmation || 'mom');
    setSettCustomMedicalRule(settings.customMedicalRule || 'grant-5-sick');
    setSettUseDeptHead(settings.useDeptHeadAsDefaultApprover !== false);
  }, [settings]);

  // Department Suggestion & Assign handlers
  const handleNewDeptChange = (deptId: string) => {
    setNewEmpDeptId(deptId);
    const deptObj = departments.find(d => d.id === deptId);
    if (deptObj) {
      setNewEmpDept(deptObj.department_name);
      
      const useDefault = settings.useDeptHeadAsDefaultApprover !== false;
      if (useDefault && deptObj.department_head_user_id) {
        setNewEmpManagerId(deptObj.department_head_user_id);
      }
    }
  };

  const handleEditDeptChange = (deptId: string) => {
    setEditEmpDeptId(deptId);
    const deptObj = departments.find(d => d.id === deptId);
    if (deptObj) {
      setEditEmpDept(deptObj.department_name);
      
      const useDefault = settings.useDeptHeadAsDefaultApprover !== false;
      if (useDefault && deptObj.department_head_user_id) {
        setEditEmpManagerId(deptObj.department_head_user_id);
      }
    }
  };

  // Handle Add Employee
  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpEmail || !newEmpJoinDate) {
      alert("Error: Full Name, Email, and Join Date are required.");
      return;
    }

    // Validation rules
    if (newProbRequired) {
      if (newProbEnd < newEmpJoinDate) {
        alert("Validation Error: Probation End Date cannot be earlier than Join Date.");
        return;
      }
      if (newConfDate < newEmpJoinDate) {
        alert("Validation Error: Confirmation Date cannot be earlier than Join Date.");
        return;
      }
    }

    const selectedManager = users.find(u => u.id === newEmpManagerId);

    onAddEmployee({
      name: newEmpName,
      email: newEmpEmail,
      role: newEmpRole,
      department: newEmpDept,
      departmentId: newEmpDeptId,
      joinDate: newEmpJoinDate,
      isActive: newEmpStatus === 'Active',
      hasChildcareEligible: newEmpChildcare,
      managerId: newEmpManagerId || undefined,
      managerName: selectedManager ? selectedManager.name : undefined,
      mobile: newEmpMobile,
      title: newEmpTitle,
      type: newEmpType,
      employment_status: newEmpStatus,

      // probation fields
      probation_required: newProbRequired,
      probation_period_value: newProbPeriod,
      probation_period_unit: newProbUnit,
      probation_start_date: newProbRequired ? newProbStart : '',
      probation_end_date: newProbRequired ? newProbEnd : '',
      confirmation_date: newConfDate,
      confirmation_status: newProbRequired ? newConfStatus : 'Not Applicable',
      probation_extended: newProbExtended,
      probation_extension_reason: newExtensionReason,
      first_login_at: '',
      last_login_at: ''
    }, {
      annualEntitled: newEmpAnnualFinal,
      annualCarriedForward: 0,
      annualUsed: 0,
      annualPending: 0,
      sickEntitled: settSick,
      sickUsed: 0,
      sickPending: 0,
      childcareEntitled: newEmpChildcare ? settChildcare : 0,
      childcareUsed: 0,
      childcarePending: 0,
      unpaidUsed: 0,
      otherUsed: 0,

      // Singapore Proration fields
      leaveYear: newEmpLeaveYear,
      annualEntitledSystem: newSystemCalculated,
      annualEntitledOverridden: newEmpOverrideCalculated,
      completedMonths: newCompletedMonths,
      roundingRuleUsed: newEmpRoundingRule,
      annualManualAdjustment: newEmpManualAdjustment
    });

    // Reset Form
    setNewEmpName('');
    setNewEmpEmail('');
    setNewEmpRole('employee');
    setNewEmpDept('');
    setNewEmpDeptId('');
    setNewEmpJoinDate('2026-07-01');
    setNewEmpChildcare(false);
    setNewEmpMobile('');
    setNewEmpTitle('Software Engineer');
    setNewEmpManagerId('');
    setNewEmpType('Full-time');
    setNewEmpStatus('Active');
    
    setNewProbRequired(true);
    setNewProbPeriod(3);
    setNewProbUnit('Months');
    setNewProbStart('2026-07-01');
    setNewProbEnd('2026-09-30');
    setNewConfDate('2026-10-01');
    setNewConfStatus('On Probation');
    setNewProbExtended(false);
    setNewExtensionPeriod(0);
    setNewExtensionReason('');
    setNewProbNotes('');

    setShowAddForm(false);
  };

  // Handle open adjust modal
  const openAdjustModal = (user: User) => {
    const bal = balances.find(b => b.userId === user.id);
    if (!bal) return;
    setSelectedAdjustUser(user);
    setAdjAnnualEntitled(bal.annualEntitled);
    setAdjAnnualCarried(bal.annualCarriedForward);
    setAdjSickEntitled(bal.sickEntitled);
    setAdjChildcareEntitled(bal.childcareEntitled);
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdjustUser) return;

    onAdjustBalance(selectedAdjustUser.id, {
      annualEntitled: adjAnnualEntitled,
      annualCarriedForward: adjAnnualCarried,
      sickEntitled: adjSickEntitled,
      childcareEntitled: adjChildcareEntitled
    });

    setShowAdjustModal(false);
    setSelectedAdjustUser(null);
  };

  // Open Edit Employee modal
  const openEditModal = (user: User) => {
    setSelectedEditUser(user);
    setEditEmpName(user.name || '');
    setEditEmpEmail(user.email || '');
    setEditEmpDept(user.department || '');
    setEditEmpDeptId(user.departmentId || '');
    setEditEmpRole(user.role || 'employee');
    setEditEmpTitle(user.title || 'Software Engineer');
    setEditEmpManagerId(user.managerId || '');
    setEditEmpJoinDate(user.joinDate || '');
    setEditEmpType(user.type || 'Full-time');
    setEditEmpStatus(user.employment_status || (user.isActive ? 'Active' : 'Inactive'));
    setEditEmpChildcare(!!user.hasChildcareEligible);

    setEditProbRequired(user.probation_required !== undefined ? user.probation_required : true);
    setEditProbPeriod(user.probation_period_value !== undefined ? user.probation_period_value : 3);
    setEditProbUnit(user.probation_period_unit || 'Months');
    setEditProbStart(user.probation_start_date || user.joinDate || '');
    setEditProbEnd(user.probation_end_date || '');
    setEditConfDate(user.confirmation_date || '');
    setEditConfStatus(user.confirmation_status || 'On Probation');
    setEditProbExtended(!!user.probation_extended);
    setEditExtensionReason(user.probation_extension_reason || '');

    // Initialize Singapore Proration states from user's leave balance
    const bal = balances.find(b => b.userId === user.id);
    const userLeaveYear = bal?.leaveYear || (user.joinDate ? new Date(user.joinDate).getFullYear() : 2026);
    const userRoundingRule = bal?.roundingRuleUsed || settings.prorateRoundingRule || 'none';
    const userAnnualEntitled = bal ? bal.annualEntitled : settings.standardAnnualLeave;
    
    // Calculate what the system says for this user's current settings
    const systemProrated = calculateProratedLeave(
      user.joinDate,
      settings.standardAnnualLeave,
      userLeaveYear,
      userRoundingRule
    );

    const isOverridden = bal?.annualEntitledOverridden !== undefined 
      ? bal.annualEntitledOverridden 
      : (bal ? bal.annualEntitled !== systemProrated.roundedCalculated : false);

    setEditEmpAnnual(settings.standardAnnualLeave);
    setEditEmpLeaveYear(userLeaveYear);
    setEditEmpRoundingRule(userRoundingRule);
    setEditEmpOverrideCalculated(isOverridden);
    setEditEmpAnnualFinal(userAnnualEntitled);
    setEditEmpManualAdjustment(bal?.annualManualAdjustment || 0);
    setLastSystemCalculated(systemProrated.roundedCalculated);
    setShowOverrideWarning(false);
    
    setShowEditModal(true);
  };

  const handleEditEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditUser) return;

    if (!editEmpJoinDate) {
      alert("Error: Join Date cannot be blank.");
      return;
    }

    if (editProbRequired) {
      if (editProbEnd < editEmpJoinDate) {
        alert("Validation Error: Probation End Date cannot be earlier than Join Date.");
        return;
      }
      if (editConfDate < editEmpJoinDate) {
        alert("Validation Error: Confirmation Date cannot be earlier than Join Date.");
        return;
      }
    }

    const selectedManager = users.find(u => u.id === editEmpManagerId);

    // Calculate confirmation status if probation extended
    let finalConfStatus = editConfStatus;
    if (editProbExtended) {
      finalConfStatus = 'Extended';
    }

    onUpdateEmployee(selectedEditUser.id, {
      name: editEmpName,
      email: editEmpEmail,
      department: editEmpDept,
      departmentId: editEmpDeptId,
      role: editEmpRole,
      title: editEmpTitle,
      managerId: editEmpManagerId || undefined,
      managerName: selectedManager ? selectedManager.name : undefined,
      joinDate: editEmpJoinDate,
      type: editEmpType,
      isActive: editEmpStatus === 'Active',
      employment_status: editEmpStatus,
      hasChildcareEligible: editEmpChildcare,

      probation_required: editProbRequired,
      probation_period_value: editProbPeriod,
      probation_period_unit: editProbUnit,
      probation_start_date: editProbRequired ? editProbStart : '',
      probation_end_date: editProbRequired ? editProbEnd : '',
      confirmation_date: editConfDate,
      confirmation_status: editProbRequired ? finalConfStatus : 'Not Applicable',
      probation_extended: editProbExtended,
      probation_extension_reason: editExtensionReason
    }, {
      leaveYear: editEmpLeaveYear,
      annualEntitledSystem: editSystemCalculated,
      annualEntitled: editEmpAnnualFinal,
      annualEntitledOverridden: editEmpOverrideCalculated,
      completedMonths: editCompletedMonths,
      roundingRuleUsed: editEmpRoundingRule,
      annualManualAdjustment: editEmpManualAdjustment
    });

    setShowEditModal(false);
    setSelectedEditUser(null);
  };

  // Handle add holiday
  const handleAddHolidaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName) return;

    onAddHoliday({
      date: holidayDate,
      name: holidayName,
      isCustom: true
    });

    setHolidayDate('');
    setHolidayName('');
  };

  // Handle update general settings
  const handleSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      annualLeaveCarryForwardMax: settCarryForwardMax,
      carryForwardExpiryMonth: 3, // default March 31st
      prorateNewJoiners: settProrate,
      standardAnnualLeave: settAnnual,
      standardSickLeave: settSick,
      standardChildcareLeave: settChildcare,
      prorateRoundingRule: settRoundingRule,
      grantMedicalOnConfirmation: settGrantMedical,
      customMedicalRule: settCustomMedicalRule,
      useDeptHeadAsDefaultApprover: settUseDeptHead
    });
  };

  // --- DEPARTMENT ACTION HANDLERS ---
  const handleOpenAddDeptModal = () => {
    setDeptName('');
    setDeptCode('');
    setDeptHeadId('');
    setDeptDesc('');
    setDeptStatus('Active');
    setShowAddDeptModal(true);
  };

  const handleOpenEditDeptModal = (dept: Department) => {
    setSelectedDeptToEdit(dept);
    setDeptName(dept.department_name);
    setDeptCode(dept.department_code || '');
    setDeptHeadId(dept.department_head_user_id || '');
    setDeptDesc(dept.description || '');
    setDeptStatus(dept.status);
    setShowEditDeptModal(true);
  };

  const handleAddDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) {
      alert("Validation Error: Department Name is required.");
      return;
    }
    if (departments.some(d => d.department_name.trim().toLowerCase() === deptName.trim().toLowerCase())) {
      alert(`Validation Error: A department named "${deptName}" already exists.`);
      return;
    }
    if (deptCode.trim() && departments.some(d => d.department_code?.trim().toLowerCase() === deptCode.trim().toLowerCase())) {
      alert(`Validation Error: A department with code "${deptCode}" already exists.`);
      return;
    }

    onAddDepartment({
      department_name: deptName.trim(),
      department_code: deptCode.trim() || undefined,
      department_head_user_id: deptHeadId || undefined,
      description: deptDesc.trim() || undefined,
      status: deptStatus
    });

    setShowAddDeptModal(false);
  };

  const handleEditDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptToEdit) return;
    if (!deptName.trim()) {
      alert("Validation Error: Department Name is required.");
      return;
    }
    if (departments.some(d => d.id !== selectedDeptToEdit.id && d.department_name.trim().toLowerCase() === deptName.trim().toLowerCase())) {
      alert(`Validation Error: A department named "${deptName}" already exists.`);
      return;
    }
    if (deptCode.trim() && departments.some(d => d.id !== selectedDeptToEdit.id && d.department_code?.trim().toLowerCase() === deptCode.trim().toLowerCase())) {
      alert(`Validation Error: A department with code "${deptCode}" already exists.`);
      return;
    }

    onUpdateDepartment(selectedDeptToEdit.id, {
      department_name: deptName.trim(),
      department_code: deptCode.trim() || undefined,
      department_head_user_id: deptHeadId || undefined,
      description: deptDesc.trim() || undefined,
      status: deptStatus
    });

    setShowEditDeptModal(false);
    setSelectedDeptToEdit(null);
  };

  const handleDeptDelete = (deptId: string, deptName: string) => {
    const employeeCount = users.filter(u => u.departmentId === deptId).length;
    if (employeeCount > 0) {
      alert(`Cannot Delete: There are currently ${employeeCount} employees assigned to the "${deptName}" department. You must reassign those employees or deactivate the department instead.`);
      return;
    }

    if (confirm(`Are you sure you want to delete the "${deptName}" department? This action cannot be undone.`)) {
      onDeleteDepartment(deptId);
    }
  };

  // Filtered employees
  const filteredEmployees = users.filter(user => {
    const matchesQuery = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         user.department.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesQuery;
  });

  return (
    <div className="space-y-6" id="admin-view-root">
      
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-sm border flex-wrap gap-1">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'employees' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="admin-tab-employees"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? '员工档案名册' : 'Employees Directory'}</span>
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'departments' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="admin-tab-departments"
        >
          <Building className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? '部门管理' : 'Departments'}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'settings' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="admin-tab-settings"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? '请假政策设定' : 'Leave Policy Settings'}</span>
        </button>

        <button
          onClick={() => setActiveTab('holidays')}
          className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'holidays' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="admin-tab-holidays"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? '新加坡公共假期' : 'Singapore Holidays'}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer ${
            activeTab === 'audit' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
          id="admin-tab-audit"
        >
          <History className="w-3.5 h-3.5" />
          <span>{lang === 'zh' ? 'HR 审计追踪日志' : 'HR Audit Trails'}</span>
        </button>
      </div>

      {/* --- TAB 1: EMPLOYEES --- */}
      {activeTab === 'employees' && (
        <div className="space-y-6" id="admin-employees-section">
          
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-900 text-base">{lang === 'zh' ? '员工档案名册' : 'Employee Directory'}</h3>
              <p className="text-xs text-slate-500">{lang === 'zh' ? '管理员工档案信息、状态启用、入职日期及手动调整休假余额。' : 'Manage profiles, status toggles, join dates, and manually adjust leave balances.'}</p>
            </div>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition flex items-center space-x-1.5 shadow-sm hover:shadow shadow-blue-600/10 cursor-pointer"
              id="admin-add-employee-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'zh' ? '登记新员工入职' : 'Add New Employee'}</span>
            </button>
          </div>

          {/* Add Employee Form Drawer */}
          {showAddForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-inner space-y-6" id="add-employee-form-container">
              <div>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Add New Employee Profile</h4>
                <p className="text-[11px] text-slate-500">Create a new employee profile with Join Date, Role, and Probation constraints.</p>
              </div>

              <form onSubmit={handleAddEmployeeSubmit} className="space-y-6 text-xs">
                {/* 1. Basic Details */}
                <div className="space-y-4">
                  <h5 className="font-bold text-blue-600 uppercase tracking-wider text-[10px] border-b pb-1">1. Basic & Work Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={newEmpName}
                        onChange={(e) => setNewEmpName(e.target.value)}
                        placeholder="e.g. Hana Suzuki"
                        className="w-full text-xs bg-white border rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500"
                        id="new-emp-name"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Company Email</label>
                      <input
                        type="email"
                        required
                        value={newEmpEmail}
                        onChange={(e) => setNewEmpEmail(e.target.value)}
                        placeholder="e.g. hana@company.sg"
                        className="w-full text-xs bg-white border rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500"
                        id="new-emp-email"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Department</label>
                      <select
                        value={newEmpDeptId}
                        onChange={(e) => handleNewDeptChange(e.target.value)}
                        className="w-full text-xs bg-white border rounded-lg p-2.5 cursor-pointer font-medium text-slate-800"
                        id="new-emp-dept"
                        required
                      >
                        <option value="" disabled>-- Select Department --</option>
                        {departments.filter(d => d.status === 'Active').map(d => (
                          <option key={d.id} value={d.id}>{d.department_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Job Title</label>
                      <input
                        type="text"
                        required
                        value={newEmpTitle}
                        onChange={(e) => setNewEmpTitle(e.target.value)}
                        placeholder="e.g. Software Engineer"
                        className="w-full text-xs bg-white border rounded-lg p-2.5"
                        id="new-emp-title"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">System Role</label>
                      <select
                        value={newEmpRole}
                        onChange={(e) => setNewEmpRole(e.target.value as any)}
                        className="w-full text-xs bg-white border rounded-lg p-2.5 cursor-pointer"
                        id="new-emp-role"
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager / Approver</option>
                        <option value="admin">Admin / HR</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Reports To (Manager)</label>
                      <select
                        value={newEmpManagerId}
                        onChange={(e) => setNewEmpManagerId(e.target.value)}
                        className="w-full text-xs bg-white border rounded-lg p-2.5"
                        id="new-emp-manager"
                      >
                        <option value="">No Manager / Self</option>
                        {users.filter(u => u.role === 'manager' || u.role === 'admin').map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Actual Join Date (Manually entered, does not change)</label>
                      <input
                        type="date"
                        required
                        value={newEmpJoinDate}
                        onChange={(e) => setNewEmpJoinDate(e.target.value)}
                        className="w-full text-xs bg-white border rounded-lg p-2.5 font-mono"
                        id="new-emp-joindate"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Employment Type</label>
                      <select
                        value={newEmpType}
                        onChange={(e) => setNewEmpType(e.target.value as any)}
                        className="w-full text-xs bg-white border rounded-lg p-2.5"
                        id="new-emp-type"
                      >
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Employment Status</label>
                      <select
                        value={newEmpStatus}
                        onChange={(e) => setNewEmpStatus(e.target.value as any)}
                        className="w-full text-xs bg-white border rounded-lg p-2.5"
                        id="new-emp-status"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 pt-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="new-emp-childcare-check"
                        checked={newEmpChildcare}
                        onChange={(e) => setNewEmpChildcare(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="new-emp-childcare-check" className="font-semibold text-slate-700 cursor-pointer select-none">
                        MOM Childcare Leave Eligible (6 Days)
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2. Annual Leave Entitlement & Proration */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <h5 className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">2. Annual Leave Entitlement & Proration</h5>
                  <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Standard Entitlement (Full Year)</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={newEmpAnnual}
                          onChange={(e) => setNewEmpAnnual(Number(e.target.value))}
                          className="w-full bg-white border rounded-lg p-2"
                          id="new-emp-annual-base"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Leave Year</label>
                        <input
                          type="number"
                          required
                          min="2020"
                          max="2100"
                          value={newEmpLeaveYear}
                          onChange={(e) => setNewEmpLeaveYear(Number(e.target.value))}
                          className="w-full bg-white border rounded-lg p-2"
                          id="new-emp-leave-year"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Rounding Rule</label>
                        <select
                          value={newEmpRoundingRule}
                          onChange={(e) => setNewEmpRoundingRule(e.target.value as any)}
                          className="w-full bg-white border rounded-lg p-2 cursor-pointer text-xs"
                          id="new-emp-rounding-rule"
                        >
                          <option value="nearest-whole">Round to nearest whole (MOM Standard)</option>
                          <option value="none">Keep exact decimal</option>
                          <option value="down-05">Round down to nearest 0.5</option>
                          <option value="up-05">Round up to nearest 0.5</option>
                          <option value="up-whole">Round up to nearest whole</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Manual Adjustments (Days)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={newEmpManualAdjustment}
                          onChange={(e) => setNewEmpManualAdjustment(Number(e.target.value))}
                          className="w-full bg-white border rounded-lg p-2"
                          id="new-emp-manual-adjustment"
                        />
                      </div>
                    </div>

                    {/* Calculation breakdown display */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-slate-600 space-y-1.5 font-sans" id="new-emp-proration-breakdown">
                      <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Singapore-Style Leave Calculation Breakdown</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                        <div>Join Date: <strong className="text-slate-800">{newEmpJoinDate}</strong></div>
                        <div>Leave Year: <strong className="text-slate-800">{newEmpLeaveYear}</strong></div>
                        <div>Completed Months: <strong className="text-slate-800">{newCompletedMonths} months</strong></div>
                        <div>Formula: <strong className="text-slate-800 font-mono">{newFormulaStr}</strong></div>
                      </div>
                      <div className="pt-1 text-[11px] text-slate-500">
                        System Calculated: <strong className="text-slate-800 font-mono">{newSystemCalculated.toFixed(4)} days</strong>
                        {" | "} Rounded ({newRoundingRuleUsed => newEmpRoundingRule}): <strong className="text-indigo-600 font-mono">{newRoundedCalculated} days</strong>
                      </div>
                    </div>

                    {/* Override Toggle & Input */}
                    <div className="flex items-center space-x-4 pt-1">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="new-emp-override-check"
                          checked={newEmpOverrideCalculated}
                          onChange={(e) => {
                            setNewEmpOverrideCalculated(e.target.checked);
                            if (!e.target.checked) {
                              setNewEmpAnnualFinal(newRoundedCalculated);
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="new-emp-override-check" className="font-bold text-slate-700 cursor-pointer select-none">
                          Override System Calculation
                        </label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-600">Final Entitlement:</span>
                        <input
                          type="number"
                          step="0.01"
                          disabled={!newEmpOverrideCalculated}
                          value={newEmpAnnualFinal}
                          onChange={(e) => setNewEmpAnnualFinal(Number(e.target.value))}
                          className={`w-24 bg-white border rounded-lg p-1.5 text-center font-bold ${!newEmpOverrideCalculated ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-blue-600'}`}
                          id="new-emp-annual-final"
                        />
                        <span className="text-slate-400 font-medium">days</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Probation & Confirmation Settings */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">3. Probation & Confirmation (Singapore Compliance)</h5>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="new-probation-required"
                        checked={newProbRequired}
                        onChange={(e) => setNewProbRequired(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="new-probation-required" className="font-bold text-slate-700 cursor-pointer select-none">
                        Probation Required (Default: Yes)
                      </label>
                    </div>
                  </div>

                  {newProbRequired && (
                    <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Probation Period Value</label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={newProbPeriod}
                            onChange={(e) => setNewProbPeriod(Number(e.target.value))}
                            className="w-full bg-white border rounded-lg p-2.5"
                            id="new-prob-period"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Probation Period Unit</label>
                          <select
                            value={newProbUnit}
                            onChange={(e) => setNewProbUnit(e.target.value as any)}
                            className="w-full bg-white border rounded-lg p-2.5"
                            id="new-prob-unit"
                          >
                            <option value="Months">Months</option>
                            <option value="Days">Days</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Confirmation Status</label>
                          <select
                            value={newConfStatus}
                            onChange={(e) => setNewConfStatus(e.target.value as any)}
                            className="w-full bg-white border rounded-lg p-2.5 font-bold"
                            id="new-conf-status"
                          >
                            <option value="On Probation">On Probation</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Extended">Probation Extended</option>
                            <option value="Failed Probation">Failed Probation</option>
                            <option value="Not Applicable">Not Applicable</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Probation Start Date</label>
                          <input
                            type="date"
                            required
                            value={newProbStart}
                            onChange={(e) => setNewProbStart(e.target.value)}
                            className="w-full bg-slate-50 border rounded-lg p-2.5 font-mono text-slate-500"
                            id="new-prob-start"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Probation End Date (System Generated)</label>
                          <input
                            type="date"
                            required
                            value={newProbEnd}
                            onChange={(e) => setNewProbEnd(e.target.value)}
                            className="w-full bg-white border rounded-lg p-2.5 font-mono"
                            id="new-prob-end"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Confirmation Date (End Date + 1 Day)</label>
                          <input
                            type="date"
                            required
                            value={newConfDate}
                            onChange={(e) => setNewConfDate(e.target.value)}
                            className="w-full bg-white border rounded-lg p-2.5 font-mono"
                            id="new-conf-date"
                          />
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="new-probation-extended"
                            checked={newProbExtended}
                            onChange={(e) => setNewProbExtended(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <label htmlFor="new-probation-extended" className="font-bold text-slate-800 cursor-pointer select-none">
                            Extend Probation Period
                          </label>
                        </div>

                        {newProbExtended && (
                          <div>
                            <label className="block font-semibold text-slate-600 mb-1">Reason for Extension</label>
                            <input
                              type="text"
                              required={newProbExtended}
                              value={newExtensionReason}
                              onChange={(e) => setNewExtensionReason(e.target.value)}
                              placeholder="e.g. Pending performance review or extended by 1 month"
                              className="w-full bg-white border rounded-lg p-2.5"
                              id="new-extension-reason"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Row */}
                <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 font-bold text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition cursor-pointer"
                    id="new-emp-submit"
                  >
                    Save Employee
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Directory Search & List */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                placeholder="Search staff by name, email, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                id="employee-search-bar"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="p-4">Name / Contact</th>
                    <th className="p-4">Department / Role</th>
                    <th className="p-4">Join & Probation Info</th>
                    <th className="p-4">First Login Date</th>
                    <th className="p-4 text-center">Leave Balances (AL / SL / CL)</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map(emp => {
                    const bal = balances.find(b => b.userId === emp.id);
                    const isSarahSelf = emp.id === 'usr_1';

                    // Get probation label
                    let probStatusLabel = 'Confirmed';
                    let badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                    if (emp.probation_required !== false) {
                      if (emp.probation_extended) {
                        probStatusLabel = 'Probation Extended';
                        badgeClass = 'bg-purple-50 text-purple-700 border border-purple-100';
                      } else if (emp.confirmation_status === 'Failed Probation') {
                        probStatusLabel = 'Failed Probation';
                        badgeClass = 'bg-rose-50 text-rose-700 border border-rose-100';
                      } else if (emp.confirmation_status === 'Confirmed') {
                        probStatusLabel = 'Confirmed';
                        badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                      } else {
                        // Check if today is past probation end date
                        const todayStr = new Date().toISOString().split('T')[0];
                        if (emp.probation_end_date && todayStr > emp.probation_end_date) {
                          probStatusLabel = 'Confirmed';
                          badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                        } else {
                          probStatusLabel = 'On Probation';
                          badgeClass = 'bg-amber-50 text-amber-700 border border-amber-100';
                        }
                      }
                    }

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4">
                          <span className="font-bold text-slate-800 block text-sm">{emp.name}</span>
                          <span className="text-[11px] text-slate-400">{emp.email}</span>
                          {emp.mobile && <span className="block text-[10px] text-slate-400 mt-0.5">📞 {emp.mobile}</span>}
                        </td>
                        <td className="p-4">
                          <span className="font-semibold text-slate-700 block">{emp.department}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">{emp.role} {emp.title ? `| ${emp.title}` : ''}</span>
                          {emp.type && <span className="text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-500 font-medium inline-block mt-1">{emp.type}</span>}
                        </td>
                        <td className="p-4 space-y-1">
                          <div className="text-[11px] text-slate-700">
                            <strong>Join Date:</strong> <span className="font-mono">{emp.joinDate || 'N/A'}</span>
                          </div>
                          {emp.probation_required !== false ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badgeClass}`}>
                                  {probStatusLabel}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                End: {emp.probation_end_date || 'N/A'}
                              </div>
                              {emp.probation_extended && emp.probation_extension_reason && (
                                <div className="text-[9px] text-purple-600 font-medium italic max-w-[150px] truncate" title={emp.probation_extension_reason}>
                                  Reason: {emp.probation_extension_reason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No Probation</span>
                          )}
                        </td>
                        <td className="p-4 font-mono text-[11px]">
                          {emp.first_login_at ? (
                            <div>
                              <span className="block text-slate-700">{new Date(emp.first_login_at).toISOString().split('T')[0]}</span>
                              <span className="block text-[9px] text-slate-400">{new Date(emp.first_login_at).toLocaleTimeString()}</span>
                            </div>
                          ) : (
                            <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-bold text-[10px] inline-block">Not logged in yet</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold block w-fit mb-1.5 ${emp.hasChildcareEligible ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                            {emp.hasChildcareEligible ? 'Childcare Eligible' : 'No Childcare Benefit'}
                          </span>
                          {bal ? (
                            <div className="flex flex-col gap-1 font-semibold font-mono text-[10px] w-fit">
                              <span className="bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.5 rounded block" title="Annual Leave remaining / entitled">
                                AL Rem: {(bal.annualEntitled + bal.annualCarriedForward - bal.annualUsed).toFixed(1)} / {bal.annualEntitled}
                              </span>
                              <span className="bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded block" title="Outpatient Sick Leave remaining / entitled">
                                SL Rem: {bal.sickEntitled - bal.sickUsed} / {bal.sickEntitled}
                              </span>
                              {emp.hasChildcareEligible && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded block" title="Childcare Leave remaining">
                                  CL Rem: {bal.childcareEntitled - bal.childcareUsed} / {bal.childcareEntitled}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">No active balance record</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${emp.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                            {emp.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-y-1">
                          <div className="flex flex-col md:flex-row justify-end gap-1">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="px-2 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition cursor-pointer font-bold text-[10px]"
                              id={`edit-btn-${emp.id}`}
                              title="Edit employee details, join date, probation, etc."
                            >
                              Edit Profile
                            </button>
                            <button
                              onClick={() => openAdjustModal(emp)}
                              className="px-2 py-1 text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded transition cursor-pointer font-bold text-[10px]"
                              id={`adj-btn-${emp.id}`}
                              title="Adjust leave balances manually"
                            >
                              Adjust Balances
                            </button>
                            {!isSarahSelf && (
                              <button
                                onClick={() => onUpdateEmployee(emp.id, { isActive: !emp.isActive })}
                                className={`px-2 py-1 rounded transition text-[10px] font-bold cursor-pointer ${emp.isActive ? 'bg-slate-100 hover:bg-rose-50 text-rose-600 hover:text-rose-800' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                id={`status-btn-${emp.id}`}
                                title={emp.isActive ? 'Deactivate employee' : 'Activate employee'}
                              >
                                {emp.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: DEPARTMENTS --- */}
      {activeTab === 'departments' && (
        <div className="space-y-6" id="admin-departments-section">
          {/* Dashboard Header Stats Card */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Total Departments</span>
              <span className="text-2xl font-black text-slate-800 font-mono block mt-1">{departments.length}</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Active Departments</span>
              <span className="text-2xl font-black text-emerald-600 font-mono block mt-1">
                {departments.filter(d => d.status === 'Active').length}
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm col-span-2">
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Departments with Pending Approvals</span>
              <span className="text-2xl font-black text-amber-600 font-mono block mt-1">
                {departments.filter(d => {
                  const deptUsers = users.filter(u => u.departmentId === d.id);
                  return deptUsers.some(u => {
                    const userApps = applications?.filter(app => app.userId === u.id && app.status === 'pending') || [];
                    return userApps.length > 0;
                  });
                }).length}
              </span>
            </div>
          </div>

          {/* Search, Filter & Add Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3 w-full md:w-auto">
              <div className="relative flex-grow">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search departments..."
                  value={deptSearchQuery}
                  onChange={(e) => setDeptSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <select
                value={deptStatusFilter}
                onChange={(e) => setDeptStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg text-xs py-2 px-3 cursor-pointer text-slate-700 font-medium"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
            </div>

            <button
              onClick={handleOpenAddDeptModal}
              className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-1.5 shadow shadow-blue-600/10 cursor-pointer"
              id="btn-add-dept"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Department</span>
            </button>
          </div>

          {/* Department List Grid */}
          {departments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center" id="empty-departments-state">
              <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">No departments added yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">No departments added yet. Add your first department to start organising employees.</p>
              <button
                onClick={handleOpenAddDeptModal}
                className="mt-4 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition cursor-pointer"
              >
                Create Department
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="departments-grid">
              {departments
                .filter(d => {
                  const matchesSearch = d.department_name.toLowerCase().includes(deptSearchQuery.toLowerCase()) ||
                    (d.department_code && d.department_code.toLowerCase().includes(deptSearchQuery.toLowerCase())) ||
                    (d.description && d.description.toLowerCase().includes(deptSearchQuery.toLowerCase()));
                  const matchesFilter = deptStatusFilter === 'All' || d.status === deptStatusFilter;
                  return matchesSearch && matchesFilter;
                })
                .map(dept => {
                  const empCount = users.filter(u => u.departmentId === dept.id).length;
                  const deptHeadUser = users.find(u => u.id === dept.department_head_user_id);
                  const hasPending = users.filter(u => u.departmentId === dept.id).some(u => {
                    return (applications || []).some(app => app.userId === u.id && app.status === 'pending');
                  });

                  return (
                    <div
                      key={dept.id}
                      className={`bg-white border rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between transition-all ${
                        dept.status === 'Inactive' ? 'opacity-70 bg-slate-50' : 'hover:border-slate-300'
                      }`}
                      id={`dept-card-${dept.id}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <h4 className="font-bold text-slate-900 text-sm tracking-tight">{dept.department_name}</h4>
                              {hasPending && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-black uppercase px-1 rounded-full animate-pulse">
                                  Pending Action
                                </span>
                              )}
                            </div>
                            {dept.department_code && (
                              <span className="font-mono text-[10px] text-slate-400 font-semibold uppercase">{dept.department_code}</span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${
                              dept.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {dept.status}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                          {dept.description || <span className="italic text-slate-400">No description provided.</span>}
                        </p>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Head / Approver</span>
                          <span className="font-bold text-slate-700">
                            {deptHeadUser ? deptHeadUser.name : <span className="italic text-slate-400">None Assigned</span>}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Employees</span>
                          <span className="font-bold text-slate-800 font-mono">{empCount} active</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEditDeptModal(dept)}
                          className="p-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded text-slate-500 transition cursor-pointer"
                          title="Edit department"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeptDelete(dept.id, dept.department_name)}
                          className={`p-1.5 rounded transition cursor-pointer ${
                            empCount > 0
                              ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                              : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500'
                          }`}
                          title={empCount > 0 ? "Cannot delete department with assigned employees" : "Delete department"}
                          disabled={empCount > 0}
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: SETTINGS --- */}
      {activeTab === 'settings' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6" id="admin-settings-section">
          <div className="border-b border-slate-100 pb-4 mb-5">
            <h3 className="font-bold text-slate-900 text-base">Singapore Leave Policy Settings</h3>
            <p className="text-xs text-slate-500">Configure standard base entitlements and carry-forward rules for Singapore MOM audits.</p>
          </div>

          <form onSubmit={handleSettingsSubmit} className="space-y-6 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Annual Leave (Days)</label>
                <input
                  type="number"
                  value={settAnnual}
                  onChange={(e) => setSettAnnual(Number(e.target.value))}
                  className="w-full text-xs bg-white border rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="settings-annual"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Outpatient Sick Leave (Days)</label>
                <input
                  type="number"
                  value={settSick}
                  onChange={(e) => setSettSick(Number(e.target.value))}
                  className="w-full text-xs bg-white border rounded-lg p-2.5 focus:outline-none focus:ring-1"
                  id="settings-sick"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Government Childcare Leave (Days)</label>
                <input
                  type="number"
                  value={settChildcare}
                  onChange={(e) => setSettChildcare(Number(e.target.value))}
                  className="w-full text-xs bg-white border rounded-lg p-2.5 focus:outline-none focus:ring-1"
                  id="settings-childcare"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Max Annual Leave Carry-Forward Limit (Days)</label>
                <input
                  type="number"
                  value={settCarryForwardMax}
                  onChange={(e) => setSettCarryForwardMax(Number(e.target.value))}
                  className="w-full text-xs bg-white border rounded-lg p-2.5 focus:outline-none focus:ring-1"
                  id="settings-carryforward"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="settings-prorate-check"
                  checked={settProrate}
                  onChange={(e) => setSettProrate(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer mt-0.5"
                />
                <div>
                  <label htmlFor="settings-prorate-check" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                    Prorate Annual Leave for New Joiners
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Under Singapore law, annual leave is prorated based on completed months of service in the current calendar year.</p>

                  {settProrate && (
                    <div className="mt-3 max-w-xs" id="settings-rounding-container">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Prorated Leave Rounding Option</label>
                      <select
                        value={settRoundingRule}
                        onChange={(e) => setSettRoundingRule(e.target.value as any)}
                        className="w-full text-xs bg-white border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        id="settings-rounding-rule"
                      >
                        <option value="nearest-whole">Round to nearest whole (MOM Standard: fraction &lt; 0.5 down, &gt;= 0.5 up)</option>
                        <option value="none">Keep exact decimal (e.g. 9.33 days)</option>
                        <option value="down-05">Round down to nearest 0.5 day (e.g. 9.0 days)</option>
                        <option value="up-05">Round up to nearest 0.5 day (e.g. 9.5 days)</option>
                        <option value="up-whole">Round up to nearest whole day (e.g. 10 days)</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="block">
                <label className="text-xs font-bold text-slate-800 block mb-1">
                  Grant medical leave entitlement upon early confirmation?
                </label>
                <p className="text-[11px] text-slate-500 mb-3">
                  Determine how outpatient sick leave and hospitalisation leave are granted when an employee is confirmed early (before 3 months).
                </p>
                
                <div className="space-y-2.5 max-w-md">
                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="grantMedicalOnConfirmation"
                      value="mom"
                      checked={settGrantMedical === 'mom'}
                      onChange={() => setSettGrantMedical('mom')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>No, follow MOM minimum by completed months of service only</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="grantMedicalOnConfirmation"
                      value="confirmation"
                      checked={settGrantMedical === 'confirmation'}
                      onChange={() => setSettGrantMedical('confirmation')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Yes, grant medical leave entitlement from confirmation date</span>
                  </label>

                  <label className="flex items-center space-x-2 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="grantMedicalOnConfirmation"
                      value="custom"
                      checked={settGrantMedical === 'custom'}
                      onChange={() => setSettGrantMedical('custom')}
                      className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Custom rule</span>
                  </label>
                </div>

                {settGrantMedical === 'custom' && (
                  <div className="mt-3 max-w-md bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2" id="custom-medical-rule-container">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Select Custom Rule</label>
                    <select
                      value={settCustomMedicalRule}
                      onChange={(e) => setSettCustomMedicalRule(e.target.value as any)}
                      className="w-full text-xs bg-white border rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-800"
                    >
                      <option value="grant-5-sick">Grant 5 days outpatient sick leave after confirmation</option>
                      <option value="grant-full">Grant full medical leave after confirmation (14 sick, 60 hosp)</option>
                      <option value="grant-prorated-pre3">Grant prorated medical leave before 3 months</option>
                      <option value="require-manual">Require manual approval / manual override</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-100 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Modifying policies will apply only to new employee entries.</span>
              </div>

              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition flex items-center space-x-1.5 shadow shadow-blue-600/10 cursor-pointer"
                id="save-settings-btn"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Leave Policies</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- TAB 3: HOLIDAYS --- */}
      {activeTab === 'holidays' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="admin-holidays-section">
          {/* Add custom holiday form */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 h-fit space-y-4">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Add Holiday / Off-Day</h3>
            <p className="text-[11px] text-slate-500">Add custom public holidays or corporate shut-down days (e.g., Company retreats) which should not count against employees' leave balances.</p>
            
            <form onSubmit={handleAddHolidaySubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full text-xs bg-white border rounded-lg p-2 focus:outline-none"
                  id="new-holiday-date"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Holiday Title</label>
                <input
                  type="text"
                  required
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  placeholder="e.g. SG National Day Offset"
                  className="w-full text-xs bg-white border rounded-lg p-2 focus:outline-none"
                  id="new-holiday-name"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition cursor-pointer"
                id="add-holiday-submit-btn"
              >
                Add Off-Day
              </button>
            </form>
          </div>

          {/* Holidays List */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 md:col-span-2">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3">Singapore Public Holidays ({holidays.length})</h3>
            <div className="overflow-y-auto max-h-[400px] border border-slate-100 rounded-lg">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Holiday Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(h => (
                    <tr key={h.date} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono font-medium">{h.date}</td>
                      <td className="p-3 font-bold text-slate-800">{h.name}</td>
                      <td className="p-3">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${h.isCustom ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                          {h.isCustom ? 'Custom Off-Day' : 'MOM Gazetted'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        {h.isCustom ? (
                          <button
                            onClick={() => onDeleteHoliday(h.date)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                            id={`del-ph-${h.date}`}
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold italic">Standard</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: AUDIT TRAIL --- */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5" id="admin-audit-section">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">HR Action Log & Audit Trails</h3>
              <p className="text-xs text-slate-500">Immutable records of leave adjustments, policy changes, and employee updates for internal transparency.</p>
            </div>
            
            <button
              onClick={onResetDatabase}
              className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 text-[11px] font-bold rounded-lg border border-rose-200 transition flex items-center space-x-1 cursor-pointer"
              id="reset-db-btn"
              title="Reset all database collections to their original system defaults."
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restore System Defaults</span>
            </button>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2">
            {auditLogs.slice().reverse().map(log => (
              <div key={log.id} className="border border-slate-100 hover:border-slate-200 transition rounded-lg p-3 bg-slate-50/50 flex items-start space-x-3">
                <div className="bg-blue-100 text-blue-700 px-2 py-1.5 rounded-lg text-xs font-bold font-mono">
                  LOG
                </div>
                <div className="flex-grow space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{log.action}</span>
                    <span className="text-[10px] font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-slate-600">{log.details}</p>
                  <span className="text-[10px] text-slate-400 font-medium">Actor: <strong className="text-slate-600 font-bold">{log.actorName}</strong> (ID: {log.actorId})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- ADJUST BALANCE MODAL --- */}
      {showAdjustModal && selectedAdjustUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" id="manual-adjust-modal">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Adjust Leave Balances: {selectedAdjustUser.name}</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Annual Leave Entitled (Days)</label>
                <input
                  type="number"
                  step="0.5"
                  value={adjAnnualEntitled}
                  onChange={(e) => setAdjAnnualEntitled(Number(e.target.value))}
                  className="w-full bg-white border rounded-lg p-2.5"
                  id="adj-annual-entitled"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Annual Leave Carried Forward (Days)</label>
                <input
                  type="number"
                  step="0.5"
                  value={adjAnnualCarried}
                  onChange={(e) => setAdjAnnualCarried(Number(e.target.value))}
                  className="w-full bg-white border rounded-lg p-2.5"
                  id="adj-annual-carried"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Sick Leave Entitled (Days)</label>
                <input
                  type="number"
                  value={adjSickEntitled}
                  onChange={(e) => setAdjSickEntitled(Number(e.target.value))}
                  className="w-full bg-white border rounded-lg p-2.5"
                  id="adj-sick-entitled"
                />
              </div>

              {selectedAdjustUser.hasChildcareEligible && (
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Childcare Leave Entitled (Days)</label>
                  <input
                    type="number"
                    value={adjChildcareEntitled}
                    onChange={(e) => setAdjChildcareEntitled(Number(e.target.value))}
                    className="w-full bg-white border rounded-lg p-2.5"
                    id="adj-childcare-entitled"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
                  id="adj-submit-btn"
                >
                  Apply Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* --- EDIT EMPLOYEE PROFILE MODAL --- */}
      {showEditModal && selectedEditUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" id="edit-employee-modal">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-xl border border-slate-200 my-8">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Edit Employee Profile: {selectedEditUser.name}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleEditEmployeeSubmit} className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">
              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h4 className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">1. Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={editEmpName}
                      onChange={(e) => setEditEmpName(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2"
                      id="edit-emp-name"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Company Email</label>
                    <input
                      type="email"
                      required
                      value={editEmpEmail}
                      onChange={(e) => setEditEmpEmail(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2"
                      id="edit-emp-email"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-semibold text-slate-600">Department</label>
                      {departments.find(d => d.id === editEmpDeptId)?.status === 'Inactive' && (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center space-x-1">
                          ⚠️ Inactive Department Warning
                        </span>
                      )}
                    </div>
                    <select
                      value={editEmpDeptId}
                      onChange={(e) => handleEditDeptChange(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2 font-medium text-slate-800 cursor-pointer"
                      id="edit-emp-dept"
                      required
                    >
                      <option value="" disabled>-- Select Department --</option>
                      {/* Show active departments, AND also the currently assigned department even if inactive */}
                      {departments.map(d => {
                        if (d.status === 'Active' || d.id === editEmpDeptId) {
                          return (
                            <option key={d.id} value={d.id}>
                              {d.department_name} {d.status === 'Inactive' ? '(Inactive)' : ''}
                            </option>
                          );
                        }
                        return null;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={editEmpTitle}
                      onChange={(e) => setEditEmpTitle(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2"
                      id="edit-emp-title"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">System Role</label>
                    <select
                      value={editEmpRole}
                      onChange={(e) => setEditEmpRole(e.target.value as any)}
                      className="w-full bg-white border rounded-lg p-2"
                      id="edit-emp-role"
                    >
                      <option value="employee">Employee</option>
                      <option value="manager">Manager / Approver</option>
                      <option value="admin">Admin / HR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Reports To (Manager)</label>
                    <select
                      value={editEmpManagerId}
                      onChange={(e) => setEditEmpManagerId(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2"
                      id="edit-emp-manager"
                    >
                      <option value="">No Manager / Self</option>
                      {users.filter(u => u.id !== selectedEditUser.id && (u.role === 'manager' || u.role === 'admin')).map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Employment Status & Dates */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">2. Employment & Dates (Singapore Audits)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Actual Join Date (MOM Entitlements start)</label>
                    <input
                      type="date"
                      required
                      value={editEmpJoinDate}
                      onChange={(e) => setEditEmpJoinDate(e.target.value)}
                      className="w-full bg-white border rounded-lg p-2 font-mono"
                      id="edit-emp-joindate"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Employment Type</label>
                    <select
                      value={editEmpType}
                      onChange={(e) => setEditEmpType(e.target.value as any)}
                      className="w-full bg-white border rounded-lg p-2"
                      id="edit-emp-type"
                    >
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Employment Status</label>
                    <select
                      value={editEmpStatus}
                      onChange={(e) => setEditEmpStatus(e.target.value as any)}
                      className="w-full bg-white border rounded-lg p-2"
                      id="edit-emp-status"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">First Login Date (System Tracked)</label>
                    <input
                      type="text"
                      disabled
                      readOnly
                      value={selectedEditUser.first_login_at ? new Date(selectedEditUser.first_login_at).toLocaleString() : 'Not logged in yet'}
                      className="w-full bg-slate-50 border rounded-lg p-2 font-mono text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="edit-emp-childcare-check"
                    checked={editEmpChildcare}
                    onChange={(e) => setEditEmpChildcare(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="edit-emp-childcare-check" className="font-semibold text-slate-700 cursor-pointer select-none">
                    MOM Government Childcare Leave Eligible
                  </label>
                </div>
              </div>

              {/* Section 3: Annual Leave Entitlement & Proration */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">3. Annual Leave Entitlement & Proration</h4>
                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Standard Entitlement (Full Year)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={editEmpAnnual}
                        onChange={(e) => setEditEmpAnnual(Number(e.target.value))}
                        className="w-full bg-white border rounded-lg p-2"
                        id="edit-emp-annual-base"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Leave Year</label>
                      <input
                        type="number"
                        required
                        min="2020"
                        max="2100"
                        value={editEmpLeaveYear}
                        onChange={(e) => setEditEmpLeaveYear(Number(e.target.value))}
                        className="w-full bg-white border rounded-lg p-2"
                        id="edit-emp-leave-year"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Rounding Rule</label>
                      <select
                        value={editEmpRoundingRule}
                        onChange={(e) => setEditEmpRoundingRule(e.target.value as any)}
                        className="w-full bg-white border rounded-lg p-2 cursor-pointer text-xs"
                        id="edit-emp-rounding-rule"
                      >
                        <option value="nearest-whole">Round to nearest whole (MOM Standard)</option>
                        <option value="none">Keep exact decimal</option>
                        <option value="down-05">Round down to nearest 0.5</option>
                        <option value="up-05">Round up to nearest 0.5</option>
                        <option value="up-whole">Round up to nearest whole</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Manual Adjustments (Days)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editEmpManualAdjustment}
                        onChange={(e) => setEditEmpManualAdjustment(Number(e.target.value))}
                        className="w-full bg-white border rounded-lg p-2"
                        id="edit-emp-manual-adjustment"
                      />
                    </div>
                  </div>

                  {/* Calculation breakdown display */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 text-slate-600 space-y-1.5 font-sans" id="edit-emp-proration-breakdown">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Singapore-Style Leave Calculation Breakdown</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                      <div>Join Date: <strong className="text-slate-800">{editEmpJoinDate}</strong></div>
                      <div>Leave Year: <strong className="text-slate-800">{editEmpLeaveYear}</strong></div>
                      <div>Completed Months: <strong className="text-slate-800">{editCompletedMonths} months</strong></div>
                      <div>Formula: <strong className="text-slate-800 font-mono">{editFormulaStr}</strong></div>
                    </div>
                    <div className="pt-1 text-[11px] text-slate-500">
                      System Calculated: <strong className="text-slate-800 font-mono">{editSystemCalculated.toFixed(4)} days</strong>
                      {" | "} Rounded ({editEmpRoundingRule}): <strong className="text-indigo-600 font-mono">{editRoundedCalculated} days</strong>
                    </div>
                  </div>

                  {/* Override Warning Banner position */}
                  {showOverrideWarning && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-lg flex flex-col space-y-2 text-[11px]" id="override-warning-banner">
                      <div className="flex items-center space-x-2 font-bold">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>System Calculation Changed!</span>
                      </div>
                      <p className="font-medium text-amber-700">
                        The system calculated entitlement has changed to <strong className="font-mono">{editRoundedCalculated} days</strong> due to field modifications, but a manual override is currently active.
                        Do you want to keep your manual override of <strong className="font-mono">{editEmpAnnualFinal} days</strong> or update to the new system calculated value?
                      </p>
                      <div className="flex space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowOverrideWarning(false);
                          }}
                          className="px-2.5 py-1 bg-amber-600 text-white font-bold rounded hover:bg-amber-700 transition cursor-pointer"
                        >
                          Keep Manual Override
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditEmpAnnualFinal(editRoundedCalculated);
                            setEditEmpOverrideCalculated(false);
                            setShowOverrideWarning(false);
                          }}
                          className="px-2.5 py-1 bg-white text-amber-800 border border-amber-300 font-bold rounded hover:bg-amber-100 transition cursor-pointer"
                        >
                          Update to New Calculated Value
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Override Toggle & Input */}
                  <div className="flex items-center space-x-4 pt-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-emp-override-check"
                        checked={editEmpOverrideCalculated}
                        onChange={(e) => {
                          setEditEmpOverrideCalculated(e.target.checked);
                          if (!e.target.checked) {
                            setEditEmpAnnualFinal(editRoundedCalculated);
                          }
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="edit-emp-override-check" className="font-bold text-slate-700 cursor-pointer select-none">
                        Override System Calculation
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-600">Final Entitlement:</span>
                      <input
                        type="number"
                        step="0.01"
                        disabled={!editEmpOverrideCalculated}
                        value={editEmpAnnualFinal}
                        onChange={(e) => setEditEmpAnnualFinal(Number(e.target.value))}
                        className={`w-24 bg-white border rounded-lg p-1.5 text-center font-bold ${!editEmpOverrideCalculated ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-blue-600'}`}
                        id="edit-emp-annual-final"
                      />
                      <span className="text-slate-400 font-medium">days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4: Probation Rules */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-blue-600 uppercase tracking-wider text-[10px]">4. Probation Settings</h4>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-probation-required"
                      checked={editProbRequired}
                      onChange={(e) => setEditProbRequired(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="edit-probation-required" className="font-bold text-slate-700 cursor-pointer select-none">
                      Probation Period Required
                    </label>
                  </div>
                </div>

                {editProbRequired && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Probation Period Value</label>
                        <input
                          type="number"
                          required
                          value={editProbPeriod}
                          onChange={(e) => setEditProbPeriod(Number(e.target.value))}
                          className="w-full bg-white border rounded-lg p-2"
                          id="edit-prob-period"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Probation Period Unit</label>
                        <select
                          value={editProbUnit}
                          onChange={(e) => setEditProbUnit(e.target.value as any)}
                          className="w-full bg-white border rounded-lg p-2"
                          id="edit-prob-unit"
                        >
                          <option value="Months">Months</option>
                          <option value="Days">Days</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Probation Start Date</label>
                        <input
                          type="date"
                          required
                          value={editProbStart}
                          onChange={(e) => setEditProbStart(e.target.value)}
                          className="w-full bg-white border rounded-lg p-2 font-mono"
                          id="edit-prob-start"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Probation End Date</label>
                        <input
                          type="date"
                          required
                          value={editProbEnd}
                          onChange={(e) => setEditProbEnd(e.target.value)}
                          className="w-full bg-white border rounded-lg p-2 font-mono"
                          id="edit-prob-end"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Confirmation Status</label>
                        <select
                          value={editConfStatus}
                          onChange={(e) => setEditConfStatus(e.target.value as any)}
                          className="w-full bg-white border rounded-lg p-2 font-semibold"
                          id="edit-conf-status"
                        >
                          <option value="On Probation">On Probation</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Probation Extended">Probation Extended</option>
                          <option value="Failed Probation">Failed Probation</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">Confirmation Date</label>
                        <input
                          type="date"
                          required
                          value={editConfDate}
                          onChange={(e) => setEditConfDate(e.target.value)}
                          className="w-full bg-white border rounded-lg p-2 font-mono"
                          id="edit-conf-date"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-200/60 pt-3 space-y-3">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="edit-probation-extended"
                          checked={editProbExtended}
                          onChange={(e) => setEditProbExtended(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="edit-probation-extended" className="font-bold text-slate-800 cursor-pointer select-none">
                          Extend Employee Probation Period
                        </label>
                      </div>

                      {editProbExtended && (
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">Probation Extension Reason</label>
                          <input
                            type="text"
                            required={editProbExtended}
                            value={editExtensionReason}
                            onChange={(e) => setEditExtensionReason(e.target.value)}
                            placeholder="e.g. Performance review pending or extended by 1 month"
                            className="w-full bg-white border rounded-lg p-2"
                            id="edit-extension-reason"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 5: Medical Leave Entitlements & Early Confirmation Overrides */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="font-bold text-indigo-600 uppercase tracking-wider text-[10px]">5. Singapore Medical Leave Entitlement Details</h4>
                
                {(() => {
                  const calculated = calculateMedicalEntitlements(
                    editEmpJoinDate,
                    '2026-06-25', // Use current system date
                    editConfStatus,
                    editConfDate,
                    settings
                  );

                  return (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 font-sans text-xs">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-sans">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider mb-0.5">Join Date</span>
                          <span className="font-mono text-slate-800 font-semibold">{editEmpJoinDate || 'N/A'}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider mb-0.5">Completed Months of Service</span>
                          <span className="font-mono text-slate-800 font-semibold">{calculated.completedMonths} {calculated.completedMonths === 1 ? 'month' : 'months'}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider mb-0.5">Probation Status</span>
                          <span className="font-semibold text-slate-800">{editProbRequired ? 'Probation Required' : 'No Probation'}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider mb-0.5">Confirmation Status</span>
                          <span className="font-semibold text-slate-800">{editConfStatus}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider mb-0.5">Confirmation Date</span>
                          <span className="font-mono text-slate-800 font-semibold">{editConfDate || 'N/A'}</span>
                        </div>

                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/60">
                          <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider mb-0.5">Medical Leave Rule Applied</span>
                          <span className="font-semibold text-blue-600 block truncate" title={calculated.ruleApplied}>{calculated.ruleApplied}</span>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">MOM Statutory Entitlement</span>
                          <div className="font-mono space-y-0.5">
                            <div>Outpatient Sick: <span className="font-bold text-slate-700">{calculated.momSick} days</span></div>
                            <div>Hospitalisation: <span className="font-bold text-slate-700">{calculated.momHosp} days</span></div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-slate-400 font-bold uppercase text-[9px] tracking-wider block">Company Override Entitlement</span>
                          <div className="font-mono space-y-0.5">
                            {calculated.overrideSick !== null ? (
                              <>
                                <div className="text-amber-700 font-medium">Outpatient Sick: <span className="font-bold">+{calculated.overrideSick} days</span></div>
                                <div className="text-amber-700 font-medium">Hospitalisation: <span className="font-bold">+{calculated.overrideHosp} days</span></div>
                                <div className="text-[9px] text-amber-600 italic leading-none mt-1">Company benefit override active</div>
                              </>
                            ) : (
                              <div className="text-slate-400 italic">No override active (following MOM)</div>
                            )}
                          </div>
                        </div>

                        <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 space-y-1">
                          <span className="text-indigo-600 font-bold uppercase text-[9px] tracking-wider block">Final Medical Entitlement</span>
                          <div className="font-mono text-slate-800 text-[11px] font-semibold space-y-0.5">
                            <div>Outpatient Sick: <span className="font-bold text-indigo-700">{calculated.finalSick} days</span></div>
                            <div>Hospitalisation: <span className="font-bold text-indigo-700">{calculated.finalHosp} days</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Submit / Action buttons */}
              <div className="pt-4 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                  id="edit-emp-submit-btn"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD DEPARTMENT MODAL --- */}
      {showAddDeptModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" id="add-dept-modal">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Add New Department</h3>
              <button onClick={() => setShowAddDeptModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddDeptSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500"
                  id="add-dept-name-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Department Code</label>
                <input
                  type="text"
                  placeholder="e.g. FIN"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 font-mono"
                  id="add-dept-code-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Department Head / Approver</label>
                <select
                  value={deptHeadId}
                  onChange={(e) => setDeptHeadId(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs cursor-pointer"
                  id="add-dept-head-input"
                >
                  <option value="">-- No Head Assigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  placeholder="Describe the department responsibilities..."
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs h-20 focus:ring-1 focus:ring-blue-500"
                  id="add-dept-desc-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={deptStatus}
                  onChange={(e) => setDeptStatus(e.target.value as any)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs cursor-pointer font-bold text-slate-700"
                  id="add-dept-status-input"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDeptModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer text-xs"
                  id="add-dept-submit-btn"
                >
                  Create Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT DEPARTMENT MODAL --- */}
      {showEditDeptModal && selectedDeptToEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" id="edit-dept-modal">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Edit Department: {selectedDeptToEdit.department_name}</h3>
              <button onClick={() => setShowEditDeptModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleEditDeptSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finance"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500"
                  id="edit-dept-name-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Department Code</label>
                <input
                  type="text"
                  placeholder="e.g. FIN"
                  value={deptCode}
                  onChange={(e) => setDeptCode(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs focus:ring-1 focus:ring-blue-500 font-mono"
                  id="edit-dept-code-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Department Head / Approver</label>
                <select
                  value={deptHeadId}
                  onChange={(e) => setDeptHeadId(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs cursor-pointer"
                  id="edit-dept-head-input"
                >
                  <option value="">-- No Head Assigned --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  placeholder="Describe the department responsibilities..."
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs h-20 focus:ring-1 focus:ring-blue-500"
                  id="edit-dept-desc-input"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={deptStatus}
                  onChange={(e) => setDeptStatus(e.target.value as any)}
                  className="w-full bg-white border rounded-lg p-2.5 text-xs cursor-pointer font-bold text-slate-700"
                  id="edit-dept-status-input"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                {deptStatus === 'Inactive' && users.filter(u => u.departmentId === selectedDeptToEdit.id).length > 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">
                    ⚠️ Deactivating this department will trigger warning highlights on the {users.filter(u => u.departmentId === selectedDeptToEdit.id).length} employee profiles currently assigned to it.
                  </p>
                )}
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditDeptModal(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer text-xs"
                  id="edit-dept-submit-btn"
                >
                  Save Department Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
