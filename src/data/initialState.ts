/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, LeaveApplication, LeaveBalance, CompanySettings, Notification, AuditLog, Department } from '../types';

export const initialUsers: User[] = [];

export const initialBalances: LeaveBalance[] = [];

export const initialApplications: LeaveApplication[] = [];

export const initialSettings: CompanySettings = {
  annualLeaveCarryForwardMax: 5,
  carryForwardExpiryMonth: 3, // March 31st (SG default standard practice)
  prorateNewJoiners: true,
  standardAnnualLeave: 14,
  standardSickLeave: 14,
  standardChildcareLeave: 6,
  prorateRoundingRule: 'nearest-whole',
  grantMedicalOnConfirmation: 'mom',
  customMedicalRule: 'grant-5-sick',
  useDeptHeadAsDefaultApprover: true
};

export const initialNotifications: Notification[] = [];

export const initialAuditLogs: AuditLog[] = [];

// Local Storage Keys
const USERS_KEY = 'lh_users';
const BALANCES_KEY = 'lh_balances';
const APPLICATIONS_KEY = 'lh_applications';
const SETTINGS_KEY = 'lh_settings';
const NOTIFICATIONS_KEY = 'lh_notifications';
const AUDIT_LOGS_KEY = 'lh_audit_logs';
const HOLIDAYS_KEY = 'lh_holidays';
const DEPARTMENTS_KEY = 'lh_departments';

export const loadData = () => {
  const users = localStorage.getItem(USERS_KEY);
  const balances = localStorage.getItem(BALANCES_KEY);
  const applications = localStorage.getItem(APPLICATIONS_KEY);
  const settings = localStorage.getItem(SETTINGS_KEY);
  const notifications = localStorage.getItem(NOTIFICATIONS_KEY);
  const auditLogs = localStorage.getItem(AUDIT_LOGS_KEY);
  const holidays = localStorage.getItem(HOLIDAYS_KEY);
  const departments = localStorage.getItem(DEPARTMENTS_KEY);

  return {
    users: users ? JSON.parse(users) : initialUsers,
    balances: balances ? JSON.parse(balances) : initialBalances,
    applications: applications ? JSON.parse(applications) : initialApplications,
    settings: settings ? JSON.parse(settings) : initialSettings,
    notifications: notifications ? JSON.parse(notifications) : initialNotifications,
    auditLogs: auditLogs ? JSON.parse(auditLogs) : initialAuditLogs,
    holidays: holidays ? JSON.parse(holidays) : [], // Will merge with Singapore initial list
    departments: departments ? JSON.parse(departments) : []
  };
};

export const saveData = (data: {
  users?: User[];
  balances?: LeaveBalance[];
  applications?: LeaveApplication[];
  settings?: CompanySettings;
  notifications?: Notification[];
  auditLogs?: AuditLog[];
  holidays?: any[];
  departments?: Department[];
}) => {
  if (data.users) localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
  if (data.balances) localStorage.setItem(BALANCES_KEY, JSON.stringify(data.balances));
  if (data.applications) localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(data.applications));
  if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
  if (data.notifications) localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(data.notifications));
  if (data.auditLogs) localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(data.auditLogs));
  if (data.holidays) localStorage.setItem(HOLIDAYS_KEY, JSON.stringify(data.holidays));
  if (data.departments) localStorage.setItem(DEPARTMENTS_KEY, JSON.stringify(data.departments));
};
