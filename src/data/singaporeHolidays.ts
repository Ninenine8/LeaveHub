/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PublicHoliday } from '../types';

// Accurate official Singapore public holidays for 2026 and 2027
export const initialPublicHolidays: PublicHoliday[] = [
  // 2026 Public Holidays
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

  // 2027 Public Holidays
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

/**
 * Checks if a given date string (YYYY-MM-DD) is a weekend or public holiday in Singapore.
 * Returns true if weekend or public holiday, false otherwise.
 */
export function isNonWorkingDay(dateStr: string, holidays: PublicHoliday[]): boolean {
  const date = new Date(dateStr);
  const day = date.getDay();
  // 0 is Sunday, 6 is Saturday
  if (day === 0 || day === 6) {
    return true;
  }
  return holidays.some(holiday => holiday.date === dateStr);
}

/**
 * Calculates the number of working days between start date and end date (inclusive).
 * Omits weekends and Singapore public holidays.
 */
export function calculateWorkingDays(startDateStr: string, endDateStr: string, holidays: PublicHoliday[]): number {
  if (!startDateStr || !endDateStr) return 0;
  
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  if (start > end) return 0;
  
  let workingDaysCount = 0;
  const current = new Date(start);
  
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    if (!isNonWorkingDay(dateStr, holidays)) {
      workingDaysCount++;
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return workingDaysCount;
}
