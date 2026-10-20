"use client";

import { Bell, CheckCheck, Settings, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeNotificationHref, type NotificationType, type Preferences } from "@/lib/notification-policy.mjs";

type InboxItem = { id: string; type: NotificationType; title: string; body: string; href: string; createdAt: string; readAt: string | null };
type Inbox = { eligible: boolean; items: InboxItem[]; unreadCount: number; preferences?: Preferences };
const categories: { type: NotificationType; label: string }[] = [
  { type: "fixture_change", label: "Fixture changes" },
  { type: "match_reminder", label: "Match reminders" },
  { type: "lineup_reminder", label: "Lineup reminders" },
  { type: "ladder_challenge", label: "Ladder challenges and deadlines" },
  { type: "announcement", label: "Announcements from administrators" }
];

export function useNotificationCenter(authenticated: boolean) {
  const [state, setState] = useState<Inbox>({ eligible: false, items: [], unreadCount: 0 });
  const openedInboxLink = useRef(false);
  const [panel, setPanel] = useState<"inbox" | "settings" | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!authenticated) return;
    try {
      const response = await fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401 || response.status === 403) {
        setState({ eligible: false, items: [], unreadCount: 0 });
        setPanel(null);
        return;
      }
      if (!response.ok) throw new Error("Notifications could not be refreshed.");
      const payload = await response.json() as Inbox;
      setState(payload.eligible ? payload : { eligible: false, items: [], unreadCount: 0 });
      if (!payload.eligible) setPanel(null);
      if (payload.eligible && !openedInboxLink.current && new URLSearchParams(window.location.search).get("notifications") === "1") {
        openedInboxLink.current = true;
        setPanel("inbox");
      }
      setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Notifications are unavailable."); }
  }, [authenticated]);
  useEffect(() => {
    if (!authenticated) return;
    const visibleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    };
    visibleRefresh();
    const timer = window.setInterval(visibleRefresh, 60_000);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("interclub:refresh-panels", visibleRefresh);
    window.addEventListener("interclub:notification-settings-changed", visibleRefresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibleRefresh);
      window.removeEventListener("interclub:refresh-panels", visibleRefresh);
      window.removeEventListener("interclub:notification-settings-changed", visibleRefresh);
    };
  }, [authenticated, refresh]);
  return { state, setState, panel, setPanel, refresh, error, setError };
}

type Center = ReturnType<typeof useNotificationCenter>;

