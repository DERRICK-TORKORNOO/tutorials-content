"use client";
import { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Upload,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Check,
} from "lucide-react";
import { productInput } from "../../../api/validation";
import type { Product, Category } from "@/lib/products";
import { api, ApiError } from "@/lib/api";
type ImageEntry = { url: string; file?: File; preview: string };
// Vercel caps request bodies below the brief's 5 MB source-file limit.
// Shrink only large source files before transport; the API still verifies and converts them.
async function uploadFile(file: File): Promise<File> {
  if (file.size <= 4 * 1024 * 1024) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This image could not be read. Choose another JPEG, PNG or WebP.",
    );
  }
  try {
    if (bitmap.width * bitmap.height > 32000000)
      throw new Error("Choose an image smaller than 32 megapixels.");
    const ratio = Math.min(1, 1200 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Image preparation is unavailable in this browser. Choose an image under 4 MB.",
      );
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not prepare this image.")),
        "image/webp",
        0.82,
      ),
    );
    if (blob.size > 4 * 1024 * 1024)
      throw new Error(
        "Choose a smaller image to fit the hosting upload limit.",
      );
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: blob.type,
    });
  } finally {
    bitmap.close();
  }
}
export function ProductForm({
  product,
  categories,
  adminKey,
  onClose,
  onSaved,
  onCatalogChanged,
}: {
  product: Product | null;
  categories: Category[];
  adminKey: string;
  onClose: () => void;
  onSaved: (version: number) => void;
  onCatalogChanged: (version: number) => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: product?.category ?? categories[0]?.name ?? "",
    price: String(product?.price ?? ""),
    stock: String(product?.stock ?? 0),
    badge: product?.badge ?? "",
    description: product?.description ?? "",
    colors: product?.colors.join(", ") ?? "#e6dfd2, #333b32",
    featured: product?.featured ?? false,
  });
  const [images, setImages] = useState<ImageEntry[]>(
    product?.images.map((url) => ({ url, preview: url })) ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [extraCategories, setExtraCategories] = useState<Category[]>([]);
  const [drag, setDrag] = useState<number | null>(null);
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, busy]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  function field(name: keyof typeof form, value: string | boolean) {
    setForm((old) => ({ ...old, [name]: value }));
    setErrors((old) => ({ ...old, [name]: "" }));
  }
  function addFiles(files: FileList | File[]) {
    const next = Array.from(files);
    if (images.length + next.length > 4) {
      setErrors((old) => ({ ...old, images: "Use up to 4 images." }));
      return;
    }
    if (
      next.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024,
      )
    ) {
      setErrors((old) => ({
        ...old,
        images: "Use JPEG, PNG or WebP images under 5 MB.",
      }));
      return;
    }
    setImages((old) => [
      ...old,
      ...next.map((file) => {
        const preview = URL.createObjectURL(file);
        previews.current.add(preview);
        return { url: "", file, preview };
      }),
    ]);
    setErrors((old) => ({ ...old, images: "" }));
  }
  function reorder(from: number, to: number) {
    if (to < 0 || to >= images.length) return;
    setImages((old) => {
      const next = [...old];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }
  async function createCategory() {
    if (addingCategory) return;
    setAddingCategory(true);
    try {
      const data = await api<{ category: Category; catalogVersion: number }>(
        "admin/categories",
        {
          method: "POST",
          headers: { "x-admin-key": adminKey },
          body: JSON.stringify({ name: newCategory }),
        },
      );
      setExtraCategories((old) => [...old, data.category]);
      field("category", data.category.name);
      setNewCategory("");
      onCatalogChanged(data.catalogVersion);
    } catch (error) {
      setErrors((old) => ({
        ...old,
        category:
          error instanceof Error ? error.message : "Could not create category.",
      }));
    } finally {
      setAddingCategory(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const input = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      colors: form.colors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      images: images.map((image) => image.url || "/img/products/pending.webp"),
    };
    const parsed = productInput.safeParse(input);
    if (!parsed.success) {
      const messages: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        messages[String(issue.path[0] ?? "form")] ??= issue.message;
      });
      setErrors(messages);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const uploaded = [...images];
      for (let i = 0; i < uploaded.length; i++) {
        const image = uploaded[i];
        if (image.file) {
          setProgress(`Uploading image ${i + 1} of ${uploaded.length}…`);
          const body = new FormData();
          body.append("file", await uploadFile(image.file));
          const data = await api<{ url: string }>("admin/images", {
            method: "POST",
            headers: { "x-admin-key": adminKey },
            body,
          });
          uploaded[i] = { url: data.url, preview: image.preview };
          setImages([...uploaded]);
        }
      }
      setProgress("Saving product…");
      const data = await api<{ catalogVersion: number }>(
        product ? `admin/products/${product.slug}` : "admin/products",
        {
          method: product ? "PATCH" : "POST",
          headers: { "x-admin-key": adminKey },
          body: JSON.stringify({
            ...parsed.data,
            images: uploaded.map((image) => image.url),
          }),
        },
      );
      onSaved(data.catalogVersion);
    } catch (error) {
      setErrors(
        error instanceof ApiError
          ? { ...error.fields, form: error.message }
          : {
              form:
                error instanceof Error
                  ? error.message
                  : "Could not save product.",
            },
      );
    } finally {
      setBusy(false);
      setProgress("");
    }
  }
  const error = (name: string) =>
    errors[name] ? (
      <span className="field-error" role="alert">
        {errors[name]}
      </span>
    ) : null;
  return (
    <div className="admin-modal-backdrop">
      <section
        className="product-form-panel"
        role="dialog"
        aria-modal="true"
        aria-label={product ? "Edit product" : "Add product"}
      >
        <div className="form-panel-header">
          <div>
            <div className="eyebrow">THE COLLECTION</div>
            <h2>
              {product ? "A little fine-tuning." : "Make room for a good find."}
            </h2>
          </div>
          <button
            disabled={busy}
            aria-label="Close product form"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <form onSubmit={submit} noValidate>
          <fieldset disabled={busy}>
            <div className="admin-form-grid">
              <label>
                Product name
                <input
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                  placeholder="Everyday Runner"
                />
                {error("name")}
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => field("category", e.target.value)}
                >
                  <option value="">Choose a category</option>
                  {[...categories, ...extraCategories]
                    .filter(
                      (c, i, a) =>
                        a.findIndex((other) => other.name === c.name) === i,
                    )
                    .map((c) => (
                      <option key={c.slug}>{c.name}</option>
                    ))}
                </select>
                {error("category")}
              </label>
              <div className="category-create full">
                <input
                  aria-label="New category name"
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button
                  type="button"
                  className="admin-secondary"
                  disabled={!newCategory.trim() || addingCategory}
                  onClick={createCategory}
                >
                  <Plus size={15} />
                  {addingCategory ? "Adding…" : "Add category"}
                </button>
              </div>
              <label>
                Price (GHS)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => field("price", e.target.value)}
                />
                {error("price")}
              </label>
              <label>
                Stock
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(e) => field("stock", e.target.value)}
                />
                {error("stock")}
              </label>
              <label>
                Badge <span className="optional">optional</span>
                <input
                  placeholder="NEW"
                  value={form.badge}
                  onChange={(e) => field("badge", e.target.value)}
                />
                {error("badge")}
              </label>
              <label>
                Colours{" "}
                <span className="optional">hex, separated by commas</span>
                <input
                  value={form.colors}
                  onChange={(e) => field("colors", e.target.value)}
                />
                {error("colors")}
              </label>
              <label className="full">
                Description
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => field("description", e.target.value)}
                  placeholder="What makes this an everyday favourite?"
                />
                {error("description")}
              </label>
              <label className="featured-control full">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => field("featured", e.target.checked)}
                />
                <div>
                  <strong>Featured on the homepage</strong>
                  <span>
                    Include this product in the everyday essentials edit.
                  </span>
                </div>
                <Check size={19} />
              </label>
              <div className="full">
                <div className="image-field-title">
                  Product images{" "}
                  <span>{images.length}/4 · first image is the cover</span>
                </div>
                <div className="image-sort-grid">
                  {images.map((image, i) => (
                    <div
                      key={image.preview}
                      draggable={!busy}
                      onDragStart={() => setDrag(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (drag !== null) reorder(drag, i);
                        setDrag(null);
                      }}
                    >
                      <img
                        src={image.preview}
                        alt={`Product preview ${i + 1}`}
                      />
                      <span className="image-number">{i + 1}</span>
                      <button
                        type="button"
                        className="image-remove"
                        aria-label={`Remove image ${i + 1}`}
                        onClick={() =>
                          setImages((old) =>
                            old.filter((_, index) => index !== i),
                          )
                        }
                      >
                        <X size={14} />
                      </button>
                      <div className="image-reorder">
                        <button
                          type="button"
                          disabled={i === 0}
                          aria-label={`Move image ${i + 1} earlier`}
                          onClick={() => reorder(i, i - 1)}
                        >
                          <ArrowLeft size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={i === images.length - 1}
                          aria-label={`Move image ${i + 1} later`}
                          onClick={() => reorder(i, i + 1)}
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <label
                  className="image-drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    addFiles(e.dataTransfer.files);
                  }}
                >
                  <ImagePlus size={26} />
                  <strong>Drop your next good look here</strong>
                  <span>
                    or click to browse · JPEG, PNG, WebP · max 5 MB each
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {images.length < 4 && <Upload size={17} />}
                </label>
                {error("images")}
              </div>
            </div>
            {error("form")}
          </fieldset>
          <div className="form-actions">
            <span role="status">
              {progress || "Changes go live when you save."}
            </span>
            <button
              className="admin-secondary"
              type="button"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="button" disabled={busy} type="submit">
              {busy ? "Saving…" : product ? "Save changes" : "Add product"}
              <Plus size={17} />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
