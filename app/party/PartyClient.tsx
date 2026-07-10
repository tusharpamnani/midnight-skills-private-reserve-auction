'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkIn,
  claimFees,
  closeEntry,
  deployParty,
  fetchPartyState,
  rsvp,
  startParty,
  userAddressFromSession,
  ZK_PATH,
} from '@/lib/party';
import { createConnectedSession, detectWallet, type ConnectedSession } from '@/lib/midnight';
import { generateSecret, loadSecret, saveSecret } from '@/lib/secret';

type Role = 'organizer' | 'attendee';

function statusColor(state: string | undefined) {
  switch (state) {
    case 'NOT_STARTED':
      return 'bg-amber-900/30 text-amber-300 ring-amber-600/40';
    case 'READY':
      return 'bg-blue-900/30 text-blue-300 ring-blue-600/40';
    case 'STARTED':
      return 'bg-green-900/30 text-green-300 ring-green-600/40';
    case 'DOORS_CLOSED':
      return 'bg-purple-900/30 text-purple-300 ring-purple-600/40';
    default:
      return 'bg-zinc-800 text-zinc-300 ring-zinc-600/40';
  }
}

function truncate(addr: string) {
  return addr.length > 16 ? addr.slice(0, 8) + '...' + addr.slice(-6) : addr;
}

