package seed

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"rulla-server/internal/database"

	"github.com/jackc/pgx/v5/pgxpool"
)

type defaultCategory struct {
	Slug      string
	Title     string
	Subtitle  string
	SortOrder int
}

type defaultHomepageSection struct {
	ID             string
	Eyebrow        string
	Title          string
	Subtitle       string
	CTALabel       string
	To             string
	Alt            string
	Asset          string
	ImageClassName string
	SortOrder      int
}

var defaultCategories = []defaultCategory{
	{Slug: "shomiz", Title: "شومیز", Subtitle: "برای استایل روزمره و رسمی", SortOrder: 10},
	{Slug: "shalvar", Title: "شلوار", Subtitle: "برش دقیق، فیت شخصی", SortOrder: 20},
	{Slug: "top", Title: "تاپ", Subtitle: "سبک، ساده، قابل ست", SortOrder: 30},
	{Slug: "coat", Title: "کت", Subtitle: "دوخت ساختارمند و شیک", SortOrder: 40},
	{Slug: "evening-dress", Title: "لباس مجلسی", Subtitle: "دوخته‌شده برای مراسم شما", SortOrder: 50},
}

var defaultHomepageSections = []defaultHomepageSection{
	{
		ID:             "hero-collection",
		Eyebrow:        "RULLA COLLECTION",
		Title:          "مدل دلخواهتان را از میان سبک‌های مختلف انتخاب کنید",
		Subtitle:       "از لباس‌های روزمره تا ست‌های رسمی و مجلسی، هر مدل با اندازه، پارچه و جزئیات موردنظر شما آماده می‌شود.",
		CTALabel:       "ثبت سفارش",
		To:             "/order/start",
		Alt:            "کالکشن لباس‌های قابل سفارش RULLA",
		Asset:          "section_hero/rulla-hero-collection.png",
		ImageClassName: "visual-section__image--hero-collection",
		SortOrder:      10,
	},
	{
		ID:             "hero-ready",
		Eyebrow:        "READY FOR YOU",
		Title:          "لباسی که برای شما دوخته شده، آماده تحویل است",
		Subtitle:       "هر سفارش بعد از انتخاب مدل، تنظیم اندازه‌ها و اجرای جزئیات، با دقت نهایی آماده می‌شود.",
		CTALabel:       "تماس برای سفارش",
		To:             "/#order-contact",
		Alt:            "لباس آماده تحویل در آتلیه RULLA",
		Asset:          "section_hero/rulla-hero-ready.png",
		ImageClassName: "visual-section__image--hero-ready",
		SortOrder:      20,
	},
	{
		ID:             "hero-fit",
		Eyebrow:        "CUSTOM FIT",
		Title:          "تمرکز روی فیت، فرم بدن و جزئیات",
		Subtitle:       "اندازه‌ها، قد لباس، فرم سرشانه و تنخور نهایی با دقت بررسی می‌شود تا لباس فقط زیبا نباشد؛ درست روی بدن بنشیند.",
		CTALabel:       "درخواست مشاوره",
		To:             "/consultation",
		Alt:            "اندازه‌گیری اختصاصی برای فیت لباس",
		Asset:          "section_hero/rulla-hero-fit.png",
		ImageClassName: "visual-section__image--hero-fit",
		SortOrder:      30,
	},
	{
		ID:             "hero-custom",
		Eyebrow:        "FROM IDEA TO GARMENT",
		Title:          "از انتخاب مدل تا دوخت نهایی، همه‌چیز قابل شخصی‌سازی است",
		Subtitle:       "پارچه، رنگ، فرم یقه، قد، آستین و جزئیات دوخت بر اساس سلیقه و نیاز شما انتخاب می‌شود.",
		CTALabel:       "ارتباط با اپراتور",
		To:             "/contact",
		Alt:            "طراحی و شخصی‌سازی لباس در آتلیه RULLA",
		Asset:          "section_hero/rulla-hero-custom.png",
		ImageClassName: "visual-section__image--hero-custom",
		SortOrder:      40,
	},
	{
		ID:             "blouse",
		Title:          "شومیز و بلوز زنانه با طراحی مینیمال، دوخت دقیق و تنخور شیک",
		CTALabel:       "مشاهده شومیز و بلوز",
		To:             "/categories/blouse",
		Alt:            "شومیز و بلوز زنانه RULLA",
		Asset:          "blouse/rulla-blouse.png",
		ImageClassName: "visual-section__image--blouse",
		SortOrder:      50,
	},
	{
		ID:             "dress",
		Title:          "دوخت اختصاصی لباس مجلسی",
		CTALabel:       "مشاهده لباس مجلسی",
		To:             "/categories/evening-dress",
		Alt:            "لباس مجلسی دوخت اختصاصی RULLA",
		Asset:          "dress/rulla-dress.png",
		ImageClassName: "visual-section__image--dress",
		SortOrder:      60,
	},
	{
		ID:             "coat-feature",
		Title:          "کت و پالتو زنانه با دوخت اختصاصی",
		CTALabel:       "مشاهده کت و پالتو",
		To:             "/categories/blazer",
		Alt:            "کت و پالتو زنانه RULLA",
		Asset:          "coat/rulla-coat.png",
		ImageClassName: "visual-section__image--coat-feature",
		SortOrder:      70,
	},
	{
		ID:             "skirt",
		Title:          "دامن؛ ظرافت در برش و حرکت",
		CTALabel:       "مشاهده دامن",
		To:             "/categories/skirt",
		Alt:            "دامن زنانه RULLA",
		Asset:          "skirt/rulla-skirt.png",
		ImageClassName: "visual-section__image--skirt",
		SortOrder:      80,
	},
	{
		ID:             "top-feature",
		Title:          "تاپ زنانه با درخشش لطیف و ظریف",
		CTALabel:       "مشاهده تاپ",
		To:             "/categories/top",
		Alt:            "تاپ زنانه RULLA",
		Asset:          "top/rulla-top.png",
		ImageClassName: "visual-section__image--top-feature",
		SortOrder:      90,
	},
}

