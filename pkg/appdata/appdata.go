package appdata

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"unicode"
)

type Dataset struct {
	GeneratedAt    string         `json:"generatedAt"`
	Summary        Summary        `json:"summary"`
	Provenance     []Source       `json:"provenance"`
	SourceStatuses []SourceStatus `json:"sourceStatuses"`
	SourceTodos    []SourceTodo   `json:"sourceTodos"`
	People         []*Person      `json:"people"`
	Schools        []*School      `json:"schools"`
	Counties       []*County      `json:"counties"`
	Contests       []*Contest     `json:"contests"`
	Results        []Result       `json:"results"`
	Rankings       Rankings       `json:"rankings"`
	Search         []SearchItem   `json:"search"`
}

type Summary struct {
	People                int      `json:"people"`
	Schools               int      `json:"schools"`
	Counties              int      `json:"counties"`
	Contests              int      `json:"contests"`
	Results               int      `json:"results"`
	NamedResults          int      `json:"namedResults"`
	AnonymousResults      int      `json:"anonymousResults"`
	Years                 []int    `json:"years"`
	Circuits              []string `json:"circuits"`
	LatestYear            int      `json:"latestYear"`
	MergedByDefault       bool     `json:"mergedByDefault"`
	ROAIStatus            string   `json:"roaiStatus"`
	NationalCoverageScope string   `json:"nationalCoverageScope"`
}

type Source struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	AccessedAt string `json:"accessedAt"`
	Status     string `json:"status"`
}

type SourceStatus struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Status  string `json:"status"`
	Detail  string `json:"detail"`
	URL     string `json:"url,omitempty"`
	Checked string `json:"checked"`
}

type SourceTodo struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
	Detail string `json:"detail"`
	URL    string `json:"url,omitempty"`
}

type SearchItem struct {
	ID        string           `json:"id"`
	Kind      string           `json:"kind"`
	Title     string           `json:"title"`
	Subtitle  string           `json:"subtitle"`
	Tokens    []string         `json:"tokens"`
	Usernames []SearchUsername `json:"usernames,omitempty"`
}

type SearchUsername struct {
	Platform string `json:"platform"`
	Username string `json:"username"`
}

type Result struct {
	ID             string  `json:"id"`
	ContestID      string  `json:"contestId"`
	PersonID       string  `json:"personId,omitempty"`
	PersonName     string  `json:"personName"`
	SchoolID       string  `json:"schoolId,omitempty"`
	School         string  `json:"school,omitempty"`
	CountyID       string  `json:"countyId,omitempty"`
	County         string  `json:"county,omitempty"`
	OriginalCounty string  `json:"originalCounty,omitempty"`
	Locality       string  `json:"locality,omitempty"`
	Year           int     `json:"year"`
	Circuit        string  `json:"circuit"`
	Stage          string  `json:"stage"`
	Section        string  `json:"section,omitempty"`
	Grade          string  `json:"grade,omitempty"`
	Place          int     `json:"place,omitempty"`
	Score          float64 `json:"score,omitempty"`
	ScoreMax       float64 `json:"scoreMax,omitempty"`
	Medal          string  `json:"medal,omitempty"`
	Prize          string  `json:"prize,omitempty"`
	Qualification  string  `json:"qualification,omitempty"`
	Status         string  `json:"status,omitempty"`
	SourceID       string  `json:"sourceId"`
	Anonymous      bool    `json:"anonymous"`
}

type Stats struct {
	Participations              int      `json:"participations"`
	NationalParticipations      int      `json:"nationalParticipations"`
	InternationalParticipations int      `json:"internationalParticipations"`
	LotParticipations           int      `json:"lotParticipations"`
	Gold                        int      `json:"gold"`
	Silver                      int      `json:"silver"`
	Bronze                      int      `json:"bronze"`
	Honorable                   int      `json:"honorable"`
	Prizes                      int      `json:"prizes"`
	Selections                  int      `json:"selections"`
	IOAISelections              int      `json:"ioaiSelections"`
	CEOAISelections             int      `json:"ceoaiSelections"`
	IAIOSelections              int      `json:"iaioSelections"`
	UniqueContestants           int      `json:"uniqueContestants"`
	BestPlace                   int      `json:"bestPlace,omitempty"`
	Years                       []int    `json:"years"`
	Circuits                    []string `json:"circuits"`
}

type Person struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	Aliases           []string           `json:"aliases,omitempty"`
	ExternalUsernames *ExternalUsernames `json:"externalUsernames,omitempty"`
	SchoolIDs         []string           `json:"schoolIds"`
	CountyIDs         []string           `json:"countyIds"`
	Stats             Stats              `json:"stats"`
}

