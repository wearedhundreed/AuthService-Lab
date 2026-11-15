import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Globe } from 'lucide-react';
import { AasaValidationResult } from '../types/auth';

export const AasaDomainValidator: React.FC = () => {
  const [teamId, setTeamId] = useState('A1B2C3D4E5');
  const [bundleId, setBundleId] = useState('com.authserviceslab.ios');
  const [domain, setDomain] = useState('auth.demo-ios.app');
  const [developerMode, setDeveloperMode] = useState(true);
  const [testUrl, setTestUrl] = useState('https://auth.demo-ios.app/auth/callback');
  const [rawJson, setRawJson] = useState('');
  const [validation, setValidation] = useState<AasaValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium text-sky-700">
          Associated Domains · /.well-known/apple-app-site-association
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Associated Domains & AASA Validator
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
          Verify your server&apos;s <code className="font-mono text-xs">apple-app-site-association</code> schema, Team ID + Bundle ID bindings, 128 KB CDN ceiling, and Universal Link URL routing before deploying Passkeys or Password AutoFill.
        </p>
      </div>

      {/* Xcode Entitlement Generator */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Xcode App & Domain Configuration
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
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value.toLowerCase())}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

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
              <div className="text-slate-400">Signing & Capabilities &rarr; Associated Domains</div>
              <div className="mt-1 text-sky-300">
                webcredentials:{domain}{developerMode ? '?mode=developer' : ''}
              </div>
              <div className="text-sky-300">
                applinks:{domain}{developerMode ? '?mode=developer' : ''}
              </div>
            </div>
          </div>

          {/* URL Route Tester */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Universal Link & WebCredentials Route Matcher
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
              <span className="font-mono text-xs font-medium text-slate-700">
                https://{domain}/.well-known/apple-app-site-association
              </span>
              {validation && (
                <span className="font-mono text-xs text-slate-500 tabular-nums">
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
