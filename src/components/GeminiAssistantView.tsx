import React, { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, User as UserIcon } from 'lucide-react';
import { AssistantRole, ChatMessageItem, ChatTaskMode, DeviceTarget } from '../types/auth';

interface GeminiAssistantViewProps {
  messages: ChatMessageItem[];
  deviceTarget: DeviceTarget;
  isSignedIn: boolean;
  onSendMessage: (
    text: string,
    taskMode: ChatTaskMode,
    assistantRole: AssistantRole
  ) => Promise<void>;
  onClearMessages: () => Promise<void>;
}

const ROLE_OPTIONS: Array<{ id: AssistantRole; label: string; description: string }> = [
  {
    id: 'security-architect',
    label: 'iOS Security Architect',
    description: 'Passkeys, Secure Enclave, LAContext, and .biometryCurrentSet Keychain auditing.',
  },
  {
    id: 'autofill-specialist',
    label: 'Passwords & AutoFill Specialist',
    description: 'ASCredentialProviderViewController, UITextContentType, TOTP, and AASA bindings.',
  },
  {
    id: 'xcode-debugger',
    label: 'iPhone 12 Pro & Xcode Debugger',
    description: 'Diagnoses ASAuthorizationError, LAError, entitlements, and physical device deployment.',
  },
];

const MODE_OPTIONS: Array<{ id: ChatTaskMode; label: string; modelNote: string }> = [
  { id: 'fast', label: 'Fast Lookup', modelNote: 'gemini-3.1-flash-lite · Minimal latency' },
  { id: 'general', label: 'General Guide', modelNote: 'gemini-4-hydrogen · Balanced' },
  { id: 'complex', label: 'Interactive Debug', modelNote: 'gemini-4-hydrogen · High reasoning' },
  { id: 'deep', label: 'Deep Security Audit', modelNote: 'gemini-4-hydrogen · XHigh reasoning' },
];

const QUICK_PROMPTS = [
  'How do I deploy and test Face ID + Keychain .biometryCurrentSet on my iPhone 12 Pro?',
  'Walk me through enabling Associated Domains Development on iPhone 12 Pro for Passkeys.',
  'Decode LAError.biometryLockout (-8) and show the SwiftUI passcode fallback flow.',
  'Review my ASCredentialProviderViewController extension for iOS 18 Passwords AutoFill.',
];

export const GeminiAssistantView: React.FC<GeminiAssistantViewProps> = ({
  messages,
  deviceTarget,
  isSignedIn,
  onSendMessage,
  onClearMessages,
}) => {
  const [input, setInput] = useState('');
  const [taskMode, setTaskMode] = useState<ChatTaskMode>('general');
  const [assistantRole, setAssistantRole] = useState<AssistantRole>('security-architect');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  const handleSubmit = async (textToSend?: string) => {
    const trimmed = (textToSend ?? input).trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    if (!textToSend) setInput('');
    setIsSending(true);
    try {
      await onSendMessage(trimmed, taskMode, assistantRole);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach Gemini assistant.');
    } finally {
      setIsSending(false);
    }
  };

  const activeRoleMeta = ROLE_OPTIONS.find((r) => r.id === assistantRole) || ROLE_OPTIONS[0];
  const activeModeMeta = MODE_OPTIONS.find((m) => m.id === taskMode) || MODE_OPTIONS[1];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-sky-700">
            Multi-Turn Engineering Assistant · Target: {deviceTarget === 'iphone-12-pro' ? 'iPhone 12 Pro' : 'iPhone 16 Pro'} ·{' '}
            {isSignedIn ? 'Firestore Sync Active' : 'Session History'}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            iOS Authentication &amp; Passwords Assistant
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 leading-relaxed">
            Ask multi-turn questions about AuthenticationServices, Passkeys, Face ID, Keychain ACLs, or iPhone 12 Pro Xcode deployment with role-based system instructions.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => void onClearMessages()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Thread
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Configuration Sidebar */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Assistant System Role
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{activeRoleMeta.description}</p>
              <div className="mt-3 space-y-2">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setAssistantRole(role.id)}
                    className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                      assistantRole === role.id
                        ? 'border-sky-600 bg-sky-50 text-sky-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Task Speed &amp; Reasoning Depth
              </h2>
              <p className="mt-0.5 font-mono text-[11px] text-slate-500">{activeModeMeta.modelNote}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {MODE_OPTIONS.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setTaskMode(mode.id)}
                    className={`min-h-[40px] rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      taskMode === mode.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              iPhone 12 Pro Quick Prompts
            </h3>
            <div className="space-y-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isSending}
                  onClick={() => void handleSubmit(prompt)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Multi-Turn Thread */}
        <div className="lg:col-span-8 flex h-[640px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-5 py-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{activeRoleMeta.label}</span>
            <span className="font-mono text-[11px] tabular-nums">
              {messages.length} message{messages.length === 1 ? '' : 's'} · {activeModeMeta.modelNote}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700">
                  <Bot className="h-6 w-6" />
                </div>
                <h3 className="mt-3 font-display text-base font-bold text-slate-900">
                  Start an iOS Authentication Conversation
                </h3>
                <p className="mt-1 max-w-md text-xs text-slate-600 leading-relaxed">
                  Ask a question below or pick an iPhone 12 Pro quick prompt on the left. Conversation context is preserved across turns{isSignedIn ? ' and saved to Firestore' : ''}.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                        isUser
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-200 bg-slate-50/70 text-slate-900'
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] opacity-75">
                        <span className="font-semibold">{isUser ? 'You' : activeRoleMeta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{msg.model}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words text-[13px]">{msg.text}</div>
                    </div>

                    {isUser && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
                        <UserIcon className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                  <Bot className="h-4 w-4 animate-pulse" />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Analyzing with {activeModeMeta.modelNote}...
                </div>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {errorMsg && (
            <div className="border-t border-rose-200 bg-rose-50 px-5 py-2.5 text-xs font-medium text-rose-800">
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="border-t border-slate-200 bg-white p-3.5"
          >
            <div className="flex items-end gap-2.5">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Ask about Passkeys, Face ID, Keychain ACLs, or iPhone 12 Pro Xcode setup..."
                className="flex-1 resize-none rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
