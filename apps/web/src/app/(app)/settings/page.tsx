'use client'

import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '../../../lib/supabaseBrowser'

import { User as UserIcon, Shield, LogOut, CheckCircle2, Clock, RefreshCw } from 'lucide-react'

const SettingsSkeleton = () => (
  <main className="min-h-[calc(100vh-73px)] pb-32 bg-[#09090b] text-white">
    <div className="max-w-[800px] mx-auto px-6 py-12 space-y-8 animate-pulse">
      <div className="flex flex-col gap-4">
        <div className="h-10 w-64 bg-white/5 rounded-lg" />
        <div className="h-5 w-96 bg-white/5 rounded-lg" />
      </div>
      <div className="h-[200px] w-full bg-[#1a1a1c] rounded-2xl" />
      <div className="h-[200px] w-full bg-[#1a1a1c] rounded-2xl" />
    </div>
  </main>
)

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'connected' | 'no_extension'>('idle')
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  // Post the auth token to the extension via postMessage.
  // authSync.ts (content script) listens for PROMPTLY_AUTH_TOKEN and saves
  // it to chrome.storage.local, then replies with PROMPTLY_AUTH_SYNCED.
  const syncTokenToExtension = (accessToken: string) => {
    setSyncStatus('syncing')
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2) + timestamp.toString(36);
    window.postMessage({ type: 'PROMPTLY_AUTH_TOKEN', token: accessToken, timestamp, nonce }, window.location.origin)

    // Give the extension 3 seconds to acknowledge
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    syncTimeoutRef.current = setTimeout(() => {
      setSyncStatus(prev => prev === 'syncing' ? 'no_extension' : prev)
    }, 3000)
  }

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
          setToken(session.access_token)
          // Auto-sync token to extension on page load
          syncTokenToExtension(session.access_token)
        } else {
          window.location.href = '/login'
        }
      } catch {
        window.location.href = '/login'
      } finally {
        setLoading(false)
      }
    }
    loadData()

    // Listen for extension acknowledgement
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type && event.data.type.startsWith('PROMPTLY_')) {
        console.log('[SettingsPage] Received message:', event.data.type, 'from origin:', event.origin);
      }
      
      if (event.origin !== window.location.origin) return
      
      if (event.data?.type === 'PROMPTLY_AUTH_SYNCED') {
        console.log('[SettingsPage] Sync confirmed! Updating UI to connected.');
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
        setSyncStatus('connected')
      }
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return <SettingsSkeleton />

  return (
    <main className="min-h-[calc(100vh-73px)] pb-32 bg-[#09090b] text-white font-sans relative overflow-hidden">
      
      {/* Background Gradients (Subtle) */}
      <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-[800px] mx-auto px-6 py-12 relative z-10">
        
        {/* Header */}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-[32px] font-semibold tracking-tight text-white flex items-center gap-3">
              Account Settings
            </h1>
            <p className="text-sm text-zinc-400 mt-2">
              Manage your credentials, extension sync, and data privacy.
            </p>
          </div>
          
          <button 
            onClick={handleSignOut} 
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </header>

        <div className="space-y-6">
          
          {/* Extension Status Block */}
          <section className="bg-[#1a1a1c] border border-white/[0.04] p-6 md:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                <Shield className="text-blue-400" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Extension Sync Status</h2>
                <p className="text-xs text-zinc-400">Ensure your Chrome extension is connected to your account.</p>
              </div>
            </div>
            
            <div className="-mt-2 mb-2">
              {/* Extension Sync Status Badge */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
                syncStatus === 'connected'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : syncStatus === 'no_extension'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  : 'bg-white/[0.03] border-white/[0.06] text-zinc-400'
              }`}>
                {syncStatus === 'connected' && <CheckCircle2 size={16} className="shrink-0" />}
                {syncStatus === 'syncing'   && <Clock size={16} className="shrink-0 animate-pulse" />}
                {syncStatus === 'no_extension' && <Clock size={16} className="shrink-0" />}
                {syncStatus === 'idle'      && <Clock size={16} className="shrink-0" />}
                <span>
                  {syncStatus === 'connected'    && 'Extension connected — token synced successfully.'}
                  {syncStatus === 'syncing'       && 'Syncing token to extension…'}
                  {syncStatus === 'no_extension'  && 'Extension not detected. Make sure Proenpt is installed and this tab is open.'}
                  {syncStatus === 'idle'          && 'Waiting to sync…'}
                </span>
                {token && syncStatus !== 'syncing' && (
                  <button
                    onClick={() => syncTokenToExtension(token)}
                    className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <RefreshCw size={11} />
                    Resync
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
              When synced, your extension will automatically fetch your active Context Profiles and securely send optimization requests to your account.
            </p>
          </section>

          {/* Profile Block */}
          <section className="bg-[#1a1a1c] border border-white/[0.04] p-6 md:p-8 rounded-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <UserIcon className="text-purple-400" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">Profile Information</h2>
                <p className="text-xs text-zinc-400">Your core identity on Promptly.</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-widest">
                  Email Address
                </label>
                <div className="px-4 py-3 bg-[#09090b] border border-white/[0.04] rounded-xl text-zinc-300 text-sm">
                  {user?.email}
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 mb-2 uppercase tracking-widest">
                  Account ID
                </label>
                <div className="px-4 py-3 bg-[#09090b] border border-white/[0.04] rounded-xl text-zinc-500 font-mono text-sm">
                  {user?.id}
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  )
}
