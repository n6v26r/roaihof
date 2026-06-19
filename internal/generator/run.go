package generator

import (
	"fmt"
	"os"
	"path/filepath"
)

func Run() error {
	dataset, err := BuildDataset(".")
	if err != nil {
		return err
	}
	if err := os.MkdirAll("src/generated", 0o755); err != nil {
		return err
	}
	if err := os.MkdirAll("public/data", 0o755); err != nil {
		return err
	}
	if err := writeJSON("src/generated/app-data.json", dataset); err != nil {
		return err
	}
	if err := writeJSON("public/data/app.json", dataset); err != nil {
		return err
	}
	fmt.Printf("generated %d people, %d schools, %d counties, %d contests, %d results\n",
		dataset.Summary.People,
		dataset.Summary.Schools,
		dataset.Summary.Counties,
		dataset.Summary.Contests,
		dataset.Summary.Results,
	)
	return nil
}

func BuildDataset(root string) (*Dataset, error) {
	aliases, aliasReasons, err := loadAliases(filepath.Join(root, "data/manual/aliases.json"))
	if err != nil {
		return nil, err
	}
	b := newBuilder(aliases, aliasReasons)
	checked := "2026-06-18"
	b.addSource(Source{
		ID:         sourceONIANational,
		Title:      "ONIA 2026 - etapa națională",
		URL:        "https://olimpiada-ai.ro/data/rezultate-nationala-2026.json",
		AccessedAt: checked,
		Status:     "ok",
	})
	b.addSource(Source{
		ID:         sourceONIALot,
		Title:      "ONIA 2026 - lot lărgit Top 12",
		URL:        "https://olimpiada-ai.ro/data/rezultate-lot-largit-2026.json",
		AccessedAt: checked,
		Status:     "ok",
	})
	b.addSource(Source{
		ID:         sourceONIALotScoreboard,
		Title:      "ONIA 2026 - Lot final leaderboard, rounds 1+2",
		URL:        "https://platform.olimpiada-ai.ro/ro/competitions/23?tab=final",
		AccessedAt: checked,
		Status:     "ok",
	})
	b.sourceStatus = append(b.sourceStatus,
		SourceStatus{
			ID:      "onia-2026-national",
			Title:   "ONIA 2026 national + Lot",
			Status:  "validate",
			Detail:  "Imported from official ONIA 2026 national results, participant-sheet recovery data, mlcompete final leaderboards, and Lot scoreboards.",
			URL:     "https://olimpiada-ai.ro/ro/rezultate/nationala",
			Checked: checked,
		},
		SourceStatus{
			ID:      "onia-hof-2024-2025",
			Title:   "ONIA International results 2024-2025",
			Status:  "ok",
			Detail:  "Imported from official international scoreboards where available, with the ONIA Hall of Fame preserving medal context.",
			URL:     "https://olimpiada-ai.ro/ro/hall-of-fame",
			Checked: checked,
		},
		SourceStatus{
			ID:      "iaio-2024-official-results",
			Title:   "IAIO 2024 official results",
			Status:  "ok",
			Detail:  "Place and score imported from the official IAIO 2024 scoreboard.",
			URL:     "https://iaio-official.org/results/",
			Checked: checked,
		},
		SourceStatus{
			ID:      "roai-2026",
			Title:   "ROAI 2026",
			Status:  "ok",
			Detail:  "Imported from the official ROAI 2026 task/results pages, national final PDFs, Lot IAIO/CEOAI ranking PDFs, and Nitro judge standings for national scores.",
			URL:     "https://olimpiada.nitro-ai.org/ro/2026/onia?section=tasks",
			Checked: checked,
		},
		SourceStatus{
			ID:      "roai-2025-lot",
			Title:   "ROAI 2025 Lot",
			Status:  "ok",
			Detail:  "Imported from the official ROAI 2025 Lot task/results page and final IOAI/IAIO ranking PDFs.",
			URL:     "https://olimpiada.nitro-ai.org/ro/2025/lot?section=tasks",
			Checked: checked,
		},
		SourceStatus{
			ID:      "roai-2025-national",
			Title:   "ROAI 2025 national",
			Status:  "validate",
			Detail:  "Imported from official ROAI 2025 task/results pages, class final PDFs, qualified participant lists, Nitro judge leaderboards, and recovered anonymized national scoreboard rows.",
			URL:     "https://olimpiada.nitro-ai.org/ro/2025/onia?section=tasks",
			Checked: checked,
		},
		SourceStatus{
			ID:      "mlcompete-2026-usernames",
			Title:   "ONIA 2026 mlcompete usernames",
			Status:  "ok",
			Detail:  "Imported public final leaderboard usernames from ONIA 2026 national and Lot mlcompete pages; profile-backed pairings are added only when they match a known real name without ambiguity.",
			URL:     "https://platform.olimpiada-ai.ro/ro/competitions/17?tab=final",
			Checked: checked,
		},
		SourceStatus{
			ID:      "nitro-ai-judge-usernames",
			Title:   "ROAI judge usernames",
			Status:  "ok",
			Detail:  "Imported final leaderboard usernames from ROAI 2025 and 2026 national stage; Added only where there was no ambiguity.",
			URL:     "https://judge.nitro-ai.org/competitions",
			Checked: checked,
		},
	)
	b.sourceTodos = append(b.sourceTodos,
		SourceTodo{
			ID:     "roai-2025",
			Title:  "ROAI 2025",
			Status: "validate",
			Detail: "Recovered national matches are inferred from anonymized scoreboards and public participant data; manually review names, schools, counties, and judge usernames.",
			URL:    "https://olimpiada.nitro-ai.org/ro/2025/onia?section=tasks",
		},
		SourceTodo{
			ID:     "onia-2026",
			Title:  "ONIA 2026",
			Status: "validate",
			Detail: "Recovered national matches are inferred from anonymous scoreboard rows and public participant data; manually review names, schools, counties, and mlcompete usernames.",
			URL:    "https://olimpiada-ai.ro/ro/rezultate/nationala",
		},
	)

	if err := b.importONIANational(
		filepath.Join(root, "data/raw/onia/rezultate-nationala-2026.json"),
		filepath.Join(root, "data/manual/onia-2026-national-recovery.json"),
	); err != nil {
		return nil, err
	}
	if err := b.importMLCompeteUsernames(filepath.Join(root, "data/manual/onia-platform-leaderboards.json")); err != nil {
		return nil, err
	}
	if err := b.importONIALotSelection(
		filepath.Join(root, "data/raw/onia/rezultate-nationala-2026.json"),
		filepath.Join(root, "data/raw/onia/rezultate-lot-largit-2026.json"),
		filepath.Join(root, "data/manual/onia-platform-leaderboards.json"),
	); err != nil {
		return nil, err
	}
	if err := b.importROAI(
		filepath.Join(root, "data/manual/roai-2026-results.json"),
		filepath.Join(root, "data/manual/roai-2025-national-scores.json"),
		filepath.Join(root, "data/manual/roai-2025-national-recovery.json"),
	); err != nil {
		return nil, err
	}
	if err := b.importManualInternational(filepath.Join(root, "data/manual/international-results.json")); err != nil {
		return nil, err
	}
	return b.finalize(), nil
}
