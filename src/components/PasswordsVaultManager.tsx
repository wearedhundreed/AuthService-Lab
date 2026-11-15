import React, { useState } from 'react';
import {
  Plus,
  Search,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Smartphone,
  SlidersHorizontal,
  ShieldPlus,
  X,
} from 'lucide-react';
import { AbmAccountEntry, AbmAccountStatus, AuthKind, CredentialEntry } from '../types/auth';
import { PasswordGeneratorControl } from './PasswordGeneratorControl';
import { AbmSignInsPanel } from './AbmSignInsPanel';

interface PasswordsVaultManagerProps {
  credentials: CredentialEntry[];
  onVaultUpdated: (credentials: CredentialEntry[]) => void;
  onTestAutoFill: (credential: CredentialEntry) => void;
  onInspectInIos: (credential: CredentialEntry) => void;
  onResetVault: () => Promise<void>;
  abmAccounts: AbmAccountEntry[];
  onImportAbmCsv: (csvText: string, sourceCsv: string) => Promise<void>;
  onAddManualAbmAccount: (payload: {
    managedAppleAccount: string;
    firstName: string;
    middleName: string;
    lastName: string;
    temporaryPassword: string;
  }) => Promise<void>;
  onUpdateAbmStatus: (account: AbmAccountEntry, status: AbmAccountStatus) => Promise<void>;
  onDeleteAbmAccount: (id: string) => Promise<void>;
  onResetAbmAccounts: () => Promise<void>;
  onSaveAbmToVault: (account: AbmAccountEntry) => Promise<void>;
  onTestAbmOnIphone: (account: AbmAccountEntry) => void;
}

