'use client';
import { useState } from 'react';
import { request } from '@daybasket/api-client';
import { mediaUrl } from '@daybasket/ui';

async function preparePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose JPEG, PNG or WebP photos.');
  if (file.size > 20 * 1024 * 1024)
    throw new Error('Each original photo must be smaller than 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser could not prepare this photo.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/webp', 0.82);
    if (data.length > 1398100) throw new Error('This photo is too large. Choose a smaller image.');
    return data;
  } finally {
    bitmap.close();
  }
}

export function PhotoPicker({
  value,
  onChange,
  label,
  max = 8,
  disabled = false,
  onBusy,
}: {
  value: string[];
  onChange: (photos: string[]) => void;
  label: string;
  max?: number;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const locked = disabled || uploading;
  return (
    <section className="photo-picker">
      <label className="field">
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={max > 1}
          disabled={locked || value.length >= max}
          onChange={async (event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = '';
            setError('');
            if (value.length + files.length > max) {
              setError(`Choose up to ${max} photos in total.`);
              return;
            }
            setUploading(true);
            onBusy?.(true);
            const next = [...value];
            try {
              for (const file of files) {
                const data = await preparePhoto(file);
                const result = await request<{ url: string }>('/admin/media', 'POST', { data });
                next.push(result.url);
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              onChange(next);
              setUploading(false);
              onBusy?.(false);
            }
          }}
        />
      </label>
      <small>
        {uploading
          ? 'Uploading photos…'
          : `Up to ${max} photo${max > 1 ? 's. The first photo is the cover' : ''}. JPEG, PNG or WebP; automatically resized.`}
      </small>
      <div className="photo-previews">
        {value.map((src, index) => (
          <div key={`${src}-${index}`}>
            <img src={mediaUrl(src)} alt={`${label} ${index + 1}`} />
            <div className="flex">
              {max > 1 && (
                <button
                  type="button"
                  className="text-link"
                  disabled={locked || index === 0}
                  onClick={() => onChange([src, ...value.filter((_, i) => i !== index)])}
                >
                  {index === 0 ? 'Cover' : 'Make cover'}
                </button>
              )}
              <button
                type="button"
                className="text-link"
                disabled={locked}
                aria-label={`Remove ${label} ${index + 1}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      {value.length < max && (
        <div className="flex">
          <input
            aria-label={`${label} HTTPS URL`}
            type="url"
            placeholder="Or paste an HTTPS photo URL"
            value={url}
            disabled={locked}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="secondary"
            type="button"
            disabled={locked || !url}
            onClick={() => {
              try {
                if (new URL(url).protocol !== 'https:') throw new Error();
              } catch {
                setError('Enter a valid HTTPS image URL.');
                return;
              }
              onChange([...value, url]);
              setUrl('');
              setError('');
            }}
          >
            Add photo
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="error-notice">
          {error}
        </p>
      )}
    </section>
  );
}
