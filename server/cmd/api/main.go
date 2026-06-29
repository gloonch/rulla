package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"rulla-server/internal/config"
	"rulla-server/internal/database"
	httpapi "rulla-server/internal/http"
	"rulla-server/internal/seed"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, using environment variables")
	}

	cfg := config.Load()

	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer db.Close()

	contentSeedCtx, contentSeedCancel := context.WithTimeout(context.Background(), 90*time.Second)
	if err := seed.Content(contentSeedCtx, db, cfg.Seed.ProductAssetsDir, cfg.Seed.HomepageAssetsDir); err != nil {
		contentSeedCancel()
		log.Fatalf("content seed failed: %v", err)
	}
	contentSeedCancel()

	seedCtx, seedCancel := context.WithTimeout(context.Background(), 60*time.Second)
	if err := seed.ProjectImages(seedCtx, db, cfg.Seed.ProjectImagesDir); err != nil {
		seedCancel()
		log.Fatalf("project image seed failed: %v", err)
	}
	seedCancel()

	router := httpapi.NewRouter(db, cfg)
	server := &http.Server{
		Addr:              ":" + cfg.App.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("rulla api listening on :%s", cfg.App.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("server shutdown failed: %v", err)
	}
}
