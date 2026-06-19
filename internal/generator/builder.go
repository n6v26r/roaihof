package generator

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

type builder struct {
	aliases       map[string]string
	aliasReasons  map[string]string
	people        map[string]*Person
	schools       map[string]*School
	counties      map[string]*County
	contests      map[string]*Contest
	results       []Result
	sources       map[string]Source
	sourceOrder   []string
	sourceStatus  []SourceStatus
	sourceTodos   []SourceTodo
	schoolCounty  map[string]string
	personAliases map[string]map[string]bool
}

func newBuilder(aliases map[string]string, aliasReasons map[string]string) *builder {
	return &builder{
		aliases:       aliases,
		aliasReasons:  aliasReasons,
		people:        map[string]*Person{},
		schools:       map[string]*School{},
		counties:      map[string]*County{},
		contests:      map[string]*Contest{},
		sources:       map[string]Source{},
		sourceTodos:   []SourceTodo{},
		schoolCounty:  map[string]string{},
		personAliases: map[string]map[string]bool{},
	}
}

func (b *builder) importONIANational(path string, recoveryPath string) error {
	var file oniaNationalFile
	if err := readJSON(path, &file); err != nil {
		return err
	}
	recovered, guests, err := b.loadONIANationalRecovery(recoveryPath)
	if err != nil {
		return err
	}
	b.addContest(Contest{
		ID:          "onia-2026-nationala",
		Name:        "ONIA 2026",
		Year:        2026,
		Circuit:     "ONIA",
		Stage:       "national",
		Date:        "2026-04-17",
		City:        "București",
		Country:     "România",
		OfficialURL: "https://olimpiada-ai.ro/ro/rezultate/nationala",
		SourceID:    sourceONIANational,
	})
	classes := []struct {
		grade string
		rows  []oniaNationalRow
	}{
		{"9", file.Clasa9},
		{"10", file.Clasa10},
		{"11", file.Clasa11},
		{"12", file.Clasa12},
	}
	for _, group := range classes {
		for _, row := range group.rows {
			if row.isAbsent() {
				continue
			}
			name := b.canonicalName(row.Username)
			anonymous := isAnonymousName(name)
			county := normalizeCounty(row.Judet)
			originalCounty := cleanHuman(row.Judet)
			school := cleanHuman(row.Scoala)
			mlcompeteUsername := ""
			if anonymous {
				if recovery, ok := recovered[oniaNationalRecoveryKey(group.grade, row.Pozitie, row.ScorTotal.Value)]; ok {
					name = b.canonicalName(recovery.Name)
					anonymous = false
					county = normalizeCounty(recovery.County)
					originalCounty = cleanHuman(recovery.County)
					school = cleanHuman(recovery.School)
					mlcompeteUsername = cleanHuman(recovery.Username)
				}
			}
			section := "clasa " + group.grade
			result := Result{
				ContestID:      "onia-2026-nationala",
				PersonName:     name,
				School:         school,
				County:         county,
				OriginalCounty: originalCounty,
				Locality:       cleanHuman(row.Localitate),
				Year:           2026,
				Circuit:        "ONIA",
				Stage:          "national",
				Section:        section,
				Grade:          group.grade,
				Place:          row.Pozitie,
				Score:          row.ScorTotal.Value,
				ScoreKnown:     row.ScorTotal.Present,
				Medal:          normalizeMedal(ptr(row.Medalie)),
				Prize:          cleanPrize(ptr(row.Premiu)),
				SourceID:       sourceONIANational,
				Anonymous:      anonymous,
			}
			b.addResult(result)
			if mlcompeteUsername != "" {
				b.addExternalUsername(name, "mlcompete", mlcompeteUsername)
			}
		}
	}
	for _, guest := range guests {
		name := b.canonicalName(guest.Name)
		b.addResult(Result{
			ContestID:      "onia-2026-nationala",
			PersonName:     name,
			School:         cleanHuman(guest.School),
			County:         normalizeCounty(guest.County),
			OriginalCounty: cleanHuman(guest.County),
			Year:           2026,
			Circuit:        "ONIA",
			Stage:          "national",
			Section:        "clasa " + guest.Grade,
			Grade:          guest.Grade,
			Score:          float64(guest.Score),
			ScoreKnown:     true,
			Status:         guest.Status,
			SourceID:       sourceONIANationalGuests,
		})
		if guest.Username != "" {
			b.addExternalUsername(name, "mlcompete", guest.Username)
		}
	}
	return nil
}

func (b *builder) loadONIANationalRecovery(path string) (map[string]oniaNationalRecoveryRow, []oniaNationalGuestRow, error) {
	var file oniaNationalRecoveryFile
	if err := readJSON(path, &file); err != nil {
		return nil, nil, err
	}
	for _, source := range file.Sources {
		b.addSource(source)
	}
	recovered := map[string]oniaNationalRecoveryRow{}
	for _, row := range file.Recovered {
		grade := normalizeGrade(row.Grade)
		if grade == "8" {
			continue
		}
		if grade == "" || row.Place == 0 || cleanHuman(row.Name) == "" {
			return nil, nil, fmt.Errorf("invalid ONIA national recovery row: grade=%q place=%d score=%.2f name=%q", row.Grade, row.Place, float64(row.Score), row.Name)
		}
		row.Grade = grade
		key := oniaNationalRecoveryKey(row.Grade, row.Place, float64(row.Score))
		if _, ok := recovered[key]; ok {
			return nil, nil, fmt.Errorf("duplicate ONIA national recovery row for %s", key)
		}
		recovered[key] = row
	}
	guests := make([]oniaNationalGuestRow, 0, len(file.Guests))
	for _, row := range file.Guests {
		row.Grade = normalizeGrade(row.Grade)
		row.Name = cleanHuman(row.Name)
		row.School = cleanHuman(row.School)
		row.County = cleanHuman(row.County)
		row.Username = cleanHuman(row.Username)
		row.UserID = cleanHuman(row.UserID)
		row.Status = strings.ToLower(nameKey(row.Status))
		if row.Status == "" {
			row.Status = "guest"
		}
		if row.Status == "guests" {
			row.Status = "guest"
		}
		if row.Grade != "8" || row.Name == "" || row.School == "" || row.County == "" || row.Username == "" || row.UserID == "" || row.Score == 0 || row.Status != "guest" {
			return nil, nil, fmt.Errorf("invalid ONIA national guest row: grade=%q name=%q school=%q county=%q username=%q userId=%q score=%.2f status=%q", row.Grade, row.Name, row.School, row.County, row.Username, row.UserID, float64(row.Score), row.Status)
		}
		guests = append(guests, row)
	}
	return recovered, guests, nil
}

func oniaNationalRecoveryKey(grade string, place int, score float64) string {
	return fmt.Sprintf("%s:%d:%.2f", normalizeGrade(grade), place, roundScore(score))
}

type oniaLotScoredCandidate struct {
	Row      oniaLotRow
	Name     string
	Username string
	Score    float64
}

type oniaLotPlatformScore struct {
	Username string
	Total    float64
}

func (b *builder) importONIALotSelection(nationalPath string, selectionPath string, platformPath string) error {
	var national oniaNationalFile
	if err := readJSON(nationalPath, &national); err != nil {
		return err
	}
	if len(national.LotNational) != oniaLotParticipantCount {
		return fmt.Errorf("ONIA LotNational rows = %d, want %d", len(national.LotNational), oniaLotParticipantCount)
	}

	var file oniaLotSelectionFile
	if err := readJSON(selectionPath, &file); err != nil {
		return err
	}

	var platform mlcompeteFile
	if err := readJSON(platformPath, &platform); err != nil {
		return err
	}
	for _, source := range platform.Sources {
		b.addSource(source)
	}

	if file.Year == 0 {
		file.Year = 2026
	}
	b.addContest(Contest{
		ID:          "onia-2026-lot",
		Name:        "ONIA 2026 Lot",
		Year:        file.Year,
		Circuit:     "ONIA",
		Stage:       "lot",
		Section:     "IOAI/CEOAI",
		Date:        "2026-05-21",
		City:        "Timișoara",
		Country:     "România",
		OfficialURL: "https://olimpiada-ai.ro/ro/rezultate/lot-largit",
		SourceID:    sourceONIALot,
	})

	scoresByUsername := oniaLotScoresByUsername(platform.Leaderboards)
	var rows []oniaLotScoredCandidate
	var missing []string
	for _, row := range national.LotNational {
		name := b.canonicalName(row.Nume)
		person := b.people[slug(name)]
		username, ok := oniaLotMLCompeteUsername(person, scoresByUsername)
		if !ok {
			if oniaLotKnownAbsentParticipant(name, "") {
				continue
			}
			missing = append(missing, fmt.Sprintf("%s: missing mlcompete username", name))
			continue
		}
		score, ok := scoresByUsername[usernameKey(username)]
		if !ok || score.Total == 0 {
			if oniaLotKnownAbsentParticipant(name, username) {
				continue
			}
			missing = append(missing, fmt.Sprintf("%s (%s): missing Lot score", name, username))
			continue
		}
		rows = append(rows, oniaLotScoredCandidate{
			Row:      row,
			Name:     name,
			Username: username,
			Score:    score.Total,
		})
	}
	if len(missing) > 0 {
		return fmt.Errorf("could not map ONIA Lot participants: %s", strings.Join(missing, "; "))
	}
	if len(rows) != oniaLotParticipantCount-1 {
		return fmt.Errorf("ONIA counted Lot rows = %d, want %d", len(rows), oniaLotParticipantCount-1)
	}

	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].Score != rows[j].Score {
			return rows[i].Score > rows[j].Score
		}
		if rows[i].Row.Pozitie != rows[j].Row.Pozitie {
			return rows[i].Row.Pozitie < rows[j].Row.Pozitie
		}
		return rows[i].Name < rows[j].Name
	})

	for index, row := range rows {
		place := index + 1
		result := Result{
			ContestID:     "onia-2026-lot",
			PersonName:    row.Name,
			School:        cleanHuman(row.Row.Scoala),
			Year:          file.Year,
			Circuit:       "ONIA",
			Stage:         "lot",
			Section:       cleanHuman(row.Row.Sectiune),
			Grade:         normalizeGrade(row.Row.Clasa),
			Place:         place,
			Score:         row.Score,
			ScoreKnown:    true,
			Qualification: oniaLotQualification(place),
			SourceID:      sourceONIALot,
		}
		b.addResult(result)
	}
	return nil
}

