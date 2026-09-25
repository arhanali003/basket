'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Heart,
  Home,
  Leaf,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Truck,
  UserRound,
  X,
  Grid2X2,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { signInCustomer, signInError } from './sign-in';
import { api, request } from '@daybasket/api-client';
import {
  money,
  statuses,
  type Product,
  type HomepageImages,
  type Category,
  type User,
  type CartLine,
  type Address,
  type Quote,
  type Order,
} from '@daybasket/types';
import { Logo, Modal, Footer, Empty, ErrorNotice, ProductGallery, mediaUrl } from '@daybasket/ui';
const photo = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
type Panel = 'login' | 'location' | 'cart' | 'orders' | 'product' | 'tracking' | null;
export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]),
    [categories, setCategories] = useState<Category[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null),
    [cart, setCart] = useState<CartLine[]>([]),
    [saved, setSaved] = useState<string[]>([]),
    [category, setCategory] = useState('all'),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('popular'),
    [onlySaved, setOnlySaved] = useState(false);
  const [panel, setPanel] = useState<Panel>(null),
    [selected, setSelected] = useState<Product | null>(null),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState<Address | null>(null),
    [geo, setGeo] = useState({ latitude: 12.9784, longitude: 77.6408 }),
    [geoLabel, setGeoLabel] = useState(''),
    [quote, setQuote] = useState<Quote | null>(null),
    [coupon, setCoupon] = useState(''),
    [appliedCoupon, setAppliedCoupon] = useState(''),
    [payment, setPayment] = useState<'cod' | 'mock'>('cod');
  const [orders, setOrders] = useState<Order[]>([]),
    [tracking, setTracking] = useState<(Order & { deliveryCode?: string }) | null>(null),
    [live, setLive] = useState(false);
  const [homepage, setHomepage] = useState<HomepageImages>({});
  const initialized = useRef(false),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    checkoutKey = useRef<string | null>(null),
    catalogueRef = useRef<HTMLElement>(null);
  function message(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }
  function open(next: Panel) {
    setFormError('');
    setPanel(next);
  }
  async function load() {
    setLoading(true);
    setError('');
    try {
      const d = await api.catalogue();
      setProducts(d.products);
      setCategories(d.categories);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    request<HomepageImages>('/homepage')
      .then(setHomepage)
      .catch(() => {});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    try {
      const c = JSON.parse(localStorage.getItem('daybasket-cart') || '[]') as CartLine[];
      if (Array.isArray(c))
        setCart(
          c.filter(
            (i) =>
              typeof i.productId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0,
          ),
        );
      setSaved(JSON.parse(localStorage.getItem('daybasket-wishlist') || '[]'));
    } catch {
      /* Ignore malformed local development storage. */
    }
    initialized.current = true;
    api
      .me()
      .then(async (u) => {
        setUser(u);
        const addresses = await api.addresses();
        setAddress(addresses.at(-1) || null);
        const serverCart = await request<CartLine[]>('/cart');
        if (serverCart.length) setCart(serverCart);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (initialized.current) localStorage.setItem('daybasket-cart', JSON.stringify(cart));
    checkoutKey.current = null;
  }, [cart, address, appliedCoupon, payment]);
  useEffect(() => {
    localStorage.setItem('daybasket-wishlist', JSON.stringify(saved));
  }, [saved]);
  useEffect(() => {
    if (panel !== 'cart' || !cart.length) {
      setQuote(null);
      return;
    }
    let alive = true;
    setQuote(null);
    api
      .quote(cart, appliedCoupon || undefined)
      .then((q) => {
        if (alive) {
          setQuote(q);
          setFormError('');
        }
      })
      .catch((e) => {
        if (alive) setFormError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [cart, panel, appliedCoupon]);
  useEffect(() => {
    if (panel !== 'tracking' || !tracking?.id) return;
    const id = tracking.id;
    let alive = true;
    const refresh = () =>
      api
        .order(id)
        .then((o) => {
          if (alive) setTracking(o);
        })
        .catch(() => {
          if (alive) setLive(false);
        });
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      withCredentials: true,
    });
    socket.on('connect', () => socket.emit('subscribe', id, (r: { ok: boolean }) => setLive(r.ok)));
    socket.on('disconnect', () => setLive(false));
    socket.on('order:update', refresh);
    const timer = setInterval(refresh, 10000);
    return () => {
      alive = false;
      socket.disconnect();
      clearInterval(timer);
      setLive(false);
    };
  }, [panel, tracking?.id]);
  const count = cart.reduce((s, i) => s + i.quantity, 0),
    subtotal = cart.reduce(
      (s, i) => s + (products.find((p) => p.id === i.productId)?.price || 0) * i.quantity,
      0,
    );
  function change(id: string, delta: number) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const next = cart.map((i) => ({ ...i }));
    const existing = next.find((i) => i.productId === id);
    const qty = (existing?.quantity || 0) + delta;
    if (qty > Math.min(p.maxQuantity, p.inventory[0]?.available || 0))
      return message('You’ve reached the available quantity');
    if (existing) existing.quantity = qty;
    else if (qty > 0) next.push({ productId: id, quantity: qty });
    const filtered = next.filter((i) => i.quantity > 0);
    setCart(filtered);
    if (user)
      void request('/cart', 'PUT', filtered).catch(() =>
        message('Cart saved on this device; sync unavailable'),
      );
    if (delta > 0 && !existing) message(`${p.name} added to your basket`);
  }
  function chooseCategory(id: string) {
    setCategory(id);
    setOnlySaved(false);
    setSearch('');
    catalogueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function wishlist(id: string) {
    setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (user) void request('/wishlist/' + id, 'POST').catch(() => {});
  }
  let visible = products.filter(
    (p) =>
      (category === 'all' || p.categoryId === category) &&
      (!onlySaved || saved.includes(p.id)) &&
      `${p.name} ${p.brand} ${categories.find((c) => c.id === p.categoryId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  if (sort === 'low') visible = [...visible].sort((a, b) => a.price - b.price);
  if (sort === 'discount')
    visible = [...visible].sort((a, b) => 1 - b.price / b.mrp - (1 - a.price / a.mrp));
  async function finishSignIn(u: User) {
    setUser(u);
    const [addresses, remote] = await Promise.all([api.addresses(), request<CartLine[]>('/cart')]);
    const merged = new Map(remote.map((i) => [i.productId, i.quantity]));
    cart.forEach((i) =>
      merged.set(i.productId, Math.min(20, (merged.get(i.productId) || 0) + i.quantity)),
    );
    const combined = [...merged].map(([productId, quantity]) => ({ productId, quantity }));
    setCart(combined);
    await request('/cart', 'PUT', combined);
    setAddress(addresses.at(-1) || null);
    setPanel(addresses.length ? 'cart' : 'location');
    message('Welcome to the neighbourhood');
  }
  async function passwordLogin() {
    setBusy(true);
    setFormError('');
    try {
      if (name.trim().length < 2)
        throw new Error('Please enter your name (at least 2 characters).');
      const u = await signInCustomer(name.trim(), phone.trim(), password);
      await finishSignIn(u);
    } catch (e) {
      setFormError(signInError(e));
    } finally {
      setBusy(false);
    }
  }
  async function locate() {
    if (!navigator.geolocation) {
      setFormError('Location is unavailable. Enter coordinates manually.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGeo({ latitude: p.coords.latitude, longitude: p.coords.longitude });
        setGeoLabel('Device location captured — confirm your entrance details below');
        setBusy(false);
      },
      () => {
        setFormError(
          'Location permission was unavailable. Enter your address and coordinates below.',
        );
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  async function saveAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) {
      open('login');
      return;
    }
    setBusy(true);
    setFormError('');
    const f = new FormData(e.currentTarget);
    try {
      const a = await request<Address>('/addresses', 'POST', {
        label: 'Home',
        recipient: f.get('recipient'),
        phone: f.get('phone'),
        line: f.get('line'),
        city: f.get('city'),
        state: f.get('state'),
        pincode: f.get('pincode'),
        instructions: f.get('instructions'),
        latitude: geo.latitude,
        longitude: geo.longitude,
      });
      setAddress(a);
      setPanel(cart.length ? 'cart' : null);
      message('Delivery address saved');
    } catch (e) {
      setFormError(signInError(e));
    } finally {
      setBusy(false);
    }
  }
  async function placeOrder() {
    if (!user) return open('login');
    if (!address) return open('location');
    setBusy(true);
    setFormError('');
    try {
      checkoutKey.current ??= crypto.randomUUID();
      const o = await request<Order & { deliveryCode?: string }>('/orders', 'POST', {
        items: cart,
        addressId: address.id,
        paymentMethod: payment,
        coupon: appliedCoupon || undefined,
        idempotencyKey: checkoutKey.current,
      });
      setCart([]);
      setTracking(o);
      setPanel('tracking');
      message('Your order is in. Good things are on their way.');
      void load();
    } catch (e) {
      setFormError(signInError(e));
    } finally {
      setBusy(false);
    }
  }
  async function showOrders() {
    if (!user) return open('login');
    open('orders');
    setBusy(true);
    try {
      setOrders(await api.orders());
    } catch (e) {
      setFormError(signInError(e));
    } finally {
      setBusy(false);
    }
  }
  async function track(id: string) {
    setBusy(true);
    try {
      setTracking(await api.order(id));
      open('tracking');
    } catch (e) {
      message((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function quantity(p: Product) {
    const qty = cart.find((i) => i.productId === p.id)?.quantity || 0;
    return qty ? (
      <div className="qty">
        <button aria-label={`Remove one ${p.name}`} onClick={() => change(p.id, -1)}>
          −
        </button>
        <span>{qty}</span>
        <button aria-label={`Add one ${p.name}`} onClick={() => change(p.id, 1)}>
          +
        </button>
      </div>
    ) : (
      <button
        className="add-button"
        disabled={!p.inventory[0]?.available}
        onClick={() => change(p.id, 1)}
        aria-label={`Add ${p.name}`}
      >
        {p.inventory[0]?.available ? 'ADD' : 'SOLD OUT'}
        <Plus size={11} />
      </button>
    );
  }
  return (
    <>
      <div className="announcement">
        <Sparkles size={11} />
        <span>
          A little welcome gift: <b>10% off your basket</b> with HELLO10 · Min. ₹299
        </span>
        <ArrowRight size={11} />
      </div>
      <header className="site-header">
        <div className="header-main">
          <Logo />
          <button className="location-button" onClick={() => open(user ? 'location' : 'login')}>
            <MapPin size={19} />
            <span>
              <small>Delivering goodness to</small>
              <b>{address ? address.label + ' · ' + address.city : 'Indiranagar, Bengaluru'}</b>
            </span>
            <ChevronDown size={13} />
          </button>
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Search products"
              placeholder="Search for “fresh milk”"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCategory('all');
                setOnlySaved(false);
              }}
            />
            <kbd>⌕</kbd>
          </label>
          <div className="header-actions">
            <button
              className="account-button"
              onClick={() => (user ? showOrders() : open('login'))}
            >
              <UserRound size={19} />
              <span>{user ? user.name.split(' ')[0] : 'Sign in'}</span>
            </button>
            <button
              className="icon-button"
              aria-label="View wishlist"
              onClick={() => {
                setOnlySaved((v) => !v);
                setCategory('all');
                catalogueRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Heart size={19} />
            </button>
            <button className="basket-button" onClick={() => open('cart')}>
              <ShoppingBasket size={18} />
              <b className="basket-label">My basket</b>
              <span>{count}</span>
            </button>
          </div>
        </div>
        <nav className="navigation" aria-label="Store categories">
          <div className="nav-links">
            {[
              ['all', 'All categories'],
              ['produce', 'Fresh produce'],
              ['dairy', 'Dairy & bakery'],
              ['pantry', 'Pantry staples'],
              ['snacks', 'Snacks & drinks'],
              ['care', 'Home & care'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => chooseCategory(id)}
                className={category === id ? 'active' : ''}
              >
                {label}
                {id === 'all' && (
                  <ChevronDown size={10} style={{ display: 'inline', marginLeft: 8 }} />
                )}
              </button>
            ))}
          </div>
        </nav>
      </header>
      <main className="store-main">
        <section className="hero-grid" aria-label="Weekly specials">
          <div className="hero-main">
            <div className="hero-copy">
              <div className="eyebrow">
                <span>✳</span> YOUR NEIGHBOURHOOD, DELIVERED
              </div>
              <h1>
                Everyday good.
                <br />
                At your <em>doorstep.</em>
              </h1>
              <p>
                Farm-fresh finds, pantry favourites,
                <br />
                and all the little things in between.
              </p>
              <button className="primary" onClick={() => chooseCategory('produce')}>
                Fill your basket <ArrowUpRight size={14} />
              </button>
              <div className="hero-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            <img
              className="hero-image"
              src={mediaUrl(homepage.hero || photo('photo-1542838132-92c53300491e'))}
              alt="Fresh finds from our store"
              fetchPriority="high"
            />
          </div>
          <div className="hero-side">
            <span className="eyebrow">THE SLOW MORNING CLUB</span>
            <h2>
              Better mornings
              <br />
              start <em>here.</em>
            </h2>
            <p>Breakfast favourites worth getting out of bed for.</p>
            <button className="text-link" onClick={() => chooseCategory('breakfast')}>
              Meet your morning <ArrowUpRight size={14} />
            </button>
            <img
              src={mediaUrl(homepage.breakfast || photo('photo-1517673400267-0251440c45dc', 400))}
              alt="Wholesome breakfast oats"
            />
          </div>
        </section>
        <section className="perks" aria-label="Our promises">
          {[
            [Leaf, 'Freshness comes first', 'Thoughtfully picked. Quality checked.'],
            [ShieldCheck, 'Good prices. No surprises.', 'A little more value in every basket'],
            [PackageCheck, 'Packed with a little care', 'From our neighbourhood to yours'],
          ].map(([Icon, title, detail]) => {
            const I = Icon as typeof Truck;
            return (
              <div className="perk" key={String(title)}>
                <I />
                <div>
                  <b>{String(title)}</b>
                  <small>{String(detail)}</small>
                </div>
              </div>
            );
          })}
        </section>
        <section className="shop-section">
          <div className="section-heading">
            <div>
              <h2>Shop by category</h2>
              <p>Choose what you need today.</p>
            </div>
            <button className="text-link" onClick={() => chooseCategory('all')}>
              Explore all categories <ArrowRight size={13} />
            </button>
          </div>
          <div className="category-grid">
            {categories.map((c) => (
              <button
                key={c.id}
                className={`category-tile ${category === c.id ? 'selected' : ''}`}
                onClick={() => chooseCategory(c.id)}
              >
                <span className="category-picture" style={{ background: c.color }}>
                  <img src={c.image} alt="" loading="lazy" />
                </span>
                <b>{c.name}</b>
              </button>
            ))}
          </div>
        </section>
        <section className="shop-section" ref={catalogueRef} style={{ scrollMarginTop: 170 }}>
          <div className="section-heading">
            <div>
              <h2>
                {onlySaved
                  ? 'Your little favourites'
                  : search
                    ? `Finds for “${search}”`
                    : category === 'all'
                      ? 'Fresh picks for your everyday'
                      : categories.find((c) => c.id === category)?.name}
              </h2>
              <p>
                {onlySaved
                  ? 'Good things worth coming back for.'
                  : 'The neighbourhood favourites. Always a good choice.'}
              </p>
            </div>
            <span className="text-link">
              {visible.length} fresh finds <Leaf size={13} />
            </span>
          </div>
          <div className="product-toolbar">
            <button
              onClick={() => {
                setCategory('all');
                setOnlySaved(false);
              }}
              className={`filter-chip ${category === 'all' ? 'active' : ''}`}
            >
              All favourites
            </button>
            {categories.slice(0, 3).map((c) => (
              <button
                className={`filter-chip ${category === c.id ? 'active' : ''}`}
                key={c.id}
                onClick={() => setCategory(c.id)}
              >
                {c.id === 'produce'
                  ? 'Farm fresh'
                  : c.id === 'dairy'
                    ? 'Daily essentials'
                    : 'Pantry picks'}
              </button>
            ))}
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="popular">Our favourites</option>
              <option value="low">Price: low to high</option>
              <option value="discount">Best savings</option>
            </select>
          </div>
          {error && <ErrorNotice message={error} onRetry={load} />}
          <div className="product-grid">
            {loading
              ? Array.from({ length: 6 }, (_, i) => <div className="skeleton" key={i} />)
              : visible.map((p) => (
                  <article className="product-card" key={p.id}>
                    <button
                      className="product-visual"
                      onClick={() => {
                        setSelected(p);
                        open('product');
                      }}
                      aria-label={`View ${p.name}`}
                    >
                      <img src={mediaUrl(p.image)} alt={p.name} loading="lazy" />
                      <span className="discount-badge">
                        {Math.round((1 - p.price / p.mrp) * 100)}% OFF
                      </span>
                    </button>
                    <button
                      className={`wish-button ${saved.includes(p.id) ? 'saved' : ''}`}
                      aria-label={`Save ${p.name}`}
                      aria-pressed={saved.includes(p.id)}
                      onClick={() => wishlist(p.id)}
                    >
                      <Heart size={13} fill={saved.includes(p.id) ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className="product-name"
                      onClick={() => {
                        setSelected(p);
                        open('product');
                      }}
                    >
                      {p.name}
                    </button>
                    <span className="product-unit">{p.unit}</span>
                    <div className="product-bottom">
                      <div>
                        <b>{money(p.price)}</b>
                        <del>{money(p.mrp)}</del>
                      </div>
                      {quantity(p)}
                    </div>
                  </article>
                ))}
          </div>
          {!loading && !visible.length && !error && (
            <Empty
              title="No finds just yet"
              detail="Try another search or explore our other categories."
              action={
                <button
                  className="secondary"
                  onClick={() => {
                    setSearch('');
                    setOnlySaved(false);
                    setCategory('all');
                  }}
                >
                  Explore everything
                </button>
              }
            />
          )}
        </section>
        <section className="promos" aria-label="Curated collections">
          {[
            [
              'YOUR DAILY BREAD',
              'Rise & shine.\nFreshly baked.',
              'dairy',
              'photo-1598373182133-52452f7691ef',
            ],
            [
              'THE GOOD STUFF',
              'Small bites.\nBig happy.',
              'snacks',
              'photo-1499636136210-6f4ee915583e',
            ],
            [
              'STOCK UP, SLOW DOWN',
              'A well-stocked\nkind of day.',
              'pantry',
              'photo-1586201375761-83865001e31c',
            ],
          ].map(([label, title, id, img]) => (
            <div className="promo" key={id}>
              <span className="eyebrow">{label}</span>
              <h3 style={{ whiteSpace: 'pre-line' }}>{title}</h3>
              <button className="text-link" onClick={() => chooseCategory(id)}>
                Shop the collection <ArrowUpRight size={12} />
              </button>
              <img
                src={mediaUrl(homepage[id as keyof HomepageImages] || photo(img, 300))}
                alt=""
                loading="lazy"
              />
            </div>
          ))}
        </section>
        <section className="neighbourhood">
          <div className="flex">
            <span className="leaf">
              <Leaf size={26} />
            </span>
            <div>
              <h3>Big on freshness. Close to home.</h3>
              <p>Your neighbourhood store, with a little extra convenience.</p>
            </div>
          </div>
          <button className="secondary" onClick={() => open(user ? 'location' : 'login')}>
            Find your delivery spot <MapPin size={13} />
          </button>
        </section>
      </main>
      <Footer />
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Home size={19} />
          Home
        </button>
        <button onClick={() => chooseCategory('all')}>
          <Grid2X2 size={19} />
          Categories
        </button>
        <button
          onClick={() => {
            setOnlySaved(true);
            catalogueRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <Heart size={19} />
          Favourites
        </button>
        <button onClick={() => open('cart')}>
          <ShoppingBasket size={19} />
          Basket {count > 0 ? `(${count})` : ''}
        </button>
        <button onClick={() => (user ? showOrders() : open('login'))}>
          <UserRound size={19} />
          Account
        </button>
      </nav>
      <Modal open={panel === 'login'} onClose={() => setPanel(null)} title="Hello, neighbour.">
        <p className="address-hint">
          Sign in with your phone number and password. No OTP or Google account is required.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void passwordLogin();
          }}
        >
          <label className="field">
            Your name
            <input
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
              disabled={busy}
              placeholder="Enter your full name"
            />
          </label>
          <label className="field">
            Phone number
            <input
              name="phone"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
              pattern="[6-9][0-9]{9}"
              required
              disabled={busy}
              placeholder="10-digit mobile number"
            />
          </label>
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={4}
              required
              disabled={busy}
              placeholder="At least 4 characters"
            />
          </label>
          {formError && <ErrorNotice message={formError} />}
          <button className="primary full" type="submit" disabled={busy || name.trim().length < 2 || !/^[6-9]\d{9}$/.test(phone) || password.length < 4}>
            {busy ? 'Signing in…' : 'Continue'} <ArrowRight size={15} />
          </button>
        </form>
      </Modal>
      <Modal
        open={panel === 'location'}
        onClose={() => setPanel(null)}
        title="Where’s your little corner?"
        wide
      >
        <p className="address-hint">
          Your location helps us check delivery availability. We only request device location when
          you choose the button below.
        </p>
        <div className="demo-note">
          Save your complete address below. Delivery availability is checked separately at checkout.
        </div>
        <button className="secondary" onClick={locate} disabled={busy}>
          <Navigation size={15} />
          Use my current location
        </button>
        <form onSubmit={saveAddress}>
          <div className="form-grid">
            <label className="field">
              Recipient name
              <input
                name="recipient"
                defaultValue={address?.recipient || user?.name}
                required
                minLength={2}
              />
            </label>
            <label className="field">
              Mobile number
              <input
                name="phone"
                defaultValue={address?.phone || user?.phone || ''}
                required
                pattern="[6-9][0-9]{9}"
              />
            </label>
          </div>
          <label className="field">
            Flat / house, building & street
            <input
              name="line"
              placeholder="204, Maple House, 12th Main Road"
              defaultValue={address?.line}
              required
              minLength={8}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              City
              <input name="city" defaultValue={address?.city || ''} placeholder="Your city" required />
            </label>
            <label className="field">
              PIN code
              <input
                name="pincode"
                defaultValue={address?.pincode || ''}
                placeholder="6-digit PIN code"
                required
                pattern="[0-9]{6}"
              />
            </label>
          </div>
          <label className="field">State<input name="state" defaultValue={address?.state || ''} placeholder="Your state" required /></label>
          {geoLabel && <p className="address-hint">{geoLabel}</p>}
          <label className="field">
            Delivery instructions (optional)
            <input
              name="instructions"
              defaultValue={address?.instructions}
              placeholder="Ring the doorbell, please"
            />
          </label>
          {formError && <ErrorNotice message={formError} />}
          <button className="primary full" disabled={busy}>
            Save address <Check size={15} />
          </button>
        </form>
      </Modal>
      <Modal
        open={panel === 'cart'}
        onClose={() => setPanel(null)}
        title={`Your basket${count ? ` · ${count} items` : ''}`}
      >
        {!cart.length ? (
          <Empty
            title="A little empty, a lot of possibility."
            detail="Let’s find something good for your day."
            action={
              <button
                className="primary"
                onClick={() => {
                  setPanel(null);
                  chooseCategory('all');
                }}
              >
                Explore the store <ArrowRight size={14} />
              </button>
            }
          />
        ) : (
          <>
            <div className="cart-note">
              <Truck size={17} />
              {subtotal >= 49900
                ? 'Your basket gets free delivery. Nice!'
                : `You’re ${money(49900 - subtotal)} away from free delivery.`}
            </div>
            {cart.map((i) => {
              const p = products.find((p) => p.id === i.productId);
              return p ? (
                <div className="cart-line" key={i.productId}>
                  <img src={mediaUrl(p.image)} alt="" />
                  <div className="line-info">
                    <b>{p.name}</b>
                    <small>
                      {p.unit} · {money(p.price)}
                    </small>
                  </div>
                  {quantity(p)}
                </div>
              ) : (
                <div key={i.productId}>
                  Unavailable product{' '}
                  <button onClick={() => setCart(cart.filter((c) => c.productId !== i.productId))}>
                    Remove
                  </button>
                </div>
              );
            })}
            <div className="coupon-row">
              <input
                aria-label="Coupon code"
                placeholder="Have a little discount code?"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              />
              <button className="secondary" onClick={() => setAppliedCoupon(coupon)}>
                Apply
              </button>
              {appliedCoupon && (
                <button
                  aria-label="Remove coupon"
                  onClick={() => {
                    setAppliedCoupon('');
                    setCoupon('');
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {quote && (
              <div className="bill">
                <div>
                  <span>Basket subtotal</span>
                  <b>{money(quote.subtotal)}</b>
                </div>
                {quote.discount > 0 && (
                  <div>
                    <span>HELLO10 savings</span>
                    <b>−{money(quote.discount)}</b>
                  </div>
                )}
                <div>
                  <span>Delivery</span>
                  <b>{quote.deliveryFee ? money(quote.deliveryFee) : 'On us'}</b>
                </div>
                <div>
                  <span>Handling</span>
                  <b>{money(quote.handlingFee)}</b>
                </div>
                <div className="total">
                  <span>To pay</span>
                  <span>{money(quote.total)}</span>
                </div>
                <small>Includes {money(quote.tax)} GST. Final amount verified by the store.</small>
              </div>
            )}
            <div className="checkout-address">
              <div className="flex between">
                <b>
                  <MapPin size={13} style={{ display: 'inline' }} /> Deliver to{' '}
                  {address?.label || 'your door'}
                </b>
                <button className="text-link" onClick={() => open(user ? 'location' : 'login')}>
                  {address ? 'Change' : 'Add address'}
                </button>
              </div>
              {address ? (
                <p>
                  {address.line}, {address.city} {address.pincode}
                </p>
              ) : (
                <small>Choose an address to check delivery availability.</small>
              )}
            </div>
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                checked={payment === 'cod'}
                onChange={() => setPayment('cod')}
              />
              <span>
                <b>Cash on delivery</b>
                <small>Pay when your goodness arrives</small>
              </span>
            </label>
            <label className="payment-option">
              <input
                type="radio"
                name="payment"
                checked={payment === 'mock'}
                onChange={() => setPayment('mock')}
              />
              <span>
                <b>Test online payment</b>
                <small>Development only · No money will be charged</small>
              </span>
            </label>
            {formError && <ErrorNotice message={formError} />}
            <button
              className="primary full"
              disabled={busy || !quote}
              style={{ marginTop: 15 }}
              onClick={placeOrder}
            >
              {busy
                ? 'Placing your order…'
                : !user
                  ? 'Sign in to continue'
                  : !address
                    ? 'Choose delivery address'
                    : `Place order · ${money(quote?.total || 0)}`}
              <ArrowRight size={15} />
            </button>
          </>
        )}
      </Modal>
      <Modal open={panel === 'product'} onClose={() => setPanel(null)} title="A closer look" wide>
        {selected && (
          <div className="product-detail">
            <ProductGallery
              key={selected.id}
              image={selected.image}
              images={selected.images}
              name={selected.name}
            />
            <div>
              <span className="eyebrow">{selected.brand}</span>
              <h2>{selected.name}</h2>
              <span className="muted">{selected.unit}</span>
              <div className="detail-price">
                {money(selected.price)}
                <del>{money(selected.mrp)}</del>
              </div>
              <small>Inclusive of applicable GST</small>
              <p>{selected.description}</p>
              <div className="flex between">
                <span className="tag">
                  {selected.inventory[0]?.available ? 'Fresh & in stock' : 'Out of stock'}
                </span>
                {quantity(selected)}
              </div>
              <button
                className="text-link"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(`${window.location.origin}/products/${selected.slug}`)
                    .then(() => message('Product link copied'));
                }}
              >
                Share this little find <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        open={panel === 'orders'}
        onClose={() => setPanel(null)}
        title={`Your everyday, ${user?.name.split(' ')[0] || 'neighbour'}`}
        wide
      >
        <div className="flex between">
          <p className="address-hint">Your orders, all in one little place.</p>
          <button
            className="text-link"
            onClick={async () => {
              await request('/auth/logout', 'POST', {});
              setUser(null);
              setAddress(null);
              setCart([]);
              setPanel(null);
              message('You’re signed out');
            }}
          >
            Sign out
          </button>
        </div>
        {formError && <ErrorNotice message={formError} />}{' '}
        {!busy && !orders.length && (
          <Empty
            title="Your first basket is waiting"
            detail="Place an order and follow its journey here."
          />
        )}
        {orders.map((o) => (
          <div className="order-card" key={o.id}>
            <div className="flex between">
              <h3>Order #{o.id.slice(0, 8).toUpperCase()}</h3>
              <span className={`status ${o.status}`}>{o.status.replaceAll('_', ' ')}</span>
            </div>
            <p>
              {new Date(o.createdAt).toLocaleString('en-IN')} · {money(o.total)}
            </p>
            <div className="order-products">
              {o.items.map((i) => (
                <img src={mediaUrl(i.image)} key={i.productId} alt={i.name} />
              ))}
            </div>
            <div className="flex between">
              <button className="text-link" onClick={() => track(o.id)}>
                View order & track <ArrowRight size={13} />
              </button>
              <button
                className="text-link"
                onClick={() => {
                  setCart(
                    o.items
                      .filter((i) => products.some((p) => p.id === i.productId && p.active))
                      .map((i) => ({ productId: i.productId, quantity: i.quantity })),
                  );
                  open('cart');
                }}
              >
                Order again
              </button>
            </div>
          </div>
        ))}
      </Modal>
      <Modal
        open={panel === 'tracking'}
        onClose={() => setPanel(null)}
        title={
          tracking?.status === 'delivered' ? 'Goodness, delivered.' : 'Your basket’s little journey'
        }
        wide
      >
        {tracking && (
          <>
            <div className="flex between">
              <p className="address-hint">
                Order #{tracking.id.slice(0, 8).toUpperCase()} · {money(tracking.total)}
              </p>
              <span className="tag">{live ? '● Live updates' : 'Updates every 10 seconds'}</span>
            </div>
            <div className="tracking-grid">
              <div>
                <div className="timeline">
                  {tracking.history.map((h, i) => (
                    <div key={i}>
                      <b>{h.status.replaceAll('_', ' ')}</b>
                      <small>{new Date(h.createdAt).toLocaleTimeString('en-IN')}</small>
                    </div>
                  ))}
                </div>
                {tracking.status !== 'cancelled' &&
                  !statuses.includes(tracking.status as (typeof statuses)[number]) && (
                    <p>{tracking.status}</p>
                  )}
                {['placed', 'accepted'].includes(tracking.status) && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await request(`/orders/${tracking.id}/cancel`, 'POST', {});
                        setTracking(await api.order(tracking.id));
                        void load();
                      } catch (e) {
                        message((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancel order
                  </button>
                )}
              </div>
              <div>
                <div className="map-fallback">
                  <MapPin size={30} />
                  {tracking.locations[0] ? (
                    <>
                      <b>Last shared driver position</b>
                      <p>
                        {tracking.locations[0].latitude.toFixed(5)},{' '}
                        {tracking.locations[0].longitude.toFixed(5)}
                      </p>
                      <small>
                        Updated{' '}
                        {new Date(tracking.locations[0].createdAt).toLocaleTimeString('en-IN')}
                      </small>
                      <small>
                        Accuracy ±{Math.round(tracking.locations[0].accuracy)} m · No live ETA
                        available
                      </small>
                      <a
                        className="text-link"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps?q=${tracking.locations[0].latitude},${tracking.locations[0].longitude}`}
                      >
                        Open location in Maps <ArrowUpRight size={12} />
                      </a>
                    </>
                  ) : (
                    <>
                      <b>No driver location yet</b>
                      <small>
                        Location appears after your assigned partner starts delivery and shares GPS.
                      </small>
                    </>
                  )}
                </div>
                {tracking.deliveryCode && !['cancelled', 'delivered'].includes(tracking.status) && (
                  <div className="tracking-code">
                    <small>Share only when your delivery arrives</small>
                    <b>{tracking.deliveryCode}</b>
                  </div>
                )}
                <div className="demo-note">
                  {tracking.paymentMethod === 'mock'
                    ? 'Test payment only. No money has been charged.'
                    : 'Cash on delivery. Pay your partner when the order arrives.'}
                </div>
              </div>
            </div>
            {tracking.items.map((i) => (
              <div className="cart-line" key={i.productId}>
                <img src={mediaUrl(i.image)} alt="" />
                <div className="line-info">
                  <b>{i.name}</b>
                  <small>
                    {i.unit} × {i.quantity}
                  </small>
                </div>
                <b>{money(i.price * i.quantity)}</b>
              </div>
            ))}
          </>
        )}
      </Modal>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
