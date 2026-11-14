import React from 'react';
import { X, CheckCircle2, XCircle } from 'lucide-react';
import { TestSuiteResponse } from '../types/auth';

interface TestSuiteDrawerProps {
  suite: TestSuiteResponse | null;
  onClose: () => void;
  onReRun: () => void;
  isRunning: boolean;
}

export const TestSuiteDrawer: React.FC<TestSuiteDrawerProps> = ({
  suite,
  onClose,
  onReRun,
  isRunning,
}) => {
  if (!suite) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Automated Verification Suite Results"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              AuthenticationServices Verification Suite
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {suite.passed}/{suite.total} assertions passed · {suite.totalDurationMs} ms · Executed{' '}
              {new Date(suite.executedAt).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReRun}
              disabled={isRunning}
              className="min-h-[36px] rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isRunning ? 'Running...' : 'Re-run Suite'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close test results"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-6">
          {suite.results.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 py-4">
              <div className="flex items-start gap-3">
                {item.passed ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{item.apiSymbol}</span>
                  </div>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{item.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-600">{item.assertion}</p>
                </div>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums shrink-0">
                {item.durationMs} ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
