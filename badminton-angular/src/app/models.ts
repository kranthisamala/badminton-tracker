export interface Payment {
  player: string;
  amount: number;
}

export interface Session {
  id: number;
  date: string;
  cost: number;
  payments: Payment[];
  notes: string;
}

export interface DuesPayment {
  id: number;
  from: string;
  to: string;
  amount: number;
  date: string;
  note: string;
}

export interface TrackerData {
  members: string[];
  sessions: Session[];
  attendance: Record<string, string[]>;
  duesPayments?: DuesPayment[];
  nextId: number;
}

export interface MemberSummary {
  name: string;
  owed: number;
  paid: number;
  duesPaid: number;
  balance: number;
}

export interface MemberAttendanceRecord {
  sessionId: number;
  date: string;
  cost: number;
  notes: string;
}

export interface MemberPaymentRecord {
  kind: 'session' | 'dues';
  sessionId: number | null;
  date: string;
  amount: number;
  label: string;
}

export interface MemberReport {
  name: string;
  sessionsAttended: number;
  totalSessions: number;
  attendanceRate: number;
  sessionPaid: number;
  totalPaid: number;
  totalOwed: number;
  duesPaid: number;
  duesReceived: number;
  netBalance: number;
  attendedSessions: MemberAttendanceRecord[];
  payments: MemberPaymentRecord[];
}
