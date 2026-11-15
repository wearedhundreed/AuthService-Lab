import { useState, useEffect, useCallback, useRef } from 'react';
import { LogIn, LogOut, Cloud } from 'lucide-react';
import {
  AssistantRole,
  AuthLogEntry,
  BiometricOutcome,
  BiometricType,
  ChatMessageItem,
  ChatTaskMode,
  CredentialEntry,
  EmailProviderId,
  NavSection,
  TestSuiteResponse,
  UniversalEmailMessage,
  WirePayloadSnapshot,
} from './types/auth';
import { TopBar } from './components/TopBar';
import { IosDeviceSimulator, SimulatorAppView } from './components/IosDeviceSimulator';
import { BiometricPasskeyLab } from './components/BiometricPasskeyLab';
import { PasswordsVaultManager } from './components/PasswordsVaultManager';
import { AasaDomainValidator } from './components/AasaDomainValidator';
import { UniversalEmailClient } from './components/UniversalEmailClient';
import { SwiftImplementationKit } from './components/SwiftImplementationKit';
import { GeminiAssistantView } from './components/GeminiAssistantView';
import { TestSuiteDrawer } from './components/TestSuiteDrawer';
import { useFirebaseAuth } from './context/FirebaseAuthContext';

export default function App() {
  const {
    user,
    authReady,
    profileReady,
    authError,
    deviceTarget,
    cloudCredentials,
    cloudLogs,
    cloudMessages,
    cloudEmails,
    signInWithGoogle,
    signOutUser,
    updateDeviceTarget,
    saveCredentialToCloud,
    deleteCredentialFromCloud,
    saveLogToCloud,
    saveChatMessageToCloud,
    clearCloudChatMessages,
    saveEmailToCloud,
    deleteEmailFromCloud,
  } = useFirebaseAuth();

  const [activeSection, setActiveSection] = useState<NavSection>('biometrics');
  const [localCredentials, setLocalCredentials] = useState<CredentialEntry[]>([]);
  const [localLogs, setLocalLogs] = useState<AuthLogEntry[]>([]);
  const [localMessages, setLocalMessages] = useState<ChatMessageItem[]>([]);
  const [localEmails, setLocalEmails] = useState<UniversalEmailMessage[]>([]);

  // Simulator controls
  const [biometricType, setBiometricType] = useState<BiometricType>('faceId');
  const [biometricOutcome, setBiometricOutcome] = useState<BiometricOutcome>('success');
  const [useRealWebAuthn, setUseRealWebAuthn] = useState(false);
  const [simulatorAppView, setSimulatorAppView] = useState<SimulatorAppView>('app-login');
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [latestPayload, setLatestPayload] = useState<WirePayloadSnapshot | null>(null);

  const [externalTrigger, setExternalTrigger] = useState<{
    id: number;
    kind: 'passkey-register' | 'passkey-signin' | 'siwa' | 'autofill' | 'vault-unlock';
    credential?: CredentialEntry;
  } | null>(null);

  // Test suite runner
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testSuiteResult, setTestSuiteResult] = useState<TestSuiteResponse | null>(null);

  const seededUsersRef = useRef<Set<string>>(new Set());
  const seededEmailsRef = useRef<Set<string>>(new Set());

  const fetchVaultAndLogs = useCallback(async () => {
    try {
      const [credRes, logRes, emailRes] = await Promise.all([
        fetch('/api/credentials'),
        fetch('/api/audit/logs'),
        fetch('/api/emails'),
      ]);
      if (credRes.ok) {
        const cData = (await credRes.json()) as { credentials: CredentialEntry[] };
        setLocalCredentials(cData.credentials);
      }
      if (logRes.ok) {
        const lData = (await logRes.json()) as { logs: AuthLogEntry[] };
        setLocalLogs(lData.logs);
      }
      if (emailRes.ok) {
        const eData = (await emailRes.json()) as { emails: UniversalEmailMessage[] };
        setLocalEmails(eData.emails);
      }
    } catch {
      // Transient fetch failure
    }
  }, []);

  useEffect(() => {
    void fetchVaultAndLogs();
  }, [fetchVaultAndLogs]);

  // Seed Firestore once for newly signed-in users if their cloud vault is empty
  useEffect(() => {
    if (!user || !profileReady || cloudCredentials === null) return;
    if (cloudCredentials.length === 0 && localCredentials.length > 0 && !seededUsersRef.current.has(user.uid)) {
      seededUsersRef.current.add(user.uid);
      void Promise.all(localCredentials.map((c) => saveCredentialToCloud(c, true))).catch(() => {
        // Error already logged by handleFirestoreError
      });
    }
  }, [user, profileReady, cloudCredentials, localCredentials, saveCredentialToCloud]);

  // Seed Firestore emails once for newly signed-in users if their cloud inbox is empty
  useEffect(() => {
    if (!user || !profileReady || cloudEmails === null) return;
    if (cloudEmails.length === 0 && localEmails.length > 0 && !seededEmailsRef.current.has(user.uid)) {
      seededEmailsRef.current.add(user.uid);
      void Promise.all(localEmails.map((e) => saveEmailToCloud(e, true))).catch(() => {
        // Error already logged by handleFirestoreError
      });
    }
  }, [user, profileReady, cloudEmails, localEmails, saveEmailToCloud]);

  const activeCredentials =
    user && cloudCredentials && cloudCredentials.length > 0 ? cloudCredentials : localCredentials;
  const activeLogs =
    user && cloudLogs && cloudLogs.length > 0 ? cloudLogs : localLogs;
  const activeMessages = user ? cloudMessages : localMessages;
  const activeEmails =
    user && cloudEmails && cloudEmails.length > 0 ? cloudEmails : localEmails;

  const handleVaultUpdated = useCallback(
    async (nextCredentials: CredentialEntry[]) => {
      const prevIds = new Set(activeCredentials.map((c) => c.id));
      const nextIds = new Set(nextCredentials.map((c) => c.id));

      setLocalCredentials(nextCredentials);

      if (user) {
        for (const item of nextCredentials) {
          await saveCredentialToCloud(item, !prevIds.has(item.id));
        }
        for (const oldId of prevIds) {
          if (!nextIds.has(oldId)) {
            await deleteCredentialFromCloud(oldId);
          }
        }
      }
    },
    [activeCredentials, user, saveCredentialToCloud, deleteCredentialFromCloud]
  );

  const handleLogAppended = useCallback(async () => {
    try {
      const logRes = await fetch('/api/audit/logs');
      if (logRes.ok) {
        const lData = (await logRes.json()) as { logs: AuthLogEntry[] };
        setLocalLogs(lData.logs);
        if (user && lData.logs[0]) {
          await saveLogToCloud(lData.logs[0]);
        }
      }
    } catch {
      // Ignore transient error
    }
  }, [user, saveLogToCloud]);

  const handleRunTestSuite = async () => {
    setIsRunningTests(true);
    try {
      const res = await fetch('/api/tests/run', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as TestSuiteResponse;
        setTestSuiteResult(data);
        await handleLogAppended();
      }
    } catch {
      // Transient fetch failure handled gracefully
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleResetVault = async () => {
    try {
      const res = await fetch('/api/credentials/reset', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as {
          credentials: CredentialEntry[];
          logs: AuthLogEntry[];
        };
        setLocalCredentials(data.credentials);
        setLocalLogs(data.logs);
        setSelectedCredentialId(null);

        if (user) {
          for (const c of activeCredentials) {
            await deleteCredentialFromCloud(c.id);
          }
          for (const c of data.credentials) {
            await saveCredentialToCloud(c, true);
          }
        }
      }
    } catch {
      // Transient fetch failure handled gracefully
    }
  };

  const handleSendChatMessage = async (
    text: string,
    taskMode: ChatTaskMode,
    assistantRole: AssistantRole
  ) => {
    const userMsg: ChatMessageItem = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      text,
      model: taskMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen',
      taskMode,
      assistantRole,
      createdAt: new Date().toISOString(),
    };

    const historyForRequest = activeMessages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    if (user) {
      await saveChatMessageToCloud(userMsg);
    } else {
      setLocalMessages((prev) => [...prev, userMsg]);
    }

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: historyForRequest,
        taskMode,
        assistantRole,
        deviceTarget,
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errData.error || 'Gemini assistant failed to respond.');
    }

    const data = (await res.json()) as {
      reply: string;
      model: string;
      taskMode: ChatTaskMode;
    };

    const modelMsg: ChatMessageItem = {
      id: `msg_${Date.now()}_m`,
      role: 'model',
      text: data.reply,
      model: data.model,
      taskMode: data.taskMode,
      assistantRole,
      createdAt: new Date().toISOString(),
    };

    if (user) {
      await saveChatMessageToCloud(modelMsg);
    } else {
      setLocalMessages((prev) => [...prev, modelMsg]);
    }
  };

  const handleClearChat = async () => {
    if (user) {
      await clearCloudChatMessages();
    } else {
      setLocalMessages([]);
    }
  };

  const handleSaveEmail = async (email: UniversalEmailMessage, isNew: boolean) => {
    let saved = email;
    try {
      const endpoint = isNew ? '/api/emails' : `/api/emails/${encodeURIComponent(email.id)}`;
      const res = await fetch(endpoint, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email),
      });
      if (res.ok) {
        const data = (await res.json()) as { email: UniversalEmailMessage; emails: UniversalEmailMessage[] };
        setLocalEmails(data.emails);
        saved = data.email;
      }
    } catch {
      // Fallback to local state update when offline
      setLocalEmails((prev) =>
        isNew ? [email, ...prev] : prev.map((item) => (item.id === email.id ? email : item))
      );
    }
    if (user) {
      await saveEmailToCloud(saved, isNew).catch(() => {});
    }
  };

  const handleDeleteEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/emails/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = (await res.json()) as { emails: UniversalEmailMessage[] };
        setLocalEmails(data.emails);
      }
    } catch {
      setLocalEmails((prev) => prev.filter((item) => item.id !== id));
    }
    if (user) {
      await deleteEmailFromCloud(id).catch(() => {});
    }
  };

  const handleSimulateAuthEmail = async (
    kind: 'otp' | 'magic-link' | 'passkey-alert' | 'relay',
    to: string,
    providerHint: EmailProviderId
  ) => {
    try {
      const res = await fetch('/api/emails/simulate-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, to, providerHint }),
      });
      if (res.ok) {
        const data = (await res.json()) as { email: UniversalEmailMessage; emails: UniversalEmailMessage[] };
        setLocalEmails(data.emails);
        if (user) {
          await saveEmailToCloud(data.email, true).catch(() => {});
        }
      }
    } catch {
      // Transient fetch failure handled gracefully
    }
  };

  const handleResetEmails = async () => {
    try {
      const res = await fetch('/api/emails/reset', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { emails: UniversalEmailMessage[] };
        setLocalEmails(data.emails);
        if (user) {
          for (const e of activeEmails) {
            await deleteEmailFromCloud(e.id);
          }
          for (const e of data.emails) {
            await saveEmailToCloud(e, true);
          }
        }
      }
    } catch {
      // Transient fetch failure handled gracefully
    }
  };

  const triggerSimulatorFlow = (
    kind: 'passkey-register' | 'passkey-signin' | 'siwa' | 'autofill' | 'vault-unlock',
    credential?: CredentialEntry
  ) => {
    setActiveSection('biometrics');
    setExternalTrigger({ id: Date.now(), kind, credential });
  };

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        onRunTestSuite={() => void handleRunTestSuite()}
        isRunningTests={isRunningTests}
      />

      {/* Workspace Context & Firebase Auth Bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-900">
              {deviceTarget === 'iphone-12-pro' ? 'Target: iPhone 12 Pro' : 'Target: iPhone 16 Pro'}
            </span>
            <span aria-hidden="true">·</span>
            <span>iOS 18 AuthenticationServices</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5 text-sky-600" />
              {user ? `Firestore Synced (${user.email})` : 'Local Sandbox Mode'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {authError && (
              <span className="text-rose-700 font-medium">{authError}</span>
            )}
            {authReady && (
              user ? (
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-slate-50 whitespace-nowrap"
                >
                  <LogIn className="h-3.5 w-3.5 text-sky-600" />
                  Sign in with Google
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1440px] px-6 py-8">
        {activeSection === 'biometrics' && (
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_400px]">
            <BiometricPasskeyLab
              biometricType={biometricType}
              onChangeBiometricType={setBiometricType}
              biometricOutcome={biometricOutcome}
              onChangeBiometricOutcome={setBiometricOutcome}
              useRealWebAuthn={useRealWebAuthn}
              onToggleRealWebAuthn={setUseRealWebAuthn}
              latestPayload={latestPayload}
              logs={activeLogs}
              onQuickTrigger={(kind) => triggerSimulatorFlow(kind)}
              onCapturePayload={setLatestPayload}
            />

            <aside className="lg:sticky lg:top-20">
              <IosDeviceSimulator
                credentials={activeCredentials}
                deviceTarget={deviceTarget}
                onChangeDeviceTarget={(t) => void updateDeviceTarget(t)}
                biometricType={biometricType}
                biometricOutcome={biometricOutcome}
                useRealWebAuthn={useRealWebAuthn}
                activeAppView={simulatorAppView}
                onChangeAppView={setSimulatorAppView}
                selectedCredentialId={selectedCredentialId}
                onSelectCredentialId={setSelectedCredentialId}
                onVaultUpdated={(next) => void handleVaultUpdated(next)}
                onPayloadCaptured={setLatestPayload}
                onLogAppended={() => void handleLogAppended()}
                externalTrigger={externalTrigger}
              />
            </aside>
          </div>
        )}

        {activeSection === 'passwords' && (
          <PasswordsVaultManager
            credentials={activeCredentials}
            onVaultUpdated={(next) => void handleVaultUpdated(next)}
            onTestAutoFill={(cred) => triggerSimulatorFlow('autofill', cred)}
            onInspectInIos={(cred) => triggerSimulatorFlow('vault-unlock', cred)}
            onResetVault={handleResetVault}
          />
        )}

        {activeSection === 'aasa' && <AasaDomainValidator />}

        {activeSection === 'email' && (
          <UniversalEmailClient
            emails={activeEmails}
            defaultUserEmail={user?.email}
            isSignedIn={Boolean(user)}
            onSaveEmail={handleSaveEmail}
            onDeleteEmail={handleDeleteEmail}
            onSimulateAuthEmail={handleSimulateAuthEmail}
            onResetEmails={handleResetEmails}
          />
        )}

        {activeSection === 'swift' && <SwiftImplementationKit />}

        {activeSection === 'assistant' && (
          <GeminiAssistantView
            messages={activeMessages}
            deviceTarget={deviceTarget}
            isSignedIn={Boolean(user)}
            onSendMessage={handleSendChatMessage}
            onClearMessages={handleClearChat}
          />
        )}
      </main>

      <TestSuiteDrawer
        suite={testSuiteResult}
        onClose={() => setTestSuiteResult(null)}
        onReRun={() => void handleRunTestSuite()}
        isRunning={isRunningTests}
      />
    </div>
  );
}
