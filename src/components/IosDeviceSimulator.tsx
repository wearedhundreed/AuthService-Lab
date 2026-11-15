import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Fingerprint,
  ScanFace,
  Lock,
  Unlock,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertTriangle,
  Users,
  Wifi,
  Hash,
  Sparkles,
} from 'lucide-react';
import {
  BiometricOutcome,
  BiometricType,
  CredentialEntry,
  DeviceTarget,
  WirePayloadSnapshot,
} from '../types/auth';
import appleAccountAvatar from '../assets/images/apple_account_avatar_1794685595627.jpg';

export type SimulatorAppView = 'app-login' | 'passwords-app';

interface PendingSheet {
  kind: 'passkey-register' | 'passkey-signin' | 'siwa' | 'autofill' | 'vault-unlock';
  title: string;
  subtitle: string;
  rpId: string;
  credential?: CredentialEntry;
  autoFillTarget?: 'login' | 'register';
}

interface IosDeviceSimulatorProps {
  activeDomain: string;
  credentials: CredentialEntry[];
  deviceTarget: DeviceTarget;
  onChangeDeviceTarget: (target: DeviceTarget) => void;
  biometricType: BiometricType;
  biometricOutcome: BiometricOutcome;
  useRealWebAuthn: boolean;
  activeAppView: SimulatorAppView;
  onChangeAppView: (view: SimulatorAppView) => void;
  selectedCredentialId: string | null;
  onSelectCredentialId: (id: string | null) => void;
  onVaultUpdated: (credentials: CredentialEntry[]) => void;
  onPayloadCaptured: (snapshot: WirePayloadSnapshot) => void;
  onLogAppended: () => void;
  externalTrigger?: {
    id: number;
    kind: PendingSheet['kind'];
    credential?: CredentialEntry;
  } | null;
}

function base64UrlToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const AVATAR_URL = appleAccountAvatar;

