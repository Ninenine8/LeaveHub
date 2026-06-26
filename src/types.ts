/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'admin' | 'manager' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  departmentId?: string;
  joinDate: string; // mapping to join_date
  isActive: boolean;
  managerId?: string; // Approver ID
  managerName?: string;
  hasChildcareEligible: boolean; // Singapore: childcare leave eligibility
  passwordHash?: string;
  salt?: string;

  // New probation and tracking fields
  mobile?: string;
  title?: string;
  type?: 'Full-time' | 'Part-time' | 'Contract';
  employment_status?: 'Active' | 'Inactive';
  
  first_login_at?: string;
  last_login_at?: string;
  probation_required?: boolean;
  probation_period_value?: number;
  probation_period_unit?: 'Days' | 'Months';
  probation_start_date?: string;
  probation_end_date?: string;
  confirmation_date?: string;
  confirmation_status?: 'On Probation' | 'Confirmed' | 'Extended' | 'Failed Probation' | 'Not Applicable';
  probation_extended?: boolean;
  probation_extension_reason?: string;
}

export type LeaveType = 'annual' | 'sick' | 'hospitalisation' | 'childcare' | 'unpaid' | 'other';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveApplication {
  id: string;
  userId: string;
  userName: string;
  department: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isHalfDay: boolean;
  halfDaySession?: 'AM' | 'PM';
  requestedDays: number; // calculated working days (excluding weekends & PHs)
  reason: string;
  attachmentName?: string;
  status: LeaveStatus;
  createdAt: string;
  managerId: string;
  managerName?: string;
  managerComments?: string;
  actionedAt?: string;
}

export interface LeaveBalance {
  userId: string;
  // Annual Leave
  annualEntitled: number;
  annualCarriedForward: number;
  annualUsed: number;
  annualPending: number;
  // Outpatient Sick Leave
  sickEntitled: number;
  sickUsed: number;
  sickPending: number;
  // Hospitalisation Leave
  hospEntitled?: number;
  hospUsed?: number;
  hospPending?: number;
  // Childcare Leave (usually 6 days in Singapore if eligible)
  childcareEntitled: number;
  childcareUsed: number;
  childcarePending: number;
  // Unpaid Leave (no entitlement cap, just tracker)
  unpaidUsed: number;
  // Other Leave
  otherUsed: number;

  // New Singapore Proration & Calculation Breakdown Fields
  leaveYear?: number;
  annualEntitledSystem?: number;
  annualEntitledOverridden?: boolean;
  completedMonths?: number;
  roundingRuleUsed?: 'none' | 'down-05' | 'up-05' | 'nearest-whole' | 'up-whole';
  annualManualAdjustment?: number;
}

export interface PublicHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  isCustom?: boolean;
}

export interface Notification {
  id: string;
  userId: string; // recipient
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: 'submission' | 'approval' | 'rejection' | 'cancellation' | 'alert';
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface CompanySettings {
  companyName?: string;
  annualLeaveCarryForwardMax: number;
  carryForwardExpiryMonth: number; // e.g. 3 for March 31st (SG custom)
  prorateNewJoiners: boolean;
  standardAnnualLeave: number;
  standardSickLeave: number;
  standardChildcareLeave: number;
  prorateRoundingRule?: 'none' | 'down-05' | 'up-05' | 'nearest-whole' | 'up-whole';
  grantMedicalOnConfirmation?: 'mom' | 'confirmation' | 'custom';
  customMedicalRule?: 'grant-5-sick' | 'grant-full' | 'grant-prorated-pre3' | 'require-manual';
  useDeptHeadAsDefaultApprover?: boolean;
}

export interface Department {
  id: string;
  company_id?: string;
  department_name: string;
  department_code: string;
  department_head_user_id?: string;
  description?: string;
  status: 'Active' | 'Inactive';
  created_at?: string;
  updated_at?: string;
}