func oniaLotScoresByUsername(leaderboards []mlcompeteLeaderboard) map[string]oniaLotPlatformScore {
	scores := map[string]oniaLotPlatformScore{}
	for _, board := range mlcompeteScoreBoards(leaderboards) {
		if board.ContestID != "onia-2026-lot" {
			continue
		}
		for _, row := range board.Rows {
			username := cleanHuman(row.Username)
			key := usernameKey(username)
			if key == "" {
				continue
			}
			scores[key] = oniaLotPlatformScore{
				Username: username,
				Total:    roundScore(row.Score),
			}
		}
	}
	return scores
}

func oniaLotMLCompeteUsername(person *Person, scores map[string]oniaLotPlatformScore) (string, bool) {
	if person == nil || person.ExternalUsernames == nil {
		return "", false
	}
	var scored []string
	for _, username := range person.ExternalUsernames.MLCompete {
		if _, ok := scores[usernameKey(username)]; ok {
			scored = addUnique(scored, username)
		}
	}
	if len(scored) == 1 {
		return scored[0], true
	}
	if len(scored) > 1 {
		return "", false
	}
	if len(person.ExternalUsernames.MLCompete) == 1 {
		return person.ExternalUsernames.MLCompete[0], true
	}
	return "", false
}

func oniaLotKnownAbsentParticipant(name string, username string) bool {
	return nameKey(name) == nameKey("Neculau Rareș-Andrei") || usernameKey(username) == "nrand"
}

func oniaLotQualification(place int) string {
	switch {
	case place >= 1 && place <= 8:
		return "IOAI"
	case place <= 12:
		return "CEOAI"
	default:
		return ""
	}
}

func (b *builder) importROAI(path string, roai2025NationalScoresPath string, roai2025NationalRecoveryPath string) error {
	var file roaiFile
	if err := readJSON(path, &file); err != nil {
		return err
	}
	for _, source := range file.Sources {
		b.addSource(source)
	}
	if roai2025NationalRecoveryPath != "" {
		recovered, err := b.loadROAI2025NationalRecovery(roai2025NationalRecoveryPath)
		if err != nil {
			return err
		}
		national := make([]roaiNationalRow, 0, len(file.National)+len(recovered))
		for _, row := range file.National {
			if row.Year == 2025 {
				continue
			}
			national = append(national, row)
		}
		national = append(national, recovered...)
		file.National = national
	}
	roai2025NationalScores, err := b.loadROAI2025NationalScores(roai2025NationalScoresPath)
	if err != nil {
		return err
	}

	identities := map[string]roaiQualifiedRow{}
	identitiesByName := map[string]roaiQualifiedRow{}
	identitiesByNameAndYear := map[string]roaiQualifiedRow{}
	addedNationalContests := map[string]bool{}
	for _, row := range file.National {
		year := row.Year
		if year == 0 {
			year = 2026
		}
		grade := normalizeGrade(row.Grade)
		contestID, sourceID, section := roaiNationalContest(year, row.Section, grade, row.SourceID)
		if !addedNationalContests[contestID] {
			b.addContest(Contest{
				ID:          contestID,
				Name:        fmt.Sprintf("ROAI %d %s", year, section),
				Year:        year,
				Circuit:     "ROAI",
				Stage:       "national",
				Section:     section,
				Date:        roaiNationalDate(year),
				City:        "București",
				Country:     "România",
				OfficialURL: b.sources[sourceID].URL,
				SourceID:    sourceID,
			})
			addedNationalContests[contestID] = true
		}
		identity := roaiQualifiedRow{
			Name:   b.canonicalName(row.Name),
			Grade:  grade,
			School: cleanHuman(row.School),
			County: normalizeCounty(row.County),
		}
		if row.Username != "" {
			identities[nameKey(row.Username)] = identity
		}
		identitiesByName[nameKey(identity.Name)] = identity
		identitiesByNameAndYear[identityYearKey(year, identity.Name)] = identity
		score := row.Score
		scoreMax := row.ScoreMax
		judgeUsername := cleanHuman(row.Username)
		if year == 2025 {
			// The 2025 class PDFs preserve the cumulative leaderboard row position;
			// the Nitro table rank column skips tied places.
			scoreRow, ok := roai2025NationalScores[row.Place]
			if !ok {
				return fmt.Errorf("missing ROAI 2025 national score for leaderboard position %d (%s)", row.Place, identity.Name)
			}
			score = scoreRow.Score
			scoreMax = scoreRow.ScoreMax
		}
		if judgeUsername != "" {
			b.addExternalUsername(identity.Name, "judge", judgeUsername)
		}
		b.addResult(Result{
			ContestID:      contestID,
			PersonName:     identity.Name,
			School:         identity.School,
			County:         identity.County,
			OriginalCounty: cleanHuman(row.County),
			Year:           year,
			Circuit:        "ROAI",
			Stage:          "national",
			Section:        section,
			Grade:          identity.Grade,
			Place:          row.Place,
			Score:          float64(score),
			ScoreKnown:     true,
			ScoreMax:       float64(scoreMax),
			Medal:          normalizeMedal(row.Medal),
			Prize:          cleanPrize(row.Prize),
			Status:         cleanHuman(row.Status),
			SourceID:       sourceID,
		})
	}

	for _, row := range file.Lot {
		name := b.canonicalName(row.Name)
		identity := roaiQualifiedRow{
			Name:   name,
			Grade:  normalizeGrade(row.Grade),
			School: cleanHuman(row.School),
			County: normalizeCounty(row.County),
		}
		if existing, ok := identitiesByName[nameKey(name)]; ok {
			if identity.Grade == "" {
				identity.Grade = existing.Grade
			}
			if identity.School == "" {
				identity.School = existing.School
			}
			if identity.County == "" {
				identity.County = existing.County
			}
		}
		identitiesByName[nameKey(identity.Name)] = identity
	}

	addedLotRankingContests := map[string]bool{}
	for _, row := range file.LotRankings {
		if row.Year == 0 {
			row.Year = 2025
		}
		section := strings.ToUpper(cleanHuman(row.Section))
		contestID := fmt.Sprintf("roai-%d-lot-%s", row.Year, strings.ToLower(section))
		sourceID := row.SourceID
		if sourceID == "" {
			sourceID = fmt.Sprintf("roai-%d-lot-%s-pdf", row.Year, strings.ToLower(section))
		}
		if !addedLotRankingContests[contestID] {
			b.addContest(Contest{
				ID:          contestID,
				Name:        fmt.Sprintf("ROAI %d Lot %s", row.Year, section),
				Year:        row.Year,
				Circuit:     "ROAI",
				Stage:       "lot",
				Section:     section,
				Date:        roaiLotDate(row.Year),
				City:        "București",
				Country:     "România",
				OfficialURL: b.sources[sourceID].URL,
				SourceID:    sourceID,
			})
			addedLotRankingContests[contestID] = true
		}
		name := b.canonicalName(row.Name)
		identity := roaiQualifiedRow{Name: name}
		if existing, ok := identitiesByNameAndYear[identityYearKey(row.Year, name)]; ok {
			identity = existing
		} else if existing, ok := identitiesByName[nameKey(name)]; ok {
			identity = existing
		}
		b.addResult(Result{
			ContestID:     contestID,
			PersonName:    name,
			School:        cleanHuman(identity.School),
			County:        normalizeCounty(identity.County),
			Year:          row.Year,
			Circuit:       "ROAI",
			Stage:         "lot",
			Section:       section,
			Grade:         normalizeGrade(identity.Grade),
			Place:         row.Place,
			Score:         float64(row.Score),
			ScoreKnown:    true,
			ScoreMax:      float64(row.ScoreMax),
			Qualification: cleanHuman(row.Qualification),
			SourceID:      sourceID,
		})
	}
	return nil
}

func (b *builder) loadROAI2025NationalRecovery(path string) ([]roaiNationalRow, error) {
	var file roaiFile
	if err := readJSON(path, &file); err != nil {
		return nil, err
	}
	for _, source := range file.Sources {
		b.addSource(source)
	}
	if len(file.National) == 0 {
		return nil, fmt.Errorf("ROAI 2025 national recovery has no national rows")
	}
	seenPlaces := map[int]bool{}
	for i := range file.National {
		row := &file.National[i]
		if row.Year != 2025 {
			return nil, fmt.Errorf("ROAI 2025 national recovery row for %q has year %d", row.Name, row.Year)
		}
		if row.Place == 0 || row.Name == "" || row.Grade == "" || row.School == "" || row.County == "" || row.Username == "" {
			return nil, fmt.Errorf("invalid ROAI 2025 national recovery row: place=%d name=%q grade=%q school=%q county=%q username=%q", row.Place, row.Name, row.Grade, row.School, row.County, row.Username)
		}
		if seenPlaces[row.Place] {
			return nil, fmt.Errorf("duplicate ROAI 2025 national recovery place %d", row.Place)
		}
		seenPlaces[row.Place] = true
	}
	return file.National, nil
}

func (b *builder) loadROAI2025NationalScores(path string) (map[int]roaiNationalScoreRow, error) {
	var file roaiNationalScoresFile
	if err := readJSON(path, &file); err != nil {
		return nil, err
	}
	for _, source := range file.Sources {
		b.addSource(source)
	}
	scores := map[int]roaiNationalScoreRow{}
	for _, row := range file.Scores {
		if row.Position == 0 {
			return nil, fmt.Errorf("ROAI 2025 national score row has empty position for %q", row.Username)
		}
		if row.ScoreMax == 0 {
			return nil, fmt.Errorf("ROAI 2025 national score row at position %d has empty scoreMax", row.Position)
		}
		if _, ok := scores[row.Position]; ok {
			return nil, fmt.Errorf("duplicate ROAI 2025 national score position %d", row.Position)
		}
		scores[row.Position] = row
	}
	return scores, nil
}

