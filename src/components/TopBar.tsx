import React from 'react';
import { NavSection } from '../types/auth';

interface TopBarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onRunTestSuite: () => void;
  isRunningTests: boolean;
}

const NAV_ITEMS: Array<{ id: NavSection; label: string }> = [
  { id: 'biometrics', label: 'Passkeys & Biometrics' },
  { id: 'passwords', label: 'Passwords Vault' },
  { id: 'aasa', label: 'AASA & Domains' },
  { id: 'email', label: 'Universal Email' },
  { id: 'tasks', label: 'Google Tasks' },
  { id: 'swift', label: 'Swift Code' },
  { id: 'assistant', label: 'AI Assistant' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onSelectSection,
  onRunTestSuite,
  isRunningTests,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-6 py-3.5">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection('biometrics');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          AuthServices Lab
        </a>

        <nav className="hidden md:flex items-center gap-3 lg:gap-5 xl:gap-6" aria-label="Primary sections">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`relative py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-sky-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onRunTestSuite}
            disabled={isRunningTests}
            className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
          >
            {isRunningTests ? 'Running Suite...' : 'Run Test Suite'}
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={`min-h-[36px] px-2 text-xs font-medium whitespace-nowrap shrink-0 ${
                isActive ? 'text-sky-700 underline underline-offset-4' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
