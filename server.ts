import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), 'server-db.json');

app.use(express.json({ limit: '50mb' }));

// Initial Seed Data
const initialUsers = [
  {
    id: 'usr_1',
    name: 'Sarah Tan',
    email: 'sarah.tan@leavehub.sg',
    role: 'admin',
    department: 'HR & Admin',
    joinDate: '2024-01-15',
    isActive: true,
    hasChildcareEligible: false
  },
  {
    id: 'usr_2',
    name: 'David Lim',
    email: 'david.lim@leavehub.sg',
    role: 'manager',
    department: 'Engineering',
    joinDate: '2024-06-01',
    isActive: true,
    managerId: 'usr_1',
    managerName: 'Sarah Tan',
    hasChildcareEligible: true
  },
  {
    id: 'usr_3',
    name: 'Aisha Rahman',
    email: 'aisha.rahman@leavehub.sg',
    role: 'manager',
    department: 'Sales',
    joinDate: '2024-08-10',
    isActive: true,
    managerId: 'usr_1',
    managerName: 'Sarah Tan',
    hasChildcareEligible: false
  },
  {
    id: 'usr_4',
    name: 'Marcus Chen',
    email: 'marcus.chen@leavehub.sg',
    role: 'employee',
    department: 'Engineering',
    joinDate: '2025-02-15',
    isActive: true,
    managerId: 'usr_2',
    managerName: 'David Lim',
    hasChildcareEligible: true
  },
  {
    id: 'usr_5',
    name: 'Priya Selvam',
    email: 'priya.selvam@leavehub.sg',
    role: 'employee',
    department: 'Sales',
    joinDate: '2025-05-20',
    isActive: true,
    managerId: 'usr_3',
    managerName: 'Aisha Rahman',
    hasChildcareEligible: false
  },
  {
    id: 'usr_6',
    name: 'Wei Jie Neo',
    email: 'weijie.neo@leavehub.sg',
    role: 'employee',
    department: 'HR & Admin',
    joinDate: '2026-01-10',
    isActive: true,
    managerId: 'usr_1',
    managerName: 'Sarah Tan',
    hasChildcareEligible: false
  },
  {
    id: 'usr_7',
    name: 'Hana Suzuki',
    email: 'hana.suzuki@leavehub.sg',
    role: 'employee',
    department: 'Engineering',
    joinDate: '2026-04-01',
    isActive: true,
    managerId: 'usr_2',
    managerName: 'David Lim',
    hasChildcareEligible: true
  }
];

const initialBalances = [
  {
    userId: 'usr_1',
    annualEntitled: 21,
    annualCarriedForward: 3,
    annualUsed: 5,
    annualPending: 0,
    sickEntitled: 14,
    sickUsed: 2,
    sickPending: 0,
    childcareEntitled: 0,
    childcareUsed: 0,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  },
  {
    userId: 'usr_2',
    annualEntitled: 18,
    annualCarriedForward: 2,
    annualUsed: 4,
    annualPending: 4,
    sickEntitled: 14,
    sickUsed: 1,
    sickPending: 0,
    childcareEntitled: 6,
    childcareUsed: 2,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  },
  {
    userId: 'usr_3',
    annualEntitled: 18,
    annualCarriedForward: 0,
    annualUsed: 6,
    annualPending: 0,
    sickEntitled: 14,
    sickUsed: 0,
    sickPending: 0,
    childcareEntitled: 0,
    childcareUsed: 0,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  },
  {
    userId: 'usr_4',
    annualEntitled: 14,
    annualCarriedForward: 2,
    annualUsed: 3,
    annualPending: 3,
    sickEntitled: 14,
    sickUsed: 3,
    sickPending: 0,
    childcareEntitled: 6,
    childcareUsed: 4,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  },
  {
    userId: 'usr_5',
    annualEntitled: 14,
    annualCarriedForward: 1,
    annualUsed: 5,
    annualPending: 0,
    sickEntitled: 14,
    sickUsed: 0,
    sickPending: 0,
    childcareEntitled: 0,
    childcareUsed: 0,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  },
  {
    userId: 'usr_6',
    annualEntitled: 14,
    annualCarriedForward: 0,
    annualUsed: 2,
    annualPending: 0,
    sickEntitled: 14,
    sickUsed: 1,
    sickPending: 1,
    childcareEntitled: 0,
    childcareUsed: 0,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  },
  {
    userId: 'usr_7',
    annualEntitled: 10.5,
    annualCarriedForward: 0,
    annualUsed: 0,
    annualPending: 3,
    sickEntitled: 14,
    sickUsed: 0,
    sickPending: 0,
    childcareEntitled: 6,
    childcareUsed: 0,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  }
];

