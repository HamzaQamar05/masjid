package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	_ "github.com/lib/pq"
	"go.mau.fi/whatsmeow"
	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type sender struct {
	client *whatsmeow.Client
	db     *sql.DB
	token  string

	mu            sync.RWMutex
	latestQRCode  string
	lastPairEvent string
}

type messageRequest struct {
	To             string `json:"to"`
	Message        string `json:"message"`
	IdempotencyKey string `json:"idempotencyKey"`
}

type pairRequest struct {
	Phone string `json:"phone"`
}

var nonDigits = regexp.MustCompile(`\D`)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	token := strings.TrimSpace(os.Getenv("WHATSAPP_SERVICE_TOKEN"))
	databaseURL := firstNonEmpty(os.Getenv("WHATSAPP_DATABASE_URL"), os.Getenv("DATABASE_URL"))
	deliveryDatabaseURL := firstNonEmpty(os.Getenv("DATABASE_URL"), databaseURL)
	if token == "" {
		log.Fatal("WHATSAPP_SERVICE_TOKEN is required")
	}
	if databaseURL == "" {
		log.Fatal("WHATSAPP_DATABASE_URL or DATABASE_URL is required")
	}

	db, err := sql.Open("postgres", deliveryDatabaseURL)
	if err != nil {
		log.Fatalf("open delivery database: %v", err)
	}
	defer db.Close()
	if err = db.PingContext(ctx); err != nil {
		log.Fatalf("connect delivery database: %v", err)
	}
	if err = ensureDeliveryTable(ctx, db); err != nil {
		log.Fatalf("prepare delivery database: %v", err)
	}

	dbLog := waLog.Stdout("WhatsAppDB", envOr("WHATSAPP_LOG_LEVEL", "INFO"), true)
	container, err := sqlstore.New(ctx, "postgres", databaseURL, dbLog)
	if err != nil {
		log.Fatalf("open whatsmeow device store: %v", err)
	}
	defer container.Close()
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		log.Fatalf("load whatsmeow device: %v", err)
	}

	clientLog := waLog.Stdout("WhatsApp", envOr("WHATSAPP_LOG_LEVEL", "INFO"), true)
	client := whatsmeow.NewClient(device, clientLog)
	client.EnableAutoReconnect = true
	service := &sender{client: client, db: db, token: token}
	if err = service.connect(ctx); err != nil {
		log.Printf("WhatsApp initial connection failed; HTTP service will remain available for recovery: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", service.health)
	mux.HandleFunc("/status", service.requireAuth(service.status))
	mux.HandleFunc("/pair-code", service.requireAuth(service.pairCode))
	mux.HandleFunc("/messages", service.requireAuth(service.sendMessage))

	server := &http.Server{
		Addr:              envOr("WHATSAPP_LISTEN_ADDR", ":8080"),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		log.Printf("WhatsApp sender listening on %s", server.Addr)
		if serveErr := server.ListenAndServe(); serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Fatalf("WhatsApp HTTP server failed: %v", serveErr)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdownCtx)
	client.Disconnect()
}

func (s *sender) connect(ctx context.Context) error {
	if s.client.Store.ID == nil {
		qrChannel, err := s.client.GetQRChannel(ctx)
		if err != nil {
			return fmt.Errorf("open QR channel: %w", err)
		}
		go func() {
			for item := range qrChannel {
				s.mu.Lock()
				s.lastPairEvent = item.Event
				if item.Event == "code" {
					s.latestQRCode = item.Code
					log.Println("WhatsApp QR code is ready. Use the authenticated /status endpoint or /pair-code.")
				} else if item.Event == "success" {
					s.latestQRCode = ""
					log.Println("WhatsApp linked-device pairing succeeded")
				} else if item.Error != nil {
					log.Printf("WhatsApp pairing event %s: %v", item.Event, item.Error)
				}
				s.mu.Unlock()
			}
		}()
	}
	if err := s.client.Connect(); err != nil {
		return fmt.Errorf("connect whatsmeow client: %w", err)
	}
	return nil
}

func (s *sender) health(w http.ResponseWriter, _ *http.Request) {
	status := http.StatusOK
	if !s.client.IsConnected() {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{
		"ok":        status == http.StatusOK,
		"connected": s.client.IsConnected(),
		"loggedIn":  s.client.IsLoggedIn(),
		"paired":    s.client.Store.ID != nil,
	})
}

