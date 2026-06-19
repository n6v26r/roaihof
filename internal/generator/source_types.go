package generator

import (
	"encoding/json"
	"strconv"
	"strings"
)

type aliasFile struct {
	Aliases []nameAlias `json:"aliases"`
}

type nameAlias struct {
	Alias     string `json:"alias"`
	Canonical string `json:"canonical"`
	Reason    string `json:"reason"`
}

type oniaNationalFile struct {
	Clasa9      []oniaNationalRow `json:"Clasa_9"`
	Clasa10     []oniaNationalRow `json:"Clasa_10"`
	Clasa11     []oniaNationalRow `json:"Clasa_11"`
	Clasa12     []oniaNationalRow `json:"Clasa_12"`
	LotNational []oniaLotRow      `json:"LotNational"`
}

type oniaNationalRow struct {
	Pozitie    int       `json:"Pozitie"`
	Username   string    `json:"Username"`
	Scoala     string    `json:"Scoala"`
	Localitate string    `json:"Localitate"`
	Judet      string    `json:"Judet"`
	Clasa      string    `json:"Clasa"`
	ScorTotal  oniaScore `json:"ScorTotal"`
	ScorFinal  oniaScore `json:"ScorFinal"`
	Premiu     *string   `json:"Premiu"`
	Medalie    *string   `json:"Medalie"`
}

func (row oniaNationalRow) isAbsent() bool {
	return row.ScorTotal.Absent
}

type oniaNationalRecoveryFile struct {
	Sources   []Source                  `json:"sources"`
	Guests    []oniaNationalGuestRow    `json:"guests"`
	Recovered []oniaNationalRecoveryRow `json:"recovered"`
}

type oniaNationalGuestRow struct {
	Grade        string    `json:"grade"`
	Name         string    `json:"name"`
	School       string    `json:"school"`
	County       string    `json:"county"`
	Username     string    `json:"username"`
	UserID       string    `json:"userId"`
	PlatformRank int       `json:"platformRank"`
	Score        flexFloat `json:"score"`
	Status       string    `json:"status"`
}

type oniaNationalRecoveryRow struct {
	Grade    string    `json:"grade"`
	Place    int       `json:"place"`
	Score    flexFloat `json:"score"`
	Username string    `json:"username"`
	UserID   string    `json:"userId"`
	Name     string    `json:"name"`
	School   string    `json:"school"`
	County   string    `json:"county"`
}

type oniaLotRow struct {
	Pozitie      int       `json:"Pozitie"`
	Nume         string    `json:"Nume"`
	Scoala       string    `json:"Scoala"`
	Clasa        string    `json:"Clasa"`
	Sectiune     string    `json:"Sectiune"`
	PunctajTotal flexFloat `json:"PunctajTotal"`
	Observatii   *string   `json:"Observatii"`
}

type oniaLotSelectionFile struct {
	Stage string          `json:"Stage"`
	Year  int             `json:"Year"`
	Top12 []oniaTop12Row  `json:"Top12"`
	Title json.RawMessage `json:"Title"`
}

type oniaTop12Row struct {
	Pozitie int       `json:"Pozitie"`
	Nume    string    `json:"Nume"`
	Scoala  string    `json:"Scoala"`
	Clasa   string    `json:"Clasa"`
	Judet   string    `json:"Judet"`
	Punctaj flexFloat `json:"Punctaj"`
}

type flexFloat float64

func (f *flexFloat) UnmarshalJSON(data []byte) error {
	raw := strings.TrimSpace(string(data))
	if raw == "" || raw == "null" {
		*f = 0
		return nil
	}
	if strings.HasPrefix(raw, "\"") {
		var text string
		if err := json.Unmarshal(data, &text); err != nil {
			return err
		}
		text = strings.TrimSpace(strings.ReplaceAll(text, ",", "."))
		if text == "" || text == "-" {
			*f = 0
			return nil
		}
		value, err := strconv.ParseFloat(text, 64)
		if err != nil {
			*f = 0
			return nil
		}
		*f = flexFloat(value)
		return nil
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return err
	}
	*f = flexFloat(value)
	return nil
}

type oniaScore struct {
	Value   float64
	Present bool
	Absent  bool
}

