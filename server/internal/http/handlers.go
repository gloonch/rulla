package httpapi

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"rulla-server/internal/config"
	"rulla-server/internal/database"
	"rulla-server/internal/models"
	"rulla-server/internal/repository"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db      *database.PostgresDB
	cfg     *config.Config
	courses *repository.CourseRepository
	content *repository.ContentRepository
}

const (
	contactMessageMinLength = 10
	contactMessageMaxLength = 2000

	projectImagesTable = "project_images"
	heroSlidesTable    = "hero_slides"
)

type createContactRequestBody struct {
	FullName string `json:"fullName" binding:"required,max=120"`
	Contact  string `json:"contact" binding:"required,max=32"`
	Message  string `json:"message" binding:"required"`
}

type createCourseSignupBody struct {
	Phone string `json:"phone" binding:"required,max=32"`
}

type adminLoginBody struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type contactRequestResponse struct {
	ID        string    `json:"id"`
	FullName  string    `json:"fullName"`
	Contact   string    `json:"contact"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

type courseSignupResponse struct {
	ID        string    `json:"id"`
	Phone     string    `json:"phone"`
	CreatedAt time.Time `json:"createdAt"`
}

type projectImageResponse struct {
	ID          string `json:"id"`
	Alt         string `json:"alt"`
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	URL         string `json:"url"`
	SortOrder   int    `json:"sortOrder"`
}

type uploadImageResult struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	URL         string `json:"url"`
}

type courseWithImagesResponse struct {
	Course models.Course        `json:"course"`
	Images []models.CourseImage `json:"images"`
}

func NewHandler(db *database.PostgresDB, cfg *config.Config) *Handler {
	return &Handler{
		db:      db,
		cfg:     cfg,
		courses: repository.NewCourseRepository(db.Pool()),
		content: repository.NewContentRepository(db.Pool()),
	}
}

func (h *Handler) AdminLogin(c *gin.Context) {
	var body adminLoginBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "نام کاربری و رمز عبور الزامی است."})
		return
	}

	usernameMatch := subtle.ConstantTimeCompare([]byte(body.Username), []byte(h.cfg.Admin.Username)) == 1
	passwordMatch := subtle.ConstantTimeCompare([]byte(body.Password), []byte(h.cfg.Admin.Password)) == 1
	if !usernameMatch || !passwordMatch {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "نام کاربری یا رمز عبور درست نیست."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": h.cfg.Admin.Token,
		"user": gin.H{
			"username": h.cfg.Admin.Username,
		},
	})
}

func (h *Handler) ListCategories(c *gin.Context) {
	h.listCategories(c, false)
}

func (h *Handler) ListAdminCategories(c *gin.Context) {
	h.listCategories(c, true)
}

func (h *Handler) listCategories(c *gin.Context, includeDrafts bool) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	categories, err := h.content.ListCategories(ctx, includeDrafts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دسته‌بندی‌ها انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}

func (h *Handler) CreateAdminCategory(c *gin.Context) {
	var category models.Category
	if err := c.ShouldBindJSON(&category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات دسته‌بندی معتبر نیست."})
		return
	}
	if err := validateCategory(category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	created, err := h.content.CreateCategory(ctx, category)
	if err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "اسلاگ دسته‌بندی تکراری است."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ساخت دسته‌بندی انجام نشد."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"category": created})
}

func (h *Handler) UpdateAdminCategory(c *gin.Context) {
	var category models.Category
	if err := c.ShouldBindJSON(&category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات دسته‌بندی معتبر نیست."})
		return
	}
	if err := validateCategory(category); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	updated, err := h.content.UpdateCategory(ctx, strings.TrimSpace(c.Param("slug")), category)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دسته‌بندی پیدا نشد."})
		return
	}
	if err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "اسلاگ دسته‌بندی تکراری است."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ویرایش دسته‌بندی انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"category": updated})
}

func (h *Handler) DeleteAdminCategory(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	err := h.content.DeleteCategory(ctx, strings.TrimSpace(c.Param("slug")))
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دسته‌بندی پیدا نشد."})
		return
	}
	if err != nil {
		if isForeignKeyViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "این دسته‌بندی محصول دارد و قابل حذف نیست."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف دسته‌بندی انجام نشد."})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) ListHomepageSections(c *gin.Context) {
	h.listHomepageSections(c, false)
}

func (h *Handler) ListAdminHomepageSections(c *gin.Context) {
	h.listHomepageSections(c, true)
}

func (h *Handler) listHomepageSections(c *gin.Context, includeDrafts bool) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	sections, err := h.content.ListHomepageSections(ctx, includeDrafts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت بخش‌های صفحه اصلی انجام نشد."})
		return
	}
	h.attachHomepageSectionImageURLs(sections)

	c.JSON(http.StatusOK, gin.H{"sections": sections})
}

func (h *Handler) CreateAdminHomepageSection(c *gin.Context) {
	var section models.HomepageSection
	if err := c.ShouldBindJSON(&section); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات بخش صفحه اصلی معتبر نیست."})
		return
	}
	if err := validateHomepageSection(section); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	created, err := h.content.CreateHomepageSection(ctx, section)
	if err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "شناسه بخش تکراری است."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ساخت بخش صفحه اصلی انجام نشد."})
		return
	}
	h.attachHomepageSectionImageURL(&created)

	c.JSON(http.StatusCreated, gin.H{"section": created})
}

func (h *Handler) UpdateAdminHomepageSection(c *gin.Context) {
	var section models.HomepageSection
	if err := c.ShouldBindJSON(&section); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات بخش صفحه اصلی معتبر نیست."})
		return
	}
	if err := validateHomepageSection(section); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	updated, err := h.content.UpdateHomepageSection(ctx, strings.TrimSpace(c.Param("id")), section)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "بخش صفحه اصلی پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ویرایش بخش صفحه اصلی انجام نشد."})
		return
	}
	h.attachHomepageSectionImageURL(&updated)

	c.JSON(http.StatusOK, gin.H{"section": updated})
}

func (h *Handler) DeleteAdminHomepageSection(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	err := h.content.DeleteHomepageSection(ctx, strings.TrimSpace(c.Param("id")))
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "بخش صفحه اصلی پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف بخش صفحه اصلی انجام نشد."})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) UploadAdminHomepageSectionImage(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(128 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "فایل تصویر معتبر نیست."})
		return
	}

	files := uploadedFiles(c.Request.MultipartForm)
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "حداقل یک تصویر انتخاب کنید."})
		return
	}

	image, err := imageFromUploadHeader(files[0], "تصویر صفحه اصلی", 0, time.Now().UTC())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	updated, err := h.content.SetHomepageSectionImage(
		ctx,
		strings.TrimSpace(c.Param("id")),
		image.Filename,
		image.ContentType,
		image.Data,
	)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "بخش صفحه اصلی پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ذخیره تصویر بخش انجام نشد."})
		return
	}
	h.attachHomepageSectionImageURL(&updated)

	c.JSON(http.StatusOK, gin.H{"section": updated})
}

func (h *Handler) DeleteAdminHomepageSectionImage(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	updated, err := h.content.ClearHomepageSectionImage(ctx, strings.TrimSpace(c.Param("id")))
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "بخش صفحه اصلی پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف تصویر بخش انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"section": updated})
}

func (h *Handler) GetHomepageSectionImage(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	section, err := h.content.GetHomepageSectionImage(ctx, strings.TrimSpace(c.Param("id")))
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "تصویر بخش پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصویر بخش انجام نشد."})
		return
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", section.ImageFilename))
	c.Data(http.StatusOK, section.ImageContentType, section.ImageData)
}

func (h *Handler) CreateContactRequest(c *gin.Context) {
	var body createContactRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات فرم کامل نیست."})
		return
	}

	body.FullName = strings.TrimSpace(body.FullName)
	body.Contact = normalizeDigits(strings.TrimSpace(body.Contact))
	body.Message = strings.TrimSpace(body.Message)
	if body.FullName == "" || body.Contact == "" || body.Message == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات فرم کامل نیست."})
		return
	}
	if !isDigitsOnly(body.Contact) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "شماره تلفن باید فقط شامل عدد باشد."})
		return
	}

	messageLength := utf8.RuneCountInString(body.Message)
	if messageLength < contactMessageMinLength || messageLength > contactMessageMaxLength {
		c.JSON(http.StatusBadRequest, gin.H{"error": "طول متن پیام معتبر نیست."})
		return
	}

	now := time.Now().UTC()
	request := models.ContactRequest{
		ID:        generateID(),
		FullName:  body.FullName,
		Contact:   body.Contact,
		Message:   body.Message,
		CreatedAt: now,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err := h.db.Pool().Exec(
		ctx,
		`INSERT INTO contact_requests (id, full_name, contact, message, created_at) VALUES ($1, $2, $3, $4, $5)`,
		request.ID,
		request.FullName,
		request.Contact,
		request.Message,
		request.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ذخیره پیام انجام نشد."})
		return
	}

	c.JSON(http.StatusCreated, contactRequestResponse{
		ID:        request.ID,
		FullName:  request.FullName,
		Contact:   request.Contact,
		Message:   request.Message,
		CreatedAt: request.CreatedAt,
	})
}

func (h *Handler) ListContactRequests(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	rows, err := h.db.Pool().Query(
		ctx,
		`SELECT id, full_name, contact, message, created_at FROM contact_requests ORDER BY created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت پیام‌ها انجام نشد."})
		return
	}
	defer rows.Close()

	requests := make([]contactRequestResponse, 0)
	for rows.Next() {
		var request contactRequestResponse
		if err := rows.Scan(&request.ID, &request.FullName, &request.Contact, &request.Message, &request.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "خواندن پیام‌ها انجام نشد."})
			return
		}
		requests = append(requests, request)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "خواندن پیام‌ها انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"contactRequests": requests})
}