export const IosDeviceSimulator: React.FC<IosDeviceSimulatorProps> = ({
  activeDomain,
  credentials,
  deviceTarget,
  onChangeDeviceTarget,
  biometricType,
  biometricOutcome,
  useRealWebAuthn,
  activeAppView,
  onChangeAppView,
  selectedCredentialId,
  onSelectCredentialId,
  onVaultUpdated,
  onPayloadCaptured,
  onLogAppended,
  externalTrigger,
}) => {
  // App Sign-In state
  const [loginDomain, setLoginDomain] = useState(activeDomain);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginOtp, setLoginOtp] = useState('');

  useEffect(() => {
    setLoginDomain(activeDomain);
  }, [activeDomain]);
  const [focusedField, setFocusedField] = useState<'username' | 'password' | 'otp' | null>(null);
  const [signedInBanner, setSignedInBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Passwords App state
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [passwordsCategory, setPasswordsCategory] = useState<'all' | 'passkeys' | 'codes' | 'shared' | 'security'>('all');
  const [passwordsSearch, setPasswordsSearch] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState<{ code: string; remainingSeconds: number } | null>(null);

  // Biometric / Auth Sheet state
  const [pendingSheet, setPendingSheet] = useState<PendingSheet | null>(null);
  const [sheetPhase, setSheetPhase] = useState<'ready' | 'scanning' | 'mismatch' | 'passcode' | 'success' | 'error'>('ready');
  const [sheetErrorMsg, setSheetErrorMsg] = useState<string>('');
  const [hideMyEmail, setHideMyEmail] = useState(true);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  const selectedCredential = credentials.find((c) => c.id === selectedCredentialId) || null;

  const openSheet = useCallback((sheet: PendingSheet) => {
    setErrorBanner(null);
    setPendingSheet(sheet);
    setSheetPhase('ready');
    setSheetErrorMsg('');
    setPasscodeInput('');
  }, []);

  useEffect(() => {
    if (externalTrigger) {
      if (externalTrigger.kind === 'vault-unlock') {
        onChangeAppView('passwords-app');
        if (externalTrigger.credential) {
          onSelectCredentialId(externalTrigger.credential.id);
        }
        if (!vaultUnlocked) {
          openSheet({
            kind: 'vault-unlock',
            title: 'Unlock Passwords',
            subtitle: 'LAContext(.deviceOwnerAuthenticationWithBiometrics)',
            rpId: 'com.apple.Passwords',
            credential: externalTrigger.credential,
          });
        }
      } else if (externalTrigger.kind === 'autofill' && externalTrigger.credential) {
        onChangeAppView('app-login');
        setLoginDomain(externalTrigger.credential.domain);
        openSheet({
          kind: 'autofill',
          title: `AutoFill ${externalTrigger.credential.title}`,
          subtitle: `${externalTrigger.credential.username} · ${externalTrigger.credential.domain}`,
          rpId: externalTrigger.credential.domain,
          credential: externalTrigger.credential,
        });
      } else if (externalTrigger.kind === 'passkey-signin') {
        onChangeAppView('app-login');
        openSheet({
          kind: 'passkey-signin',
          title: 'Sign in with Passkey',
          subtitle: 'ASAuthorizationPlatformPublicKeyCredentialProvider',
          rpId: loginDomain,
          credential: externalTrigger.credential,
        });
      } else if (externalTrigger.kind === 'passkey-register') {
        onChangeAppView('app-login');
        openSheet({
          kind: 'passkey-register',
          title: 'Save Passkey',
          subtitle: `Save a passkey for ${loginUsername || 'maya.lin@icloud.com'} to iCloud Keychain`,
          rpId: loginDomain,
        });
      } else if (externalTrigger.kind === 'siwa') {
        onChangeAppView('app-login');
        openSheet({
          kind: 'siwa',
          title: 'Sign in with Apple',
          subtitle: 'AuthDemo iOS requests your name and email',
          rpId: 'appleid.apple.com',
        });
      }
    }
  }, [externalTrigger, loginDomain, loginUsername, onChangeAppView, onSelectCredentialId, openSheet, vaultUnlocked]);

  // Live TOTP polling when viewing a credential with totpSecret
  useEffect(() => {
    if (!vaultUnlocked || !selectedCredential?.totpSecret) {
      setTotpCode(null);
      return;
    }

    let cancelled = false;
    const fetchCode = async () => {
      try {
        const res = await fetch('/api/totp/code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: selectedCredential.totpSecret }),
        });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { code: string; remainingSeconds: number };
          setTotpCode({ code: data.code, remainingSeconds: data.remainingSeconds });
        }
      } catch {
        // Ignore transient network errors
      }
    };

    void fetchCode();
    const timer = setInterval(() => void fetchCode(), 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [vaultUnlocked, selectedCredential?.id, selectedCredential?.totpSecret]);

  const recordLog = async (payload: {
    framework: 'AuthenticationServices' | 'LocalAuthentication' | 'Security.Keychain' | 'Passwords.AutoFill';
    operation: string;
    domain: string;
    statusCode: string;
    success: boolean;
    latencyMs: number;
    detail: string;
  }) => {
    try {
      await fetch('/api/audit/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, biometricType }),
      });
      onLogAppended();
    } catch {
      // Ignore transient log persistence errors
    }
  };

  const completeSheetSuccess = async () => {
    if (!pendingSheet) return;
    try {

    if (pendingSheet.kind === 'vault-unlock') {
      setVaultUnlocked(true);
      await recordLog({
        framework: 'LocalAuthentication',
        operation: 'LAContext.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics)',
        domain: 'com.apple.Passwords',
        statusCode: 'errSecSuccess (0)',
        success: true,
        latencyMs: 280,
        detail: `Unlocked iOS Passwords vault via ${biometricType === 'faceId' ? 'Face ID' : biometricType === 'touchId' ? 'Touch ID' : 'Device Passcode'}.`,
      });
      onPayloadCaptured({
        flow: 'iOS Passwords Vault Unlock',
        protocol: 'LAContext Policy',
        timestamp: new Date().toISOString(),
        rawPayload: {
          policy: 'LAPolicy.deviceOwnerAuthenticationWithBiometrics',
          biometryType: biometricType,
          evaluatedPolicyDomainState: 'b8d9f0a21c3e4410a9f122c088e1d9a4',
          keychainAccessControl: 'SecAccessControlCreateWithFlags(.biometryCurrentSet)',
        },
      });
      setSheetPhase('success');
      setTimeout(() => setPendingSheet(null), 650);
      return;
    }

    if (pendingSheet.kind === 'autofill' && pendingSheet.credential) {
      const cred = pendingSheet.credential;
      setLoginDomain(cred.domain);
      setLoginUsername(cred.username);
      setLoginPassword(cred.password || 'Passkey-Authenticated');

      let generatedTotp: string | undefined;
      if (cred.totpSecret) {
        const totpRes = await fetch('/api/totp/code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: cred.totpSecret }),
        });
        if (totpRes.ok) {
          const tData = (await totpRes.json()) as { code: string };
          generatedTotp = tData.code;
          setLoginOtp(tData.code);
        }
      }

      await recordLog({
        framework: 'Passwords.AutoFill',
        operation: 'ASCredentialProviderViewController.completeRequest(withSelectedCredential:)',
        domain: cred.domain,
        statusCode: 'errSecSuccess (0)',
        success: true,
        latencyMs: 215,
        detail: `AutoFilled credentials${generatedTotp ? ` + TOTP (${generatedTotp})` : ''} for ${cred.username}.`,
      });

      onPayloadCaptured({
        flow: 'Passwords QuickType AutoFill',
        protocol: 'AutoFill Credential',
        timestamp: new Date().toISOString(),
        rpId: cred.domain,
        rawPayload: {
          serviceIdentifier: cred.domain,
          credentialClass: 'ASPasswordCredential',
          user: cred.username,
          passwordMasked: cred.password ? '••••••••••••' : '(Passkey-Only)',
          oneTimeCodeInjected: generatedTotp || null,
        },
      });

      setSignedInBanner(`AutoFilled ${cred.username} for ${cred.domain}`);
      setSheetPhase('success');
      setTimeout(() => setPendingSheet(null), 650);
      return;
    }

    if (pendingSheet.kind === 'passkey-register') {
      const targetUsername = loginUsername.trim() || 'maya.lin@icloud.com';
      const optRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rpId: pendingSheet.rpId,
          username: targetUsername,
          displayName: targetUsername.split('@')[0],
        }),
      });
      const optData = (await optRes.json()) as {
        challengeId: string;
        publicKey: {
          challenge: string;
          rp: { id: string; name: string };
          user: { id: string; name: string; displayName: string };
          pubKeyCredParams: Array<{ type: 'public-key'; alg: number }>;
          authenticatorSelection: AuthenticatorSelectionCriteria;
          timeout: number;
          attestation: AttestationConveyancePreference;
        };
      };

      let browserCredential: Record<string, unknown> | undefined;
      let mode: 'simulated-ios' | 'browser-webauthn' = 'simulated-ios';

      if (useRealWebAuthn && typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const created = (await navigator.credentials.create({
            publicKey: {
              ...optData.publicKey,
              challenge: base64UrlToUint8Array(optData.publicKey.challenge),
              user: {
                ...optData.publicKey.user,
                id: base64UrlToUint8Array(optData.publicKey.user.id),
              },
              rp: { id: window.location.hostname, name: optData.publicKey.rp.name },
            },
          })) as PublicKeyCredential | null;

          if (created) {
            mode = 'browser-webauthn';
            const resp = created.response as AuthenticatorAttestationResponse;
            browserCredential = {
              id: created.id,
              type: created.type,
              authenticatorAttachment: created.authenticatorAttachment,
              clientDataJSON: arrayBufferToBase64Url(resp.clientDataJSON),
            };
          }
        } catch (err) {
          // Gracefully log browser WebAuthn restriction (e.g. cross-origin iframe) and continue via simulated Secure Enclave
          browserCredential = {
            browserWebAuthnNote: `Browser WebAuthn unavailable in current context (${(err as Error).name}); executed iOS Secure Enclave simulation.`,
          };
        }
      }

      const verRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: optData.challengeId,
          domain: pendingSheet.rpId,
          username: targetUsername,
          biometricType,
          mode,
          browserCredential,
        }),
      });
      const verData = (await verRes.json()) as {
        passkeyId: string;
        publicKeySpki: string;
        challenge: string;
        rpId: string;
        flags: { UP: boolean; UV: boolean; BE: boolean; BS: boolean; AT: boolean };
        clientDataJSON: Record<string, unknown>;
        browserCredential: Record<string, unknown> | null;
        credentials: CredentialEntry[];
      };

      onVaultUpdated(verData.credentials);
      onLogAppended();
      onPayloadCaptured({
        flow: 'Passkey Registration (Attestation)',
        protocol: 'WebAuthn / FIDO2',
        timestamp: new Date().toISOString(),
        challenge: verData.challenge,
        rpId: verData.rpId,
        flags: verData.flags,
        rawPayload: {
          passkeyId: verData.passkeyId,
          algorithm: 'ES256 (ECDSA P-256 / Secure Enclave)',
          publicKeySpki: verData.publicKeySpki,
          clientDataJSON: verData.clientDataJSON,
          browserCredential: verData.browserCredential,
        },
      });

      setLoginUsername(targetUsername);
      setSignedInBanner(`Passkey registered & synced to iCloud Keychain for ${targetUsername}`);
      setSheetPhase('success');
      setTimeout(() => setPendingSheet(null), 700);
      return;
    }

    if (pendingSheet.kind === 'passkey-signin') {
      const optRes = await fetch('/api/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rpId: pendingSheet.rpId }),
      });
      const optData = (await optRes.json()) as {
        challengeId: string;
        publicKey: {
          challenge: string;
          rpId: string;
          allowCredentials: Array<{ type: 'public-key'; id: string; username: string; domain: string }>;
          userVerification: UserVerificationRequirement;
          timeout: number;
        };
      };

      let browserAssertion: Record<string, unknown> | undefined;
      let mode: 'simulated-ios' | 'browser-webauthn' = 'simulated-ios';

      if (useRealWebAuthn && typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const assertion = (await navigator.credentials.get({
            publicKey: {
              challenge: base64UrlToUint8Array(optData.publicKey.challenge),
              rpId: window.location.hostname,
              userVerification: 'required',
              timeout: 60000,
            },
          })) as PublicKeyCredential | null;

          if (assertion) {
            mode = 'browser-webauthn';
            const resp = assertion.response as AuthenticatorAssertionResponse;
            browserAssertion = {
              id: assertion.id,
              authenticatorData: arrayBufferToBase64Url(resp.authenticatorData),
              signature: arrayBufferToBase64Url(resp.signature),
            };
          }
        } catch (err) {
          browserAssertion = {
            browserWebAuthnNote: `Browser WebAuthn unavailable in current context (${(err as Error).name}); executed iOS Secure Enclave assertion.`,
          };
        }
      }

      const verRes = await fetch('/api/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: optData.challengeId,
          credentialId: pendingSheet.credential?.id || optData.publicKey.allowCredentials[0]?.id,
          biometricType,
          mode,
          browserAssertion,
        }),
      });
      const verData = (await verRes.json()) as {
        username: string;
        domain: string;
        passkeyId: string;
        signCount: number;
        signature: string;
        challenge: string;
        flags: { UP: boolean; UV: boolean; BE: boolean; BS: boolean; AT: boolean };
        browserAssertion: Record<string, unknown> | null;
        credentials: CredentialEntry[];
      };

      onVaultUpdated(verData.credentials);
      onLogAppended();
      onPayloadCaptured({
        flow: 'Passkey Sign-In (Assertion)',
        protocol: 'WebAuthn / FIDO2',
        timestamp: new Date().toISOString(),
        challenge: verData.challenge,
        rpId: verData.domain,
        flags: verData.flags,
        rawPayload: {
          passkeyId: verData.passkeyId,
          userHandle: verData.username,
          signCount: verData.signCount,
          signature: verData.signature,
          browserAssertion: verData.browserAssertion,
        },
      });

      setLoginUsername(verData.username);
      setSignedInBanner(`Signed in as ${verData.username} via Passkey (count: ${verData.signCount})`);
      setSheetPhase('success');
      setTimeout(() => setPendingSheet(null), 700);
      return;
    }

    if (pendingSheet.kind === 'siwa') {
      const res = await fetch('/api/siwa/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hideMyEmail,
          fullName: 'Maya Lin',
          realEmail: 'maya.lin@icloud.com',
          bundleId: 'com.authserviceslab.ios',
          biometricType,
        }),
      });
      const data = (await res.json()) as {
        userIdentifier: string;
        fullName: string;
        email: string;
        isPrivateEmail: boolean;
        authorizationCode: string;
        identityToken: string;
        decodedHeader: Record<string, unknown>;
        decodedClaims: Record<string, unknown>;
      };

      onLogAppended();
      onPayloadCaptured({
        flow: 'Sign in with Apple (ASAuthorizationAppleIDCredential)',
        protocol: 'Sign in with Apple (OIDC)',
        timestamp: new Date().toISOString(),
        rpId: 'appleid.apple.com',
        rawPayload: {
          userIdentifier: data.userIdentifier,
          email: data.email,
          isPrivateEmail: data.isPrivateEmail,
          authorizationCode: data.authorizationCode,
          identityTokenHeader: data.decodedHeader,
          identityTokenClaims: data.decodedClaims,
        },
      });

      setLoginUsername(data.email);
      setSignedInBanner(`Signed in with Apple (${data.email})`);
      setSheetPhase('success');
      setTimeout(() => setPendingSheet(null), 700);
    }
    } catch (err) {
      setSheetPhase('error');
      setSheetErrorMsg(
        err instanceof Error ? `Network request failed (${err.message}).` : 'Authentication request failed.'
      );
    }
  };

  const triggerBiometricAttempt = () => {
    if (!pendingSheet) return;
    setSheetPhase('scanning');

    setTimeout(async () => {
      try {
      if (biometricOutcome === 'userCancel') {
        setSheetPhase('error');
        setSheetErrorMsg('LAError.userCancel (-2): User canceled biometric evaluation.');
        await recordLog({
          framework: 'LocalAuthentication',
          operation: 'LAContext.evaluatePolicy',
          domain: pendingSheet.rpId,
          statusCode: 'LAError.userCancel (-2)',
          success: false,
          latencyMs: 190,
          detail: 'User tapped Cancel on biometric prompt.',
        });
        setErrorBanner('Authentication canceled by user (ASAuthorizationError.canceled).');
        return;
      }

      if (biometricOutcome === 'biometryNotEnrolled') {
        setSheetPhase('error');
        setSheetErrorMsg('LAError.biometryNotEnrolled (-7): No Face ID / Touch ID enrolled on device.');
        await recordLog({
          framework: 'LocalAuthentication',
          operation: 'LAContext.canEvaluatePolicy',
          domain: pendingSheet.rpId,
          statusCode: 'LAError.biometryNotEnrolled (-7)',
          success: false,
          latencyMs: 32,
          detail: 'Biometry not enrolled. Prompting user to enable Face ID in Settings.',
        });
        setErrorBanner('Biometry not enrolled (LAError.biometryNotEnrolled).');
        return;
      }

      if (biometricOutcome === 'lockout') {
        setSheetPhase('passcode');
        setSheetErrorMsg('LAError.biometryLockout (-8): Enter iPhone Passcode to re-enable biometry.');
        await recordLog({
          framework: 'LocalAuthentication',
          operation: 'LAContext.evaluatePolicy',
          domain: pendingSheet.rpId,
          statusCode: 'LAError.biometryLockout (-8)',
          success: false,
          latencyMs: 410,
          detail: 'Biometry locked out after consecutive failures; fell back to device Passcode.',
        });
        return;
      }

      if (biometricOutcome === 'mismatch' && sheetPhase !== 'mismatch') {
        setSheetPhase('mismatch');
        setSheetErrorMsg('Face Not Recognized — Tap Try Face ID Again to verify retry path.');
        await recordLog({
          framework: 'LocalAuthentication',
          operation: 'LAContext.evaluatePolicy',
          domain: pendingSheet.rpId,
          statusCode: 'LAError.authenticationFailed (-1)',
          success: false,
          latencyMs: 520,
          detail: 'First biometric attempt did not match; offering second attempt.',
        });
        return;
      }

      await completeSheetSuccess();
      } catch {
        setSheetPhase('error');
        setSheetErrorMsg('Biometric simulation encountered a network error.');
      }
    }, 520);
  };

  const handlePasscodeDigit = (digit: string) => {
    const next = passcodeInput + digit;
    setPasscodeInput(next);
    if (next.length === 6) {
      setTimeout(() => {
        void completeSheetSuccess();
      }, 180);
    }
  };

  const handleQuickTypeSuggestPassword = async () => {
    try {
      const res = await fetch('/api/passwords/generate?appleFormat=true');
      if (res.ok) {
        const data = (await res.json()) as { password: string; rulesDescriptor: string };
        setLoginPassword(data.password);
        await recordLog({
          framework: 'Passwords.AutoFill',
          operation: 'UITextPasswordRules.suggestStrongPassword()',
          domain: loginDomain,
          statusCode: 'errSecSuccess (0)',
          success: true,
          latencyMs: 18,
          detail: `Generated Apple Strong Password for ${loginDomain} (${data.rulesDescriptor}).`,
        });
      }
    } catch {
      // Offline fallback using Web Crypto
      const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const rnd = new Uint8Array(16);
      crypto.getRandomValues(rnd);
      const out = Array.from(rnd, (b) => chars[b % chars.length]);
      setLoginPassword(`${out.slice(0, 4).join('')}-${out.slice(4, 8).join('')}-${out.slice(8, 12).join('')}-${out.slice(12, 16).join('')}`);
    }
  };

  const handleCopyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1600);
    } catch {
      // Ignore clipboard permissions in sandbox
    }
  };

  const filteredVault = credentials.filter((item) => {
    const matchesSearch =
      !passwordsSearch.trim() ||
      item.title.toLowerCase().includes(passwordsSearch.toLowerCase()) ||
      item.domain.toLowerCase().includes(passwordsSearch.toLowerCase()) ||
      item.username.toLowerCase().includes(passwordsSearch.toLowerCase());

    if (!matchesSearch) return false;
    if (passwordsCategory === 'passkeys') return item.hasPasskey;
    if (passwordsCategory === 'codes') return Boolean(item.totpSecret);
    if (passwordsCategory === 'shared') return Boolean(item.sharedGroup);
    if (passwordsCategory === 'security') return item.auditStatus !== 'strong';
    return true;
  });

  const matchingAutoFillCreds = credentials.filter(
    (c) =>
      c.domain.includes(loginDomain.toLowerCase()) ||
      loginDomain.toLowerCase().includes(c.domain)
  );

  const counts = {
    all: credentials.length,
    passkeys: credentials.filter((c) => c.hasPasskey).length,
    codes: credentials.filter((c) => Boolean(c.totpSecret)).length,
    shared: credentials.filter((c) => Boolean(c.sharedGroup)).length,
    security: credentials.filter((c) => c.auditStatus !== 'strong').length,
  };

  const is12Pro = deviceTarget === 'iphone-12-pro';

  return (
    <div className="flex flex-col items-center">
      {/* Device Hardware Target Switcher */}
      <div className="mb-2.5 w-full max-w-[390px]">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => onChangeDeviceTarget('iphone-12-pro')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              is12Pro ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            iPhone 12 Pro
          </button>
          <button
            type="button"
            onClick={() => onChangeDeviceTarget('iphone-16-pro')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              !is12Pro ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            iPhone 16 Pro
          </button>
        </div>
        <p className="mt-1.5 text-center font-mono text-[11px] text-slate-500">
          {is12Pro
            ? '390x844 pt · TrueDepth Face ID Notch · A14 Secure Enclave'
            : '402x874 pt · Dynamic Island · A18 Pro Secure Enclave'}
        </p>
      </div>

      {/* Simulator App View Switcher */}
      <div className="mb-3 flex w-full max-w-[390px] items-center justify-between gap-2">
        <div className="flex flex-1 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => onChangeAppView('app-login')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeAppView === 'app-login'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            iOS App Sign-In
          </button>
          <button
            type="button"
            onClick={() => {
              onChangeAppView('passwords-app');
              if (!vaultUnlocked) {
                openSheet({
                  kind: 'vault-unlock',
                  title: 'Unlock Passwords',
                  subtitle: 'Face ID or Passcode required to view credentials',
                  rpId: 'com.apple.Passwords',
                });
              }
            }}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              activeAppView === 'passwords-app'
                ? 'bg-sky-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Passwords App
          </button>
        </div>
      </div>

      {/* Hardware Chassis (iPhone 12 Pro Stainless Steel Pacific Blue/Graphite vs iPhone 16 Pro Titanium) */}
      <div
        className={`relative w-full max-w-[390px] bg-slate-950 p-2 shadow-2xl shadow-slate-900/20 ${
          is12Pro
            ? 'rounded-[42px] border-[5px] border-slate-700 ring-1 ring-sky-900/40'
            : 'rounded-[48px] border-[6px] border-slate-800'
        }`}
      >
        {/* Screen Viewport */}
        <div
          className={`relative flex h-[740px] flex-col overflow-hidden bg-slate-50 text-slate-900 ${
            is12Pro ? 'rounded-[34px]' : 'rounded-[38px]'
          }`}
        >
          {/* iOS Status Bar + TrueDepth Notch (iPhone 12 Pro) or Dynamic Island (iPhone 16 Pro) */}
          <div
            className={`relative z-20 flex items-center justify-between bg-white/95 px-6 text-[11px] font-semibold text-slate-900 backdrop-blur-md ${
              is12Pro ? 'pt-2.5 pb-2' : 'pt-3 pb-2'
            }`}
          >
            <span className="tabular-nums">9:41</span>

            {is12Pro ? (
              /* iPhone 12 Pro TrueDepth Face ID Notch */
              <div className="absolute left-1/2 top-0 -translate-x-1/2 flex h-7 w-40 items-center justify-center rounded-b-2xl bg-slate-950 px-3 text-white">
                {sheetPhase === 'scanning' ? (
                  <div className="flex items-center gap-1.5">
                    {biometricType === 'touchId' ? (
                      <Fingerprint className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                    ) : (
                      <ScanFace className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                    )}
                    <span className="text-[10px] font-medium text-sky-300">TrueDepth Scan</span>
                  </div>
                ) : sheetPhase === 'success' ? (
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-300">Face ID Match</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className="h-1 w-10 rounded-full bg-slate-800" />
                    <span className="h-2 w-2 rounded-full bg-slate-800 ring-1 ring-slate-700" />
                  </div>
                )}
              </div>
            ) : (
              /* iPhone 16 Pro Dynamic Island */
              <div
                className={`flex items-center justify-center rounded-full bg-slate-950 text-white transition-all duration-200 ${
                  sheetPhase === 'scanning'
                    ? 'h-8 w-36 px-3 gap-2'
                    : sheetPhase === 'success'
                      ? 'h-8 w-32 px-3 gap-1.5'
                      : 'h-7 w-28'
                }`}
              >
                {sheetPhase === 'scanning' && (
                  <>
                    {biometricType === 'touchId' ? (
                      <Fingerprint className="h-4 w-4 text-sky-400 animate-pulse" />
                    ) : (
                      <ScanFace className="h-4 w-4 text-sky-400 animate-pulse" />
                    )}
                    <span className="text-[10px] font-medium text-sky-300">Verifying...</span>
                  </>
                )}
                {sheetPhase === 'success' && (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-300">Verified</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center gap-1.5 tabular-nums text-[10px]">
              <span>5G</span>
              <span className="inline-block h-2.5 w-4 rounded-sm border border-slate-900 p-[1px]">
                <span className="block h-full w-3/4 bg-slate-900" />
              </span>
            </div>
          </div>

          {/* VIEW 1: iOS App Sign-In & AutoFill Screen */}
          {activeAppView === 'app-login' && (
            <div className="flex flex-1 flex-col justify-between overflow-y-auto bg-slate-50">
              <div className="p-5 space-y-4">
                {/* Simulated App Header */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-xs font-medium text-sky-700">Associated Domain</p>
                    <select
                      aria-label="Test Associated Domain"
                      value={loginDomain}
                      onChange={(e) => setLoginDomain(e.target.value)}
                      className="mt-0.5 bg-transparent font-display text-base font-bold text-slate-900 focus:outline-none max-w-[230px] truncate"
                    >
                      <option value={activeDomain}>{activeDomain}</option>
                      {activeDomain !== 'securepasswordmanager.net' && (
                        <option value="securepasswordmanager.net">securepasswordmanager.net</option>
                      )}
                      {activeDomain !== 'github.com' && <option value="github.com">github.com</option>}
                      {activeDomain !== 'staging.internal.example' && (
                        <option value="staging.internal.example">staging.internal.example</option>
                      )}
                      {activeDomain !== 'figma.com' && <option value="figma.com">figma.com</option>}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginUsername('');
                      setLoginPassword('');
                      setLoginOtp('');
                      setSignedInBanner(null);
                      setErrorBanner(null);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                  >
                    Clear
                  </button>
                </div>

                {signedInBanner && (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span className="leading-snug">{signedInBanner}</span>
                  </div>
                )}

                {errorBanner && (
                  <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <span className="leading-snug">{errorBanner}</span>
                  </div>
                )}

                {/* iOS Form Inputs */}
                <div className="space-y-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      Username (.textContentType(.username))
                    </label>
                    <input
                      type="text"
                      value={loginUsername}
                      onFocus={() => setFocusedField('username')}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="maya.lin@icloud.com"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      Password (.textContentType(.newPassword))
                    </label>
                    <input
                      type="password"
                      value={loginPassword}
                      onFocus={() => setFocusedField('password')}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter or AutoFill password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-slate-500">
                      Verification Code (.textContentType(.oneTimeCode))
                    </label>
                    <input
                      type="text"
                      value={loginOtp}
                      onFocus={() => setFocusedField('otp')}
                      onChange={(e) => setLoginOtp(e.target.value)}
                      placeholder="6-digit TOTP"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                {/* Primary AuthenticationServices Buttons */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      openSheet({
                        kind: 'passkey-signin',
                        title: 'Sign in with Passkey',
                        subtitle: `Use a saved passkey for "${loginDomain}"`,
                        rpId: loginDomain,
                      })
                    }
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    <KeyRound className="h-4 w-4" />
                    Continue with Passkey
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openSheet({
                        kind: 'passkey-register',
                        title: 'Save a Passkey?',
                        subtitle: `Register a passkey for ${loginUsername || 'maya.lin@icloud.com'} on ${loginDomain}`,
                        rpId: loginDomain,
                      })
                    }
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
                  >
                    <ScanFace className="h-4 w-4 text-sky-600" />
                    Create Account with Passkey
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openSheet({
                        kind: 'siwa',
                        title: 'Sign in with Apple',
                        subtitle: 'Share your name and email or use Hide My Email',
                        rpId: 'appleid.apple.com',
                      })
                    }
                    className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
                  >
                    <span className="text-base leading-none" aria-hidden="true"></span>
                    Sign in with Apple
                  </button>
                </div>
              </div>

              {/* iOS QuickType AutoFill Bar */}
              <div className="border-t border-slate-200 bg-slate-100 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-slate-500">
                  <span>iOS Passwords QuickType AutoFill</span>
                  <span className="font-mono">{focusedField ? `Field: .${focusedField}` : 'Tap field or chip'}</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {matchingAutoFillCreds.length > 0 ? (
                    matchingAutoFillCreds.map((cred) => (
                      <button
                        key={cred.id}
                        type="button"
                        onClick={() =>
                          openSheet({
                            kind: 'autofill',
                            title: `AutoFill for ${cred.domain}`,
                            subtitle: `${cred.username} (${cred.hasPasskey ? 'Passkey + Password' : 'Saved Password'})`,
                            rpId: cred.domain,
                            credential: cred,
                          })
                        }
                        className="flex min-h-[38px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-left shadow-xs hover:bg-slate-50 shrink-0"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                        <div className="leading-tight">
                          <div className="text-[11px] font-semibold text-slate-900 whitespace-nowrap">
                            {cred.username}
                          </div>
                          <div className="text-[10px] text-slate-500 whitespace-nowrap">
                            {cred.totpSecret ? 'Password + Code' : cred.hasPasskey ? 'Passkey' : 'Password'}
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <span className="text-[11px] text-slate-500">No saved credentials for {loginDomain}</span>
                  )}

                  <button
                    type="button"
                    onClick={() => void handleQuickTypeSuggestPassword()}
                    className="flex min-h-[38px] items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 shrink-0 whitespace-nowrap"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggest Strong Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: iOS 18 Passwords App */}
          {activeAppView === 'passwords-app' && (
            <div className="flex flex-1 flex-col overflow-hidden bg-slate-100">
              {!vaultUnlocked ? (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                    <Lock className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-slate-900">
                    Passwords Locked
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 max-w-[240px]">
                    Authentication with Face ID, Touch ID, or device passcode is required to access saved credentials.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      openSheet({
                        kind: 'vault-unlock',
                        title: 'Unlock Passwords',
                        subtitle: 'LAContext(.deviceOwnerAuthenticationWithBiometrics)',
                        rpId: 'com.apple.Passwords',
                      })
                    }
                    className="mt-5 min-h-[44px] rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    Unlock with {biometricType === 'touchId' ? 'Touch ID' : 'Face ID'}
                  </button>
                </div>
              ) : selectedCredential ? (
                /* Credential Detail Screen inside iOS Passwords */
                <div className="flex flex-1 flex-col overflow-y-auto">
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCredentialId(null);
                        setRevealPassword(false);
                      }}
                      className="flex min-h-[36px] items-center gap-1 text-sm font-medium text-sky-600"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </button>
                    <span className="text-sm font-semibold text-slate-900 truncate max-w-[160px]">
                      {selectedCredential.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVaultUnlocked(false)}
                      className="flex min-h-[36px] items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                      Lock
                    </button>
                  </div>

                  <div className="space-y-4 p-4">
                    {/* Security Recommendation Alert */}
                    {selectedCredential.auditStatus !== 'strong' && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Security Recommendation</span>
                        </div>
                        <p className="mt-1 text-xs text-amber-800">
                          {selectedCredential.auditIssues[0] || 'This password should be rotated to a high-entropy unique password.'}
                        </p>
                      </div>
                    )}

                    {/* Primary Fields */}
                    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-slate-500">User Name</div>
                          <div className="truncate text-sm font-medium text-slate-900">
                            {selectedCredential.username}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopyText('username', selectedCredential.username)}
                          className="ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          aria-label="Copy username"
                        >
                          {copiedField === 'username' ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {selectedCredential.password && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-slate-500">Password</div>
                            <div className="truncate font-mono text-sm text-slate-900">
                              {revealPassword ? selectedCredential.password : '••••••••••••••••'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setRevealPassword((v) => !v)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              aria-label={revealPassword ? 'Hide password' : 'Reveal password'}
                            >
                              {revealPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyText('password', selectedCredential.password)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              aria-label="Copy password"
                            >
                              {copiedField === 'password' ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedCredential.hasPasskey && (
                        <div className="px-4 py-3">
                          <div className="text-[11px] font-medium text-slate-500">Passkey</div>
                          <div className="mt-0.5 flex items-center justify-between">
                            <span className="font-mono text-xs text-slate-800 truncate">
                              {selectedCredential.passkeyId}
                            </span>
                            <span className="text-[11px] font-medium text-emerald-700 shrink-0 ml-2 tabular-nums">
                              Uses: {selectedCredential.passkeySignCount}
                            </span>
                          </div>
                        </div>
                      )}

                      {selectedCredential.totpSecret && (
                        <div className="flex items-center justify-between px-4 py-3">
                          <div>
                            <div className="text-[11px] font-medium text-slate-500">Verification Code</div>
                            <div className="mt-0.5 flex items-baseline gap-2.5">
                              <span className="font-mono text-lg font-semibold tracking-wider text-sky-700 tabular-nums">
                                {totpCode ? `${totpCode.code.slice(0, 3)} ${totpCode.code.slice(3)}` : '------'}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                                {totpCode ? `${totpCode.remainingSeconds}s` : ''}
                              </span>
                            </div>
                          </div>
                          {totpCode && (
                            <button
                              type="button"
                              onClick={() => void handleCopyText('totp', totpCode.code)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              aria-label="Copy verification code"
                            >
                              {copiedField === 'totp' ? (
                                <Check className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Websites & Notes */}
                    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                      <div className="px-4 py-3">
                        <div className="text-[11px] font-medium text-slate-500">Website</div>
                        <div className="text-sm text-slate-900">{selectedCredential.domain}</div>
                      </div>
                      {selectedCredential.sharedGroup && (
                        <div className="px-4 py-3">
                          <div className="text-[11px] font-medium text-slate-500">Shared Group</div>
                          <div className="text-sm text-slate-900">{selectedCredential.sharedGroup}</div>
                        </div>
                      )}
                      {selectedCredential.notes && (
                        <div className="px-4 py-3">
                          <div className="text-[11px] font-medium text-slate-500">Notes</div>
                          <div className="text-xs text-slate-700 leading-relaxed">{selectedCredential.notes}</div>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onChangeAppView('app-login');
                        setLoginDomain(selectedCredential.domain);
                        openSheet({
                          kind: 'autofill',
                          title: `AutoFill ${selectedCredential.title}`,
                          subtitle: `${selectedCredential.username} · ${selectedCredential.domain}`,
                          rpId: selectedCredential.domain,
                          credential: selectedCredential,
                        });
                      }}
                      className="min-h-[44px] w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
                    >
                      Test AutoFill into App
                    </button>
                  </div>
                </div>
              ) : (
                /* iOS Passwords Home Grid & List */
                <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {!avatarLoadError ? (
                        <img
                          src={AVATAR_URL}
                          alt="Maya Lin iCloud Keychain profile"
                          referrerPolicy="no-referrer"
                          onError={() => setAvatarLoadError(true)}
                          className="h-9 w-9 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                          ML
                        </div>
                      )}
                      <div>
                        <h3 className="font-display text-lg font-bold leading-none text-slate-900">
                          Passwords
                        </h3>
                        <p className="mt-0.5 text-[11px] text-slate-500">iCloud Keychain Synced</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVaultUnlocked(false)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900"
                    >
                      Lock
                    </button>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={passwordsSearch}
                      onChange={(e) => setPasswordsSearch(e.target.value)}
                      placeholder="Search websites or usernames"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  {/* Category Tiles */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: 'all', label: 'All', count: counts.all, icon: KeyRound, accent: 'bg-sky-600' },
                        { id: 'passkeys', label: 'Passkeys', count: counts.passkeys, icon: ScanFace, accent: 'bg-slate-900' },
                        { id: 'codes', label: 'Codes', count: counts.codes, icon: Hash, accent: 'bg-emerald-600' },
                        { id: 'security', label: 'Security', count: counts.security, icon: AlertTriangle, accent: 'bg-amber-600' },
                      ] as const
                    ).map((cat) => {
                      const Icon = cat.icon;
                      const active = passwordsCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setPasswordsCategory(cat.id)}
                          className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition-colors ${
                            active
                              ? 'border-sky-500 bg-white ring-1 ring-sky-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-white ${cat.accent}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-display text-lg font-bold text-slate-900 tabular-nums">
                              {cat.count}
                            </span>
                          </div>
                          <span className="mt-2 text-xs font-semibold text-slate-700">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Secondary Filter Strip */}
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setPasswordsCategory(passwordsCategory === 'shared' ? 'all' : 'shared')}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-medium ${
                        passwordsCategory === 'shared'
                          ? 'border-sky-500 bg-sky-50 text-sky-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      Shared Groups ({counts.shared})
                    </button>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Wifi className="h-3 w-3" />
                      2 Wi-Fi Keys
                    </span>
                  </div>

                  {/* Credential List */}
                  <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                    {filteredVault.length === 0 ? (
                      <div className="p-5 text-center text-xs text-slate-500">
                        No credentials match this filter.
                      </div>
                    ) : (
                      filteredVault.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectCredentialId(item.id)}
                          className="flex min-h-[56px] w-full items-center justify-between px-3.5 py-2.5 text-left hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-slate-900">
                                {item.title}
                              </span>
                              {item.auditStatus !== 'strong' && (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              )}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {item.username} · {item.hasPasskey ? 'Passkey' : item.authKind === 'siwa' ? 'Apple ID' : 'Password'}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Home Indicator */}
          <div className="flex justify-center bg-white/80 py-2">
            <div className="h-1 w-28 rounded-full bg-slate-900/25" />
          </div>

          {/* System iOS Biometric / ASAuthorizationController Bottom Sheet */}
          {pendingSheet && (
            <div
              className="absolute inset-0 z-30 flex items-end bg-slate-950/45 backdrop-blur-[2px]"
              role="dialog"
              aria-modal="true"
              aria-label={pendingSheet.title}
            >
              <div className="w-full rounded-t-[30px] bg-white p-5 pb-7 shadow-2xl">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-display text-base font-bold text-slate-900">
                      {pendingSheet.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-600 leading-snug">
                      {pendingSheet.subtitle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingSheet(null)}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                </div>

                {pendingSheet.kind === 'siwa' && sheetPhase === 'ready' && (
                  <div className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setHideMyEmail(false)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">Share My Email</div>
                        <div className="text-slate-500">maya.lin@icloud.com</div>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          !hideMyEmail ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setHideMyEmail(true)}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">Hide My Email</div>
                        <div className="text-slate-500">Relay via privaterelay.appleid.com</div>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          hideMyEmail ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                        }`}
                      />
                    </button>
                  </div>
                )}

                {/* Biometric Sensor Trigger Area */}
                <div className="mt-5 flex flex-col items-center text-center">
                  {sheetPhase === 'passcode' ? (
                    <div className="w-full space-y-3">
                      <p className="text-xs font-medium text-amber-800">{sheetErrorMsg}</p>
                      <div className="flex justify-center gap-2.5">
                        {Array.from({ length: 6 }).map((_, idx) => (
                          <span
                            key={idx}
                            className={`h-3 w-3 rounded-full border ${
                              idx < passcodeInput.length
                                ? 'border-slate-900 bg-slate-900'
                                : 'border-slate-400 bg-white'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="mx-auto grid max-w-[220px] grid-cols-3 gap-2 pt-1">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, idx) =>
                          key === '' ? (
                            <div key={idx} />
                          ) : (
                            <button
                              key={key}
                              type="button"
                              onClick={() =>
                                key === '⌫'
                                  ? setPasscodeInput((p) => p.slice(0, -1))
                                  : handlePasscodeDigit(key)
                              }
                              className="h-10 rounded-xl bg-slate-100 font-display text-sm font-semibold text-slate-900 hover:bg-slate-200 tabular-nums"
                            >
                              {key}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={`flex h-16 w-16 items-center justify-center rounded-2xl border ${
                          sheetPhase === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                            : sheetPhase === 'error' || sheetPhase === 'mismatch'
                              ? 'border-rose-200 bg-rose-50 text-rose-600'
                              : 'border-sky-200 bg-sky-50 text-sky-600'
                        }`}
                      >
                        {sheetPhase === 'success' ? (
                          <ShieldCheck className="h-8 w-8" />
                        ) : biometricType === 'touchId' ? (
                          <Fingerprint className={`h-8 w-8 ${sheetPhase === 'scanning' ? 'animate-pulse' : ''}`} />
                        ) : (
                          <ScanFace className={`h-8 w-8 ${sheetPhase === 'scanning' ? 'animate-pulse' : ''}`} />
                        )}
                      </div>

                      {sheetErrorMsg && (
                        <p className="mt-2.5 text-xs font-medium text-rose-700">{sheetErrorMsg}</p>
                      )}

                      {sheetPhase !== 'success' && (
                        <button
                          type="button"
                          onClick={triggerBiometricAttempt}
                          disabled={sheetPhase === 'scanning'}
                          className="mt-4 min-h-[44px] w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
                        >
                          {sheetPhase === 'scanning'
                            ? 'Evaluating Biometry...'
                            : sheetPhase === 'mismatch'
                              ? 'Try Face ID Again'
                              : biometricType === 'touchId'
                                ? 'Authenticate with Touch ID'
                                : biometricType === 'passcode'
                                  ? 'Continue with Passcode'
                                  : 'Continue with Face ID'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
