export type SubjectCard = {
  professor: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
  safe_to_skip: number;
  need_to_attend: number;
  status_hint: string;
};

export type CumulativeSubjectCard = {
  subject: string;
  present: number;
  total: number;
  percentage: number;
  safe_to_skip: number;
  need_to_attend: number;
  status_hint: string;
};

export type MonthlySnapshot = {
  month_key: string;
  label: string;
  cutoff_date: string;
  is_complete: boolean;
  is_mtd: boolean;
  overall: { percentage: number; present: number; total: number };
  subjects: CumulativeSubjectCard[];
  deltas: Record<string, number>;
  overall_delta: number | null;
  insight: string | null;
};

export type DashboardSummary = {
  overall: {
    total: number;
    present: number;
    absent: number;
    percentage: number;
    streak: number;
  };
  subject_cards: SubjectCard[];
  month_trend: Array<{ month: string; percentage: number; total: number; present: number }>;
  burnout_analysis: Array<{ day: string; attendance: number }>;
  predictive_trajectory: { projected_percentage: number };
};
