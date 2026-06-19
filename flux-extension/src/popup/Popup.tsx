import React, { useEffect, useState, useId } from "react";
import { getSettings, setSettings as persistSettings } from "../lib/storage";
import { ContextProfile, PromptlySettings, PROMPT_MODES, REWRITE_LEVELS, PromptMode, RewriteLevel } from '@promptly/types';

export const Popup: React.FC = () => {
  const [settings, setSettings] = useState<PromptlySettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'context'>('general');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const update = async (partial: Partial<PromptlySettings>) => {
    const next = await persistSettings(partial);
    setSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const updateContext = (partial: Partial<ContextProfile>) => {
    if (!settings) return;
    update({ contextProfile: { ...settings.contextProfile, ...partial } });
  };

  if (!settings) {
    return <div className="p-6 text-[13px] text-[var(--text-secondary)] animate-pulse">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-4 p-5 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--text-primary)] text-[var(--surface-base)] shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h1 className="font-display text-[15px] font-semibold text-[var(--text-primary)] leading-none mb-1">Promptly</h1>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Prompt Optimizer</p>
            </div>
          </div>
          <div className="h-4">
            {saved && <span className="text-[11px] font-medium text-[var(--text-tertiary)] transition-opacity">Saved</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-subtle)] w-full">
          {(['general', 'context'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-2 text-[12px] font-medium transition-colors ${
                activeTab === tab 
                  ? 'text-[var(--text-primary)] border-b-2 border-[var(--text-primary)]' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] border-b-2 border-transparent'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-5 pb-6 custom-scrollbar">
        {activeTab === 'general' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Defaults</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mode">
                  <select
                    className="select"
                    value={settings.defaultMode}
                    onChange={(e) => update({ defaultMode: e.target.value as PromptMode })}
                    aria-label="Default prompt mode"
                  >
                    {PROMPT_MODES.map((m: { value: string, label: string }) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Rewrite level">
                  <select
                    className="select"
                    value={settings.defaultLevel}
                    onChange={(e) => update({ defaultLevel: e.target.value as RewriteLevel })}
                    aria-label="Default rewrite level"
                  >
                    {REWRITE_LEVELS.map((l: { value: string, label: string }) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </section>
            
            <div className="minimal-divider" />
            
            <section className="space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Preferences</h2>
              <div className="flex items-center justify-between promptly-card p-3">
                <div>
                  <p className="text-[12px] font-medium text-white">Keyboard shortcut</p>
                  <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5">Open optimizer from any input</p>
                </div>
                <kbd className="rounded bg-[var(--surface-base)] border border-[var(--border-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
                  Ctrl+Shift+P
                </kbd>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'context' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Context Memory</h2>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1">Woven into every optimization.</p>
                </div>
                <Toggle
                  checked={settings.contextInjectionEnabled}
                  onChange={(checked) => update({ contextInjectionEnabled: checked })}
                  ariaLabel="Enable Context Memory"
                />
              </div>
              
              <div className={`transition-opacity duration-300 ${!settings.contextInjectionEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company">
                    <input className="input" value={settings.contextProfile.companyName ?? ""} onChange={(e) => updateContext({ companyName: e.target.value })} placeholder="Acme Inc." />
                  </Field>
                  <Field label="Industry">
                    <input className="input" value={settings.contextProfile.industry ?? ""} onChange={(e) => updateContext({ industry: e.target.value })} placeholder="SaaS" />
                  </Field>
                  <Field label="Audience">
                    <input className="input" value={settings.contextProfile.audience ?? ""} onChange={(e) => updateContext({ audience: e.target.value })} placeholder="Founders" />
                  </Field>
                  <Field label="Brand tone">
                    <input className="input" value={settings.contextProfile.brandTone ?? ""} onChange={(e) => updateContext({ brandTone: e.target.value })} placeholder="Minimal" />
                  </Field>
                  <Field label="Style">
                    <input className="input" value={settings.contextProfile.writingStyle ?? ""} onChange={(e) => updateContext({ writingStyle: e.target.value })} placeholder="Direct" />
                  </Field>
                  <Field label="Website">
                    <input className="input" value={settings.contextProfile.websiteUrl ?? ""} onChange={(e) => updateContext({ websiteUrl: e.target.value })} placeholder="acme.com" />
                  </Field>
                </div>
              </div>
            </section>
          </div>
        )}


      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const id = useId();
  const child = React.isValidElement(children) && (children.type === 'input' || children.type === 'select')
    ? React.cloneElement(children as React.ReactElement, { id })
    : children;
    
  return (
    <div className="block">
      <label htmlFor={id} className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      {child}
    </div>
  );
};

const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; ariaLabel?: string }> = ({ checked, onChange, ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${checked ? "bg-[var(--text-primary)]" : "bg-[var(--surface-floating)] border-[var(--border-subtle)]"}`}
  >
    <span
      className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-4 bg-[var(--surface-base)]" : "translate-x-0.5 bg-[var(--text-tertiary)]"}`}
    />
  </button>
);