const initialApplications = [
  {
    id: 'app_1',
    userId: 'usr_4',
    userName: 'Marcus Chen',
    department: 'Engineering',
    leaveType: 'annual',
    startDate: '2026-07-06',
    endDate: '2026-07-08',
    isHalfDay: false,
    requestedDays: 3,
    reason: 'Family staycation at Sentosa Cove',
    status: 'pending',
    createdAt: '2026-06-20T10:15:00Z',
    managerId: 'usr_2',
    managerName: 'David Lim'
  },
  {
    id: 'app_2',
    userId: 'usr_7',
    userName: 'Hana Suzuki',
    department: 'Engineering',
    leaveType: 'annual',
    startDate: '2026-07-15',
    endDate: '2026-07-17',
    isHalfDay: false,
    requestedDays: 3,
    reason: 'Moving to new apartment in Pasir Ris',
    status: 'pending',
    createdAt: '2026-06-23T14:30:00Z',
    managerId: 'usr_2',
    managerName: 'David Lim'
  },
  {
    id: 'app_3',
    userId: 'usr_6',
    userName: 'Wei Jie Neo',
    department: 'HR & Admin',
    leaveType: 'sick',
    startDate: '2026-06-25',
    endDate: '2026-06-25',
    isHalfDay: false,
    requestedDays: 1,
    reason: 'Fever and severe cough. Visited Raffles Medical.',
    attachmentName: 'raffles_medical_mc_98231.pdf',
    status: 'pending',
    createdAt: '2026-06-24T08:00:00Z',
    managerId: 'usr_1',
    managerName: 'Sarah Tan'
  },
  {
    id: 'app_4',
    userId: 'usr_2',
    userName: 'David Lim',
    department: 'Engineering',
    leaveType: 'annual',
    startDate: '2026-08-11',
    endDate: '2026-08-14',
    isHalfDay: false,
    requestedDays: 4,
    reason: 'Extended National Day long weekend break with children',
    status: 'pending',
    createdAt: '2026-06-22T09:00:00Z',
    managerId: 'usr_1',
    managerName: 'Sarah Tan'
  },
  {
    id: 'app_5',
    userId: 'usr_4',
    userName: 'Marcus Chen',
    department: 'Engineering',
    leaveType: 'annual',
    startDate: '2026-03-12',
    endDate: '2026-03-13',
    isHalfDay: false,
    requestedDays: 2,
    reason: 'Long weekend family holiday to Desaru',
    status: 'approved',
    createdAt: '2026-02-28T11:45:00Z',
    managerId: 'usr_2',
    managerName: 'David Lim',
    managerComments: 'Approved. Enjoy your trip, Marcus!',
    actionedAt: '2026-03-01T09:15:00Z'
  },
  {
    id: 'app_6',
    userId: 'usr_5',
    userName: 'Priya Selvam',
    department: 'Sales',
    leaveType: 'annual',
    startDate: '2026-05-04',
    endDate: '2026-05-05',
    isHalfDay: false,
    requestedDays: 2,
    reason: 'Post-Labour Day short trip to Malacca',
    status: 'approved',
    createdAt: '2026-04-12T16:20:00Z',
    managerId: 'usr_3',
    managerName: 'Aisha Rahman',
    managerComments: 'Approved, sales team coverage is sorted.',
    actionedAt: '2026-04-13T10:00:00Z'
  },
  {
    id: 'app_7',
    userId: 'usr_4',
    userName: 'Marcus Chen',
    department: 'Engineering',
    leaveType: 'childcare',
    startDate: '2026-04-15',
    endDate: '2026-04-16',
    isHalfDay: false,
    requestedDays: 2,
    reason: 'Taking son for primary school registration assessment and immunization.',
    status: 'approved',
    createdAt: '2026-04-05T09:10:00Z',
    managerId: 'usr_2',
    managerName: 'David Lim',
    managerComments: 'Approved. All the best for the school reg!',
    actionedAt: '2026-04-06T08:30:00Z'
  },
  {
    id: 'app_8',
    userId: 'usr_6',
    userName: 'Wei Jie Neo',
    department: 'HR & Admin',
    leaveType: 'annual',
    startDate: '2026-04-10',
    endDate: '2026-04-10',
    isHalfDay: true,
    halfDaySession: 'PM',
    requestedDays: 0.5,
    reason: 'Bank appointment for housing loan collection',
    status: 'approved',
    createdAt: '2026-04-02T13:40:00Z',
    managerId: 'usr_1',
    managerName: 'Sarah Tan',
    managerComments: 'Granted. Please ensure handovers for morning are done.',
    actionedAt: '2026-04-03T09:00:00Z'
  },
  {
    id: 'app_9',
    userId: 'usr_5',
    userName: 'Priya Selvam',
    department: 'Sales',
    leaveType: 'sick',
    startDate: '2026-02-12',
    endDate: '2026-02-12',
    isHalfDay: false,
    requestedDays: 1,
    reason: 'Wisdom tooth extraction at Q&M Dental',
    attachmentName: 'qm_dental_mc_556.pdf',
    status: 'approved',
    createdAt: '2026-02-12T07:45:00Z',
    managerId: 'usr_3',
    managerName: 'Aisha Rahman',
    managerComments: 'Approved, rest well Priya.',
    actionedAt: '2026-02-12T09:30:00Z'
  }
];