func (b *builder) importMLCompeteUsernames(path string) error {
	var file mlcompeteFile
	if err := readJSON(path, &file); err != nil {
		return err
	}
	for _, source := range file.Sources {
		b.addSource(source)
	}

	judgeOwners := b.usernameOwnersFromJudge()
	nameOwners := b.usernameOwnersFromNames()
	for _, leaderboard := range file.Leaderboards {
		if leaderboard.SourceID != "" {
			if _, ok := b.sources[leaderboard.SourceID]; !ok {
				return fmt.Errorf("MLCompete leaderboard %d references missing source %q", leaderboard.CompetitionID, leaderboard.SourceID)
			}
		}
		for _, row := range leaderboard.Rows {
			username := cleanHuman(row.Username)
			key := usernameKey(username)
			if key == "" {
				continue
			}
			personID, ok := singleStringSetValue(judgeOwners[key])
			if !ok {
				personID, ok = singleStringSetValue(nameOwners[key])
			}
			if !ok {
				continue
			}
			if !b.personParticipatesInMLCompeteBoard(personID, leaderboard) {
				continue
			}
			b.addExternalUsernameToPerson(b.people[personID], "mlcompete", username)
		}
	}
	b.importMLCompeteScoreMatches(file.Leaderboards, judgeOwners, nameOwners)
	return nil
}

func (b *builder) importMLCompeteScoreMatches(leaderboards []mlcompeteLeaderboard, judgeOwners map[string]map[string]bool, nameOwners map[string]map[string]bool) {
	for _, board := range mlcompeteScoreBoards(leaderboards) {
		officialResults := b.mlcompeteOfficialResultsForBoard(board)
		if len(officialResults) == 0 {
			continue
		}
		for _, row := range board.Rows {
			username := cleanHuman(row.Username)
			if username == "" || row.Score == 0 {
				continue
			}
			personID, ok := b.uniqueMLCompeteScoreOwner(row, board.Rows, officialResults)
			if !ok || !b.canAddMLCompeteScoreUsername(personID, username, judgeOwners, nameOwners) {
				continue
			}
			b.addExternalUsernameToPerson(b.people[personID], "mlcompete", username)
		}
	}
}

func mlcompeteScoreBoards(leaderboards []mlcompeteLeaderboard) []mlcompeteScoreBoard {
	var boards []mlcompeteScoreBoard
	combined := map[string]map[string]mlcompeteScoreRow{}
	for _, leaderboard := range leaderboards {
		if leaderboard.ContestID == "onia-2026-nationala" {
			board := mlcompeteScoreBoard{ContestID: leaderboard.ContestID, Section: leaderboard.Section}
			for _, row := range leaderboard.Rows {
				board.Rows = append(board.Rows, mlcompeteScoreRow{
					UserID:   cleanHuman(row.UserID),
					Username: cleanHuman(row.Username),
					Score:    float64(row.Score),
				})
			}
			boards = append(boards, board)
			continue
		}
		if combined[leaderboard.ContestID] == nil {
			combined[leaderboard.ContestID] = map[string]mlcompeteScoreRow{}
		}
		for _, row := range leaderboard.Rows {
			key := cleanHuman(row.UserID)
			if key == "" {
				key = usernameKey(row.Username)
			}
			if key == "" {
				continue
			}
			item := combined[leaderboard.ContestID][key]
			item.UserID = key
			if item.Username == "" {
				item.Username = cleanHuman(row.Username)
			}
			item.Score += float64(row.Score)
			combined[leaderboard.ContestID][key] = item
		}
	}
	for contestID, rowsByUser := range combined {
		board := mlcompeteScoreBoard{ContestID: contestID}
		for _, row := range rowsByUser {
			board.Rows = append(board.Rows, row)
		}
		boards = append(boards, board)
	}
	return boards
}

func (b *builder) mlcompeteOfficialResultsForBoard(board mlcompeteScoreBoard) []Result {
	var results []Result
	for _, result := range b.results {
		if result.ContestID != board.ContestID || result.PersonID == "" || result.Anonymous || result.Score == 0 {
			continue
		}
		if board.ContestID == "onia-2026-nationala" && oniaMLCompeteSection(result.Grade) != board.Section {
			continue
		}
		results = append(results, result)
	}
	return results
}

func (b *builder) uniqueMLCompeteScoreOwner(row mlcompeteScoreRow, platformRows []mlcompeteScoreRow, officialResults []Result) (string, bool) {
	var match *Result
	for i := range officialResults {
		if !scoresClose(row.Score, officialResults[i].Score) {
			continue
		}
		if match != nil {
			return "", false
		}
		match = &officialResults[i]
	}
	if match == nil {
		return "", false
	}
	matchingPlatformRows := 0
	for _, platformRow := range platformRows {
		if scoresClose(platformRow.Score, match.Score) {
			matchingPlatformRows++
		}
	}
	if matchingPlatformRows != 1 {
		return "", false
	}
	return match.PersonID, true
}

func (b *builder) canAddMLCompeteScoreUsername(personID string, username string, judgeOwners map[string]map[string]bool, nameOwners map[string]map[string]bool) bool {
	person := b.people[personID]
	if person == nil {
		return false
	}
	if person.ExternalUsernames != nil && len(person.ExternalUsernames.MLCompete) > 0 {
		return contains(person.ExternalUsernames.MLCompete, username)
	}
	key := usernameKey(username)
	if key == "" {
		return false
	}
	for _, owners := range []map[string]map[string]bool{judgeOwners, nameOwners, b.usernameOwnersFromMLCompete()} {
		ownerID, ok := singleStringSetValue(owners[key])
		if !ok {
			if len(owners[key]) > 0 {
				return false
			}
			continue
		}
		if ownerID != personID {
			return false
		}
	}
	return true
}

func (b *builder) usernameOwnersFromMLCompete() map[string]map[string]bool {
	owners := map[string]map[string]bool{}
	for id, person := range b.people {
		if person.ExternalUsernames == nil {
			continue
		}
		for _, username := range person.ExternalUsernames.MLCompete {
			addSetValue(owners, usernameKey(username), id)
		}
	}
	return owners
}

func scoresClose(left float64, right float64) bool {
	diff := left - right
	if diff < 0 {
		diff = -diff
	}
	return diff <= mlcompeteScoreTolerance+1e-9
}

func roundScore(score float64) float64 {
	return math.Round(score*100) / 100
}

func (b *builder) personParticipatesInMLCompeteBoard(personID string, leaderboard mlcompeteLeaderboard) bool {
	for _, result := range b.results {
		if result.ContestID != leaderboard.ContestID || !b.samePersonForMLCompete(personID, result.PersonID) {
			continue
		}
		if leaderboard.ContestID == "onia-2026-nationala" {
			return oniaMLCompeteSection(result.Grade) == leaderboard.Section
		}
		return true
	}
	return false
}

func (b *builder) samePersonForMLCompete(leftID string, rightID string) bool {
	if leftID == "" || rightID == "" {
		return false
	}
	if leftID == rightID {
		return true
	}
	left := b.people[leftID]
	right := b.people[rightID]
	if left == nil || right == nil {
		return false
	}
	_, _, ok := missingNameAliasCandidate(leftID, left.Name, rightID, right.Name)
	if !ok {
		return false
	}
	return !b.personResultsConflict(leftID, rightID) && b.personResultsShareContext(leftID, rightID)
}

func oniaMLCompeteSection(grade string) string {
	switch normalizeGrade(grade) {
	case "9", "10":
		return "IX-X"
	case "11", "12":
		return "XI-XII"
	default:
		return ""
	}
}

func (b *builder) usernameOwnersFromJudge() map[string]map[string]bool {
	owners := map[string]map[string]bool{}
	for id, person := range b.people {
		if person.ExternalUsernames == nil {
			continue
		}
		for _, username := range person.ExternalUsernames.Judge {
			addSetValue(owners, usernameKey(username), id)
		}
	}
	return owners
}

func (b *builder) usernameOwnersFromNames() map[string]map[string]bool {
	owners := map[string]map[string]bool{}
	for id, person := range b.people {
		for _, variant := range personUsernameVariants(person) {
			addSetValue(owners, variant, id)
		}
	}
	return owners
}

func personUsernameVariants(person *Person) []string {
	if person == nil {
		return nil
	}
	names := append([]string{person.Name}, person.Aliases...)
	var variants []string
	for _, name := range names {
		tokens := personNameTokens(name)
		if len(tokens) < 2 || len(tokens) > 3 {
			continue
		}
		for _, permutation := range tokenPermutations(tokens) {
			variants = addUnique(variants, strings.Join(permutation, ""))
		}
	}
	return variants
}

func tokenPermutations(tokens []string) [][]string {
	if len(tokens) == 0 {
		return nil
	}
	used := make([]bool, len(tokens))
	var current []string
	var output [][]string
	var walk func()
	walk = func() {
		if len(current) == len(tokens) {
			item := append([]string(nil), current...)
			output = append(output, item)
			return
		}
		for i, token := range tokens {
			if used[i] {
				continue
			}
			used[i] = true
			current = append(current, token)
			walk()
			current = current[:len(current)-1]
			used[i] = false
		}
	}
	walk()
	return output
}

func addSetValue(target map[string]map[string]bool, key string, value string) {
	if key == "" || value == "" {
		return
	}
	if target[key] == nil {
		target[key] = map[string]bool{}
	}
	target[key][value] = true
}

func singleStringSetValue(values map[string]bool) (string, bool) {
	if len(values) != 1 {
		return "", false
	}
	for value := range values {
		return value, true
	}
	return "", false
}

func usernameKey(value string) string {
	return strings.ReplaceAll(nameKey(value), " ", "")
}

func roaiNationalContest(year int, rawSection string, grade string, rawSourceID string) (string, string, string) {
	section := cleanHuman(rawSection)
	if section == "" && grade != "" {
		section = "Clasa " + grade
	}
	sourceID := cleanHuman(rawSourceID)
	switch section {
	case "IX-X":
		if sourceID == "" {
			sourceID = fmt.Sprintf("roai-%d-final-ix-x", year)
		}
		return fmt.Sprintf("roai-%d-national-ix-x", year), sourceID, section
	case "XI-XII":
		if sourceID == "" {
			sourceID = fmt.Sprintf("roai-%d-final-xi-xii", year)
		}
		return fmt.Sprintf("roai-%d-national-xi-xii", year), sourceID, section
	default:
		sectionSlug := slug(section)
		if sourceID == "" {
			sourceID = fmt.Sprintf("roai-%d-final-%s", year, sectionSlug)
		}
		return fmt.Sprintf("roai-%d-national-%s", year, sectionSlug), sourceID, section
	}
}

func roaiNationalDate(year int) string {
	switch year {
	case 2025:
		return "2025-05-17"
	case 2026:
		return "2026-04-06"
	default:
		return fmt.Sprintf("%d-01-01", year)
	}
}

func roaiLotDate(year int) string {
	switch year {
	case 2025:
		return "2025-06-23"
	case 2026:
		return "2026-05-29"
	default:
		return fmt.Sprintf("%d-01-01", year)
	}
}