export default function PartyClient() {
  const [session, setSession] = useState<ConnectedSession | null>(null);
  const [role, setRole] = useState<Role>('attendee');
  const [contractAddress, setContractAddress] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [entryFee, setEntryFee] = useState('5');
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchPartyState>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session || !contractAddress) return;
    setStatus(await fetchPartyState(session.config.indexerUri, contractAddress));
  }, [session, contractAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const organizerSecret = useMemo(
    () => (contractAddress ? loadSecret('organizer', contractAddress) : null),
    [contractAddress, status],
  );

  const attendeeSecret = useMemo(
    () => (contractAddress ? loadSecret('attendee', contractAddress) : null),
    [contractAddress, status],
  );

  async function onConnect() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const wallet = await detectWallet();
      const api = await wallet.connect('preview');
      setSession(await createConnectedSession(api, ZK_PATH));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeploy() {
    if (!session) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const secret = generateSecret();
      const addr = await deployParty(
        session,
        Number(partySize),
        Number(entryFee),
        secret,
      );
      setContractAddress(addr);
      saveSecret('organizer', addr, secret);
      setMessage(`Party deployed. Share this address with guests: ${addr}`);
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRsvp() {
    if (!session || !contractAddress) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let secret = loadSecret('attendee', contractAddress);
      if (!secret) {
        secret = generateSecret();
        saveSecret('attendee', contractAddress, secret);
      }
      await rsvp(session, contractAddress, userAddressFromSession(session), secret);
      setMessage('RSVP submitted privately -- your address is not on-chain yet.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onStartParty() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await startParty(session, contractAddress, organizerSecret);
      setMessage('Party started -- guests can check in.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCheckIn() {
    if (!session || !contractAddress || !attendeeSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await checkIn(session, contractAddress, userAddressFromSession(session), attendeeSecret);
      setMessage(
        'Checked in -- unshielded entry fee paid. Your address is now public on the ledger.',
      );
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCloseEntry() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await closeEntry(session, contractAddress, organizerSecret);
      setMessage('Doors closed.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onClaimFees() {
    if (!session || !contractAddress || !organizerSecret) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await claimFees(
        session,
        contractAddress,
        userAddressFromSession(session),
        organizerSecret,
      );
      setMessage('Fees claimed to your unshielded address.');
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const canRsvp = status?.partyState === 'NOT_STARTED';
  const canStart =
    status?.partyState === 'NOT_STARTED' || status?.partyState === 'READY';
  const canCheckIn = status?.partyState === 'STARTED' && Boolean(attendeeSecret);
  const canClose = status?.partyState === 'STARTED' && Boolean(organizerSecret);
  const canClaim = status?.partyState === 'DOORS_CLOSED' && Boolean(organizerSecret);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 font-sans">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
          Private Party
        </h1>
        <p className="mt-2 text-muted">
          Attendees RSVP <em>privately</em>. Checking in pays unshielded NIGHT and
          crosses the <strong className="text-zinc-100">privacy boundary</strong> — guest
          addresses become public on the ledger.
        </p>
      </div>

      {!session ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-muted text-sm">
            Connect your 1AM wallet to get started
          </p>
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="cursor-pointer rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Connecting\u2026' : 'Connect 1AM Wallet'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Wallet info */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="size-2 rounded-full bg-green-500" />
              Connected
            </div>
            <code className="rounded-md bg-surface px-3 py-1 text-xs font-mono text-zinc-300 ring-1 ring-border">
              {truncate(session.unshieldedAddress)}
            </code>
          </div>

          {/* Role + contract address */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              Role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm text-zinc-100 shadow-sm transition focus:border-brand focus:ring-2 focus:ring-brand/40"
              >
                <option value="organizer">Organizer</option>
                <option value="attendee">Attendee</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-zinc-300">
              Contract address
              <input
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value.trim())}
                placeholder="Paste deployed contract address"
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-zinc-100 shadow-sm transition placeholder:text-zinc-500 focus:border-brand focus:ring-2 focus:ring-brand/40"
              />
            </label>
          </div>

          {/* Party state card */}
          {status ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusColor(status.partyState)}`}
                >
                  {status.partyState.replace(/_/g, ' ')}
                </span>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                  <span>
                    RSVPs: <strong className="text-zinc-100">{status.rsvpCount}</strong> /{' '}
                    {status.maxListSize}
                  </span>
                  <span>
                    Checked in: <strong className="text-zinc-100">{status.checkedInCount}</strong>
                  </span>
                  <span>
                    Entry fee: <strong className="text-zinc-100">{status.entryFee}</strong> Stars
                  </span>
                </div>
              </div>
            </div>
          ) : contractAddress ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-6 text-sm text-muted">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-brand border-r-transparent" />
              Loading party state\u2026
            </div>
          ) : null}

          {/* Organizer panel */}
          {role === 'organizer' && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-100">
                {contractAddress ? 'Manage Party' : 'Deploy Party'}
              </h2>

              {!contractAddress ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
                      Max guests
                      <input
                        type="number"
                        min={1}
                        value={partySize}
                        onChange={(e) => setPartySize(e.target.value)}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-zinc-100 shadow-sm transition focus:border-brand focus:ring-2 focus:ring-brand/40"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-300">
                      Entry fee (Stars)
                      <input
                        type="number"
                        min={1}
                        value={entryFee}
                        onChange={(e) => setEntryFee(e.target.value)}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-zinc-100 shadow-sm transition focus:border-brand focus:ring-2 focus:ring-brand/40"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={onDeploy}
                    disabled={busy}
                    className="w-full cursor-pointer rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? 'Deploying\u2026' : 'Deploy Party Contract'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {organizerSecret ? (
                    <div className="rounded-lg bg-green-900/30 px-4 py-2 text-sm text-green-300 ring-1 ring-inset ring-green-600/40">
                      Organizer secret stored in this browser.
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-900/30 px-4 py-2 text-sm text-amber-300 ring-1 ring-inset ring-amber-600/40">
                      Organizer secret missing \u2014 deploy from this browser or you cannot
                      manage the party.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={onStartParty}
                      disabled={busy || !canStart || !organizerSecret}
                      className="cursor-pointer rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? 'Working\u2026' : 'Start Party'}
                    </button>
                    <button
                      type="button"
                      onClick={onCloseEntry}
                      disabled={busy || !canClose}
                      className="cursor-pointer rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-zinc-300 shadow-sm transition hover:bg-[#1e1e38] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? 'Working\u2026' : 'Close Doors'}
                    </button>
                    <button
                      type="button"
                      onClick={onClaimFees}
                      disabled={busy || !canClaim}
                      className="cursor-pointer rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? 'Working\u2026' : 'Claim Fees'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendee panel */}
          {role === 'attendee' && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-100">Attendee</h2>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onRsvp}
                  disabled={busy || !contractAddress || !canRsvp}
                  className="w-full cursor-pointer rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Working\u2026' : 'RSVP (private)'}
                </button>
                {attendeeSecret ? (
                  <div className="rounded-lg bg-green-900/30 px-4 py-2 text-sm text-green-300 ring-1 ring-inset ring-green-600/40">
                    Attendee secret stored \u2014 use the same browser to check in.
                  </div>
                ) : (
                  <div className="rounded-lg bg-blue-900/30 px-4 py-2 text-sm text-blue-300 ring-1 ring-inset ring-blue-600/40">
                    RSVP generates a secret in this browser; keep it for check-in.
                  </div>
                )}
                <button
                  type="button"
                  onClick={onCheckIn}
                  disabled={busy || !contractAddress || !canCheckIn}
                  className="w-full cursor-pointer rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Working\u2026' : 'Check In (pays entry fee \u2192 public)'}
                </button>
              </div>
            </div>
          )}

          {/* Refresh */}
          {contractAddress && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={busy}
                className="cursor-pointer rounded-lg border border-border bg-card px-5 py-2 text-sm font-medium text-muted shadow-sm transition hover:bg-[#1e1e38] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Refreshing\u2026' : '\u21bb Refresh State'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Status messages */}
      {message && (
        <div className="mt-6 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-300 ring-1 ring-inset ring-green-600/40">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-300 ring-1 ring-inset ring-red-600/40" role="alert">
          {error}
        </div>
      )}
    </main>
  );
}
