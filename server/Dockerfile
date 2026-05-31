FROM docker.abrha.net/golang:1.25-alpine AS base
WORKDIR /app
ENV GOPROXY=https://package-mirror.liara.ir/repository/go/

COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev
COPY . .
CMD ["go", "run", "./cmd/api/main.go"]

FROM base AS build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/server ./cmd/api/main.go

FROM docker.abrha.net/alpine:latest AS prod
WORKDIR /app
COPY --from=build /bin/server /app/server
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