func (b *builder) importManualInternational(path string) error {
	var file manualInternationalFile
	if err := readJSON(path, &file); err != nil {
		return err
	}
	for _, source := range file.Sources {
		b.addSource(source)
	}
	for _, row := range file.Results {
		b.addContest(Contest{
			ID:          row.ContestID,
			Name:        row.ContestName,
			Year:        row.Year,
			Circuit:     row.Circuit,
			Stage:       row.Stage,
			Section:     row.Section,
			Date:        row.Date,
			City:        row.City,
			Country:     row.Country,
			OfficialURL: b.sources[row.SourceID].URL,
			SourceID:    row.SourceID,
		})
		result := Result{
			ContestID:     row.ContestID,
			PersonName:    b.canonicalName(row.PersonName),
			School:        cleanHuman(row.School),
			County:        normalizeCounty(row.County),
			Year:          row.Year,
			Circuit:       row.Circuit,
			Stage:         row.Stage,
			Section:       row.Section,
			Place:         row.Place,
			Score:         float64(row.Score),
			ScoreKnown:    true,
			ScoreMax:      float64(row.ScoreMax),
			Medal:         normalizeMedal(row.Medal),
			Prize:         cleanPrize(row.Prize),
			Qualification: cleanHuman(row.Qualification),
			SourceID:      row.SourceID,
		}
		b.addResult(result)
	}
	return nil
}

func (b *builder) addSource(source Source) {
	if _, ok := b.sources[source.ID]; ok {
		return
	}
	b.sources[source.ID] = source
	b.sourceOrder = append(b.sourceOrder, source.ID)
}

func (b *builder) addContest(contest Contest) {
	if existing, ok := b.contests[contest.ID]; ok {
		if existing.OfficialURL == "" {
			existing.OfficialURL = contest.OfficialURL
		}
		return
	}
	b.contests[contest.ID] = &contest
}

func (b *builder) addResult(result Result) {
	result.ID = "r-" + strconv.Itoa(len(b.results)+1)
	if !result.ScoreKnown && (result.Score != 0 || result.ScoreMax != 0) {
		result.ScoreKnown = true
	}
	result.School = canonicalSchoolNameForCounty(result.School, result.County)
	if result.County == "" && result.School != "" {
		result.County = b.countyForSchool(result.School)
	}
	if result.County != "" {
		county := b.ensureCounty(result.County)
		result.CountyID = county.ID
	}
	if result.School != "" {
		school := b.ensureSchool(result.School, result.CountyID)
		result.SchoolID = school.ID
		result.School = school.Name
		if result.County == "" {
			result.County = school.County
			result.CountyID = school.CountyID
		}
		if result.CountyID != "" {
			b.schoolCounty[school.ID] = result.CountyID
		}
	}
	if !result.Anonymous && !isAnonymousName(result.PersonName) {
		person := b.ensurePerson(result.PersonName)
		result.PersonID = person.ID
		result.PersonName = person.Name
	}
	if contest, ok := b.contests[result.ContestID]; ok {
		contest.ResultsCount++
	}
	b.results = append(b.results, result)
}

func (b *builder) addExternalUsername(personName string, platform string, username string) {
	username = cleanHuman(username)
	if username == "" {
		return
	}
	person := b.ensurePerson(personName)
	b.addExternalUsernameToPerson(person, platform, username)
}

func (b *builder) addExternalUsernameToPerson(person *Person, platform string, username string) {
	if person == nil {
		return
	}
	username = cleanHuman(username)
	if username == "" {
		return
	}
	if person.ExternalUsernames == nil {
		person.ExternalUsernames = &ExternalUsernames{}
	}
	switch platform {
	case "judge":
		person.ExternalUsernames.Judge = addUnique(person.ExternalUsernames.Judge, username)
		sort.Strings(person.ExternalUsernames.Judge)
	case "mlcompete":
		person.ExternalUsernames.MLCompete = addUnique(person.ExternalUsernames.MLCompete, username)
		sort.Strings(person.ExternalUsernames.MLCompete)
	}
	if len(person.ExternalUsernames.Judge) == 0 && len(person.ExternalUsernames.MLCompete) == 0 {
		person.ExternalUsernames = nil
	}
}

func (b *builder) ensurePerson(name string) *Person {
	name = cleanHuman(name)
	id := slug(name)
	if existing, ok := b.people[id]; ok {
		return existing
	}
	person := &Person{ID: id, Name: name}
	if aliasSet, ok := b.personAliases[nameKey(name)]; ok {
		for alias := range aliasSet {
			if alias != name {
				person.Aliases = append(person.Aliases, alias)
			}
		}
		sort.Strings(person.Aliases)
	}
	b.people[id] = person
	return person
}

func (b *builder) ensureSchool(name string, countyID string) *School {
	name = canonicalSchoolName(name)
	id := "school-" + slug(name)
	if existing, ok := b.schools[id]; ok {
		if existing.CountyID == "" && countyID != "" {
			existing.CountyID = countyID
			if county := b.counties[countyID]; county != nil {
				existing.County = county.Name
			}
		}
		return existing
	}
	school := &School{ID: id, Name: name, CountyID: countyID}
	if county := b.counties[countyID]; county != nil {
		school.County = county.Name
	}
	b.schools[id] = school
	return school
}

func (b *builder) ensureCounty(name string) *County {
	name = normalizeCounty(name)
	id := slug(name)
	if existing, ok := b.counties[id]; ok {
		return existing
	}
	county := &County{ID: id, Name: name}
	b.counties[id] = county
	return county
}

func (b *builder) countyForSchool(school string) string {
	id := "school-" + slug(canonicalSchoolName(school))
	if countyID, ok := b.schoolCounty[id]; ok {
		if county := b.counties[countyID]; county != nil {
			return county.Name
		}
	}
	if school := b.schools[id]; school != nil {
		return school.County
	}
	return ""
}

func (b *builder) canonicalName(name string) string {
	name = cleanHuman(name)
	key := nameKey(name)
	if canonical, ok := b.aliases[key]; ok {
		b.trackAlias(canonical, name)
		return canonical
	}
	return name
}

func (b *builder) trackAlias(canonical, alias string) {
	key := nameKey(canonical)
	if b.personAliases[key] == nil {
		b.personAliases[key] = map[string]bool{}
	}
	b.personAliases[key][alias] = true
}

func (b *builder) finalize() *Dataset {
	b.mergeSubsetPersonAliases()

	schoolContestants := map[string]map[string]bool{}
	countyContestants := map[string]map[string]bool{}
	personSelectionEvents := map[string]map[string]bool{}
	schoolSelectionEvents := map[string]map[string]bool{}
	countySelectionEvents := map[string]map[string]bool{}
	effectivePlaces := buildEffectivePlaceOverrides(b.results)
	for i := range b.results {
		result := &b.results[i]
		if result.PersonID != "" {
			person := b.people[result.PersonID]
			person.SchoolIDs = addUnique(person.SchoolIDs, result.SchoolID)
			person.CountyIDs = addUnique(person.CountyIDs, result.CountyID)
			if contributesToRomanianEntityStats(*result) {
				accumulateStats(&person.Stats, *result, effectivePlaces)
				person.Stats.UniqueContestants = 1
				addSelectionEvent(personSelectionEvents, result.PersonID, *result)
			}
		}
		if result.SchoolID != "" {
			school := b.schools[result.SchoolID]
			if contributesToRomanianEntityStats(*result) {
				accumulateStats(&school.Stats, *result, effectivePlaces)
				addSelectionEvent(schoolSelectionEvents, result.SchoolID, *result)
			}
			if result.PersonID != "" && contributesToRomanianEntityStats(*result) {
				if schoolContestants[result.SchoolID] == nil {
					schoolContestants[result.SchoolID] = map[string]bool{}
				}
				schoolContestants[result.SchoolID][result.PersonID] = true
			}
		}
		if result.CountyID != "" {
			county := b.counties[result.CountyID]
			if contributesToRomanianEntityStats(*result) {
				accumulateStats(&county.Stats, *result, effectivePlaces)
				addSelectionEvent(countySelectionEvents, result.CountyID, *result)
			}
			if result.PersonID != "" && contributesToRomanianEntityStats(*result) {
				if countyContestants[result.CountyID] == nil {
					countyContestants[result.CountyID] = map[string]bool{}
				}
				countyContestants[result.CountyID][result.PersonID] = true
			}
		}
	}
	for schoolID, contestants := range schoolContestants {
		if school := b.schools[schoolID]; school != nil {
			school.Stats.UniqueContestants = len(contestants)
		}
	}
	for countyID, contestants := range countyContestants {
		if county := b.counties[countyID]; county != nil {
			county.Stats.UniqueContestants = len(contestants)
		}
	}
	applySelectionEvents(b.people, personSelectionEvents)
	applySelectionEvents(b.schools, schoolSelectionEvents)
	applySelectionEvents(b.counties, countySelectionEvents)
	personInternationalStats, schoolInternationalStats, countyInternationalStats := internationalStatsByEntity(b.results)

	people := mapValues(b.people)
	schools := mapValues(b.schools)
	counties := mapValues(b.counties)
	contests := mapValues(b.contests)
	sort.Slice(people, func(i, j int) bool {
		if cmp := compareMergedRankingStats(people[i].Stats, people[j].Stats, personInternationalStats[people[i].ID], personInternationalStats[people[j].ID]); cmp != 0 {
			return cmp > 0
		}
		return people[i].Name < people[j].Name
	})
	sort.Slice(schools, func(i, j int) bool {
		if cmp := compareMergedRankingStats(schools[i].Stats, schools[j].Stats, schoolInternationalStats[schools[i].ID], schoolInternationalStats[schools[j].ID]); cmp != 0 {
			return cmp > 0
		}
		return schools[i].Name < schools[j].Name
	})
	sort.Slice(counties, func(i, j int) bool {
		if cmp := compareMergedRankingStats(counties[i].Stats, counties[j].Stats, countyInternationalStats[counties[i].ID], countyInternationalStats[counties[j].ID]); cmp != 0 {
			return cmp > 0
		}
		return counties[i].Name < counties[j].Name
	})
	sort.Slice(contests, func(i, j int) bool {
		if contests[i].Year == contests[j].Year {
			return contests[i].Name < contests[j].Name
		}
		return contests[i].Year > contests[j].Year
	})
	sort.Slice(b.results, func(i, j int) bool {
		if b.results[i].Year == b.results[j].Year {
			if b.results[i].ContestID == b.results[j].ContestID {
				return placeForSort(b.results[i].Place) < placeForSort(b.results[j].Place)
			}
			return b.results[i].ContestID < b.results[j].ContestID
		}
		return b.results[i].Year > b.results[j].Year
	})

	years := collectYears(b.results)
	circuits := collectCircuits(b.results)
	provenance := make([]Source, 0, len(b.sourceOrder))
	for _, id := range b.sourceOrder {
		provenance = append(provenance, b.sources[id])
	}
	summary := Summary{
		People:                len(people),
		Schools:               len(schools),
		Counties:              len(counties),
		Contests:              len(contests),
		Results:               len(b.results),
		NamedResults:          countNamed(b.results),
		AnonymousResults:      countAnonymous(b.results),
		Years:                 years,
		Circuits:              circuits,
		MergedByDefault:       true,
		ROAIStatus:            "ROAI 2025 national, ROAI 2026 national, and 2025-2026 Lot imported from official Nitro pages, ranking PDFs, and judge standings.",
		NationalCoverageScope: "National finals, Lot, and international results.",
	}
	if len(years) > 0 {
		summary.LatestYear = years[len(years)-1]
	}
	return &Dataset{
		GeneratedAt:    time.Now().UTC().Format(time.RFC3339),
		Summary:        summary,
		Provenance:     provenance,
		SourceStatuses: b.sourceStatus,
		SourceTodos:    b.sourceTodos,
		People:         people,
		Schools:        schools,
		Counties:       counties,
		Contests:       contests,
		Results:        b.results,
		Rankings: Rankings{
			People:   rankingRows(people, "person"),
			Schools:  rankingRows(schools, "school"),
			Counties: rankingRows(counties, "county"),
		},
		Search: buildSearch(people, schools, counties, contests),
	}
}

