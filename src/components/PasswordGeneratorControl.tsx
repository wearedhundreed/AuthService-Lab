import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Check, ArrowDownToLine } from 'lucide-react';
import { PasswordGeneratorOptions } from '../types/auth';

interface PasswordGeneratorControlProps {
  onApplyPassword?: (password: string) => void;
  applyLabel?: string;
  compact?: boolean;
}

export const PasswordGeneratorControl: React.FC<PasswordGeneratorControlProps> = ({
  onApplyPassword,
  applyLabel = 'Use Password',
  compact = false,
}) => {
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 20,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    appleFormat: false,
  });

  const [generatedPassword, setGeneratedPassword] = useState('');
  const [entropyBits, setEntropyBits] = useState(0);
  const [rulesDescriptor, setRulesDescriptor] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(async (opts: PasswordGeneratorOptions) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/passwords/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          password: string;
          entropyBits: number;
          rulesDescriptor: string;
        };
        setGeneratedPassword(data.password);
        setEntropyBits(data.entropyBits);
        setRulesDescriptor(data.rulesDescriptor);
      }
    } catch {
      const pool =
        (opts.uppercase ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : '') +
        (opts.lowercase ? 'abcdefghijkmnopqrstuvwxyz' : '') +
        (opts.numbers ? '23456789' : '') +
        (opts.symbols ? '!@#$%^&*-_=+?' : '') || 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      const len = opts.appleFormat ? 19 : Math.max(8, Math.min(64, opts.length));
      const bytes = new Uint8Array(len);
      crypto.getRandomValues(bytes);
      const generated = Array.from(bytes, (b) => pool[b % pool.length]).join('');
      setGeneratedPassword(generated);
      setEntropyBits(Math.round(len * Math.log2(pool.length)));
      setRulesDescriptor(`minlength: ${len}; local-csprng-fallback;`);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  useEffect(() => {
    void generate(options);
  }, [options, generate]);

  const toggleCharacterClass = (key: 'uppercase' | 'lowercase' | 'numbers' | 'symbols') => {
    setOptions((prev) => {
      const next = { ...prev, appleFormat: false, [key]: !prev[key] };
      // Prevent disabling all 4 character sets simultaneously
      if (!next.uppercase && !next.lowercase && !next.numbers && !next.symbols) {
        return prev;
      }
      return next;
    });
  };

  const handleCopy = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored in restricted frames
    }
  };

  const strengthLabel =
    entropyBits >= 96 ? 'Very Strong' : entropyBits >= 64 ? 'Strong' : 'Moderate';
  const strengthColor =
    entropyBits >= 96
      ? 'text-emerald-700'
      : entropyBits >= 64
        ? 'text-sky-700'
        : 'text-amber-700';

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/80 ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-display text-sm font-semibold text-slate-900">
            Strong Password Generator
          </h4>
          <p className="text-xs text-slate-600">
            Cryptographic CSPRNG with customizable length, character sets, and iOS password rules.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setOptions((p) => ({ ...p, appleFormat: false }))}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              !options.appleFormat
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Custom Rules
          </button>
          <button
            type="button"
            onClick={() => setOptions((p) => ({ ...p, appleFormat: true }))}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              options.appleFormat
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Apple Hyphenated
          </button>
        </div>
      </div>

      {/* Generated output strip */}
      <div className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm font-medium text-slate-900 break-all select-all">
          {generatedPassword || 'Generating...'}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void generate(options)}
            disabled={isGenerating}
            aria-label="Regenerate password"
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>

          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label="Copy generated password"
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          {onApplyPassword && (
            <button
              type="button"
              onClick={() => generatedPassword && onApplyPassword(generatedPassword)}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-sky-700 whitespace-nowrap shrink-0"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              {applyLabel}
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      {!options.appleFormat && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="pwd-length-slider" className="text-xs font-medium text-slate-700">
              Length: <span className="font-mono font-semibold text-slate-900 tabular-nums">{options.length} characters</span>
            </label>
            <input
              id="pwd-length-slider"
              type="range"
              min={8}
              max={48}
              value={options.length}
              onChange={(e) =>
                setOptions((prev) => ({ ...prev, length: Number(e.target.value) }))
              }
              className="w-48 sm:w-64 accent-sky-600 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { key: 'uppercase', label: 'Uppercase', sample: 'A-Z' },
                { key: 'lowercase', label: 'Lowercase', sample: 'a-z' },
                { key: 'numbers', label: 'Numbers', sample: '0-9' },
                { key: 'symbols', label: 'Symbols', sample: '!@#$' },
              ] as const
            ).map((item) => {
              const active = options[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleCharacterClass(item.key)}
                  aria-pressed={active}
                  className={`flex min-h-[40px] items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'border-sky-600 bg-sky-50 text-sky-900'
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="font-mono text-[11px] opacity-80">{item.sample}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entropy & UITextPasswordRules metadata */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${strengthColor}`}>{strengthLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{entropyBits} bits entropy</span>
        </div>
        <span className="font-mono text-[11px] text-slate-500 truncate max-w-full">
          UITextPasswordRules: {rulesDescriptor}
        </span>
      </div>
    </div>
  );
};
