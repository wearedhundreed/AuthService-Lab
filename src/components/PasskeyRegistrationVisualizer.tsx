import React, { useState, useEffect } from 'react';
import { RefreshCw, Copy, Check, ArrowDownRight, ShieldCheck, KeyRound } from 'lucide-react';
import { BiometricType, WirePayloadSnapshot } from '../types/auth';
import {
  generateMockPasskeyRegistrationPayload,
  MockPasskeyRegistrationPayload,
} from '../lib/passkeyPayload';

interface PasskeyRegistrationVisualizerProps {
  activeDomain: string;
  biometricType: BiometricType;
  onCapturePayload: (snapshot: WirePayloadSnapshot) => void;
}

export const PasskeyRegistrationVisualizer: React.FC<PasskeyRegistrationVisualizerProps> = ({
  activeDomain,
  biometricType,
  onCapturePayload,
}) => {
  const [rpId, setRpId] = useState(activeDomain);
  const [origin, setOrigin] = useState(`https://${activeDomain}`);
  const [username, setUsername] = useState('maya.lin@icloud.com');
  const [displayName, setDisplayName] = useState('Maya Lin');
  const [challengeOverride, setChallengeOverride] = useState('');
  const [payload, setPayload] = useState<MockPasskeyRegistrationPayload>(() =>
    generateMockPasskeyRegistrationPayload({
      rpId: activeDomain,
      origin: `https://${activeDomain}`,
      username: 'maya.lin@icloud.com',
      displayName: 'Maya Lin',
      biometricType,
    })
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const clean = activeDomain.trim() || 'securepasswordmanager.tech';
    setRpId(clean);
    setOrigin(`https://${clean}`);
    setPayload(
      generateMockPasskeyRegistrationPayload({
        rpId: clean,
        origin: `https://${clean}`,
        username,
        displayName,
        biometricType,
        challengeOverride,
      })
    );
  }, [activeDomain]);

  const handleGenerate = () => {
    const next = generateMockPasskeyRegistrationPayload({
      rpId,
      origin: origin.trim() || `https://${rpId.trim() || activeDomain}`,
      username,
      displayName,
      biometricType,
      challengeOverride,
    });
    setPayload(next);
    onCapturePayload(next.wireSnapshot);
  };

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-display text-sm font-semibold text-slate-900">
            04. Mock Passkey Registration Payload &amp; AuthenticationServices Visualizer
          </h2>
          <p className="mt-1 text-xs text-slate-600 max-w-2xl">
            Generate a hypothetical challenge and origin payload to inspect exactly what iOS{' '}
            <code className="font-mono text-slate-800">AuthenticationServices</code> sends to Secure Enclave and receives back in{' '}
            <code className="font-mono text-slate-800">ASAuthorizationPlatformPublicKeyCredentialRegistration</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Generate Mock Registration Payload
        </button>
      </div>

      {/* Hypothetical Inputs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs">
          <span className="font-medium text-slate-700">Relying Party ID (rpId)</span>
          <input
            type="text"
            value={rpId}
            onChange={(e) => {
              const nextRp = e.target.value;
              setRpId(nextRp);
              setOrigin(`https://${nextRp.trim().replace(/^https?:\/\//, '').split('/')[0] || 'securepasswordmanager.tech'}`);
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">Hypothetical Origin</span>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">Account Username</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="block text-xs">
          <span className="font-medium text-slate-700">Custom Challenge (Optional)</span>
          <input
            type="text"
            value={challengeOverride}
            onChange={(e) => setChallengeOverride(e.target.value)}
            placeholder="Auto 32-byte random Base64URL"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
          />
        </label>
      </div>

      {/* 3-Stage Framework Visualization */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Stage 1 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
              1. Request Options
            </span>
            <KeyRound className="h-4 w-4 text-sky-600" />
          </div>
          <div className="font-mono text-xs font-semibold text-slate-900">
            createCredentialRegistrationRequest
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-500">relyingPartyIdentifier</dt>
              <dd className="font-mono text-slate-900 break-all">
                {payload.requestToAuthenticationServices.relyingPartyIdentifier}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Associated Domain Entitlement</dt>
              <dd className="font-mono text-slate-900 break-all">
                {payload.requestToAuthenticationServices.associatedDomainEntitlement}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">challenge (Base64URL)</dt>
              <dd className="font-mono text-sky-800 break-all">
                {payload.requestToAuthenticationServices.challengeBase64Url}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">userID (opaque handle)</dt>
              <dd className="font-mono text-slate-700 break-all">
                {payload.requestToAuthenticationServices.userIDBase64Url}
              </dd>
            </div>
          </dl>
        </div>

        {/* Stage 2 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              2. Signed clientDataJSON
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-mono text-xs font-semibold text-slate-900">
            Secure Enclave + iCloud Keychain
          </div>
          <pre className="overflow-x-auto rounded-md bg-slate-950 p-2.5 font-mono text-[11px] leading-relaxed text-slate-100">
            {JSON.stringify(payload.clientDataJSON, null, 2)}
          </pre>
          <div className="flex flex-wrap gap-2 font-mono text-[11px] text-slate-700">
            <span>Flags {payload.authenticatorData.flagsByteHex}</span>
            <span>·</span>
            <span>UP={payload.authenticatorData.flags.UP ? '1' : '0'}</span>
            <span>UV={payload.authenticatorData.flags.UV ? '1' : '0'}</span>
            <span>BE={payload.authenticatorData.flags.BE ? '1' : '0'}</span>
            <span>BS={payload.authenticatorData.flags.BS ? '1' : '0'}</span>
            <span>AT={payload.authenticatorData.flags.AT ? '1' : '0'}</span>
          </div>
        </div>

        {/* Stage 3 */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
              3. Received by App
            </span>
            <ArrowDownRight className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="font-mono text-xs font-semibold text-slate-900">
            ASAuthorizationPlatformPublicKeyCredentialRegistration
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-500">credentialID</dt>
              <dd className="font-mono text-slate-900 break-all">
                {payload.receivedByAuthenticationServices.credentialID}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">rawClientDataJSON (Base64URL)</dt>
              <dd className="font-mono text-slate-700 break-all line-clamp-2">
                {payload.receivedByAuthenticationServices.rawClientDataJSON}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">rawAttestationObject (CBOR Base64URL)</dt>
              <dd className="font-mono text-slate-700 break-all line-clamp-2">
                {payload.receivedByAuthenticationServices.rawAttestationObject}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">COSE Public Key Algorithm</dt>
              <dd className="font-mono text-emerald-700">
                alg: -7 (ES256 / ECDSA P-256)
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Swift Delegate & Full JSON Actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3.5 py-2">
            <span className="font-mono text-[11px] font-semibold text-slate-700">
              ASAuthorizationControllerDelegate Reception (Swift)
            </span>
            <button
              type="button"
              onClick={() => void handleCopy('swift', payload.swiftInspectionSnippet)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {copiedKey === 'swift' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey === 'swift' ? 'Copied' : 'Copy Swift'}
            </button>
          </div>
          <pre className="overflow-x-auto bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-100">
            {payload.swiftInspectionSnippet}
          </pre>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3.5 py-2">
            <span className="font-mono text-[11px] font-semibold text-slate-700">
              Complete Mock JSON Payload
            </span>
            <button
              type="button"
              onClick={() => void handleCopy('json', JSON.stringify(payload.wireSnapshot.rawPayload, null, 2))}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
            >
              {copiedKey === 'json' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey === 'json' ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <pre className="max-h-[210px] overflow-auto bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-100">
            {JSON.stringify(payload.wireSnapshot.rawPayload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};