func (b *builder) mergeSubsetPersonAliases() {
	ids := make([]string, 0, len(b.people))
	for id := range b.people {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	candidates := map[string][]string{}
	for i, leftID := range ids {
		left := b.people[leftID]
		if left == nil {
			continue
		}
		for _, rightID := range ids[i+1:] {
			right := b.people[rightID]
			if right == nil {
				continue
			}
			aliasID, canonicalID, ok := missingNameAliasCandidate(leftID, left.Name, rightID, right.Name)
			if !ok {
				continue
			}
			if b.personResultsConflict(aliasID, canonicalID) || !b.personResultsShareContext(aliasID, canonicalID) {
				continue
			}
			candidates[aliasID] = addUnique(candidates[aliasID], canonicalID)
		}
	}

	aliasToCanonical := map[string]string{}
	for aliasID, canonicalIDs := range candidates {
		if len(canonicalIDs) == 1 {
			aliasToCanonical[aliasID] = canonicalIDs[0]
		}
	}

	aliases := make([]string, 0, len(aliasToCanonical))
	for aliasID := range aliasToCanonical {
		aliases = append(aliases, aliasID)
	}
	sort.Strings(aliases)
	for _, aliasID := range aliases {
		canonicalID := resolvePersonCanonical(aliasID, aliasToCanonical)
		b.mergePerson(aliasID, canonicalID)
	}
}

func missingNameAliasCandidate(leftID, leftName, rightID, rightName string) (string, string, bool) {
	leftTokens := personNameTokens(leftName)
	rightTokens := personNameTokens(rightName)
	if len(leftTokens) < 2 || len(rightTokens) < 2 || len(leftTokens) == len(rightTokens) {
		return "", "", false
	}
	if leftTokens[0] != rightTokens[0] {
		return "", "", false
	}
	if len(leftTokens) < len(rightTokens) {
		return leftID, rightID, isTokenSubsequence(leftTokens, rightTokens)
	}
	return rightID, leftID, isTokenSubsequence(rightTokens, leftTokens)
}

func personNameTokens(name string) []string {
	return strings.Fields(nameKey(name))
}

func isTokenSubsequence(shorter, longer []string) bool {
	index := 0
	for _, token := range longer {
		if index < len(shorter) && shorter[index] == token {
			index++
		}
	}
	return index == len(shorter)
}

func resolvePersonCanonical(aliasID string, aliasToCanonical map[string]string) string {
	seen := map[string]bool{}
	current := aliasID
	for {
		next, ok := aliasToCanonical[current]
		if !ok || seen[next] {
			return current
		}
		seen[current] = true
		current = next
	}
}

func (b *builder) personResultsConflict(leftID, rightID string) bool {
	seen := map[string]bool{}
	for _, result := range b.results {
		switch result.PersonID {
		case leftID:
			seen[personParticipationKey(result)] = true
		case rightID:
			if seen[personParticipationKey(result)] {
				return true
			}
		}
	}
	return false
}

func personParticipationKey(result Result) string {
	return result.ContestID
}

func (b *builder) personResultsShareContext(leftID, rightID string) bool {
	leftSchools, leftCounties := personResultContext(b.results, leftID)
	rightSchools, rightCounties := personResultContext(b.results, rightID)
	return setsIntersect(leftSchools, rightSchools) ||
		setsIntersect(leftCounties, rightCounties) ||
		(len(leftSchools) == 0 && len(leftCounties) == 0) ||
		(len(rightSchools) == 0 && len(rightCounties) == 0)
}

func personResultContext(results []Result, personID string) (map[string]bool, map[string]bool) {
	schools := map[string]bool{}
	counties := map[string]bool{}
	for _, result := range results {
		if result.PersonID != personID {
			continue
		}
		if result.SchoolID != "" {
			schools[result.SchoolID] = true
		}
		if result.CountyID != "" {
			counties[result.CountyID] = true
		}
	}
	return schools, counties
}

func setsIntersect(left, right map[string]bool) bool {
	for value := range left {
		if right[value] {
			return true
		}
	}
	return false
}

func (b *builder) mergePerson(aliasID, canonicalID string) {
	if aliasID == canonicalID {
		return
	}
	alias := b.people[aliasID]
	canonical := b.people[canonicalID]
	if alias == nil || canonical == nil {
		return
	}
	for i := range b.results {
		if b.results[i].PersonID == aliasID {
			b.results[i].PersonID = canonical.ID
			b.results[i].PersonName = canonical.Name
		}
	}
	b.addPersonAlias(canonical, alias.Name)
	for _, aliasName := range alias.Aliases {
		b.addPersonAlias(canonical, aliasName)
	}
	if alias.ExternalUsernames != nil {
		for _, username := range alias.ExternalUsernames.Judge {
			b.addExternalUsernameToPerson(canonical, "judge", username)
		}
		for _, username := range alias.ExternalUsernames.MLCompete {
			b.addExternalUsernameToPerson(canonical, "mlcompete", username)
		}
	}
	delete(b.people, aliasID)
}

func (b *builder) addPersonAlias(person *Person, alias string) {
	alias = cleanHuman(alias)
	if alias == "" || alias == person.Name || contains(person.Aliases, alias) {
		return
	}
	person.Aliases = append(person.Aliases, alias)
	sort.Strings(person.Aliases)
	b.trackAlias(person.Name, alias)
}

func addSelectionEvent(events map[string]map[string]bool, entityID string, result Result) {
	if entityID == "" || !isSelectionStage(result.Stage) {
		return
	}
	if events[entityID] == nil {
		events[entityID] = map[string]bool{}
	}
	events[entityID][selectionEventKey(result)] = true
}

func selectionEventKey(result Result) string {
	person := result.PersonID
	if person == "" {
		person = nameKey(result.PersonName)
	}
	return fmt.Sprintf("%s:%d:%s", person, result.Year, result.Circuit)
}

func identityYearKey(year int, name string) string {
	return fmt.Sprintf("%d:%s", year, nameKey(name))
}

func applySelectionEvents[T interface {
	*Person | *School | *County
}](items map[string]T, events map[string]map[string]bool) {
	for id, keys := range events {
		item := items[id]
		if item == nil {
			continue
		}
		stats := entityStats(item)
		stats.Selections = len(keys)
		stats.LotParticipations = len(keys)
	}
}

func entityStats[T interface {
	*Person | *School | *County
}](item T) *Stats {
	switch v := any(item).(type) {
	case *Person:
		return &v.Stats
	case *School:
		return &v.Stats
	case *County:
		return &v.Stats
	default:
		return nil
	}
}

func accumulateStats(stats *Stats, result Result, effectivePlaces map[string]int) {
	if !contributesToRomanianEntityStats(result) {
		return
	}
	stats.Years = addUniqueInt(stats.Years, result.Year)
	stats.Circuits = addUnique(stats.Circuits, result.Circuit)
	if isSelectionStage(result.Stage) {
	} else {
		stats.Participations++
		stats.NationalParticipations++
	}
	if result.Stage == "national" {
		switch result.Medal {
		case "gold":
			stats.Gold++
		case "silver":
			stats.Silver++
		case "bronze":
			stats.Bronze++
		case "honorable":
			stats.Honorable++
		}
	}
	if result.Stage == "national" && result.Prize != "" {
		stats.Prizes++
	}
	if isSelectionStage(result.Stage) && strings.Contains(result.Qualification, "IOAI") {
		stats.IOAISelections++
	}
	if isSelectionStage(result.Stage) && strings.Contains(result.Qualification, "CEOAI") {
		stats.CEOAISelections++
	}
	if isSelectionStage(result.Stage) && strings.Contains(result.Qualification, "IAIO") {
		stats.IAIOSelections++
	}
	place := effectivePlace(result, effectivePlaces)
	if result.Stage == "national" && place > 0 && (stats.BestPlace == 0 || place < stats.BestPlace) {
		stats.BestPlace = place
	}
	sort.Ints(stats.Years)
	sort.Strings(stats.Circuits)
}

func buildEffectivePlaceOverrides(results []Result) map[string]int {
	byContest := map[string][]int{}
	for i, result := range results {
		if usesROAI2025ClassPlacement(result) {
			byContest[result.ContestID] = append(byContest[result.ContestID], i)
		}
	}

	overrides := map[string]int{}
	for _, indices := range byContest {
		sort.Slice(indices, func(i, j int) bool {
			left := results[indices[i]]
			right := results[indices[j]]
			if left.Place != right.Place {
				return placeForSort(left.Place) < placeForSort(right.Place)
			}
			return left.PersonName < right.PersonName
		})
		previousPlace := -1
		displayPlace := 0
		for index, resultIndex := range indices {
			result := results[resultIndex]
			if result.Place != previousPlace {
				displayPlace = index + 1
				previousPlace = result.Place
			}
			overrides[result.ID] = displayPlace
		}
	}
	return overrides
}

func effectivePlace(result Result, overrides map[string]int) int {
	if place, ok := overrides[result.ID]; ok {
		return place
	}
	return result.Place
}

func usesROAI2025ClassPlacement(result Result) bool {
	return result.Circuit == "ROAI" &&
		result.Year == 2025 &&
		result.Stage == "national" &&
		result.Status != "guest" &&
		strings.HasPrefix(result.ContestID, "roai-2025-national-clasa-")
}

func contributesToRomanianEntityStats(result Result) bool {
	return result.Stage != "international"
}

func isSelectionStage(stage string) bool {
	return stage == "lot"
}

func internationalStatsByEntity(results []Result) (map[string]Stats, map[string]Stats, map[string]Stats) {
	people := map[string]Stats{}
	schools := map[string]Stats{}
	counties := map[string]Stats{}
	for _, result := range results {
		if result.Stage != "international" {
			continue
		}
		if result.PersonID != "" {
			stats := people[result.PersonID]
			accumulateInternationalRankingStats(&stats, result)
			people[result.PersonID] = stats
		}
		if result.SchoolID != "" {
			stats := schools[result.SchoolID]
			accumulateInternationalRankingStats(&stats, result)
			schools[result.SchoolID] = stats
		}
		if result.CountyID != "" {
			stats := counties[result.CountyID]
			accumulateInternationalRankingStats(&stats, result)
			counties[result.CountyID] = stats
		}
	}
	return people, schools, counties
}

func accumulateInternationalRankingStats(stats *Stats, result Result) {
	stats.Participations++
	stats.InternationalParticipations++
	switch result.Medal {
	case "gold":
		stats.Gold++
	case "silver":
		stats.Silver++
	case "bronze":
		stats.Bronze++
	case "honorable":
		stats.Honorable++
	}
	if result.Prize != "" {
		stats.Prizes++
	}
	if result.Place > 0 && (stats.BestPlace == 0 || result.Place < stats.BestPlace) {
		stats.BestPlace = result.Place
	}
}

func compareStats(a, b Stats) int {
	return compareMergedRankingStats(a, b, Stats{}, Stats{})
}

func compareMergedRankingStats(a, b Stats, aInternational, bInternational Stats) int {
	if cmp := compareNationalRankingStats(a, b); cmp != 0 {
		return cmp
	}
	if cmp := compareSelectionRankingStats(a, b); cmp != 0 {
		return cmp
	}
	return compareInternationalRankingStats(aInternational, bInternational)
}

func compareNationalRankingStats(a, b Stats) int {
	for _, check := range [][2]int{
		{a.Gold, b.Gold},
		{a.Silver, b.Silver},
		{a.Bronze, b.Bronze},
		{a.Prizes, b.Prizes},
	} {
		if check[0] != check[1] {
			return check[0] - check[1]
		}
	}
	return compareBestPlace(a.BestPlace, b.BestPlace)
}

func compareSelectionRankingStats(a, b Stats) int {
	return a.Selections - b.Selections
}

func compareInternationalRankingStats(a, b Stats) int {
	for _, check := range [][2]int{
		{a.Gold, b.Gold},
		{a.Silver, b.Silver},
		{a.Bronze, b.Bronze},
		{a.Prizes, b.Prizes},
	} {
		if check[0] != check[1] {
			return check[0] - check[1]
		}
	}
	if cmp := compareBestPlace(a.BestPlace, b.BestPlace); cmp != 0 {
		return cmp
	}
	return a.InternationalParticipations - b.InternationalParticipations
}

func compareBestPlace(a, b int) int {
	return placeForSort(b) - placeForSort(a)
}

func placeForSort(place int) int {
	if place <= 0 {
		return 1_000_000
	}
	return place
}

func rankingRows[T interface {
	*Person | *School | *County
}](items []T, kind string) []RankingRow {
	rows := make([]RankingRow, 0, len(items))
	for _, item := range items {
		switch v := any(item).(type) {
		case *Person:
			rows = append(rows, RankingRow{ID: v.ID, Name: v.Name, Kind: kind, Stats: v.Stats})
		case *School:
			rows = append(rows, RankingRow{ID: v.ID, Name: v.Name, Kind: kind, Stats: v.Stats})
		case *County:
			rows = append(rows, RankingRow{ID: v.ID, Name: v.Name, Kind: kind, Stats: v.Stats})
		}
	}
	if len(rows) > 50 {
		return rows[:50]
	}
	return rows
}

func buildSearch(people []*Person, schools []*School, counties []*County, contests []*Contest) []SearchItem {
	items := make([]SearchItem, 0, len(people)+len(schools)+len(counties)+len(contests))
	for _, person := range people {
		usernames := personSearchUsernames(person)
		items = append(items, SearchItem{
			ID:        person.ID,
			Kind:      "person",
			Title:     person.Name,
			Subtitle:  fmt.Sprintf("%d participări · %d/%d/%d medalii", person.Stats.Participations, person.Stats.Gold, person.Stats.Silver, person.Stats.Bronze),
			Tokens:    tokenList(person.Name, strings.Join(person.Aliases, " "), strings.Join(searchUsernameValues(usernames), " ")),
			Usernames: usernames,
		})
	}
	for _, school := range schools {
		items = append(items, SearchItem{
			ID:       school.ID,
			Kind:     "school",
			Title:    school.Name,
			Subtitle: fmt.Sprintf("%s · %d contestants", school.County, school.Stats.UniqueContestants),
			Tokens:   tokenList(school.Name, school.County),
		})
	}
	for _, county := range counties {
		items = append(items, SearchItem{
			ID:       county.ID,
			Kind:     "county",
			Title:    county.Name,
			Subtitle: fmt.Sprintf("%d contestants", county.Stats.UniqueContestants),
			Tokens:   tokenList(county.Name),
		})
	}
	for _, contest := range contests {
		items = append(items, SearchItem{
			ID:       contest.ID,
			Kind:     "contest",
			Title:    contest.Name,
			Subtitle: fmt.Sprintf("%d · %s · %d participări", contest.Year, contest.Circuit, contest.ResultsCount),
			Tokens:   tokenList(contest.Name, contest.Circuit, contest.Stage, strconv.Itoa(contest.Year)),
		})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Kind == items[j].Kind {
			return items[i].Title < items[j].Title
		}
		return items[i].Kind < items[j].Kind
	})
	return items
}