var categoryFallbacks = map[string]struct {
	Fabric string
	Color  string
}{
	"shomiz":        {Fabric: "ابریشم", Color: "سفید"},
	"shalvar":       {Fabric: "کرپ", Color: "سفارشی"},
	"top":           {Fabric: "ساتن", Color: "سفارشی"},
	"coat":          {Fabric: "فاستونی", Color: "سفارشی"},
	"evening-dress": {Fabric: "ساتن", Color: "سفارشی"},
}

// Content migrates the old code-driven public content into database-managed data.
func Content(ctx context.Context, db *database.PostgresDB, productAssetsDir string, homepageAssetsDir string) error {
	pool := db.Pool()

	if err := removeLegacyCourse(ctx, pool); err != nil {
		return err
	}
	if err := seedDefaultCategories(ctx, pool); err != nil {
		return err
	}
	if err := seedDefaultHomepageSections(ctx, pool, homepageAssetsDir); err != nil {
		return err
	}
	if err := importStaticProducts(ctx, pool, productAssetsDir); err != nil {
		return err
	}
	if err := ensureCategoryRowsForCourseTerms(ctx, pool); err != nil {
		return err
	}
	if err := ensureCourseCategoryConstraint(ctx, pool); err != nil {
		return err
	}

	return nil
}

func removeLegacyCourse(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `DELETE FROM courses WHERE id = '01' AND slug = '01'`)
	if err != nil {
		return fmt.Errorf("remove legacy course seed: %w", err)
	}
	return nil
}

