package httpapi

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"rulla-server/internal/config"
	"rulla-server/internal/database"

	"github.com/gin-gonic/gin"
)

func NewRouter(db *database.PostgresDB, cfg *config.Config) *gin.Engine {
	if cfg.App.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()
	router.RedirectTrailingSlash = false
	router.RedirectFixedPath = false
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(corsMiddleware(cfg.App.AllowedOrigins))

	handler := NewHandler(db, cfg)

	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "rulla-api",
		})
	})

	v1 := router.Group("/api/v1")
	{
		v1.POST("/contact-requests", handler.CreateContactRequest)
		v1.POST("/course-signups", handler.CreateCourseSignup)
		v1.GET("/categories", handler.ListCategories)
		v1.GET("/homepage-sections", handler.ListHomepageSections)
		v1.GET("/homepage-sections/:id/image", handler.GetHomepageSectionImage)
		v1.GET("/images", handler.ListProjectImages)
		v1.GET("/images/:id/content", handler.GetProjectImageContent)
		v1.GET("/hero-slides", handler.ListHeroSlides)
		v1.GET("/hero-slides/:id/content", handler.GetHeroSlideContent)
		v1.GET("/courses", handler.ListCourses)
		v1.GET("/courses/:id", handler.GetCourse)
		v1.GET("/courses/:id/images/:imageId/content", handler.GetCourseImageContent)

		admin := v1.Group("/admin")
		{
			admin.POST("/login", handler.AdminLogin)

			protected := admin.Group("")
			protected.Use(adminAuthMiddleware(cfg.Admin.Token))
			{
				protected.GET("/contact-requests", handler.ListContactRequests)
				protected.DELETE("/contact-requests/:id", handler.DeleteContactRequest)
				protected.GET("/course-signups", handler.ListCourseSignups)
				protected.DELETE("/course-signups/:id", handler.DeleteCourseSignup)
				protected.GET("/categories", handler.ListAdminCategories)
				protected.POST("/categories", handler.CreateAdminCategory)
				protected.PUT("/categories/:slug", handler.UpdateAdminCategory)
				protected.DELETE("/categories/:slug", handler.DeleteAdminCategory)
				protected.GET("/homepage-sections", handler.ListAdminHomepageSections)
				protected.POST("/homepage-sections", handler.CreateAdminHomepageSection)
				protected.PUT("/homepage-sections/:id", handler.UpdateAdminHomepageSection)
				protected.DELETE("/homepage-sections/:id", handler.DeleteAdminHomepageSection)
				protected.POST("/homepage-sections/:id/image", handler.UploadAdminHomepageSectionImage)
				protected.DELETE("/homepage-sections/:id/image", handler.DeleteAdminHomepageSectionImage)
				protected.GET("/project-images", handler.ListProjectImages)
				protected.POST("/project-images", handler.UploadProjectImages)
				protected.DELETE("/project-images/:id", handler.DeleteProjectImage)
				protected.GET("/hero-slides", handler.ListHeroSlides)
				protected.POST("/hero-slides", handler.UploadHeroSlides)
				protected.DELETE("/hero-slides/:id", handler.DeleteHeroSlide)
				protected.GET("/courses", handler.ListAdminCourses)
				protected.POST("/courses", handler.CreateAdminCourse)
				protected.GET("/courses/:id", handler.GetAdminCourse)
				protected.PUT("/courses/:id", handler.UpdateAdminCourse)
				protected.DELETE("/courses/:id", handler.DeleteAdminCourse)
				protected.GET("/courses/:id/images", handler.ListCourseImages)
				protected.POST("/courses/:id/images", handler.UploadCourseImages)
				protected.DELETE("/courses/:id/images/:imageId", handler.DeleteCourseImage)
			}
		}
	}

	return router
}

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	allowAll := false
	for _, origin := range allowedOrigins {
		if origin == "*" {
			allowAll = true
			continue
		}
		allowed[strings.TrimRight(origin, "/")] = struct{}{}
	}

	return func(c *gin.Context) {
		origin := strings.TrimRight(c.GetHeader("Origin"), "/")
		if origin != "" {
			if allowAll {
				c.Header("Access-Control-Allow-Origin", origin)
			} else if _, ok := allowed[origin]; ok {
				c.Header("Access-Control-Allow-Origin", origin)
			}
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
		}

		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == http.MethodOptions {
			c.Status(http.StatusNoContent)
			c.Abort()
			return
		}

		c.Next()
	}
}

func adminAuthMiddleware(token string) gin.HandlerFunc {
	expected := "Bearer " + token

	return func(c *gin.Context) {
		got := c.GetHeader("Authorization")
		if subtle.ConstantTimeCompare([]byte(got), []byte(expected)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "دسترسی ادمین معتبر نیست."})
			return
		}

		c.Next()
	}
}
