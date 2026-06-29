package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"rulla-server/internal/models"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContentRepository struct {
	pool *pgxpool.Pool
}

func NewContentRepository(pool *pgxpool.Pool) *ContentRepository {
	return &ContentRepository{pool: pool}
}

func (r *ContentRepository) ListCategories(ctx context.Context, includeDrafts bool) ([]models.Category, error) {
	rows, err := r.pool.Query(
		ctx,
		`SELECT slug, title, subtitle, sort_order, status, created_at, updated_at
		 FROM categories
		 WHERE ($1 OR status <> 'draft')
		 ORDER BY sort_order ASC, slug ASC`,
		includeDrafts,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]models.Category, 0)
	for rows.Next() {
		category, err := scanCategory(rows)
		if err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return categories, nil
}

func (r *ContentRepository) CreateCategory(ctx context.Context, category models.Category) (models.Category, error) {
	normalizeCategory(&category)
	if category.Slug == "" {
		category.Slug = generateID()
	}
	now := time.Now().UTC()
	category.CreatedAt = now
	category.UpdatedAt = now

	_, err := r.pool.Exec(
		ctx,
		`INSERT INTO categories (slug, title, subtitle, sort_order, status, created_at, updated_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		category.Slug,
		category.Title,
		category.Subtitle,
		category.SortOrder,
		category.Status,
		category.CreatedAt,
		category.UpdatedAt,
	)
	return category, err
}

func (r *ContentRepository) UpdateCategory(ctx context.Context, slug string, category models.Category) (models.Category, error) {
	normalizeCategory(&category)
	if category.Slug == "" {
		category.Slug = strings.TrimSpace(slug)
	}
	category.UpdatedAt = time.Now().UTC()

	row := r.pool.QueryRow(
		ctx,
		`UPDATE categories SET
			slug = $2,
			title = $3,
			subtitle = $4,
			sort_order = $5,
			status = $6,
			updated_at = $7
		 WHERE slug = $1
		 RETURNING slug, title, subtitle, sort_order, status, created_at, updated_at`,
		strings.TrimSpace(slug),
		category.Slug,
		category.Title,
		category.Subtitle,
		category.SortOrder,
		category.Status,
		category.UpdatedAt,
	)
	updated, err := scanCategory(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Category{}, ErrNotFound
	}
	return updated, err
}

func (r *ContentRepository) DeleteCategory(ctx context.Context, slug string) error {
	result, err := r.pool.Exec(ctx, `DELETE FROM categories WHERE slug = $1`, strings.TrimSpace(slug))
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *ContentRepository) ListHomepageSections(ctx context.Context, includeDrafts bool) ([]models.HomepageSection, error) {
	rows, err := r.pool.Query(
		ctx,
		`SELECT id, eyebrow, title, cta_label, to_url, alt, image_filename, image_content_type,
			image_class_name, sort_order, status, created_at, updated_at
		 FROM homepage_sections
		 WHERE ($1 OR status <> 'draft')
		 ORDER BY sort_order ASC, id ASC`,
		includeDrafts,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sections := make([]models.HomepageSection, 0)
	for rows.Next() {
		section, err := scanHomepageSection(rows)
		if err != nil {
			return nil, err
		}
		sections = append(sections, section)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return sections, nil
}

func (r *ContentRepository) GetHomepageSection(ctx context.Context, id string, includeDrafts bool) (models.HomepageSection, error) {
	row := r.pool.QueryRow(
		ctx,
		`SELECT id, eyebrow, title, cta_label, to_url, alt, image_filename, image_content_type,
			image_class_name, sort_order, status, created_at, updated_at
		 FROM homepage_sections
		 WHERE id = $1 AND ($2 OR status <> 'draft')
		 LIMIT 1`,
		strings.TrimSpace(id),
		includeDrafts,
	)
	section, err := scanHomepageSection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.HomepageSection{}, ErrNotFound
	}
	return section, err
}

func (r *ContentRepository) CreateHomepageSection(ctx context.Context, section models.HomepageSection) (models.HomepageSection, error) {
	normalizeHomepageSection(&section)
	if section.ID == "" {
		section.ID = generateID()
	}
	now := time.Now().UTC()
	section.CreatedAt = now
	section.UpdatedAt = now

	_, err := r.pool.Exec(
		ctx,
		`INSERT INTO homepage_sections (
			id, eyebrow, title, cta_label, to_url, alt, image_filename, image_content_type,
			image_data, image_class_name, sort_order, status, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		section.ID,
		section.Eyebrow,
		section.Title,
		section.CTALabel,
		section.To,
		section.Alt,
		section.ImageFilename,
		section.ImageContentType,
		nullableBytes(section.ImageData),
		section.ImageClassName,
		section.SortOrder,
		section.Status,
		section.CreatedAt,
		section.UpdatedAt,
	)
	return section, err
}

func (r *ContentRepository) UpdateHomepageSection(ctx context.Context, id string, section models.HomepageSection) (models.HomepageSection, error) {
	normalizeHomepageSection(&section)
	section.ID = strings.TrimSpace(id)
	section.UpdatedAt = time.Now().UTC()

	row := r.pool.QueryRow(
		ctx,
		`UPDATE homepage_sections SET
			eyebrow = $2,
			title = $3,
			cta_label = $4,
			to_url = $5,
			alt = $6,
			image_class_name = $7,
			sort_order = $8,
			status = $9,
			updated_at = $10
		 WHERE id = $1
		 RETURNING id, eyebrow, title, cta_label, to_url, alt, image_filename, image_content_type,
			image_class_name, sort_order, status, created_at, updated_at`,
		section.ID,
		section.Eyebrow,
		section.Title,
		section.CTALabel,
		section.To,
		section.Alt,
		section.ImageClassName,
		section.SortOrder,
		section.Status,
		section.UpdatedAt,
	)
	updated, err := scanHomepageSection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.HomepageSection{}, ErrNotFound
	}
	return updated, err
}

