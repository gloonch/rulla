import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/+$/, "");
const TOKEN_KEY = "rulla_admin_token";
const ADMIN_BASE_PATH = (() => {
  const base = (import.meta.env.VITE_BASE_PATH || "/").replace(/^\/+|\/+$/g, "");
  return base ? `/${base}` : "";
})();

const emptyProductForm = {
  id: "",
  slug: "",
  title: "",
  category: "",
  status: "in_progress",
  sortOrder: 0,
  imageId: "",
  fabrics: [""],
  colors: [""],
};

const emptyCategoryForm = {
  slug: "",
  title: "",
  subtitle: "",
  status: "active",
  sortOrder: 0,
};

const emptySectionForm = {
  id: "",
  eyebrow: "",
  title: "",
  subtitle: "",
  ctaLabel: "",
  to: "",
  alt: "",
  imageClassName: "",
  status: "active",
  sortOrder: 0,
};

const navItems = [
  { key: "products", to: "/products", label: "محصولات", shortLabel: "محصول" },
  { key: "categories", to: "/categories", label: "دسته‌بندی‌ها", shortLabel: "دسته" },
  { key: "homepage-sections", to: "/homepage-sections", label: "صفحه اصلی", shortLabel: "خانه" },
  { key: "contact-requests", to: "/contact-requests", label: "پیام‌ها", shortLabel: "پیام" },
  { key: "settings", to: "/settings", label: "تنظیمات", shortLabel: "تنظیم" },
];

const AdminContext = createContext(null);

function apiEndpoint(path) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

