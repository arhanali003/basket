'use client';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { PhotoPicker } from './photo-picker';
import { signInOwner, finishOwnerSignIn, adminSignInError } from './sign-in';
import { api, request } from '@daybasket/api-client';
import {
  type Product,
  type HomepageImages,
  type Category,
  type User,
  type Order,
  money,
  statuses,
} from '@daybasket/types';
import { Empty, ErrorNotice, Loading, Logo, Modal, mediaUrl } from '@daybasket/ui';
type Analytics = {
  orders: number;
  revenue: number;
  aov: number;
  active: number;
  cancelled: number;
  customers: number;
  lowStock: number;
  salesByDay: { day: string; total: number }[];
};
type Audit = { id: string; actorId: string; action: string; entityId: string; createdAt: string };
export default function Admin() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('overview'),
    [products, setProducts] = useState<Product[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [analytics, setAnalytics] = useState<Analytics | null>(null),
    [audit, setAudit] = useState<Audit[]>([]),
    [filter, setFilter] = useState(''),
    [statusFilter, setStatusFilter] = useState('all'),
    [editing, setEditing] = useState<Partial<Product> | null>(null),
    [selected, setSelected] = useState<Order | null>(null),
    [drivers, setDrivers] = useState<{ id: string; name: string }[]>([]),
    [driver, setDriver] = useState(''),
    [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [homepage, setHomepage] = useState<HomepageImages>({});
  const [deleting, setDeleting] = useState<Product | null>(null);
  useEffect(() => {
    if (user && tab === 'homepage')
      request<HomepageImages>('/homepage')
        .then(setHomepage)
        .catch((e) => setError(e.message));
  }, [user, tab]);
  async function refresh() {
    setError('');
    try {
      const [p, c, o, a, log, d] = await Promise.all([
        request<Product[]>('/admin/products'),
        api.catalogue(),
        api.orders(),
        request<Analytics>('/admin/analytics'),
        request<Audit[]>('/admin/audit'),
        request<{ id: string; name: string }[]>('/admin/drivers'),
      ]);
      setProducts(p);
      setCategories(c.categories);
      setOrders(o);
      setAnalytics(a);
      setAudit(log);
      setDrivers(d);
      setDriver(d[0]?.id || '');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    const restoreSession = async () => {
      const redirected = process.env.NODE_ENV === 'production' ? await finishOwnerSignIn() : null;
      return redirected ?? (await api.me().catch(() => null));
    };
    restoreSession()
      .then((u) => {
        if (u && ['super_admin', 'staff'].includes(u.role)) {
          setUser(u);
          void refresh();
        }
      })
      .catch((error) => setError(adminSignInError(error)))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [user]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u =
        process.env.NODE_ENV === 'production'
          ? await signInOwner()
          : await request<User>('/auth/staff', 'POST', { role: 'super_admin', password });
      if (!['super_admin', 'staff'].includes(u.role)) {
        await request('/auth/logout', 'POST', {});
        throw new Error('This account does not have store access.');
      }
      setUser(u);
      await refresh();
    } catch (e) {
      setError(adminSignInError(e));
    } finally {
      setBusy(false);
    }
  }
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      await request(path, method, body);
      await refresh();
      if (selected) setSelected(await api.order(selected.id));
      setNotice('Changes saved');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function saveProduct(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: f.get('name'),
      slug: f.get('slug'),
      categoryId: f.get('categoryId'),
      brand: f.get('brand'),
      description: f.get('description'),
      image: editing?.images?.[0] || editing?.image || '',
      images: editing?.images || (editing?.image ? [editing.image] : []),
      unit: f.get('unit'),
      price: Math.round(Number(f.get('price')) * 100),
      mrp: Math.round(Number(f.get('mrp')) * 100),
      taxBps: Math.round(Number(f.get('tax')) * 100),
      maxQuantity: Number(f.get('maxQuantity')),
      active: f.get('active') === 'on',
    };
    if (
      await mutate(
        '/admin/products' + (editing?.id ? '/' + editing.id : ''),
        editing?.id ? 'PUT' : 'POST',
        body,
      )
    )
      setEditing(null);
  }
  function exportOrders() {
    const escape = (s: unknown) =>
      '"' +
      String(s)
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""') +
      '"';
    const csv = [
      ['Order', 'Created', 'Status', 'Total (paise)', 'Payment'],
      ...orders.map((o) => [o.id, o.createdAt, o.status, o.total, o.paymentStatus]),
    ]
      .map((row) => row.map(escape).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daybasket-orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  const filteredOrders = orders.filter(
    (o) =>
      (statusFilter === 'all' || o.status === statusFilter) &&
      (o.id.includes(filter) ||
        o.items.some((i) => i.name.toLowerCase().includes(filter.toLowerCase()))),
  );
  function orderTable(limit?: number) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Basket</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredOrders.slice(0, limit || 100).map((o) => (
              <tr key={o.id}>
                <td>
                  <b>#{o.id.slice(0, 8).toUpperCase()}</b>
                  <small>
                    {new Date(o.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </small>
                </td>
                <td>
                  {o.items.reduce((s, i) => s + i.quantity, 0)} items
                  <small>{o.items[0]?.name}</small>
                </td>
                <td>
                  <b>{money(o.total)}</b>
                </td>
                <td>{o.paymentMethod === 'mock' ? 'Test payment' : 'Cash on delivery'}</td>
                <td>
                  <span className={`status ${o.status}`}>{o.status.replaceAll('_', ' ')}</span>
                </td>
                <td>
                  <button
                    className="text-link"
                    onClick={() => {
                      setError('');
                      setSelected(o);
                    }}
                  >
                    Manage <ArrowRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredOrders.length && (
          <Empty
            title="Room for your first order"
            detail="Customer orders will arrive here, ready to be picked and packed."
          />
        )}
      </div>
    );
  }
  if (!ready) return <Loading />;
  if (!user)
    return (
      <div className="login-page">
        <div className="login-brand">
          <Logo dark />
          <div>
            <h1>
              A good day
              <br />
              starts <em>in store.</em>
            </h1>
            <p>
              A thoughtful little space to keep your neighbourhood stocked, happy, and coming back
              for more.
            </p>
          </div>
          <small>DAYBASKET · STORE STUDIO</small>
        </div>
        <div className="login-form-wrap">
          <form className="login-form" onSubmit={login}>
            <span className="eyebrow">WELCOME BACK</span>
            <h2 style={{ marginTop: 15 }}>Your store, at a glance.</h2>
            <p>
              Sign in to manage your products, orders and deliveries. Google sign-in opens in this
              tab.
            </p>
            {process.env.NODE_ENV !== 'production' && (
              <>
                <div className="demo-note">
                  Local demo · owner password: <b>daybasket-local-only</b>
                  <br />
                  Production requires a provisioned Firebase staff account.
                </div>
                <label className="field">
                  Store password
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </label>
              </>
            )}
            {error && <ErrorNotice message={error} />}
            <button className="primary full" disabled={busy}>
              {busy
                ? 'Signing in…'
                : process.env.NODE_ENV === 'production'
                  ? 'Continue with Google'
                  : 'Open store studio'}{' '}
              <ArrowRight size={15} />
            </button>
            <p style={{ marginTop: 24, fontSize: 10 }}>
              Owners and approved employees only. Use the Google email your owner has approved.
            </p>
          </form>
        </div>
      </div>
    );
  return (
    <div className="studio">
      <aside className="sidebar">
        <Logo dark />
        <div className="studio-label">STORE STUDIO</div>
        <div className="side-section">Your workspace</div>
        <nav className="side-nav">
          {[
            ['overview', LayoutDashboard, 'Overview'],
            ['orders', ShoppingBag, 'Orders'],
            ['products', Package, 'Products'],
            ['homepage', Leaf, 'Homepage photos'],
            ['delivery', Truck, 'Deliveries'],
            ['audit', ShieldCheck, 'Audit log'],
          ].map(([id, Icon, label]) => {
            const I = Icon as typeof Package;
            return (
              <button
                key={String(id)}
                className={tab === id ? 'active' : ''}
                onClick={() => {
                  setTab(String(id));
                  setFilter('');
                  setStatusFilter('all');
                }}
              >
                <I />
                {String(label)}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="flex">
            <Leaf size={21} />
            <b>A little local. A lot of good.</b>
          </div>
          <p>
            Indiranagar, Bengaluru
            <br />
            {process.env.NODE_ENV === 'production' ? 'Store management' : 'Development store'}
          </p>
          <button
            className="flex"
            style={{ marginTop: 20 }}
            onClick={async () => {
              await request('/auth/logout', 'POST', {});
              setUser(null);
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="studio-main">
        <header className="studio-header">
          <span className="flex">
            <Store size={16} /> Indiranagar store <span className="muted"> / {tab}</span>
          </span>
          <span className="store-badge">
            <span>●</span>{' '}
            {process.env.NODE_ENV === 'production' ? 'Store management' : 'Local development'}{' '}
            <span style={{ marginLeft: 12 }}>Owner</span>
          </span>
        </header>
        <div className="studio-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow muted">LET’S MAKE IT A GOOD DAY</span>
              <h1 style={{ marginTop: 9 }}>
                {tab === 'homepage'
                  ? 'Your homepage photos'
                  : tab === 'overview'
                    ? 'Hello, store owner.'
                    : tab === 'orders'
                      ? 'Every basket has a story.'
                      : tab === 'products'
                        ? 'Good things on your shelves.'
                        : tab === 'delivery'
                          ? 'From your store to their door.'
                          : 'A clear record of every change.'}
              </h1>
              <p>
                {tab === 'overview'
                  ? 'A fresh look at what’s happening in your neighbourhood.'
                  : tab === 'products'
                    ? 'Curate your catalogue, adjust stock, and keep things fresh.'
                    : 'Keep your store running with a little extra care.'}
              </p>
            </div>
            <div className="flex">
              <button className="icon-button" aria-label="Refresh dashboard" onClick={refresh}>
                <RefreshCw size={16} />
              </button>
              <span className="date-badge">
                <CalendarDays size={13} />
                {new Date().toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          {error && <ErrorNotice message={error} onRetry={refresh} />}{' '}
          {notice && (
            <div className="cart-note" role="status" style={{ marginBottom: 15, fontSize: 12 }}>
              {notice}
            </div>
          )}
          {tab === 'overview' && analytics && (
            <>
              <div className="stats">
                {[
                  [
                    'Net delivered sales',
                    money(analytics.revenue),
                    Wallet,
                    'Collected across delivered orders',
                  ],
                  [
                    'Total orders',
                    analytics.orders,
                    ShoppingBag,
                    `${analytics.active} baskets in progress`,
                  ],
                  [
                    'Average delivered basket',
                    money(analytics.aov),
                    ChartNoAxesCombined,
                    'Based on delivered orders',
                  ],
                  ['Your neighbours', analytics.customers, Users, 'Registered customer accounts'],
                ].map(([label, value, Icon, detail]) => {
                  const I = Icon as typeof Wallet;
                  return (
                    <div className="stat" key={String(label)}>
                      <div className="stat-label">
                        {String(label)}
                        <I className="stat-icon" size={17} />
                      </div>
                      <div className="stat-value">{String(value)}</div>
                      <small>{String(detail)}</small>
                    </div>
                  );
                })}
              </div>
              <div className="studio-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>A week of everyday good</h2>
                    <span className="tag">Delivered sales</span>
                  </div>
                  <div className="chart">
                    {analytics.salesByDay.every((d) => !d.total) && (
                      <p className="chart-empty">
                        Your sales story begins with your first delivered order.
                      </p>
                    )}
                    {analytics.salesByDay.map((d) => (
                      <div className="bar-column" key={d.day}>
                        <div
                          title={money(d.total)}
                          className="bar"
                          style={{
                            height: Math.max(
                              3,
                              (d.total / Math.max(1, ...analytics.salesByDay.map((d) => d.total))) *
                                115,
                            ),
                          }}
                        />
                        <small>
                          {new Date(d.day).toLocaleDateString('en-IN', { weekday: 'short' })}
                        </small>
                      </div>
                    ))}
                  </div>
                  <div className="chart-caption">Actual order data · Last 7 days · INR</div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>A little attention here</h2>
                    <ClipboardList size={17} className="muted" />
                  </div>
                  <div className="ops-list">
                    <div>
                      <span>Baskets in progress</span>
                      <b>{analytics.active}</b>
                    </div>
                    <div>
                      <span>Products running low</span>
                      <b className="stock-low">{analytics.lowStock}</b>
                    </div>
                    <div>
                      <span>Cancelled orders</span>
                      <b>{analytics.cancelled}</b>
                    </div>
                    <div>
                      <span>Delivery partners</span>
                      <b>{drivers.length}</b>
                    </div>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>The latest baskets</h2>
                  <button className="text-link" onClick={() => setTab('orders')}>
                    View all orders <ArrowRight size={13} />
                  </button>
                </div>
                {orderTable(6)}
              </section>
            </>
          )}
          {tab === 'products' && (
            <>
              <div className="admin-toolbar">
                <input
                  placeholder="Find something on your shelves…"
                  aria-label="Search products"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <button
                  className="primary"
                  style={{ marginLeft: 'auto', fontSize: 11 }}
                  onClick={() => {
                    setError('');
                    setEditing({
                      active: true,
                      taxBps: 0,
                      maxQuantity: 10,
                      categoryId: categories[0]?.id,
                    });
                  }}
                >
                  <Plus size={14} /> Add product
                </button>
              </div>
              <section className="panel">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Price / MRP</th>
                        <th>Available</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {products
                        .filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
                        .map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="table-product">
                                <img src={mediaUrl(p.image)} alt="" />
                                <div>
                                  <b>{p.name}</b>
                                  <small>
                                    {p.brand} · {p.unit}
                                  </small>
                                </div>
                              </div>
                            </td>
                            <td>{categories.find((c) => c.id === p.categoryId)?.name}</td>
                            <td>
                              <b>{money(p.price)}</b>
                              <small>{money(p.mrp)}</small>
                            </td>
                            <td
                              className={(p.inventory[0]?.available || 0) <= 5 ? 'stock-low' : ''}
                            >
                              {p.inventory[0]?.available || 0} units
                            </td>
                            <td>
                              <span className="status">{p.active ? 'Active' : 'Archived'}</span>
                            </td>
                            <td>
                              <button
                                className="text-link"
                                onClick={() => {
                                  setError('');
                                  setEditing({
                                    ...p,
                                    images: p.images?.length ? p.images : [p.image],
                                  });
                                }}
                              >
                                Edit <ArrowRight size={12} />
                              </button>
                              <button
                                className="text-link"
                                style={{ marginLeft: 14 }}
                                disabled={busy}
                                onClick={() =>
                                  void mutate('/admin/products/' + p.id, 'PUT', {
                                    ...p,
                                    active: !p.active,
                                    images: p.images?.length ? p.images : [p.image],
                                  })
                                }
                              >
                                {p.active ? 'Archive' : 'Restore'}
                              </button>
                              <button
                                className="text-link"
                                style={{ marginLeft: 14, color: '#a52a2a' }}
                                disabled={busy}
                                onClick={() => setDeleting(p)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {tab === 'homepage' && (
            <section className="panel" style={{ padding: 24 }}>
              <h2>Make the homepage yours</h2>
              <p>
                Upload a photo for each area, then save. Remove a custom photo to restore the
                original.
              </p>
              {(
                [
                  ['hero', 'Main banner'],
                  ['breakfast', 'Breakfast banner'],
                  ['dairy', 'Bakery collection'],
                  ['snacks', 'Snacks collection'],
                  ['pantry', 'Pantry collection'],
                ] as const
              ).map(([key, label]) => (
                <PhotoPicker
                  key={key}
                  label={label}
                  max={1}
                  value={homepage[key] ? [homepage[key]!] : []}
                  disabled={busy || uploading}
                  onBusy={setUploading}
                  onChange={(photos) =>
                    setHomepage((current) => ({ ...current, [key]: photos[0] }))
                  }
                />
              ))}
              <button
                className="primary"
                disabled={busy || uploading}
                onClick={() => mutate('/admin/homepage', 'PUT', homepage)}
              >
                Save homepage photos
              </button>
            </section>
          )}
          {(tab === 'orders' || tab === 'delivery') && (
            <>
              <div className="admin-toolbar">
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search order or product…"
                  aria-label="Search orders"
                />
                <select
                  aria-label="Filter status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {[...statuses, 'cancelled'].map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  style={{ marginLeft: 'auto', fontSize: 11 }}
                  onClick={exportOrders}
                >
                  <ArrowDownToLine size={13} /> Export CSV
                </button>
              </div>
              {tab === 'delivery' && (
                <div className="demo-note">
                  Assign a partner once an order is ready for pickup. Location updates appear in the
                  order after the partner shares GPS; no locations are simulated.
                </div>
              )}
              <section className="panel">{orderTable()}</section>
            </>
          )}
          {tab === 'audit' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Staff activity</h2>
                <span className="muted">Latest 100 events</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.createdAt).toLocaleString('en-IN')}</td>
                        <td>{a.actorId}</td>
                        <td>{a.action.replaceAll('_', ' ')}</td>
                        <td>{a.entityId.slice(0, 16)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!audit.length && (
                  <Empty title="A clean start" detail="Privileged changes will be recorded here." />
                )}
              </div>
            </section>
          )}
        </div>
      </main>
      <Modal
        open={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        title="Delete product?"
      >
        <p>
          Remove {deleting?.name} from your listings and customer baskets? Past order records will
          be kept.
        </p>
        {error && <ErrorNotice message={error} />}
        <div className="flex">
          <button className="secondary" disabled={busy} onClick={() => setDeleting(null)}>
            Keep product
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              if (deleting && (await mutate('/admin/products/' + deleting.id, 'DELETE', {})))
                setDeleting(null);
            }}
          >
            Delete product
          </button>
        </div>
      </Modal>
      <Modal
        open={!!editing}
        onClose={() => {
          if (!busy && !uploading) setEditing(null);
        }}
        title={editing?.id ? 'Keep the good things fresh' : 'Add a little everyday good'}
        wide
      >
        {editing && (
          <>
            <form onSubmit={saveProduct}>
              <div className="form-grid">
                <label className="field">
                  Product name
                  <input name="name" defaultValue={editing.name} required />
                </label>
                <label className="field">
                  URL slug
                  <input
                    name="slug"
                    defaultValue={editing.slug}
                    placeholder="farm-fresh-apples"
                    pattern="[a-z0-9-]+"
                    required
                  />
                </label>
                <label className="field">
                  Brand
                  <input name="brand" defaultValue={editing.brand} required />
                </label>
                <label className="field">
                  Category
                  <select name="categoryId" defaultValue={editing.categoryId}>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Selling price (₹)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="price"
                    defaultValue={(editing.price || 0) / 100}
                    required
                  />
                </label>
                <label className="field">
                  MRP (₹)
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="mrp"
                    defaultValue={(editing.mrp || 0) / 100}
                    required
                  />
                </label>
                <label className="field">
                  Pack size
                  <input name="unit" defaultValue={editing.unit} placeholder="500 g" required />
                </label>
                <label className="field">
                  GST (%) included in price
                  <input
                    name="tax"
                    type="number"
                    step="0.01"
                    min="0"
                    max="28"
                    defaultValue={(editing.taxBps || 0) / 100}
                  />
                </label>
                <label className="field">
                  Maximum purchase quantity
                  <input
                    name="maxQuantity"
                    type="number"
                    min="1"
                    max="20"
                    defaultValue={editing.maxQuantity || 10}
                  />
                </label>
              </div>
              <PhotoPicker
                label="Product photos"
                max={8}
                value={editing.images || (editing.image ? [editing.image] : [])}
                disabled={busy}
                onBusy={setUploading}
                onChange={(images) =>
                  setEditing((current) =>
                    current ? { ...current, images, image: images[0] || '' } : null,
                  )
                }
              />
              <label className="field">
                Description
                <textarea name="description" defaultValue={editing.description} required />
              </label>
              <label className="flex" style={{ margin: '16px 0' }}>
                <input
                  style={{ width: 'auto' }}
                  type="checkbox"
                  name="active"
                  defaultChecked={editing.active}
                />{' '}
                Active in storefront
              </label>
              {error && <ErrorNotice message={error} />}
              <button className="primary" disabled={busy || uploading || !editing.image}>
                Save product <CheckIcon />
              </button>
            </form>
            {editing.id && (
              <form
                className="inventory-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  if (
                    await mutate('/admin/inventory/' + editing.id, 'POST', {
                      change: Number(f.get('change')),
                      reason: f.get('reason'),
                    })
                  )
                    form.reset();
                }}
              >
                <h3>Adjust available inventory</h3>
                <small>
                  Positive values add stock; negative values remove stock. Every adjustment is
                  audited.
                </small>
                <div className="form-grid">
                  <label className="field">
                    Quantity change
                    <input name="change" type="number" required placeholder="e.g. 20" />
                  </label>
                  <label className="field">
                    Reason
                    <input name="reason" required minLength={3} placeholder="Supplier delivery" />
                  </label>
                </div>
                <button className="secondary" disabled={busy}>
                  Record adjustment
                </button>
              </form>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Order #${selected?.id.slice(0, 8).toUpperCase()}`}
        wide
      >
        {selected && (
          <div className="admin-order-detail">
            <div className="flex between">
              <span className={`status ${selected.status}`}>
                {selected.status.replaceAll('_', ' ')}
              </span>
              <b>{money(selected.total)}</b>
            </div>
            <p className="muted" style={{ lineHeight: 1.8, fontSize: 12 }}>
              {(() => {
                const a = JSON.parse(selected.addressJson);
                return `${a.recipient} · ${a.phone} · ${a.line}, ${a.city} ${a.pincode}`;
              })()}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((i) => (
                    <tr key={i.productId}>
                      <td>{i.name}</td>
                      <td>{i.quantity}</td>
                      <td>{money(i.price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-actions">
              {['placed', 'accepted', 'picking', 'packed'].includes(selected.status) && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    mutate(`/orders/${selected.id}/status`, 'PATCH', {
                      status:
                        statuses[
                          statuses.indexOf(selected.status as (typeof statuses)[number]) + 1
                        ],
                    })
                  }
                >
                  Mark{' '}
                  {statuses[
                    statuses.indexOf(selected.status as (typeof statuses)[number]) + 1
                  ]?.replaceAll('_', ' ')}{' '}
                  <ArrowRight size={14} />
                </button>
              )}
              {selected.status === 'ready_for_pickup' && (
                <>
                  <select
                    aria-label="Delivery partner"
                    style={{ width: 200 }}
                    value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                  >
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="primary"
                    disabled={busy || !driver}
                    onClick={() =>
                      mutate(`/admin/orders/${selected.id}/assign`, 'POST', { driverId: driver })
                    }
                  >
                    Assign partner
                  </button>
                </>
              )}
              {['placed', 'accepted'].includes(selected.status) && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => mutate(`/orders/${selected.id}/cancel`, 'POST', {})}
                >
                  Cancel & restore stock
                </button>
              )}
            </div>
            {selected.driverId && (
              <p className="muted">
                Assigned to{' '}
                {drivers.find((d) => d.id === selected.driverId)?.name || selected.driverId}
              </p>
            )}
            {selected.locations[0] && (
              <div className="map-fallback">
                <b>Last driver location</b>
                <p>
                  {selected.locations[0].latitude.toFixed(5)},{' '}
                  {selected.locations[0].longitude.toFixed(5)}
                </p>
                <small>{new Date(selected.locations[0].createdAt).toLocaleString('en-IN')}</small>
              </div>
            )}
            <div className="timeline">
              {selected.history.map((h, i) => (
                <div key={i}>
                  <b>{h.status.replaceAll('_', ' ')}</b>
                  <small>{new Date(h.createdAt).toLocaleString('en-IN')}</small>
                </div>
              ))}
            </div>
            {error && <ErrorNotice message={error} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
function CheckIcon() {
  return <ArrowRight size={14} />;
}