const initialSettings = {
  annualLeaveCarryForwardMax: 5,
  carryForwardExpiryMonth: 3,
  prorateNewJoiners: true,
  standardAnnualLeave: 14,
  standardSickLeave: 14,
  standardChildcareLeave: 6,
  grantMedicalOnConfirmation: 'mom',
  customMedicalRule: 'grant-5-sick',
  useDeptHeadAsDefaultApprover: true
};

const defaultDepartmentsList = [
  { id: 'dept_finance', department_name: 'Finance', department_code: 'FIN', description: 'Financial planning, accounting, and reporting', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_hr', department_name: 'Human Resources', department_code: 'HR', description: 'Talent acquisition, employee relations, and payroll', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_admin', department_name: 'Administration', department_code: 'ADM', description: 'Office management and general administration', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_sales', department_name: 'Sales', department_code: 'SLS', description: 'Business development, client acquisition, and sales', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_marketing', department_name: 'Marketing', department_code: 'MKT', description: 'Brand management, campaigns, and public relations', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_ops', department_name: 'Operations', department_code: 'OPS', description: 'Day-to-day business operations and logistics', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_cs', department_name: 'Customer Service', department_code: 'CS', description: 'Customer support, feedback, and success', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_it', department_name: 'IT / Technology', department_code: 'IT', description: 'Software engineering, IT infrastructure, and tech support', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_mgmt', department_name: 'Management', department_code: 'MGMT', description: 'Executive leadership and company management', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_legal', department_name: 'Legal / Compliance', department_code: 'LGL', description: 'Legal advisory, regulatory compliance, and governance', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_bd', department_name: 'Business Development', department_code: 'BD', description: 'Strategic partnerships and market expansion', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_procurement', department_name: 'Procurement', department_code: 'PRC', description: 'Sourcing, vendor management, and purchasing', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_product', department_name: 'Product', department_code: 'PROD', description: 'Product management, design, and strategy', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 'dept_others', department_name: 'Others', department_code: 'OTH', description: 'General other department grouping', status: 'Active', created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' }
];

const initialPublicHolidays = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-17', name: 'Chinese New Year (Day 1)' },
  { date: '2026-02-18', name: 'Chinese New Year (Day 2)' },
  { date: '2026-03-20', name: 'Hari Raya Puasa' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Labour Day' },
  { date: '2026-05-27', name: 'Hari Raya Haji' },
  { date: '2026-05-31', name: 'Vesak Day' },
  { date: '2026-08-09', name: 'National Day' },
  { date: '2026-08-10', name: 'National Day (Sub Holiday)' },
  { date: '2026-11-08', name: 'Deepavali' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-02-06', name: 'Chinese New Year (Day 1)' },
  { date: '2027-02-07', name: 'Chinese New Year (Day 2)' },
  { date: '2027-03-09', name: 'Hari Raya Puasa' },
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-05-01', name: 'Labour Day' },
  { date: '2027-05-16', name: 'Hari Raya Haji' },
  { date: '2027-05-20', name: 'Vesak Day' },
  { date: '2027-08-09', name: 'National Day' },
  { date: '2027-10-28', name: 'Deepavali' },
  { date: '2027-12-25', name: 'Christmas Day' }
];

const initialNotifications = [
  {
    id: 'nt_1',
    userId: 'usr_2',
    title: 'New Leave Request',
    message: 'Marcus Chen has submitted a request for 3 days of Annual Leave (06 Jul - 08 Jul).',
    isRead: false,
    createdAt: '2026-06-20T10:15:00Z',
    type: 'submission'
  },
  {
    id: 'nt_2',
    userId: 'usr_2',
    title: 'New Leave Request',
    message: 'Hana Suzuki has submitted a request for 3 days of Annual Leave (15 Jul - 17 Jul).',
    isRead: false,
    createdAt: '2026-06-23T14:30:00Z',
    type: 'submission'
  },
  {
    id: 'nt_3',
    userId: 'usr_1',
    title: 'New Sick Leave Request',
    message: 'Wei Jie Neo has submitted a request for 1 day of Sick Leave (25 Jun). MC is attached.',
    isRead: false,
    createdAt: '2026-06-24T08:00:00Z',
    type: 'submission'
  },
  {
    id: 'nt_4',
    userId: 'usr_1',
    title: 'New Leave Request',
    message: 'David Lim has submitted a request for 4 days of Annual Leave (11 Aug - 14 Aug).',
    isRead: false,
    createdAt: '2026-06-22T09:00:00Z',
    type: 'submission'
  }
];

const initialAuditLogs = [
  {
    id: 'log_1',
    actorId: 'usr_1',
    actorName: 'Sarah Tan',
    action: 'System Initialized',
    details: 'LeaveHub SG seeded with starting employees, Singapore standard rules, and public holidays.',
    timestamp: '2026-06-24T09:00:00Z'
  },
  {
    id: 'log_2',
    actorId: 'usr_4',
    actorName: 'Marcus Chen',
    action: 'Apply Leave',
    details: 'Submitted Annual Leave application for 2026-07-06 to 2026-07-08 (3 days).',
    timestamp: '2026-06-20T10:15:00Z'
  },
  {
    id: 'log_3',
    actorId: 'usr_2',
    actorName: 'David Lim',
    action: 'Approve Leave',
    details: "Approved Marcus Chen's Childcare Leave for 2026-04-15 to 2026-04-16.",
    timestamp: '2026-04-06T08:30:00Z'
  }
];

// Password hashing helpers
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function getCleanDefaultDb() {
  return {
    isSeeded: false,
    users: [],
    balances: [],
    applications: [],
    settings: {
      ...initialSettings,
      companyName: ''
    },
    notifications: [],
    auditLogs: [],
    holidays: initialPublicHolidays,
    departments: defaultDepartmentsList,
    leaveTypes: [
      { id: 'lt_1', name: 'Annual Leave', code: 'annual', isPaid: true, requiresAttachment: false, deductsFromBalance: true, defaultEntitlement: 14, allowHalfDay: true, isActive: true },
      { id: 'lt_2', name: 'Sick Leave', code: 'sick', isPaid: true, requiresAttachment: true, deductsFromBalance: true, defaultEntitlement: 14, allowHalfDay: true, isActive: true },
      { id: 'lt_3', name: 'Childcare Leave', code: 'childcare', isPaid: true, requiresAttachment: false, deductsFromBalance: true, defaultEntitlement: 6, allowHalfDay: true, isActive: true },
      { id: 'lt_4', name: 'Unpaid Leave', code: 'unpaid', isPaid: false, requiresAttachment: false, deductsFromBalance: false, defaultEntitlement: 0, allowHalfDay: true, isActive: true },
      { id: 'lt_5', name: 'Hospitalisation Leave', code: 'hospitalisation', isPaid: true, requiresAttachment: true, deductsFromBalance: false, defaultEntitlement: 60, allowHalfDay: false, isActive: true },
      { id: 'lt_6', name: 'Other Leave', code: 'other', isPaid: false, requiresAttachment: false, deductsFromBalance: false, defaultEntitlement: 0, allowHalfDay: true, isActive: true }
    ]
  };
}

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const cleanDb = getCleanDefaultDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(cleanDb, null, 2), 'utf-8');
      return cleanDb;
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(data);

    // If this is the legacy database structure with Sarah Tan mock user and NOT marked as seeded,
    // we reset it to empty for a clean slate, fulfilling Test 1 and the "starts empty" rule.
    if (db.users && db.users.some((u: any) => u.id === 'usr_1') && !db.isSeeded) {
      console.log('Detected legacy seeded DB without isSeeded flag. Overwriting with clean empty DB.');
      const cleanDb = getCleanDefaultDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(cleanDb, null, 2), 'utf-8');
      return cleanDb;
    }

    // Ensure departments and leaveTypes exist
    if (!db.departments || db.departments.length === 0 || typeof db.departments[0] === 'string') {
      db.departments = defaultDepartmentsList;
    }
    if (!db.leaveTypes) {
      db.leaveTypes = getCleanDefaultDb().leaveTypes;
    }

    return db;
  } catch (error) {
    console.error('Error reading database file', error);
    return getCleanDefaultDb();
  }
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing database file', error);
  }
}