func personSearchUsernames(person *Person) []SearchUsername {
	if person == nil || person.ExternalUsernames == nil {
		return nil
	}
	var usernames []SearchUsername
	for _, username := range person.ExternalUsernames.Judge {
		usernames = append(usernames, SearchUsername{Platform: "judge", Username: username})
	}
	for _, username := range person.ExternalUsernames.MLCompete {
		usernames = append(usernames, SearchUsername{Platform: "mlcompete", Username: username})
	}
	return usernames
}

func searchUsernameValues(usernames []SearchUsername) []string {
	values := make([]string, 0, len(usernames))
	for _, username := range usernames {
		values = append(values, username.Username)
	}
	return values
}

func loadAliases(path string) (map[string]string, map[string]string, error) {
	var file aliasFile
	if err := readJSON(path, &file); err != nil {
		return nil, nil, err
	}
	aliases := map[string]string{}
	reasons := map[string]string{}
	for _, item := range file.Aliases {
		aliases[nameKey(item.Alias)] = cleanHuman(item.Canonical)
		reasons[nameKey(item.Alias)] = item.Reason
	}
	return aliases, reasons, nil
}

func readJSON(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return fmt.Errorf("%s is empty", path)
	}
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

func writeJSON(path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0o644)
}

func ptr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func normalizeMedal(value string) string {
	key := nameKey(value)
	switch {
	case key == "aur" || key == "gold" || strings.Contains(key, "medalie aur"):
		return "gold"
	case key == "argint" || key == "silver" || strings.Contains(key, "medalie argint"):
		return "silver"
	case key == "bronz" || key == "bronze" || strings.Contains(key, "medalie bronz"):
		return "bronze"
	case strings.Contains(key, "onoare") || key == "honorable":
		return "honorable"
	default:
		return ""
	}
}

func cleanPrize(value string) string {
	value = cleanHuman(value)
	if value == "-" || value == "null" {
		return ""
	}
	key := nameKey(value)
	switch {
	case key == "premiul i":
		return "Premiul I"
	case key == "premiul ii":
		return "Premiul II"
	case key == "premiul iii":
		return "Premiul III"
	case strings.Contains(key, "onoare"):
		return ""
	case strings.Contains(key, "medalie"):
		return ""
	case key == "m" || (strings.HasPrefix(key, "m") && len(key) == 2 && key[1] >= '0' && key[1] <= '9') || strings.Contains(key, "mentiune"):
		return "Mențiune"
	default:
		return value
	}
}

func normalizeGrade(value string) string {
	value = cleanHuman(value)
	replacer := strings.NewReplacer("a ", "", "-a", "", "Clasa", "", "clasa", "")
	value = replacer.Replace(value)
	value = strings.TrimSpace(value)
	switch value {
	case "VIII":
		return "8"
	case "IX":
		return "9"
	case "X":
		return "10"
	case "XI":
		return "11"
	case "XII":
		return "12"
	default:
		return value
	}
}

func normalizeCounty(value string) string {
	value = cleanHuman(value)
	key := nameKey(value)
	if strings.HasPrefix(key, "sector ") || strings.HasPrefix(key, "bucuresti sector") {
		return "București"
	}
	return value
}

