# ==============================================================================
# Stage 1: Build the Go binary
# ==============================================================================
FROM golang:alpine AS builder

WORKDIR /app

# Enable automatic Go toolchain resolution if required
ENV GOTOOLCHAIN=auto

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build optimized static binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /app/server ./cmd/server

# ==============================================================================
# Stage 2: Minimal Production Runtime
# ==============================================================================
FROM alpine:3.20

WORKDIR /app

# Install ca-certificates and tzdata for SSL/TLS and Timezone accuracy
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy binary from builder
COPY --from=builder /app/server /app/server

# Copy migrations directory
COPY --from=builder /app/migrations /app/migrations

USER appuser

EXPOSE 8080

ENTRYPOINT ["/app/server"]
