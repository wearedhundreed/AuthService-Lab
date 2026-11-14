import React, { useState } from 'react';
import { Copy, Check, Download, FileCode2 } from 'lucide-react';
import { SWIFT_IMPLEMENTATION_FILES } from '../data/swiftImplementation';

export const SwiftImplementationKit: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeFile = SWIFT_IMPLEMENTATION_FILES[selectedIndex];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard restriction
    }
  };

  const handleDownload = () => {
    const blob = new Blob([activeFile.code], { type: 'text/plain;charset=utf-8' });
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
          Xcode 16 · iPhone 12 Pro (arm64 · iOS 15–18) · Swift Concurrency · SwiftUI
        </p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          iOS Swift Implementation Kit
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
          Complete, copy-ready Swift modules implementing <code className="font-mono text-xs">ASAuthorizationController</code>, <code className="font-mono text-xs">LAContext</code> biometrics, Keychain <code className="font-mono text-xs">.biometryCurrentSet</code> storage, and <code className="font-mono text-xs">ASCredentialProviderViewController</code> for your iPhone 12 Pro.
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

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              iPhone 12 Pro Xcode Deployment Steps
            </h2>
            <ol className="space-y-2.5 text-xs text-slate-600 list-decimal list-inside leading-relaxed">
              <li>
                Connect your <span className="font-semibold text-slate-900">iPhone 12 Pro</span> via USB-C/Lightning, enable <span className="font-semibold text-slate-900">Developer Mode</span> in Settings &rarr; Privacy &amp; Security, and select it as the Run Destination (<code className="font-mono text-slate-800">arm64</code>).
              </li>
              <li>
                Enable <span className="font-semibold text-slate-900">Associated Domains</span> &amp;{' '}
                <span className="font-semibold text-slate-900">Sign in with Apple</span> under Signing &amp; Capabilities, and toggle <span className="font-semibold text-slate-900">Associated Domains Development</span> in Settings &rarr; Developer.
              </li>
              <li>
                Add <code className="font-mono text-slate-800">NSFaceIDUsageDescription</code> in{' '}
                <code className="font-mono text-slate-800">Info.plist</code> for TrueDepth Face ID evaluation.
              </li>
              <li>
                Add an <span className="font-semibold text-slate-900">AutoFill Credential Provider Extension</span> target and enable your app under Settings &rarr; General &rarr; AutoFill &amp; Passwords on your iPhone 12 Pro.
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
              <code>{activeFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
