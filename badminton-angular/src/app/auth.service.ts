import { Injectable } from '@angular/core';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase.config';

export type UserRole = 'viewer' | 'editor' | 'owner';

export interface RoleRecord {
  username: string;
  memberId: number;
  role: UserRole;
  mustChangePassword: boolean;
  contactEmail?: string;
  createdAt: string;
  isTestAccount?: boolean;
}

// Must match the domain used by scripts/provision-member-accounts.js —
// members log in with a username, but Firebase Auth's email/password
// provider needs a syntactically valid (never delivered to) email.
const SYNTHETIC_EMAIL_DOMAIN = 'members.badminton-tracker.local';

export function syntheticEmail(username: string): string {
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Incorrect username or password.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a bit and try again.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    default: return 'Something went wrong. Please try again.';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  user: User | null = null;
  authReady = false;
  role: UserRole | null = null;
  username: string | null = null;
  mustChangePassword = false;
  errorMessage = '';

  private roleUnsubscribe: (() => void) | null = null;

  constructor() {
    onAuthStateChanged(auth, user => {
      this.user = user;
      this.authReady = true;
      this.roleUnsubscribe?.();
      this.roleUnsubscribe = null;
      this.role = null;
      this.username = null;
      this.mustChangePassword = false;

      if (user) {
        this.roleUnsubscribe = onSnapshot(doc(db, 'roles', user.uid), snapshot => {
          const data = snapshot.data() as RoleRecord | undefined;
          this.role = data?.role ?? null;
          this.username = data?.username ?? null;
          this.mustChangePassword = data?.mustChangePassword ?? false;
        });
      }
    });
  }

  get canEdit(): boolean {
    return this.role === 'editor' || this.role === 'owner';
  }

  get isOwner(): boolean {
    return this.role === 'owner';
  }

  async login(username: string, password: string): Promise<void> {
    this.errorMessage = '';
    try {
      const usernameDoc = await getDoc(doc(db, 'usernames', username));
      if (!usernameDoc.exists() || !usernameDoc.data()?.['uid']) {
        this.errorMessage = 'Incorrect username or password.';
        throw new Error('unknown username');
      }
      await signInWithEmailAndPassword(auth, syntheticEmail(username), password);
    } catch (err) {
      if (!this.errorMessage) this.errorMessage = friendlyAuthError(err);
      throw err;
    }
  }

  async signOutUser(): Promise<void> {
    await signOut(auth);
  }

  async completePasswordChange(newPassword: string, contactEmail?: string): Promise<void> {
    if (!this.user) return;
    this.errorMessage = '';
    try {
      await updatePassword(this.user, newPassword);
      const updates: Partial<RoleRecord> = { mustChangePassword: false };
      if (contactEmail && contactEmail.trim()) updates.contactEmail = contactEmail.trim();
      await setDoc(doc(db, 'roles', this.user.uid), updates, { merge: true });
    } catch (err) {
      this.errorMessage = friendlyAuthError(err);
      throw err;
    }
  }

  watchAllRoles(callback: (roles: (RoleRecord & { uid: string })[]) => void): () => void {
    return onSnapshot(collection(db, 'roles'), snapshot => {
      callback(snapshot.docs.map(d => ({ uid: d.id, ...(d.data() as RoleRecord) })));
    });
  }

  async setRole(uid: string, role: UserRole): Promise<void> {
    await setDoc(doc(db, 'roles', uid), { role }, { merge: true });
  }
}
