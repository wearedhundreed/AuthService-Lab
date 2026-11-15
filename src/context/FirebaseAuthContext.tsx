import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GoogleAuthProvider, User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import {
  AbmAccountEntry,
  AuthLogEntry,
  ChatMessageItem,
  CredentialEntry,
  DeviceTarget,
  UniversalEmailMessage,
} from '../types/auth';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  profileReady: boolean;
  authError: string | null;
  deviceTarget: DeviceTarget;
  customDomain: string;
  cloudCredentials: CredentialEntry[] | null;
  cloudLogs: AuthLogEntry[] | null;
  cloudMessages: ChatMessageItem[];
  cloudEmails: UniversalEmailMessage[] | null;
  cloudAbmAccounts: AbmAccountEntry[] | null;
  workspaceAccessToken: string | null;
  signInWithGoogle: () => Promise<string | null>;
  clearWorkspaceAccessToken: () => void;
  signOutUser: () => Promise<void>;
  updateDeviceTarget: (target: DeviceTarget) => Promise<void>;
  updateCustomDomain: (domain: string) => Promise<void>;
  saveCredentialToCloud: (cred: CredentialEntry, isNew?: boolean) => Promise<void>;
  deleteCredentialFromCloud: (id: string) => Promise<void>;
  saveLogToCloud: (log: AuthLogEntry) => Promise<void>;
  saveChatMessageToCloud: (msg: ChatMessageItem) => Promise<void>;
  clearCloudChatMessages: () => Promise<void>;
  saveEmailToCloud: (email: UniversalEmailMessage, isNew?: boolean) => Promise<void>;
  deleteEmailFromCloud: (id: string) => Promise<void>;
  saveAbmAccountToCloud: (account: AbmAccountEntry, isNew?: boolean) => Promise<void>;
  deleteAbmAccountFromCloud: (id: string) => Promise<void>;
}

export const DEFAULT_CUSTOM_DOMAIN = 'securepasswordmanager.tech';
const CUSTOM_DOMAIN_STORAGE_KEY = 'authservices_custom_domain';

