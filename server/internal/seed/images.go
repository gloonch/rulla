package seed

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"rulla-server/internal/database"
	"rulla-server/internal/models"
)

var allowedImageExtensions = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".webp": {},
}

func ProjectImages(ctx context.Context, db *database.PostgresDB, dir string) error {
	if dir == "" {
		return nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			log.Printf("project image seed skipped: %s does not exist", dir)
			return nil
		}
		return fmt.Errorf("read project image seed directory: %w", err)
	}

	existing, err := existingFilenames(ctx, db)
	if err != nil {
		return err
	}

	nextOrder, err := nextSortOrder(ctx, db)
	if err != nil {
		return err
	}

	names := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))
		if _, ok := allowedImageExtensions[ext]; ok {
			names = append(names, name)
		}
	}
	sort.Strings(names)

	now := time.Now().UTC()
	documents := make([]models.ProjectImage, 0, len(names))
	for _, name := range names {
		if _, ok := existing[name]; ok {
			continue
		}

		fullPath := filepath.Join(dir, name)
		data, err := os.ReadFile(fullPath)
		if err != nil {
			return fmt.Errorf("read seed image %s: %w", fullPath, err)
		}

		documents = append(documents, models.ProjectImage{
			ID:          generateID(),
			Filename:    name,
			Alt:         fmt.Sprintf("نمونه‌کار %d", nextOrder+1),
			ContentType: detectContentType(name, data),
			Data:        data,
			SortOrder:   nextOrder,
			CreatedAt:   now,
		})
		nextOrder++
	}

	if len(documents) == 0 {
		return nil
	}

	tx, err := db.Pool().Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin seed transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, image := range documents {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO project_images (id, filename, alt, content_type, data, sort_order, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 ON CONFLICT (filename) DO NOTHING`,
			image.ID,
			image.Filename,
			image.Alt,
			image.ContentType,
			image.Data,
			image.SortOrder,
			image.CreatedAt,
		); err != nil {
			return fmt.Errorf("insert seed project image %s: %w", image.Filename, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit seed transaction: %w", err)
	}

	log.Printf("seeded %d project images from %s", len(documents), dir)
	return nil
}

func existingFilenames(ctx context.Context, db *database.PostgresDB) (map[string]struct{}, error) {
	rows, err := db.Pool().Query(ctx, `SELECT filename FROM project_images`)
	if err != nil {
		return nil, fmt.Errorf("query existing project images: %w", err)
	}
	defer rows.Close()

	existing := make(map[string]struct{})
	for rows.Next() {
		var filename string
		if err := rows.Scan(&filename); err != nil {
			return nil, fmt.Errorf("decode existing project image: %w", err)
		}
		existing[filename] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate existing project images: %w", err)
	}

	return existing, nil
}

func nextSortOrder(ctx context.Context, db *database.PostgresDB) (int, error) {
	var nextOrder int
	if err := db.Pool().QueryRow(ctx, `SELECT COALESCE(MAX(sort_order), -1) + 1 FROM project_images`).Scan(&nextOrder); err != nil {
		return 0, fmt.Errorf("query next project image sort order: %w", err)
	}
	if nextOrder < 0 {
		return 0, nil
	}
	return nextOrder, nil
}

func detectContentType(filename string, data []byte) string {
	if contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(filename))); contentType != "" {
		return contentType
	}

	sampleSize := len(data)
	if sampleSize > 512 {
		sampleSize = 512
	}
	return http.DetectContentType(data[:sampleSize])
}

func generateID() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("seed-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}