func seedDefaultCategories(ctx context.Context, pool *pgxpool.Pool) error {
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM categories`).Scan(&count); err != nil {
		return fmt.Errorf("count categories: %w", err)
	}
	if count > 0 {
		return nil
	}

	now := time.Now().UTC()
	for _, category := range defaultCategories {
		if _, err := pool.Exec(
			ctx,
			`INSERT INTO categories (slug, title, subtitle, sort_order, status, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,'active',$5,$5)
			 ON CONFLICT (slug) DO NOTHING`,
			category.Slug,
			category.Title,
			category.Subtitle,
			category.SortOrder,
			now,
		); err != nil {
			return fmt.Errorf("seed category %s: %w", category.Slug, err)
		}
	}
	return nil
}

func seedDefaultHomepageSections(ctx context.Context, pool *pgxpool.Pool, assetsDir string) error {
	var count int
	if err := pool.QueryRow(
		ctx,
		`SELECT COUNT(*)
		 FROM homepage_sections
		 WHERE id IN (
			'hero-collection', 'hero-ready', 'hero-fit', 'hero-custom',
			'blouse', 'dress', 'coat-feature', 'skirt', 'top-feature'
		 )`,
	).Scan(&count); err != nil {
		return fmt.Errorf("count hero homepage sections: %w", err)
	}
	if count == len(defaultHomepageSections) {
		return nil
	}

	now := time.Now().UTC()
	for _, section := range defaultHomepageSections {
		filename, contentType, data, err := loadSeedAsset(assetsDir, section.Asset)
		if err != nil {
			return err
		}
		if _, err := pool.Exec(
			ctx,
			`INSERT INTO homepage_sections (
				id, eyebrow, title, subtitle, cta_label, to_url, alt, image_filename, image_content_type,
				image_data, image_class_name, sort_order, status, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',$13,$13)
			ON CONFLICT (id) DO NOTHING`,
			section.ID,
			section.Eyebrow,
			section.Title,
			section.Subtitle,
			section.CTALabel,
			section.To,
			section.Alt,
			filename,
			contentType,
			nullableAssetData(data),
			section.ImageClassName,
			section.SortOrder,
			now,
		); err != nil {
			return fmt.Errorf("seed homepage section %s: %w", section.ID, err)
		}
	}
	for _, section := range defaultHomepageSections {
		if section.CTALabel == "" || section.To == "" {
			continue
		}
		if _, err := pool.Exec(
			ctx,
			`UPDATE homepage_sections
			 SET cta_label = $2, to_url = $3, updated_at = $4
			 WHERE id = $1 AND cta_label = ''`,
			section.ID,
			section.CTALabel,
			section.To,
			now,
		); err != nil {
			return fmt.Errorf("ensure homepage section link %s: %w", section.ID, err)
		}
	}

	_, err := pool.Exec(
		ctx,
		`UPDATE homepage_sections
		 SET status = 'draft', updated_at = $1
		 WHERE id IN ('hero', 'shomiz', 'shalvar', 'top', 'coat', 'evening-dress')`,
		now,
	)
	if err != nil {
		return fmt.Errorf("draft legacy homepage sections: %w", err)
	}
	return nil
}

func importStaticProducts(ctx context.Context, pool *pgxpool.Pool, dir string) error {
	if strings.TrimSpace(dir) == "" {
		return nil
	}
	paths, err := productAssetPaths(dir)
	if err != nil {
		return err
	}
	if len(paths) == 0 {
		return nil
	}

	categoryCounts := make(map[string]int)
	imported := 0
	for _, relPath := range paths {
		categorySlug := filepath.Base(filepath.Dir(relPath))
		categoryCounts[categorySlug]++
		index := categoryCounts[categorySlug]

		baseSlug := strings.TrimSuffix(filepath.Base(relPath), filepath.Ext(relPath))
		if strings.HasPrefix(baseSlug, "daman-") {
			exists, err := courseExists(ctx, pool, baseSlug)
			if err != nil {
				return err
			}
			if exists {
				continue
			}
		}

		slug := fmt.Sprintf("%s-%02d", categorySlug, index)
		exists, err := courseExists(ctx, pool, slug)
		if err != nil {
			return err
		}
		if exists {
			continue
		}

		fullPath := filepath.Join(dir, relPath)
		data, err := os.ReadFile(fullPath)
		if err != nil {
			return fmt.Errorf("read product asset %s: %w", fullPath, err)
		}

		category := categoryBySlug(categorySlug)
		imageID := stableID("course-image:" + relPath)
		now := time.Now().UTC()
		_, err = pool.Exec(
			ctx,
			`INSERT INTO courses (
				id, slug, title, subtitle, term, level, format, duration, summary, description,
				status, image_id, sort_order, outcomes, audience, lessons, created_at, updated_at
			) VALUES ($1,$2,$3,$4,$5,'','','','','','in_progress',$6,$7,$8,$9,'[]'::jsonb,$10,$10)
			ON CONFLICT (slug) DO NOTHING`,
			slug,
			slug,
			fmt.Sprintf("%s %02d", category.Title, index),
			category.Title,
			categorySlug,
			imageID,
			category.SortOrder+index,
			mustJSON([]string{inferFabricFromPath(relPath, categorySlug)}),
			mustJSON([]string{inferColorFromPath(relPath, categorySlug)}),
			now,
		)
		if err != nil {
			return fmt.Errorf("insert static product %s: %w", slug, err)
		}

		_, err = pool.Exec(
			ctx,
			`INSERT INTO course_images (id, course_id, filename, alt, content_type, data, sort_order, created_at)
			 VALUES ($1,$2,$3,$4,$5,$6,0,$7)
			 ON CONFLICT (course_id, filename) DO NOTHING`,
			imageID,
			slug,
			filepath.Base(relPath),
			fmt.Sprintf("%s %02d", category.Title, index),
			detectContentType(relPath, data),
			data,
			now,
		)
		if err != nil {
			return fmt.Errorf("insert static product image %s: %w", slug, err)
		}
		imported++
	}

	if imported > 0 {
		log.Printf("imported %d static products from %s", imported, dir)
	}
	return nil
}

func ensureCategoryRowsForCourseTerms(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(
		ctx,
		`UPDATE courses
		 SET term = (SELECT slug FROM categories ORDER BY sort_order ASC, slug ASC LIMIT 1)
		 WHERE term = '' AND EXISTS (SELECT 1 FROM categories)`,
	)
	if err != nil {
		return fmt.Errorf("normalize empty course categories: %w", err)
	}

	_, err = pool.Exec(
		ctx,
		`INSERT INTO categories (slug, title, subtitle, sort_order, status, created_at, updated_at)
		 SELECT DISTINCT term, term, '', 9000, 'active', NOW(), NOW()
		 FROM courses
		 WHERE term <> '' AND NOT EXISTS (
			SELECT 1 FROM categories WHERE categories.slug = courses.term
		 )`,
	)
	if err != nil {
		return fmt.Errorf("seed categories for existing products: %w", err)
	}
	return nil
}

func ensureCourseCategoryConstraint(ctx context.Context, pool *pgxpool.Pool) error {
	statements := []string{
		`CREATE INDEX IF NOT EXISTS idx_courses_term ON courses (term)`,
		`DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1
				FROM pg_constraint
				WHERE conname = 'courses_term_category_fk'
			) THEN
				ALTER TABLE courses
				ADD CONSTRAINT courses_term_category_fk
				FOREIGN KEY (term)
				REFERENCES categories(slug)
				ON UPDATE CASCADE
				ON DELETE RESTRICT;
			END IF;
		END $$`,
	}
	for _, statement := range statements {
		if _, err := pool.Exec(ctx, statement); err != nil {
			return fmt.Errorf("ensure course category constraint: %w", err)
		}
	}
	return nil
}

func productAssetPaths(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			log.Printf("static product import skipped: %s does not exist", dir)
			return nil, nil
		}
		return nil, fmt.Errorf("read static product directory: %w", err)
	}
	if len(entries) == 0 {
		return nil, nil
	}

	paths := make([]string, 0)
	err = filepath.WalkDir(dir, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if _, ok := allowedImageExtensions[ext]; !ok {
			return nil
		}
		relPath, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		if strings.Count(relPath, string(filepath.Separator)) != 1 {
			return nil
		}
		paths = append(paths, relPath)
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk static product directory: %w", err)
	}
	sort.Strings(paths)
	return paths, nil
}

func loadSeedAsset(dir string, filename string) (string, string, []byte, error) {
	if strings.TrimSpace(dir) == "" || strings.TrimSpace(filename) == "" {
		return "", "", nil, nil
	}
	fullPath := filepath.Join(dir, filename)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			log.Printf("homepage seed image skipped: %s does not exist", fullPath)
			return "", "", nil, nil
		}
		return "", "", nil, fmt.Errorf("read homepage seed image %s: %w", fullPath, err)
	}
	return filename, detectContentType(filename, data), data, nil
}

func nullableAssetData(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return data
}

func courseExists(ctx context.Context, pool *pgxpool.Pool, slug string) (bool, error) {
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM courses WHERE slug = $1 OR id = $1)`, slug).Scan(&exists); err != nil {
		return false, fmt.Errorf("check product %s: %w", slug, err)
	}
	return exists, nil
}

