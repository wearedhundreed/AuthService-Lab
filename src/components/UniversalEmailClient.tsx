import React, { useState, useMemo } from 'react';
import {
  Mail,
  Send,
  Inbox,
  FileText,
  Shield,
  Star,
  Trash2,
  ExternalLink,
  Download,
  Plus,
  Copy,
  Check,
  Search,
  Sparkles,
  Reply,
  Forward,
  RotateCcw,
} from 'lucide-react';
import { EmailFolder, EmailProviderId, UniversalEmailMessage } from '../types/auth';

interface UniversalEmailClientProps {
  emails: UniversalEmailMessage[];
  defaultUserEmail?: string | null;
  isSignedIn: boolean;
  onSaveEmail: (email: UniversalEmailMessage, isNew: boolean) => Promise<void>;
  onDeleteEmail: (id: string) => Promise<void>;
  onSimulateAuthEmail: (
    kind: 'otp' | 'magic-link' | 'passkey-alert' | 'relay',
    to: string,
    providerHint: EmailProviderId
  ) => Promise<void>;
  onResetEmails: () => Promise<void>;
}

const PROVIDERS: Array<{
  id: EmailProviderId;
  label: string;
  note: string;
  buildUrl: (params: { to: string; subject: string; body: string }) => string;
}> = [
  {
    id: 'mailto',
    label: 'Default Mail App (mailto:)',
    note: 'Apple Mail on iPhone 12 Pro / macOS, Thunderbird, Spark, or OS default',
    buildUrl: ({ to, subject, body }) =>
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    id: 'gmail',
    label: 'Gmail Web',
    note: 'Google Workspace & Gmail web composer',
    buildUrl: ({ to, subject, body }) =>
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    id: 'outlook',
    label: 'Outlook / Microsoft 365',
    note: 'Outlook.com & Office 365 webmail composer',
    buildUrl: ({ to, subject, body }) =>
      `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    id: 'icloud',
    label: 'Apple iCloud Mail',
    note: 'iCloud.com & Hide My Email relay addresses',
    buildUrl: ({ to, subject, body }) =>
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    id: 'proton',
    label: 'Proton Mail',
    note: 'End-to-end encrypted Proton Mail web/mobile',
    buildUrl: ({ to, subject, body }) =>
      `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    id: 'fastmail',
    label: 'Fastmail',
    note: 'Fastmail universal web compose link',
    buildUrl: ({ to, subject, body }) =>
      `https://app.fastmail.com/mail/compose/?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
  {
    id: 'yahoo',
    label: 'Yahoo Mail',
    note: 'Yahoo webmail compose link',
    buildUrl: ({ to, subject, body }) =>
      `https://compose.mail.yahoo.com/?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  },
];

function buildRfc5322Eml(email: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
  createdAt?: string;
}): string {
  const dateHeader = new Date(email.createdAt || Date.now()).toUTCString();
  const lines = [
    `Date: ${dateHeader}`,
    `From: ${email.from}`,
    `To: ${email.to}`,
    ...(email.replyTo ? [`Reply-To: ${email.replyTo}`] : []),
    `Subject: ${email.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    email.body,
  ];
  return lines.join('\r\n');
}

function downloadEmlFile(email: {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  body: string;
  createdAt?: string;
}) {
  const emlContent = buildRfc5322Eml(email);
  const blob = new Blob([emlContent], { type: 'message/rfc822;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (email.subject || 'message')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 48);
  link.href = url;
  link.download = `${safeName || 'message'}.eml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const UniversalEmailClient: React.FC<UniversalEmailClientProps> = ({
  emails,
  defaultUserEmail,
  isSignedIn,
  onSaveEmail,
  onDeleteEmail,
  onSimulateAuthEmail,
  onResetEmails,
}) => {
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preferredProvider, setPreferredProvider] = useState<EmailProviderId>('mailto');
  const [isComposing, setIsComposing] = useState(false);

  // Composer state
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [fromAddr, setFromAddr] = useState(defaultUserEmail || 'developer@auth.demo-ios.app');
  const [toAddr, setToAddr] = useState(defaultUserEmail || 'maya.lin@icloud.com');
  const [replyToAddr, setReplyToAddr] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const folderCounts = useMemo(() => {
    const counts: Record<EmailFolder, number> = { inbox: 0, sent: 0, drafts: 0, relay: 0 };
    for (const e of emails) {
      counts[e.folder] = (counts[e.folder] || 0) + 1;
    }
    return counts;
  }, [emails]);

  const filteredEmails = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return emails
      .filter((e) => e.folder === activeFolder)
      .filter((e) => {
        if (!q) return true;
        return (
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.to.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q)
        );
      });
  }, [emails, activeFolder, searchQuery]);

  const selectedEmail =
    filteredEmails.find((e) => e.id === selectedId) || filteredEmails[0] || null;

  const activeProviderMeta =
    PROVIDERS.find((p) => p.id === preferredProvider) || PROVIDERS[0];

  const handleSelectEmail = (email: UniversalEmailMessage) => {
    setSelectedId(email.id);
    setIsComposing(false);
    if (!email.isRead) {
      void onSaveEmail({ ...email, isRead: true, updatedAt: new Date().toISOString() }, false);
    }
  };

  const handleStartCompose = (template?: 'blank' | 'otp' | 'magic-link' | 'passkey-invite') => {
    setIsComposing(true);
    setEditingDraftId(null);
    setFromAddr(defaultUserEmail || 'developer@auth.demo-ios.app');
    setToAddr(defaultUserEmail || 'maya.lin@icloud.com');
    setReplyToAddr('');

    if (template === 'otp') {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setSubject(`Your verification code is ${code}`);
      setBodyText(
        `Enter this 6-digit code in iOS Passwords / AutoFill (UITextContentType.oneTimeCode):\n\n${code}\n\nWorks across Apple Mail, Gmail, Outlook, Proton, and Fastmail.`
      );
    } else if (template === 'magic-link') {
      setSubject('Sign in to AuthDemo iOS via Universal Link');
      setBodyText(
        'Tap this Universal Link on your iPhone 12 Pro to authenticate and register a Passkey:\n\nhttps://auth.demo-ios.app/auth/callback?token=ml_universal_demo\n'
      );
    } else if (template === 'passkey-invite') {
      setSubject('Enroll your iPhone 12 Pro Passkey');
      setBodyText(
        'Upgrade your account to passwordless sign-in with Face ID and iCloud Keychain Passkeys:\n\nhttps://auth.demo-ios.app/passkeys/enroll\n'
      );
    } else {
      setSubject('');
      setBodyText('');
    }
  };

  const handleReplyOrForward = (mode: 'reply' | 'forward', source: UniversalEmailMessage) => {
    setIsComposing(true);
    setEditingDraftId(null);
    setFromAddr(defaultUserEmail || 'developer@auth.demo-ios.app');
    if (mode === 'reply') {
      setToAddr(source.replyTo || source.from);
      setSubject(source.subject.startsWith('Re:') ? source.subject : `Re: ${source.subject}`);
      setBodyText(`\n\n--- On ${new Date(source.createdAt).toLocaleString()}, ${source.from} wrote ---\n${source.body}`);
    } else {
      setToAddr('');
      setSubject(source.subject.startsWith('Fwd:') ? source.subject : `Fwd: ${source.subject}`);
      setBodyText(`--- Forwarded message ---\nFrom: ${source.from}\nTo: ${source.to}\nSubject: ${source.subject}\n\n${source.body}`);
    }
  };

  const handleSaveComposed = async (targetFolder: 'sent' | 'drafts') => {
    const cleanTo = toAddr.trim();
    const cleanSubj = subject.trim() || '(No Subject)';
    const cleanBody = bodyText.trim() || ' ';
    if (!cleanTo) {
      setStatusNotice('Enter a recipient email address first.');
      return;
    }

    const now = new Date().toISOString();
    const detectedOtp = cleanBody.match(/\b(\d{6})\b/)?.[1];
    const detectedMagicLink = cleanBody.match(/https:\/\/[^\s]+/)?.[0];

    const record: UniversalEmailMessage = {
      id: editingDraftId || `mail-${Date.now()}`,
      folder: targetFolder,
      from: fromAddr.trim() || 'developer@auth.demo-ios.app',
      to: cleanTo,
      replyTo: replyToAddr.trim() || undefined,
      subject: cleanSubj,
      body: cleanBody,
      providerHint: preferredProvider,
      otpCode: detectedOtp,
      magicLinkUrl: detectedMagicLink,
      isRead: true,
      isStarred: false,
      createdAt: now,
      updatedAt: now,
    };

    await onSaveEmail(record, !editingDraftId);
    setActiveFolder(targetFolder);
    setSelectedId(record.id);
    setIsComposing(false);
    setEditingDraftId(null);
    setStatusNotice(
      targetFolder === 'sent'
        ? `Saved to Sent (${isSignedIn ? 'synced to Firestore' : 'local sandbox'}). Use the provider launcher to dispatch via ${activeProviderMeta.label}.`
        : 'Draft saved.'
    );
  };

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const composeExternalUrl = activeProviderMeta.buildUrl({
    to: toAddr.trim() || 'user@example.com',
    subject: subject.trim() || 'AuthServices Lab Message',
    body: bodyText.trim(),
  });

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-sky-700">
            Universal Mail Client · RFC 6068 mailto: · RFC 5322 .eml · Apple Mail / Gmail / Outlook / Proton / Fastmail
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Universal Email Client &amp; iOS Auth Inbox
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
            Compose, test, and route emails across any universal email provider—including Apple Mail on iPhone 12 Pro, Gmail, Outlook, Proton, Fastmail, and Hide My Email Private Relay addresses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartCompose('blank')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            Compose Email
          </button>
          <button
            type="button"
            onClick={() => void onResetEmails()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Inbox
          </button>
        </div>
      </div>

      {/* Universal Provider Bridge & Auth Email Simulators */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Universal Email Provider Target
              </h2>
              <p className="text-xs text-slate-500">{activeProviderMeta.note}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreferredProvider(p.id)}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  preferredProvider === p.id
                    ? 'border-sky-600 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Simulate Incoming iOS Authentication Emails
            </h2>
            <p className="text-xs text-slate-500">
              Deliver test OTP, Universal Link, Passkey alert, or Hide My Email relay messages into your inbox.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void onSimulateAuthEmail('otp', defaultUserEmail || 'maya.lin@icloud.com', preferredProvider)
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              Receive 6-Digit OTP
            </button>
            <button
              type="button"
              onClick={() =>
                void onSimulateAuthEmail('magic-link', defaultUserEmail || 'maya.lin@icloud.com', preferredProvider)
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Receive Magic Link
            </button>
            <button
              type="button"
              onClick={() =>
                void onSimulateAuthEmail('passkey-alert', defaultUserEmail || 'maya.lin@icloud.com', preferredProvider)
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Passkey Security Alert
            </button>
            <button
              type="button"
              onClick={() =>
                void onSimulateAuthEmail('relay', defaultUserEmail || 'maya.lin@icloud.com', preferredProvider)
              }
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            >
              Apple Private Relay Test
            </button>
          </div>
        </div>
      </div>

      {statusNotice && (
        <div className="flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-medium text-sky-900">
          <span>{statusNotice}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-sky-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 3-Pane Email Client */}
      <div className="grid overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-12 min-h-[560px]">
        {/* Folders Column */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-3 lg:col-span-2 lg:border-b-0 lg:border-r space-y-1.5">
          {(
            [
              { id: 'inbox', label: 'Inbox', icon: Inbox },
              { id: 'sent', label: 'Sent', icon: Send },
              { id: 'drafts', label: 'Drafts', icon: FileText },
              { id: 'relay', label: 'Private Relay', icon: Shield },
            ] as const
          ).map((f) => {
            const Icon = f.icon;
            const active = activeFolder === f.id && !isComposing;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setActiveFolder(f.id);
                  setIsComposing(false);
                  setSelectedId(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </span>
                <span className="font-mono text-[11px] opacity-80 tabular-nums">
                  {folderCounts[f.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Message List Column */}
        <div className="border-b border-slate-200 lg:col-span-4 lg:border-b-0 lg:border-r flex flex-col">
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject, sender, or body..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[520px]">
            {filteredEmails.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No messages in this folder.
              </div>
            ) : (
              filteredEmails.map((item) => {
                const isSelected = !isComposing && selectedEmail?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectEmail(item)}
                    className={`w-full p-3.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-sky-50/90'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-xs ${
                          item.isRead ? 'font-medium text-slate-700' : 'font-bold text-slate-950'
                        }`}
                      >
                        {activeFolder === 'sent' ? `To: ${item.to}` : item.from}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {new Date(item.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-slate-900">
                      {item.subject}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {item.body}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Reader or Composer Column */}
        <div className="lg:col-span-6 flex flex-col">
          {isComposing ? (
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Compose Universal Email
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleStartCompose('otp')}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    OTP Template
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCompose('magic-link')}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Magic Link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCompose('passkey-invite')}
                    className="rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Passkey Invite
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="font-medium text-slate-700">From</span>
                  <input
                    type="email"
                    value={fromAddr}
                    onChange={(e) => setFromAddr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700">To (Any Email Provider)</span>
                  <input
                    type="email"
                    value={toAddr}
                    onChange={(e) => setToAddr(e.target.value)}
                    placeholder="recipient@domain.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="font-medium text-slate-700">Reply-To (Optional / Private Relay)</span>
                  <input
                    type="email"
                    value={replyToAddr}
                    onChange={(e) => setReplyToAddr(e.target.value)}
                    placeholder="alias@privaterelay.appleid.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </label>
                <label className="block text-xs">
                  <span className="font-medium text-slate-700">Subject</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Message Body</span>
                <textarea
                  rows={7}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Write your email body..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveComposed('sent')}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Save &amp; Log Sent
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveComposed('drafts')}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Save Draft
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={composeExternalUrl}
                    target={preferredProvider === 'mailto' || preferredProvider === 'icloud' || preferredProvider === 'proton' ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open in {activeProviderMeta.label.split(' ')[0]}
                  </a>
                  <button
                    type="button"
                    onClick={() =>
                      downloadEmlFile({
                        from: fromAddr || 'developer@auth.demo-ios.app',
                        to: toAddr || 'user@example.com',
                        replyTo: replyToAddr || undefined,
                        subject: subject || '(No Subject)',
                        body: bodyText || ' ',
                      })
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .eml
                  </button>
                </div>
              </div>
            </div>
          ) : selectedEmail ? (
            <div className="flex flex-1 flex-col justify-between p-5 space-y-5">
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {selectedEmail.subject}
                    </h3>
                    <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                      <div>
                        <span className="font-medium text-slate-800">From:</span>{' '}
                        <span className="font-mono">{selectedEmail.from}</span>
                      </div>
                      <div>
                        <span className="font-medium text-slate-800">To:</span>{' '}
                        <span className="font-mono">{selectedEmail.to}</span>
                      </div>
                      {selectedEmail.replyTo && (
                        <div>
                          <span className="font-medium text-slate-800">Reply-To:</span>{' '}
                          <span className="font-mono">{selectedEmail.replyTo}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        void onSaveEmail(
                          { ...selectedEmail, isStarred: !selectedEmail.isStarred, updatedAt: new Date().toISOString() },
                          false
                        )
                      }
                      aria-label="Toggle star"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                    >
                      <Star
                        className={`h-4 w-4 ${
                          selectedEmail.isStarred ? 'fill-amber-400 text-amber-500' : ''
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteEmail(selectedEmail.id)}
                      aria-label="Delete email"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Auto-Detected iOS Auth Artifacts */}
                {(selectedEmail.otpCode || selectedEmail.magicLinkUrl) && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950">
                    {selectedEmail.otpCode && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">iOS oneTimeCode:</span>
                        <span className="font-mono text-sm font-bold tracking-wider">
                          {selectedEmail.otpCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleCopyText('otp', selectedEmail.otpCode!)}
                          className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800"
                        >
                          {copiedId === 'otp' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedId === 'otp' ? 'Copied' : 'Copy Code'}
                        </button>
                      </div>
                    )}
                    {selectedEmail.magicLinkUrl && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Universal Link:</span>
                        <code className="font-mono text-[11px] break-all">
                          {selectedEmail.magicLinkUrl}
                        </code>
                        <button
                          type="button"
                          onClick={() => void handleCopyText('magic', selectedEmail.magicLinkUrl!)}
                          className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 shrink-0"
                        >
                          {copiedId === 'magic' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedId === 'magic' ? 'Copied' : 'Copy Link'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/60 p-4 text-sm leading-relaxed text-slate-800">
                  {selectedEmail.body}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReplyOrForward('reply', selectedEmail)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReplyOrForward('forward', selectedEmail)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Forward className="h-3.5 w-3.5" />
                    Forward
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={activeProviderMeta.buildUrl({
                      to: selectedEmail.replyTo || selectedEmail.from,
                      subject: `Re: ${selectedEmail.subject}`,
                      body: `\n\n--- Original Message ---\n${selectedEmail.body}`,
                    })}
                    target={preferredProvider === 'mailto' || preferredProvider === 'icloud' || preferredProvider === 'proton' ? undefined : '_blank'}
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Reply in {activeProviderMeta.label.split(' ')[0]}
                  </a>
                  <button
                    type="button"
                    onClick={() => downloadEmlFile(selectedEmail)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export .eml
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
                <Mail className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Select an email or compose a universal message
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                Supports RFC 6068 mailto:, RFC 5322 .eml export, Apple Private Relay, Gmail, Outlook, Proton, and Fastmail.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
