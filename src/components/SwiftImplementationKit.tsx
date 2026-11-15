import React, { useState } from 'react';
import { Copy, Check, Download, FileCode2 } from 'lucide-react';
import { SWIFT_IMPLEMENTATION_FILES } from '../data/swiftImplementation';

interface SwiftImplementationKitProps {
  activeDomain: string;
}

export const SwiftImplementationKit: React.FC<SwiftImplementationKitProps> = ({ activeDomain }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeFile = SWIFT_IMPLEMENTATION_FILES[selectedIndex];
  const resolvedCode = activeFile.code.replaceAll('securepasswordmanager.tech', activeDomain);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resolvedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleDownload = () => {
    const blob = new Blob([resolvedCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.filename.replace(/\s+&\s+.*$/, '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <p className="text-xs font-medium text-sky-700">
          Xcode 16 · iPhone 12 Pro (arm64 · iOS 15–18) · Domain: {activeDomain}
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          iOS Swift Implementation Kit
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
          Complete, copy-ready Swift modules implementing <code className="font-mono text-xs">ASAuthorizationController</code>, <code className="font-mono text-xs">LAContext</code> biometrics, Keychain <code className="font-mono text-xs">.biometryCurrentSet</code> storage, and <code className="font-mono text-xs">ASCredentialProviderViewController</code> configured for <code className="font-mono text-xs">{activeDomain}</code> on your iPhone 12 Pro.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* File Tree & iPhone 12 Pro Xcode Integration Checklist */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-700">
              Project Source Files
            </div>
            <div className="divide-y divide-slate-100">
              {SWIFT_IMPLEMENTATION_FILES.map((file, idx) => {
                const active = idx === selectedIndex;
                return (
                  <button
                    key={file.filename}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      active ? 'bg-sky-50/80 text-sky-950' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <FileCode2
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        active ? 'text-sky-600' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold truncate">
                        {file.filename}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 truncate">
                        {file.framework}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xs font-semibold text-amber-950">
                No Paid Apple Developer Account?
              </h2>
              <button
                type="button"
                onClick={() => {
                  const idx = SWIFT_IMPLEMENTATION_FILES.findIndex(
                    (f) => f.filename === 'FreeAccountWebAuthView.swift'
                  );
                  if (idx >= 0) setSelectedIndex(idx);
                }}
                className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
              >
                Open Free-Team Code
              </button>
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Free Xcode Personal Teams cannot sign <code className="font-mono">Associated Domains</code> or <code className="font-mono">Sign in with Apple</code> entitlements. Remove those 2 capabilities in Xcode and use{' '}
              <code className="font-mono font-semibold">FreeAccountWebAuthView.swift</code> (<code className="font-mono">LAContext</code> Face ID + <code className="font-mono">ASWebAuthenticationSession</code> to{' '}
              <code className="font-mono">{activeDomain}</code>).
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              iPhone 12 Pro Xcode Deployment Steps
            </h2>
            <ol className="space-y-2.5 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
              <li>
                Connect your <span className="font-semibold text-slate-900">iPhone 12 Pro</span> via USB-C/Lightning, enable <span className="font-semibold text-slate-900">Developer Mode</span> in Settings &rarr; Privacy &amp; Security, and select it as the Run Destination (<code className="font-mono text-slate-800">arm64</code>).
              </li>
              <li>
                <span className="font-semibold text-slate-900">Paid Developer Team:</span> Enable <span className="font-semibold text-slate-900">Associated Domains</span> (<code className="font-mono text-slate-800">webcredentials:{activeDomain}</code>, <code className="font-mono text-slate-800">applinks:{activeDomain}</code>) &amp; <span className="font-semibold text-slate-900">Sign in with Apple</span>.{' '}
                <span className="font-semibold text-slate-900">Free Apple ID:</span> Skip those entitlements and use <code className="font-mono text-slate-800">FreeAccountWebAuthView.swift</code>.
              </li>
              <li>
                Add <code className="font-mono text-slate-800">NSFaceIDUsageDescription</code> in{' '}
                <code className="font-mono text-slate-800">Info.plist</code> for TrueDepth Face ID evaluation (works with both Free and Paid teams).
              </li>
              <li>
                For full AutoFill extension support (Paid Team), add an <span className="font-semibold text-slate-900">AutoFill Credential Provider Extension</span> target and enable it under Settings &rarr; General &rarr; AutoFill &amp; Passwords.
              </li>
            </ol>
          </div>
        </div>

        {/* Code Viewer */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3.5">
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-slate-900">
                  {activeFile.path}
                </div>
                <p className="mt-0.5 text-xs text-slate-600">{activeFile.summary}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy File'}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
            </div>

            <pre className="max-h-[620px] overflow-auto bg-slate-950 p-5 font-mono text-xs leading-relaxed text-slate-100">
              <code>{resolvedCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
