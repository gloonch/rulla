package database

import (
	"context"
	"fmt"
	"time"

	"rulla-server/internal/config"

	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresDB struct {
	pool *pgxpool.Pool
}

func NewPostgresDB(cfg config.DatabaseConfig) (*PostgresDB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(cfg.ConnectTimeout)*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("parse postgres config: %w", err)
	}
	poolConfig.MaxConns = cfg.MaxPoolSize
	poolConfig.MinConns = cfg.MinPoolSize
	poolConfig.MaxConnIdleTime = 30 * time.Minute
	poolConfig.HealthCheckPeriod = 30 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("connect postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	db := &PostgresDB{pool: pool}
	if err := db.createSchema(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return db, nil
}

func (p *PostgresDB) Close() {
	if p != nil && p.pool != nil {
		p.pool.Close()
	}
}

func (p *PostgresDB) Pool() *pgxpool.Pool {
	return p.pool
}

func (p *PostgresDB) createSchema(ctx context.Context) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS contact_requests (
			id TEXT PRIMARY KEY,
			full_name TEXT NOT NULL,
			contact TEXT NOT NULL,
			message TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at ON contact_requests (created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_contact_requests_contact ON contact_requests (contact)`,
		`CREATE TABLE IF NOT EXISTS course_signups (
			id TEXT PRIMARY KEY,
			phone TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_course_signups_created_at ON course_signups (created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_course_signups_phone ON course_signups (phone)`,
		`CREATE TABLE IF NOT EXISTS project_images (
			id TEXT PRIMARY KEY,
			filename TEXT NOT NULL UNIQUE,
			alt TEXT NOT NULL,
			content_type TEXT NOT NULL,
			data BYTEA NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_project_images_sort_order ON project_images (sort_order, filename)`,
		`CREATE TABLE IF NOT EXISTS hero_slides (
			id TEXT PRIMARY KEY,
			filename TEXT NOT NULL UNIQUE,
			alt TEXT NOT NULL,
			content_type TEXT NOT NULL,
			data BYTEA NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_hero_slides_sort_order ON hero_slides (sort_order, filename)`,
		`CREATE TABLE IF NOT EXISTS categories (
			slug TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			subtitle TEXT NOT NULL DEFAULT '',
			sort_order INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_categories_status_sort_order ON categories (status, sort_order, slug)`,
		`CREATE TABLE IF NOT EXISTS homepage_sections (
			id TEXT PRIMARY KEY,
			eyebrow TEXT NOT NULL DEFAULT '',
			title TEXT NOT NULL,
			cta_label TEXT NOT NULL DEFAULT '',
			to_url TEXT NOT NULL DEFAULT '',
			alt TEXT NOT NULL DEFAULT '',
			image_filename TEXT NOT NULL DEFAULT '',
			image_content_type TEXT NOT NULL DEFAULT '',
			image_data BYTEA,
			image_class_name TEXT NOT NULL DEFAULT '',
			sort_order INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_homepage_sections_status_sort_order ON homepage_sections (status, sort_order, id)`,
		`CREATE TABLE IF NOT EXISTS courses (
			id TEXT PRIMARY KEY,
			slug TEXT NOT NULL UNIQUE,
			title TEXT NOT NULL,
			subtitle TEXT NOT NULL DEFAULT '',
			term TEXT NOT NULL DEFAULT '',
			level TEXT NOT NULL DEFAULT '',
			format TEXT NOT NULL DEFAULT '',
			duration TEXT NOT NULL DEFAULT '',
			summary TEXT NOT NULL DEFAULT '',
			description TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'draft',
			image_id TEXT NOT NULL DEFAULT '',
			sort_order INTEGER NOT NULL DEFAULT 0,
			outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
			audience JSONB NOT NULL DEFAULT '[]'::jsonb,
			lessons JSONB NOT NULL DEFAULT '[]'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE courses ADD COLUMN IF NOT EXISTS image_id TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE courses DROP COLUMN IF EXISTS stats`,
		`UPDATE courses SET status = 'in_progress' WHERE status = 'published'`,
		`CREATE INDEX IF NOT EXISTS idx_courses_status_sort_order ON courses (status, sort_order, slug)`,
		`CREATE TABLE IF NOT EXISTS course_images (
			id TEXT PRIMARY KEY,
			course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
			filename TEXT NOT NULL,
			alt TEXT NOT NULL,
			content_type TEXT NOT NULL,
			data BYTEA NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE (course_id, filename)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_course_images_course_sort_order ON course_images (course_id, sort_order, filename)`,
	}

	for _, query := range statements {
		if _, err := p.pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("create schema: %w", err)
		}
	}

	return nil
}