export function NotificationBell({ center }: { center: Center }) {
  if (!center.state.eligible) return null;
  return <button type="button" onClick={() => { center.setPanel("inbox"); void center.refresh(); }} aria-label={`Notifications${center.state.unreadCount ? `, ${center.state.unreadCount} unread` : ""}`} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><Bell className="h-5 w-5" />{center.state.unreadCount > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#00ff85] px-1 text-center text-[11px] font-black text-[#10233f]">{center.state.unreadCount > 99 ? "99+" : center.state.unreadCount}</span> : null}</button>;
}

export function NotificationCenter({ center }: { center: Center }) {
  const { state, panel, setPanel, error, setError, refresh } = center;
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Preferences | null>(null);
  const [push, setPush] = useState<{ ready: boolean; publicKey: string | null; subscribed: boolean } | null>(null);
  const [pushMessage, setPushMessage] = useState("");
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isOpen = state.eligible && panel !== null;
  useEffect(() => {
    if (!isOpen) return;
    // Native modal dialogs do not lock page scrolling, particularly on iOS.
    const { scrollX, scrollY } = window;
    const body = document.body;
    const root = document.documentElement;
    const previous = { position: body.style.position, top: body.style.top, left: body.style.left, width: body.style.width, overflow: body.style.overflow };
    const rootOverflow = root.style.overflow;
    const scrollBehavior = root.style.scrollBehavior;
    root.style.overflow = "hidden";
    Object.assign(body.style, { position: "fixed", top: `-${scrollY}px`, left: `-${scrollX}px`, width: "100%", overflow: "hidden" });
    return () => {
      Object.assign(body.style, previous);
      root.style.overflow = rootOverflow;
      root.style.scrollBehavior = "auto";
      window.scrollTo(scrollX, scrollY);
      root.style.scrollBehavior = scrollBehavior;
    };
  }, [isOpen]);
  useEffect(() => {
    if (state.eligible && panel) dialog.current?.showModal();
    else dialog.current?.close();
  }, [state.eligible, panel]);
  useEffect(() => {
    if (panel !== "settings" || !state.eligible) return;
    setDraft(state.preferences ?? null);
    setPush(null);
    setPushMessage("");
    let current = true;
    void (async () => {
      const registration = supported ? await navigator.serviceWorker.getRegistration("/") : null;
      const subscription = await registration?.pushManager.getSubscription();
      const path = subscription ? `/api/notifications/push?endpoint=${encodeURIComponent(subscription.endpoint)}` : "/api/notifications/push";
      const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Phone push status could not be loaded.");
      const payload = await response.json();
      if (current) setPush({ ...payload, subscribed: Boolean(subscription && payload.subscribed) });
    })().catch((failure) => { if (current) setPushMessage(failure.message); });
    return () => { current = false; };
  }, [panel, state.eligible]); // Refreshes must not overwrite unsaved preference edits.

  async function markRead(id?: string) {
    const response = await fetch("/api/notifications", { method: "PATCH", keepalive: true, credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
    if (!response.ok) throw new Error("Could not mark notifications as read.");
    await refresh();
  }
  async function savePreferences() {
    if (!draft) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/notifications/preferences", { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Preferences could not be saved.");
      center.setState((previous) => ({ ...previous, preferences: payload.preferences }));
      setPushMessage("Notification preferences saved.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Preferences could not be saved."); }
    finally { setSaving(false); }
  }
  async function enableDevicePush() {
    if (!supported || !push?.ready || !push.publicKey) return;
    setSaving(true); setPushMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked in your browser settings. Allow them there to enable phone push." : "Permission was not granted. Your inbox still works.");
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const decoded = atob(push.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
      const applicationServerKey = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const response = await fetch("/api/notifications/push", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: subscription.toJSON() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "This device could not be enabled.");
      setPush({ ...push, subscribed: true });
      setPushMessage("This device is enabled. Turn on phone push for your account below and save your preferences to receive alerts.");
    } catch (failure) { setPushMessage(failure instanceof Error ? failure.message : "Phone push could not be enabled."); }
    finally { setSaving(false); }
  }
  async function disableDevicePush() {
    setSaving(true); setPushMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetch("/api/notifications/push", { method: "DELETE", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!response.ok) throw new Error("This device could not be disabled. Please retry.");
        await subscription.unsubscribe();
      }
      if (push) setPush({ ...push, subscribed: false });
      setPushMessage("Phone push is disabled on this device.");
    } catch (failure) { setPushMessage(failure instanceof Error ? failure.message : "Could not disable phone push."); }
    finally { setSaving(false); }
  }
  async function sendTestPush() {
    setSaving(true); setPushMessage("");
    try {
      const response = await fetch("/api/notifications/push/test", { method: "POST", credentials: "same-origin" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Test notification could not be queued.");
      setPushMessage("Test notification queued. Delivery can take a few minutes and respects quiet hours.");
    } catch (failure) { setPushMessage(failure instanceof Error ? failure.message : "Test notification could not be queued."); }
    finally { setSaving(false); }
  }
  function toggleType(key: "inboxTypes" | "pushTypes", type: NotificationType) {
    setDraft((previous) => previous ? { ...previous, [key]: previous[key].includes(type) ? previous[key].filter((value) => value !== type) : [...previous[key], type] } : previous);
  }
  if (!state.eligible) return null;
  return <dialog ref={dialog} aria-labelledby="notification-heading" onCancel={() => setPanel(null)} onClose={() => setPanel(null)} className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-0 text-[#10233f] shadow-2xl backdrop:bg-[#10233f]/60 open:flex">
    <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-b bg-white p-4"><h2 id="notification-heading" className="text-lg font-extrabold">{panel === "settings" ? "Notification settings" : "Notifications"}</h2><button type="button" autoFocus aria-label="Close notifications" onClick={() => setPanel(null)} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-slate-100"><X className="h-5 w-5" /></button></div>
    <div className="min-h-0 overflow-y-auto overscroll-contain space-y-4 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {panel === "inbox" ? <>
        <div className="flex flex-wrap justify-between gap-2"><Button size="sm" variant="secondary" onClick={() => setPanel("settings")}><Settings className="h-4 w-4" />Settings</Button><Button size="sm" variant="secondary" disabled={!state.unreadCount || saving} onClick={async () => { setSaving(true); try { await markRead(); } catch (failure) { setError((failure as Error).message); } finally { setSaving(false); } }}><CheckCheck className="h-4 w-4" />Mark all read</Button></div>
        {!state.items.length ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">You’re all caught up. New notifications will appear here.</p> : <ul className="space-y-2">{state.items.map((item) => <li key={item.id} className={`rounded-xl border p-3 ${item.readAt ? "border-slate-100" : "border-teal-200 bg-teal-50/60"}`}><a href={safeNotificationHref(item.href)} onClick={() => { if (!item.readAt) void markRead(item.id).catch(() => {}); }} className="block rounded focus-visible:outline focus-visible:outline-2"><p className="font-extrabold">{!item.readAt ? <span className="sr-only">Unread: </span> : null}{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.body}</p><time dateTime={item.createdAt} className="mt-2 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}</time></a>{!item.readAt ? <button type="button" className="mt-2 min-h-9 text-xs font-bold text-teal-800 underline" onClick={() => void markRead(item.id).catch((failure) => setError(failure.message))}>Mark read</button> : null}</li>)}</ul>}
      </> : draft ? <>
        <p className="text-sm text-slate-600">Choose future inbox alerts and optional phone push separately. Existing inbox items stay available.</p>
        <fieldset className="space-y-2"><legend className="mb-2 font-extrabold">Inbox</legend>{categories.map(({ type, label }) => <label key={type} className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={draft.inboxTypes.includes(type)} onChange={() => toggleType("inboxTypes", type)} className="h-4 w-4" />{label}</label>)}</fieldset>
        <fieldset className="space-y-2 border-t pt-4"><legend className="font-extrabold">Phone push</legend><label className="flex min-h-10 items-center gap-3 text-sm font-bold"><input type="checkbox" checked={draft.pushEnabled} onChange={(event) => setDraft({ ...draft, pushEnabled: event.target.checked })} className="h-4 w-4" />Allow phone push for my account</label>{categories.map(({ type, label }) => <label key={type} className="flex min-h-10 items-center gap-3 text-sm"><input type="checkbox" checked={draft.pushTypes.includes(type)} onChange={() => toggleType("pushTypes", type)} className="h-4 w-4" />{label}</label>)}</fieldset>
        <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">This device</p><p>Each device needs its own permission. On iPhone or iPad, use Safari’s Share menu → Add to Home Screen, then open the app from your Home Screen.</p>{!supported ? <p>Phone push is unavailable in this browser. Your inbox is still available.</p> : push ? !push.ready ? <><p>Phone push is not configured by the league yet. You can save your preferences now.</p>{push.subscribed ? <Button size="sm" variant="secondary" disabled={saving} onClick={() => void disableDevicePush()}>Disable on this device</Button> : null}</> : <><p>{push.subscribed ? "This device is enabled." : "This device is not enabled."}</p><Button size="sm" variant="secondary" disabled={saving} onClick={() => void (push.subscribed ? disableDevicePush() : enableDevicePush())}>{push.subscribed ? "Disable on this device" : "Enable on this device"}</Button>{push.subscribed ? <Button size="sm" variant="secondary" disabled={saving} onClick={() => void sendTestPush()}>Send test notification</Button> : null}</> : <p>Checking phone push availability…</p>}{pushMessage ? <p role="status">{pushMessage}</p> : null}</div>
        <Button disabled={saving} onClick={() => void savePreferences()}>{saving ? "Saving…" : "Save preferences"}</Button>
      </> : <p>Loading preferences…</p>}
    </div>
  </dialog>;
}

// Stop this browser receiving the previous account’s pushes on a shared device.
// Logout must remain available even when the network or browser push service fails.
export async function disconnectNotificationDevice() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const displayed = await registration?.getNotifications();
    displayed?.forEach(notification => notification.close());
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    try {
      await fetch("/api/notifications/push", { method: "DELETE", credentials: "same-origin", signal: AbortSignal.timeout(3_000), headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
    } finally {
      await subscription.unsubscribe();
    }
  } catch {
    // A failed cleanup must never prevent signing out.
  }
}
