import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/+$/, "");
const TOKEN_KEY = "rulla_admin_token";

const productCategories = [
  { slug: "shomiz", title: "شومیز" },
  { slug: "shalvar", title: "شلوار" },
  { slug: "top", title: "تاپ" },
  { slug: "coat", title: "کت" },
  { slug: "evening-dress", title: "لباس مجلسی" },
];

const emptyProductForm = {
  id: "",
  slug: "",
  title: "",
  category: "shomiz",
  status: "in_progress",
  sortOrder: 0,
  imageId: "",
  fabrics: [""],
  colors: [""],
};

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

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function categoryTitle(slug) {
  return productCategories.find((category) => category.slug === slug)?.title || slug || "بدون دسته‌بندی";
}

function compactList(items) {
  return items.map((item) => item.trim()).filter(Boolean);
}

function productToForm(product) {
  if (!product) return { ...emptyProductForm };

  return {
    id: product.id || "",
    slug: product.slug || "",
    title: product.title || "",
    category: product.term || "shomiz",
    status: product.status === "published" ? "in_progress" : product.status || "in_progress",
    sortOrder: product.sortOrder || 0,
    imageId: product.imageId || "",
    fabrics: product.outcomes?.length ? product.outcomes : [""],
    colors: product.audience?.length ? product.audience : [""],
  };
}

function productFromForm(form) {
  return {
    id: form.id.trim(),
    slug: form.slug.trim(),
    title: form.title.trim(),
    subtitle: categoryTitle(form.category),
    term: form.category,
    level: "",
    format: "",
    duration: "",
    summary: "",
    description: "",
    status: "in_progress",
    imageId: form.imageId.trim(),
    sortOrder: Number(form.sortOrder) || 0,
    outcomes: compactList(form.fabrics),
    audience: compactList(form.colors),
    lessons: [],
  };
}

function newProductForm() {
  const timestamp = Date.now();
  return {
    ...emptyProductForm,
    id: `product-${timestamp}`,
    slug: `product-${timestamp}`,
  };
}