func (r *ContentRepository) DeleteHomepageSection(ctx context.Context, id string) error {
	result, err := r.pool.Exec(ctx, `DELETE FROM homepage_sections WHERE id = $1`, strings.TrimSpace(id))
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *ContentRepository) SetHomepageSectionImage(ctx context.Context, id string, filename string, contentType string, data []byte) (models.HomepageSection, error) {
	row := r.pool.QueryRow(
		ctx,
		`UPDATE homepage_sections SET
			image_filename = $2,
			image_content_type = $3,
			image_data = $4,
			updated_at = $5
		 WHERE id = $1
		 RETURNING id, eyebrow, title, cta_label, to_url, alt, image_filename, image_content_type,
			image_class_name, sort_order, status, created_at, updated_at`,
		strings.TrimSpace(id),
		strings.TrimSpace(filename),
		strings.TrimSpace(contentType),
		data,
		time.Now().UTC(),
	)
	section, err := scanHomepageSection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.HomepageSection{}, ErrNotFound
	}
	return section, err
}

func (r *ContentRepository) ClearHomepageSectionImage(ctx context.Context, id string) (models.HomepageSection, error) {
	row := r.pool.QueryRow(
		ctx,
		`UPDATE homepage_sections SET
			image_filename = '',
			image_content_type = '',
			image_data = NULL,
			updated_at = $2
		 WHERE id = $1
		 RETURNING id, eyebrow, title, cta_label, to_url, alt, image_filename, image_content_type,
			image_class_name, sort_order, status, created_at, updated_at`,
		strings.TrimSpace(id),
		time.Now().UTC(),
	)
	section, err := scanHomepageSection(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.HomepageSection{}, ErrNotFound
	}
	return section, err
}

func (r *ContentRepository) GetHomepageSectionImage(ctx context.Context, id string) (models.HomepageSection, error) {
	var section models.HomepageSection
	err := r.pool.QueryRow(
		ctx,
		`SELECT id, image_filename, image_content_type, image_data
		 FROM homepage_sections
		 WHERE id = $1 AND image_data IS NOT NULL
		 LIMIT 1`,
		strings.TrimSpace(id),
	).Scan(&section.ID, &section.ImageFilename, &section.ImageContentType, &section.ImageData)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.HomepageSection{}, ErrNotFound
	}
	return section, err
}

func scanCategory(scanner interface {
	Scan(dest ...any) error
}) (models.Category, error) {
	var category models.Category
	err := scanner.Scan(
		&category.Slug,
		&category.Title,
		&category.Subtitle,
		&category.SortOrder,
		&category.Status,
		&category.CreatedAt,
		&category.UpdatedAt,
	)
	return category, err
}

func scanHomepageSection(scanner interface {
	Scan(dest ...any) error
}) (models.HomepageSection, error) {
	var section models.HomepageSection
	err := scanner.Scan(
		&section.ID,
		&section.Eyebrow,
		&section.Title,
		&section.CTALabel,
		&section.To,
		&section.Alt,
		&section.ImageFilename,
		&section.ImageContentType,
		&section.ImageClassName,
		&section.SortOrder,
		&section.Status,
		&section.CreatedAt,
		&section.UpdatedAt,
	)
	return section, err
}

func normalizeCategory(category *models.Category) {
	category.Slug = strings.TrimSpace(category.Slug)
	category.Title = strings.TrimSpace(category.Title)
	category.Subtitle = strings.TrimSpace(category.Subtitle)
	category.Status = normalizeContentStatus(category.Status)
}

func normalizeHomepageSection(section *models.HomepageSection) {
	section.ID = strings.TrimSpace(section.ID)
	section.Eyebrow = strings.TrimSpace(section.Eyebrow)
	section.Title = strings.TrimSpace(section.Title)
	section.CTALabel = strings.TrimSpace(section.CTALabel)
	section.To = strings.TrimSpace(section.To)
	section.Alt = strings.TrimSpace(section.Alt)
	section.ImageFilename = strings.TrimSpace(section.ImageFilename)
	section.ImageContentType = strings.TrimSpace(section.ImageContentType)
	section.ImageClassName = strings.TrimSpace(section.ImageClassName)
	section.Status = normalizeContentStatus(section.Status)
}

func normalizeContentStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "draft":
		return "draft"
	default:
		return "active"
	}
}

func nullableBytes(data []byte) any {
	if len(data) == 0 {
		return nil
	}
	return data
}