type ExternalUsernames struct {
	Judge     []string `json:"judge,omitempty"`
	MLCompete []string `json:"mlcompete,omitempty"`
}

type School struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	CountyID string `json:"countyId,omitempty"`
	County   string `json:"county,omitempty"`
	Stats    Stats  `json:"stats"`
}

type County struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Stats Stats  `json:"stats"`
}

type Contest struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Year         int    `json:"year"`
	Circuit      string `json:"circuit"`
	Stage        string `json:"stage"`
	Section      string `json:"section,omitempty"`
	Date         string `json:"date,omitempty"`
	City         string `json:"city,omitempty"`
	Country      string `json:"country,omitempty"`
	OfficialURL  string `json:"officialUrl,omitempty"`
	SourceID     string `json:"sourceId"`
	ResultsCount int    `json:"resultsCount"`
}

type Rankings struct {
	People   []RankingRow `json:"people"`
	Schools  []RankingRow `json:"schools"`
	Counties []RankingRow `json:"counties"`
}

type RankingRow struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Kind  string `json:"kind"`
	Stats Stats  `json:"stats"`
}

var (
	loadOnce sync.Once
	loaded   *Dataset
	loadErr  error
)

func Load() (*Dataset, error) {
	loadOnce.Do(func() {
		loaded, loadErr = loadFromDisk()
	})
	return loaded, loadErr
}

func Search(data *Dataset, query, kind, circuit, stage string, limit int) []SearchItem {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	queryTokens := strings.Fields(normalize(query))
	allowed := allowedEntityIDs(data.Results, circuit, stage)
	matches := make([]SearchItem, 0, limit)
	for _, item := range data.Search {
		if kind != "" && kind != "all" && item.Kind != kind {
			continue
		}
		if allowed != nil && !allowed[item.Kind+":"+item.ID] {
			continue
		}
		if len(queryTokens) > 0 && !tokensMatch(queryTokens, item.Tokens) {
			continue
		}
		matches = append(matches, item)
		if len(matches) == limit {
			break
		}
	}
	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].Kind == matches[j].Kind {
			return matches[i].Title < matches[j].Title
		}
		return matches[i].Kind < matches[j].Kind
	})
	return matches
}

func loadFromDisk() (*Dataset, error) {
	candidates := []string{
		"public/data/app.json",
		filepath.Join("..", "public", "data", "app.json"),
		filepath.Join("/var", "task", "public", "data", "app.json"),
	}
	for _, path := range candidates {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var dataset Dataset
		if err := json.Unmarshal(data, &dataset); err != nil {
			return nil, err
		}
		return &dataset, nil
	}
	return nil, errors.New("public/data/app.json not found")
}

func tokensMatch(queryTokens []string, itemTokens []string) bool {
	for _, query := range queryTokens {
		matched := false
		for _, token := range itemTokens {
			if strings.Contains(token, query) {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}
	return true
}

func allowedEntityIDs(results []Result, circuit, stage string) map[string]bool {
	if (circuit == "" || circuit == "merged") && (stage == "" || stage == "all") {
		return nil
	}
	allowed := map[string]bool{}
	for _, result := range results {
		if !matchesCircuit(result, circuit) || !matchesStage(result, stage) {
			continue
		}
		allowed["contest:"+result.ContestID] = true
		if result.PersonID != "" && !result.Anonymous {
			allowed["person:"+result.PersonID] = true
		}
		if result.SchoolID != "" {
			allowed["school:"+result.SchoolID] = true
		}
		if result.CountyID != "" {
			allowed["county:"+result.CountyID] = true
		}
	}
	return allowed
}

func matchesCircuit(result Result, circuit string) bool {
	if circuit == "" || circuit == "merged" {
		return true
	}
	if circuit == "international" {
		return result.Stage == "international"
	}
	return result.Circuit == circuit
}

func matchesStage(result Result, stage string) bool {
	return stage == "" || stage == "all" || result.Stage == stage
}

func normalize(value string) string {
	value = strings.NewReplacer(
		"ă", "a", "Ă", "a",
		"â", "a", "Â", "a",
		"î", "i", "Î", "i",
		"ș", "s", "Ș", "s",
		"ş", "s", "Ş", "s",
		"ț", "t", "Ț", "t",
		"ţ", "t", "Ţ", "t",
	).Replace(value)
	var out []rune
	lastSpace := true
	for _, r := range strings.ToLower(value) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			out = append(out, r)
			lastSpace = false
			continue
		}
		if !lastSpace {
			out = append(out, ' ')
			lastSpace = true
		}
	}
	return strings.TrimSpace(string(out))
}