func (h *Handler) DeleteContactRequest(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "شناسه پیام معتبر نیست."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	result, err := h.db.Pool().Exec(ctx, `DELETE FROM contact_requests WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف پیام انجام نشد."})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "پیام پیدا نشد."})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) CreateCourseSignup(c *gin.Context) {
	var body createCourseSignupBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "شماره تلفن الزامی است."})
		return
	}

	body.Phone = normalizeDigits(strings.TrimSpace(body.Phone))
	if !isDigitsOnly(body.Phone) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "شماره تلفن باید فقط شامل عدد باشد."})
		return
	}

	now := time.Now().UTC()
	signup := models.CourseSignup{
		ID:        generateID(),
		Phone:     body.Phone,
		CreatedAt: now,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	_, err := h.db.Pool().Exec(
		ctx,
		`INSERT INTO course_signups (id, phone, created_at) VALUES ($1, $2, $3)`,
		signup.ID,
		signup.Phone,
		signup.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ثبت شماره انجام نشد."})
		return
	}

	c.JSON(http.StatusCreated, courseSignupResponse{
		ID:        signup.ID,
		Phone:     signup.Phone,
		CreatedAt: signup.CreatedAt,
	})
}

func (h *Handler) ListCourseSignups(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	rows, err := h.db.Pool().Query(
		ctx,
		`SELECT id, phone, created_at FROM course_signups ORDER BY created_at DESC`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت ثبت‌نام‌های دوره انجام نشد."})
		return
	}
	defer rows.Close()

	signups := make([]courseSignupResponse, 0)
	for rows.Next() {
		var signup courseSignupResponse
		if err := rows.Scan(&signup.ID, &signup.Phone, &signup.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "خواندن ثبت‌نام‌های دوره انجام نشد."})
			return
		}
		signups = append(signups, signup)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "خواندن ثبت‌نام‌های دوره انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"courseSignups": signups})
}

func (h *Handler) DeleteCourseSignup(c *gin.Context) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "شناسه ثبت‌نام معتبر نیست."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	result, err := h.db.Pool().Exec(ctx, `DELETE FROM course_signups WHERE id = $1`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف ثبت‌نام انجام نشد."})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ثبت‌نام پیدا نشد."})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) ListCourses(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	courses, err := h.courses.ListCourses(ctx, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دوره‌ها انجام نشد."})
		return
	}
	if err := h.attachCourseImagesToList(ctx, courses); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصاویر دوره‌ها انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"courses": courses})
}

func (h *Handler) GetCourse(c *gin.Context) {
	h.getCourse(c, false)
}

func (h *Handler) ListAdminCourses(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	courses, err := h.courses.ListCourses(ctx, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دوره‌ها انجام نشد."})
		return
	}
	if err := h.attachCourseImagesToList(ctx, courses); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصاویر دوره‌ها انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"courses": courses})
}

func (h *Handler) GetAdminCourse(c *gin.Context) {
	h.getCourse(c, true)
}

func (h *Handler) CreateAdminCourse(c *gin.Context) {
	var course models.Course
	if err := c.ShouldBindJSON(&course); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات دوره معتبر نیست."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	created, err := h.courses.CreateCourse(ctx, course)
	if err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "شناسه یا آدرس دوره تکراری است."})
			return
		}
		if isForeignKeyViolation(err) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "دسته‌بندی محصول معتبر نیست."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ساخت دوره انجام نشد."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"course": created})
}

func (h *Handler) UpdateAdminCourse(c *gin.Context) {
	var course models.Course
	if err := c.ShouldBindJSON(&course); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "اطلاعات دوره معتبر نیست."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	updated, err := h.courses.UpdateCourse(ctx, strings.TrimSpace(c.Param("id")), course)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دوره پیدا نشد."})
		return
	}
	if err != nil {
		if isUniqueViolation(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "شناسه یا آدرس دوره تکراری است."})
			return
		}
		if isForeignKeyViolation(err) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "دسته‌بندی محصول معتبر نیست."})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ویرایش دوره انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"course": updated})
}

func (h *Handler) DeleteAdminCourse(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	err := h.courses.DeleteCourse(ctx, strings.TrimSpace(c.Param("id")))
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دوره پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف دوره انجام نشد."})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) ListCourseImages(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	course, err := h.courses.GetCourse(ctx, strings.TrimSpace(c.Param("id")), true)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دوره پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دوره انجام نشد."})
		return
	}

	images, err := h.courseImagesWithURLs(ctx, course.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصاویر دوره انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"images": images})
}

func (h *Handler) UploadCourseImages(c *gin.Context) {
	if err := c.Request.ParseMultipartForm(128 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "فایل‌های تصویر معتبر نیستند."})
		return
	}

	files := uploadedFiles(c.Request.MultipartForm)
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "حداقل یک تصویر انتخاب کنید."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	course, err := h.courses.GetCourse(ctx, strings.TrimSpace(c.Param("id")), true)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دوره پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دوره انجام نشد."})
		return
	}

	existing, err := h.courses.ListImages(ctx, course.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "آماده‌سازی آپلود انجام نشد."})
		return
	}

	uploaded := make([]models.CourseImage, 0, len(files))
	for index, header := range files {
		imageDoc, err := imageFromUploadHeader(header, fmt.Sprintf("تصویر دوره %d", len(existing)+index+1), len(existing)+index, time.Now().UTC())
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		image, err := h.courses.CreateImage(ctx, models.CourseImage{
			ID:          imageDoc.ID,
			CourseID:    course.ID,
			Filename:    imageDoc.Filename,
			Alt:         imageDoc.Alt,
			ContentType: imageDoc.ContentType,
			Data:        imageDoc.Data,
			SortOrder:   imageDoc.SortOrder,
			CreatedAt:   imageDoc.CreatedAt,
		})
		if err != nil {
			if isUniqueViolation(err) {
				c.JSON(http.StatusConflict, gin.H{"error": "تصویر تکراری است."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ذخیره تصاویر دوره انجام نشد."})
			return
		}
		image.URL = h.courseImageURL(course.ID, image.ID)
		uploaded = append(uploaded, image)
	}

	c.JSON(http.StatusCreated, gin.H{"images": uploaded})
}

func (h *Handler) DeleteCourseImage(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	course, err := h.courses.GetCourse(ctx, strings.TrimSpace(c.Param("id")), true)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دوره پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دوره انجام نشد."})
		return
	}

	err = h.courses.DeleteImage(ctx, course.ID, strings.TrimSpace(c.Param("imageId")))
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "تصویر پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف تصویر دوره انجام نشد."})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) GetCourseImageContent(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	course, err := h.courses.GetCourse(ctx, strings.TrimSpace(c.Param("id")), true)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دوره پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دوره انجام نشد."})
		return
	}

	image, err := h.courses.GetImageContent(ctx, course.ID, strings.TrimSpace(c.Param("imageId")))
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "تصویر پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصویر انجام نشد."})
		return
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", image.Filename))
	c.Data(http.StatusOK, image.ContentType, image.Data)
}

func (h *Handler) getCourse(c *gin.Context, includeDrafts bool) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	course, err := h.courses.GetCourse(ctx, strings.TrimSpace(c.Param("id")), includeDrafts)
	if errors.Is(err, repository.ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "دوره پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت دوره انجام نشد."})
		return
	}

	images, err := h.courseImagesWithURLs(ctx, course.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصاویر دوره انجام نشد."})
		return
	}
	h.attachLessonImageURLs(&course, images)
	h.attachCourseImageURL(&course, images)

	c.JSON(http.StatusOK, courseWithImagesResponse{Course: course, Images: images})
}

func (h *Handler) ListProjectImages(c *gin.Context) {
	h.listImages(c, projectImagesTable, h.projectImageURL)
}

func (h *Handler) UploadProjectImages(c *gin.Context) {
	h.uploadImages(c, projectImagesTable, "نمونه‌کار", h.projectImageURL)
}

func (h *Handler) DeleteProjectImage(c *gin.Context) {
	h.deleteImage(c, projectImagesTable)
}

func (h *Handler) ListHeroSlides(c *gin.Context) {
	h.listImages(c, heroSlidesTable, h.heroSlideURL)
}

func (h *Handler) UploadHeroSlides(c *gin.Context) {
	h.uploadImages(c, heroSlidesTable, "اسلاید", h.heroSlideURL)
}

func (h *Handler) DeleteHeroSlide(c *gin.Context) {
	h.deleteImage(c, heroSlidesTable)
}

func (h *Handler) listImages(c *gin.Context, table string, urlForID func(string) string) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	query, err := imageListQuery(table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "تنظیمات تصویر معتبر نیست."})
		return
	}

	rows, err := h.db.Pool().Query(ctx, query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصاویر انجام نشد."})
		return
	}
	defer rows.Close()

	images := make([]projectImageResponse, 0)
	for rows.Next() {
		var image projectImageResponse
		if err := rows.Scan(&image.ID, &image.Alt, &image.Filename, &image.ContentType, &image.SortOrder); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "خواندن تصاویر انجام نشد."})
			return
		}
		image.URL = urlForID(image.ID)
		images = append(images, image)
	}
	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "خواندن تصاویر انجام نشد."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"images": images})
}

func (h *Handler) GetProjectImageContent(c *gin.Context) {
	h.getImageContent(c, projectImagesTable)
}

func (h *Handler) GetHeroSlideContent(c *gin.Context) {
	h.getImageContent(c, heroSlidesTable)
}

func (h *Handler) getImageContent(c *gin.Context, table string) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "شناسه تصویر معتبر نیست."})
		return
	}

	query, err := imageContentQuery(table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "تنظیمات تصویر معتبر نیست."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var filename string
	var contentType string
	var data []byte
	err = h.db.Pool().QueryRow(ctx, query, id).Scan(&filename, &contentType, &data)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "تصویر پیدا نشد."})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "دریافت تصویر انجام نشد."})
		return
	}

	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", filename))
	c.Data(http.StatusOK, contentType, data)
}

func (h *Handler) uploadImages(c *gin.Context, table string, altPrefix string, urlForID func(string) string) {
	if err := c.Request.ParseMultipartForm(128 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "فایل‌های تصویر معتبر نیستند."})
		return
	}

	files := uploadedFiles(c.Request.MultipartForm)
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "حداقل یک تصویر انتخاب کنید."})
		return
	}

	insertQuery, err := imageInsertQuery(table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "تنظیمات تصویر معتبر نیست."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	startOrder, err := nextSortOrder(ctx, h.db.Pool(), table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "آماده‌سازی آپلود انجام نشد."})
		return
	}

	now := time.Now().UTC()
	uploaded := make([]uploadImageResult, 0, len(files))

	tx, err := h.db.Pool().Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ذخیره تصاویر انجام نشد."})
		return
	}
	defer tx.Rollback(ctx)

	for index, header := range files {
		image, err := imageFromUploadHeader(header, fmt.Sprintf("%s %d", altPrefix, startOrder+index+1), startOrder+index, now)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, err = tx.Exec(
			ctx,
			insertQuery,
			image.ID,
			image.Filename,
			image.Alt,
			image.ContentType,
			image.Data,
			image.SortOrder,
			image.CreatedAt,
		)
		if err != nil {
			if isUniqueViolation(err) {
				c.JSON(http.StatusConflict, gin.H{"error": "تصویر تکراری است."})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ذخیره تصاویر انجام نشد."})
			return
		}

		uploaded = append(uploaded, uploadImageResult{
			ID:          image.ID,
			Filename:    image.Filename,
			ContentType: image.ContentType,
			URL:         urlForID(image.ID),
		})
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ذخیره تصاویر انجام نشد."})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"images": uploaded})
}

func (h *Handler) deleteImage(c *gin.Context, table string) {
	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "شناسه تصویر معتبر نیست."})
		return
	}

	query, err := imageDeleteQuery(table)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "تنظیمات تصویر معتبر نیست."})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	result, err := h.db.Pool().Exec(ctx, query, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "حذف تصویر انجام نشد."})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "تصویر پیدا نشد."})
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) projectImageURL(id string) string {
	return fmt.Sprintf("%s/api/v1/images/%s/content", strings.TrimRight(h.cfg.App.BaseURL, "/"), id)
}

func (h *Handler) heroSlideURL(id string) string {
	return fmt.Sprintf("%s/api/v1/hero-slides/%s/content", strings.TrimRight(h.cfg.App.BaseURL, "/"), id)
}

func (h *Handler) homepageSectionImageURL(id string) string {
	return fmt.Sprintf("%s/api/v1/homepage-sections/%s/image", strings.TrimRight(h.cfg.App.BaseURL, "/"), id)
}

func (h *Handler) courseImageURL(courseID string, imageID string) string {
	return fmt.Sprintf("%s/api/v1/courses/%s/images/%s/content", strings.TrimRight(h.cfg.App.BaseURL, "/"), courseID, imageID)
}

func (h *Handler) attachHomepageSectionImageURL(section *models.HomepageSection) {
	if section.ImageFilename != "" {
		section.ImageURL = h.homepageSectionImageURL(section.ID)
	}
}

func (h *Handler) attachHomepageSectionImageURLs(sections []models.HomepageSection) {
	for index := range sections {
		h.attachHomepageSectionImageURL(&sections[index])
	}
}

func (h *Handler) courseImagesWithURLs(ctx context.Context, courseID string) ([]models.CourseImage, error) {
	images, err := h.courses.ListImages(ctx, courseID)
	if err != nil {
		return nil, err
	}
	for index := range images {
		images[index].URL = h.courseImageURL(courseID, images[index].ID)
	}
	return images, nil
}

func (h *Handler) attachLessonImageURLs(course *models.Course, images []models.CourseImage) {
	byID := make(map[string]string, len(images))
	for _, image := range images {
		byID[image.ID] = image.URL
	}
	for index := range course.Lessons {
		if url := byID[course.Lessons[index].ImageID]; url != "" {
			course.Lessons[index].ImageURL = url
		}
	}
}

func (h *Handler) attachCourseImageURL(course *models.Course, images []models.CourseImage) {
	for _, image := range images {
		if image.ID == course.ImageID {
			course.ImageURL = image.URL
			return
		}
	}
}

func (h *Handler) attachCourseImagesToList(ctx context.Context, courses []models.Course) error {
	for index := range courses {
		images, err := h.courseImagesWithURLs(ctx, courses[index].ID)
		if err != nil {
			return err
		}
		h.attachCourseImageURL(&courses[index], images)
	}
	return nil
}

func uploadedFiles(form *multipart.Form) []*multipart.FileHeader {
	if form == nil {
		return nil
	}

	fields := []string{"images", "image", "files", "file"}
	files := make([]*multipart.FileHeader, 0)
	for _, field := range fields {
		files = append(files, form.File[field]...)
	}
	return files
}

func imageFromUploadHeader(header *multipart.FileHeader, alt string, sortOrder int, createdAt time.Time) (models.ImageDocument, error) {
	file, err := header.Open()
	if err != nil {
		return models.ImageDocument{}, fmt.Errorf("خواندن تصویر انجام نشد.")
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return models.ImageDocument{}, fmt.Errorf("خواندن تصویر انجام نشد.")
	}
	if len(data) == 0 {
		return models.ImageDocument{}, fmt.Errorf("فایل تصویر خالی است.")
	}

	contentType := http.DetectContentType(data)
	if !strings.HasPrefix(contentType, "image/") {
		return models.ImageDocument{}, fmt.Errorf("فقط فایل تصویر قابل آپلود است.")
	}

	id := generateID()
	filename := id + "-" + filepath.Base(header.Filename)

	return models.ImageDocument{
		ID:          id,
		Filename:    filename,
		Alt:         alt,
		ContentType: contentType,
		Data:        data,
		SortOrder:   sortOrder,
		CreatedAt:   createdAt,
	}, nil
}

func nextSortOrder(ctx context.Context, pool *pgxpool.Pool, table string) (int, error) {
	query, err := imageNextSortOrderQuery(table)
	if err != nil {
		return 0, err
	}

	var nextOrder int
	if err := pool.QueryRow(ctx, query).Scan(&nextOrder); err != nil {
		return 0, err
	}
	if nextOrder < 0 {
		return 0, nil
	}
	return nextOrder, nil
}

func imageListQuery(table string) (string, error) {
	t, err := normalizeImageTable(table)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`SELECT id, alt, filename, content_type, sort_order FROM %s ORDER BY sort_order ASC, filename ASC`, t), nil
}

func imageContentQuery(table string) (string, error) {
	t, err := normalizeImageTable(table)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`SELECT filename, content_type, data FROM %s WHERE id = $1`, t), nil
}

func imageInsertQuery(table string) (string, error) {
	t, err := normalizeImageTable(table)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`INSERT INTO %s (id, filename, alt, content_type, data, sort_order, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, t), nil
}

func imageDeleteQuery(table string) (string, error) {
	t, err := normalizeImageTable(table)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`DELETE FROM %s WHERE id = $1`, t), nil
}