func (s *oniaScore) UnmarshalJSON(data []byte) error {
	raw := strings.TrimSpace(string(data))
	if raw == "" || raw == "null" {
		*s = oniaScore{}
		return nil
	}
	s.Present = true
	if strings.HasPrefix(raw, "\"") {
		var text string
		if err := json.Unmarshal(data, &text); err != nil {
			return err
		}
		text = strings.TrimSpace(strings.ReplaceAll(text, ",", "."))
		if strings.EqualFold(text, "absent") {
			s.Absent = true
			s.Value = 0
			return nil
		}
		if text == "" || text == "-" {
			s.Value = 0
			return nil
		}
		value, err := strconv.ParseFloat(text, 64)
		if err != nil {
			s.Value = 0
			return nil
		}
		s.Value = value
		return nil
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return err
	}
	s.Value = value
	return nil
}

type manualInternationalFile struct {
	Sources []Source       `json:"sources"`
	Results []manualResult `json:"results"`
}

type manualResult struct {
	ContestID     string    `json:"contestId"`
	ContestName   string    `json:"contestName"`
	Year          int       `json:"year"`
	Date          string    `json:"date"`
	City          string    `json:"city"`
	Country       string    `json:"country"`
	Circuit       string    `json:"circuit"`
	Stage         string    `json:"stage"`
	Section       string    `json:"section"`
	SourceID      string    `json:"sourceId"`
	PersonName    string    `json:"personName"`
	School        string    `json:"school"`
	County        string    `json:"county"`
	Medal         string    `json:"medal"`
	Prize         string    `json:"prize"`
	Place         int       `json:"place"`
	Score         flexFloat `json:"score"`
	ScoreMax      flexFloat `json:"scoreMax"`
	Qualification string    `json:"qualification"`
}

type roaiFile struct {
	Sources     []Source            `json:"sources"`
	National    []roaiNationalRow   `json:"national"`
	Lot         []roaiQualifiedRow  `json:"lot"`
	LotRankings []roaiLotRankingRow `json:"lotRankings"`
}

type roaiNationalRow struct {
	Section      string    `json:"section"`
	Year         int       `json:"year,omitempty"`
	SourceID     string    `json:"sourceId,omitempty"`
	Username     string    `json:"username"`
	NationalCode string    `json:"nationalCode,omitempty"`
	OJIACode     string    `json:"ojiaCode,omitempty"`
	Name         string    `json:"name"`
	Grade        string    `json:"grade"`
	School       string    `json:"school"`
	County       string    `json:"county"`
	Place        int       `json:"place"`
	Score        flexFloat `json:"score"`
	ScoreMax     flexFloat `json:"scoreMax"`
	Prize        string    `json:"prize"`
	Medal        string    `json:"medal"`
	Status       string    `json:"status,omitempty"`
}

type roaiNationalScoresFile struct {
	Sources []Source               `json:"sources"`
	Scores  []roaiNationalScoreRow `json:"scores"`
}

type roaiNationalScoreRow struct {
	Position   int         `json:"position"`
	Rank       int         `json:"rank"`
	Username   string      `json:"username"`
	TaskScores []flexFloat `json:"taskScores"`
	Score      flexFloat   `json:"score"`
	ScoreMax   flexFloat   `json:"scoreMax"`
}

type mlcompeteFile struct {
	Sources      []Source               `json:"sources"`
	Leaderboards []mlcompeteLeaderboard `json:"leaderboards"`
}

type mlcompeteLeaderboard struct {
	SourceID      string         `json:"sourceId"`
	CompetitionID int            `json:"competitionId"`
	ContestID     string         `json:"contestId"`
	Section       string         `json:"section"`
	Rows          []mlcompeteRow `json:"rows"`
}

type mlcompeteRow struct {
	UserID   string    `json:"userId"`
	Username string    `json:"username"`
	Rank     int       `json:"rank"`
	Score    flexFloat `json:"score"`
}

type mlcompeteScoreBoard struct {
	ContestID string
	Section   string
	Rows      []mlcompeteScoreRow
}

type mlcompeteScoreRow struct {
	UserID   string
	Username string
	Score    float64
}

type roaiQualifiedRow struct {
	Name   string `json:"name"`
	Grade  string `json:"grade"`
	School string `json:"school"`
	County string `json:"county"`
}

type roaiLotRankingRow struct {
	Year          int       `json:"year"`
	Section       string    `json:"section"`
	Name          string    `json:"name"`
	Place         int       `json:"place"`
	Score         flexFloat `json:"score"`
	ScoreMax      flexFloat `json:"scoreMax"`
	Qualification string    `json:"qualification"`
	SourceID      string    `json:"sourceId"`
}