// API Routes
app.get('/api/db', (req, res) => {
  const db = readDb();
  // Strip password hash and salt from public db call to keep it secure
  const publicDb = {
    ...db,
    users: db.users.map(({ passwordHash, salt, ...u }: any) => u)
  };
  res.json(publicDb);
});

// Setup the very first Admin
app.post('/api/auth/setup', (req, res) => {
  const { companyName, name, email, password } = req.body;
  if (!companyName || !name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const db = readDb();
  if (db.users && db.users.length > 0) {
    return res.status(400).json({ error: 'Company setup is already completed. Please log in.' });
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const adminId = `usr_admin_${Date.now()}`;

  const adminUser = {
    id: adminId,
    name,
    email: email.trim().toLowerCase(),
    role: 'admin',
    department: 'Human Resources',
    departmentId: 'dept_hr',
    joinDate: new Date().toISOString().split('T')[0],
    isActive: true,
    hasChildcareEligible: false,
    passwordHash,
    salt
  };

  db.users = [adminUser];
  
  // Set first admin as department head of Human Resources
  const updatedDepts = [...db.departments];
  const hrDeptIdx = updatedDepts.findIndex(d => d.id === 'dept_hr');
  if (hrDeptIdx !== -1) {
    updatedDepts[hrDeptIdx] = {
      ...updatedDepts[hrDeptIdx],
      department_head_user_id: adminId
    };
  }
  db.departments = updatedDepts;
  db.balances = [
    {
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
    }
  ];
  db.settings.companyName = companyName;
  db.isSeeded = false; // Fresh real database

  db.auditLogs = [
    {
      id: `log_${Date.now()}`,
      actorId: adminId,
      actorName: name,
      action: 'Company Setup',
      details: `First admin account created for ${companyName}: ${name} (${email})`,
      timestamp: new Date().toISOString()
    }
  ];

  writeDb(db);

  // Return user profile
  const { passwordHash: _, salt: __, ...userProfile } = adminUser;
  res.json({ success: true, user: userProfile });
});

app.post('/api/auth/register', (req, res) => {
  const {
    name,
    email,
    role,
    department,
    departmentId,
    joinDate,
    isActive,
    hasChildcareEligible,
    managerId,
    managerName,
    password,
    initialBal,
    mobile,
    title,
    type,
    carryForward,

    probation_required,
    probation_period_value,
    probation_period_unit,
    probation_start_date,
    probation_end_date,
    confirmation_date,
    confirmation_status,
    probation_extended,
    probation_extension_reason,
    employment_status
  } = req.body;
  const db = readDb();

  const emailTrimmed = email.trim().toLowerCase();
  const exists = db.users.some((u: any) => u.email.trim().toLowerCase() === emailTrimmed);
  if (exists) {
    return res.status(400).json({ error: 'This email is already registered.' });
  }

  const newUserId = `usr_${Date.now()}`;
  const salt = generateSalt();
  const passwordHash = hashPassword(password || 'password123', salt);

  const finalJoinDate = joinDate || new Date().toISOString().split('T')[0];

  const newUser = {
    id: newUserId,
    name,
    email: emailTrimmed,
    role,
    department,
    departmentId: departmentId || '',
    joinDate: finalJoinDate,
    join_date: finalJoinDate,
    isActive: isActive !== undefined ? isActive : true,
    hasChildcareEligible: !!hasChildcareEligible,
    managerId,
    managerName,
    mobile: mobile || '',
    title: title || 'Staff',
    type: type || 'Full-time',
    passwordHash,
    salt,

    // New schema fields
    first_login_at: '',
    last_login_at: '',
    probation_required: probation_required !== undefined ? !!probation_required : true,
    probation_period_value: probation_period_value !== undefined ? Number(probation_period_value) : 3,
    probation_period_unit: probation_period_unit || 'Months',
    probation_start_date: probation_start_date || finalJoinDate,
    probation_end_date: probation_end_date || '',
    confirmation_date: confirmation_date || '',
    confirmation_status: confirmation_status || 'On Probation',
    probation_extended: !!probation_extended,
    probation_extension_reason: probation_extension_reason || '',
    employment_status: employment_status || 'Active'
  };

  const newBalance = {
    userId: newUserId,
    annualEntitled: initialBal?.annualEntitled !== undefined ? initialBal.annualEntitled : (db.settings?.standardAnnualLeave || 14),
    annualCarriedForward: carryForward !== undefined ? Number(carryForward) : 0,
    annualUsed: 0,
    annualPending: 0,
    sickEntitled: initialBal?.sickEntitled !== undefined ? initialBal.sickEntitled : (db.settings?.standardSickLeave || 14),
    sickUsed: 0,
    sickPending: 0,
    childcareEntitled: initialBal?.childcareEntitled !== undefined ? initialBal.childcareEntitled : (hasChildcareEligible ? (db.settings?.standardChildcareLeave || 6) : 0),
    childcareUsed: 0,
    childcarePending: 0,
    unpaidUsed: 0,
    otherUsed: 0
  };

  const newAuditLog = {
    id: `log_${Date.now()}`,
    actorId: newUserId,
    actorName: name,
    action: 'Employee Added',
    details: `New employee added by admin: ${name} (${department}, ${role.toUpperCase()}) with secure password authentication.`,
    timestamp: new Date().toISOString()
  };

  db.users.push(newUser);
  db.balances.push(newBalance);
  db.auditLogs.unshift(newAuditLog);

  writeDb(db);

  // Return user without passwordHash & salt
  const { passwordHash: _, salt: __, ...userProfile } = newUser;
  res.json({ success: true, user: userProfile });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const db = readDb();
  const emailTrimmed = email.trim().toLowerCase();
  const user = db.users.find((u: any) => u.email.trim().toLowerCase() === emailTrimmed);

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Verify secure password hash
  const checkHash = hashPassword(password, user.salt || '');
  if (checkHash !== user.passwordHash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'This account has been deactivated. Please contact HR.' });
  }

  // Save first and last login times
  const currentTimestamp = new Date().toISOString();
  if (!user.first_login_at) {
    user.first_login_at = currentTimestamp;
  }
  user.last_login_at = currentTimestamp;

  writeDb(db);

  // Return user profile without security credentials
  const { passwordHash: _, salt: __, ...userProfile } = user;
  res.json({ success: true, user: userProfile });
});