export const PasswordsVaultManager: React.FC<PasswordsVaultManagerProps> = ({
  credentials,
  onVaultUpdated,
  onTestAutoFill,
  onInspectInIos,
  onResetVault,
  abmAccounts,
  onImportAbmCsv,
  onAddManualAbmAccount,
  onUpdateAbmStatus,
  onDeleteAbmAccount,
  onResetAbmAccounts,
  onSaveAbmToVault,
  onTestAbmOnIphone,
}) => {
  const [filter, setFilter] = useState<'all' | 'passkeys' | 'totp' | 'alerts' | 'shared'>('all');
  const [search, setSearch] = useState('');

  // Add Credential form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showStandaloneGenerator, setShowStandaloneGenerator] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newAuthKind, setNewAuthKind] = useState<AuthKind>('password');
  const [newEnableTotp, setNewEnableTotp] = useState(true);
  const [newSharedGroup, setNewSharedGroup] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Rotate / Edit Password modal state
  const [editingCredential, setEditingCredential] = useState<CredentialEntry | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const filteredCredentials = credentials.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.domain.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filter === 'passkeys') return item.hasPasskey;
    if (filter === 'totp') return Boolean(item.totpSecret);
    if (filter === 'alerts') return item.auditStatus !== 'strong';
    if (filter === 'shared') return Boolean(item.sharedGroup);
    return true;
  });

  const stats = {
    total: credentials.length,
    passkeys: credentials.filter((c) => c.hasPasskey).length,
    totp: credentials.filter((c) => Boolean(c.totpSecret)).length,
    alerts: credentials.filter((c) => c.auditStatus !== 'strong').length,
  };

  const handleCreateCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newDomain.trim() || !newUsername.trim()) {
      setFormError('Domain and username are required.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim() || newDomain.trim(),
          domain: newDomain.trim(),
          username: newUsername.trim(),
          password: newPassword,
          authKind: newAuthKind,
          enableTotp: newEnableTotp,
          sharedGroup: newSharedGroup.trim(),
          generateStrong: newAuthKind !== 'siwa' && !newPassword.trim(),
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setFormError(err.error || 'Failed to save credential.');
        return;
      }
      const data = (await res.json()) as { credentials: CredentialEntry[] };
      onVaultUpdated(data.credentials);
      setNewTitle('');
      setNewDomain('');
      setNewUsername('');
      setNewPassword('');
      setNewSharedGroup('');
      setShowAddForm(false);
    } catch {
      setFormError('Unable to reach server. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyRotatedPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredential || !editPasswordValue.trim()) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/credentials/${editingCredential.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: editPasswordValue.trim() }),
      });
      if (res.ok) {
        const data = (await res.json()) as { credentials: CredentialEntry[] };
        onVaultUpdated(data.credentials);
        setEditingCredential(null);
        setEditPasswordValue('');
      }
    } catch {
      // Transient network error handled gracefully
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpgradePasskey = async (cred: CredentialEntry) => {
    try {
      const res = await fetch(`/api/credentials/${cred.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upgradeToPasskey: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as { credentials: CredentialEntry[] };
        onVaultUpdated(data.credentials);
      }
    } catch {
      // Transient network error handled gracefully
    }
  };

  const handleDeleteCredential = async (id: string) => {
    try {
      const res = await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const data = (await res.json()) as { credentials: CredentialEntry[] };
        onVaultUpdated(data.credentials);
      }
    } catch {
      // Transient network error handled gracefully
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-sky-700">
            iOS 18 Passwords App · iCloud Keychain · AutoFill Credential Provider
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Passwords Vault &amp; Credential Manager
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
            Manage saved credentials, generate customizable strong passwords, verify RFC 6238 TOTP codes, and remediate reused or low-entropy accounts synced directly with the iOS simulator.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowStandaloneGenerator((v) => !v)}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
              showStandaloneGenerator
                ? 'border-sky-600 bg-sky-50 text-sky-900'
                : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Password Generator
          </button>

          <button
            type="button"
            onClick={() => void onResetVault()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Fixtures
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            Add Credential
          </button>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white">
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Saved Accounts</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.total}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Hardware Passkeys</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.passkeys}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">TOTP 2FA Enabled</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
            {stats.totp}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Security Recommendations</div>
          <div
            className={`mt-1 font-display text-2xl font-bold tabular-nums ${
              stats.alerts > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {stats.alerts}
          </div>
        </div>
      </div>

      {/* Standalone Password Generator Drawer */}
      {showStandaloneGenerator && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-slate-900">
              Standalone Password Generator
            </h3>
            <button
              type="button"
              onClick={() => setShowStandaloneGenerator(false)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close standalone password generator"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <PasswordGeneratorControl
            onApplyPassword={(pwd) => {
              setNewPassword(pwd);
              setShowAddForm(true);
            }}
            applyLabel="Create Credential With Password"
          />
        </div>
      )}

      {/* Add Credential Flow (Integrated with Customizable Password Generator) */}
      {showAddForm && (
        <form
          onSubmit={(e) => void handleCreateCredential(e)}
          className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Save New Credential to iCloud Keychain
              </h3>
              <p className="text-xs text-slate-500">
                Add a password, passkey, or Sign in with Apple record with optional RFC 6238 TOTP secret.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {formError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Service / App Name
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Stripe Dashboard"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Associated Domain *
              </label>
              <input
                type="text"
                required
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder="dashboard.stripe.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Username or Email *
              </label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="maya.lin@icloud.com"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Authentication Type
              </label>
              <select
                value={newAuthKind}
                onChange={(e) => setNewAuthKind(e.target.value as AuthKind)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              >
                <option value="password">Password + AutoFill</option>
                <option value="passkey">Hardware Passkey (+ Backup Password)</option>
                <option value="siwa">Sign in with Apple</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Shared Group (Optional)
              </label>
              <input
                type="text"
                value={newSharedGroup}
                onChange={(e) => setNewSharedGroup(e.target.value)}
                placeholder="iOS Engineering Team"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={newEnableTotp}
                  onChange={(e) => setNewEnableTotp(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Provision RFC 6238 TOTP 2FA Secret
              </label>
            </div>
          </div>

          {newAuthKind !== 'siwa' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Password (enter manually or apply from generator below)
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to auto-generate or click Use Password below"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 font-mono text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <PasswordGeneratorControl
                compact
                onApplyPassword={(pwd) => setNewPassword(pwd)}
                applyLabel="Apply to Credential"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[40px] rounded-lg bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {isSaving ? 'Saving to Keychain...' : 'Save Credential'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'passkeys', label: 'Passkeys' },
              { id: 'totp', label: 'TOTP 2FA' },
              { id: 'alerts', label: 'Security Alerts' },
              { id: 'shared', label: 'Shared Groups' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by domain or username..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Credentials Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500">
                <th className="py-3 pl-5 pr-4 font-semibold">Service &amp; Domain</th>
                <th className="py-3 pr-4 font-semibold">Account</th>
                <th className="py-3 pr-4 font-semibold">Credential Type</th>
                <th className="py-3 pr-4 font-semibold">Security Audit</th>
                <th className="py-3 pl-4 pr-5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCredentials.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                    No credentials match your current filter.
                  </td>
                </tr>
              ) : (
                filteredCredentials.map((cred) => (
                  <tr key={cred.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 pl-5 pr-4">
                      <div className="font-display text-sm font-semibold text-slate-900">
                        {cred.title}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">{cred.domain}</div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="font-medium text-slate-800">{cred.username}</div>
                      {cred.sharedGroup && (
                        <div className="text-[11px] text-slate-500">Shared: {cred.sharedGroup}</div>
                      )}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="text-slate-800 font-medium">
                        {cred.hasPasskey
                          ? 'Passkey (ES256)'
                          : cred.authKind === 'siwa'
                            ? 'Sign in with Apple'
                            : 'Password'}
                        {cred.totpSecret ? ' + TOTP' : ''}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {cred.hasPasskey
                          ? `Assertions: ${cred.passkeySignCount}`
                          : `${cred.entropyBits} bits entropy`}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      {cred.auditStatus === 'strong' ? (
                        <div className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Strong &amp; Unique</span>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span>
                              {cred.auditStatus === 'reused' ? 'Reused Password' : 'Weak Entropy'}
                            </span>
                          </div>
                          {cred.auditIssues[0] && (
                            <div className="text-[11px] text-slate-500 max-w-[220px]">
                              {cred.auditIssues[0]}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 pl-4 pr-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onTestAutoFill(cred)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                        >
                          <KeyRound className="h-3 w-3 text-sky-600" />
                          AutoFill
                        </button>
                        <button
                          type="button"
                          onClick={() => onInspectInIos(cred)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                        >
                          <Smartphone className="h-3 w-3" />
                          Open iOS
                        </button>
                        {cred.authKind !== 'siwa' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCredential(cred);
                              setEditPasswordValue(cred.password);
                            }}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                          >
                            Rotate Password
                          </button>
                        )}
                        {!cred.hasPasskey && cred.authKind !== 'siwa' && (
                          <button
                            type="button"
                            onClick={() => void handleUpgradePasskey(cred)}
                            title="Upgrade account to Passkey"
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap"
                          >
                            <ShieldPlus className="h-3 w-3" />
                            Add Passkey
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteCredential(cred.id)}
                          aria-label={`Delete ${cred.title}`}
                          className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rotate / Edit Password Modal with Customizable Generator */}
      {editingCredential && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`Rotate password for ${editingCredential.title}`}
        >
          <form
            onSubmit={(e) => void handleApplyRotatedPassword(e)}
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3.5">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Rotate Password · {editingCredential.title}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingCredential.username} ({editingCredential.domain})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCredential(null)}
                aria-label="Close rotate password dialog"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                New Keychain Password
              </label>
              <input
                type="text"
                required
                value={editPasswordValue}
                onChange={(e) => setEditPasswordValue(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <PasswordGeneratorControl
              compact
              onApplyPassword={(pwd) => setEditPasswordValue(pwd)}
              applyLabel="Apply Generated Password"
            />

            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditingCredential(null)}
                className="min-h-[40px] rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating || !editPasswordValue.trim()}
                className="min-h-[40px] rounded-lg bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {isUpdating ? 'Updating Keychain...' : 'Save New Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Apple Business Manager (ABM) Sign-Ins Section */}
      <AbmSignInsPanel
        accounts={abmAccounts}
        onImportCsv={onImportAbmCsv}
        onAddManualAccount={onAddManualAbmAccount}
        onUpdateStatus={onUpdateAbmStatus}
        onDeleteAccount={onDeleteAbmAccount}
        onResetAccounts={onResetAbmAccounts}
        onSaveToVault={onSaveAbmToVault}
        onTestOnIphone={onTestAbmOnIphone}
      />
    </div>
  );
};