var schoolCanonicalNames = map[string]string{
	// Canonical forms derived from the Ministry of Education "Rețea școlară 2025-2026"
	// index. Locality suffixes are removed when they are only disambiguating OCR/source
	// noise in this dataset; they are kept where the same school name appears in
	// multiple cities.
	nameKey(`Colegiul National "Octavian Goga"`):                                           `Colegiul Național "Octavian Goga"`,
	nameKey(`Colegiul Național 'Andrei Șaguna' Brașov`):                                    `Colegiul Național "Andrei Șaguna"`,
	nameKey(`Colegiul Național "B. P. Hasdeu" Buzău`):                                      `Colegiul Național "B. P. Hasdeu"`,
	nameKey(`Colegiul Național "Carol I" Craiova`):                                         `Colegiul Național "Carol I"`,
	nameKey(`Colegiul Național "Ecaterina Teodoroiu" Târgu Jiu`):                           `Colegiul Național "Ecaterina Teodoroiu"`,
	nameKey(`Colegiul Național "Emanuil Gojdu" Oradea`):                                    `Colegiul Național "Emanuil Gojdu"`,
	nameKey(`Colegiul Național "Emil Racoviță" Cluj-Napoca`):                               `Colegiul Național "Emil Racoviță"`,
	nameKey(`Colegiul Național ''Emil Racoviță''`):                                         `Colegiul Național "Emil Racoviță"`,
	nameKey(`Colegiul Național "Ferdinand I" Bacău`):                                       `Colegiul Național "Ferdinand I"`,
	nameKey(`Colegiul Național "George Barițiu" Cluj-Napoca`):                              `Colegiul Național "George Barițiu"`,
	nameKey(`Colegiul Național "George Coșbuc" Năsăud`):                                    `Colegiul Național "George Coșbuc"`,
	nameKey(`Colegiul Național "Gheorghe Vrănceanu" Bacău`):                                `Colegiul Național "Gheorghe Vrănceanu"`,
	nameKey(`Colegiul Național "Gheorghe Șincai" Baia Mare`):                               `Colegiul Național "Gheorghe Șincai"`,
	nameKey(`Colegiul Național "Iancu de Hunedoara" Hunedoara`):                            `Colegiul Național "Iancu de Hunedoara"`,
	nameKey(`Colegiul Național "Ienăchiță Văcărescu" Târgoviște`):                          `Colegiul Național "Ienăchiță Văcărescu"`,
	nameKey(`Colegiul Național "Ion C. Brătianu" Pitești`):                                 `Colegiul Național "Ion C. Brătianu"`,
	nameKey(`Colegiul Național Decebal Deva`):                                              `Colegiul Național Decebal, Deva`,
	nameKey(`Colegiul Național Pedagogic "Regina Maria" Deva`):                             `Colegiul Național Pedagogic "Regina Maria", Deva`,
	nameKey(`Colegiul Național 'Radu Negru' Făgăraș`):                                      `Colegiul Național "Radu Negru", Făgăraș`,
	nameKey(`Colegiul Național 'Mircea Cel Bătrân' Constanța`):                             `Colegiul Național "Mircea cel Bătrân", Constanța`,
	nameKey(`Colegiul Național "Mircea Cel Bătrân", Municipiul Râmnicu Vâlcea`):            `Colegiul Național "Mircea cel Bătrân", Râmnicu Vâlcea`,
	nameKey(`Colegiul Național "Octavian Goga" Sibiu`):                                     `Colegiul Național "Octavian Goga"`,
	nameKey(`Colegiul Național "Petru Rareș" Suceava`):                                     `Colegiul Național "Petru Rareș"`,
	nameKey(`Colegiul Național "Radu Greceanu" Slatina`):                                   `Colegiul Național "Radu Greceanu"`,
	nameKey(`Colegiul Național "Samuel Von Brukenthal" Sibiu`):                             `Colegiul Național "Samuel von Brukenthal"`,
	nameKey(`Colegiul Național "Spiru Haret", Municipiul Tecuci`):                          `Colegiul Național "Spiru Haret", Tecuci`,
	nameKey(`Colegiul Național "Traian Lalescu" Reșița`):                                   `Colegiul Național "Traian Lalescu"`,
	nameKey(`Colegiul Național "Tudor Vladimirescu" Târgu Jiu`):                            `Colegiul Național "Tudor Vladimirescu"`,
	nameKey(`Colegiul Național "Unirea" Focșani`):                                          `Colegiul Național "Unirea", Focșani`,
	nameKey(`Colegiul Național "Unirea" Târgu Mureș`):                                      `Colegiul Național "Unirea", Târgu Mureș`,
	nameKey(`Colegiul Național "Unirea" Turnu Măgurele`):                                   `Colegiul Național "Unirea", Turnu Măgurele`,
	nameKey(`Colegiul Național "Vasile Alecsandri" Bacău`):                                 `Colegiul Național "Vasile Alecsandri", Bacău`,
	nameKey(`Colegiul Național "Vasile Alecsandri", Galați`):                               `Colegiul Național "Vasile Alecsandri"`,
	nameKey(`Colegiul Național "Vasile Alecsandri", Municipiul Galați`):                    `Colegiul Național "Vasile Alecsandri"`,
	nameKey(`Colegiul Național "Vasile Lucaciu" Baia Mare`):                                `Colegiul Național "Vasile Lucaciu"`,
	nameKey(`Colegiul Național "Ștefan Cel Mare" Suceava`):                                 `Colegiul Național "Ștefan cel Mare"`,
	nameKey(`Colegiul Național de Informatică "Matei Basarab" Râmnicu Vâlcea`):             `Colegiul Național de Informatică "Matei Basarab"`,
	nameKey(`Colegiul Național De Informatică "Matei Basarab", Municipiul Râmnicu Vâlcea`): `Colegiul Național de Informatică "Matei Basarab"`,
	nameKey(`Colegiul Național de Informatică 'Gr. Moisil' Brașov`):                        `Colegiul Național de Informatică "Grigore Moisil"`,
	nameKey(`Colegiul Național De Informatică, Municipiul Piatra-Neamț`):                   `Colegiul Național de Informatică, Piatra-Neamț`,
	nameKey(`Colegiul Național "Dr. Ioan Mesota"`):                                         `Colegiul Național "Dr. Ioan Meșotă"`,
	nameKey(`Colegiul Național 'Dr. Ioan Meșotă' Brașov`):                                  `Colegiul Național "Dr. Ioan Meșotă"`,
	nameKey(`Liceul "Horea, Cloșca Și Crișan" Abrud`):                                      `Liceul "Horea, Cloșca și Crișan"`,
	nameKey(`Liceul "Regina Maria" Dorohoi`):                                               `Liceul "Regina Maria", Dorohoi`,
	nameKey(`Liceul Bilingv "Olga Gudynn" Voluntari`):                                      `Liceul Bilingv "Olga Gudynn"`,
	nameKey(`Liceul Teoretic "Avram Iancu" Cluj-Napoca`):                                   `Liceul Teoretic "Avram Iancu", Cluj-Napoca`,
	nameKey(`Liceul Teoretic "Emil Racoviță", Vaslui`):                                     `Liceul Teoretic "Emil Racoviță"`,
	nameKey(`Liceul Teoretic "Mihail Kogălniceanu", Municipiul Vaslui`):                    `Liceul Teoretic "Mihail Kogălniceanu"`,
	nameKey(`Liceul Teoretic "Mihail Kogălniceanu", Vaslui`):                               `Liceul Teoretic "Mihail Kogălniceanu"`,
	nameKey(`Liceul Teoretic "Miron Costin", Iași`):                                        `Liceul Teoretic "Miron Costin"`,
	nameKey(`Liceul Teoretic "Nikolaus Lenau" Timișoara`):                                  `Liceul Teoretic "Nikolaus Lenau"`,
	nameKey(`Liceul Teoretic "Petru Rareș" Târgu Lăpuș`):                                   `Liceul Teoretic "Petru Rareș"`,
	nameKey(`Liceul Teoretic "Tudor Arghezi" Craiova`):                                     `Liceul Teoretic "Tudor Arghezi"`,
	nameKey(`ICHB`): `Liceul Teoretic Internațional de Informatică`,
	nameKey(`Liceul Teoretic Internațional de Informatică București`): `Liceul Teoretic Internațional de Informatică`,
	nameKey(`Liceul Teoretic Internațional de Informatică Constanța`): `Liceul Teoretic Internațional de Informatică, Constanța`,

	nameKey(`Colegiul Național de Informatică "Tudor Vianu" București`):    `Colegiul Național de Informatică "Tudor Vianu"`,
	nameKey(`Colegul Național de Informatică "Tudor Vianu"`):               `Colegiul Național de Informatică "Tudor Vianu"`,
	nameKey(`Colegul Național de Informatică “Tudor Vianu”`):               `Colegiul Național de Informatică "Tudor Vianu"`,
	nameKey(`Colegiul Național "Silvania" Zalău`):                          `Colegiul Național "Silvania"`,
	nameKey(`Liceul Teoretic "Mihai Eminescu" Călărași`):                   `Liceul Teoretic "Mihai Eminescu"`,
	nameKey(`Colegiul Național "Constantin Diaconovici Loga" Timișoara`):   `Colegiul Național "Constantin Diaconovici Loga"`,
	nameKey(`Liceul Teoretic "Grigore Moisil" Timișoara`):                  `Liceul Teoretic "Grigore Moisil"`,
	nameKey(`Colegiul Național "Barbu Știrbei" Călărași`):                  `Colegiul Național "Barbu Știrbei"`,
	nameKey(`Colegiul Național "Mihai Eminescu" Constanța`):                `Colegiul Național "Mihai Eminescu", Constanța`,
	nameKey(`Colegiul Național 'Mihai Eminescu' Constanța`):                `Colegiul Național "Mihai Eminescu", Constanța`,
	nameKey(`Colegiul Național "I.L. Caragiale" București`):                `Colegiul Național "I. L. Caragiale"`,
	nameKey(`Colegiul Național Horea, Cloșca și Crișan`):                   `Colegiul Național "Horea, Cloșca și Crișan"`,
	nameKey(`Liceul de Informatică "Tiberiu Popoviciu" Cluj-Napoca`):       `Liceul de Informatică "Tiberiu Popoviciu"`,
	nameKey(`Liceul De Informatică "Tiberiu Popoviciu" Cluj-Napoca`):       `Liceul de Informatică "Tiberiu Popoviciu"`,
	nameKey(`Liceul de Informatica "Tiberiu Popoviciu"`):                   `Liceul de Informatică "Tiberiu Popoviciu"`,
	nameKey(`Colegiul Național "Ion Luca Caragiale", Municipiul Ploiești`): `Colegiul Național "Ion Luca Caragiale", Ploiești`,
	nameKey(`Colegiul Național "Mihai Viteazul", Municipiul Ploiești`):     `Colegiul Național "Mihai Viteazul", Ploiești`,
	nameKey(`C.N. "Mihai Viteazul" Ploiești`):                              `Colegiul Național "Mihai Viteazul", Ploiești`,
	nameKey(`CNILC PLOIEȘTI`):                                              `Colegiul Național "Ion Luca Caragiale", Ploiești`,
	nameKey(`CNPRSV`):                                                      `Colegiul Național "Petru Rareș"`,
	nameKey(`Colegiu Național "Mihai Viteazul"`):                           `Colegiul Național "Mihai Viteazul", Ploiești`,
	nameKey(`Colegiul National Mihai Viteazul” Ploiesti PH`):               `Colegiul Național "Mihai Viteazul", Ploiești`,
	nameKey(`Colegiul National "Vasile Alecsandri" Iasi`):                  `Colegiul Național "Vasile Alecsandri", Iași`,
	nameKey(`C.N. "B.P. Hasdeu"`):                                          `Colegiul Național "B. P. Hasdeu"`,
	nameKey(`Colegiul National Grigore Moisil`):                            `Colegiul Național "Grigore Moisil"`,
	nameKey(`Colegiul Național "Mihai Eminescu" Oradea`):                   `Colegiul Național "Mihai Eminescu", Oradea`,
}