app.post('/api/auth/change-password', (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  const db = readDb();
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const checkHash = hashPassword(currentPassword, user.salt || '');
  if (checkHash !== user.passwordHash) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const salt = generateSalt();
  user.salt = salt;
  user.passwordHash = hashPassword(newPassword, salt);

  db.auditLogs.unshift({
    id: `log_${Date.now()}`,
    actorId: user.id,
    actorName: user.name,
    action: 'Change Password',
    details: `Password changed successfully.`,
    timestamp: new Date().toISOString()
  });

  writeDb(db);
  res.json({ success: true });
});

app.post('/api/db/update', (req, res) => {
  const updates = req.body;
  const db = readDb();

  // Update lists from body but preserve hashed credentials for existing users
  if (updates.users) {
    db.users = updates.users.map((updatedUser: any) => {
      const existing = db.users.find((u: any) => u.id === updatedUser.id);
      if (existing) {
        return {
          ...updatedUser,
          passwordHash: existing.passwordHash,
          salt: existing.salt
        };
      }
      // If a new user was added client-side, give them a default hash/salt
      const salt = generateSalt();
      return {
        ...updatedUser,
        salt,
        passwordHash: hashPassword('password123', salt)
      };
    });
  }
  if (updates.balances) db.balances = updates.balances;
  if (updates.applications) db.applications = updates.applications;
  if (updates.settings) db.settings = updates.settings;
  if (updates.notifications) db.notifications = updates.notifications;
  if (updates.auditLogs) db.auditLogs = updates.auditLogs;
  if (updates.holidays) db.holidays = updates.holidays;
  if (updates.departments) db.departments = updates.departments;
  if (updates.leaveTypes) db.leaveTypes = updates.leaveTypes;

  writeDb(db);
  res.json({ success: true, db });
});