export function normalizeDomain(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .split(':')[0]
    .replace(/\.+$/, '');
  if (cleaned === 'auth.demo-ios.app' || cleaned === 'securepasswordmanager.net') {
    return DEFAULT_CUSTOM_DOMAIN;
  }
  if (cleaned.length >= 3 && cleaned.length <= 253 && !/\s/.test(cleaned) && cleaned.includes('.')) {
    return cleaned;
  }
  return DEFAULT_CUSTOM_DOMAIN;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export const FirebaseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [deviceTarget, setDeviceTarget] = useState<DeviceTarget>('iphone-12-pro');
  const [customDomain, setCustomDomain] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_DOMAIN_STORAGE_KEY);
      return stored ? normalizeDomain(stored) : DEFAULT_CUSTOM_DOMAIN;
    } catch {
      return DEFAULT_CUSTOM_DOMAIN;
    }
  });
  const [cloudCredentials, setCloudCredentials] = useState<CredentialEntry[] | null>(null);
  const [cloudLogs, setCloudLogs] = useState<AuthLogEntry[] | null>(null);
  const [cloudMessages, setCloudMessages] = useState<ChatMessageItem[]>([]);
  const [cloudEmails, setCloudEmails] = useState<UniversalEmailMessage[] | null>(null);
  const [cloudAbmAccounts, setCloudAbmAccounts] = useState<AbmAccountEntry[] | null>(null);
  const [workspaceAccessToken, setWorkspaceAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (nextUser) {
        setProfileReady(false);
        try {
          const ref = doc(db, 'users', nextUser.uid);
          const snap = await getDoc(ref);
          if (!snap.exists()) {
            let initialDomain = DEFAULT_CUSTOM_DOMAIN;
            try {
              const stored = localStorage.getItem(CUSTOM_DOMAIN_STORAGE_KEY);
              if (stored) initialDomain = normalizeDomain(stored);
            } catch {
              // Ignore storage read failure
            }
            await setDoc(ref, {
              uid: nextUser.uid,
              email: (nextUser.email || 'user@example.com').slice(0, 254),
              displayName: (nextUser.displayName || 'iOS Developer').slice(0, 120),
              deviceTarget: 'iphone-12-pro',
              customDomain: initialDomain,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            const data = snap.data() as { deviceTarget?: DeviceTarget; customDomain?: string };
            if (data.deviceTarget === 'iphone-12-pro' || data.deviceTarget === 'iphone-16-pro') {
              setDeviceTarget(data.deviceTarget);
            }
            if (typeof data.customDomain === 'string' && data.customDomain.length >= 3 && data.customDomain.length <= 253) {
              const normalized = normalizeDomain(data.customDomain);
              setCustomDomain(normalized);
              try {
                localStorage.setItem(CUSTOM_DOMAIN_STORAGE_KEY, normalized);
              } catch {
                // Ignore storage write failure
              }
            }
          }
          setProfileReady(true);
        } catch (err) {
          console.error('User profile sync error:', err);
          setAuthError((err as Error).message);
          setProfileReady(false);
        } finally {
          setAuthReady(true);
        }
      } else {
        setProfileReady(false);
        setAuthReady(true);
        setCloudCredentials(null);
        setCloudLogs(null);
        setCloudMessages([]);
        setCloudEmails(null);
        setCloudAbmAccounts(null);
        setWorkspaceAccessToken(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach user-scoped Firestore snapshot listeners only when authenticated and profile exists
  useEffect(() => {
    if (!authReady || !profileReady || !user) return;

    const uid = user.uid;
    const credsPath = `users/${uid}/credentials`;
    const logsPath = `users/${uid}/auditLogs`;
    const chatPath = `users/${uid}/chatMessages`;

    const credsQuery = query(
      collection(db, 'users', uid, 'credentials'),
      where('userId', '==', uid)
    );

    const unsubCreds = onSnapshot(
      credsQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const updatedTs = data.updatedAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
          const updatedIso = updatedTs?.toDate ? updatedTs.toDate().toISOString() : new Date().toISOString();
          return {
            sortMs: updatedTs?.toMillis ? updatedTs.toMillis() : 0,
            entry: {
              id: String(data.id || d.id),
              title: String(data.title || ''),
              domain: String(data.domain || ''),
              username: String(data.username || ''),
              password: String(data.password || ''),
              authKind: (data.authKind as CredentialEntry['authKind']) || 'password',
              hasPasskey: Boolean(data.hasPasskey),
              passkeyId: data.passkeyId ? String(data.passkeyId) : undefined,
              passkeyPublicKey: data.passkeyPublicKey ? String(data.passkeyPublicKey) : undefined,
              passkeySignCount: Number(data.passkeySignCount || 0),
              totpSecret: data.totpSecret ? String(data.totpSecret) : undefined,
              sharedGroup: data.sharedGroup ? String(data.sharedGroup) : undefined,
              notes: data.notes ? String(data.notes) : undefined,
              auditStatus: (data.auditStatus as CredentialEntry['auditStatus']) || 'strong',
              auditIssues:
                data.auditStatus === 'reused'
                  ? ['Reused password detected across domains']
                  : data.auditStatus === 'weak'
                    ? ['Low entropy password detected']
                    : [],
              entropyBits: Number(data.entropyBits || 64),
              lastUsedAt: updatedIso,
              updatedAt: updatedIso,
            } satisfies CredentialEntry,
          };
        });
        mapped.sort((a, b) => b.sortMs - a.sortMs);
        setCloudCredentials(mapped.map((m) => m.entry));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, credsPath);
      }
    );

    const logsQuery = query(
      collection(db, 'users', uid, 'auditLogs'),
      where('userId', '==', uid)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const ts = data.createdAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
          return {
            sortMs: ts?.toMillis ? ts.toMillis() : 0,
            entry: {
              id: String(data.id || d.id),
              timestamp: ts?.toDate ? ts.toDate().toISOString() : new Date().toISOString(),
              framework: (data.framework as AuthLogEntry['framework']) || 'AuthenticationServices',
              operation: String(data.operation || ''),
              domain: String(data.domain || ''),
              biometricType: (data.biometricType as AuthLogEntry['biometricType']) || 'faceId',
              statusCode: String(data.statusCode || ''),
              success: Boolean(data.success),
              latencyMs: Number(data.latencyMs || 0),
              detail: String(data.detail || ''),
            } satisfies AuthLogEntry,
          };
        });
        mapped.sort((a, b) => b.sortMs - a.sortMs);
        setCloudLogs(mapped.map((m) => m.entry));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, logsPath);
      }
    );

    const chatQuery = query(
      collection(db, 'users', uid, 'chatMessages'),
      where('userId', '==', uid)
    );

    const unsubChat = onSnapshot(
      chatQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const ts = data.createdAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
          return {
            sortMs: ts?.toMillis ? ts.toMillis() : 0,
            entry: {
              id: String(data.id || d.id),
              role: (data.role as 'user' | 'model') || 'user',
              text: String(data.text || ''),
              model: String(data.model || 'gemini-4-hydrogen'),
              taskMode: (data.taskMode as ChatMessageItem['taskMode']) || 'general',
              assistantRole:
                (data.assistantRole as ChatMessageItem['assistantRole']) || 'security-architect',
              createdAt: ts?.toDate ? ts.toDate().toISOString() : new Date().toISOString(),
            } satisfies ChatMessageItem,
          };
        });
        mapped.sort((a, b) => a.sortMs - b.sortMs);
        setCloudMessages(mapped.map((m) => m.entry));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, chatPath);
      }
    );

    const emailsPath = `users/${uid}/emails`;
    const emailsQuery = query(
      collection(db, 'users', uid, 'emails'),
      where('userId', '==', uid)
    );

    const unsubEmails = onSnapshot(
      emailsQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const createdTs = data.createdAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
          const updatedTs = data.updatedAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
          return {
            sortMs: updatedTs?.toMillis ? updatedTs.toMillis() : 0,
            entry: {
              id: String(data.id || d.id),
              folder: (data.folder as UniversalEmailMessage['folder']) || 'inbox',
              from: String(data.from || ''),
              to: String(data.to || ''),
              replyTo: data.replyTo ? String(data.replyTo) : undefined,
              subject: String(data.subject || ''),
              body: String(data.body || ''),
              providerHint: (data.providerHint as UniversalEmailMessage['providerHint']) || 'mailto',
              otpCode: data.otpCode ? String(data.otpCode) : undefined,
              magicLinkUrl: data.magicLinkUrl ? String(data.magicLinkUrl) : undefined,
              isRead: Boolean(data.isRead),
              isStarred: Boolean(data.isStarred),
              createdAt: createdTs?.toDate ? createdTs.toDate().toISOString() : new Date().toISOString(),
              updatedAt: updatedTs?.toDate ? updatedTs.toDate().toISOString() : new Date().toISOString(),
            } satisfies UniversalEmailMessage,
          };
        });
        mapped.sort((a, b) => b.sortMs - a.sortMs);
        setCloudEmails(mapped.map((m) => m.entry));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, emailsPath);
      }
    );

    const abmPath = `users/${uid}/abmAccounts`;
    const abmQuery = query(
      collection(db, 'users', uid, 'abmAccounts'),
      where('userId', '==', uid)
    );

    const unsubAbm = onSnapshot(
      abmQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const createdTs = data.createdAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
          const updatedTs = data.updatedAt as { toMillis?: () => number; toDate?: () => Date } | undefined;
          return {
            sortMs: updatedTs?.toMillis ? updatedTs.toMillis() : 0,
            entry: {
              id: String(data.id || d.id),
              managedAppleAccount: String(data.managedAppleAccount || ''),
              firstName: String(data.firstName || ''),
              middleName: data.middleName ? String(data.middleName) : '',
              lastName: String(data.lastName || ''),
              temporaryPassword: String(data.temporaryPassword || ''),
              sourceCsv: data.sourceCsv ? String(data.sourceCsv) : '',
              status: (data.status as AbmAccountEntry['status']) || 'pending_first_signin',
              createdAt: createdTs?.toDate ? createdTs.toDate().toISOString() : new Date().toISOString(),
              updatedAt: updatedTs?.toDate ? updatedTs.toDate().toISOString() : new Date().toISOString(),
            } satisfies AbmAccountEntry,
          };
        });
        mapped.sort((a, b) => b.sortMs - a.sortMs);
        setCloudAbmAccounts(mapped.map((m) => m.entry));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, abmPath);
      }
    );

    return () => {
      unsubCreds();
      unsubLogs();
      unsubChat();
      unsubEmails();
      unsubAbm();
    };
  }, [authReady, profileReady, user]);

  const signInWithGoogle = useCallback(async (): Promise<string | null> => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken ?? null;
      setWorkspaceAccessToken(token);
      return token;
    } catch (err) {
      setAuthError((err as Error).message);
      return null;
    }
  }, []);

  const clearWorkspaceAccessToken = useCallback(() => {
    setWorkspaceAccessToken(null);
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    setWorkspaceAccessToken(null);
    await signOut(auth);
  }, []);

  const updateDeviceTarget = useCallback(
    async (target: DeviceTarget) => {
      setDeviceTarget(target);
      if (!user) return;
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          deviceTarget: target,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const updateCustomDomain = useCallback(
    async (domain: string) => {
      const clean = normalizeDomain(domain);
      setCustomDomain(clean);
      try {
        localStorage.setItem(CUSTOM_DOMAIN_STORAGE_KEY, clean);
      } catch {
        // Ignore storage failure
      }
      if (!user || !profileReady) return;
      const path = `users/${user.uid}`;
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          customDomain: clean,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user, profileReady]
  );

  const saveCredentialToCloud = useCallback(
    async (cred: CredentialEntry, isNew = false) => {
      if (!user) return;
      const safeId = sanitizeId(cred.id);
      const docPath = `users/${user.uid}/credentials/${safeId}`;
      const safeTitle = (cred.title || cred.domain || 'Untitled').trim().slice(0, 120) || 'Untitled';
      const safeDomain = (cred.domain || 'example.com').trim().slice(0, 253) || 'example.com';
      const safeUsername = (cred.username || 'user@example.com').trim().slice(0, 254) || 'user@example.com';
      const payload: Record<string, unknown> = {
        id: safeId,
        userId: user.uid,
        title: safeTitle,
        domain: safeDomain,
        username: safeUsername,
        password: (cred.password || '').slice(0, 256),
        authKind: cred.authKind,
        hasPasskey: Boolean(cred.hasPasskey),
        passkeySignCount: Math.max(0, Math.round(cred.passkeySignCount || 0)),
        auditStatus: cred.auditStatus,
        entropyBits: Math.min(1024, Math.max(0, Math.round(cred.entropyBits || 0))),
        updatedAt: serverTimestamp(),
      };
      if (cred.passkeyId) payload.passkeyId = cred.passkeyId.slice(0, 256);
      if (cred.passkeyPublicKey) payload.passkeyPublicKey = cred.passkeyPublicKey.slice(0, 512);
      if (cred.totpSecret) payload.totpSecret = cred.totpSecret.slice(0, 128);
      if (cred.sharedGroup) payload.sharedGroup = cred.sharedGroup.slice(0, 120);
      if (cred.notes) payload.notes = cred.notes.slice(0, 1000);

      try {
        if (isNew) {
          await setDoc(doc(db, 'users', user.uid, 'credentials', safeId), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        } else {
          const existingSnap = await getDoc(doc(db, 'users', user.uid, 'credentials', safeId));
          if (!existingSnap.exists()) {
            await setDoc(doc(db, 'users', user.uid, 'credentials', safeId), {
              ...payload,
              createdAt: serverTimestamp(),
            });
          } else {
            const updatePayload = { ...payload };
            delete updatePayload.id;
            delete updatePayload.userId;
            await updateDoc(doc(db, 'users', user.uid, 'credentials', safeId), updatePayload);
          }
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, docPath);
      }
    },
    [user]
  );

  const deleteCredentialFromCloud = useCallback(
    async (id: string) => {
      if (!user) return;
      const safeId = sanitizeId(id);
      const docPath = `users/${user.uid}/credentials/${safeId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'credentials', safeId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  const saveLogToCloud = useCallback(
    async (log: AuthLogEntry) => {
      if (!user) return;
      const safeId = sanitizeId(log.id);
      const docPath = `users/${user.uid}/auditLogs/${safeId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'auditLogs', safeId), {
          id: safeId,
          userId: user.uid,
          framework: log.framework.slice(0, 64),
          operation: log.operation.slice(0, 256),
          domain: log.domain.slice(0, 253),
          biometricType: log.biometricType,
          statusCode: log.statusCode.slice(0, 128),
          success: Boolean(log.success),
          latencyMs: Math.min(60000, Math.max(0, Math.round(log.latencyMs))),
          detail: log.detail.slice(0, 512),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }
    },
    [user]
  );

  const saveChatMessageToCloud = useCallback(
    async (msg: ChatMessageItem) => {
      if (!user) return;
      const safeId = sanitizeId(msg.id);
      const docPath = `users/${user.uid}/chatMessages/${safeId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'chatMessages', safeId), {
          id: safeId,
          userId: user.uid,
          role: msg.role,
          text: msg.text.slice(0, 16000),
          model: msg.model.slice(0, 64),
          taskMode: msg.taskMode.slice(0, 32),
          assistantRole: msg.assistantRole.slice(0, 64),
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }
    },
    [user]
  );

  const clearCloudChatMessages = useCallback(async () => {
    if (!user) return;
    const path = `users/${user.uid}/chatMessages`;
    try {
      await Promise.all(
        cloudMessages.map((m) =>
          deleteDoc(doc(db, 'users', user.uid, 'chatMessages', sanitizeId(m.id)))
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }, [user, cloudMessages]);

  const saveEmailToCloud = useCallback(
    async (email: UniversalEmailMessage, isNew = false) => {
      if (!user) return;
      const safeId = sanitizeId(email.id);
      const docPath = `users/${user.uid}/emails/${safeId}`;
      const fromVal = (email.from || `noreply@${DEFAULT_CUSTOM_DOMAIN}`).trim().slice(0, 254);
      const toVal = (email.to || user.email || 'user@example.com').trim().slice(0, 254);
      const subjectVal = (email.subject || '(No Subject)').trim().slice(0, 300);
      const bodyVal = (email.body || ' ').slice(0, 16000);

      const payload: Record<string, unknown> = {
        id: safeId,
        userId: user.uid,
        folder: email.folder,
        from: fromVal.length >= 3 ? fromVal : 'app@demo-ios.app',
        to: toVal.length >= 3 ? toVal : 'user@example.com',
        subject: subjectVal.length >= 1 ? subjectVal : '(No Subject)',
        body: bodyVal.length >= 1 ? bodyVal : ' ',
        providerHint: email.providerHint,
        isRead: Boolean(email.isRead),
        isStarred: Boolean(email.isStarred),
        updatedAt: serverTimestamp(),
      };
      if (email.replyTo) payload.replyTo = email.replyTo.slice(0, 254);
      if (email.otpCode) payload.otpCode = email.otpCode.slice(0, 16);
      if (email.magicLinkUrl) payload.magicLinkUrl = email.magicLinkUrl.slice(0, 512);

      try {
        if (isNew) {
          await setDoc(doc(db, 'users', user.uid, 'emails', safeId), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        } else {
          const existingSnap = await getDoc(doc(db, 'users', user.uid, 'emails', safeId));
          if (!existingSnap.exists()) {
            await setDoc(doc(db, 'users', user.uid, 'emails', safeId), {
              ...payload,
              createdAt: serverTimestamp(),
            });
          } else {
            const updatePayload = { ...payload };
            delete updatePayload.id;
            delete updatePayload.userId;
            await updateDoc(doc(db, 'users', user.uid, 'emails', safeId), updatePayload);
          }
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, docPath);
      }
    },
    [user]
  );

  const deleteEmailFromCloud = useCallback(
    async (id: string) => {
      if (!user) return;
      const safeId = sanitizeId(id);
      const docPath = `users/${user.uid}/emails/${safeId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'emails', safeId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  const saveAbmAccountToCloud = useCallback(
    async (account: AbmAccountEntry, isNew = false) => {
      if (!user) return;
      const safeId = sanitizeId(account.id);
      const docPath = `users/${user.uid}/abmAccounts/${safeId}`;
      const appleAccount = (account.managedAppleAccount || '').trim().slice(0, 254);
      const first = (account.firstName || 'User').trim().slice(0, 120) || 'User';
      const last = (account.lastName || 'Account').trim().slice(0, 120) || 'Account';
      const tempPwd = (account.temporaryPassword || 'TempPass1').slice(0, 128) || 'TempPass1';

      const payload: Record<string, unknown> = {
        id: safeId,
        userId: user.uid,
        managedAppleAccount: appleAccount.length >= 3 ? appleAccount : 'user@appleaccount.com',
        firstName: first,
        lastName: last,
        temporaryPassword: tempPwd,
        status: account.status || 'pending_first_signin',
        updatedAt: serverTimestamp(),
      };
      if (account.middleName) payload.middleName = account.middleName.slice(0, 120);
      if (account.sourceCsv) payload.sourceCsv = account.sourceCsv.slice(0, 255);

      try {
        if (isNew) {
          await setDoc(doc(db, 'users', user.uid, 'abmAccounts', safeId), {
            ...payload,
            createdAt: serverTimestamp(),
          });
        } else {
          const existingSnap = await getDoc(doc(db, 'users', user.uid, 'abmAccounts', safeId));
          if (!existingSnap.exists()) {
            await setDoc(doc(db, 'users', user.uid, 'abmAccounts', safeId), {
              ...payload,
              createdAt: serverTimestamp(),
            });
          } else {
            const updatePayload = { ...payload };
            delete updatePayload.id;
            delete updatePayload.userId;
            await updateDoc(doc(db, 'users', user.uid, 'abmAccounts', safeId), updatePayload);
          }
        }
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, docPath);
      }
    },
    [user]
  );

  const deleteAbmAccountFromCloud = useCallback(
    async (id: string) => {
      if (!user) return;
      const safeId = sanitizeId(id);
      const docPath = `users/${user.uid}/abmAccounts/${safeId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'abmAccounts', safeId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        profileReady,
        authError,
        deviceTarget,
        customDomain,
        cloudCredentials,
        cloudLogs,
        cloudMessages,
        cloudEmails,
        cloudAbmAccounts,
        workspaceAccessToken,
        signInWithGoogle,
        clearWorkspaceAccessToken,
        signOutUser,
        updateDeviceTarget,
        updateCustomDomain,
        saveCredentialToCloud,
        deleteCredentialFromCloud,
        saveLogToCloud,
        saveChatMessageToCloud,
        clearCloudChatMessages,
        saveEmailToCloud,
        deleteEmailFromCloud,
        saveAbmAccountToCloud,
        deleteAbmAccountFromCloud,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebaseAuth(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseAuth must be used inside FirebaseAuthProvider');
  }
  return ctx;
}
