package handler

import (
	"encoding/json"
	"net/http"

	"roaihof/pkg/appdata"
)

func Handler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	data, err := appdata.Load()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.Header().Set("cache-control", "s-maxage=3600, stale-while-revalidate=86400")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"summary":   data.Summary,
		"sources":   data.SourceStatuses,
		"generated": true,
	})
}
