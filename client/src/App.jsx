import React, { createContext, useContext, useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import collectionImage from "./assets/rulla-collection.png";
import heroImage from "./assets/rulla-hero.png";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1").replace(/\/+$/, "");
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;
const BUSINESS_PHONE = "09909038432";
const WHATSAPP_URL = "https://wa.me/989909038432";
const SMOOTH_SCROLL_MULTIPLIER = 1.5;

const orderSteps = [
  "انتخاب مدل",
  "ثبت اندازه‌ها",
  "انتخاب پارچه و رنگ",
  "پرداخت بیعانه",
  "دوخت و پرو",
  "تحویل نهایی",
];

const measurementGuides = [
  ["دور سینه", "متر از برجسته‌ترین قسمت سینه عبور کند و کاملاً افقی بماند."],
  ["دور کمر", "باریک‌ترین قسمت کمر را بدون فشار اندازه بگیرید."],
  ["دور باسن", "برجسته‌ترین قسمت باسن معیار اصلی است."],
  ["سرشانه", "از انتهای یک سرشانه تا انتهای سرشانه دیگر."],
  ["قد آستین", "از سرشانه تا مچ، با کمی خم بودن آرنج."],
  ["قد لباس", "از بالاترین نقطه سرشانه تا قد نهایی مورد نظر."],
];

const reviews = [
  {
    name: "سارا",
    category: "سفارش شومیز",
    rating: "★★★★★",
    text: "کاملاً مطابق اندازه‌هام دوخته شد. یقه و سرشانه دقیق بود و پارچه همان چیزی بود که می‌خواستم.",
    fit: "تنخور: عالی",
  },
  {
    name: "نازنین",
    category: "لباس مجلسی",
    rating: "★★★★★",
    text: "برای مراسم سفارش دادم. زمان تحویل دقیق بود و بعد از پرو، اصلاح نهایی خیلی تمیز انجام شد.",
    fit: "تحویل: دقیق",
  },
  {
    name: "مهسا",
    category: "کت کوتاه",
    rating: "★★★★☆",
    text: "مدل را از روی یک ایده انتخاب کردم و جزئیات دکمه و قد آستین با مشاوره نهایی شد.",
    fit: "تنخور: کمی آزاد",
  },
];

const SCROLL_REVEAL_SELECTOR = [
  ".hero-image",
  ".hero-copy > *",
  ".visual-section__content > *",
  ".process-editorial > *",
  ".section > *",
  ".page-main > *",
  ".section-heading > *",
  ".category-card",
  ".split-section > *",
  ".service-list > li",
  ".step-list > li",
  ".product-card",
  ".review-item",
  ".review-grid > *",
  ".product-grid > *",
  ".appointment-cta > *",
  ".page-intro > *",
  ".page-category-stack > *",
  ".product-detail > *",
  ".product-info > *",
  ".rulla-form > *",
  ".measurement-guide > article",
  ".about-section > *",
  ".site-footer > *",
  ".footer-column",
].join(",");

const RevealReadyContext = createContext({
  shouldPrepareReveal: false,
  shouldRunReveal: false,
});

const SiteContentContext = createContext({
  categories: [],
  products: [],
  homepageSections: [],
  status: { type: "loading", message: "" },
});

function apiEndpoint(path) {
  return `${API_BASE_URL}/${path.replace(/^\/+/, "")}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(apiEndpoint(path), options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "دریافت اطلاعات انجام نشد.");
  }
  return response.json();
}

function useSiteContent() {
  return useContext(SiteContentContext);
}

function normalizeProduct(product) {
  return {
    ...product,
    category: product.term || "",
    fabrics: product.outcomes?.length ? product.outcomes : ["سفارشی"],
    colors: product.audience?.length ? product.audience : ["سفارشی"],
    image: product.imageUrl || collectionImage,
  };
}

function normalizeHomepageSection(section) {
  return {
    ...section,
    cta: section.ctaLabel || "",
    image: section.imageUrl || (section.id === "hero" ? heroImage : collectionImage),
  };
}

function SiteContentProvider({ children }) {
  const [content, setContent] = useState({
    categories: [],
    products: [],
    homepageSections: [],
    status: { type: "loading", message: "در حال دریافت اطلاعات..." },
  });

  useEffect(() => {
    let isActive = true;

    Promise.all([
      apiRequest("categories"),
      apiRequest("courses"),
      apiRequest("homepage-sections"),
    ])
      .then(([categoriesData, productsData, sectionsData]) => {
        if (!isActive) return;
        setContent({
          categories: categoriesData.categories || [],
          products: (productsData.courses || []).map(normalizeProduct),
          homepageSections: (sectionsData.sections || []).map(normalizeHomepageSection),
          status: { type: "idle", message: "" },
        });
      })
      .catch((error) => {
        if (!isActive) return;
        setContent((current) => ({
          ...current,
          status: { type: "error", message: error.message },
        }));
      });

    return () => {
      isActive = false;
    };
  }, []);

  return <SiteContentContext.Provider value={content}>{children}</SiteContentContext.Provider>;
}

function ContentStateNotice() {
  const { status } = useSiteContent();
  if (status.type === "idle") return null;
  return <StatusMessage status={status} />;
}

function normalizeDigits(value) {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function validatePhoneNumber(value) {
  const phone = normalizeDigits(value.trim());

  if (!phone) {
    return { error: "شماره تلفن الزامی است." };
  }

  if (!/^[0-9]+$/.test(phone)) {
    return { error: "شماره تلفن باید فقط شامل عدد باشد." };
  }

  return { phone };
}

function StatusMessage({ status }) {
  if (!status?.message) return null;
  return <p className={`status-message ${status.type}`} role={status.type === "error" ? "alert" : "status"}>{status.message}</p>;
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = decodeURIComponent(hash.slice(1));
      window.requestAnimationFrame(() => {
        const target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.scrollTo({ top: 0, left: 0 });
        }
      });
      return;
    }

    window.scrollTo({ top: 0, left: 0 });
  }, [pathname, hash]);

  return null;
}

function SmoothScrollController() {
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let targetY = window.scrollY;
    let currentY = targetY;
    let rafId = 0;

    const maxScrollY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const scrollToInstant = (top) => {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, top);
      root.style.scrollBehavior = previousBehavior;
    };

    const animate = () => {
      currentY += (targetY - currentY) * 0.14;

      if (Math.abs(targetY - currentY) > 0.6) {
        scrollToInstant(currentY);
        rafId = window.requestAnimationFrame(animate);
        return;
      }

      scrollToInstant(targetY);
      currentY = targetY;
      rafId = 0;
    };

    const normalizeWheelDelta = (event) => {
      if (event.deltaMode === 1) return event.deltaY * 16;
      if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
      return event.deltaY;
    };

    const shouldUseNativeScroll = (event) => {
      if (reducedMotionQuery.matches || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return true;
      if (document.body.classList.contains("menu-open")) return true;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return true;

      const target = event.target instanceof Element ? event.target : null;
      return Boolean(target?.closest("input, textarea, select, [data-native-scroll]"));
    };

    const handleWheel = (event) => {
      if (shouldUseNativeScroll(event)) return;

      event.preventDefault();
      targetY = Math.max(0, Math.min(maxScrollY(), targetY + normalizeWheelDelta(event) * SMOOTH_SCROLL_MULTIPLIER));

      if (!rafId) {
        currentY = window.scrollY;
        rafId = window.requestAnimationFrame(animate);
      }
    };

    const syncNativeScroll = () => {
      if (!rafId) {
        targetY = window.scrollY;
        currentY = targetY;
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("scroll", syncNativeScroll, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", syncNativeScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}

function useScrollReveal() {
  const rootRef = useRef(null);
  const location = useLocation();
  const { shouldPrepareReveal, shouldRunReveal } = useContext(RevealReadyContext);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !shouldPrepareReveal) return undefined;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const registeredElements = new WeakSet();
    const pendingRevealElements = new Set();
    let revealIndex = 0;
    let rafId = 0;
    let secondRafId = 0;
    let revealRafId = 0;

    const revealVisibleElements = () => {
      if (reducedMotion) {
        pendingRevealElements.forEach((element) => element.classList.add("is-visible"));
        pendingRevealElements.clear();
        return;
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const revealLine = viewportHeight * 0.88;

      pendingRevealElements.forEach((element) => {
        if (!root.contains(element)) {
          pendingRevealElements.delete(element);
          return;
        }

        const rect = element.getBoundingClientRect();
        const isVisible = rect.top <= revealLine && rect.bottom >= viewportHeight * 0.02;

        if (isVisible) {
          element.classList.add("is-visible");
          pendingRevealElements.delete(element);
        }
      });
    };

    const scheduleRevealVisibleElements = () => {
      window.cancelAnimationFrame(revealRafId);
      revealRafId = window.requestAnimationFrame(revealVisibleElements);
    };

    const intersectionObserver = reducedMotion
      ? null
      : new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            pendingRevealElements.delete(entry.target);
            observer.unobserve(entry.target);
          });
        },
        {
          rootMargin: "0px 0px -8% 0px",
          threshold: 0.08,
        },
      );

    const registerRevealElements = () => {
      const elements = [...root.querySelectorAll(SCROLL_REVEAL_SELECTOR)].filter((element) => {
        if (!(element instanceof HTMLElement)) return;
        if (registeredElements.has(element)) return false;
        if (element.closest("[data-reveal-skip]")) return false;

        registeredElements.add(element);
        element.dataset.reveal = "";
        element.classList.remove("is-visible");
        element.style.setProperty("--reveal-delay", `${(revealIndex % 4) * 70}ms`);
        revealIndex += 1;

        return true;
      });

      if (elements.length === 0) return;

      rafId = window.requestAnimationFrame(() => {
        secondRafId = window.requestAnimationFrame(() => {
          elements.forEach((element) => {
            if (!(element instanceof HTMLElement)) return;

            if (!root.contains(element)) return;

            if (reducedMotion) {
              element.classList.add("is-visible");
              return;
            }

            pendingRevealElements.add(element);
            if (shouldRunReveal) {
              intersectionObserver?.observe(element);
            }
          });
          if (shouldRunReveal) {
            scheduleRevealVisibleElements();
          }
        });
      });
    };

    const scheduleRegister = () => {
      window.cancelAnimationFrame(rafId);
      window.cancelAnimationFrame(secondRafId);
      registerRevealElements();
    };

    registerRevealElements();
    window.addEventListener("scroll", scheduleRevealVisibleElements, { passive: true });
    window.addEventListener("resize", scheduleRevealVisibleElements);
    window.addEventListener("orientationchange", scheduleRevealVisibleElements);

    const mutationObserver = new MutationObserver(scheduleRegister);
    mutationObserver.observe(root, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.cancelAnimationFrame(secondRafId);
      window.cancelAnimationFrame(revealRafId);
      window.removeEventListener("scroll", scheduleRevealVisibleElements);
      window.removeEventListener("resize", scheduleRevealVisibleElements);
      window.removeEventListener("orientationchange", scheduleRevealVisibleElements);
      mutationObserver.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [location.pathname, location.search, shouldPrepareReveal, shouldRunReveal]);

  return rootRef;
}

function LuxuryFadeLoader({ children }) {
  const [loaderMounted, setLoaderMounted] = useState(true);
  const [loaderExiting, setLoaderExiting] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    const timers = [];

    const finishLoading = () => {
      timers.push(
        window.setTimeout(() => {
          setContentVisible(true);
          setLoaderExiting(true);

          timers.push(
            window.setTimeout(() => {
              setLoaderMounted(false);
            }, 760),
          );
        }, 900),
      );
    };

    if (document.readyState === "complete") {
      finishLoading();
    } else {
      window.addEventListener("load", finishLoading, { once: true });
    }

    return () => {
      window.removeEventListener("load", finishLoading);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("loader-open", loaderMounted);
    return () => document.body.classList.remove("loader-open");
  }, [loaderMounted]);

  return (
    <>
      {loaderMounted ? (
        <div className={`luxury-loader ${loaderExiting ? "is-exiting" : ""}`} aria-hidden="true">
          <div className="luxury-loader-mark">RULLA</div>
        </div>
      ) : null}
      <RevealReadyContext.Provider
        value={{
          shouldPrepareReveal: contentVisible,
          shouldRunReveal: loaderExiting,
        }}
      >
        <div className={`luxury-loader-content ${contentVisible ? "is-visible" : ""}`}>{children}</div>
      </RevealReadyContext.Provider>
    </>
  );
}

function GarmentImage({ cropClass = "", alt, className = "", src = collectionImage }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`garment-image ${cropClass} ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}

function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { categories } = useSiteContent();
  const location = useLocation();
  const navigate = useNavigate();
  const mainNavigationItems = categories.map((category) => ({
    label: category.title,
    to: `/categories/${category.slug}`,
  }));
  const drawerNavigationItems = [
    ...mainNavigationItems,
    { label: "ثبت سفارش", hash: "#order-contact" },
    { label: "تماس با ما", hash: "#order-contact" },
  ];

  useEffect(() => {
    document.body.classList.toggle("menu-open", isMenuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      closeMenu();
    }
  };

  const handleDrawerAnchor = (hash) => (event) => {
    event.preventDefault();
    closeMenu();

    if (location.pathname !== "/" || location.hash !== hash) {
      navigate(`/${hash}`);
      return;
    }

    window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      <header className="site-header">
        <div className="header-row">
          <button type="button" className="icon-button menu-button" onClick={() => setIsMenuOpen(true)} aria-label="باز کردن منو">
            ☰
          </button>
          <Link to="/" className="brand-mark" onClick={closeMenu}>
            RULLA
          </Link>
          <div className="header-contact-actions" aria-label="راه‌های ارتباط سریع">
            <a href={`tel:${BUSINESS_PHONE}`} className="header-phone-link">
              {BUSINESS_PHONE}
            </a>
            <a href={WHATSAPP_URL} className="header-whatsapp-link" target="_blank" rel="noreferrer" aria-label="ارتباط در واتساپ">
              <WhatsAppIcon />
            </a>
          </div>
        </div>

        <nav className="desktop-nav" aria-label="دسته‌بندی‌های اصلی">
          {mainNavigationItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className={`menu-overlay ${isMenuOpen ? "is-open" : ""}`} aria-hidden={!isMenuOpen} onClick={handleOverlayClick}>
        <div className="menu-panel" role="dialog" aria-modal="true" aria-label="منوی اصلی">
          <button type="button" className="icon-button menu-close" onClick={closeMenu} aria-label="بستن منو">
            ×
          </button>
          <nav className="menu-nav" aria-label="منوی سایت">
            {drawerNavigationItems.map((item) => (
              item.hash ? (
                <a key={item.hash + item.label} href={`/${item.hash}`} onClick={handleDrawerAnchor(item.hash)}>
                  {item.label}
                </a>
              ) : (
                <NavLink key={item.to} to={item.to} onClick={closeMenu}>
                  {item.label}
                </NavLink>
              )
            ))}
          </nav>
        </div>
      </div>
    </>
  );
}

function SiteFooter() {
  const { categories } = useSiteContent();
  const footerSections = [
    {
      title: "دسته‌بندی‌ها",
      links: categories.map((category) => ({
        label: category.title,
        to: `/categories/${category.slug}`,
      })),
    },
    {
      title: "خدمات",
      links: [
        { label: "سفارش شخصی‌دوزی", to: "/order/start" },
      ],
    },
  ];

  return (
    <footer className="site-footer">
      <Link to="/" className="footer-brand">RULLA</Link>
      <div className="footer-layout">
        {footerSections.map((section) => (
          <section key={section.title} className="footer-column" aria-labelledby={`footer-${section.title}`}>
            <h2 id={`footer-${section.title}`}>{section.title}</h2>
            <nav aria-label={section.title}>
              {section.links.map((link) => (
                link.href ? (
                  <a key={link.href} href={link.href}>{link.label}</a>
                ) : (
                  <Link key={link.to} to={link.to}>{link.label}</Link>
                )
              ))}
            </nav>
          </section>
        ))}
      </div>
    </footer>
  );
}

function PageShell({ children }) {
  const revealRootRef = useScrollReveal();

  return (
    <>
      <SiteHeader />
      <div ref={revealRootRef} className="page-reveal-root">
        {children}
        <SiteFooter />
      </div>
    </>
  );
}

function VisualCampaignCarousel({ sections }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (sections.length < 2) return undefined;
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % sections.length);
    }, 3000);
    return () => window.clearInterval(intervalId);
  }, [sections.length]);

  useEffect(() => {
    setActiveIndex(0);
  }, [sections.length]);

  if (!sections.length) return null;

  return (
    <section className="visual-section visual-section--carousel" aria-label="معرفی RULLA">
      {sections.map((section, index) => {
        const isActive = index === activeIndex;
        return (
          <article
            key={section.id || `${section.eyebrow}-${index}`}
            className={`visual-section__slide ${isActive ? "is-active" : ""}`}
            aria-hidden={!isActive}
          >
            <img
              src={section.image}
              alt={section.alt}
              className={`visual-section__image ${section.imageClassName || ""}`}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
            <div className="visual-section__overlay" />
            <div className="visual-section__content">
              <p className="visual-section__eyebrow">{section.eyebrow}</p>
              <h1>{section.title}</h1>
              {section.subtitle ? <p className="visual-section__subtitle">{section.subtitle}</p> : null}
              {section.cta && section.to ? (
                <Link to={section.to} className="visual-section__cta" tabIndex={isActive ? 0 : -1}>
                  {section.cta}
                </Link>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function VisualCampaignSection({ section }) {
  return (
    <section className="visual-section" aria-labelledby={`visual-section-${section.id}`}>
      <img
        src={section.image}
        alt={section.alt}
        className={`visual-section__image ${section.imageClassName || ""}`}
        loading="lazy"
        decoding="async"
      />
      <div className="visual-section__overlay" />
      <div className="visual-section__content">
        {section.eyebrow ? <p className="visual-section__eyebrow">{section.eyebrow}</p> : null}
        <h2 id={`visual-section-${section.id}`}>{section.title}</h2>
        {section.subtitle ? <p className="visual-section__subtitle">{section.subtitle}</p> : null}
        {section.cta && section.to ? (
          <Link to={section.to} className="visual-section__cta">
            {section.cta}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.74.46 3.44 1.32 4.94L2 22l5.28-1.38a9.87 9.87 0 0 0 4.76 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.51 2 12.04 2Zm5.74 14.14c-.24.68-1.39 1.28-1.93 1.37-.5.08-1.12.11-1.8-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.78-4.16-4.93-4.35-.14-.19-1.18-1.57-1.18-2.99 0-1.43.75-2.13 1.02-2.42.27-.29.59-.36.78-.36h.57c.18 0 .43-.07.67.51.24.58.82 2.01.89 2.16.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.38-.43.51-.14.14-.29.29-.12.57.17.29.76 1.25 1.64 2.03 1.13 1.01 2.08 1.33 2.37 1.47.29.14.46.12.63-.07.19-.22.72-.84.91-1.13.19-.29.38-.24.65-.14.27.1 1.72.81 2.01.96.29.14.48.22.55.34.07.12.07.7-.17 1.37Z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2Z" />
    </svg>
  );
}

function EditorialProcessSection() {
  return (
    <section id="order-contact" className="process-editorial" aria-labelledby="process-editorial-heading">
      <h2 id="process-editorial-heading">روند سفارش</h2>
      <ol>
        {orderSteps.slice(0, 5).map((step, index) => (
          <li key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>
      <div className="process-contact-actions" aria-label="راه‌های ارتباط برای ثبت سفارش">
        <a href={WHATSAPP_URL} className="process-contact-button icon-only" target="_blank" rel="noreferrer" aria-label="ارتباط در واتساپ">
          <WhatsAppIcon />
        </a>
        <a href={`tel:${BUSINESS_PHONE}`} className="process-contact-button">
          <PhoneIcon />
          <span>{BUSINESS_PHONE}</span>
        </a>
      </div>
    </section>
  );
}

function CategoryCards() {
  const { categories } = useSiteContent();

  return (
    <section className="section" aria-labelledby="category-heading">
      <div className="section-heading">
        <p className="eyebrow">CATEGORIES</p>
        <h2 id="category-heading">دسته‌بندی‌ها</h2>
      </div>
      <div className="category-stack">
        {categories.map((category, index) => (
          <Link key={category.slug} to={`/categories/${category.slug}`} className="category-card">
            <GarmentImage cropClass={`crop-${index % 5}`} alt={category.title} />
            <span>
              <strong>{category.title}</strong>
              <small>{category.subtitle}</small>
              <em>مشاهده مدل‌ها</em>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ServiceBlock() {
  return (
    <section className="section split-section" aria-labelledby="service-heading">
      <div>
        <p className="eyebrow">CUSTOM TAILORING</p>
        <h2 id="service-heading">دوخته‌شده برای شما</h2>
      </div>
      <div>
        <p className="lead-text">
          هر لباس بر اساس اندازه‌ها، فرم بدن و سلیقه شما آماده می‌شود. امکان تغییر پارچه، رنگ، قد، فرم یقه و جزئیات دوخت وجود دارد.
        </p>
        <ul className="service-list">
          <li>اندازه‌گیری اختصاصی</li>
          <li>پارچه و رنگ انتخابی</li>
          <li>پرو و اصلاح نهایی</li>
          <li>دوخت تمیز و قابل پیگیری</li>
        </ul>
        <Link to="/how-it-works" className="text-link">مشاهده روند سفارش</Link>
      </div>
    </section>
  );
}

function HowItWorksPreview() {
  return (
    <section className="section" aria-labelledby="steps-heading">
      <div className="section-heading">
        <h2 id="steps-heading">روند سفارش</h2>
      </div>
      <ol className="step-list">
        {orderSteps.slice(0, 5).map((step, index) => (
          <li key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProductCard({ product }) {
  return (
    <article className="product-card">
      <Link to={`/products/${product.slug}`} className="product-image-link">
        <GarmentImage src={product.image} alt={product.title} />
      </Link>
      <div className="product-card-body">
        <h3>
          <Link to={`/products/${product.slug}`}>{product.title}</Link>
        </h3>
        <Link to={`/products/${product.slug}`} className="text-link">دیدن جزئیات بیشتر</Link>
      </div>
    </article>
  );
}

function ReviewsPreview() {
  return (
    <section className="section reviews-band" aria-labelledby="reviews-heading">
      <div className="section-heading">
        <h2 id="reviews-heading">نظرات مشتریان</h2>
      </div>
      <div className="review-grid">
        {reviews.slice(0, 2).map((review) => (
          <blockquote key={review.name} className="review-item">
            <p className="rating">{review.rating}</p>
            <p>{review.text}</p>
            <footer>{review.name}، {review.category}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function AppointmentCta() {
  return (
    <section className="appointment-cta" aria-labelledby="appointment-heading">
      <h2 id="appointment-heading">برای انتخاب مدل و پارچه مشاوره بگیرید.</h2>
      <Link to="/consultation" className="button primary">رزرو مشاوره</Link>
    </section>
  );
}

function HomePage() {
  const { homepageSections } = useSiteContent();
  const heroSections = homepageSections.filter((section) => section.id?.startsWith("hero-"));
  const staticSections = homepageSections.filter((section) => !section.id?.startsWith("hero-"));

  return (
    <PageShell>
      <main className="home-editorial">
        <ContentStateNotice />
        <VisualCampaignCarousel sections={heroSections} />
        {staticSections.map((section) => (
          <VisualCampaignSection key={section.id} section={section} />
        ))}
        <EditorialProcessSection />
      </main>
    </PageShell>
  );
}

function CategoriesPage() {
  const { categories } = useSiteContent();

  return (
    <PageShell>
      <main className="page-main">
        <ContentStateNotice />
        <div className="category-stack page-category-stack">
          {categories.map((category, index) => (
            <Link key={category.slug} to={`/categories/${category.slug}`} className="category-card">
              <GarmentImage cropClass={`crop-${index % 5}`} alt={category.title} />
              <span>
                <strong>{category.title}</strong>
                <small>{category.subtitle}</small>
                <em>مشاهده مدل‌ها</em>
              </span>
            </Link>
          ))}
        </div>
      </main>
    </PageShell>
  );
}

function CategoryPage() {
  const { slug } = useParams();
  const { categories, products, status } = useSiteContent();
  const category = categories.find((item) => item.slug === slug);

  const visibleProducts = useMemo(() => {
    return products.filter((product) => product.category === slug);
  }, [products, slug]);

  if (!category && status.type !== "idle") {
    return (
      <PageShell>
        <main className="page-main">
          <ContentStateNotice />
        </main>
      </PageShell>
    );
  }

  if (!category) {
    return <NotFoundPage />;
  }

  return (
    <PageShell>
      <main className="page-main category-listing-page">
        <ContentStateNotice />
        <div className="product-grid listing-grid">
          {visibleProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </main>
    </PageShell>
  );
}

function ProductPage() {
  const { slug } = useParams();
  const { products, status } = useSiteContent();
  const product = products.find((item) => item.slug === slug);

  if (!product && status.type !== "idle") {
    return (
      <PageShell>
        <main className="page-main">
          <ContentStateNotice />
        </main>
      </PageShell>
    );
  }

  if (!product) {
    return <NotFoundPage />;
  }

  return (
    <PageShell>
      <main className="product-page">
        <section className="product-detail">
          <div className="product-gallery">
            <GarmentImage src={product.image} alt={product.title} className="gallery-main-image" />
          </div>
          <div className="product-info">
            <h1>{product.title}</h1>
            <p className="product-meta">{product.fabrics.join("، ")}</p>
            <p className="product-meta">{product.colors.join("، ")}</p>
            <Link to={`/order/start?model=${product.slug}`} className="button primary">ثبت سفارش</Link>
          </div>
        </section>

        <ReviewsPreview />
      </main>
    </PageShell>
  );
}


function OrderStartPage() {
  const [searchParams] = useSearchParams();
  const { products } = useSiteContent();
  const selectedProduct = products.find((product) => product.slug === searchParams.get("model"));
  const [form, setForm] = useState({
    model: selectedProduct?.slug || "",
    fabric: "",
    color: "",
    timeline: "",
    phone: "",
    notes: "",
  });
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const navigate = useNavigate();

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    const validation = validatePhoneNumber(form.phone);

    if (validation.error) {
      setStatus({ type: "error", message: validation.error });
      return;
    }

    setStatus({ type: "success", message: "اطلاعات اولیه ثبت شد. حالا اندازه‌ها را وارد کنید." });
    window.setTimeout(() => navigate("/order/measurements"), 700);
  };

  return (
    <PageShell>
      <main className="page-main form-page">
        <ContentStateNotice />
        <form className="rulla-form" onSubmit={handleSubmit}>
          <label>
            مدل
            <select value={form.model} onChange={updateField("model")} required>
              <option value="">انتخاب مدل</option>
              {products.map((product) => (
                <option key={product.slug} value={product.slug}>{product.title}</option>
              ))}
            </select>
          </label>
          <label>
            پارچه
            <select value={form.fabric} onChange={updateField("fabric")} required>
              <option value="">انتخاب پارچه</option>
              {["کرپ", "ساتن", "لینن", "حریر", "ابریشم", "فاستونی", "نیاز به مشاوره"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            رنگ
            <input value={form.color} onChange={updateField("color")} placeholder="مثلاً مشکی، سفید، کرم یا سفارشی" required />
          </label>
          <label>
            زمان آماده‌سازی
            <select value={form.timeline} onChange={updateField("timeline")} required>
              <option value="">انتخاب زمان</option>
              <option value="۷ تا ۱۰ روز">۷ تا ۱۰ روز</option>
              <option value="۱۰ تا ۱۴ روز">۱۰ تا ۱۴ روز</option>
              <option value="فوری با هماهنگی">فوری با هماهنگی</option>
            </select>
          </label>
          <label>
            شماره تلفن
            <input value={form.phone} onChange={updateField("phone")} type="tel" autoComplete="tel" required />
          </label>
          <label>
            توضیحات
            <textarea value={form.notes} onChange={updateField("notes")} rows={5} placeholder="جزئیات تغییر مدل، مناسبت یا محدودیت زمانی" />
          </label>
          <button type="submit" className="button primary">ثبت و ادامه</button>
          <StatusMessage status={status} />
        </form>
      </main>
    </PageShell>
  );
}

function MeasurementsPage() {
  const [status, setStatus] = useState({ type: "idle", message: "" });

  const handleSubmit = (event) => {
    event.preventDefault();
    setStatus({ type: "success", message: "اندازه‌ها ثبت شد. برای تایید نهایی با شما هماهنگ می‌کنیم." });
  };

  return (
    <PageShell>
      <main className="page-main form-page">
        <form className="rulla-form measurement-form" onSubmit={handleSubmit}>
          {["قد", "دور سینه", "دور کمر", "دور باسن", "سرشانه", "قد آستین", "قد لباس", "دور بازو"].map((field) => (
            <label key={field}>
              {field}
              <input type="number" min="0" inputMode="decimal" required />
            </label>
          ))}
          <label className="full-field">
            توضیح تکمیلی
            <textarea rows={4} placeholder="مثلاً لباس کمی آزادتر باشد یا قد نهایی با کفش خاصی تنظیم شود." />
          </label>
          <button type="submit" className="button primary">ثبت اندازه‌ها</button>
          <StatusMessage status={status} />
        </form>
      </main>
    </PageShell>
  );
}

function ContactLeadForm({ title = "ثبت درخواست مشاوره" }) {
  const [form, setForm] = useState({ fullName: "", contact: "", message: "" });
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const isSubmitting = status.type === "loading";

  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    const fullName = form.fullName.trim();
    const phoneValidation = validatePhoneNumber(form.contact);
    const message = form.message.trim();

    if (!fullName || !form.contact.trim() || !message) {
      setStatus({ type: "error", message: "همه فیلدها الزامی هستند." });
      return;
    }

    if (phoneValidation.error) {
      setStatus({ type: "error", message: phoneValidation.error });
      return;
    }

    if (message.length < MESSAGE_MIN_LENGTH || message.length > MESSAGE_MAX_LENGTH) {
      setStatus({ type: "error", message: "متن پیام باید بین ۱۰ تا ۲۰۰۰ کاراکتر باشد." });
      return;
    }

    setStatus({ type: "loading", message: "در حال ارسال..." });

    try {
      const response = await fetch(apiEndpoint("contact-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, contact: phoneValidation.phone, message }),
      });

      if (!response.ok) throw new Error("request failed");
      setForm({ fullName: "", contact: "", message: "" });
      setStatus({ type: "success", message: "درخواست شما ثبت شد و برای هماهنگی تماس می‌گیریم." });
    } catch {
      setStatus({ type: "error", message: "ارسال آنلاین انجام نشد. بعد از راه‌اندازی API دوباره تلاش کنید." });
    }
  };

  return (
    <form className="rulla-form" onSubmit={handleSubmit}>
      <h2>{title}</h2>
      <label>
        نام و نام خانوادگی
        <input value={form.fullName} onChange={updateField("fullName")} autoComplete="name" required />
      </label>
      <label>
        شماره تلفن
        <input value={form.contact} onChange={updateField("contact")} type="tel" autoComplete="tel" required />
      </label>
      <label>
        پیام
        <textarea value={form.message} onChange={updateField("message")} rows={5} required />
      </label>
      <button type="submit" className="button primary" disabled={isSubmitting}>{isSubmitting ? "در حال ارسال..." : "ارسال درخواست"}</button>
      <StatusMessage status={status} />
    </form>
  );
}

function ConsultationPage() {
  return (
    <PageShell>
      <main className="page-main form-page">
        <ContactLeadForm />
      </main>
    </PageShell>
  );
}

function ContactPage() {
  return (
    <PageShell>
      <main className="page-main form-page">
        <section className="contact-direct" aria-labelledby="contact-heading">
          <p className="eyebrow">CONTACT</p>
          <h1 id="contact-heading">تماس با ما</h1>
          <a href={`tel:${BUSINESS_PHONE}`} className="contact-phone">{BUSINESS_PHONE}</a>
          <a href={WHATSAPP_URL} className="button primary" target="_blank" rel="noreferrer">
            ارتباط در واتساپ
          </a>
        </section>
        <ContactLeadForm title="ارسال پیام" />
      </main>
    </PageShell>
  );
}

function HowItWorksPage() {
  return (
    <PageShell>
      <main className="page-main">
        <ol className="step-list large-step-list">
          {orderSteps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
              <p>{stepDescriptions[index]}</p>
            </li>
          ))}
        </ol>
      </main>
    </PageShell>
  );
}

const stepDescriptions = [
  "مدل پایه را از دسته‌بندی‌ها انتخاب می‌کنید یا ایده خود را توضیح می‌دهید.",
  "اندازه‌ها ثبت می‌شود و اگر نیاز باشد برای اصلاح اندازه‌ها هماهنگ می‌کنیم.",
  "پارچه، رنگ، آستر و جزئیات قابل تغییر نهایی می‌شود.",
  "پس از تایید جزئیات، بیعانه سفارش ثبت می‌شود.",
  "لباس آماده پرو می‌شود و اصلاح‌های نهایی انجام می‌گیرد.",
  "پس از تایید نهایی، لباس برای تحویل آماده می‌شود.",
];

function SizeGuidePage() {
  return (
    <PageShell>
      <main className="page-main">
        <div className="measurement-guide">
          {measurementGuides.map(([title, text]) => (
            <article key={title}>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </main>
    </PageShell>
  );
}

function AboutPage() {
  return (
    <PageShell>
      <main className="page-main">
        <section className="split-section about-section">
          <GarmentImage cropClass="crop-3" alt="کت تک‌دوزی RULLA" />
          <div>
            <h2>تک‌دوزی با نگاه دقیق به فیت</h2>
            <p>
              تمرکز اصلی روی الگو، اصلاح اندازه‌ها، انتخاب پارچه و اجرای تمیز جزئیات است. هر مدل قبل از نهایی شدن با نیاز شما تطبیق داده می‌شود.
            </p>
            <Link to="/order/start" className="button primary">شروع سفارش</Link>
          </div>
        </section>
      </main>
    </PageShell>
  );
}

function NotFoundPage() {
  return (
    <PageShell>
      <main className="page-main">
        <Link to="/" className="button primary">بازگشت به خانه</Link>
      </main>
    </PageShell>
  );
}

export default function App() {
  return (
    <LuxuryFadeLoader>
      <BrowserRouter>
        <SiteContentProvider>
          <ScrollToTop />
          <SmoothScrollController />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/categories/:slug" element={<CategoryPage />} />
            <Route path="/products/:slug" element={<ProductPage />} />
            <Route path="/order/start" element={<OrderStartPage />} />
            <Route path="/order/measurements" element={<MeasurementsPage />} />
            <Route path="/consultation" element={<ConsultationPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/size-guide" element={<SizeGuidePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </SiteContentProvider>
      </BrowserRouter>
    </LuxuryFadeLoader>
  );
}
