'use client';

import { useRef, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { request } from '@daybasket/api-client';
import type { Category } from '@daybasket/types';
import { Empty, ErrorNotice, Modal, mediaUrl } from '@daybasket/ui';
import { PhotoPicker } from './photo-picker';

export type AdminCategory = Category & { productCount: number };
type CategoryDraft = Pick<Category, 'name' | 'image' | 'color'> & { id?: string };

export function CategoryManager({
  categories,
  onSaved,
}: {
  categories: AdminCategory[];
  onSaved: (message: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CategoryDraft | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);
  const [replacement, setReplacement] = useState('');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mutationPending = useRef(false);
  const locked = busy || uploading;
  const deletingCategory = categories.find((category) => category.id === deleting?.id) ?? deleting;
  const destinations = categories.filter((category) => category.id !== deleting?.id);
  const needsDestination = !!deletingCategory?.productCount;
  const filtered = categories.filter((category) =>
    category.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );

  function editCategory(category?: AdminCategory) {
    setError('');
    setEditing(category ?? { name: '', image: '', color: '#eef2e5' });
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || mutationPending.current || uploading) return;
    if (!editing.name.trim() || !editing.image) {
      setError('Add a category name and photo before saving.');
      return;
    }
    mutationPending.current = true;
    setBusy(true);
    setError('');
    try {
      await request(
        '/admin/categories' + (editing.id ? '/' + editing.id : ''),
        editing.id ? 'PUT' : 'POST',
        { name: editing.name.trim(), image: editing.image, color: editing.color },
      );
      setEditing(null);
      await onSaved(editing.id ? 'Category updated' : 'Category added');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to save category. Please try again.',
      );
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  async function deleteCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!deletingCategory || mutationPending.current) return;
    if (needsDestination && !destinations.some((category) => category.id === replacement)) {
      setError('Choose another category for these products first.');
      return;
    }
    mutationPending.current = true;
    setBusy(true);
    setError('');
    try {
      await request('/admin/categories/' + deletingCategory.id, 'DELETE', {
        ...(replacement ? { replacementCategoryId: replacement } : {}),
      });
      setDeleting(null);
      await onSaved(needsDestination ? 'Products moved and category deleted' : 'Category deleted');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to delete category. Please try again.',
      );
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <div className="admin-toolbar category-toolbar">
        <input
          aria-label="Search categories"
          placeholder="Find a category…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <button className="primary" disabled={locked} onClick={() => editCategory()}>
          <Plus size={14} /> Add category
        </button>
      </div>
      <section className="panel">
        {filtered.length ? (
          <div className="table-scroll">
            <table className="category-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Products</th>
                  <th>Colour</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div className="table-product">
                        <img
                          src={mediaUrl(category.image)}
                          alt=""
                          style={{ backgroundColor: category.color }}
                        />
                        <b>{category.name}</b>
                      </div>
                    </td>
                    <td>{category.productCount}</td>
                    <td>
                      <span
                        className="category-colour"
                        style={{ backgroundColor: category.color }}
                        role="img"
                        aria-label={`Background colour ${category.color}`}
                      />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button disabled={locked} onClick={() => editCategory(category)}>
                          <Pencil size={13} /> Edit
                        </button>
                        <button
                          className="category-delete"
                          disabled={locked}
                          onClick={() => {
                            setError('');
                            setReplacement('');
                            setDeleting(category);
                          }}
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={
              categories.length ? 'No matching categories' : 'Make room for your first category'
            }
            detail={
              categories.length
                ? 'Try a different category name.'
                : 'Add a category, then choose it when adding products to your store.'
            }
          />
        )}
      </section>
      <p className="category-help">
        Product counts include archived and previously removed listings.
      </p>
      <Modal
        open={!!editing}
        title={editing?.id ? 'Edit category' : 'Add category'}
        onClose={() => {
          if (!locked) setEditing(null);
        }}
      >
        {editing && (
          <form className="category-form" onSubmit={saveCategory}>
            <label className="field">
              Category name
              <input
                value={editing.name}
                maxLength={80}
                required
                disabled={locked}
                placeholder="e.g. Homemade pickles"
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </label>
            <PhotoPicker
              key={editing.id || 'new-category'}
              label="Category photo"
              max={1}
              value={editing.image ? [editing.image] : []}
              disabled={busy}
              onBusy={setUploading}
              onChange={(photos) =>
                setEditing((current) => (current ? { ...current, image: photos[0] || '' } : null))
              }
            />
            <label className="field category-colour-field">
              Background colour
              <input
                type="color"
                value={editing.color}
                disabled={locked}
                onChange={(event) => setEditing({ ...editing, color: event.target.value })}
              />
            </label>
            {error && <ErrorNotice message={error} />}
            <div className="order-actions">
              <button
                type="button"
                className="secondary"
                disabled={locked}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={locked || !editing.name.trim() || !editing.image}
              >
                {uploading ? 'Uploading photo…' : busy ? 'Saving…' : 'Save category'}
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={!!deleting}
        title="Delete category?"
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
      >
        <form className="category-form" onSubmit={deleteCategory}>
          <p>
            Delete <b>{deletingCategory?.name}</b> from your storefront?
          </p>
          {needsDestination ? (
            <>
              <p>
                Move all {deletingCategory?.productCount} linked products to another category first.
                This includes archived and previously removed listings. No products will be deleted.
              </p>
              {destinations.length ? (
                <label className="field">
                  Move products to
                  <select
                    value={
                      destinations.some((category) => category.id === replacement)
                        ? replacement
                        : ''
                    }
                    onChange={(event) => setReplacement(event.target.value)}
                    disabled={busy}
                    required
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {destinations.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p role="status" className="category-help">
                  Create another category before deleting this one so your products have somewhere
                  to go.
                </p>
              )}
            </>
          ) : (
            <p>This category has no linked products. No products will be deleted.</p>
          )}
          {error && <ErrorNotice message={error} />}
          <div className="order-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Keep category
            </button>
            <button
              className="primary"
              disabled={
                busy ||
                (needsDestination && !destinations.some((category) => category.id === replacement))
              }
            >
              {busy ? 'Deleting…' : 'Delete category'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
