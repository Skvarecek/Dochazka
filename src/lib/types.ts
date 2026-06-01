export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: "employee" | "admin";
  hourly_rate: number;
  sick_rate_percent: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
};

export type EntryType = "work" | "vacation" | "sick" | "day_off";

export type WorkEntry = {
  id: string;
  user_id: string;
  date: string;
  hours: number;
  entry_type: EntryType;
  project_id: string | null;
  location: string | null;
  note: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  projects?: Project;
};

export type Project = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type PayrollItem = {
  id: string;
  user_id: string;
  month: string;
  type: "deduction" | "bonus";
  category: string;
  amount: number;
  description: string | null;
  is_recurring: boolean;
  created_at: string;
  profiles?: Profile;
};

export type Loan = {
  id: string;
  user_id: string;
  amount: number;
  description: string | null;
  date: string;
  monthly_deduction: number;
  remaining: number;
  is_paid_off: boolean;
  created_at: string;
  profiles?: Profile;
};

export type MonthlyLock = {
  id: string;
  month: string;
  locked_by: string | null;
  locked_at: string;
};
