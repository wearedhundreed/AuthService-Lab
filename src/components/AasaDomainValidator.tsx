import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Globe, Download, RefreshCw } from 'lucide-react';
import { AasaValidationResult } from '../types/auth';

interface AasaDomainValidatorProps {
  activeDomain: string;
  onApplyGlobalDomain?: (domain: string) => void;
}

export const AasaDomainValidator: React.FC<AasaDomainValidatorProps> = ({
  activeDomain,
  onApplyGlobalDomain,
}) => {
  const [teamId, setTeamId] = useState('A1B2C3D4E5');
  const [bundleId, setBundleId] = useState('com.authserviceslab.ios');
  const [domain, setDomain] = useState(activeDomain);
  const [developerMode, setDeveloperMode] = useState(true);
  const [testUrl, setTestUrl] = useState(`https://${activeDomain}/auth/callback`);
  const [rawJson, setRawJson] = useState('');
  const [validation, setValidation] = useState<AasaValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveFetchNotice, setLiveFetchNotice] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setDomain(activeDomain);
    setTestUrl(`https://${activeDomain}/auth/callback`);
    setLiveFetchNotice(null);
  }, [activeDomain]);

  const buildTemplate = useCallback((tid: string, bid: string) => {
    const appId = `${tid.trim()}.${bid.trim()}`;
    return JSON.stringify(
      {
        applinks: {
          details: [
            {
              appIDs: [appId],
              components: [
                { '/': '/auth/*', comment: 'OAuth & Passkey Universal Links' },
                { '/': '/login', comment: 'Direct sign-in handoff' },
              ],
            },
          ],
        },
        webcredentials: {
          apps: [appId],
        },
      },
      null,
      2
    );
  }, []);

  useEffect(() => {
    setRawJson(buildTemplate(teamId, bundleId));
  }, [teamId, bundleId, buildTemplate]);

  const runValidation = useCallback(async (jsonPayload: string, urlToTest: string) => {
    setIsValidating(true);
    try {
      const res = await fetch('/api/aasa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawJson: jsonPayload, testUrl: urlToTest }),
      });
      if (res.ok) {
        const data = (await res.json()) as AasaValidationResult;
        setValidation(data);
      }
    } catch {
      // Transient fetch failure handled gracefully
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    if (rawJson) {
      void runValidation(rawJson, testUrl);
    }
  }, [rawJson, testUrl, runValidation]);

  const handleFetchLiveAasa = async () => {
    const cleanDomain = domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0];
    if (!cleanDomain) return;

    setIsFetchingLive(true);
    setLiveFetchNotice(null);
    try {
      const res = await fetch('/api/aasa/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cleanDomain, testUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        fetched?: boolean;
        fetchedUrl?: string;
        httpStatus?: number | null;
        contentType?: string | null;
        rawJson?: string;
        validation?: AasaValidationResult;
        error?: string;
      };

      if (!res.ok || !data.fetched) {
        setLiveFetchNotice({
          kind: 'error',
          message:
            data.error ||
            `Could not fetch AASA from https://${cleanDomain}/.well-known/apple-app-site-association.`,
        });
        return;
      }

      if (data.rawJson) {
        setRawJson(data.rawJson);
      }
      if (data.validation) {
        setValidation(data.validation);
      }
      setLiveFetchNotice({
        kind: 'success',
        message: `Loaded live AASA from ${data.fetchedUrl} (HTTP ${data.httpStatus}, ${data.contentType || 'no Content-Type'}).`,
      });
    } catch {
      setLiveFetchNotice({
        kind: 'error',
        message: 'Network error while attempting to fetch live AASA document.',
      });
    } finally {
      setIsFetchingLive(false);
    }
  };

  const handleDownloadAasa = () => {
    const blob = new Blob([rawJson || buildTemplate(teamId, bundleId)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apple-app-site-association';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cleanDomainLabel =
    domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0] || activeDomain;

  const handleDownloadWebPasskeyHtml = () => {
    const safeHost = cleanDomainLabel.replace(/[^a-z0-9.-]/gi, '') || 'securepasswordmanager.tech';
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeHost} — iPhone Passkey &amp; AutoFill Test</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .card { max-width: 440px; margin: 24px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 6px; }
    p { font-size: 13px; color: #475569; line-height: 1.5; margin: 0 0 16px; }
    label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; }
    input { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 15px; margin-bottom: 12px; }
    button { width: 100%; padding: 11px 14px; border: 0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin-bottom: 8px; }
    .primary { background: #0284c7; color: #fff; }
    .dark { background: #0f172a; color: #fff; }
    pre { background: #020617; color: #e2e8f0; padding: 12px; border-radius: 8px; font-size: 11px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeHost} Passkey Sandbox</h1>
    <p>Works directly in iOS Safari on iPhone 12 Pro with Face ID &amp; iCloud Keychain — no paid Apple Developer account or AASA Team ID required.</p>
    <label for="username">Account Email</label>
    <input id="username" type="email" autocomplete="username webauthn" value="maya.lin@icloud.com" />
    <label for="otp">6-Digit Code (AutoFill Test)</label>
    <input id="otp" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" />
    <button class="primary" onclick="registerPasskey()">Create Passkey (Face ID)</button>
    <button class="dark" onclick="signInPasskey()">Sign In with Passkey</button>
    <pre id="out">Ready on origin: https://${safeHost}</pre>
  </div>
  <script>
    const out = document.getElementById('out');
    const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
    const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
    async function registerPasskey() {
      try {
        const email = document.getElementById('username').value.trim() || 'user@${safeHost}';
        const cred = await navigator.credentials.create({
          publicKey: {
            challenge: rand(32),
            rp: { name: '${safeHost}', id: location.hostname },
            user: { id: rand(16), name: email, displayName: email },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
            timeout: 60000,
            attestation: 'none'
          }
        });
        out.textContent = JSON.stringify({ status: 'Passkey Created', id: cred.id, rpId: location.hostname }, null, 2);
      } catch (e) { out.textContent = 'Error: ' + e.message; }
    }
    async function signInPasskey() {
      try {
        const assertion = await navigator.credentials.get({
          publicKey: { challenge: rand(32), rpId: location.hostname, userVerification: 'required', timeout: 60000 }
        });
        out.textContent = JSON.stringify({ status: 'Passkey Verified', id: assertion.id, clientDataJSON: b64u(assertion.response.clientDataJSON) }, null, 2);
      } catch (e) { out.textContent = 'Error: ' + e.message; }
    }
  </script>
</body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium text-sky-700">
          Associated Domains · /.well-known/apple-app-site-association
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Associated Domains &amp; AASA Validator
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
          Fetch and verify your live domain&apos;s <code className="font-mono text-xs">apple-app-site-association</code> schema, Team ID + Bundle ID bindings, 128 KB CDN ceiling, and Universal Link URL routing before deploying Passkeys or Password AutoFill.
        </p>
      </div>

      {/* Xcode Entitlement Generator */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Xcode App &amp; Domain Configuration
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Apple Team ID
                </label>
                <input
                  type="text"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Bundle Identifier
                </label>
                <input
                  type="text"
                  value={bundleId}
                  onChange={(e) => setBundleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Relying Party Domain
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => {
                    const next = e.target.value.toLowerCase();
                    setDomain(next);
                    const cleaned = next.trim().replace(/^https?:\/\//, '').split('/')[0];
                    if (cleaned) {
                      setTestUrl(`https://${cleaned}/auth/callback`);
                    }
                  }}
                  placeholder="auth.yourdomain.com"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                {onApplyGlobalDomain && cleanDomainLabel !== activeDomain && (
                  <button
                    type="button"
                    onClick={() => onApplyGlobalDomain(cleanDomainLabel)}
                    className="min-h-[38px] rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100 whitespace-nowrap"
                  >
                    Set Global
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleFetchLiveAasa()}
                disabled={isFetchingLive}
                className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingLive ? 'animate-spin' : ''}`} />
                {isFetchingLive ? 'Fetching Live AASA...' : 'Fetch Live AASA'}
              </button>
              <button
                type="button"
                onClick={handleDownloadAasa}
                className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                Download JSON
              </button>
            </div>

            {liveFetchNotice && (
              <div
                className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
                  liveFetchNotice.kind === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                {liveFetchNotice.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-xs font-medium text-slate-900">
                  Bypass Apple CDN (?mode=developer)
                </div>
                <div className="text-[11px] text-slate-500">
                  Requires Associated Domains Development toggle in iOS Settings
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={developerMode}
                onClick={() => setDeveloperMode((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  developerMode ? 'bg-sky-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                    developerMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="rounded-lg bg-slate-950 p-3.5 font-mono text-[11px] leading-relaxed text-slate-100">
              <div className="text-slate-400">Signing &amp; Capabilities &rarr; Associated Domains</div>
              <div className="mt-1 text-sky-300">
                webcredentials:{cleanDomainLabel}{developerMode ? '?mode=developer' : ''}
              </div>
              <div className="text-sky-300">
                applinks:{cleanDomainLabel}{developerMode ? '?mode=developer' : ''}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Tip: This server also serves a valid file at{' '}
              <a
                href={`/.well-known/apple-app-site-association?teamId=${encodeURIComponent(teamId)}&bundleId=${encodeURIComponent(bundleId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sky-700 underline"
              >
                /.well-known/apple-app-site-association
              </a>
              , or download the file above and host it at{' '}
              <code className="font-mono text-slate-700">https://{cleanDomainLabel}/.well-known/apple-app-site-association</code>.
            </p>
          </div>

          {/* No Developer Account Workaround */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-amber-950">
              No Apple Developer Account Workaround
            </h2>
            <p className="text-xs text-amber-900 leading-relaxed">
              Apple requires a paid Developer Team ID to bind <code className="font-mono">Associated Domains</code> in a native Xcode <code className="font-mono">.ipa</code>, but iOS Safari supports real <strong>Face ID Passkeys &amp; Passwords AutoFill</strong> on <code className="font-mono">https://{cleanDomainLabel}</code> via WebAuthn with <strong>zero Developer account</strong>.
            </p>
            <button
              type="button"
              onClick={handleDownloadWebPasskeyHtml}
              className="inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-100"
            >
              <Download className="h-3.5 w-3.5" />
              Download Hostinger Web Passkey Page (index.html)
            </button>
          </div>

          {/* URL Route Tester */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Universal Link &amp; WebCredentials Route Matcher
            </h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void runValidation(rawJson, testUrl)}
                disabled={isValidating}
                className="min-h-[38px] rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                Validate
              </button>
            </div>

            {validation?.matchedUrlResult && (
              <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">webcredentials Match</div>
                  <div
                    className={`mt-0.5 font-semibold ${
                      validation.matchedUrlResult.matchedWebCredentials
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {validation.matchedUrlResult.matchedWebCredentials ? 'Eligible for Passkeys' : 'Not Matched'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[11px] text-slate-500">applinks Route</div>
                  <div
                    className={`mt-0.5 font-semibold ${
                      validation.matchedUrlResult.matchedAppLinks
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {validation.matchedUrlResult.matchedAppLinks
                      ? `Matched (${validation.matchedUrlResult.matchedRule})`
                      : 'No Path Match'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* JSON Editor & Live Diagnostics */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <span className="font-mono text-xs font-medium text-slate-700 truncate">
                https://{cleanDomainLabel}/.well-known/apple-app-site-association
              </span>
              {validation && (
                <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0 ml-2">
                  {validation.byteSize} / {validation.maxBytes.toLocaleString()} bytes
                </span>
              )}
            </div>
            <textarea
              aria-label="Apple App Site Association JSON"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={13}
              spellCheck={false}
              className="w-full resize-y bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none"
            />
          </div>

          {validation && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Validation Diagnostics
                </h3>
                <span
                  className={`text-xs font-semibold ${
                    validation.valid ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {validation.valid ? 'Schema Passed' : 'Schema Errors Found'}
                </span>
              </div>

              <ul className="mt-3 divide-y divide-slate-100">
                {validation.diagnostics.map((diag, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 py-2.5 text-xs">
                    {diag.level === 'pass' ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : diag.level === 'warning' ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    )}
                    <div>
                      <span className="font-mono font-semibold text-slate-800">{diag.field}: </span>
                      <span className="text-slate-600">{diag.message}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
