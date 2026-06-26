/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, LeaveApplication, LeaveBalance, CompanySettings, PublicHoliday, Notification, AuditLog, LeaveType, Department } from './types';
import { loadData, saveData } from './data/initialState';
import { calculateWorkingDays, initialPublicHolidays } from './data/singaporeHolidays';
import { translations } from './data/translations';
import { calculateProratedLeave, calculateMedicalEntitlements } from './utils/leaveProration';
import RoleSelector from './components/RoleSelector';
import CalendarView from './components/CalendarView';
import NewApplicationModal from './components/NewApplicationModal';
import ManagerView from './components/ManagerView';
import AdminView from './components/AdminView';
import ReportsView from './components/ReportsView';
import HistoryView from './components/HistoryView';

// Icons
import {
  Calendar,
  Users,
  Settings,
  LogOut,
  Bell,
  FileText,
  Layers,
  BarChart3,
  PlusCircle,
  Clock,
  UserCheck,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Compass,
  Briefcase,
  Activity,
  Award,
  AlertCircle,
  Building
} from 'lucide-react';

type ViewMode = 'dashboard' | 'apply' | 'history' | 'manager' | 'calendar' | 'admin' | 'reports';

// Calculate the length of service from Join Date
export const calculateLengthOfService = (joinDateStr: string) => {
  if (!joinDateStr) return 'N/A';
  const start = new Date(joinDateStr);
  const end = new Date(); // current local date
  if (isNaN(start.getTime())) return 'N/A';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

  return parts.join(', ');
};

// Calculate probation status label
export const getProbationStatusLabel = (user: User) => {
  if (user.probation_required === false) return 'Confirmed';
  if (user.probation_extended) return 'Probation Extended';
  
  if (user.confirmation_status) {
    if (user.confirmation_status === 'Confirmed') return 'Confirmed';
    if (user.confirmation_status === 'Extended') return 'Probation Extended';
    if (user.confirmation_status === 'Failed Probation') return 'Failed Probation';
    if (user.confirmation_status === 'Not Applicable') return 'Not Applicable';
  }

  if (user.probation_end_date) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (todayStr > user.probation_end_date) {
      return 'Confirmed';
    }
  }

  return 'On Probation';
};