var schoolCanonicalNamesByCounty = map[string]string{
	schoolCountyKey(`Colegiul Național "Ion Luca Caragiale"`, "Prahova"):       `Colegiul Național "Ion Luca Caragiale", Ploiești`,
	schoolCountyKey(`Colegiul Național "Mihai Viteazul"`, "Prahova"):           `Colegiul Național "Mihai Viteazul", Ploiești`,
	schoolCountyKey(`Colegiul Național "Unirea"`, "Vrancea"):                   `Colegiul Național "Unirea", Focșani`,
	schoolCountyKey(`Colegiul Național "Unirea"`, "Teleorman"):                 `Colegiul Național "Unirea", Turnu Măgurele`,
	schoolCountyKey(`Colegiul Național "Unirea"`, "Mureș"):                     `Colegiul Național "Unirea", Târgu Mureș`,
	schoolCountyKey(`Colegiul National Mircea cel Batran`, "Constanța"):        `Colegiul Național "Mircea cel Bătrân", Constanța`,
	schoolCountyKey(`Colegiul National Mircea cel Batran`, "Vâlcea"):           `Colegiul Național "Mircea cel Bătrân", Râmnicu Vâlcea`,
	schoolCountyKey(`Colegiul Național "Mihai Eminescu"`, "Constanța"):         `Colegiul Național "Mihai Eminescu", Constanța`,
	schoolCountyKey(`Colegiul Național "Mihai Eminescu"`, "Satu Mare"):         `Colegiul Național "Mihai Eminescu", Satu Mare`,
	schoolCountyKey(`Colegiul Național "Mihai Eminescu"`, "Bihor"):             `Colegiul Național "Mihai Eminescu", Oradea`,
	schoolCountyKey(`Colegiul Național "Decebal"`, "Hunedoara"):                `Colegiul Național Decebal, Deva`,
	schoolCountyKey(`Colegiul Național Decebal`, "Hunedoara"):                  `Colegiul Național Decebal, Deva`,
	schoolCountyKey(`Colegiul Național de Informatică`, "Neamț"):               `Colegiul Național de Informatică, Piatra-Neamț`,
	schoolCountyKey(`Colegiul Național Pedagogic "Regina Maria"`, "Hunedoara"): `Colegiul Național Pedagogic "Regina Maria", Deva`,
	schoolCountyKey(`Liceul "Regina Maria"`, "Botoșani"):                       `Liceul "Regina Maria", Dorohoi`,
	schoolCountyKey(`Liceul teoretic "Avram Iancu"`, "Cluj"):                   `Liceul Teoretic "Avram Iancu", Cluj-Napoca`,
	schoolCountyKey(`Liceul teoretic "Avram Iancu"`, "Hunedoara"):              `Liceul Teoretic "Avram Iancu", Brad`,
	schoolCountyKey(`Liceul Teoretic "Avram Iancu"`, "Cluj"):                   `Liceul Teoretic "Avram Iancu", Cluj-Napoca`,
	schoolCountyKey(`Liceul Teoretic "Avram Iancu"`, "Hunedoara"):              `Liceul Teoretic "Avram Iancu", Brad`,
}

func schoolCountyKey(school string, county string) string {
	return nameKey(normalizeCounty(county)) + "\t" + nameKey(school)
}

func canonicalSchoolNameForCounty(name string, county string) string {
	name = cleanHuman(name)
	if isCountyName(name) {
		return ""
	}
	if canonical, ok := schoolCanonicalNamesByCounty[schoolCountyKey(name, county)]; ok {
		return canonical
	}
	return canonicalSchoolName(name)
}

func canonicalSchoolName(name string) string {
	name = cleanHuman(name)
	if isCountyName(name) {
		return ""
	}
	if canonical, ok := schoolCanonicalNames[nameKey(name)]; ok {
		return canonical
	}
	return name
}

var countyNameKeys = map[string]bool{
	nameKey("Alba"): true, nameKey("Arad"): true, nameKey("Argeș"): true, nameKey("Bacău"): true,
	nameKey("Bihor"): true, nameKey("Bistrița-Năsăud"): true, nameKey("Botoșani"): true, nameKey("Brașov"): true,
	nameKey("Brăila"): true, nameKey("București"): true, nameKey("Buzău"): true, nameKey("Caraș-Severin"): true,
	nameKey("Călărași"): true, nameKey("Cluj"): true, nameKey("Constanța"): true, nameKey("Covasna"): true,
	nameKey("Dâmbovița"): true, nameKey("Dolj"): true, nameKey("Galați"): true, nameKey("Giurgiu"): true,
	nameKey("Gorj"): true, nameKey("Harghita"): true, nameKey("Hunedoara"): true, nameKey("Ialomița"): true,
	nameKey("Iași"): true, nameKey("Ilfov"): true, nameKey("Maramureș"): true, nameKey("Mehedinți"): true,
	nameKey("Mureș"): true, nameKey("Neamț"): true, nameKey("Olt"): true, nameKey("Prahova"): true,
	nameKey("Satu Mare"): true, nameKey("Sălaj"): true, nameKey("Sibiu"): true, nameKey("Suceava"): true,
	nameKey("Teleorman"): true, nameKey("Timiș"): true, nameKey("Tulcea"): true, nameKey("Vaslui"): true,
	nameKey("Vâlcea"): true, nameKey("Vrancea"): true,
}

func isCountyName(name string) bool {
	return countyNameKeys[nameKey(name)]
}

func cleanHuman(value string) string {
	value = strings.TrimSpace(value)
	value = strings.NewReplacer(
		"“", "\"",
		"”", "\"",
		"„", "\"",
		"ˮ", "\"",
		"''", "\"",
		"’", "'",
		"‘", "'",
		"–", "-",
		"—", "-",
		"Ţ", "Ț",
		"ţ", "ț",
		"Ş", "Ș",
		"ş", "ș",
	).Replace(value)
	value = strings.Join(strings.Fields(value), " ")
	if isMostlyUpper(value) {
		value = titleCase(value)
	}
	return value
}

func isMostlyUpper(value string) bool {
	letters := 0
	uppers := 0
	for _, r := range value {
		if unicode.IsLetter(r) {
			letters++
			if unicode.IsUpper(r) {
				uppers++
			}
		}
	}
	return letters >= 8 && float64(uppers)/float64(letters) > 0.7
}

func titleCase(value string) string {
	runes := []rune(strings.ToLower(value))
	nextUpper := true
	for i, r := range runes {
		if unicode.IsLetter(r) {
			if nextUpper {
				runes[i] = unicode.ToUpper(r)
				nextUpper = false
			}
			continue
		}
		nextUpper = r == ' ' || r == '"' || r == '\'' || r == '-' || r == '„'
	}
	return string(runes)
}

func isAnonymousName(name string) bool {
	return strings.HasPrefix(nameKey(name), "participant ")
}

func nameKey(value string) string {
	value = foldAccents(cleanHuman(value))
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

func slug(value string) string {
	key := nameKey(value)
	key = strings.ReplaceAll(key, " ", "-")
	if key == "" {
		return "unknown"
	}
	return key
}

func foldAccents(value string) string {
	replacer := strings.NewReplacer(
		"ă", "a", "Ă", "A",
		"â", "a", "Â", "A",
		"î", "i", "Î", "I",
		"ș", "s", "Ș", "S",
		"ş", "s", "Ş", "S",
		"ț", "t", "Ț", "T",
		"ţ", "t", "Ţ", "T",
	)
	return replacer.Replace(value)
}

func tokenList(values ...string) []string {
	set := map[string]bool{}
	for _, value := range values {
		for _, token := range strings.Fields(nameKey(value)) {
			set[token] = true
		}
	}
	tokens := make([]string, 0, len(set))
	for token := range set {
		tokens = append(tokens, token)
	}
	sort.Strings(tokens)
	return tokens
}

func addUnique(list []string, value string) []string {
	if value == "" || contains(list, value) {
		return list
	}
	return append(list, value)
}

func addUniqueInt(list []int, value int) []int {
	for _, item := range list {
		if item == value {
			return list
		}
	}
	return append(list, value)
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}

func mapValues[T any](m map[string]*T) []*T {
	values := make([]*T, 0, len(m))
	for _, value := range m {
		values = append(values, value)
	}
	return values
}

func collectYears(results []Result) []int {
	set := map[int]bool{}
	for _, result := range results {
		set[result.Year] = true
	}
	years := make([]int, 0, len(set))
	for year := range set {
		years = append(years, year)
	}
	sort.Ints(years)
	return years
}

func collectCircuits(results []Result) []string {
	set := map[string]bool{}
	for _, result := range results {
		if result.Circuit != "" {
			set[result.Circuit] = true
		}
	}
	circuits := make([]string, 0, len(set))
	for circuit := range set {
		circuits = append(circuits, circuit)
	}
	sort.Strings(circuits)
	return circuits
}

func countNamed(results []Result) int {
	count := 0
	for _, result := range results {
		if !result.Anonymous && result.PersonID != "" {
			count++
		}
	}
	return count
}

func countAnonymous(results []Result) int {
	count := 0
	for _, result := range results {
		if result.Anonymous || isAnonymousName(result.PersonName) {
			count++
		}
	}
	return count
}

func validateDataset(dataset *Dataset) error {
	if dataset.Summary.People == 0 {
		return errors.New("dataset has no people")
	}
	if dataset.Summary.Contests == 0 {
		return errors.New("dataset has no contests")
	}
	return nil
}