func categoryBySlug(slug string) defaultCategory {
	for _, category := range defaultCategories {
		if category.Slug == slug {
			return category
		}
	}
	return defaultCategory{Slug: slug, Title: slug, SortOrder: 9000}
}

func inferFabricFromPath(path string, category string) string {
	value := strings.ToLower(path)
	switch {
	case strings.Contains(value, "silk"):
		return "ابریشم"
	case strings.Contains(value, "satin"):
		return "ساتن"
	case strings.Contains(value, "linen") || strings.Contains(value, "leinen"):
		return "لینن"
	case strings.Contains(value, "wool"):
		return "پشم"
	case strings.Contains(value, "blazer") || category == "coat":
		return "فاستونی"
	default:
		if fallback, ok := categoryFallbacks[category]; ok {
			return fallback.Fabric
		}
		return "سفارشی"
	}
}

func inferColorFromPath(path string, category string) string {
	value := strings.ToLower(path)
	switch {
	case strings.Contains(value, "black"):
		return "مشکی"
	case strings.Contains(value, "white") || strings.Contains(value, "off-white") || strings.Contains(value, "weiße"):
		return "سفید"
	case strings.Contains(value, "champagne"):
		return "شامپاینی"
	case strings.Contains(value, "stone") || strings.Contains(value, "cream"):
		return "کرم"
	default:
		if fallback, ok := categoryFallbacks[category]; ok {
			return fallback.Color
		}
		return "سفارشی"
	}
}

func stableID(value string) string {
	sum := sha1.Sum([]byte(value))
	return hex.EncodeToString(sum[:12])
}

func mustJSON(value any) []byte {
	data, err := json.Marshal(value)
	if err != nil {
		return []byte("[]")
	}
	return data
}