async function apiRequest(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(apiEndpoint(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "درخواست انجام نشد.");
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeRoutePath(path) {
  const cleanPath = `/${String(path || "/").replace(/^\/+/, "")}`.replace(/\/+$/, "");
  return cleanPath || "/";
}

function currentAdminPath() {
  let pathname = window.location.pathname || "/";
  if (ADMIN_BASE_PATH && pathname === ADMIN_BASE_PATH) return "/";
  if (ADMIN_BASE_PATH && pathname.startsWith(`${ADMIN_BASE_PATH}/`)) {
    pathname = pathname.slice(ADMIN_BASE_PATH.length) || "/";
  }
  return normalizeRoutePath(pathname);
}

function adminUrl(path) {
  return `${ADMIN_BASE_PATH}${normalizeRoutePath(path)}` || "/";
}

function parseRoute(path) {
  const segments = normalizeRoutePath(path).split("/").filter(Boolean);
  const [section, identifier, action] = segments;

  if (!section) return { section: "products", view: "list" };
  if (section === "products") {
    if (!identifier) return { section, view: "list" };
    if (identifier === "new") return { section, view: "new" };
    if (action === "edit") return { section, view: "edit", id: decodeURIComponent(identifier) };
  }
  if (section === "categories") {
    if (!identifier) return { section, view: "list" };
    if (identifier === "new") return { section, view: "new" };
    if (action === "edit") return { section, view: "edit", slug: decodeURIComponent(identifier) };
  }
  if (section === "homepage-sections") {
    if (!identifier) return { section, view: "list" };
    if (identifier === "new") return { section, view: "new" };
    if (action === "edit") return { section, view: "edit", id: decodeURIComponent(identifier) };
  }
  if (section === "contact-requests" && !identifier) return { section, view: "list" };
  if (section === "settings" && !identifier) return { section, view: "list" };

  return { section: "not-found", view: "not-found" };
}

function useAdminRouter() {
  const [path, setPath] = useState(currentAdminPath);

  const navigate = useCallback((nextPath, options = {}) => {
    const normalized = normalizeRoutePath(nextPath);
    const nextUrl = adminUrl(normalized);
    if (options.replace) {
      window.history.replaceState({}, "", nextUrl);
    } else {
      window.history.pushState({}, "", nextUrl);
    }
    setPath(normalized);
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  useEffect(() => {
    const syncPath = () => setPath(currentAdminPath());
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  return { path, route: parseRoute(path), navigate };
}

function useAdminData() {
  const context = useContext(AdminContext);
  if (!context) throw new Error("AdminContext is missing");
  return context;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function defaultCategorySlug(categories) {
  return categories[0]?.slug || "";
}

function categoryTitle(categories, slug) {
  return categories.find((category) => category.slug === slug)?.title || slug || "بدون دسته‌بندی";
}

function compactList(items) {
  return (items || []).map((item) => item.trim()).filter(Boolean);
}

function truncateText(value, maxLength = 120) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function statusLabel(status) {
  if (status === "draft") return "پیش‌نویس";
  if (status === "active") return "فعال";
  if (status === "in_progress" || status === "published") return "فعال";
  return status || "-";
}

function categoryToForm(category) {
  return {
    slug: category?.slug || "",
    title: category?.title || "",
    subtitle: category?.subtitle || "",
    status: category?.status || "active",
    sortOrder: category?.sortOrder || 0,
  };
}

function categoryFromForm(form) {
  return {
    slug: form.slug.trim(),
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    status: form.status,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

function sectionToForm(section) {
  return {
    id: section?.id || "",
    eyebrow: section?.eyebrow || "",
    title: section?.title || "",
    subtitle: section?.subtitle || "",
    ctaLabel: section?.ctaLabel || "",
    to: section?.to || "",
    alt: section?.alt || "",
    imageClassName: section?.imageClassName || "",
    status: section?.status || "active",
    sortOrder: section?.sortOrder || 0,
  };
}

function sectionFromForm(form) {
  return {
    id: form.id.trim(),
    eyebrow: form.eyebrow.trim(),
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    ctaLabel: form.ctaLabel.trim(),
    to: form.to.trim(),
    alt: form.alt.trim(),
    imageClassName: form.imageClassName.trim(),
    status: form.status,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

function productToForm(product, categories = []) {
  if (!product) return newProductForm(categories);

  return {
    id: product.id || "",
    slug: product.slug || "",
    title: product.title || "",
    category: product.term || defaultCategorySlug(categories),
    status: product.status === "published" ? "in_progress" : product.status || "in_progress",
    sortOrder: product.sortOrder || 0,
    imageId: product.imageId || "",
    fabrics: product.outcomes?.length ? product.outcomes : [""],
    colors: product.audience?.length ? product.audience : [""],
  };
}

function productFromForm(form, categories = []) {
  return {
    id: form.id.trim(),
    slug: form.slug.trim(),
    title: form.title.trim(),
    subtitle: categoryTitle(categories, form.category),
    term: form.category,
    level: "",
    format: "",
    duration: "",
    summary: "",
    description: "",
    status: form.status || "in_progress",
    imageId: form.imageId.trim(),
    sortOrder: Number(form.sortOrder) || 0,
    outcomes: compactList(form.fabrics),
    audience: compactList(form.colors),
    lessons: [],
  };
}

function newProductForm(categories = []) {
  const timestamp = Date.now();
  return {
    ...emptyProductForm,
    id: `product-${timestamp}`,
    slug: `product-${timestamp}`,
    category: defaultCategorySlug(categories),
  };
}

function StatusMessage({ status }) {
  if (!status?.message) return null;
  return <p className={`status-message ${status.type}`} role={status.type === "error" ? "alert" : "status"}>{status.message}</p>;
}

function AdminLink({ to, className = "", children }) {
  const { navigate } = useAdminData();
  return (
    <a
      href={adminUrl(to)}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

function LoginScreen({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const isLoading = status.type === "loading";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "loading", message: "در حال ورود..." });

    try {
      const data = await apiRequest("admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onLogin(data.token);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  return (
    <main className="login-page" dir="rtl">
      <section className="login-card">
        <p className="eyebrow">RULLA ADMIN</p>
        <h1>ورود به پنل مدیریت</h1>
        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            نام کاربری
            <input
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              autoComplete="username"
              required
            />
          </label>
          <label>
            رمز عبور
            <input
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit" className="button primary" disabled={isLoading}>
            {isLoading ? "در حال ورود..." : "ورود"}
          </button>
        </form>
        <StatusMessage status={status} />
      </section>
    </main>
  );
}

function StatBox({ label, value }) {
  return (
    <article className="stat-box">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function PageHeader({ title, eyebrow, description, action }) {
  return (
    <div className="section-header page-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function NotFoundPanel({ title = "موردی پیدا نشد", backTo = "/products", backLabel = "بازگشت" }) {
  return (
    <section className="panel-section">
      <h2>{title}</h2>
      <p className="empty-state">این رکورد در داده‌های فعلی وجود ندارد.</p>
      <div className="form-actions">
        <AdminLink to={backTo} className="button primary">{backLabel}</AdminLink>
      </div>
    </section>
  );
}

function ProductCard({ product, categories, onDelete, busy }) {
  return (
    <article className="product-card">
      <div className="product-thumb">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.title} loading="lazy" /> : <span>بدون تصویر</span>}
      </div>
      <div className="card-copy">
        <p className="product-category">{categoryTitle(categories, product.term)}</p>
        <h3>{product.title || "محصول بدون عنوان"}</h3>
        <p>{product.outcomes?.[0] || "پارچه ثبت نشده"} · {product.audience?.[0] || "رنگ ثبت نشده"}</p>
        <div className="meta-row">
          <span>{statusLabel(product.status)}</span>
          <span>ترتیب {product.sortOrder || 0}</span>
        </div>
      </div>
      <div className="product-actions">
        <AdminLink to={`/products/${encodeURIComponent(product.id)}/edit`} className="button secondary">ویرایش</AdminLink>
        <button type="button" className="button ghost danger" onClick={() => onDelete(product)} disabled={busy}>
          {busy ? "در حال حذف..." : "حذف"}
        </button>
      </div>
    </article>
  );
}

function ProductImagePanel({ selectedId, form, images, imageById, busy, onUploadMain, onUploadGallery, onPickMain, onDeleteImage }) {
  const mainImage = imageById.get(form.imageId);
  const galleryInputRef = useRef(null);

  const handleGalleryChange = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;
    await onUploadGallery(files);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  return (
    <fieldset className="image-panel">
      <legend>تصاویر محصول</legend>
      {!selectedId ? <p className="hint">آپلود تصویر پس از ذخیره محصول فعال می‌شود.</p> : null}

      <div className="image-upload-grid">
        <label>
          تصویر اصلی
          {mainImage ? <img src={mainImage.url} alt={mainImage.alt} className="main-preview" /> : null}
          <input type="file" accept="image/*" onChange={onUploadMain} disabled={!selectedId || busy === "main-image"} />
        </label>

        <label>
          گالری محصول
          <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGalleryChange} disabled={!selectedId || busy === "gallery"} />
        </label>
      </div>

      {images.length ? (
        <div className="image-grid">
          {images.map((image) => (
            <article key={image.id} className={image.id === form.imageId ? "is-main" : ""}>
              <img src={image.url} alt={image.alt || image.filename} loading="lazy" />
              <p>{image.filename}</p>
              <div className="image-actions">
                <button type="button" className="button secondary" onClick={() => onPickMain(image.id)} disabled={image.id === form.imageId}>
                  {image.id === form.imageId ? "تصویر اصلی" : "انتخاب اصلی"}
                </button>
                <button type="button" className="button ghost danger" onClick={() => onDeleteImage(image)} disabled={busy === `image-${image.id}`}>
                  حذف
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}

function ProductListPage() {
  const { products, categories, token, loadData, setStatus, navigate } = useAdminData();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busy, setBusy] = useState("");

  const visibleProducts = useMemo(() => {
    if (categoryFilter === "all") return products;
    return products.filter((product) => product.term === categoryFilter);
  }, [categoryFilter, products]);

  const handleDelete = async (product) => {
    if (!window.confirm(`محصول «${product.title || product.id}» حذف شود؟`)) return;
    setBusy(`delete-${product.id}`);
    try {
      await apiRequest(`admin/courses/${encodeURIComponent(product.id)}`, { method: "DELETE", token });
      await loadData();
      setStatus({ type: "success", message: "محصول حذف شد." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="PRODUCTS"
        title="محصولات"
        action={
          <button type="button" className="button primary" onClick={() => navigate("/products/new")} disabled={!categories.length}>
            محصول جدید
          </button>
        }
      />

      <div className="category-tabs" role="tablist" aria-label="فیلتر دسته‌بندی">
        <button type="button" className={categoryFilter === "all" ? "is-active" : ""} onClick={() => setCategoryFilter("all")}>
          همه
        </button>
        {categories.map((category) => (
          <button
            key={category.slug}
            type="button"
            className={categoryFilter === category.slug ? "is-active" : ""}
            onClick={() => setCategoryFilter(category.slug)}
          >
            {category.title}
          </button>
        ))}
      </div>

      <div className="product-list">
        {visibleProducts.length ? (
          visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              categories={categories}
              onDelete={handleDelete}
              busy={busy === `delete-${product.id}`}
            />
          ))
        ) : (
          <p className="empty-state">{categories.length ? "در این دسته‌بندی هنوز محصولی ثبت نشده است." : "دسته‌بندی موجود نیست."}</p>
        )}
      </div>
    </section>
  );
}

function ProductEditorPage({ productId, isNew }) {
  const { products, categories, token, loadData, setStatus, status, navigate } = useAdminData();
  const selectedProduct = productId ? products.find((product) => product.id === productId) : null;
  const [form, setForm] = useState(() => (isNew ? newProductForm(categories) : productToForm(selectedProduct, categories)));
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState("");
  const imageById = useMemo(() => new Map(images.map((image) => [image.id, image])), [images]);

  useEffect(() => {
    if (isNew) {
      setForm((current) => ({
        ...current,
        category: current.category || defaultCategorySlug(categories),
      }));
      return;
    }
    if (selectedProduct) setForm(productToForm(selectedProduct, categories));
  }, [categories, isNew, selectedProduct]);

  useEffect(() => {
    if (!productId || isNew) {
      setImages([]);
      return undefined;
    }

    let isActive = true;
    apiRequest(`admin/courses/${encodeURIComponent(productId)}/images`, { token })
      .then((data) => {
        if (isActive) setImages(data.images || []);
      })
      .catch((error) => setStatus({ type: "error", message: error.message }));

    return () => {
      isActive = false;
    };
  }, [isNew, productId, setStatus, token]);

  if (!isNew && !selectedProduct && status.type !== "loading") {
    return <NotFoundPanel title="محصول پیدا نشد" backTo="/products" backLabel="بازگشت به محصولات" />;
  }

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const updateList = (field, index, value) => {
    setForm((current) => {
      const items = current[field]?.length ? current[field] : [""];
      return { ...current, [field]: items.map((item, itemIndex) => (itemIndex === index ? value : item)) };
    });
  };

  const refreshImages = async () => {
    if (!productId) return [];
    const data = await apiRequest(`admin/courses/${encodeURIComponent(productId)}/images`, { token });
    setImages(data.images || []);
    return data.images || [];
  };

  const persistProduct = async (nextForm) => {
    if (!productId || isNew) return;
    await apiRequest(`admin/courses/${encodeURIComponent(productId)}`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productFromForm(nextForm, categories)),
    });
    await loadData();
  };

  const uploadImages = async (files, busyKey) => {
    if (!productId || isNew) {
      setStatus({ type: "error", message: "آپلود تصویر پس از ذخیره محصول فعال می‌شود." });
      return [];
    }

    setBusy(busyKey);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("images", file));
      const data = await apiRequest(`admin/courses/${encodeURIComponent(productId)}/images`, {
        method: "POST",
        token,
        body: formData,
      });
      await refreshImages();
      return data.images || [];
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      return [];
    } finally {
      setBusy("");
    }
  };

  const handleMainImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const uploaded = await uploadImages([file], "main-image");
    const image = uploaded[0];
    if (!image) return;

    const nextForm = { ...form, imageId: image.id };
    setForm(nextForm);
    await persistProduct(nextForm);
    setStatus({ type: "success", message: "تصویر اصلی محصول ذخیره شد." });
  };

  const handleGalleryUpload = async (files) => {
    const uploaded = await uploadImages(files, "gallery");
    if (uploaded.length) setStatus({ type: "success", message: "تصاویر گالری ذخیره شدند." });
  };

  const handlePickMain = async (imageId) => {
    const nextForm = { ...form, imageId };
    setForm(nextForm);
    await persistProduct(nextForm);
    setStatus({ type: "success", message: "تصویر اصلی تغییر کرد." });
  };

  const handleDeleteImage = async (image) => {
    if (!productId || !window.confirm(`تصویر «${image.filename || image.id}» حذف شود؟`)) return;
    setBusy(`image-${image.id}`);

    try {
      await apiRequest(`admin/courses/${encodeURIComponent(productId)}/images/${encodeURIComponent(image.id)}`, { method: "DELETE", token });
      const nextForm = { ...form, imageId: form.imageId === image.id ? "" : form.imageId };
      setForm(nextForm);
      await persistProduct(nextForm);
      await refreshImages();
      setStatus({ type: "success", message: "تصویر حذف شد." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async () => {
    if (!productId || !selectedProduct || !window.confirm(`محصول «${selectedProduct.title || productId}» حذف شود؟`)) return;
    setBusy("delete-product");
    try {
      await apiRequest(`admin/courses/${encodeURIComponent(productId)}`, { method: "DELETE", token });
      await loadData();
      setStatus({ type: "success", message: "محصول حذف شد." });
      navigate("/products");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy("save-product");

    try {
      const payload = productFromForm(form, categories);
      await apiRequest(isNew ? "admin/courses" : `admin/courses/${encodeURIComponent(productId)}`, {
        method: isNew ? "POST" : "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadData();
      setStatus({ type: "success", message: "محصول ذخیره شد." });
      navigate("/products");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="PRODUCT"
        title={isNew ? "محصول جدید" : `ویرایش ${selectedProduct?.title || productId}`}
        action={<AdminLink to="/products" className="button secondary">بازگشت به لیست</AdminLink>}
      />

      <form className="admin-form entity-form" onSubmit={handleSave}>
        <div className="form-grid">
          <label>
            عنوان محصول
            <input value={form.title} onChange={updateField("title")} required />
          </label>
          <label>
            اسلاگ
            <input value={form.slug} onChange={updateField("slug")} dir="ltr" required />
          </label>
          <label>
            دسته‌بندی
            <select value={form.category} onChange={updateField("category")} required>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>{category.title}</option>
              ))}
            </select>
          </label>
          <label>
            جنس پارچه
            <input value={form.fabrics[0] || ""} onChange={(event) => updateList("fabrics", 0, event.target.value)} placeholder="مثلاً ساتن" required />
          </label>
          <label>
            رنگ پارچه
            <input value={form.colors[0] || ""} onChange={(event) => updateList("colors", 0, event.target.value)} placeholder="مثلاً مشکی" required />
          </label>
          <label>
            ترتیب
            <input value={form.sortOrder} onChange={updateField("sortOrder")} type="number" />
          </label>
          <label>
            وضعیت
            <select value={form.status} onChange={updateField("status")}>
              <option value="in_progress">فعال</option>
              <option value="draft">پیش‌نویس</option>
            </select>
          </label>
        </div>

        <ProductImagePanel
          selectedId={isNew ? "" : productId}
          form={form}
          images={images}
          imageById={imageById}
          busy={busy}
          onUploadMain={handleMainImageChange}
          onUploadGallery={handleGalleryUpload}
          onPickMain={handlePickMain}
          onDeleteImage={handleDeleteImage}
        />

        <div className="form-actions sticky-actions">
          <button type="submit" className="button primary" disabled={busy === "save-product"}>
            {busy === "save-product" ? "در حال ذخیره..." : "ذخیره و بازگشت"}
          </button>
          {!isNew ? (
            <button type="button" className="button ghost danger" onClick={handleDelete} disabled={busy === "delete-product"}>
              حذف محصول
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function CategoryListPage() {
  const { categories, token, loadData, setStatus, navigate } = useAdminData();
  const [busy, setBusy] = useState("");

  const handleDelete = async (category) => {
    if (!window.confirm(`دسته‌بندی «${category.title || category.slug}» حذف شود؟`)) return;
    setBusy(`delete-category-${category.slug}`);
    try {
      await apiRequest(`admin/categories/${encodeURIComponent(category.slug)}`, { method: "DELETE", token });
      await loadData();
      setStatus({ type: "success", message: "دسته‌بندی حذف شد." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="CATEGORIES"
        title="دسته‌بندی‌ها"
        action={<button type="button" className="button primary" onClick={() => navigate("/categories/new")}>دسته‌بندی جدید</button>}
      />
      <div className="management-list">
        {categories.length ? categories.map((category) => (
          <article key={category.slug} className="management-card">
            <div className="card-copy">
              <h3>{category.title}</h3>
              <p dir="ltr">{category.slug}</p>
              <p>{category.subtitle || "بدون توضیح"}</p>
              <div className="meta-row">
                <span>{statusLabel(category.status)}</span>
                <span>ترتیب {category.sortOrder || 0}</span>
              </div>
            </div>
            <div className="product-actions">
              <AdminLink to={`/categories/${encodeURIComponent(category.slug)}/edit`} className="button secondary">ویرایش</AdminLink>
              <button
                type="button"
                className="button ghost danger"
                onClick={() => handleDelete(category)}
                disabled={busy === `delete-category-${category.slug}`}
              >
                حذف
              </button>
            </div>
          </article>
        )) : <p className="empty-state">هنوز دسته‌بندی ثبت نشده است.</p>}
      </div>
    </section>
  );
}

function CategoryEditorPage({ slug, isNew }) {
  const { categories, token, loadData, setStatus, status, navigate } = useAdminData();
  const selectedCategory = slug ? categories.find((category) => category.slug === slug) : null;
  const [form, setForm] = useState(() => (isNew ? emptyCategoryForm : categoryToForm(selectedCategory)));
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (isNew) return;
    if (selectedCategory) setForm(categoryToForm(selectedCategory));
  }, [isNew, selectedCategory]);

  if (!isNew && !selectedCategory && status.type !== "loading") {
    return <NotFoundPanel title="دسته‌بندی پیدا نشد" backTo="/categories" backLabel="بازگشت به دسته‌بندی‌ها" />;
  }

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy("save-category");
    try {
      const payload = categoryFromForm(form);
      await apiRequest(isNew ? "admin/categories" : `admin/categories/${encodeURIComponent(slug)}`, {
        method: isNew ? "POST" : "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadData();
      setStatus({ type: "success", message: "دسته‌بندی ذخیره شد." });
      navigate("/categories");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async () => {
    if (!slug || !selectedCategory || !window.confirm(`دسته‌بندی «${selectedCategory.title || slug}» حذف شود؟`)) return;
    setBusy("delete-category");
    try {
      await apiRequest(`admin/categories/${encodeURIComponent(slug)}`, { method: "DELETE", token });
      await loadData();
      setStatus({ type: "success", message: "دسته‌بندی حذف شد." });
      navigate("/categories");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="CATEGORY"
        title={isNew ? "دسته‌بندی جدید" : `ویرایش ${selectedCategory?.title || slug}`}
        action={<AdminLink to="/categories" className="button secondary">بازگشت به لیست</AdminLink>}
      />
      <form className="admin-form entity-form" onSubmit={handleSave}>
        <div className="form-grid">
          <label>
            نام
            <input value={form.title} onChange={updateField("title")} required />
          </label>
          <label>
            اسلاگ
            <input value={form.slug} onChange={updateField("slug")} dir="ltr" required />
          </label>
          <label>
            ترتیب
            <input value={form.sortOrder} onChange={updateField("sortOrder")} type="number" />
          </label>
          <label>
            وضعیت
            <select value={form.status} onChange={updateField("status")}>
              <option value="active">فعال</option>
              <option value="draft">پیش‌نویس</option>
            </select>
          </label>
          <label className="full-field">
            توضیح کوتاه
            <input value={form.subtitle} onChange={updateField("subtitle")} />
          </label>
        </div>
        <div className="form-actions sticky-actions">
          <button type="submit" className="button primary" disabled={busy === "save-category"}>
            ذخیره و بازگشت
          </button>
          {!isNew ? (
            <button type="button" className="button ghost danger" onClick={handleDelete} disabled={busy === "delete-category"}>
              حذف دسته‌بندی
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function HomepageSectionListPage() {
  const { homepageSections, token, loadData, setStatus, navigate } = useAdminData();
  const [busy, setBusy] = useState("");

  const handleDelete = async (section) => {
    if (!window.confirm(`بخش «${section.title || section.id}» حذف شود؟`)) return;
    setBusy(`delete-section-${section.id}`);
    try {
      await apiRequest(`admin/homepage-sections/${encodeURIComponent(section.id)}`, { method: "DELETE", token });
      await loadData();
      setStatus({ type: "success", message: "بخش صفحه اصلی حذف شد." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="HOMEPAGE"
        title="بخش‌های صفحه اصلی"
        action={<button type="button" className="button primary" onClick={() => navigate("/homepage-sections/new")}>بخش جدید</button>}
      />
      <div className="management-list">
        {homepageSections.length ? homepageSections.map((section) => (
          <article key={section.id} className="management-card with-thumb">
            <div className="section-thumb">
              {section.imageUrl ? <img src={section.imageUrl} alt={section.alt || section.title} loading="lazy" /> : <span>بدون تصویر</span>}
            </div>
            <div className="card-copy">
              <h3>{section.title}</h3>
              <p dir="ltr">{section.id}</p>
              <p>{section.ctaLabel || "بدون دکمه"} · {section.to || "بدون لینک"}</p>
              <div className="meta-row">
                <span>{statusLabel(section.status)}</span>
                <span>ترتیب {section.sortOrder || 0}</span>
              </div>
            </div>
            <div className="product-actions">
              <AdminLink to={`/homepage-sections/${encodeURIComponent(section.id)}/edit`} className="button secondary">ویرایش</AdminLink>
              <button
                type="button"
                className="button ghost danger"
                onClick={() => handleDelete(section)}
                disabled={busy === `delete-section-${section.id}`}
              >
                حذف
              </button>
            </div>
          </article>
        )) : <p className="empty-state">هنوز بخشی برای صفحه اصلی ثبت نشده است.</p>}
      </div>
    </section>
  );
}

function HomepageSectionEditorPage({ sectionId, isNew }) {
  const { homepageSections, token, loadData, setStatus, status, navigate } = useAdminData();
  const selectedSection = sectionId ? homepageSections.find((section) => section.id === sectionId) : null;
  const [form, setForm] = useState(() => {
    if (!isNew) return sectionToForm(selectedSection);
    return { ...emptySectionForm, id: `section-${Date.now()}` };
  });
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (isNew) return;
    if (selectedSection) setForm(sectionToForm(selectedSection));
  }, [isNew, selectedSection]);

  if (!isNew && !selectedSection && status.type !== "loading") {
    return <NotFoundPanel title="بخش صفحه اصلی پیدا نشد" backTo="/homepage-sections" backLabel="بازگشت به صفحه اصلی" />;
  }

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy("save-section");
    try {
      const payload = sectionFromForm(form);
      await apiRequest(isNew ? "admin/homepage-sections" : `admin/homepage-sections/${encodeURIComponent(sectionId)}`, {
        method: isNew ? "POST" : "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await loadData();
      setStatus({ type: "success", message: "بخش صفحه اصلی ذخیره شد." });
      navigate("/homepage-sections");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !sectionId || isNew) {
      if (file) setStatus({ type: "error", message: "آپلود تصویر پس از ذخیره بخش فعال می‌شود." });
      return;
    }
    setBusy("section-image");
    try {
      const formData = new FormData();
      formData.append("image", file);
      await apiRequest(`admin/homepage-sections/${encodeURIComponent(sectionId)}/image`, {
        method: "POST",
        token,
        body: formData,
      });
      await loadData();
      setStatus({ type: "success", message: "تصویر بخش ذخیره شد." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
      event.target.value = "";
    }
  };

  const handleImageDelete = async () => {
    if (!sectionId || !selectedSection || !window.confirm(`تصویر بخش «${selectedSection.title || sectionId}» حذف شود؟`)) return;
    setBusy("section-image-delete");
    try {
      await apiRequest(`admin/homepage-sections/${encodeURIComponent(sectionId)}/image`, {
        method: "DELETE",
        token,
      });
      await loadData();
      setStatus({ type: "success", message: "تصویر بخش حذف شد." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async () => {
    if (!sectionId || !selectedSection || !window.confirm(`بخش «${selectedSection.title || sectionId}» حذف شود؟`)) return;
    setBusy("delete-section");
    try {
      await apiRequest(`admin/homepage-sections/${encodeURIComponent(sectionId)}`, { method: "DELETE", token });
      await loadData();
      setStatus({ type: "success", message: "بخش صفحه اصلی حذف شد." });
      navigate("/homepage-sections");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="HOMEPAGE SECTION"
        title={isNew ? "بخش جدید" : `ویرایش ${selectedSection?.title || sectionId}`}
        action={<AdminLink to="/homepage-sections" className="button secondary">بازگشت به لیست</AdminLink>}
      />
      <form className="admin-form entity-form" onSubmit={handleSave}>
        <div className="form-grid">
          <label>
            شناسه
            <input value={form.id} onChange={updateField("id")} dir="ltr" required disabled={!isNew} />
          </label>
          <label>
            عنوان
            <input value={form.title} onChange={updateField("title")} required />
          </label>
          <label className="full-field">
            توضیح کوتاه
            <textarea value={form.subtitle} onChange={updateField("subtitle")} rows={3} />
          </label>
          <label>
            برچسب کوچک
            <input value={form.eyebrow} onChange={updateField("eyebrow")} />
          </label>
          <label>
            متن دکمه
            <input value={form.ctaLabel} onChange={updateField("ctaLabel")} />
          </label>
          <label>
            لینک
            <input value={form.to} onChange={updateField("to")} dir="ltr" required />
          </label>
          <label>
            متن جایگزین تصویر
            <input value={form.alt} onChange={updateField("alt")} />
          </label>
          <label>
            ترتیب
            <input value={form.sortOrder} onChange={updateField("sortOrder")} type="number" />
          </label>
          <label>
            وضعیت
            <select value={form.status} onChange={updateField("status")}>
              <option value="active">فعال</option>
              <option value="draft">پیش‌نویس</option>
            </select>
          </label>
          <label>
            کلاس تصویر
            <input value={form.imageClassName} onChange={updateField("imageClassName")} dir="ltr" />
          </label>
        </div>

        <fieldset className="image-panel">
          <legend>تصویر بخش</legend>
          {selectedSection?.imageUrl ? <img className="main-preview" src={selectedSection.imageUrl} alt={selectedSection.alt || selectedSection.title} /> : null}
          <div className="form-actions">
            <label className="button secondary file-button">
              آپلود تصویر
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isNew || busy === "section-image"} />
            </label>
            {selectedSection?.imageUrl ? (
              <button type="button" className="button ghost danger" onClick={handleImageDelete} disabled={busy === "section-image-delete"}>
                حذف تصویر
              </button>
            ) : null}
          </div>
          {isNew ? <p className="hint">آپلود تصویر پس از ذخیره بخش فعال می‌شود.</p> : null}
        </fieldset>

        <div className="form-actions sticky-actions">
          <button type="submit" className="button primary" disabled={busy === "save-section"}>
            ذخیره و بازگشت
          </button>
          {!isNew ? (
            <button type="button" className="button ghost danger" onClick={handleDelete} disabled={busy === "delete-section"}>
              حذف بخش
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function ContactRequestsPage() {
  const { contactRequests, token, loadData, setStatus } = useAdminData();
  const [deleting, setDeleting] = useState("");

  const deleteContactRequest = async (request) => {
    if (!window.confirm(`پیام «${request.fullName || request.contact}» حذف شود؟`)) return;

    setDeleting(request.id);
    try {
      await apiRequest(`admin/contact-requests/${encodeURIComponent(request.id)}`, { method: "DELETE", token });
      await loadData();
      setStatus({ type: "success", message: "پیام حذف شد." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setDeleting("");
    }
  };

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="REQUESTS"
        title="پیام‌ها و درخواست‌ها"
      />
      <div className="message-list">
        {contactRequests.length ? contactRequests.map((request) => (
          <article key={request.id} className="message-card">
            <div className="card-copy">
              <h3>{request.fullName || "بدون نام"}</h3>
              <p dir="ltr">{request.contact}</p>
              <p>{truncateText(request.message, 180)}</p>
              <div className="meta-row">
                <span>{formatDate(request.createdAt)}</span>
              </div>
            </div>
            <div className="product-actions">
              <button type="button" className="button ghost danger" onClick={() => deleteContactRequest(request)} disabled={deleting === request.id}>
                {deleting === request.id ? "در حال حذف..." : "حذف"}
              </button>
            </div>
          </article>
        )) : <p className="empty-state">هنوز پیامی ثبت نشده است.</p>}
      </div>
    </section>
  );
}

function SettingsPage({ onLogout }) {
  const { products, categories, homepageSections, contactRequests, loadData, status } = useAdminData();
  const isLoading = status.type === "loading";

  return (
    <section className="panel-section">
      <PageHeader
        eyebrow="SETTINGS"
        title="تنظیمات"
      />
      <div className="settings-grid">
        <article className="settings-card">
          <h3>وضعیت session</h3>
          <p>Session فعال است.</p>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={loadData} disabled={isLoading}>
              {isLoading ? "در حال دریافت..." : "به‌روزرسانی داده‌ها"}
            </button>
            <button type="button" className="button ghost" onClick={onLogout}>
              خروج
            </button>
          </div>
        </article>
        <article className="settings-card">
          <h3>خلاصه محتوا</h3>
          <p>{products.length} محصول، {categories.length} دسته‌بندی، {homepageSections.length} بخش صفحه اصلی، {contactRequests.length} پیام.</p>
        </article>
        <article className="settings-card">
          <h3>سایت عمومی</h3>
          <p>لینک سایت عمومی</p>
          <a href="/" target="_blank" rel="noreferrer" className="button primary">باز کردن سایت</a>
        </article>
      </div>
    </section>
  );
}

function AdminNavigation() {
  const { path } = useAdminData();
  const activeSection = parseRoute(path).section;

  return (
    <>
      <nav className="admin-tabs" aria-label="بخش‌های پنل مدیریت">
        {navItems.map((item) => (
          <AdminLink key={item.key} to={item.to} className={activeSection === item.key ? "is-active" : ""}>
            {item.label}
          </AdminLink>
        ))}
      </nav>
      <nav className="admin-bottom-nav" aria-label="منوی پایین پنل">
        {navItems.map((item) => (
          <AdminLink key={item.key} to={item.to} className={activeSection === item.key ? "is-active" : ""}>
            <span>{item.shortLabel}</span>
          </AdminLink>
        ))}
      </nav>
    </>
  );
}

function AdminContent({ route, onLogout }) {
  if (route.section === "products" && route.view === "list") return <ProductListPage />;
  if (route.section === "products" && route.view === "new") return <ProductEditorPage isNew />;
  if (route.section === "products" && route.view === "edit") return <ProductEditorPage productId={route.id} />;

  if (route.section === "categories" && route.view === "list") return <CategoryListPage />;
  if (route.section === "categories" && route.view === "new") return <CategoryEditorPage isNew />;
  if (route.section === "categories" && route.view === "edit") return <CategoryEditorPage slug={route.slug} />;

  if (route.section === "homepage-sections" && route.view === "list") return <HomepageSectionListPage />;
  if (route.section === "homepage-sections" && route.view === "new") return <HomepageSectionEditorPage isNew />;
  if (route.section === "homepage-sections" && route.view === "edit") return <HomepageSectionEditorPage sectionId={route.id} />;

  if (route.section === "contact-requests") return <ContactRequestsPage />;
  if (route.section === "settings") return <SettingsPage onLogout={onLogout} />;

  return <NotFoundPanel title="صفحه پیدا نشد" backTo="/products" backLabel="بازگشت به محصولات" />;
}

function Dashboard({ token, onLogout }) {
  const { path, route, navigate } = useAdminRouter();
  const [contactRequests, setContactRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [homepageSections, setHomepageSections] = useState([]);
  const [status, setStatus] = useState({ type: "loading", message: "" });

  const loadData = useCallback(async () => {
    setStatus({ type: "loading", message: "در حال دریافت اطلاعات..." });

    try {
      const [contactsData, productsData, categoriesData, sectionsData] = await Promise.all([
        apiRequest("admin/contact-requests", { token }),
        apiRequest("admin/courses", { token }),
        apiRequest("admin/categories", { token }),
        apiRequest("admin/homepage-sections", { token }),
      ]);

      setContactRequests(contactsData.contactRequests || []);
      setProducts(productsData.courses || []);
      setCategories(categoriesData.categories || []);
      setHomepageSections(sectionsData.sections || []);
      setStatus({ type: "idle", message: "" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      if (error.message.includes("ادمین")) onLogout();
    }
  }, [onLogout, token]);

  useEffect(() => {
    if (path === "/") navigate("/products", { replace: true });
  }, [navigate, path]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const contextValue = useMemo(() => ({
    path,
    route,
    navigate,
    token,
    contactRequests,
    products,
    categories,
    homepageSections,
    status,
    setStatus,
    loadData,
  }), [categories, contactRequests, homepageSections, loadData, navigate, path, products, route, status, token]);

  const isLoading = status.type === "loading";

  return (
    <AdminContext.Provider value={contextValue}>
      <main className="admin-shell" dir="rtl">
        <header className="admin-header">
          <div>
            <p className="eyebrow">RULLA ADMIN</p>
            <h1>مدیریت محتوای سایت</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="button secondary" onClick={loadData} disabled={isLoading}>
              {isLoading ? "در حال دریافت..." : "به‌روزرسانی"}
            </button>
            <button type="button" className="button ghost" onClick={onLogout}>
              خروج
            </button>
          </div>
        </header>

        <AdminNavigation />
        <StatusMessage status={status} />

        <section className="stats-grid" aria-label="آمار">
          <StatBox label="کل محصولات" value={products.length} />
          <StatBox label="محصول فعال" value={products.filter((product) => product.status !== "draft").length} />
          <StatBox label="دسته‌بندی" value={categories.length} />
          <StatBox label="پیام دریافتی" value={contactRequests.length} />
        </section>

        <AdminContent route={route} onLogout={onLogout} />
      </main>
    </AdminContext.Provider>
  );
}

export default function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) || "");

  const handleLogin = (nextToken) => {
    window.localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken("");
  };

  if (!token) return <LoginScreen onLogin={handleLogin} />;
  return <Dashboard token={token} onLogout={handleLogout} />;
}