func imageNextSortOrderQuery(table string) (string, error) {
	t, err := normalizeImageTable(table)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM %s`, t), nil
}

func normalizeImageTable(table string) (string, error) {
	switch table {
	case projectImagesTable, heroSlidesTable:
		return table, nil
	default:
		return "", fmt.Errorf("invalid image table: %s", table)
	}
}

func generateID() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("fallback-%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23503"
	}
	return false
}

func validateCategory(category models.Category) error {
	if strings.TrimSpace(category.Slug) == "" {
		return fmt.Errorf("اسلاگ دسته‌بندی الزامی است.")
	}
	if strings.TrimSpace(category.Title) == "" {
		return fmt.Errorf("نام دسته‌بندی الزامی است.")
	}
	return nil
}

func validateHomepageSection(section models.HomepageSection) error {
	if strings.TrimSpace(section.Title) == "" {
		return fmt.Errorf("عنوان بخش الزامی است.")
	}
	if strings.TrimSpace(section.To) == "" {
		return fmt.Errorf("لینک بخش الزامی است.")
	}
	return nil
}

func normalizeDigits(value string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= '۰' && r <= '۹':
			return '0' + (r - '۰')
		case r >= '٠' && r <= '٩':
			return '0' + (r - '٠')
		default:
			return r
		}
	}, value)
}

func isDigitsOnly(value string) bool {
	if value == "" {
		return false
	}

	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}

	return true
}
