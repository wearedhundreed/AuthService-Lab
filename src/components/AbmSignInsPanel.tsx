import React, { useRef, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { AbmAccountEntry, AbmAccountStatus } from '../types/auth';

interface AbmSignInsPanelProps {
  accounts: AbmAccountEntry[];
  onImportCsv: (csvText: string, sourceCsv: string) => Promise<void>;
  onAddManualAccount: (payload: {
    managedAppleAccount: string;
    firstName: string;
    middleName: string;
    lastName: string;
    temporaryPassword: string;
  }) => Promise<void>;
  onUpdateStatus: (account: AbmAccountEntry, status: AbmAccountStatus) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onResetAccounts: () => Promise<void>;
  onSaveToVault: (account: AbmAccountEntry) => Promise<void>;
  onTestOnIphone: (account: AbmAccountEntry) => void;
}

const STATUS_LABELS: Record<AbmAccountStatus, string> = {
  pending_first_signin: 'Pending First Sign-In',
  active: 'Signed In (Active)',
  synced_to_vault: 'Saved in Vault',
};

export const AbmSignInsPanel: React.FC<AbmSignInsPanelProps> = ({
  accounts,
  onImportCsv,
  onAddManualAccount,
  onUpdateStatus,
  onDeleteAccount,
  onResetAccounts,
  onSaveToVault,
  onTestOnIphone,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showImportDrawer, setShowImportDrawer] = useState(false);
  const [csvDraft, setCsvDraft] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualFirst, setManualFirst] = useState('');
  const [manualMiddle, setManualMiddle] = useState('');
  const [manualLast, setManualLast] = useState('');
  const [manualPwd, setManualPwd] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const text = await file.text();
      await onImportCsv(text, file.name);
      setFeedback(`Imported Managed Apple Accounts from ${file.name}.`);
      setShowImportDrawer(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not read CSV file.');
    } finally {
      setIsSubmitting(false);
      e.target.value = '';
    }
  };

  const handleImportCsvText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvDraft.trim()) return;
    setErrorMsg(null);
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await onImportCsv(csvDraft, 'ABM-SignIns-Paste.csv');
      setCsvDraft('');
      setShowImportDrawer(false);
      setFeedback('Imported ABM CSV accounts.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid ABM CSV format.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmail.trim() || !manualPwd.trim()) {
      setErrorMsg('Managed Apple Account email and temporary password are required.');
      return;
    }
    setErrorMsg(null);
    setFeedback(null);
    setIsSubmitting(true);
    try {
      await onAddManualAccount({
        managedAppleAccount: manualEmail.trim(),
        firstName: manualFirst.trim() || 'User',
        middleName: manualMiddle.trim(),
        lastName: manualLast.trim() || 'Account',
        temporaryPassword: manualPwd.trim(),
      });
      setManualEmail('');
      setManualFirst('');
      setManualMiddle('');
      setManualLast('');
      setManualPwd('');
      setShowImportDrawer(false);
      setFeedback('Added Managed Apple Account.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save ABM account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-sky-700">
            <Building2 className="h-4 w-4" />
            <span>Apple Business Manager · Managed Apple Accounts</span>
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            ABM Sign-In Credentials &amp; CSV Importer
          </h2>
          <p className="max-w-2xl text-xs text-slate-600 leading-relaxed">
            Store your Apple Business Manager temporary sign-in CSV accounts here, copy the temporary password safely when signing in for the first time, or save them directly to your iOS Passwords Vault.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5 text-sky-600" />
            Upload ABM CSV
          </button>

          <button
            type="button"
            onClick={() => setShowImportDrawer((v) => !v)}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            {showImportDrawer ? 'Close Form' : 'Paste CSV / Add'}
          </button>

          <button
            type="button"
            onClick={() => void onResetAccounts()}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Restore CSV
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-800">
          {feedback}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      {showImportDrawer && (
        <div className="grid gap-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 lg:grid-cols-2">
          <form onSubmit={(e) => void handleImportCsvText(e)} className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <FileSpreadsheet className="h-3.5 w-3.5 text-sky-600" />
              <span>Paste ABM Sign-Ins CSV Rows</span>
            </div>
            <textarea
              rows={4}
              value={csvDraft}
              onChange={(e) => setCsvDraft(e.target.value)}
              placeholder={`managed_apple_account,first_name,middle_name,last_name,temporary_password\nchrisbarnes@moredesa2.appleaccount.com,Christopher,,Barnes,8VJyqh3t`}
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 font-mono text-[11px] text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isSubmitting || !csvDraft.trim()}
              className="min-h-[36px] rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Import CSV Text
            </button>
          </form>

          <form onSubmit={(e) => void handleManualSubmit(e)} className="space-y-3">
            <div className="text-xs font-semibold text-slate-900">Add Single Managed Apple Account</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="email"
                required
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="name@company.appleaccount.com"
                className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <input
                type="text"
                value={manualFirst}
                onChange={(e) => setManualFirst(e.target.value)}
                placeholder="First name"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <input
                type="text"
                value={manualLast}
                onChange={(e) => setManualLast(e.target.value)}
                placeholder="Last name"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <input
                type="text"
                value={manualMiddle}
                onChange={(e) => setManualMiddle(e.target.value)}
                placeholder="Middle name (optional)"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <input
                type="text"
                required
                value={manualPwd}
                onChange={(e) => setManualPwd(e.target.value)}
                placeholder="Temporary password"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[36px] rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Add Account
            </button>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500">
              <th className="py-2.5 pl-4 pr-3 font-semibold">Person</th>
              <th className="py-2.5 pr-3 font-semibold">Managed Apple Account</th>
              <th className="py-2.5 pr-3 font-semibold">Temporary Password</th>
              <th className="py-2.5 pr-3 font-semibold">Sign-In Status</th>
              <th className="py-2.5 pl-3 pr-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                  No ABM Managed Apple Accounts loaded yet. Upload your ABM Sign-Ins CSV above.
                </td>
              </tr>
            ) : (
              accounts.map((acct) => {
                const isRevealed = revealedIds.has(acct.id);
                const fullName = [acct.firstName, acct.middleName, acct.lastName]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr key={acct.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-4 pr-3">
                      <div className="font-semibold text-slate-900">{fullName}</div>
                      <div className="text-[11px] text-slate-500">
                        {acct.sourceCsv || 'ABM CSV Import'}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-slate-900">
                          {acct.managedAppleAccount}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopy(`${acct.id}-email`, acct.managedAppleAccount)}
                          aria-label={`Copy ${acct.managedAppleAccount}`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          {copiedId === `${acct.id}-email` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-slate-800">
                          {isRevealed ? acct.temporaryPassword : '••••••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleReveal(acct.id)}
                          aria-label={isRevealed ? 'Hide temporary password' : 'Show temporary password'}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          {isRevealed ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleCopy(`${acct.id}-pwd`, acct.temporaryPassword)}
                          aria-label="Copy temporary password"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          {copiedId === `${acct.id}-pwd` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        value={acct.status}
                        onChange={(e) =>
                          void onUpdateStatus(acct, e.target.value as AbmAccountStatus)
                        }
                        aria-label={`Status for ${fullName}`}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 focus:border-sky-500 focus:outline-none"
                      >
                        {(Object.keys(STATUS_LABELS) as AbmAccountStatus[]).map((statusKey) => (
                          <option key={statusKey} value={statusKey}>
                            {STATUS_LABELS[statusKey]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void onSaveToVault(acct)}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                        >
                          <KeyRound className="h-3 w-3 text-sky-600" />
                          Save to Vault
                        </button>
                        <button
                          type="button"
                          onClick={() => onTestOnIphone(acct)}
                          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap"
                        >
                          <Smartphone className="h-3 w-3" />
                          Test on iPhone
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteAccount(acct.id)}
                          aria-label={`Remove ${acct.managedAppleAccount}`}
                          className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