export default function App() {
  // Database States
  const [users, setUsers] = useState<User[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [settings, setSettings] = useState<CompanySettings>({} as CompanySettings);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Language state
  const [lang, setLang] = useState<'en' | 'zh'>(() => (localStorage.getItem('leavehub_lang') as 'en' | 'zh') || 'en');
  
  const toggleLanguage = () => {
    const nextLang = lang === 'en' ? 'zh' : 'en';
    setLang(nextLang);
    localStorage.setItem('leavehub_lang', nextLang);
  };

  const t = translations[lang];

  // User Session States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('leavehub_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // First Admin Setup form states
  const [setupCompanyName, setSetupCompanyName] = useState<string>('');
  const [setupAdminName, setSetupAdminName] = useState<string>('');
  const [setupAdminEmail, setSetupAdminEmail] = useState<string>('');
  const [setupPassword, setSetupPassword] = useState<string>('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState<string>('');
  const [setupError, setSetupError] = useState<string | null>(null);

  // User Registration form states
  const [loginTab, setLoginTab] = useState<'login' | 'register'>('login');
  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regRole, setRegRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [regDept, setRegDept] = useState<string>('Engineering');
  const [regChildcare, setRegChildcare] = useState<boolean>(false);
  const [regManagerId, setRegManagerId] = useState<string>('');

  // Layout / Navigation States
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [showApplyModal, setShowApplyModal] = useState<boolean>(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showDevSwitch, setShowDevSwitch] = useState<boolean>(false);

  // Fetch state from dynamic Express backend
  const fetchStateFromServer = async (isFirstLoad = false) => {
    try {
      const res = await fetch('/api/db');
      if (!res.ok) throw new Error('Failed to load database');
      const db = await res.json();
      
      setUsers(db.users);
      setBalances(db.balances);
      setApplications(db.applications);
      setSettings(db.settings);
      setNotifications(db.notifications);
      setAuditLogs(db.auditLogs);
      setHolidays(db.holidays);
      setDepartments(db.departments || []);
    } catch (e) {
      console.error('Error connecting to server, falling back to local/static database:', e);
      // Try to fetch static database file fallback for Netlify static host
      try {
        const staticRes = await fetch('/server-db.json');
        if (staticRes.ok) {
          const contentType = staticRes.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const db = await staticRes.json();
            
            // Re-map db to match if it doesn't exist in local storage yet
            const localUsers = localStorage.getItem('lh_users');
            if (!localUsers) {
              // First time on Netlify, load from the server-db JSON file!
              setUsers(db.users);
              setBalances(db.balances);
              setApplications(db.applications);
              setSettings(db.settings);
              setNotifications(db.notifications);
              setAuditLogs(db.auditLogs);
              setHolidays(db.holidays || []);
              setDepartments(db.departments || []);
              
              // Persist locally
              saveData({
                users: db.users,
                balances: db.balances,
                applications: db.applications,
                settings: db.settings,
                notifications: db.notifications,
                auditLogs: db.auditLogs,
                holidays: db.holidays || [],
                departments: db.departments || []
              });
              return;
            }
          }
        }
      } catch (staticErr) {
        console.error('Error loading static fallback database:', staticErr);
      }

      // Default localStorage load
      const db = loadData();
      setUsers(db.users);
      setBalances(db.balances);
      setApplications(db.applications);
      setSettings(db.settings);
      setNotifications(db.notifications);
      setAuditLogs(db.auditLogs);
      if (db.holidays.length === 0) {
        setHolidays(initialPublicHolidays);
      } else {
        setHolidays(db.holidays);
      }
      setDepartments(db.departments || []);
    }
  };

  // Initialize Database and set up real-time polling interval
  useEffect(() => {
    fetchStateFromServer(true);
    
    // Poll the backend every 3 seconds to keep UI synced in real-time
    const interval = setInterval(() => {
      fetchStateFromServer();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Save changes wrapper
  const persistState = async (updates: {
    users?: User[];
    balances?: LeaveBalance[];
    applications?: LeaveApplication[];
    settings?: CompanySettings;
    notifications?: Notification[];
    auditLogs?: AuditLog[];
    holidays?: PublicHoliday[];
    departments?: Department[];
  }) => {
    // Optimistically update frontend states
    if (updates.users) setUsers(updates.users);
    if (updates.balances) setBalances(updates.balances);
    if (updates.applications) setApplications(updates.applications);
    if (updates.settings) setSettings(updates.settings);
    if (updates.notifications) setNotifications(updates.notifications);
    if (updates.auditLogs) setAuditLogs(updates.auditLogs);
    if (updates.holidays) setHolidays(updates.holidays);
    if (updates.departments) setDepartments(updates.departments);

    // Save to localStorage for robust offline/client fallback
    saveData(updates);

    // Persist to server
    try {
      await fetch('/api/db/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.error('Failed to persist state on server:', e);
    }
  };

  // --- ACTIONS ---

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailTrimmed = regEmail.trim().toLowerCase();
    if (!emailTrimmed) {
      setLoginError('Please enter a valid corporate or personal email.');
      return;
    }

    if (!regName.trim()) {
      setLoginError('Please enter your full name.');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setLoginError(lang === 'zh' ? '密码长度不能少于6位。' : 'Password must be at least 6 characters long.');
      return;
    }

    const selectedManager = users.find(u => u.id === regManagerId);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: emailTrimmed,
          role: regRole,
          department: regDept,
          joinDate: new Date().toISOString().split('T')[0],
          isActive: true,
          hasChildcareEligible: regChildcare,
          managerId: regManagerId || undefined,
          managerName: selectedManager ? selectedManager.name : undefined,
          password: regPassword,
          initialBal: {
            annualEntitled: settings.standardAnnualLeave,
            sickEntitled: settings.standardSickLeave,
            childcareEntitled: regChildcare ? settings.standardChildcareLeave : 0
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed.');
      }

      // Sync frontend users list and log user in
      await fetchStateFromServer();
      setCurrentUser(data.user);
      localStorage.setItem('leavehub_session', JSON.stringify(data.user));
      setCurrentView('dashboard');
      
      // Reset form states
      setRegName('');
      setRegEmail('');
      setRegPassword('');
      setRegRole('employee');
      setRegDept('Engineering');
      setRegChildcare(false);
      setRegManagerId('');
    } catch (err: any) {
      console.warn('Backend registration failed, trying client-side local fallback:', err);
      try {
        const existing = users.find(u => u.email.trim().toLowerCase() === emailTrimmed);
        if (existing) {
          throw new Error('Email already registered.');
        }

        const newUserId = `usr_${Date.now()}`;
        const newUser: User = {
          id: newUserId,
          name: regName.trim(),
          email: emailTrimmed,
          role: regRole,
          department: regDept,
          joinDate: new Date().toISOString().split('T')[0],
          isActive: true,
          hasChildcareEligible: regChildcare,
          managerId: regManagerId || undefined,
          managerName: selectedManager ? selectedManager.name : undefined,
          confirmation_status: 'Confirmed',
          confirmation_date: new Date().toISOString().split('T')[0]
        };

        const newBal: LeaveBalance = {
          userId: newUserId,
          annualEntitled: settings.standardAnnualLeave || 14,
          annualCarriedForward: 0,
          annualUsed: 0,
          annualPending: 0,
          sickEntitled: settings.standardSickLeave || 14,
          sickUsed: 0,
          sickPending: 0,
          childcareEntitled: regChildcare ? (settings.standardChildcareLeave || 6) : 0,
          childcareUsed: 0,
          childcarePending: 0,
          unpaidUsed: 0,
          otherUsed: 0
        };

        const updatedUsers = [...users, newUser];
        const updatedBalances = [...balances, newBal];

        const initialLog: AuditLog = {
          id: `log_${Date.now()}`,
          actorId: newUserId,
          actorName: regName.trim(),
          action: 'Register',
          details: `User registered locally: ${regName.trim()} (${emailTrimmed})`,
          timestamp: new Date().toISOString()
        };

        persistState({
          users: updatedUsers,
          balances: updatedBalances,
          auditLogs: [...auditLogs, initialLog]
        });

        setCurrentUser(newUser);
        localStorage.setItem('leavehub_session', JSON.stringify(newUser));
        setCurrentView('dashboard');

        // Reset form states
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setRegRole('employee');
        setRegDept('Engineering');
        setRegChildcare(false);
        setRegManagerId('');
      } catch (fallbackErr: any) {
        setLoginError(fallbackErr.message);
      }
    }
  };

  // Custom User Credentials Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginEmail.trim()) {
      setLoginError('Email is required.');
      return;
    }

    if (!loginPassword) {
      setLoginError('Password is required.');
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      setCurrentUser(data.user);
      localStorage.setItem('leavehub_session', JSON.stringify(data.user));
      setCurrentView('dashboard');
      setLoginEmail('');
      setLoginPassword('');
    } catch (err: any) {
      console.warn('Backend login failed, attempting client-side authentication:', err);
      const match = users.find(u => u.email.trim().toLowerCase() === loginEmail.trim().toLowerCase());
      if (match) {
        // Log in the user directly in static demo mode
        setCurrentUser(match);
        localStorage.setItem('leavehub_session', JSON.stringify(match));
        setCurrentView('dashboard');
        setLoginEmail('');
        setLoginPassword('');
      } else {
        setLoginError(lang === 'zh' ? '用户名或密码不正确。' : 'Invalid email or password.');
      }
    }
  };

  const handleFirstAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);

    if (setupPassword !== setupConfirmPassword) {
      setSetupError(lang === 'zh' ? '两次输入的密码不一致。' : 'Passwords do not match.');
      return;
    }

    if (setupPassword.length < 6) {
      setSetupError(lang === 'zh' ? '密码长度不能少于 6 位。' : 'Password must be at least 6 characters long.');
      return;
    }

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: setupCompanyName.trim(),
          name: setupAdminName.trim(),
          email: setupAdminEmail.trim(),
          password: setupPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Setup failed.');
      }

      await fetchStateFromServer();
      setCurrentUser(data.user);
      localStorage.setItem('leavehub_session', JSON.stringify(data.user));
      setCurrentView('dashboard');
      
      // Clean form states
      setSetupCompanyName('');
      setSetupAdminName('');
      setSetupAdminEmail('');
      setSetupPassword('');
      setSetupConfirmPassword('');
    } catch (err: any) {
      console.warn('Backend setup failed, trying client-side local setup:', err);
      try {
        const adminId = `usr_admin_${Date.now()}`;
        const adminUser: User = {
          id: adminId,
          name: setupAdminName.trim(),
          email: setupAdminEmail.trim().toLowerCase(),
          role: 'admin',
          department: 'Human Resources',
          joinDate: new Date().toISOString().split('T')[0],
          isActive: true,
          hasChildcareEligible: false,
          confirmation_status: 'Confirmed',
          confirmation_date: new Date().toISOString().split('T')[0]
        };

        const initialBal: LeaveBalance = {
          userId: adminId,
          annualEntitled: 21,
          annualCarriedForward: 0,
          annualUsed: 0,
          annualPending: 0,
          sickEntitled: 14,
          sickUsed: 0,
          sickPending: 0,
          childcareEntitled: 0,
          childcareUsed: 0,
          childcarePending: 0,
          unpaidUsed: 0,
          otherUsed: 0
        };

        const defaultDepts: Department[] = [
          { id: 'dept_hr', department_name: 'Human Resources', department_code: 'HR', status: 'Active', department_head_user_id: adminId },
          { id: 'dept_finance', department_name: 'Finance', department_code: 'FIN', status: 'Active' },
          { id: 'dept_admin', department_name: 'Administration', department_code: 'ADM', status: 'Active' },
          { id: 'dept_sales', department_name: 'Sales', department_code: 'SLS', status: 'Active' },
          { id: 'dept_marketing', department_name: 'Marketing', department_code: 'MKT', status: 'Active' },
          { id: 'dept_it', department_name: 'IT / Technology', department_code: 'IT', status: 'Active' },
          { id: 'dept_mgmt', department_name: 'Management', department_code: 'MGMT', status: 'Active' }
        ];

        const initialCompanySettings: CompanySettings = {
          companyName: setupCompanyName.trim(),
          annualLeaveCarryForwardMax: 5,
          carryForwardExpiryMonth: 3,
          prorateNewJoiners: true,
          standardAnnualLeave: 14,
          standardSickLeave: 14,
          standardChildcareLeave: 6,
          prorateRoundingRule: 'nearest-whole',
          grantMedicalOnConfirmation: 'mom',
          customMedicalRule: 'grant-5-sick',
          useDeptHeadAsDefaultApprover: true
        };

        const initialLog: AuditLog = {
          id: `log_${Date.now()}`,
          actorId: adminId,
          actorName: setupAdminName.trim(),
          action: 'Company Setup',
          details: `First admin account created locally for ${setupCompanyName.trim()}: ${setupAdminName.trim()} (${setupAdminEmail.trim()})`,
          timestamp: new Date().toISOString()
        };

        const initialDb = {
          users: [adminUser],
          balances: [initialBal],
          applications: [],
          settings: initialCompanySettings,
          notifications: [],
          auditLogs: [initialLog],
          holidays: initialPublicHolidays,
          departments: defaultDepts
        };

        // Save local
        saveData(initialDb);

        // Update react state
        setUsers(initialDb.users);
        setBalances(initialDb.balances);
        setApplications([]);
        setSettings(initialDb.settings);
        setNotifications([]);
        setAuditLogs(initialDb.auditLogs);
        setHolidays(initialDb.holidays);
        setDepartments(initialDb.departments);

        setCurrentUser(adminUser);
        localStorage.setItem('leavehub_session', JSON.stringify(adminUser));
        setCurrentView('dashboard');

        // Clean form states
        setSetupCompanyName('');
        setSetupAdminName('');
        setSetupAdminEmail('');
        setSetupPassword('');
        setSetupConfirmPassword('');
      } catch (fallbackErr: any) {
        setSetupError('Client setup failed: ' + fallbackErr.message);
      }
    }
  };

  const handleSeedDatabase = async () => {
    try {
      const res = await fetch('/api/db/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Seeding failed');
      await fetchStateFromServer();
      
      // Auto login as Sarah Tan (Seeded Admin) or first admin
      const freshRes = await fetch('/api/db');
      const freshDb = await freshRes.json();
      const seededAdmin = freshDb.users.find((u: any) => u.role === 'admin');
      if (seededAdmin) {
        setCurrentUser(seededAdmin);
        localStorage.setItem('leavehub_session', JSON.stringify(seededAdmin));
      }
      setCurrentView('dashboard');
    } catch (err: any) {
      console.warn('Backend seed failed, attempting client-side static seed:', err);
      try {
        const staticRes = await fetch('/server-db.json');
        if (staticRes.ok) {
          const contentType = staticRes.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const db = await staticRes.json();
            
            // Save local
            saveData({
              users: db.users,
              balances: db.balances,
              applications: db.applications,
              settings: db.settings,
              notifications: db.notifications,
              auditLogs: db.auditLogs,
              holidays: db.holidays || [],
              departments: db.departments || []
            });

            // Update state
            setUsers(db.users);
            setBalances(db.balances);
            setApplications(db.applications);
            setSettings(db.settings);
            setNotifications(db.notifications);
            setAuditLogs(db.auditLogs);
            setHolidays(db.holidays || []);
            setDepartments(db.departments || []);

            // Auto-login as Sarah Tan or first admin found
            const admin = db.users.find((u: any) => u.role === 'admin') || db.users[0];
            if (admin) {
              setCurrentUser(admin);
              localStorage.setItem('leavehub_session', JSON.stringify(admin));
            }
            setCurrentView('dashboard');
            return;
          }
        }
        throw new Error('Static database file not available or invalid format.');
      } catch (fallbackErr: any) {
        alert('Failed to seed database client-side: ' + fallbackErr.message);
      }
    }
  };

  const handleResetDatabase = async () => {
    try {
      const res = await fetch('/api/db/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      await fetchStateFromServer();
      handleLogout();
    } catch (err: any) {
      console.warn('Backend reset failed, resetting client-side local database:', err);
      try {
        // Clear local storage keys
        localStorage.removeItem('lh_users');
        localStorage.removeItem('lh_balances');
        localStorage.removeItem('lh_applications');
        localStorage.removeItem('lh_settings');
        localStorage.removeItem('lh_notifications');
        localStorage.removeItem('lh_audit_logs');
        localStorage.removeItem('lh_holidays');
        localStorage.removeItem('lh_departments');
        localStorage.removeItem('leavehub_session');

        // Reset state
        setUsers([]);
        setBalances([]);
        setApplications([]);
        setSettings({} as CompanySettings);
        setNotifications([]);
        setAuditLogs([]);
        setHolidays(initialPublicHolidays);
        setDepartments([]);

        handleLogout();
      } catch (fallbackErr: any) {
        alert('Failed to reset database client-side: ' + fallbackErr.message);
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('leavehub_session');
    setCurrentView('dashboard');
    setMobileMenuOpen(false);
  };

  // Switch demo user from top-header quick widget
  const handleQuickSwitchUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('leavehub_session', JSON.stringify(user));
    // If we transition to employee, and we were on admin tabs, reset to dashboard
    if (user.role === 'employee' && (currentView === 'admin' || currentView === 'reports' || currentView === 'manager')) {
      setCurrentView('dashboard');
    }
    // If we transition to manager and were on admin tab, reset to manager or dashboard
    if (user.role === 'manager' && currentView === 'admin') {
      setCurrentView('manager');
    }
  };

  // Apply Leave Submission Handler
  const handleApplyLeaveSubmit = (leaveData: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    isHalfDay: boolean;
    halfDaySession?: 'AM' | 'PM';
    requestedDays: number;
    reason: string;
    attachmentName?: string;
  }) => {
    if (!currentUser) return;

    const newAppId = `app_${Date.now()}`;
    const newApplication: LeaveApplication = {
      id: newAppId,
      userId: currentUser.id,
      userName: currentUser.name,
      department: currentUser.department,
      leaveType: leaveData.leaveType,
      startDate: leaveData.startDate,
      endDate: leaveData.endDate,
      isHalfDay: leaveData.isHalfDay,
      halfDaySession: leaveData.halfDaySession,
      requestedDays: leaveData.requestedDays,
      reason: leaveData.reason,
      attachmentName: leaveData.attachmentName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      managerId: currentUser.managerId || 'usr_1', // default HR approves if no manager
      managerName: currentUser.managerName || 'Sarah Tan'
    };

    // Update applicant's pending leave balances
    const updatedBalances = balances.map(b => {
      if (b.userId === currentUser.id) {
        if (leaveData.leaveType === 'annual') {
          return { ...b, annualPending: b.annualPending + leaveData.requestedDays };
        } else if (leaveData.leaveType === 'sick') {
          return { ...b, sickPending: b.sickPending + leaveData.requestedDays };
        } else if (leaveData.leaveType === 'hospitalisation') {
          return { ...b, hospPending: (b.hospPending || 0) + leaveData.requestedDays };
        } else if (leaveData.leaveType === 'childcare') {
          return { ...b, childcarePending: b.childcarePending + leaveData.requestedDays };
        }
      }
      return b;
    });

    // Notify assigned manager
    const newNotifId = `nt_${Date.now()}`;
    const managerNotif: Notification = {
      id: newNotifId,
      userId: currentUser.managerId || 'usr_1',
      title: 'New Leave Request',
      message: `${currentUser.name} requested ${leaveData.requestedDays} days of ${leaveData.leaveType.toUpperCase()} leave (${leaveData.startDate} to ${leaveData.endDate}).`,
      isRead: false,
      createdAt: new Date().toISOString(),
      type: 'submission'
    };

    // Audit Trail
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Apply Leave',
      details: `Submitted ${leaveData.requestedDays} days ${leaveData.leaveType.toUpperCase()} leave request (${leaveData.startDate} to ${leaveData.endDate}).`,
      timestamp: new Date().toISOString()
    };

    persistState({
      applications: [...applications, newApplication],
      balances: updatedBalances,
      notifications: [...notifications, managerNotif],
      auditLogs: [...auditLogs, newAuditLog]
    });

    // Confirmation Toast Simulation Alert
    alert(`Successfully applied! A confirmation notification has been sent to your approver: ${newApplication.managerName}.`);
    setCurrentView('history');
  };

  // Manager Approve or Reject Handler
  const handleManagerAction = (applicationId: string, status: 'approved' | 'rejected', comment: string) => {
    if (!currentUser) return;

    const request = applications.find(a => a.id === applicationId);
    if (!request) return;

    // Update application state
    const updatedApps = applications.map(app => {
      if (app.id === applicationId) {
        return {
          ...app,
          status,
          managerComments: comment,
          actionedAt: new Date().toISOString()
        };
      }
      return app;
    });

    // Adjust leave balance
    const updatedBalances = balances.map(b => {
      if (b.userId === request.userId) {
        const days = request.requestedDays;
        
        if (request.leaveType === 'annual') {
          return {
            ...b,
            annualPending: Math.max(0, b.annualPending - days),
            annualUsed: status === 'approved' ? b.annualUsed + days : b.annualUsed
          };
        } else if (request.leaveType === 'sick') {
          return {
            ...b,
            sickPending: Math.max(0, b.sickPending - days),
            sickUsed: status === 'approved' ? b.sickUsed + days : b.sickUsed
          };
        } else if (request.leaveType === 'hospitalisation') {
          return {
            ...b,
            hospPending: Math.max(0, (b.hospPending || 0) - days),
            hospUsed: status === 'approved' ? (b.hospUsed || 0) + days : (b.hospUsed || 0)
          };
        } else if (request.leaveType === 'childcare') {
          return {
            ...b,
            childcarePending: Math.max(0, b.childcarePending - days),
            childcareUsed: status === 'approved' ? b.childcareUsed + days : b.childcareUsed
          };
        } else if (request.leaveType === 'unpaid') {
          return {
            ...b,
            unpaidUsed: status === 'approved' ? b.unpaidUsed + days : b.unpaidUsed
          };
        } else if (request.leaveType === 'other') {
          return {
            ...b,
            otherUsed: status === 'approved' ? b.otherUsed + days : b.otherUsed
          };
        }
      }
      return b;
    });

    // Notify Employee
    const employeeNotif: Notification = {
      id: `nt_${Date.now()}`,
      userId: request.userId,
      title: `Leave Request ${status.toUpperCase()}`,
      message: `Your request for ${request.requestedDays} days of ${request.leaveType.toUpperCase()} leave starting ${request.startDate} has been ${status} by ${currentUser.name}.`,
      isRead: false,
      createdAt: new Date().toISOString(),
      type: status === 'approved' ? 'approval' : 'rejection'
    };

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: status === 'approved' ? 'Approve Leave' : 'Reject Leave',
      details: `${status === 'approved' ? 'Approved' : 'Rejected'} ${request.userName}'s leave request for ${request.requestedDays} days of ${request.leaveType.toUpperCase()}. Comments: "${comment}"`,
      timestamp: new Date().toISOString()
    };

    persistState({
      applications: updatedApps,
      balances: updatedBalances,
      notifications: [...notifications, employeeNotif],
      auditLogs: [...auditLogs, newAuditLog]
    });
  };

  // Self Service Cancel Request Handler
  const handleCancelRequest = (applicationId: string) => {
    if (!currentUser) return;

    const request = applications.find(a => a.id === applicationId);
    if (!request || request.status !== 'pending') return;

    // Set status to cancelled
    const updatedApps = applications.map(app => {
      if (app.id === applicationId) {
        return { ...app, status: 'cancelled' as const };
      }
      return app;
    });

    // Restore pending balance
    const updatedBalances = balances.map(b => {
      if (b.userId === currentUser.id) {
        const days = request.requestedDays;
        if (request.leaveType === 'annual') {
          return { ...b, annualPending: Math.max(0, b.annualPending - days) };
        } else if (request.leaveType === 'sick') {
          return { ...b, sickPending: Math.max(0, b.sickPending - days) };
        } else if (request.leaveType === 'hospitalisation') {
          return { ...b, hospPending: Math.max(0, (b.hospPending || 0) - days) };
        } else if (request.leaveType === 'childcare') {
          return { ...b, childcarePending: Math.max(0, b.childcarePending - days) };
        }
      }
      return b;
    });

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Cancel Leave Request',
      details: `Cancelled pending leave request for ${request.requestedDays} days of ${request.leaveType.toUpperCase()}.`,
      timestamp: new Date().toISOString()
    };

    persistState({
      applications: updatedApps,
      balances: updatedBalances,
      auditLogs: [...auditLogs, newAuditLog]
    });
  };

  // Add employee profile
  const handleAddEmployee = (userFields: Omit<User, 'id'>, initialBal: Partial<LeaveBalance>) => {
    if (!currentUser) return;

    const newUserId = `usr_${Date.now()}`;
    const newUser: User = {
      id: newUserId,
      ...userFields
    };

    const newBalance: LeaveBalance = {
      userId: newUserId,
      annualEntitled: initialBal.annualEntitled || 14,
      annualCarriedForward: 0,
      annualUsed: 0,
      annualPending: 0,
      sickEntitled: initialBal.sickEntitled || 14,
      sickUsed: 0,
      sickPending: 0,
      childcareEntitled: initialBal.childcareEntitled || 0,
      childcareUsed: 0,
      childcarePending: 0,
      unpaidUsed: 0,
      otherUsed: 0
    };

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Create Employee',
      details: `Created new employee profile: ${newUser.name} (${newUser.department}, ${newUser.role.toUpperCase()}) with starting ${newBalance.annualEntitled} AL.`,
      timestamp: new Date().toISOString()
    };

    persistState({
      users: [...users, newUser],
      balances: [...balances, newBalance],
      auditLogs: [...auditLogs, newAuditLog]
    });

    alert(`Successfully added ${newUser.name} to LeaveHub SG!`);
  };

  // Update employee details (e.g. deactivate)
  const handleUpdateEmployee = (userId: string, updatedFields: Partial<User>, updatedBalanceFields?: Partial<LeaveBalance>) => {
    if (!currentUser) return;

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const updatedUsers = users.map(u => {
      if (u.id === userId) {
        return { ...u, ...updatedFields };
      }
      return u;
    });

    // Detect specific changes for Audit Log
    const changes: string[] = [];
    if (updatedFields.joinDate !== undefined && updatedFields.joinDate !== targetUser.joinDate) {
      changes.push(`Join Date changed from "${targetUser.joinDate || 'N/A'}" to "${updatedFields.joinDate}"`);
    }

    // Recalculate or apply direct balance fields
    let updatedBalances = balances;
    if (updatedBalanceFields) {
      updatedBalances = balances.map(b => {
        if (b.userId === userId) {
          return { ...b, ...updatedBalanceFields };
        }
        return b;
      });
      if (updatedBalanceFields.annualEntitled !== undefined) {
        changes.push(`Annual Leave Entitlement updated to ${updatedBalanceFields.annualEntitled} days`);
      }
      if (updatedBalanceFields.annualManualAdjustment !== undefined) {
        changes.push(`Manual Adjustment updated to ${updatedBalanceFields.annualManualAdjustment} days`);
      }
    } else if (updatedFields.joinDate !== undefined && updatedFields.joinDate !== targetUser.joinDate) {
      if (settings.prorateNewJoiners) {
        const jd = updatedFields.joinDate;
        const year = new Date(jd).getFullYear();
        const baseAL = settings.standardAnnualLeave || 14;
        const rounding = settings.prorateRoundingRule || 'none';
        
        const proration = calculateProratedLeave(jd, baseAL, year, rounding);
        
        updatedBalances = balances.map(b => {
          if (b.userId === userId) {
            return { 
              ...b, 
              annualEntitled: proration.roundedCalculated,
              annualEntitledSystem: proration.systemCalculated,
              completedMonths: proration.completedMonths,
              roundingRuleUsed: rounding,
              leaveYear: year,
              annualEntitledOverridden: false
            };
          }
          return b;
        });
        changes.push(`Prorated Annual Leave entitlement automatically adjusted to ${proration.roundedCalculated} days`);
      }
    }

    if (updatedFields.probation_period_value !== undefined && updatedFields.probation_period_value !== targetUser.probation_period_value) {
      changes.push(`Probation Period changed from "${targetUser.probation_period_value || 'N/A'}" to "${updatedFields.probation_period_value}"`);
    }
    if (updatedFields.probation_period_unit !== undefined && updatedFields.probation_period_unit !== targetUser.probation_period_unit) {
      changes.push(`Probation Period Unit changed from "${targetUser.probation_period_unit || 'N/A'}" to "${updatedFields.probation_period_unit}"`);
    }
    if (updatedFields.probation_end_date !== undefined && updatedFields.probation_end_date !== targetUser.probation_end_date) {
      changes.push(`Probation End Date changed from "${targetUser.probation_end_date || 'N/A'}" to "${updatedFields.probation_end_date}"`);
    }
    if (updatedFields.confirmation_date !== undefined && updatedFields.confirmation_date !== targetUser.confirmation_date) {
      changes.push(`Confirmation Date changed from "${targetUser.confirmation_date || 'N/A'}" to "${updatedFields.confirmation_date}"`);
    }
    if (updatedFields.confirmation_status !== undefined && updatedFields.confirmation_status !== targetUser.confirmation_status) {
      changes.push(`Confirmation Status changed from "${targetUser.confirmation_status || 'N/A'}" to "${updatedFields.confirmation_status}"`);
    }
    if (updatedFields.isActive !== undefined && updatedFields.isActive !== targetUser.isActive) {
      changes.push(`Account Status changed from "${targetUser.isActive ? 'Active' : 'Inactive'}" to "${updatedFields.isActive ? 'Active' : 'Inactive'}"`);
    }
    if (updatedFields.employment_status !== undefined && updatedFields.employment_status !== targetUser.employment_status) {
      changes.push(`Employment Status changed from "${targetUser.employment_status || 'N/A'}" to "${updatedFields.employment_status}"`);
    }

    const isDeptChange = updatedFields.departmentId !== undefined && updatedFields.departmentId !== targetUser.departmentId;

    let actionDetails = `Updated profile details for ${targetUser.name}.`;
    if (isDeptChange) {
      actionDetails = `Changed department of ${targetUser.name} from "${targetUser.department || 'N/A'}" to "${updatedFields.department}".`;
    } else if (changes.length > 0) {
      actionDetails = `Updated details for ${targetUser.name}: ` + changes.join(', ') + '.';
    } else if (updatedFields.isActive === false) {
      actionDetails = `Deactivated employee profile for ${targetUser.name}.`;
    } else if (updatedFields.isActive === true) {
      actionDetails = `Re-activated employee profile for ${targetUser.name}.`;
    }

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: isDeptChange ? 'Employee department changed' : 'Update Employee',
      details: actionDetails,
      timestamp: new Date().toISOString()
    };

    persistState({
      users: updatedUsers,
      balances: updatedBalances,
      auditLogs: [newAuditLog, ...auditLogs]
    });
  };

  // Manual Leave Balance adjustments
  const handleAdjustBalance = (userId: string, updates: Partial<LeaveBalance>) => {
    if (!currentUser) return;

    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const updatedBalances = balances.map(b => {
      if (b.userId === userId) {
        return { ...b, ...updates };
      }
      return b;
    });

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Adjust Balances',
      details: `Manually adjusted leave entitlements for ${targetUser.name}. New AL entitled: ${updates.annualEntitled}, Carried: ${updates.annualCarriedForward}, Sick: ${updates.sickEntitled}.`,
      timestamp: new Date().toISOString()
    };

    persistState({
      balances: updatedBalances,
      auditLogs: [...auditLogs, newAuditLog]
    });

    alert(`Leave balances adjusted successfully for ${targetUser.name}.`);
  };

  // Carry forward settings updates
  const handleUpdateSettings = (updatedSettings: CompanySettings) => {
    if (!currentUser) return;

    const medicalRuleText = updatedSettings.grantMedicalOnConfirmation === 'mom' 
      ? 'Follow MOM Minimum' 
      : updatedSettings.grantMedicalOnConfirmation === 'confirmation' 
      ? 'Grant medical leave on early confirmation' 
      : `Custom rule: ${updatedSettings.customMedicalRule}`;

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Update Policy',
      details: `Updated Singapore company leave policies: Max Carry-Forward = ${updatedSettings.annualLeaveCarryForwardMax} days. Prorate New Joiners = ${updatedSettings.prorateNewJoiners ? 'Yes' : 'No'}. Medical Leave Rule = ${medicalRuleText}.`,
      timestamp: new Date().toISOString()
    };

    persistState({
      settings: updatedSettings,
      auditLogs: [...auditLogs, newAuditLog]
    });

    alert('Singapore company-wide leave policies updated.');
  };

  // Add custom public holiday / off day
  const handleAddHoliday = (holiday: PublicHoliday) => {
    if (!currentUser) return;

    const duplicate = holidays.find(h => h.date === holiday.date);
    if (duplicate) {
      alert('A holiday already exists for this date.');
      return;
    }

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Add Custom Holiday',
      details: `Added company-wide off day: ${holiday.name} on ${holiday.date}.`,
      timestamp: new Date().toISOString()
    };

    persistState({
      holidays: [...holidays, holiday],
      auditLogs: [...auditLogs, newAuditLog]
    });
  };

  // Delete custom public holiday
  const handleDeleteHoliday = (date: string) => {
    if (!currentUser) return;

    const holiday = holidays.find(h => h.date === date);
    if (!holiday) return;

    // Audit Log
    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Delete Custom Holiday',
      details: `Removed custom off day: ${holiday.name} on ${date}.`,
      timestamp: new Date().toISOString()
    };

    persistState({
      holidays: holidays.filter(h => h.date !== date),
      auditLogs: [...auditLogs, newAuditLog]
    });
  };

  // Mark notifications as read
  const handleMarkAllRead = () => {
    if (!currentUser) return;
    const updated = notifications.map(n => {
      if (n.userId === currentUser.id) {
        return { ...n, isRead: true };
      }
      return n;
    });
    persistState({ notifications: updated });
    setShowNotifDropdown(false);
  };

  // --- DEPARTMENT MANAGEMENT ACTIONS ---

  const handleAddDepartment = (deptData: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => {
    if (!currentUser) return;

    // Check if name is unique
    const lowerName = deptData.department_name.trim().toLowerCase();
    if (departments.some(d => d.department_name.trim().toLowerCase() === lowerName)) {
      alert(`A department with the name "${deptData.department_name}" already exists.`);
      return;
    }

    // Check if code is unique if used
    if (deptData.department_code) {
      const lowerCode = deptData.department_code.trim().toLowerCase();
      if (departments.some(d => d.department_code && d.department_code.trim().toLowerCase() === lowerCode)) {
        alert(`A department with the code "${deptData.department_code}" already exists.`);
        return;
      }
    }

    const newDeptId = `dept_${Date.now()}`;
    const newDept: Department = {
      id: newDeptId,
      department_name: deptData.department_name.trim(),
      department_code: deptData.department_code ? deptData.department_code.trim() : '',
      department_head_user_id: deptData.department_head_user_id || '',
      description: deptData.description ? deptData.description.trim() : '',
      status: deptData.status || 'Active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Department created',
      details: `Created new department: ${newDept.department_name} (${newDept.department_code || 'No Code'}).`,
      timestamp: new Date().toISOString()
    };

    persistState({
      departments: [...departments, newDept],
      auditLogs: [newAuditLog, ...auditLogs]
    });

    alert(`Successfully added department: ${newDept.department_name}`);
  };

  const handleUpdateDepartment = (deptId: string, updatedFields: Partial<Department>) => {
    if (!currentUser) return;

    const targetDept = departments.find(d => d.id === deptId);
    if (!targetDept) return;

    // Validation if renaming
    if (updatedFields.department_name !== undefined && updatedFields.department_name.trim() !== targetDept.department_name) {
      const lowerName = updatedFields.department_name.trim().toLowerCase();
      if (departments.some(d => d.id !== deptId && d.department_name.trim().toLowerCase() === lowerName)) {
        alert(`A department with the name "${updatedFields.department_name}" already exists.`);
        return;
      }
    }

    // Validation if changing code
    if (updatedFields.department_code !== undefined && updatedFields.department_code.trim() !== targetDept.department_code) {
      if (updatedFields.department_code.trim()) {
        const lowerCode = updatedFields.department_code.trim().toLowerCase();
        if (departments.some(d => d.id !== deptId && d.department_code && d.department_code.trim().toLowerCase() === lowerCode)) {
          alert(`A department with the code "${updatedFields.department_code}" already exists.`);
          return;
        }
      }
    }

    const updatedDepartments = departments.map(d => {
      if (d.id === deptId) {
        return {
          ...d,
          ...updatedFields,
          updated_at: new Date().toISOString()
        };
      }
      return d;
    });

    // Detect changes for Audit logs
    const logs: AuditLog[] = [];
    const timestamp = new Date().toISOString();

    if (updatedFields.department_name !== undefined && updatedFields.department_name.trim() !== targetDept.department_name) {
      logs.push({
        id: `log_rename_${Date.now()}_1`,
        actorId: currentUser.id,
        actorName: currentUser.name,
        action: 'Department renamed',
        details: `Renamed department "${targetDept.department_name}" to "${updatedFields.department_name.trim()}".`,
        timestamp
      });
    }

    if (updatedFields.status !== undefined && updatedFields.status !== targetDept.status) {
      if (updatedFields.status === 'Inactive') {
        logs.push({
          id: `log_deactivate_${Date.now()}_2`,
          actorId: currentUser.id,
          actorName: currentUser.name,
          action: 'Department deactivated',
          details: `Deactivated department "${targetDept.department_name}".`,
          timestamp
        });
      }
    }

    if (updatedFields.department_head_user_id !== undefined && updatedFields.department_head_user_id !== targetDept.department_head_user_id) {
      const headUser = users.find(u => u.id === updatedFields.department_head_user_id);
      const headName = headUser ? headUser.name : 'None';
      logs.push({
        id: `log_head_${Date.now()}_3`,
        actorId: currentUser.id,
        actorName: currentUser.name,
        action: 'Department head changed',
        details: `Changed department head of "${targetDept.department_name}" to "${headName}".`,
        timestamp
      });
    }

    // Default catch-all log if no specific changes were tracked but updated
    if (logs.length === 0) {
      logs.push({
        id: `log_update_${Date.now()}`,
        actorId: currentUser.id,
        actorName: currentUser.name,
        action: 'Update Department',
        details: `Updated details for department "${targetDept.department_name}".`,
        timestamp
      });
    }

    // Propagate department name changes to assigned users
    let updatedUsers = users;
    if (updatedFields.department_name !== undefined && updatedFields.department_name.trim() !== targetDept.department_name) {
      const newName = updatedFields.department_name.trim();
      updatedUsers = users.map(u => {
        if (u.departmentId === deptId) {
          return { ...u, department: newName };
        }
        return u;
      });
    }

    persistState({
      departments: updatedDepartments,
      users: updatedUsers,
      auditLogs: [...logs, ...auditLogs]
    });
  };

  const handleDeleteDepartment = (deptId: string) => {
    if (!currentUser) return;

    const targetDept = departments.find(d => d.id === deptId);
    if (!targetDept) return;

    // Check if employees are assigned (active or inactive)
    const assignedCount = users.filter(u => u.departmentId === deptId).length;
    if (assignedCount > 0) {
      alert(`Cannot delete department "${targetDept.department_name}" because there are ${assignedCount} employees assigned to it. Please deactivate the department or reassign the employees first.`);
      return;
    }

    const newAuditLog: AuditLog = {
      id: `log_${Date.now()}`,
      actorId: currentUser.id,
      actorName: currentUser.name,
      action: 'Department deleted',
      details: `Deleted department "${targetDept.department_name}".`,
      timestamp: new Date().toISOString()
    };

    persistState({
      departments: departments.filter(d => d.id !== deptId),
      auditLogs: [newAuditLog, ...auditLogs]
    });

    alert(`Successfully deleted department: ${targetDept.department_name}`);
  };

  // Calculate unread notifications
  const unreadNotifCount = currentUser 
    ? notifications.filter(n => n.userId === currentUser.id && !n.isRead).length
    : 0;

  // Filter notifications for current user
  const personalNotifications = currentUser
    ? notifications.filter(n => n.userId === currentUser.id)
    : [];

  // Active user's balance
  const rawActiveUserBalance = currentUser 
    ? balances.find(b => b.userId === currentUser.id) || {
        userId: currentUser.id,
        annualEntitled: 14,
        annualCarriedForward: 0,
        annualUsed: 0,
        annualPending: 0,
        sickEntitled: 14,
        sickUsed: 0,
        sickPending: 0,
        childcareEntitled: 0,
        childcareUsed: 0,
        childcarePending: 0,
        unpaidUsed: 0,
        otherUsed: 0
      }
    : null;

  const activeUserBalance = rawActiveUserBalance && currentUser
    ? (() => {
        const medicalCalc = calculateMedicalEntitlements(
          currentUser.joinDate,
          '2026-06-25', // Current date
          currentUser.confirmation_status,
          currentUser.confirmation_date,
          settings
        );
        return {
          ...rawActiveUserBalance,
          sickEntitled: medicalCalc.finalSick,
          hospEntitled: medicalCalc.finalHosp,
          hospUsed: rawActiveUserBalance.hospUsed || 0,
          hospPending: rawActiveUserBalance.hospPending || 0,
          medicalRuleApplied: medicalCalc.ruleApplied,
          momSickEntitled: medicalCalc.momSick,
          momHospEntitled: medicalCalc.momHosp,
          overrideSickEntitled: medicalCalc.overrideSick !== null ? medicalCalc.overrideSick : undefined,
          overrideHospEntitled: medicalCalc.overrideHosp !== null ? medicalCalc.overrideHosp : undefined,
        };
      })()
    : null;

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-slate-800 flex flex-col" id="applet-viewport">
      
      {/* 1. Header Role Switching helper widget */}
      {currentUser && showDevSwitch && (
        <RoleSelector
          currentUser={currentUser}
          allUsers={users}
          onSelectUser={handleQuickSwitchUser}
          lang={lang}
        />
      )}

      {/* Sandbox Toggle & Language Switcher Controls */}
      <div className="fixed top-4 right-4 flex items-center space-x-2 z-50">
        <button
          onClick={() => setShowDevSwitch(!showDevSwitch)}
          className={`bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition cursor-pointer ${showDevSwitch ? 'ring-2 ring-blue-500/30 border-blue-500' : ''}`}
          id="sandbox-toggle-btn"
          title={lang === 'zh' ? '开启开发沙盒模式' : 'Toggle Sandbox Tools'}
        >
          <span>🛠️ {showDevSwitch ? (lang === 'zh' ? '隐藏沙盒工具' : 'Hide Sandbox') : (lang === 'zh' ? '测试沙盒工具' : 'Sandbox Tools')}</span>
        </button>

        <button
          onClick={toggleLanguage}
          className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm transition cursor-pointer"
          id="global-lang-toggle"
        >
          <span>🌐 {lang === 'en' ? '中文' : 'English'}</span>
        </button>
      </div>

      {/* Main Content Wrapper */}
      {/* Main Content Wrapper */}
      {!currentUser ? (
        users.length === 0 ? (
          // --- SETUP PAGE ---
          <div className="flex-grow flex items-center justify-center py-16 px-4" id="setup-layout">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
                <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-3 shadow shadow-blue-600/20">
                  <Building className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {lang === 'zh' ? '创建首个企业管理员' : 'First-time Setup'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'zh' ? '设置您的公司名称和管理员账户' : 'Initialize your company and main admin account'}
                </p>
              </div>

              <div className="p-8 space-y-6">
                <form onSubmit={handleFirstAdminSetup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'zh' ? '公司名称 / Company Name' : 'Company Name'}
                    </label>
                    <input
                      type="text"
                      required
                      value={setupCompanyName}
                      onChange={(e) => setSetupCompanyName(e.target.value)}
                      placeholder="e.g. Acme Corporation"
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      id="setup-company-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'zh' ? '管理员姓名 / Admin Full Name' : 'Admin Full Name'}
                    </label>
                    <input
                      type="text"
                      required
                      value={setupAdminName}
                      onChange={(e) => setSetupAdminName(e.target.value)}
                      placeholder="e.g. Sarah Tan"
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      id="setup-admin-name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'zh' ? '管理员邮箱 / Admin Email' : 'Admin Email'}
                    </label>
                    <input
                      type="email"
                      required
                      value={setupAdminEmail}
                      onChange={(e) => setSetupAdminEmail(e.target.value)}
                      placeholder="e.g. admin@company.com"
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      id="setup-admin-email"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'zh' ? '设置密码 / Choose Password' : 'Choose Password (min. 6 chars)'}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={setupPassword}
                      onChange={(e) => setSetupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      id="setup-password"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'zh' ? '确认密码 / Confirm Password' : 'Confirm Password'}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={setupConfirmPassword}
                      onChange={(e) => setSetupConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      id="setup-confirm-password"
                    />
                  </div>

                  {setupError && (
                    <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3 flex items-center space-x-1.5" id="setup-error-alert">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{setupError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-600/15 hover:shadow-blue-600/25 transition cursor-pointer"
                    id="setup-submit-btn"
                  >
                    {lang === 'zh' ? '初始化系统并进入 / Complete Setup' : 'Complete Setup & Sign In'}
                  </button>
                </form>

                <div className="border-t border-slate-100 pt-5 text-center">
                  <p className="text-[11px] text-slate-400 mb-2">
                    {lang === 'zh' ? '或者，您可以一键快速生成系统演示数据：' : 'Or, you can quickly generate pre-loaded sandbox data for trial:'}
                  </p>
                  <button
                    onClick={handleSeedDatabase}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                    id="setup-seed-btn"
                  >
                    ✨ {lang === 'zh' ? '一键生成演示数据 (Create sample data)' : 'Create sample data'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // --- LOGIN PAGE ---
          <div className="flex-grow flex items-center justify-center py-16 px-4" id="login-layout">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              {/* Header branding */}
              <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
                <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-3 shadow shadow-blue-600/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">LeaveHub SG</h1>
                <p className="text-xs text-slate-500 mt-1">{t.loginSubtitle}</p>
              </div>

              {/* Form content */}
              <div className="p-8 space-y-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t.enterEmail}</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. admin@company.com"
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      id="login-email-input"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {lang === 'zh' ? '登录密码 / Password' : 'Password'}
                      </label>
                    </div>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      id="login-password-input"
                    />
                  </div>

                  {loginError && (
                    <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3 flex items-center space-x-1.5" id="login-error-alert">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-600/15 hover:shadow-blue-600/25 transition cursor-pointer"
                    id="login-submit-btn"
                  >
                    {t.accessWorkspace}
                  </button>
                </form>

                {/* Demo accounts quick trigger */}
                {showDevSwitch && (
                  <div className="border-t border-slate-100 pt-5 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{t.quickDemoAccess}</span>
                    
                    <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] font-bold">
                      <button
                        onClick={() => {
                          const u = users.find(x => x.role === 'admin');
                          if (u) {
                            setCurrentUser(u);
                            localStorage.setItem('leavehub_session', JSON.stringify(u));
                          }
                        }}
                        className="p-2 border hover:border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 transition text-slate-700 flex flex-col items-center justify-center cursor-pointer"
                        id="quick-login-admin"
                      >
                        <span className="text-[10px] text-blue-600 uppercase font-black tracking-wide">{t.adminRole}</span>
                        <span className="truncate max-w-[80px] font-medium text-slate-500 mt-0.5">Admin</span>
                      </button>

                      <button
                        onClick={() => {
                          const u = users.find(x => x.role === 'manager');
                          if (u) {
                            setCurrentUser(u);
                            localStorage.setItem('leavehub_session', JSON.stringify(u));
                          }
                        }}
                        className="p-2 border hover:border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 transition text-slate-700 flex flex-col items-center justify-center cursor-pointer"
                        id="quick-login-manager"
                      >
                        <span className="text-[10px] text-emerald-600 uppercase font-black tracking-wide">{t.managerRole}</span>
                        <span className="truncate max-w-[80px] font-medium text-slate-500 mt-0.5">Manager</span>
                      </button>

                      <button
                        onClick={() => {
                          const u = users.find(x => x.role === 'employee');
                          if (u) {
                            setCurrentUser(u);
                            localStorage.setItem('leavehub_session', JSON.stringify(u));
                          }
                        }}
                        className="p-2 border hover:border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 transition text-slate-700 flex flex-col items-center justify-center cursor-pointer"
                        id="quick-login-employee"
                      >
                        <span className="text-[10px] text-sky-600 uppercase font-black tracking-wide">{t.employeeRole}</span>
                        <span className="truncate max-w-[80px] font-medium text-slate-500 mt-0.5">Employee</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : (
        
        // --- AUTHENTICATED WORKSPACE ---
        <div className="flex-grow flex flex-col md:flex-row" id="authenticated-layout">
          
          {/* A. Sidebar Navigation */}
          <aside className="w-full md:w-64 bg-slate-900 text-slate-400 shrink-0 border-r border-slate-800 flex flex-col justify-between" id="sidebar-container">
            <div>
              {/* Branding Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-lg italic shadow shadow-blue-500/25">
                    L
                  </div>
                  <div>
                    <h1 className="text-white font-bold text-xl tracking-tight leading-none">LeaveHub SG</h1>
                    <span className="text-[10px] text-slate-500 font-bold tracking-wide uppercase">{t.workspace}</span>
                  </div>
                </div>

                {/* Mobile menu trigger */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>

              {/* Navigation links */}
              <nav className={`p-4 space-y-1.5 md:block ${mobileMenuOpen ? 'block' : 'hidden'}`} id="sidebar-nav">
                
                <button
                  onClick={() => { setCurrentView('dashboard'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm font-medium transition cursor-pointer ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                  id="nav-dashboard"
                >
                  <div className="flex items-center space-x-2.5">
                    <Briefcase className="w-5 h-5 shrink-0" />
                    <span>{t.myDashboard}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${currentView === 'dashboard' ? 'block' : 'hidden'}`} />
                </button>

                <button
                  onClick={() => { setCurrentView('history'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm font-medium transition cursor-pointer ${currentView === 'history' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                  id="nav-history"
                >
                  <div className="flex items-center space-x-2.5">
                    <FileText className="w-5 h-5 shrink-0" />
                    <span>{t.myLeaveHistory}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${currentView === 'history' ? 'block' : 'hidden'}`} />
                </button>

                <button
                  onClick={() => { setCurrentView('calendar'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm font-medium transition cursor-pointer ${currentView === 'calendar' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                  id="nav-calendar"
                >
                  <div className="flex items-center space-x-2.5">
                    <Calendar className="w-5 h-5 shrink-0" />
                    <span>{t.teamCalendar}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${currentView === 'calendar' ? 'block' : 'hidden'}`} />
                </button>

                {/* Manager Link */}
                {(currentUser.role === 'manager' || currentUser.role === 'admin') && (
                  <div className="pt-4 mt-4 border-t border-slate-800 space-y-1.5">
                    <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.managerView}</p>
                    <button
                      onClick={() => { setCurrentView('manager'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm font-medium transition cursor-pointer ${currentView === 'manager' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                      id="nav-manager"
                    >
                      <div className="flex items-center space-x-2.5">
                        <UserCheck className="w-5 h-5 shrink-0" />
                        <span>{t.approvals}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${currentView === 'manager' ? 'block' : 'hidden'}`} />
                    </button>
                  </div>
                )}

                {/* Admin and Reports Section */}
                {currentUser.role === 'admin' && (
                  <div className="pt-4 mt-4 border-t border-slate-800 space-y-1.5">
                    <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.hrAdministration}</p>
                    
                    <button
                      onClick={() => { setCurrentView('admin'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm font-medium transition cursor-pointer ${currentView === 'admin' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                      id="nav-admin"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Settings className="w-5 h-5 shrink-0" />
                        <span>{t.adminPanel}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${currentView === 'admin' ? 'block' : 'hidden'}`} />
                    </button>

                    <button
                      onClick={() => { setCurrentView('reports'); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-md text-sm font-medium transition cursor-pointer ${currentView === 'reports' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
                      id="nav-reports"
                    >
                      <div className="flex items-center space-x-2.5">
                        <BarChart3 className="w-5 h-5 shrink-0" />
                        <span>{t.reportsAudits}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 opacity-50 ${currentView === 'reports' ? 'block' : 'hidden'}`} />
                    </button>
                  </div>
                )}
              </nav>
            </div>

            {/* Sidebar Footer: Profile and Logout */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
              <div className="flex items-center justify-between">
                <div className="truncate pr-2">
                  <span className="block text-xs font-bold text-slate-200 truncate">{currentUser.name}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{currentUser.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-lg hover:bg-rose-900/30 transition cursor-pointer shrink-0"
                  title={t.logout}
                  id="logout-btn"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </aside>

          {/* B. Main Viewport Panel */}
          <main className="flex-grow flex flex-col overflow-hidden bg-slate-50">
            
            {/* Top Bar inside Viewport */}
            <header className="bg-white border-b border-slate-200 h-16 px-8 flex items-center justify-between shrink-0" id="topbar-container">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-800 capitalize">
                  {currentView === 'dashboard' ? t.myDashboard : currentView === 'history' ? t.myLeaveHistory : currentView === 'calendar' ? t.teamCalendar : currentView === 'manager' ? t.approvals : currentView === 'admin' ? t.adminPanel : currentView === 'reports' ? t.reportsAudits : currentView.replace('_', ' ')}
                </h2>
                <span className="text-xs text-slate-400 px-2 py-1 bg-slate-50 rounded border border-slate-200">{t.fy2026}</span>
              </div>

              {/* Header Actions: Notification Badge & Trigger Leave */}
              <div className="flex items-center gap-4">
                
                {/* Apply Leave Quick Access Button */}
                <button
                  onClick={() => setShowApplyModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm cursor-pointer"
                  id="topbar-apply-leave-btn"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t.applyLeave}</span>
                </button>

                {/* Notifications Bell */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative cursor-pointer"
                    id="topbar-notif-btn"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-rose-600 text-white font-bold font-mono text-[9px] w-4 h-4 rounded-full flex items-center justify-center leading-none">
                        {unreadNotifCount}
                      </span>
                    )}
                  </button>

                  {/* Notifications Dropdown menu */}
                  {showNotifDropdown && (
                    <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs" id="notif-dropdown">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <span className="font-bold text-slate-700">{t.notificationsTitle} ({unreadNotifCount} {t.unread})</span>
                        <button
                          onClick={handleMarkAllRead}
                          className="text-[10px] text-blue-600 font-bold hover:text-blue-800 cursor-pointer"
                        >
                          {t.markAllRead}
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                        {personalNotifications.length === 0 ? (
                          <div className="p-4 text-center text-slate-400">
                            {t.noNotifications}
                          </div>
                        ) : (
                          personalNotifications.slice().reverse().map(n => (
                            <div key={n.id} className={`p-3 transition ${n.isRead ? 'bg-white text-slate-500' : 'bg-blue-50/40 text-slate-800 font-medium'}`}>
                              <p className="leading-tight">{n.message}</p>
                              <span className="text-[9px] font-mono text-slate-400 mt-1 block">
                                {new Date(n.createdAt).toLocaleString()}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Dynamic Content Panel */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6" id="dashboard-content-container">
              
              {/* --- DASHBOARD VIEW --- */}
              {currentView === 'dashboard' && activeUserBalance && (
                <div className="space-y-6" id="view-dashboard-panel">
                  {/* Greeting Block */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">{t.welcomeGreeting.replace('{name}', currentUser.name)}</h2>
                      <p className="text-xs text-slate-500 font-medium">{lang === 'zh' ? '所属部门：' : 'Department: '} <span className="font-bold text-slate-800">{currentUser.department}</span> | {lang === 'zh' ? '系统角色：' : 'Role: '} <span className="uppercase text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{lang === 'zh' && currentUser.role === 'admin' ? '管理员' : lang === 'zh' && currentUser.role === 'manager' ? '主管' : lang === 'zh' ? '员工' : currentUser.role}</span></p>
                    </div>

                    <div className="text-right text-xs shrink-0">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] block">{t.currentSystemDate}:</span>
                      <strong className="text-slate-700 block font-mono">2026-06-25</strong>
                    </div>
                  </div>

                  {/* Singapore Leave Balance Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Annual Leave card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">{t.annualLeave}</span>
                          <span className="text-xs text-slate-500 mt-0.5 font-medium">{t.annualLeaveDesc}</span>
                        </div>
                        <div className="p-2 bg-sky-50 text-sky-600 rounded-lg shrink-0">
                          <Compass className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="flex items-end justify-between border-t border-slate-50 pt-3">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold block uppercase">{t.remaining}</span>
                          <span className="text-3xl font-black text-slate-900 font-mono font-sans">
                            {((activeUserBalance.annualEntitled + activeUserBalance.annualCarriedForward) - activeUserBalance.annualUsed).toFixed(1)}
                          </span>
                        </div>
                        <div className="text-right text-[11px] font-semibold text-slate-500 space-y-0.5 font-mono">
                          <div>{lang === 'zh' ? '基础额度' : 'Base'}: {activeUserBalance.annualEntitled}</div>
                          <div>{lang === 'zh' ? '结转额度' : 'Carried'}: {activeUserBalance.annualCarriedForward}</div>
                          <div className="text-sky-600 font-bold">{lang === 'zh' ? '已使用' : 'Used'}: {activeUserBalance.annualUsed}</div>
                          <div className="text-amber-600">{lang === 'zh' ? '处理中' : 'Pending'}: {activeUserBalance.annualPending}</div>
                        </div>
                      </div>

                      {/* Singapore-style calculation breakdown */}
                      <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-600 border border-slate-100 font-sans space-y-1 mt-2">
                        <div className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">Singapore Leave Year {activeUserBalance.leaveYear || new Date().getFullYear()} Breakdown</div>
                        <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                          <div>Completed Months:</div>
                          <div className="text-right text-slate-900 font-bold">{activeUserBalance.completedMonths ?? 12} months</div>
                          
                          <div>System Entitled:</div>
                          <div className="text-right text-slate-900">
                            {activeUserBalance.annualEntitledSystem !== undefined ? activeUserBalance.annualEntitledSystem.toFixed(2) : activeUserBalance.annualEntitled} days
                          </div>

                          <div>Manual Adjustment:</div>
                          <div className="text-right text-slate-900">
                            {activeUserBalance.annualManualAdjustment !== undefined ? (activeUserBalance.annualManualAdjustment >= 0 ? '+' : '') + activeUserBalance.annualManualAdjustment : '0'} days
                          </div>

                          <div className="font-semibold text-indigo-600">Final Entitlement:</div>
                          <div className="text-right font-bold text-indigo-600">{activeUserBalance.annualEntitled} days</div>

                          <div>Carry Forward:</div>
                          <div className="text-right text-slate-900">+{activeUserBalance.annualCarriedForward} days</div>

                          <div className="text-red-500">Approved Taken:</div>
                          <div className="text-right font-semibold text-red-500">-{activeUserBalance.annualUsed} days</div>

                          <div className="font-bold text-slate-800 border-t pt-1">Remaining AL:</div>
                          <div className="text-right font-black text-slate-900 border-t pt-1 font-sans text-xs">
                            {((activeUserBalance.annualEntitled + activeUserBalance.annualCarriedForward) - activeUserBalance.annualUsed).toFixed(2)} days
                          </div>
                        </div>

                        <div className="text-[9px] text-slate-400 mt-1.5 leading-normal border-t border-slate-200/60 pt-1.5">
                          Formula: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-500">Final Entitlement ({activeUserBalance.annualEntitled}) + Carry Forward ({activeUserBalance.annualCarriedForward}) - Approved Leave Taken ({activeUserBalance.annualUsed}) = Remaining Balance</span>. Pending leave ({activeUserBalance.annualPending} days) is shown separately.
                        </div>
                      </div>
                    </div>

                    {/* Outpatient Sick & Hospitalisation Leave card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 flex flex-col justify-between md:col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Singapore Medical & Hospitalisation Leave</span>
                          <span className="text-xs text-slate-500 mt-0.5 font-medium">MOM statutory outpatient sick leave (MC) and hospitalisation leave (HL)</span>
                        </div>
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
                          <Activity className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-50 pt-3">
                        <div className="bg-rose-50/40 rounded-xl p-3 border border-rose-100/50">
                          <span className="text-[10px] text-rose-600 font-bold block uppercase tracking-wider">Outpatient Sick (MC)</span>
                          <span className="text-2xl font-black text-rose-950 font-mono block mt-1">
                            {activeUserBalance.sickEntitled - activeUserBalance.sickUsed} <span className="text-xs font-semibold text-rose-700">days left</span>
                          </span>
                          <div className="text-[10px] text-rose-800 font-medium mt-1 space-y-0.5 font-mono">
                            <div>Entitled: {activeUserBalance.sickEntitled} days</div>
                            <div>Used: {activeUserBalance.sickUsed} days</div>
                            {activeUserBalance.sickPending > 0 && <div className="text-amber-600 font-bold">Pending: {activeUserBalance.sickPending} days</div>}
                          </div>
                        </div>

                        <div className="bg-indigo-50/40 rounded-xl p-3 border border-indigo-100/50">
                          <span className="text-[10px] text-indigo-600 font-bold block uppercase tracking-wider">Hospitalisation (HL)</span>
                          <span className="text-2xl font-black text-indigo-950 font-mono block mt-1">
                            {activeUserBalance.hospEntitled - activeUserBalance.hospUsed} <span className="text-xs font-semibold text-indigo-700">days left</span>
                          </span>
                          <div className="text-[10px] text-indigo-800 font-medium mt-1 space-y-0.5 font-mono">
                            <div>Entitled: {activeUserBalance.hospEntitled} days</div>
                            <div>Used: {activeUserBalance.hospUsed} days</div>
                            {activeUserBalance.hospPending > 0 && <div className="text-amber-600 font-bold">Pending: {activeUserBalance.hospPending} days</div>}
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Combined MC & HL Remaining</span>
                            <span className="text-3xl font-black text-slate-900 font-mono block mt-1">
                              {activeUserBalance.hospEntitled - activeUserBalance.sickUsed - activeUserBalance.hospUsed}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-400 leading-tight block mt-1">Singapore MOM combined hospitalisation cap applies.</span>
                        </div>
                      </div>

                      {/* Singapore-style calculation breakdown */}
                      <div className="bg-slate-50 rounded-xl p-3.5 text-[11px] text-slate-600 border border-slate-100 font-sans space-y-2 mt-1">
                        <div className="font-bold text-slate-700 uppercase tracking-wide text-[10px]">Singapore Medical Leave Entitlement & Rule Breakdown</div>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px]">
                          <div>Medical Leave Rule Applied:</div>
                          <div className="text-right text-blue-700 font-semibold">{activeUserBalance.medicalRuleApplied}</div>

                          <div>MOM Statutory Outpatient SL:</div>
                          <div className="text-right text-slate-900">{activeUserBalance.momSickEntitled} days</div>

                          <div>MOM Statutory Hospitalisation HL:</div>
                          <div className="text-right text-slate-900">{activeUserBalance.momHospEntitled} days</div>

                          {activeUserBalance.overrideSickEntitled !== undefined && (
                            <>
                              <div className="text-amber-700 font-medium">Company Override Outpatient SL:</div>
                              <div className="text-right text-amber-700 font-bold">+{activeUserBalance.overrideSickEntitled} days</div>
                            </>
                          )}

                          {activeUserBalance.overrideHospEntitled !== undefined && (
                            <>
                              <div className="text-amber-700 font-medium">Company Override Hospitalisation HL:</div>
                              <div className="text-right text-amber-700 font-bold">+{activeUserBalance.overrideHospEntitled} days</div>
                            </>
                          )}

                          <div className="font-bold text-indigo-600 border-t pt-1">Final Outpatient SL Entitlement:</div>
                          <div className="text-right font-black text-indigo-600 border-t pt-1">{activeUserBalance.sickEntitled} days</div>

                          <div className="font-bold text-indigo-600">Final Hospitalisation HL Entitlement:</div>
                          <div className="text-right font-black text-indigo-600">{activeUserBalance.hospEntitled} days</div>
                        </div>

                        <div className="text-[9px] text-slate-400 mt-2 leading-normal border-t border-slate-200/60 pt-2">
                          Formula: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-500">Combined Medical Leave Remaining ({activeUserBalance.hospEntitled - activeUserBalance.sickUsed - activeUserBalance.hospUsed}) = Final Hospitalisation ({activeUserBalance.hospEntitled}) - Outpatient Sick Leave Used ({activeUserBalance.sickUsed}) - Hospitalisation Leave Used ({activeUserBalance.hospUsed})</span>.
                        </div>
                      </div>
                    </div>

                    {/* Government Childcare Leave Card (Singapore MOM rules) */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">{t.childcareLeave}</span>
                          <span className="text-xs text-slate-500 mt-0.5 font-medium">{t.childcareLeaveDesc}</span>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                          <Award className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="flex items-end justify-between border-t border-slate-50 pt-3">
                        {currentUser.hasChildcareEligible ? (
                          <>
                            <div>
                              <span className="text-[10px] text-slate-400 font-semibold block uppercase">{t.remaining}</span>
                              <span className="text-3xl font-black text-slate-900 font-mono">
                                {activeUserBalance.childcareEntitled - activeUserBalance.childcareUsed}
                              </span>
                            </div>
                            <div className="text-right text-[11px] font-semibold text-slate-500 space-y-0.5 font-mono">
                              <div>{lang === 'zh' ? '享有天数' : 'Entitled'}: {activeUserBalance.childcareEntitled}</div>
                              <div className="text-emerald-600 font-bold">{lang === 'zh' ? '已使用' : 'Used'}: {activeUserBalance.childcareUsed}</div>
                              <div className="text-amber-600">{lang === 'zh' ? '处理中' : 'Pending'}: {activeUserBalance.childcarePending}</div>
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 italic py-1">
                            {lang === 'zh' ? '不符合新加坡政府育儿假计划。（须符合公民身份/子女年龄要求）' : 'Not eligible for Singapore Gov Childcare Leave Scheme. (Citizenship/child age requirements apply)'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dashboard secondary sections: Upcoming leave & history summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Quick Info Alerts & Calendar Preview */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 lg:col-span-2">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'zh' ? '新加坡休假法规合规清单' : 'Singapore Leave Rules Compliance Checklist'}</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="border border-slate-100 p-3 rounded-lg bg-slate-50/50 flex space-x-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-800">{lang === 'zh' ? '工作日计算' : 'Working Day Calculations'}</strong>
                            <p className="text-[11px] text-slate-500 mt-0.5">{lang === 'zh' ? '自动排除周末及新加坡法定公共假期，不计入请假天数。' : 'Weekends and Singapore official Public Holidays are automatically filtered and not counted as leave days.'}</p>
                          </div>
                        </div>

                        <div className="border border-slate-100 p-3 rounded-lg bg-slate-50/50 flex space-x-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-800">{lang === 'zh' ? '按比例折算年假额度' : 'Prorated Annual Entitlement'}</strong>
                            <p className="text-[11px] text-slate-500 mt-0.5">{lang === 'zh' ? '根据入职日期，依据新加坡雇佣法令指导方针动态自动折算。' : 'Entitlements automatically adjust dynamically based on hire/join dates in accordance with Singapore Employment Act guidelines.'}</p>
                          </div>
                        </div>

                        <div className="border border-slate-100 p-3 rounded-lg bg-slate-50/50 flex space-x-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-800">{lang === 'zh' ? '带薪病假追踪' : 'Outpatient Sick Leave Track'}</strong>
                            <p className="text-[11px] text-slate-500 mt-0.5">{lang === 'zh' ? '常规门诊病假限制为每年14天，须上传正式医疗证明（MC）。' : 'Outpatient clinic consultations are limited to 14 days standard, requiring certified clinical MC certificate uploads.'}</p>
                          </div>
                        </div>

                        <div className="border border-slate-100 p-3 rounded-lg bg-slate-50/50 flex space-x-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-slate-800">{lang === 'zh' ? '带薪育儿假 (CL)' : 'Childcare Leave (GPCL/CC)'}</strong>
                            <p className="text-[11px] text-slate-500 mt-0.5">{lang === 'zh' ? '为育有7岁以下新加坡公民子女的员工提供每年最多6天带薪育儿假。' : 'Provides up to 6 days per calendar year for citizens with eligible offspring under 7 years of age.'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pending Approvals Summary */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{lang === 'zh' ? '我的待审批请假申请' : 'Outstanding Leave Reviews'}</h3>
                      
                      {applications.filter(app => app.userId === currentUser.id && app.status === 'pending').length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                          <span>{lang === 'zh' ? '暂无待审批请假申请。' : 'No pending leave applications.'}</span>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[180px] overflow-y-auto">
                          {applications.filter(app => app.userId === currentUser.id && app.status === 'pending').map(app => (
                            <div key={app.id} className="border border-slate-100 p-2.5 rounded-lg bg-slate-50/50 flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-800 uppercase block">{lang === 'zh' ? (app.leaveType === 'annual' ? '年假' : app.leaveType === 'sick' ? '病假' : app.leaveType === 'childcare' ? '育儿假' : app.leaveType === 'maternity' ? '产假' : app.leaveType === 'compassionate' ? '丧假' : app.leaveType) : app.leaveType} Leave</span>
                                <span className="text-[10px] text-slate-400 block font-mono">{app.startDate} to {app.endDate}</span>
                              </div>
                              <span className="bg-amber-100 text-amber-800 font-bold text-[10px] uppercase px-1.5 py-0.5 rounded">
                                {app.requestedDays} {lang === 'zh' ? '天' : 'days'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* --- MY HISTORY VIEW --- */}
              {currentView === 'history' && (
                <HistoryView
                  currentUser={currentUser}
                  applications={applications}
                  onCancelRequest={handleCancelRequest}
                  lang={lang}
                />
              )}

              {/* --- TEAM CALENDAR VIEW --- */}
              {currentView === 'calendar' && (
                <CalendarView
                  applications={applications}
                  holidays={holidays}
                  users={users}
                  departments={departments}
                  defaultDepartment={currentUser.role === 'employee' ? currentUser.department : 'All'}
                  lang={lang}
                />
              )}

              {/* --- MANAGER APPROVAL VIEW --- */}
              {currentView === 'manager' && (currentUser.role === 'manager' || currentUser.role === 'admin') && (
                <ManagerView
                  currentUser={currentUser}
                  applications={applications}
                  users={users}
                  departments={departments}
                  holidays={holidays}
                  onAction={handleManagerAction}
                  lang={lang}
                />
              )}
 
              {/* --- ADMIN VIEW --- */}
              {currentView === 'admin' && currentUser.role === 'admin' && (
                <AdminView
                  users={users}
                  balances={balances}
                  settings={settings}
                  holidays={holidays}
                  auditLogs={auditLogs}
                  departments={departments}
                  applications={applications}
                  onAddEmployee={handleAddEmployee}
                  onUpdateEmployee={handleUpdateEmployee}
                  onAdjustBalance={handleAdjustBalance}
                  onUpdateSettings={handleUpdateSettings}
                  onAddHoliday={handleAddHoliday}
                  onDeleteHoliday={handleDeleteHoliday}
                  onResetDatabase={handleResetDatabase}
                  onAddDepartment={handleAddDepartment}
                  onUpdateDepartment={handleUpdateDepartment}
                  onDeleteDepartment={handleDeleteDepartment}
                  lang={lang}
                />
              )}
 
              {/* --- REPORTS VIEW --- */}
              {currentView === 'reports' && currentUser.role === 'admin' && (
                <ReportsView
                  applications={applications}
                  users={users}
                  balances={balances}
                  departments={departments}
                  lang={lang}
                />
              )}

            </div>
          </main>
        </div>
      )}

      {/* 2. Global Modal form for New Leave Applications */}
      {currentUser && (
        <NewApplicationModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          currentUser={currentUser}
          balance={activeUserBalance || {
            userId: currentUser.id,
            annualEntitled: 14,
            annualCarriedForward: 0,
            annualUsed: 0,
            annualPending: 0,
            sickEntitled: 14,
            sickUsed: 0,
            sickPending: 0,
            childcareEntitled: 0,
            childcareUsed: 0,
            childcarePending: 0,
            unpaidUsed: 0,
            otherUsed: 0
          }}
          holidays={holidays}
          existingApplications={applications}
          onSubmit={handleApplyLeaveSubmit}
          lang={lang}
        />
      )}

    </div>
  );
}

// Global sub-helper component
function CheckCircle2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
