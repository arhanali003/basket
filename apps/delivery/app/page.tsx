'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Truck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api, request } from '@daybasket/api-client';
import { type Order, type User, type AddressInput, money } from '@daybasket/types';
import { Empty, ErrorNotice, Loading, Logo, Modal } from '@daybasket/ui';
export default function Delivery() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [orders, setOrders] = useState<Order[]>([]),
    [online, setOnline] = useState(true),
    [sharing, setSharing] = useState<string | null>(null),
    [lastGps, setLastGps] = useState(''),
    [proof, setProof] = useState<Order | null>(null),
    [code, setCode] = useState('');
  const watch = useRef<number | null>(null),
    lastSend = useRef(0);
  async function refresh() {
    try {
      setOrders(await api.orders());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function stopGps() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(null);
  }
  useEffect(() => {
    api
      .me()
      .then((u) => {
        if (u.role === 'delivery') {
          setUser(u);
          void refresh();
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
    setOnline(navigator.onLine);
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [user]);
  useEffect(() => {
    if (
      sharing &&
      !orders.some((o) => o.id === sharing && ['out_for_delivery', 'arriving'].includes(o.status))
    )
      stopGps();
  }, [orders, sharing]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setUser(await request<User>('/auth/staff', 'POST', { role: 'delivery', password }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(order: Order, status: string, deliveryCode?: string) {
    setBusy(true);
    setError('');
    try {
      await request(`/orders/${order.id}/status`, 'PATCH', { status, code: deliveryCode });
      await refresh();
      if (status === 'delivered') {
        stopGps();
        setProof(null);
        setCode('');
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function startGps(id: string) {
    setError('');
    if (!navigator.geolocation) {
      setError('GPS is unavailable on this device.');
      return;
    }
    stopGps();
    lastSend.current = 0;
    setSharing(id);
    watch.current = navigator.geolocation.watchPosition(
      async (p) => {
        if (Date.now() - lastSend.current < 5000) return;
        lastSend.current = Date.now();
        try {
          await request(`/delivery/${id}/location`, 'POST', {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
          });
          setLastGps(new Date().toLocaleTimeString('en-IN'));
          setError('');
        } catch (e) {
          setError(
            `Location not sent: ${(e as Error).message}. It will retry on the next GPS update.`,
          );
        }
      },
      (e) => {
        setError(
          e.code === 1
            ? 'Location permission denied. Allow GPS in browser settings to share your position.'
            : 'GPS is temporarily unavailable.',
        );
        if (e.code === 1) stopGps();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  }
  const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
  if (!ready) return <Loading />;
  return (
    <div className="partner-app">
      <header className="partner-header">
        <Logo />
        <span className="flex muted" style={{ fontSize: 10 }}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />} {online ? 'Connected' : 'Offline'}
        </span>
      </header>
      {!user ? (
        <form className="partner-login" onSubmit={login}>
          <span className="eyebrow">DELIVERY PARTNER</span>
          <h1>
            A little care.
            <br />
            Every doorstep.
          </h1>
          <p>
            Sign in to see your assigned deliveries and bring a little everyday good to the
            neighbourhood.
          </p>
          <div className="demo-note">
            Local partner demo · Password: <b>daybasket-local-only</b>
          </div>
          <label className="field">
            Partner password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <ErrorNotice message={error} />}
          <button className="primary full" disabled={busy}>
            Let’s get going <ArrowRight size={15} />
          </button>
        </form>
      ) : (
        <main className="partner-main">
          <div className="partner-welcome">
            <div>
              <span className="eyebrow muted">YOUR NEIGHBOURHOOD ROUTE</span>
              <h1>Hello, {user.name.split(' ')[0]}.</h1>
              <p>Good things are on their way.</p>
            </div>
            <div className="partner-avatar">
              <Truck size={24} />
            </div>
          </div>
          <div className="partner-summary">
            <div>
              <small>Ready for your care</small>
              <b>{active.length}</b>
            </div>
            <div>
              <small>Delivered so far</small>
              <b>{orders.filter((o) => o.status === 'delivered').length}</b>
            </div>
          </div>
          {error && <ErrorNotice message={error} />}
          <div className="partner-section-heading">
            <h2>Your deliveries</h2>
            <button className="icon-button" aria-label="Refresh deliveries" onClick={refresh}>
              <RefreshCw size={16} />
            </button>
          </div>
          {!active.length && (
            <Empty
              title="A little breather."
              detail="Your next delivery will appear here when the store assigns it to you."
            />
          )}
          {active.map((o) => {
            const a = JSON.parse(o.addressJson) as AddressInput;
            return (
              <article className="delivery-card" key={o.id}>
                <div className="flex between">
                  <h3>#{o.id.slice(0, 8).toUpperCase()}</h3>
                  <span className="status">{o.status.replaceAll('_', ' ')}</span>
                </div>
                <div className="delivery-route">
                  <div className="route-stop">
                    <small>Pick up from</small>
                    <b>Daybasket · Indiranagar</b>
                    <p>
                      {o.items.reduce((s, i) => s + i.quantity, 0)} items · Verify the packing list
                      at the store
                    </p>
                  </div>
                  <div className="route-stop">
                    <small>Deliver a little good to</small>
                    <b>{a.recipient}</b>
                    <p>
                      {a.line}, {a.city} {a.pincode}
                    </p>
                    {a.instructions && <p>Note: {a.instructions}</p>}
                  </div>
                </div>
                <div className="payment-due">
                  <span>
                    {o.paymentMethod === 'cod'
                      ? 'Collect on delivery'
                      : 'Test payment · no collection'}
                  </span>
                  <b>{o.paymentMethod === 'cod' ? money(o.total) : '₹0'}</b>
                </div>
                <div className="flex" style={{ marginBottom: 16 }}>
                  <a
                    className="secondary"
                    style={{ flex: 1, fontSize: 11 }}
                    href={`https://www.google.com/maps/dir/?api=1&destination=${a.latitude},${a.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation size={13} /> Navigate
                  </a>
                  <a className="secondary" style={{ fontSize: 11 }} href={`tel:+91${a.phone}`}>
                    <Phone size={13} /> Call
                  </a>
                </div>
                {o.status === 'assigned' ? (
                  <button
                    className="primary full"
                    disabled={busy || !online}
                    onClick={() => update(o, 'out_for_delivery')}
                  >
                    Confirm pickup & start delivery <ArrowRight size={15} />
                  </button>
                ) : (
                  <>
                    <div className="gps-status">
                      <MapPin size={13} style={{ display: 'inline' }} />{' '}
                      {sharing === o.id
                        ? `Sharing while this page is open. ${lastGps ? 'Last sent ' + lastGps : 'Waiting for GPS…'}`
                        : 'Your GPS is not being shared.'}
                      <br />
                      <button
                        className="text-link"
                        onClick={() => (sharing === o.id ? stopGps() : startGps(o.id))}
                      >
                        {sharing === o.id
                          ? 'Stop location sharing'
                          : 'Consent & share my live location'}
                      </button>
                    </div>
                    {o.status === 'out_for_delivery' && (
                      <button
                        className="secondary full"
                        style={{ marginBottom: 10 }}
                        disabled={busy || !online}
                        onClick={() => update(o, 'arriving')}
                      >
                        I’m arriving
                      </button>
                    )}
                    <button
                      className="primary full"
                      disabled={busy || !online}
                      onClick={() => {
                        setProof(o);
                        setError('');
                      }}
                    >
                      Confirm delivery <Check size={15} />
                    </button>
                  </>
                )}
              </article>
            );
          })}
          <p className="partner-footnote">
            Location is shared only with this order’s customer and store staff. Mobile browsers may
            pause GPS when this page is hidden or closed. Keep the app open while delivering.
          </p>
          <button
            className="text-link"
            onClick={async () => {
              stopGps();
              await request('/auth/logout', 'POST', {});
              setUser(null);
            }}
          >
            <LogOut size={14} /> End session
          </button>
        </main>
      )}
      <Modal open={!!proof} onClose={() => setProof(null)} title="One last little check.">
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.8 }}>
          Ask the customer for their four-digit delivery code.{' '}
          {proof?.paymentMethod === 'cod' && `Collect ${money(proof.total)} before confirming.`}
        </p>
        <label className="field">
          Customer’s delivery code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="4-digit code"
          />
        </label>
        {error && <ErrorNotice message={error} />}
        <button
          className="primary full"
          disabled={busy || code.length !== 4}
          onClick={() => proof && update(proof, 'delivered', code)}
        >
          Delivered with care <Check size={16} />
        </button>
      </Modal>
    </div>
  );
}
