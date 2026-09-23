'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowUpRight, ShoppingBasket, X, LoaderCircle, Leaf, ArrowRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <a href="/" className={`logo ${dark ? 'logo-light' : ''}`} aria-label="Daybasket home">
      <span className="logo-icon">
        <ShoppingBasket size={24} />
      </span>
      daybasket<span className="logo-dot">.</span>
    </a>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content aria-describedby={undefined} className={`modal-card ${wide ? 'wide' : ''}`}>
          <div className="modal-title">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <ShoppingBasket size={34} />
      </span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" /> Getting things ready…
    </div>
  );
}
export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error" role="alert">
      {message}
      {onRetry && (
        <button onClick={onRetry}>
          Try again <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <Logo />
        <p>
          A little fresh. A little local.
          <br />A whole lot of everyday good.
        </p>
      </div>
      <div>
        <b>Good things, thoughtfully delivered.</b>
        <p>Development store · Bengaluru · Prices in INR</p>
        <a href="/policies">
          Help & store policies <ArrowUpRight size={14} />
        </a>
      </div>
      <span className="footer-leaf">
        <Leaf size={42} />
      </span>
    </footer>
  );
}

export function mediaUrl(src: string) {
  if (!src.startsWith('/api/v1/media/')) return src;
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  return api.replace(/\/api\/v1\/?$/, '') + src;
}
export function ProductGallery({
  image,
  images,
  name,
}: {
  image: string;
  images?: string[];
  name: string;
}) {
  const photos = [...new Set([image, ...(images || [])])];
  const [selected, setSelected] = useState<string | null>(null);
  const current = selected && photos.includes(selected) ? selected : image;
  return (
    <div className="product-gallery">
      <img className="gallery-main" src={mediaUrl(current)} alt={name} />
      {photos.length > 1 && (
        <div className="gallery-thumbnails" aria-label={`${name} photos`}>
          {photos.map((src, index) => (
            <button
              type="button"
              key={src}
              aria-label={`View photo ${index + 1} of ${name}`}
              aria-pressed={src === current}
              onClick={() => setSelected(src)}
            >
              <img src={mediaUrl(src)} alt={`${name}, photo ${index + 1}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
