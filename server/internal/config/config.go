package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	App      AppConfig
	Database DatabaseConfig
	Seed     SeedConfig
	Admin    AdminConfig
}

type AppConfig struct {
	Environment    string
	Port           string
	BaseURL        string
	AllowedOrigins []string
}

type DatabaseConfig struct {
	URL            string
	Name           string
	Host           string
	Port           string
	User           string
	Password       string
	SSLMode        string
	ConnectTimeout int
	MaxPoolSize    int32
	MinPoolSize    int32
}

type SeedConfig struct {
	ProjectImagesDir  string
	ProductAssetsDir  string
	HomepageAssetsDir string
}

type AdminConfig struct {
	Username string
	Password string
	Token    string
}

func Load() *Config {
	databaseName := getEnv("POSTGRES_DB", getEnv("DB_NAME", "rulla"))
	dbHost := getEnv("POSTGRES_HOST", getEnv("DB_HOST", "localhost"))
	dbPort := getEnv("POSTGRES_PORT", "5432")
	dbUser := getEnv("POSTGRES_USER", getEnv("DB_USER", "postgres"))
	dbPassword := getEnv("POSTGRES_PASSWORD", getEnv("DB_PASSWORD", "postgres"))
	dbSSLMode := getEnv("POSTGRES_SSLMODE", "disable")

	return &Config{
		App: AppConfig{
			Environment:    getEnv("ENVIRONMENT", getEnv("APP_ENV", "development")),
			Port:           getEnv("PORT", "8080"),
			BaseURL:        strings.TrimRight(getEnv("BASE_URL", "http://localhost:8080"), "/"),
			AllowedOrigins: splitCSV(getEnv("ALLOWED_ORIGINS", "http://localhost:5173,https://rullaahmadi.com,https://www.rullaahmadi.com")),
		},
		Database: DatabaseConfig{
			URL:            postgresURL(databaseName, dbHost, dbPort, dbUser, dbPassword, dbSSLMode),
			Name:           databaseName,
			Host:           dbHost,
			Port:           dbPort,
			User:           dbUser,
			Password:       dbPassword,
			SSLMode:        dbSSLMode,
			ConnectTimeout: getEnvAsInt("POSTGRES_CONNECT_TIMEOUT", getEnvAsInt("DB_CONNECT_TIMEOUT", 30)),
			MaxPoolSize:    int32(getEnvAsInt("POSTGRES_MAX_POOL_SIZE", getEnvAsInt("DB_MAX_POOL_SIZE", 40))),
			MinPoolSize:    int32(getEnvAsInt("POSTGRES_MIN_POOL_SIZE", getEnvAsInt("DB_MIN_POOL_SIZE", 2))),
		},
		Seed: SeedConfig{
			ProjectImagesDir:  getEnv("PROJECT_IMAGES_DIR", "assets/project_images"),
			ProductAssetsDir:  getEnv("PRODUCT_ASSETS_DIR", "../client/src/assets/products"),
			HomepageAssetsDir: getEnv("HOMEPAGE_ASSETS_DIR", "../client/src/assets"),
		},
		Admin: AdminConfig{
			Username: getEnv("ADMIN_USERNAME", "admin"),
			Password: getEnv("ADMIN_PASSWORD", "admin@123!"),
			Token:    getEnv("ADMIN_TOKEN", "rulla-admin-dev-token"),
		},
	}
}

func postgresURL(databaseName, host, port, username, password, sslmode string) string {
	if dsn := getEnv("POSTGRES_DSN", ""); dsn != "" {
		return dsn
	}
	if dsn := getEnv("POSTGRES_URL", ""); dsn != "" {
		return dsn
	}
	if dsn := getEnv("DATABASE_URL", ""); dsn != "" {
		return dsn
	}

	query := url.Values{}
	query.Set("sslmode", sslmode)
	return fmt.Sprintf(
		"postgres://%s@%s:%s/%s?%s",
		url.UserPassword(username, password).String(),
		host,
		port,
		databaseName,
		query.Encode(),
	)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
