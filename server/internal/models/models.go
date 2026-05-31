package models

import (
	"time"
)

type ContactRequest struct {
	ID        string    `db:"id"`
	FullName  string    `db:"full_name"`
	Contact   string    `db:"contact"`
	Message   string    `db:"message"`
	CreatedAt time.Time `db:"created_at"`
}

type CourseSignup struct {
	ID        string    `db:"id"`
	Phone     string    `db:"phone"`
	CreatedAt time.Time `db:"created_at"`
}

type CourseLesson struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Level     string   `json:"level"`
	Type      string   `json:"type"`
	Duration  string   `json:"duration"`
	Summary   string   `json:"summary"`
	Materials []string `json:"materials"`
	ImageID   string   `json:"imageId,omitempty"`
	ImageURL  string   `json:"imageUrl,omitempty"`
}

type Course struct {
	ID          string         `json:"id" db:"id"`
	Slug        string         `json:"slug" db:"slug"`
	Title       string         `json:"title" db:"title"`
	Subtitle    string         `json:"subtitle" db:"subtitle"`
	Term        string         `json:"term" db:"term"`
	Level       string         `json:"level" db:"level"`
	Format      string         `json:"format" db:"format"`
	Duration    string         `json:"duration" db:"duration"`
	Summary     string         `json:"summary" db:"summary"`
	Description string         `json:"description" db:"description"`
	Status      string         `json:"status" db:"status"`
	ImageID     string         `json:"imageId,omitempty" db:"image_id"`
	ImageURL    string         `json:"imageUrl,omitempty"`
	SortOrder   int            `json:"sortOrder" db:"sort_order"`
	Outcomes    []string       `json:"outcomes" db:"outcomes"`
	Audience    []string       `json:"audience" db:"audience"`
	Lessons     []CourseLesson `json:"lessons" db:"lessons"`
	CreatedAt   time.Time      `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time      `json:"updatedAt" db:"updated_at"`
}

type CourseImage struct {
	ID          string    `json:"id" db:"id"`
	CourseID    string    `json:"courseId" db:"course_id"`
	Filename    string    `json:"filename" db:"filename"`
	Alt         string    `json:"alt" db:"alt"`
	ContentType string    `json:"contentType" db:"content_type"`
	Data        []byte    `json:"-" db:"data"`
	SortOrder   int       `json:"sortOrder" db:"sort_order"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	URL         string    `json:"url,omitempty"`
}

type ImageDocument struct {
	ID          string    `db:"id"`
	Filename    string    `db:"filename"`
	Alt         string    `db:"alt"`
	ContentType string    `db:"content_type"`
	Data        []byte    `db:"data"`
	SortOrder   int       `db:"sort_order"`
	CreatedAt   time.Time `db:"created_at"`
}

type ProjectImage = ImageDocument

type HeroSlide = ImageDocument