// Wipes database and restores to a clean first-setup state
app.post('/api/db/reset', (req, res) => {
  const cleanDb = getCleanDefaultDb();
  writeDb(cleanDb);
  res.json({ success: true, db: cleanDb });
});

// Seeds database with sample mock data securely hashed
app.post('/api/db/seed', (req, res) => {
  const db = readDb();

  // Populate list of seeded users with default hashed password 'password123'
  const seededUsers = initialUsers.map((user: any) => {
    const salt = generateSalt();
    const finalJoinDate = user.joinDate || '2024-01-15';
    
    // Calculate a standard 3-month probation period based on join date
    const jd = new Date(finalJoinDate);
    const ped = new Date(finalJoinDate);
    ped.setMonth(ped.getMonth() + 3);
    ped.setDate(ped.getDate() - 1);
    
    const conf = new Date(ped);
    conf.setDate(conf.getDate() + 1);

    const isConfirmed = new Date().getTime() > conf.getTime();

    let deptId = 'dept_others';
    let deptName = 'Others';
    if (user.department === 'HR & Admin') {
      deptId = 'dept_hr';
      deptName = 'Human Resources';
    } else if (user.department === 'Engineering') {
      deptId = 'dept_it';
      deptName = 'IT / Technology';
    } else if (user.department === 'Sales') {
      deptId = 'dept_sales';
      deptName = 'Sales';
    }

    return {
      ...user,
      department: deptName,
      departmentId: deptId,
      salt,
      passwordHash: hashPassword('password123', salt),
      mobile: '91234567',
      title: user.role === 'admin' ? 'HR Admin Director' : user.role === 'manager' ? 'Department Manager' : 'Software Engineer',
      type: 'Full-time',
      
      // New schema fields
      join_date: finalJoinDate,
      first_login_at: user.id === 'usr_1' ? new Date().toISOString() : '', // Simulate that Sarah Tan has logged in
      last_login_at: user.id === 'usr_1' ? new Date().toISOString() : '',
      probation_required: true,
      probation_period_value: 3,
      probation_period_unit: 'Months',
      probation_start_date: finalJoinDate,
      probation_end_date: ped.toISOString().split('T')[0],
      confirmation_date: conf.toISOString().split('T')[0],
      confirmation_status: isConfirmed ? 'Confirmed' : 'On Probation',
      probation_extended: false,
      probation_extension_reason: '',
      employment_status: 'Active'
    };
  });

  // Assign department head user IDs for seeded departments
  db.departments = defaultDepartmentsList.map(dept => {
    if (dept.id === 'dept_hr') {
      return { ...dept, department_head_user_id: 'usr_1' };
    }
    if (dept.id === 'dept_it') {
      return { ...dept, department_head_user_id: 'usr_2' };
    }
    if (dept.id === 'dept_sales') {
      return { ...dept, department_head_user_id: 'usr_3' };
    }
    return dept;
  });

  db.isSeeded = true;
  db.users = seededUsers;
  db.balances = initialBalances;
  
  // Map application departments to new department names
  db.applications = initialApplications.map((app: any) => {
    let deptName = app.department;
    if (app.department === 'HR & Admin') {
      deptName = 'Human Resources';
    } else if (app.department === 'Engineering') {
      deptName = 'IT / Technology';
    } else if (app.department === 'Sales') {
      deptName = 'Sales';
    }
    return {
      ...app,
      department: deptName
    };
  });

  db.notifications = initialNotifications;
  db.auditLogs = [
    {
      id: `log_seed_${Date.now()}`,
      actorId: 'usr_1',
      actorName: 'Sarah Tan',
      action: 'Load Seed Data',
      details: 'Admin clicked "Create sample data". Populated database with demo employees, balances, and history.',
      timestamp: new Date().toISOString()
    },
    ...initialAuditLogs
  ];
  db.settings.companyName = 'LeaveHub Singapore';
  if (db.settings) {
    db.settings.useDeptHeadAsDefaultApprover = true;
  }

  writeDb(db);
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
