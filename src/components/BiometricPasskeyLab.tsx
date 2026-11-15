import React, { useState } from 'react';
import { ScanFace, Fingerprint, KeyRound, ShieldAlert } from 'lucide-react';
import {
  AuthLogEntry,
  BiometricOutcome,
  BiometricType,
  WirePayloadSnapshot,
} from '../types/auth';
import { PasskeyRegistrationVisualizer } from './PasskeyRegistrationVisualizer';

interface BiometricPasskeyLabProps {
  activeDomain: string;
  biometricType: BiometricType;
  onChangeBiometricType: (type: BiometricType) => void;
  biometricOutcome: BiometricOutcome;
  onChangeBiometricOutcome: (outcome: BiometricOutcome) => void;
  useRealWebAuthn: boolean;
  onToggleRealWebAuthn: (value: boolean) => void;
  latestPayload: WirePayloadSnapshot | null;
  logs: AuthLogEntry[];
  onQuickTrigger: (kind: 'passkey-signin' | 'passkey-register' | 'siwa' | 'vault-unlock') => void;
  onCapturePayload: (snapshot: WirePayloadSnapshot) => void;
}

export const BiometricPasskeyLab: React.FC<BiometricPasskeyLabProps> = ({
  activeDomain,
  biometricType,
  onChangeBiometricType,
  biometricOutcome,
  onChangeBiometricOutcome,
  useRealWebAuthn,
  onToggleRealWebAuthn,
  latestPayload,
  logs,
  onQuickTrigger,
  onCapturePayload,
}) => {
  const [inspectorTab, setInspectorTab] = useState<'payload' | 'acl' | 'logs'>('payload');

  const supportsWebAuthn =
    typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined';

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium text-sky-700">
          AuthenticationServices · LocalAuthentication · Security.Keychain
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Biometric & Passkey Integration Workbench
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
          Configure hardware biometry policy, inject LocalAuthentication error states, and inspect WebAuthn ES256 assertions or Sign in with Apple OIDC tokens alongside the interactive iOS simulator.
        </p>
      </div>

      {/* Hardware & Fault Injection Controls */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Biometric Hardware Profile */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            01. Biometric Hardware Policy
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Select active device biometry reported by LAContext.biometryType.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                { id: 'faceId', label: 'Face ID', icon: ScanFace },
                { id: 'touchId', label: 'Touch ID', icon: Fingerprint },
                { id: 'passcode', label: 'Passcode', icon: KeyRound },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = biometricType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeBiometricType(opt.id)}
                  className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
            <div>
              <div className="text-xs font-medium text-slate-900">
                Browser WebAuthn Bridge
              </div>
              <div className="text-[11px] text-slate-500">
                {supportsWebAuthn
                  ? 'Attempt navigator.credentials before iOS Secure Enclave fallback'
                  : 'WebAuthn API unavailable; using iOS Secure Enclave simulator'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useRealWebAuthn}
              onClick={() => onToggleRealWebAuthn(!useRealWebAuthn)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                useRealWebAuthn ? 'bg-sky-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                  useRealWebAuthn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* LAContext Outcome / Fault Injection */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-display text-sm font-semibold text-slate-900">
            02. LAContext Evaluation Outcome
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Simulate nominal match, first-attempt retry, cancellation, or lockout passcode fallback.
          </p>

          <div className="mt-4 space-y-2">
            {(
              [
                { id: 'success', label: 'Nominal Match (errSecSuccess)', detail: 'Grants Secure Enclave key release' },
                { id: 'mismatch', label: 'Biometry Mismatch -> Retry', detail: 'Fails first scan, succeeds on retry' },
                { id: 'lockout', label: 'LAError.biometryLockout (-8)', detail: 'Forces 6-digit iPhone Passcode fallback' },
                { id: 'userCancel', label: 'LAError.userCancel (-2)', detail: 'Aborts ASAuthorizationController cleanly' },
                { id: 'biometryNotEnrolled', label: 'LAError.biometryNotEnrolled (-7)', detail: 'Prompts Settings enrollment error' },
              ] as const
            ).map((opt) => {
              const active = biometricOutcome === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeBiometricOutcome(opt.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    active
                      ? 'border-sky-600 bg-sky-50 text-sky-950'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <span className="text-[11px] text-slate-500 hidden sm:inline">{opt.detail}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Scenario Launchers */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              03. Trigger AuthenticationServices Flows
            </h2>
            <p className="text-xs text-slate-600">
              Launch native iOS sheets inside the simulator to capture live cryptographic payloads.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onQuickTrigger('passkey-signin')}
              className="min-h-[40px] rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              Passkey Assertion
            </button>
            <button
              type="button"
              onClick={() => onQuickTrigger('passkey-register')}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              Passkey Registration
            </button>
            <button
              type="button"
              onClick={() => onQuickTrigger('siwa')}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              Sign in with Apple
            </button>
            <button
              type="button"
              onClick={() => onQuickTrigger('vault-unlock')}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              Unlock Passwords App
            </button>
          </div>
        </div>
      </div>

      {/* Mock Passkey Registration Payload & AuthenticationServices Visualizer */}
      <PasskeyRegistrationVisualizer
        activeDomain={activeDomain}
        biometricType={biometricType}
        onCapturePayload={onCapturePayload}
      />

      {/* Live Payload, ACL & Execution Log Inspector */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            {(
              [
                { id: 'payload', label: 'Wire Payload & JWT' },
                { id: 'acl', label: 'Keychain & Biometry ACL' },
                { id: 'logs', label: `Execution Log (${logs.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInspectorTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  inspectorTab === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {latestPayload && inspectorTab === 'payload' && (
            <span className="text-xs text-slate-500">
              {latestPayload.protocol} · {new Date(latestPayload.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="p-5">
          {inspectorTab === 'payload' && (
            <div>
              {latestPayload ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-sm font-semibold text-slate-900">
                        {latestPayload.flow}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {latestPayload.rpId ? `Relying Party: ${latestPayload.rpId}` : 'Local Policy Evaluation'}
                      </p>
                    </div>
                    {latestPayload.flags && (
                      <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-slate-700">
                        <span>UP={latestPayload.flags.UP ? '1' : '0'}</span>
                        <span>UV={latestPayload.flags.UV ? '1' : '0'}</span>
                        <span>BE={latestPayload.flags.BE ? '1' : '0'}</span>
                        <span>BS={latestPayload.flags.BS ? '1' : '0'}</span>
                      </div>
                    )}
                  </div>

                  <pre className="max-h-[340px] overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
                    {JSON.stringify(latestPayload.rawPayload, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-medium text-slate-800">
                    No cryptographic payload captured yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Run a Passkey assertion, registration, AutoFill, or Sign in with Apple flow in the iOS simulator to inspect the live wire payload.
                  </p>
                </div>
              )}
            </div>
          )}

          {inspectorTab === 'acl' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-xs font-medium text-slate-500">Access Control Flag</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
                    SecAccessControlCreateFlags.biometryCurrentSet
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    Invalidates Keychain item automatically if Face ID or Touch ID enrollments are added or removed on the device.
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-xs font-medium text-slate-500">Keychain Accessibility</div>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
                    kSecAttrAccessibleWhenUnlockedThisDeviceOnly
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                    Hardware-bound secrets remain in the Secure Enclave and are excluded from unencrypted device backups.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <span className="font-semibold">Passkey Sync vs. Local Secret:</span> Passkeys use{' '}
                  <code className="font-mono">ASAuthorizationPlatformPublicKeyCredentialProvider</code> and sync end-to-end encrypted via iCloud Keychain (BE=1, BS=1), whereas device-locked secrets use <code className="font-mono">ThisDeviceOnly</code>.
                </div>
              </div>
            </div>
          )}

          {inspectorTab === 'logs' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">Time</th>
                    <th className="py-2.5 pr-4 font-medium">Framework & Operation</th>
                    <th className="py-2.5 pr-4 font-medium">Domain</th>
                    <th className="py-2.5 pr-4 font-medium">Status</th>
                    <th className="py-2.5 text-right font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="font-mono text-[11px] font-semibold text-slate-900">
                          {log.operation}
                        </div>
                        <div className="text-[11px] text-slate-500">{log.detail}</div>
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {log.domain}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span
                          className={`font-mono text-[11px] font-semibold ${
                            log.success ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                        {log.latencyMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
