/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RoundingRule = 'none' | 'down-05' | 'up-05' | 'nearest-whole' | 'up-whole';

/**
 * Calculates the completed months of service within a specific calendar year (Leave Year)
 * based on the Singapore MOM standard anniversary-to-anniversary completed month counting.
 */
export const calculateCompletedMonths = (joinDateStr: string, leaveYear: number): number => {
  if (!joinDateStr) return 0;
  const joinDate = new Date(joinDateStr);
  if (isNaN(joinDate.getTime())) return 0;

  const joinYear = joinDate.getFullYear();

  // If the employee joined AFTER the leave year, completed months is 0.
  if (joinYear > leaveYear) return 0;

  // If the employee joined BEFORE the leave year, they have completed the entire leave year.
  if (joinYear < leaveYear) return 12;

  // Joined within the leave year
  let completed = 0;
  const joinDay = joinDate.getDate();
  const joinMonth = joinDate.getMonth(); // 0-11

  for (let k = 1; k <= 12; k++) {
    // Calculate anniversary k (month overflows automatically in Date, but clamp the day)
    const annMonth = joinMonth + k;
    const tempDate = new Date(leaveYear, annMonth, 1);
    const lastDayInMonth = new Date(leaveYear, annMonth + 1, 0).getDate();
    const actualAnnDay = Math.min(joinDay, lastDayInMonth);

    const anniversaryK = new Date(leaveYear, annMonth, actualAnnDay);

    // The k-th completed month ends on (anniversaryK - 1) day
    const completionDateK = new Date(anniversaryK);
    completionDateK.setDate(completionDateK.getDate() - 1);

    const yearEnd = new Date(leaveYear, 11, 31, 23, 59, 59, 999);

    if (completionDateK.getTime() <= yearEnd.getTime()) {
      completed = k;
    } else {
      break;
    }
  }

  // Completed months cannot exceed 12 and cannot be negative
  return Math.max(0, Math.min(12, completed));
};

/**
 * Rounds a leave value based on the selected company-level rounding settings.
 */
export const roundProratedLeave = (val: number, rule: RoundingRule): number => {
  if (val < 0) return 0;
  switch (rule) {
    case 'none':
      // Keep decimal, rounded to 2 decimal places (e.g. 9.33)
      return Math.round(val * 100) / 100;
    case 'down-05':
      // Round down to nearest 0.5 day
      return Math.floor(val * 2) / 2;
    case 'up-05':
      // Round up to nearest 0.5 day
      return Math.ceil(val * 2) / 2;
    case 'nearest-whole':
      // Round to nearest whole day
      return Math.round(val);
    case 'up-whole':
      // Round up to nearest whole day
      return Math.ceil(val);
    default:
      return Math.round(val * 100) / 100;
  }
};

/**
 * Main function to calculate prorated annual leave.
 */
export const calculateProratedLeave = (
  joinDateStr: string,
  baseEntitlement: number,
  leaveYear: number,
  roundingRule: RoundingRule
): {
  completedMonths: number;
  systemCalculated: number;
  roundedCalculated: number;
  formulaStr: string;
} => {
  // Validate basic conditions
  if (!joinDateStr || baseEntitlement < 0) {
    return {
      completedMonths: 0,
      systemCalculated: 0,
      roundedCalculated: 0,
      formulaStr: `0 × 0 ÷ 12`
    };
  }

  const completedMonths = calculateCompletedMonths(joinDateStr, leaveYear);
  const systemCalculated = (baseEntitlement * completedMonths) / 12;
  const roundedCalculated = roundProratedLeave(systemCalculated, roundingRule);

  return {
    completedMonths,
    systemCalculated,
    roundedCalculated,
    formulaStr: `${baseEntitlement} × ${completedMonths} ÷ 12`
  };
};

/**
 * Calculates completed months of service between two dates.
 */