func (s *sender) status(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"connected":     s.client.IsConnected(),
		"loggedIn":      s.client.IsLoggedIn(),
		"paired":        s.client.Store.ID != nil,
		"qrCode":        s.latestQRCode,
		"lastPairEvent": s.lastPairEvent,
	})
}

func (s *sender) pairCode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST required"})
		return
	}
	if s.client.Store.ID != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "WhatsApp is already paired"})
		return
	}
	var request pairRequest
	if !decodeJSON(w, r, &request) {
		return
	}
	phone := normalizePhone(request.Phone)
	if phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "international phone number required"})
		return
	}
	s.mu.RLock()
	qrReady := s.latestQRCode != ""
	s.mu.RUnlock()
	if !qrReady {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "pairing socket is not ready; retry shortly"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	code, err := s.client.PairPhone(ctx, phone, true, whatsmeow.PairClientChrome, "Chrome (Linux)")
	if err != nil {
		log.Printf("WhatsApp pair-code generation failed: %v", err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "could not generate pairing code"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

func (s *sender) sendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "POST required"})
		return
	}
	var request messageRequest
	if !decodeJSON(w, r, &request) {
		return
	}
	phone := normalizePhone(request.To)
	request.Message = strings.TrimSpace(request.Message)
	request.IdempotencyKey = strings.TrimSpace(request.IdempotencyKey)
	if phone == "" || request.Message == "" || request.IdempotencyKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "to, message, and idempotencyKey are required"})
		return
	}
	if len(request.Message) > 4000 || len(request.IdempotencyKey) > 220 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "message or idempotency key is too long"})
		return
	}
	if !s.client.IsConnected() || !s.client.IsLoggedIn() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "WhatsApp linked device is not connected"})
		return
	}

	reserved, err := reserveDelivery(r.Context(), s.db, request.IdempotencyKey)
	if err != nil {
		log.Printf("WhatsApp idempotency reservation failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "could not reserve delivery"})
		return
	}
	if !reserved {
		writeJSON(w, http.StatusOK, map[string]any{"sent": false, "duplicate": true})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 75*time.Second)
	defer cancel()
	recipient := types.NewJID(phone, types.DefaultUserServer)
	response, err := s.client.SendMessage(ctx, recipient, &waE2E.Message{Conversation: proto.String(request.Message)})
	if err != nil {
		_, _ = s.db.ExecContext(context.Background(), `DELETE FROM ummah_whatsapp_deliveries WHERE idempotency_key = $1 AND status = 'PENDING'`, request.IdempotencyKey)
		log.Printf("WhatsApp send failed for %s: %v", maskedPhone(phone), err)
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "WhatsApp send failed"})
		return
	}
	_, err = s.db.ExecContext(r.Context(), `
		UPDATE ummah_whatsapp_deliveries
		SET status = 'SENT', message_id = $2, sent_at = NOW()
		WHERE idempotency_key = $1
	`, request.IdempotencyKey, response.ID)
	if err != nil {
		log.Printf("WhatsApp delivery receipt persistence failed: %v", err)
	}
	log.Printf("WhatsApp notification sent to %s with message ID %s", maskedPhone(phone), response.ID)
	writeJSON(w, http.StatusOK, map[string]any{"sent": true, "duplicate": false, "messageId": response.ID})
}

func (s *sender) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provided := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if len(provided) != len(s.token) || subtle.ConstantTimeCompare([]byte(provided), []byte(s.token)) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

func ensureDeliveryTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS ummah_whatsapp_deliveries (
			idempotency_key TEXT PRIMARY KEY,
			status TEXT NOT NULL,
			message_id TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			sent_at TIMESTAMPTZ
		)
	`)
	return err
}

func reserveDelivery(ctx context.Context, db *sql.DB, key string) (bool, error) {
	_, _ = db.ExecContext(ctx, `
		DELETE FROM ummah_whatsapp_deliveries
		WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '5 minutes'
	`)
	result, err := db.ExecContext(ctx, `
		INSERT INTO ummah_whatsapp_deliveries (idempotency_key, status)
		VALUES ($1, 'PENDING')
		ON CONFLICT (idempotency_key) DO NOTHING
	`, key)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected == 1, err
}

func decodeJSON(w http.ResponseWriter, r *http.Request, value any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 32<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(value); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON request"})
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func normalizePhone(value string) string {
	return nonDigits.ReplaceAllString(value, "")
}

func maskedPhone(phone string) string {
	if len(phone) < 6 {
		return "***"
	}
	return phone[:2] + "***" + phone[len(phone)-2:]
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func envOr(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