function StatusMessage({ status }) {
  if (!status?.message) return null;
  return <p className={`status-message ${status.type}`} role={status.type === "error" ? "alert" : "status"}>{status.message}</p>;
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

function ProductCard({ product, onEdit, onDelete, busy }) {
  return (
    <article className="product-card">
      <div className="product-thumb">
        {product.imageUrl ? <img src={product.imageUrl} alt={product.title} loading="lazy" /> : <span>بدون تصویر</span>}
      </div>
      <div>
        <p className="product-category">{categoryTitle(product.term)}</p>
        <h3>{product.title || "محصول بدون عنوان"}</h3>
        <p>{product.outcomes?.[0] || "پارچه ثبت نشده"} · {product.audience?.[0] || "رنگ ثبت نشده"}</p>
      </div>
      <div className="product-actions">
        <button type="button" className="button secondary" onClick={() => onEdit(product)}>
          ویرایش
        </button>
        <button type="button" className="button ghost danger" onClick={() => onDelete(product.id)} disabled={busy}>
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
      {!selectedId ? <p className="hint">برای آپلود تصویر، اول محصول را ذخیره کنید.</p> : null}

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
                <button type="button" className="button ghost danger" onClick={() => onDeleteImage(image.id)} disabled={busy === `image-${image.id}`}>
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

function ProductManager({ products, token, onReload, onStatus }) {
  const [selectedId, setSelectedId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [form, setForm] = useState(() => newProductForm());
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const selectedProduct = selectedId ? products.find((product) => product.id === selectedId) : null;
  const visibleProducts = useMemo(() => {
    if (categoryFilter === "all") return products;
    return products.filter((product) => product.term === categoryFilter);
  }, [categoryFilter, products]);
  const imageById = useMemo(() => new Map(images.map((image) => [image.id, image])), [images]);

  useEffect(() => {
    if (!selectedId) {
      setImages([]);
      return undefined;
    }

    let isActive = true;

    apiRequest(`admin/courses/${selectedId}/images`, { token })
      .then((data) => {
        if (isActive) setImages(data.images || []);
      })
      .catch((error) => onStatus({ type: "error", message: error.message }));

    return () => {
      isActive = false;
    };
  }, [selectedId, token, onStatus]);

  useEffect(() => {
    if (!selectedId || !selectedProduct) return;
    setForm(productToForm(selectedProduct));
  }, [selectedId, selectedProduct]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateList = (field, index, value) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const refreshImages = async (productId) => {
    const data = await apiRequest(`admin/courses/${productId}/images`, { token });
    setImages(data.images || []);
    return data.images || [];
  };

  const persistProduct = async (nextForm) => {
    if (!selectedId) return;
    await apiRequest(`admin/courses/${selectedId}`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productFromForm(nextForm)),
    });
    await onReload();
  };

  const uploadImages = async (files, busyKey) => {
    if (!selectedId) {
      onStatus({ type: "error", message: "ابتدا محصول را ذخیره کنید." });
      return [];
    }

    setBusy(busyKey);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("images", file));
      const data = await apiRequest(`admin/courses/${selectedId}/images`, {
        method: "POST",
        token,
        body: formData,
      });
      await refreshImages(selectedId);
      return data.images || [];
    } catch (error) {
      onStatus({ type: "error", message: error.message });
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
    onStatus({ type: "success", message: "تصویر اصلی محصول ذخیره شد." });
  };

  const handleGalleryUpload = async (files) => {
    const uploaded = await uploadImages(files, "gallery");
    if (uploaded.length) onStatus({ type: "success", message: "تصاویر گالری ذخیره شدند." });
  };

  const handlePickMain = async (imageId) => {
    const nextForm = { ...form, imageId };
    setForm(nextForm);
    await persistProduct(nextForm);
    onStatus({ type: "success", message: "تصویر اصلی تغییر کرد." });
  };

  const handleDeleteImage = async (imageId) => {
    if (!selectedId || !window.confirm("این تصویر حذف شود؟")) return;
    setBusy(`image-${imageId}`);

    try {
      await apiRequest(`admin/courses/${selectedId}/images/${imageId}`, { method: "DELETE", token });
      const nextForm = { ...form, imageId: form.imageId === imageId ? "" : form.imageId };
      setForm(nextForm);
      await persistProduct(nextForm);
      await refreshImages(selectedId);
      onStatus({ type: "success", message: "تصویر حذف شد." });
    } catch (error) {
      onStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setBusy("save");

    try {
      const payload = productFromForm(form);
      const data = selectedId
        ? await apiRequest(`admin/courses/${selectedId}`, {
            method: "PUT",
            token,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await apiRequest("admin/courses", {
            method: "POST",
            token,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const saved = data.course;
      setSelectedId(saved.id);
      setForm(productToForm(saved));
      setIsFormOpen(true);
      await onReload();
      onStatus({ type: "success", message: "محصول ذخیره شد." });
    } catch (error) {
      onStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  const handleNew = () => {
    setSelectedId("");
    setImages([]);
    setForm(newProductForm());
    setIsFormOpen(true);
  };

  const handleEdit = (product) => {
    setSelectedId(product.id);
    setForm(productToForm(product));
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setSelectedId("");
    setImages([]);
    setForm(newProductForm());
    setIsFormOpen(false);
  };

  const handleDelete = async (productId = selectedId) => {
    if (!productId || !window.confirm("این محصول حذف شود؟")) return;
    setBusy(`delete-${productId}`);

    try {
      await apiRequest(`admin/courses/${productId}`, { method: "DELETE", token });
      if (productId === selectedId) handleCancel();
      await onReload();
      onStatus({ type: "success", message: "محصول حذف شد." });
    } catch (error) {
      onStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="panel-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">PRODUCTS</p>
          <h2>محصولات</h2>
        </div>
        <button type="button" className="button primary" onClick={handleNew}>
          محصول جدید
        </button>
      </div>

      <div className="category-tabs" role="tablist" aria-label="فیلتر دسته‌بندی">
        <button type="button" className={categoryFilter === "all" ? "is-active" : ""} onClick={() => setCategoryFilter("all")}>
          همه
        </button>
        {productCategories.map((category) => (
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
              onEdit={handleEdit}
              onDelete={handleDelete}
              busy={busy === `delete-${product.id}`}
            />
          ))
        ) : (
          <p className="empty-state">در این دسته‌بندی هنوز محصولی ثبت نشده است.</p>
        )}
      </div>

      {isFormOpen ? (
        <form className="admin-form product-form" onSubmit={handleSave}>
          <div className="form-title-row">
            <h3>{selectedProduct ? `ویرایش ${selectedProduct.title}` : "محصول جدید"}</h3>
            <button type="button" className="button ghost" onClick={handleCancel}>
              بستن فرم
            </button>
          </div>

          <div className="form-grid">
            <label>
              عنوان محصول
              <input value={form.title} onChange={updateField("title")} required />
            </label>
            <label>
              دسته‌بندی
              <select value={form.category} onChange={updateField("category")}>
                {productCategories.map((category) => (
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
          </div>

          <ProductImagePanel
            selectedId={selectedId}
            form={form}
            images={images}
            imageById={imageById}
            busy={busy}
            onUploadMain={handleMainImageChange}
            onUploadGallery={handleGalleryUpload}
            onPickMain={handlePickMain}
            onDeleteImage={handleDeleteImage}
          />

          <div className="form-actions">
            <button type="submit" className="button primary" disabled={busy === "save"}>
              {busy === "save" ? "در حال ذخیره..." : "ذخیره محصول"}
            </button>
            {selectedId ? (
              <button type="button" className="button ghost danger" onClick={() => handleDelete()} disabled={busy === `delete-${selectedId}`}>
                حذف محصول
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ContactRequestsTable({ requests, onDelete, deletingId }) {
  return (
    <section className="panel-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">REQUESTS</p>
          <h2>پیام‌ها و درخواست‌ها</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>نام</th>
              <th>شماره</th>
              <th>پیام</th>
              <th>تاریخ</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {requests.length ? (
              requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.fullName}</td>
                  <td dir="ltr">{request.contact}</td>
                  <td>{request.message}</td>
                  <td>{formatDate(request.createdAt)}</td>
                  <td>
                    <button type="button" className="button ghost danger" onClick={() => onDelete(request.id)} disabled={deletingId === request.id}>
                      {deletingId === request.id ? "در حال حذف..." : "حذف"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>هنوز پیامی ثبت نشده است.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Dashboard({ token, onLogout }) {
  const [contactRequests, setContactRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState({ type: "loading", message: "" });
  const [deleting, setDeleting] = useState("");

  const headers = useMemo(() => ({ token }), [token]);

  const loadData = async () => {
    setStatus({ type: "loading", message: "در حال دریافت اطلاعات..." });

    try {
      const [contactsData, productsData] = await Promise.all([
        apiRequest("admin/contact-requests", headers),
        apiRequest("admin/courses", headers),
      ]);

      setContactRequests(contactsData.contactRequests || []);
      setProducts(productsData.courses || []);
      setStatus({ type: "idle", message: "" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      if (error.message.includes("ادمین")) onLogout();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const deleteContactRequest = async (id) => {
    if (!window.confirm("این پیام حذف شود؟")) return;

    setDeleting(id);
    try {
      await apiRequest(`admin/contact-requests/${id}`, { method: "DELETE", token });
      await loadData();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setDeleting("");
    }
  };

  return (
    <main className="admin-shell" dir="rtl">
      <header className="admin-header">
        <div>
          <p className="eyebrow">RULLA ADMIN</p>
          <h1>مدیریت محصولات</h1>
          <p>محصولات را فقط با نام، دسته‌بندی، پارچه، رنگ و تصویر ثبت کنید.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="button secondary" onClick={loadData}>
            به‌روزرسانی
          </button>
          <button type="button" className="button ghost" onClick={onLogout}>
            خروج
          </button>
        </div>
      </header>

      <StatusMessage status={status} />

      <section className="stats-grid" aria-label="آمار">
        <StatBox label="کل محصولات" value={products.length} />
        <StatBox label="محصول فعال" value={products.filter((product) => product.status !== "draft").length} />
        <StatBox label="پیام دریافتی" value={contactRequests.length} />
      </section>

      <ProductManager products={products} token={token} onReload={loadData} onStatus={setStatus} />
      <ContactRequestsTable requests={contactRequests} deletingId={deleting} onDelete={deleteContactRequest} />
    </main>
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