export const calculateCompletedMonthsBetween = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (start > end) return 0;

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  
  // Adjust if the day of the end date is less than the day of the start date
  const startDay = start.getDate();
  const endDay = end.getDate();
  
  if (endDay < startDay) {
    const lastDayInEndMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    if (endDay === lastDayInEndMonth && startDay >= lastDayInEndMonth) {
      // Completed month (e.g. Jan 31st to Feb 28th/29th)
    } else {
      months--;
    }
  }
  return Math.max(0, months);
};

import { CompanySettings } from '../types';

/**
 * Calculates Singapore MOM statutory medical and hospitalisation leave entitlements
 * based on completed months of service from Join Date to today (or end date).
 */
export const calculateMedicalEntitlements = (
  joinDateStr: string,
  currentDateStr: string,
  confirmationStatus: string | undefined,
  confirmationDateStr: string | undefined,
  settings: CompanySettings
): {
  momSick: number;
  momHosp: number;
  overrideSick: number | null;
  overrideHosp: number | null;
  finalSick: number;
  finalHosp: number;
  ruleApplied: string;
  completedMonths: number;
} => {
  if (!joinDateStr) {
    return {
      momSick: 0,
      momHosp: 0,
      overrideSick: null,
      overrideHosp: null,
      finalSick: 0,
      finalHosp: 0,
      ruleApplied: 'No Join Date provided',
      completedMonths: 0
    };
  }

  const completedMonths = calculateCompletedMonthsBetween(joinDateStr, currentDateStr);

  // Default MOM Statutory rules
  let momSick = 0;
  let momHosp = 0;

  if (completedMonths < 3) {
    momSick = 0;
    momHosp = 0;
  } else if (completedMonths === 3) {
    momSick = 5;
    momHosp = 15;
  } else if (completedMonths === 4) {
    momSick = 8;
    momHosp = 30;
  } else if (completedMonths === 5) {
    momSick = 11;
    momHosp = 45;
  } else {
    momSick = 14;
    momHosp = 60;
  }

  let overrideSick: number | null = null;
  let overrideHosp: number | null = null;
  let ruleApplied = 'MOM Statutory Minimum (by completed months)';

  const policy = settings.grantMedicalOnConfirmation || 'mom';

  if (policy === 'confirmation') {
    const isConfirmed = confirmationStatus === 'Confirmed' && confirmationDateStr && currentDateStr >= confirmationDateStr;
    if (isConfirmed) {
      // Early confirmation grants full company benefit (14 days sick, 60 days hospitalisation)
      overrideSick = 14;
      overrideHosp = 60;
      ruleApplied = 'Company Benefit Override (Early Confirmation)';
    }
  } else if (policy === 'custom') {
    const customRule = settings.customMedicalRule || 'grant-5-sick';
    const isConfirmed = confirmationStatus === 'Confirmed' && confirmationDateStr && currentDateStr >= confirmationDateStr;
    
    if (customRule === 'grant-5-sick' && isConfirmed) {
      overrideSick = 5;
      overrideHosp = 15;
      ruleApplied = 'Custom Policy Override (Grant 5 SL after confirmation)';
    } else if (customRule === 'grant-full' && isConfirmed) {
      overrideSick = 14;
      overrideHosp = 60;
      ruleApplied = 'Custom Policy Override (Grant Full SL after confirmation)';
    } else if (customRule === 'grant-prorated-pre3') {
      if (completedMonths < 3) {
        overrideSick = Math.min(14, Math.round(completedMonths * 1.5 * 10) / 10);
        overrideHosp = Math.min(60, Math.round(completedMonths * 5 * 10) / 10);
        ruleApplied = `Custom Policy Override (Prorated Medical Leave before 3 months)`;
      }
    } else if (customRule === 'require-manual') {
      ruleApplied = 'Custom Policy Override (Requires Manual Approval)';
    }
  }

  const finalSick = overrideSick !== null ? overrideSick : momSick;
  const finalHosp = overrideHosp !== null ? overrideHosp : momHosp;

  return {
    momSick,
    momHosp,
    overrideSick,
    overrideHosp,
    finalSick,
    finalHosp,
    ruleApplied,
    completedMonths
  };
};
