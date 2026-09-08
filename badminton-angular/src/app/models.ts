export interface Member {
  id: number;
  name: string;
  username: string;
}

export interface Payment {
  memberId: number;
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
  fromId: number;
  toId: number;
  amount: number;
  date: string;
  note: string;
}

export interface TrackerData {
  members: Member[];
  sessions: Session[];
  attendance: Record<string, number[]>;
  duesPayments?: DuesPayment[];
  nextId: number;
  nextMemberId: number;
}

export interface MemberSummary {
  id: number;
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
  id: number;
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
