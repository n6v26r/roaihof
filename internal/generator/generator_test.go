package generator

import "testing"

func TestBuildDatasetCountsOfficialRows(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	if dataset.Summary.Results != 570 {
		t.Fatalf("results = %d, want 570 after ONIA and ROAI 2025 recovery", dataset.Summary.Results)
	}
	if dataset.Summary.NamedResults != 570 {
		t.Fatalf("named results = %d, want 570 after ONIA and ROAI 2025 recovery", dataset.Summary.NamedResults)
	}
	if dataset.Summary.AnonymousResults != 0 {
		t.Fatalf("anonymous results = %d, want 0 after ONIA and ROAI 2025 recovery", dataset.Summary.AnonymousResults)
	}
	if dataset.Summary.People != 255 {
		t.Fatalf("people = %d, want 255 after ONIA and ROAI 2025 recovery", dataset.Summary.People)
	}
	if dataset.Summary.Schools != 102 {
		t.Fatalf("schools = %d, want 102 after school canonicalization", dataset.Summary.Schools)
	}
	if dataset.Summary.Counties != 37 {
		t.Fatalf("counties = %d, want 37", dataset.Summary.Counties)
	}
	if len(dataset.Contests) != 18 {
		t.Fatalf("contests = %d, want 18", len(dataset.Contests))
	}
	if dataset.Summary.Years[0] != 2024 || dataset.Summary.LatestYear != 2026 {
		t.Fatalf("years = %v latest = %d", dataset.Summary.Years, dataset.Summary.LatestYear)
	}
}

func TestONIANationalRecoveryImportsAnonymousRows(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	cases := []struct {
		personID string
		username string
		grade    string
		place    int
		score    float64
		schoolID string
		countyID string
	}{
		{"hanganu-rares", "raresh30", "9", 10, 34.61, "school-colegiul-national-de-informatica-tudor-vianu", "bucuresti"},
		{"draghici-ana-veronica", "dana27", "9", 11, 27.58, "school-liceul-teoretic-international-de-informatica", "bucuresti"},
		{"plocon-andrei-ionut", "Nad3x", "10", 28, 33.63, "school-colegiul-national-unirea-turnu-magurele", "teleorman"},
		{"tambozi-cezar-justin", "cezaricabasarica", "10", 31, 32.17, "school-liceul-teoretic-international-de-informatica", "bucuresti"},
		{"boabes-cristina-ioana", "bcristina", "10", 52, 0, "school-colegiul-national-de-informatica-tudor-vianu", "bucuresti"},
		{"albus-denis-florin", "albusalbita", "10", 47, 7.68, "school-colegiul-national-ecaterina-teodoroiu", "gorj"},
		{"tomita-mircea-stefan", "tomita-mircea-stefan", "11", 38, 27.45, "school-colegiul-national-stefan-cel-mare", "suceava"},
		{"chivu-calin-matei", "MCC_16", "11", 32, 38.03, "school-liceul-bilingv-olga-gudynn", "ilfov"},
		{"sanda-marius-gabriel", "gabi", "11", 42, 5.34, "school-colegiul-national-ecaterina-teodoroiu", "gorj"},
	}
	for _, tc := range cases {
		person := findPerson(dataset, tc.personID)
		if person == nil {
			t.Fatalf("missing recovered person %s", tc.personID)
		}
		if tc.username != "" && (person.ExternalUsernames == nil || !contains(person.ExternalUsernames.MLCompete, tc.username)) {
			t.Fatalf("%s MLCompete usernames = %v, want %q", person.Name, person.ExternalUsernames, tc.username)
		}
		var found Result
		for _, result := range dataset.Results {
			if result.ContestID == "onia-2026-nationala" && result.PersonID == tc.personID {
				found = result
				break
			}
		}
		if found.ContestID == "" {
			t.Fatalf("missing recovered ONIA national result for %s", tc.personID)
		}
		if found.Anonymous {
			t.Fatalf("%s is still anonymous", tc.personID)
		}
		if found.Grade != tc.grade || found.Place != tc.place || found.Score != tc.score || found.SchoolID != tc.schoolID || found.CountyID != tc.countyID {
			t.Fatalf("%s ONIA national = grade %s place %d score %.2f school %s county %s, want grade %s place %d score %.2f school %s county %s",
				tc.personID, found.Grade, found.Place, found.Score, found.SchoolID, found.CountyID, tc.grade, tc.place, tc.score, tc.schoolID, tc.countyID)
		}
	}
}

func TestONIANationalAbsentRowsAreExcluded(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	for _, result := range dataset.Results {
		if result.ContestID != "onia-2026-nationala" {
			continue
		}
		if result.Anonymous {
			t.Fatalf("ONIA national result is still anonymous: %#v", result)
		}
		if result.Grade == "12" && result.Place >= 41 {
			t.Fatalf("ONIA national absent row was imported: %#v", result)
		}
		if isAnonymousName(result.PersonName) {
			t.Fatalf("ONIA national placeholder name was imported: %#v", result)
		}
	}

	zeroScoreRows := map[string]int{
		"boabes-cristina-ioana": 52,
		"vetrila-andrei":        38,
	}
	for personID, place := range zeroScoreRows {
		var found Result
		for _, result := range dataset.Results {
			if result.ContestID == "onia-2026-nationala" && result.PersonID == personID {
				found = result
				break
			}
		}
		if found.ContestID == "" {
			t.Fatalf("missing zero-score ONIA national result for %s", personID)
		}
		if found.Place != place || found.Score != 0 {
			t.Fatalf("%s ONIA zero-score result = place %d score %.2f, want place %d score 0", personID, found.Place, found.Score, place)
		}
	}
}

func TestONIANationalGuestsAreTracked(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	guestIDs := map[string]struct {
		username string
		score    float64
		schoolID string
		countyID string
	}{
		"boac-mihai-cosmin":          {username: "Cosminane", score: 112.64, schoolID: "school-liceul-teoretic-international-de-informatica", countyID: "bucuresti"},
		"boca-petru":                 {username: "petru_boca", score: 109.30, schoolID: "school-liceul-teoretic-international-de-informatica", countyID: "bucuresti"},
		"calin-tudor-ioan":           {username: "Sobolansky", score: 88.30, schoolID: "school-liceul-teoretic-international-de-informatica", countyID: "bucuresti"},
		"chelaru-ioan-cristian":      {username: "iccjoc", score: 35.84, schoolID: "school-liceul-teoretic-international-de-informatica", countyID: "bucuresti"},
		"predesel-mathias-alexandru": {username: "andreiminunat", score: 18.18, schoolID: "school-liceul-teoretic-tudor-arghezi", countyID: "dolj"},
	}
	seen := map[string]bool{}
	for _, result := range dataset.Results {
		if result.ContestID != "onia-2026-nationala" || result.Grade != "8" {
			continue
		}
		want, ok := guestIDs[result.PersonID]
		if !ok {
			t.Fatalf("unexpected grade 8 ONIA national guest: %#v", result)
		}
		seen[result.PersonID] = true
		if result.Status != "guest" || result.Place != 0 || result.Score != want.score || result.Medal != "" || result.Prize != "" {
			t.Fatalf("%s guest status/place/score/medal/prize = %q/%d/%.2f/%q/%q, want guest, empty place/medal/prize, and score %.2f",
				result.PersonID, result.Status, result.Place, result.Score, result.Medal, result.Prize, want.score)
		}
		if result.SourceID != sourceONIANationalGuests || result.SchoolID != want.schoolID || result.CountyID != want.countyID {
			t.Fatalf("%s guest source/school/county = %q/%q/%q, want %q/%q/%q",
				result.PersonID, result.SourceID, result.SchoolID, result.CountyID, sourceONIANationalGuests, want.schoolID, want.countyID)
		}
	}
	if len(seen) != len(guestIDs) {
		t.Fatalf("ONIA national guests = %v, want %d tracked guests", seen, len(guestIDs))
	}
	for personID, want := range guestIDs {
		person := findPerson(dataset, personID)
		if person == nil {
			t.Fatalf("missing ONIA national guest profile %s", personID)
		}
		if !contains(person.SchoolIDs, want.schoolID) || !contains(person.CountyIDs, want.countyID) {
			t.Fatalf("%s school/county ids = %v/%v, want %s/%s", personID, person.SchoolIDs, person.CountyIDs, want.schoolID, want.countyID)
		}
		if person.ExternalUsernames == nil || !contains(person.ExternalUsernames.MLCompete, want.username) {
			t.Fatalf("%s MLCompete usernames = %v, want %q", personID, person.ExternalUsernames, want.username)
		}
		if !contains(person.Stats.Circuits, "ONIA") || person.Stats.NationalParticipations == 0 {
			t.Fatalf("%s stats = %#v, want ONIA national guest participation", personID, person.Stats)
		}
	}
}

func TestTop12AliasesMergeIntoCanonicalPeople(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	person := findPerson(dataset, "dedu-razvan-matei")
	if person == nil {
		t.Fatal("missing Dedu Răzvan-Matei")
	}
	if person.Name != "Dedu Răzvan-Matei" {
		t.Fatalf("name = %q", person.Name)
	}
	if person.Stats.Participations != 3 {
		t.Fatalf("participations = %d, want national-only 3", person.Stats.Participations)
	}
	if person.Stats.CEOAISelections != 1 {
		t.Fatalf("CEOAI selections = %d, want 1", person.Stats.CEOAISelections)
	}

	ilie := findPerson(dataset, "ilie-goga-radu")
	if ilie == nil {
		t.Fatal("missing Ilie-Goga Radu")
	}
	if ilie.Stats.Selections != 3 || ilie.Stats.LotParticipations != 3 {
		t.Fatalf("Ilie-Goga selections/lot = %d/%d, want distinct Lot events 3/3", ilie.Stats.Selections, ilie.Stats.LotParticipations)
	}
	if ilie.Stats.CEOAISelections != 2 {
		t.Fatalf("Ilie-Goga CEOAI selections = %d, want 2 qualification rows", ilie.Stats.CEOAISelections)
	}
	if ilie.Stats.BestPlace != 1 {
		t.Fatalf("Ilie-Goga best place = %d, want ROAI 2025 class placement 1", ilie.Stats.BestPlace)
	}

	thury := findPerson(dataset, "thury-burileanu-alexandru")
	if thury == nil {
		t.Fatal("missing Thury Burileanu Alexandru")
	}
	if thury.Stats.IOAISelections != 1 {
		t.Fatalf("IOAI selections = %d, want 1", thury.Stats.IOAISelections)
	}
	if thury.Stats.BestPlace != 11 {
		t.Fatalf("best place = %d, want national-only 11", thury.Stats.BestPlace)
	}
}

func TestSchoolSuffixVariantsMergeIntoCanonicalSchools(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	expected := map[string]string{
		"school-colegiul-national-de-informatica-tudor-vianu":       `Colegiul Național de Informatică "Tudor Vianu"`,
		"school-liceul-teoretic-mihai-eminescu":                     `Liceul Teoretic "Mihai Eminescu"`,
		"school-colegiul-national-silvania":                         `Colegiul Național "Silvania"`,
		"school-colegiul-national-andrei-saguna":                    `Colegiul Național "Andrei Șaguna"`,
		"school-colegiul-national-emanuil-gojdu":                    `Colegiul Național "Emanuil Gojdu"`,
		"school-colegiul-national-emil-racovita":                    `Colegiul Național "Emil Racoviță"`,
		"school-colegiul-national-de-informatica-matei-basarab":     `Colegiul Național de Informatică "Matei Basarab"`,
		"school-colegiul-national-vasile-alecsandri":                `Colegiul Național "Vasile Alecsandri"`,
		"school-liceul-teoretic-international-de-informatica":       `Liceul Teoretic Internațional de Informatică`,
		"school-colegiul-national-petru-rares":                      `Colegiul Național "Petru Rareș"`,
		"school-colegiul-national-mihai-viteazul-ploiesti":          `Colegiul Național "Mihai Viteazul", Ploiești`,
		"school-colegiul-national-ion-luca-caragiale-ploiesti":      `Colegiul Național "Ion Luca Caragiale", Ploiești`,
		"school-colegiul-national-unirea-focsani":                   `Colegiul Național "Unirea", Focșani`,
		"school-colegiul-national-unirea-turnu-magurele":            `Colegiul Național "Unirea", Turnu Măgurele`,
		"school-colegiul-national-unirea-targu-mures":               `Colegiul Național "Unirea", Târgu Mureș`,
		"school-colegiul-national-mircea-cel-batran-constanta":      `Colegiul Național "Mircea cel Bătrân", Constanța`,
		"school-colegiul-national-mircea-cel-batran-ramnicu-valcea": `Colegiul Național "Mircea cel Bătrân", Râmnicu Vâlcea`,
		"school-colegiul-national-mihai-eminescu-constanta":         `Colegiul Național "Mihai Eminescu", Constanța`,
		"school-colegiul-national-mihai-eminescu-satu-mare":         `Colegiul Național "Mihai Eminescu", Satu Mare`,
		"school-liceul-teoretic-avram-iancu-cluj-napoca":            `Liceul Teoretic "Avram Iancu", Cluj-Napoca`,
		"school-liceul-teoretic-avram-iancu-brad":                   `Liceul Teoretic "Avram Iancu", Brad`,
		"school-colegiul-national-b-p-hasdeu":                       `Colegiul Național "B. P. Hasdeu"`,
		"school-liceul-regina-maria-dorohoi":                        `Liceul "Regina Maria", Dorohoi`,
		"school-colegiul-national-de-informatica-piatra-neamt":      `Colegiul Național de Informatică, Piatra-Neamț`,
		"school-colegiul-national-pedagogic-regina-maria-deva":      `Colegiul Național Pedagogic "Regina Maria", Deva`,
		"school-colegiul-national-decebal-deva":                     `Colegiul Național Decebal, Deva`,
	}
	for id, name := range expected {
		school := findSchool(dataset, id)
		if school == nil {
			t.Fatalf("missing canonical school %s", id)
		}
		if school.Name != name {
			t.Fatalf("%s name = %q, want %q", id, school.Name, name)
		}
	}
	staleIDs := []string{
		"school-colegiul-national-de-informatica-tudor-vianu-bucuresti",
		"school-liceul-teoretic-mihai-eminescu-calarasi",
		"school-colegiul-national-silvania-zalau",
		"school-colegiul-national-andrei-saguna-brasov",
		"school-colegiul-national-emanuil-gojdu-oradea",
		"school-colegiul-national-emil-racovita-cluj-napoca",
		"school-colegiul-national-de-informatica-matei-basarab-ramnicu-valcea",
		"school-colegiul-national-vasile-alecsandri-galati",
		"school-liceul-teoretic-international-de-informatica-bucuresti",
		"school-ichb",
		"school-teleorman",
		"school-colegul-national-de-informatica-tudor-vianu",
		"school-cnilc-ploiesti",
		"school-cnprsv",
		"school-colegiu-national-mihai-viteazul",
		"school-colegiul-national-mihai-viteazul-ploiesti-ph",
		"school-c-n-mihai-viteazul-ploiesti",
		"school-c-n-b-p-hasdeu",
		"school-colegiul-national-ion-luca-caragiale",
		"school-liceul-regina-maria",
		"school-colegiul-national-de-informatica",
		"school-colegiul-national-pedagogic-regina-maria",
		"school-colegiul-national-decebal",
		"school-colegiul-national-unirea",
		"school-colegiul-national-mircea-cel-batran",
		"school-colegiul-national-mihai-eminescu",
		"school-liceul-teoretic-avram-iancu",
	}
	for _, id := range staleIDs {
		if findSchool(dataset, id) != nil {
			t.Fatalf("found stale suffixed school id %s", id)
		}
	}
}

func TestGeneratedNamesAndSchoolsHaveNoDuplicates(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	seenPeople := map[string]string{}
	for _, person := range dataset.People {
		key := nameKey(person.Name)
		if previous := seenPeople[key]; previous != "" {
			t.Fatalf("duplicate normalized person name %q: %s and %s", key, previous, person.ID)
		}
		seenPeople[key] = person.ID
	}
	seenSchools := map[string]string{}
	for _, school := range dataset.Schools {
		key := nameKey(school.Name)
		if previous := seenSchools[key]; previous != "" {
			t.Fatalf("duplicate normalized school name %q: %s and %s", key, previous, school.ID)
		}
		seenSchools[key] = school.ID
	}
	seenCounties := map[string]string{}
	for _, county := range dataset.Counties {
		key := nameKey(county.Name)
		if previous := seenCounties[key]; previous != "" {
			t.Fatalf("duplicate normalized county name %q: %s and %s", key, previous, county.ID)
		}
		seenCounties[key] = county.ID
	}

	resultCountiesBySchool := map[string]map[string]bool{}
	for _, result := range dataset.Results {
		if result.SchoolID == "" || result.CountyID == "" {
			continue
		}
		if resultCountiesBySchool[result.SchoolID] == nil {
			resultCountiesBySchool[result.SchoolID] = map[string]bool{}
		}
		resultCountiesBySchool[result.SchoolID][result.CountyID] = true
	}
	for schoolID, countyIDs := range resultCountiesBySchool {
		if len(countyIDs) > 1 {
			t.Fatalf("school %s has results in multiple counties: %v", schoolID, countyIDs)
		}
	}
}

func TestMissingFirstNameVariantsMergeIntoLongerPeople(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	expected := map[string]struct {
		name           string
		alias          string
		participations int
	}{
		"anea-rares-florin":      {name: "Anea Rareș-Florin", alias: "Anea Rareș", participations: 3},
		"blidar-george-lucian":   {name: "Blidar George-Lucian", alias: "Blidar Lucian", participations: 3},
		"curca-david-ioan":       {name: "Curcă David-Ioan", alias: "Curca David", participations: 3},
		"drugan-ion-andrei":      {name: "Drugan Ion-Andrei", alias: "Drugan Andrei", participations: 2},
		"gasparel-marian-stefan": {name: "Gășpărel Marian-Ștefan", alias: "Gasparel Marian", participations: 3},
		"tudose-dragos-razvan":   {name: "Tudose Dragoș Razvan", alias: "Tudose Dragoș", participations: 2},
		"calin-tudor-ioan":       {name: "Calin Tudor-Ioan", alias: "Calin Tudor Ioan", participations: 2},
		"chelaru-ioan-cristian":  {name: "Chelaru Ioan-Cristian", alias: "Chelaru Ioan Cristian", participations: 2},
		"negut-vlad-mihai":       {name: "Neguț Vlad-Mihai", alias: "Negut Vlad", participations: 1},
	}
	for id, want := range expected {
		person := findPerson(dataset, id)
		if person == nil {
			t.Fatalf("missing canonical person %s", id)
		}
		if person.Name != want.name {
			t.Fatalf("%s name = %q, want %q", id, person.Name, want.name)
		}
		if !contains(person.Aliases, want.alias) {
			t.Fatalf("%s aliases = %v, want %q", id, person.Aliases, want.alias)
		}
		if person.Stats.Participations != want.participations {
			t.Fatalf("%s participations = %d, want %d", id, person.Stats.Participations, want.participations)
		}
	}
	staleIDs := []string{
		"anea-rares",
		"blidar-lucian",
		"curca-david",
		"drugan-andrei",
		"gasparel-marian",
		"tudose-dragos",
		"negut-vlad",
	}
	for _, id := range staleIDs {
		if findPerson(dataset, id) != nil {
			t.Fatalf("found stale shorter person id %s", id)
		}
	}
}

func TestROAI2026Imported(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	national := findContest(dataset, "roai-2026-national-ix-x")
	if national == nil {
		t.Fatal("missing ROAI 2026 IX-X contest")
	}
	if national.Stage != "national" || national.ResultsCount != 59 {
		t.Fatalf("national stage/count = %s/%d", national.Stage, national.ResultsCount)
	}
	iaioLot := findContest(dataset, "roai-2026-lot-iaio")
	if iaioLot == nil {
		t.Fatal("missing ROAI 2026 Lot IAIO contest")
	}
	if iaioLot.Stage != "lot" || iaioLot.ResultsCount != 24 {
		t.Fatalf("iaio lot stage/count = %s/%d", iaioLot.Stage, iaioLot.ResultsCount)
	}
	ceoaiLot := findContest(dataset, "roai-2026-lot-ceoai")
	if ceoaiLot == nil {
		t.Fatal("missing ROAI 2026 Lot CEOAI contest")
	}
	if ceoaiLot.Stage != "lot" || ceoaiLot.ResultsCount != 24 {
		t.Fatalf("ceoai lot stage/count = %s/%d", ceoaiLot.Stage, ceoaiLot.ResultsCount)
	}
	person := findPerson(dataset, "stoica-mihnea-teodor")
	if person == nil {
		t.Fatal("missing Stoica Mihnea-Teodor")
	}
	if person.Stats.BestPlace != 1 {
		t.Fatalf("best place = %d, want 1", person.Stats.BestPlace)
	}
}

func TestLotRowsAreTeamSelectionOnly(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	if findContest(dataset, "onia-2026-lot-selection") != nil {
		t.Fatal("found stale ONIA Lot selection contest id")
	}
	if findContest(dataset, "roai-2026-lot") != nil {
		t.Fatal("found stale ROAI qualified-to-Lot contest")
	}
	person := findPerson(dataset, "dedu-razvan-matei")
	if person == nil {
		t.Fatal("missing Dedu Răzvan-Matei")
	}
	var oniaLot Result
	var roaiIAIO Result
	for _, result := range dataset.Results {
		if result.PersonID != person.ID {
			continue
		}
		switch result.ContestID {
		case "onia-2026-lot":
			oniaLot = result
		case "roai-2026-lot-iaio":
			roaiIAIO = result
		}
	}
	if oniaLot.Qualification != "CEOAI" || oniaLot.Place != 10 {
		t.Fatalf("ONIA Lot = %q/%d, want CEOAI/10", oniaLot.Qualification, oniaLot.Place)
	}
	if roaiIAIO.Qualification != "IAIO" || roaiIAIO.Place != 4 {
		t.Fatalf("ROAI IAIO Lot = %q/%d, want IAIO/4", roaiIAIO.Qualification, roaiIAIO.Place)
	}
}

func TestONIALotImportsCountedPlatformScoreboard(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	contest := findContest(dataset, "onia-2026-lot")
	if contest == nil {
		t.Fatal("missing ONIA 2026 Lot")
	}
	if contest.ResultsCount != 29 {
		t.Fatalf("ONIA Lot rows = %d, want 29", contest.ResultsCount)
	}
	qualified := 0
	results := map[string]Result{}
	for _, result := range dataset.Results {
		if result.ContestID != "onia-2026-lot" {
			continue
		}
		if result.Anonymous {
			t.Fatalf("ONIA Lot result is still anonymous: %#v", result)
		}
		if result.Qualification != "" {
			qualified++
		}
		if result.PersonID == "" || result.SchoolID == "" || result.CountyID == "" {
			t.Fatalf("ONIA Lot result missing identity: %#v", result)
		}
		if result.SourceID != sourceONIALotScoreboard {
			t.Fatalf("%s source = %q, want %q", result.PersonName, result.SourceID, sourceONIALotScoreboard)
		}
		results[result.PersonID] = result
	}
	if qualified != 12 {
		t.Fatalf("ONIA Lot qualified = %d, want 12", qualified)
	}
	if _, ok := results["neculau-rares-andrei"]; ok {
		t.Fatal("Neculau Rareș-Andrei was absent from Lot rounds and should not be counted")
	}
	if _, ok := results["boca-petru"]; ok {
		t.Fatal("special non-Lot participant Boca Petru should not be counted")
	}

	expected := map[string]struct {
		place         int
		score         float64
		qualification string
	}{
		"petrean-roland":           {place: 1, score: 335.11, qualification: "IOAI"},
		"dobre-darius-adrian":      {place: 3, score: 278.54, qualification: "IOAI"},
		"bence-muk-daniel-antoniu": {place: 8, score: 189.80, qualification: "IOAI"},
		"gheorghica-istrate-david": {place: 9, score: 187.50, qualification: "CEOAI"},
		"ilie-goga-radu":           {place: 12, score: 176.19, qualification: "CEOAI"},
		"ciortea-suciu-andrei":     {place: 13, score: 171.51},
		"rapa-balan-tudor-florin":  {place: 29, score: 71.38},
	}
	for personID, want := range expected {
		result, ok := results[personID]
		if !ok {
			t.Fatalf("missing ONIA Lot result for %s", personID)
		}
		if result.Place != want.place || result.Score != want.score || result.Qualification != want.qualification {
			t.Fatalf("%s ONIA Lot = place %d score %.2f qualification %q, want place %d score %.2f qualification %q",
				personID, result.Place, result.Score, result.Qualification, want.place, want.score, want.qualification)
		}
	}
}

func TestLotRowsUseSameYearExtractedSchoolIdentity(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	person := findPerson(dataset, "morariu-tudor")
	if person == nil {
		t.Fatal("missing Morariu Tudor")
	}
	lotRows := 0
	for _, result := range dataset.Results {
		if result.PersonID != person.ID || result.Year != 2026 || result.Circuit != "ROAI" || result.Stage != "lot" {
			continue
		}
		lotRows++
		if result.SchoolID != "school-liceul-teoretic-international-de-informatica" || result.CountyID != "bucuresti" {
			t.Fatalf("Morariu 2026 ROAI Lot assigned to %s/%s, want ICHB/București", result.SchoolID, result.CountyID)
		}
	}
	if lotRows == 0 {
		t.Fatal("missing Morariu 2026 ROAI Lot rows")
	}
	for _, result := range dataset.Results {
		if result.PersonID == person.ID && result.Year == 2026 && result.SchoolID == "school-colegiul-national-emil-racovita" {
			t.Fatalf("Morariu 2026 result still assigned to old school: %s", result.ContestID)
		}
	}
}

func TestROAI2025LotImported(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	ioai := findContest(dataset, "roai-2025-lot-ioai")
	if ioai == nil {
		t.Fatal("missing ROAI 2025 Lot IOAI contest")
	}
	if ioai.Stage != "lot" || ioai.ResultsCount != 29 {
		t.Fatalf("ioai stage/count = %s/%d", ioai.Stage, ioai.ResultsCount)
	}
	petrean := findPerson(dataset, "petrean-roland")
	if petrean == nil {
		t.Fatal("missing Petrean Roland")
	}
	if petrean.Stats.IOAISelections < 1 {
		t.Fatalf("IOAI selections = %d, want at least 1", petrean.Stats.IOAISelections)
	}
}

func TestIAIO2026OfficialResultsImported(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	contest := findContest(dataset, "iaio-2026")
	if contest == nil {
		t.Fatal("missing IAIO 2026 contest")
	}
	if contest.Stage != "international" || contest.ResultsCount != 4 {
		t.Fatalf("contest stage/count = %s/%d, want international/4", contest.Stage, contest.ResultsCount)
	}

	expected := map[string]struct {
		place int
		score float64
		medal string
	}{
		"tache-david-stefan":         {place: 18, score: 80.59844209, medal: "silver"},
		"stanciu-rares-stefan":       {place: 30, score: 70.40810821, medal: "bronze"},
		"ardelean-alexandru-dumitru": {place: 38, score: 67.45131865, medal: "bronze"},
		"lensu-alexandru":            {place: 57, score: 53.87782342},
	}
	for personID, want := range expected {
		var found Result
		for _, result := range dataset.Results {
			if result.ContestID == "iaio-2026" && result.PersonID == personID {
				found = result
				break
			}
		}
		if found.ContestID == "" {
			t.Fatalf("missing IAIO 2026 result for %s", personID)
		}
		if found.Place != want.place || found.Score != want.score || found.ScoreMax != 100 || found.Medal != want.medal {
			t.Fatalf("%s IAIO 2026 = place %d score %v/%v medal %q, want place %d score %v/100 medal %q", personID, found.Place, found.Score, found.ScoreMax, found.Medal, want.place, want.score, want.medal)
		}
	}
}

func TestIAIO2024OfficialResultsImported(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	contest := findContest(dataset, "iaio-2024")
	if contest == nil {
		t.Fatal("missing IAIO 2024 contest")
	}
	if contest.OfficialURL != "https://iaio-official.org/results/" || contest.ResultsCount != 4 {
		t.Fatalf("IAIO 2024 source/count = %q/%d, want official URL/4", contest.OfficialURL, contest.ResultsCount)
	}

	expected := map[string]struct {
		place int
		score float64
		medal string
	}{
		"letu-andrei":            {place: 3, score: 60.9326, medal: "gold"},
		"musat-tudor-stefan":     {place: 13, score: 42.0475, medal: "silver"},
		"miron-alexandru-bogdan": {place: 37, score: 19, medal: "bronze"},
		"morariu-tudor":          {place: 45, score: 14, medal: "honorable"},
	}
	for personID, want := range expected {
		var found Result
		for _, result := range dataset.Results {
			if result.ContestID == "iaio-2024" && result.PersonID == personID {
				found = result
				break
			}
		}
		if found.ContestID == "" {
			t.Fatalf("missing IAIO 2024 result for %s", personID)
		}
		if found.Place != want.place || found.Score != want.score || found.ScoreMax != 100 || found.Medal != want.medal || found.SourceID != "iaio-2024-official-results" {
			t.Fatalf("%s IAIO 2024 = place %d score %v/%v medal %q source %q, want place %d score %v/100 medal %q official source",
				personID, found.Place, found.Score, found.ScoreMax, found.Medal, found.SourceID, want.place, want.score, want.medal)
		}
	}
}

func TestEntityStatsIgnoreInternationalRepresentations(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	tache := findPerson(dataset, "tache-david-stefan")
	if tache == nil {
		t.Fatal("missing Tache David-Ștefan")
	}
	if tache.Stats.Participations != 3 || tache.Stats.NationalParticipations != 3 || tache.Stats.InternationalParticipations != 0 {
		t.Fatalf("Tache participations/national/international = %d/%d/%d, want 3/3/0", tache.Stats.Participations, tache.Stats.NationalParticipations, tache.Stats.InternationalParticipations)
	}
	if tache.Stats.Gold != 1 || tache.Stats.Silver != 2 || tache.Stats.Bronze != 0 {
		t.Fatalf("Tache medals = %d/%d/%d, want national-only 1/2/0", tache.Stats.Gold, tache.Stats.Silver, tache.Stats.Bronze)
	}
	if tache.Stats.IAIOSelections != 2 {
		t.Fatalf("Tache IAIO selections = %d, want Lot-only 2", tache.Stats.IAIOSelections)
	}
	for _, circuit := range tache.Stats.Circuits {
		if circuit == "IAIO" || circuit == "IOAI" || circuit == "CEOAI" {
			t.Fatalf("entity stats include international circuit %q", circuit)
		}
	}

	var iaio Result
	for _, result := range dataset.Results {
		if result.PersonID == tache.ID && result.ContestID == "iaio-2026" {
			iaio = result
			break
		}
	}
	if iaio.Medal != "silver" {
		t.Fatalf("IAIO result medal = %q, want result row to keep silver", iaio.Medal)
	}

	musat := findPerson(dataset, "musat-tudor-stefan")
	if musat == nil {
		t.Fatal("missing Mușat Tudor-Ștefan")
	}
	if musat.Stats.Gold != 0 || musat.Stats.Silver != 1 {
		t.Fatalf("Mușat medals = %d/%d, want international gold excluded and national silver kept", musat.Stats.Gold, musat.Stats.Silver)
	}
}

func TestGeneratedDefaultRankingsUseInternationalCriterionAfterMergedCriteria(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	petreanIndex := rankingIndex(dataset.Rankings.People, "petrean-roland")
	ilieIndex := rankingIndex(dataset.Rankings.People, "ilie-goga-radu")
	if petreanIndex < 0 || ilieIndex < 0 {
		t.Fatalf("missing Petrean/Ilie in generated people rankings: %d/%d", petreanIndex, ilieIndex)
	}
	if petreanIndex > ilieIndex {
		t.Fatalf("Petrean ranking index = %d, Ilie-Goga index = %d, want Petrean first by international ranking criterion", petreanIndex, ilieIndex)
	}
	petrean := findPerson(dataset, "petrean-roland")
	if petrean == nil {
		t.Fatal("missing Petrean Roland")
	}
	if petrean.Stats.InternationalParticipations != 0 {
		t.Fatalf("Petrean entity international participations = %d, want entity stats to remain Romanian-only", petrean.Stats.InternationalParticipations)
	}
}

func TestRankingComparatorsUseRequestedCriterionOrder(t *testing.T) {
	betterNationalPlace := Stats{Gold: 1, BestPlace: 1}
	morePrizes := Stats{Gold: 1, Prizes: 1, BestPlace: 2}
	moreSelections := Stats{Gold: 1, BestPlace: 2, Selections: 99}
	if compareNationalRankingStats(morePrizes, betterNationalPlace) <= 0 {
		t.Fatal("national ranking did not prefer prizes after medals and before best place")
	}
	if compareMergedRankingStats(morePrizes, betterNationalPlace, Stats{}, Stats{}) <= 0 {
		t.Fatal("merged ranking did not prefer prizes after medals and before best place")
	}
	if compareMergedRankingStats(betterNationalPlace, moreSelections, Stats{}, Stats{}) <= 0 {
		t.Fatal("merged ranking did not prefer national best place before selections")
	}
	if compareNationalRankingStats(moreSelections, Stats{Gold: 1, BestPlace: 2}) != 0 {
		t.Fatal("national ranking should ignore selections after medals, prizes, and best place are tied")
	}
	if compareSelectionRankingStats(Stats{Selections: 2}, Stats{Selections: 1}) <= 0 {
		t.Fatal("lot ranking did not prefer higher selection count")
	}

	internationalGold := Stats{Gold: 1, BestPlace: 50, InternationalParticipations: 1}
	internationalSilver := Stats{Silver: 1, BestPlace: 1, InternationalParticipations: 10}
	if compareInternationalRankingStats(internationalGold, internationalSilver) <= 0 {
		t.Fatal("international ranking did not prefer gold before silver")
	}
	internationalPrize := Stats{Bronze: 1, Prizes: 1, BestPlace: 3, InternationalParticipations: 1}
	betterInternationalPlace := Stats{Bronze: 1, BestPlace: 2, InternationalParticipations: 1}
	if compareInternationalRankingStats(internationalPrize, betterInternationalPlace) <= 0 {
		t.Fatal("international ranking did not prefer prizes after medals and before best place")
	}
	moreInternationalParticipations := Stats{Bronze: 1, BestPlace: 3, InternationalParticipations: 10}
	if compareInternationalRankingStats(betterInternationalPlace, moreInternationalParticipations) <= 0 {
		t.Fatal("international ranking did not prefer best place before participations")
	}
	if compareInternationalRankingStats(Stats{BestPlace: 10, InternationalParticipations: 2}, Stats{BestPlace: 10, InternationalParticipations: 1}) <= 0 {
		t.Fatal("international ranking did not use participations after medals and best place")
	}
}

func TestEntityResultCountEqualsNationalParticipations(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	school := findSchool(dataset, "school-liceul-teoretic-mihai-eminescu")
	if school == nil {
		t.Fatal("missing Liceul Teoretic \"Mihai Eminescu\"")
	}
	if school.Stats.Participations != school.Stats.NationalParticipations {
		t.Fatalf("school result count = %d, national participations = %d", school.Stats.Participations, school.Stats.NationalParticipations)
	}
	if school.Stats.Participations != 3 || school.Stats.LotParticipations != 2 || school.Stats.Selections != 2 {
		t.Fatalf("school national/lot/selections = %d/%d/%d, want 3/2/2", school.Stats.Participations, school.Stats.LotParticipations, school.Stats.Selections)
	}
}

func TestROAI2025NationalImportedByClass(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	expectedCounts := map[string]int{
		"roai-2025-national-clasa-7":  1,
		"roai-2025-national-clasa-9":  25,
		"roai-2025-national-clasa-10": 37,
		"roai-2025-national-clasa-11": 49,
		"roai-2025-national-clasa-12": 17,
	}
	for id, count := range expectedCounts {
		contest := findContest(dataset, id)
		if contest == nil {
			t.Fatalf("missing %s", id)
		}
		if contest.Stage != "national" || contest.ResultsCount != count {
			t.Fatalf("%s stage/count = %s/%d, want national/%d", id, contest.Stage, contest.ResultsCount, count)
		}
	}
	recoveredRows := 0
	for _, result := range dataset.Results {
		if result.Year != 2025 || result.Circuit != "ROAI" || result.Stage != "national" {
			continue
		}
		recoveredRows++
		if result.Anonymous {
			t.Fatalf("ROAI 2025 national result is still anonymous: %#v", result)
		}
	}
	if recoveredRows != 129 {
		t.Fatalf("ROAI 2025 national rows = %d, want 129 recovered scored rows", recoveredRows)
	}

	petrean := findPerson(dataset, "petrean-roland")
	if petrean == nil {
		t.Fatal("missing Petrean Roland")
	}
	var national Result
	for _, result := range dataset.Results {
		if result.PersonID == petrean.ID && result.ContestID == "roai-2025-national-clasa-10" {
			national = result
			break
		}
	}
	if national.ContestID == "" {
		t.Fatal("missing Petrean ROAI 2025 national class 10 result")
	}
	if national.Place != 1 || national.Prize != "Premiul I" || national.Medal != "gold" {
		t.Fatalf("Petrean ROAI 2025 national = place %d, prize %q, medal %q", national.Place, national.Prize, national.Medal)
	}
	if national.Score != 199 || national.ScoreMax != 200 {
		t.Fatalf("Petrean ROAI 2025 score = %v/%v, want 199/200", national.Score, national.ScoreMax)
	}

	dedu := findPerson(dataset, "dedu-razvan-matei")
	if dedu == nil {
		t.Fatal("missing Dedu Răzvan-Matei")
	}
	var deduNational Result
	for _, result := range dataset.Results {
		if result.PersonID == dedu.ID && result.ContestID == "roai-2025-national-clasa-9" {
			deduNational = result
			break
		}
	}
	if deduNational.ContestID == "" {
		t.Fatal("missing Dedu ROAI 2025 national class 9 result")
	}
	if deduNational.Place != 39 || deduNational.Score != 81 || deduNational.ScoreMax != 200 {
		t.Fatalf("Dedu ROAI 2025 national = place %d score %v/%v, want place 39 score 81/200", deduNational.Place, deduNational.Score, deduNational.ScoreMax)
	}

	recoveredCases := []struct {
		personID  string
		contestID string
		judge     string
		place     int
		score     float64
		grade     string
		sourceID  string
		status    string
	}{
		{"aldoiu-sebastian-alexandru", "roai-2025-national-clasa-11", "SebastianAlexandru", 104, 34, "11", "roai-2025-national-anonymized-final", ""},
		{"alexandrescu-luca", "roai-2025-national-clasa-11", "Alexandrescu", 78, 59, "11", "roai-2025-national-anonymized-final", ""},
		{"pintilie-sebastian-marian", "roai-2025-national-clasa-12", "Raiku", 59, 71, "12", "roai-2025-national-anonymized-final", ""},
		{"mocanasu-radu", "roai-2025-national-clasa-11", "RaduM", 126, 5, "11", "roai-2025-national-anonymized-final", ""},
		{"marian-yustin", "roai-2025-national-clasa-9", "Yustin", 127, 5, "9", "roai-2025-national-anonymized-final", ""},
		{"tache-david-stefan", "roai-2025-national-clasa-10", "dvdtsb", 4, 104, "10", "roai-2025-final-clasa-10", ""},
		{"stanciu-rares-stefan", "roai-2025-national-clasa-12", "Rareshika", 5, 104, "12", "roai-2025-final-clasa-12", ""},
		{"muntean-matei", "roai-2025-national-clasa-7", "Blinstrike", 107, 14, "7", "roai-2025-national-anonymized-final", "guest"},
	}
	for _, tc := range recoveredCases {
		person := findPerson(dataset, tc.personID)
		if person == nil {
			t.Fatalf("missing recovered ROAI 2025 person %s", tc.personID)
		}
		if person.ExternalUsernames == nil || !contains(person.ExternalUsernames.Judge, tc.judge) {
			t.Fatalf("%s judge usernames = %v, want %q", person.Name, person.ExternalUsernames, tc.judge)
		}
		result := findResult(dataset, tc.personID, tc.contestID)
		if result == nil {
			t.Fatalf("missing recovered ROAI 2025 result for %s", tc.personID)
		}
		if result.Place != tc.place || result.Score != tc.score || result.ScoreMax != 200 || result.Grade != tc.grade || result.SourceID != tc.sourceID || result.Status != tc.status {
			t.Fatalf("%s ROAI 2025 national = place %d score %v/%v grade %s source %q status %q, want place %d score %v/200 grade %s source %q status %q",
				tc.personID, result.Place, result.Score, result.ScoreMax, result.Grade, result.SourceID, result.Status, tc.place, tc.score, tc.grade, tc.sourceID, tc.status)
		}
	}

	guest := findPerson(dataset, "muntean-matei")
	if guest == nil {
		t.Fatal("missing ROAI 2025 grade 7 guest profile")
	}
	if guest.Stats.NationalParticipations != 1 || guest.Stats.BestPlace != 107 {
		t.Fatalf("Muntean Matei stats = %#v, want one national participation and best place 107", guest.Stats)
	}

	absentIDs := []string{
		"luca-bogdan-alexandru",
		"milea-matei",
		"petran-raul-francesco",
		"suciu-cristian-albert",
		"caldarea-ciprian-iulian",
		"nicolae-luca-stefan",
		"tihanov-victor",
		"burac-vlad-alexandru",
		"eminovici-stefan",
		"mosu-david-luca",
		"serban-radu",
	}
	for _, personID := range absentIDs {
		for _, result := range dataset.Results {
			if result.PersonID == personID && result.Year == 2025 && result.Circuit == "ROAI" && result.Stage == "national" {
				t.Fatalf("ROAI 2025 absent row was imported for %s: %#v", personID, result)
			}
		}
	}
}

func TestExternalUsernamesAddedOnlyWhenConfirmed(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	cases := []struct {
		personID  string
		judge     string
		mlcompete string
	}{
		{"dedu-razvan-matei", "razv", "razv"},
		{"petrean-roland", "rolandpetrean", "rolandpetrean"},
		{"stoica-mihnea-teodor", "MihneaStoica", "MihneaTeodorStoica"},
		{"curca-david-ioan", "divad", "divad"},
		{"drugan-ion-andrei", "Andrei_Drugan", "Andrei_Drugan"},
	}
	for _, tc := range cases {
		person := findPerson(dataset, tc.personID)
		if person == nil {
			t.Fatalf("missing %s", tc.personID)
		}
		if person.ExternalUsernames == nil {
			t.Fatalf("%s has no external usernames", person.Name)
		}
		if !contains(person.ExternalUsernames.Judge, tc.judge) {
			t.Fatalf("%s judge usernames = %v, want %q", person.Name, person.ExternalUsernames.Judge, tc.judge)
		}
		if !contains(person.ExternalUsernames.MLCompete, tc.mlcompete) {
			t.Fatalf("%s MLCompete usernames = %v, want %q", person.Name, person.ExternalUsernames.MLCompete, tc.mlcompete)
		}
	}
	scoreMatchedCases := []struct {
		personID  string
		mlcompete string
	}{
		{"nistor-iulian", "Axety"},
		{"neculau-rares-andrei", "nrand"},
		{"nastase-eva", "duckjuice49"},
	}
	for _, tc := range scoreMatchedCases {
		person := findPerson(dataset, tc.personID)
		if person == nil {
			t.Fatalf("missing %s", tc.personID)
		}
		if person.ExternalUsernames == nil || !contains(person.ExternalUsernames.MLCompete, tc.mlcompete) {
			t.Fatalf("%s MLCompete usernames = %v, want score-matched %q", person.Name, person.ExternalUsernames, tc.mlcompete)
		}
	}

	stoicaSearch := findSearchItem(dataset, "person", "stoica-mihnea-teodor")
	if stoicaSearch == nil {
		t.Fatal("missing Stoica Mihnea-Teodor search item")
	}
	if !contains(stoicaSearch.Tokens, "mihneastoica") {
		t.Fatalf("Stoica search tokens = %v, want Judge username token", stoicaSearch.Tokens)
	}
	if !contains(stoicaSearch.Tokens, "mihneateodorstoica") {
		t.Fatalf("Stoica search tokens = %v, want MLCompete username token", stoicaSearch.Tokens)
	}
	if !containsSearchUsername(stoicaSearch.Usernames, "judge", "MihneaStoica") {
		t.Fatalf("Stoica search usernames = %v, want Judge username metadata", stoicaSearch.Usernames)
	}
	if !containsSearchUsername(stoicaSearch.Usernames, "mlcompete", "MihneaTeodorStoica") {
		t.Fatalf("Stoica search usernames = %v, want MLCompete username metadata", stoicaSearch.Usernames)
	}

	dantos := findPerson(dataset, "dantos-lorena")
	if dantos == nil {
		t.Fatal("missing Danțoș Lorena")
	}
	if dantos.ExternalUsernames == nil || !contains(dantos.ExternalUsernames.Judge, "lorenaster") {
		t.Fatalf("Danțoș Lorena judge usernames = %v, want recovered anonymized-final username %q", dantos.ExternalUsernames, "lorenaster")
	}
}

func TestBucharestSectorsRollUp(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	county := findCounty(dataset, "bucuresti")
	if county == nil {
		t.Fatal("missing București county aggregate")
	}
	if county.Name != "București" {
		t.Fatalf("county name = %q", county.Name)
	}
	if county.Stats.UniqueContestants < 20 {
		t.Fatalf("București unique contestants = %d, want at least 20", county.Stats.UniqueContestants)
	}
}

func TestAnonymousRowsDoNotBecomePeople(t *testing.T) {
	dataset, err := BuildDataset("../..")
	if err != nil {
		t.Fatalf("BuildDataset: %v", err)
	}
	for _, person := range dataset.People {
		if isAnonymousName(person.Name) {
			t.Fatalf("anonymous row became person: %s", person.Name)
		}
	}
}

func findPerson(dataset *Dataset, id string) *Person {
	for _, person := range dataset.People {
		if person.ID == id {
			return person
		}
	}
	return nil
}

func findCounty(dataset *Dataset, id string) *County {
	for _, county := range dataset.Counties {
		if county.ID == id {
			return county
		}
	}
	return nil
}

func findSchool(dataset *Dataset, id string) *School {
	for _, school := range dataset.Schools {
		if school.ID == id {
			return school
		}
	}
	return nil
}

func findContest(dataset *Dataset, id string) *Contest {
	for _, contest := range dataset.Contests {
		if contest.ID == id {
			return contest
		}
	}
	return nil
}

func findResult(dataset *Dataset, personID string, contestID string) *Result {
	for i := range dataset.Results {
		if dataset.Results[i].PersonID == personID && dataset.Results[i].ContestID == contestID {
			return &dataset.Results[i]
		}
	}
	return nil
}

func findSearchItem(dataset *Dataset, kind string, id string) *SearchItem {
	for i := range dataset.Search {
		if dataset.Search[i].Kind == kind && dataset.Search[i].ID == id {
			return &dataset.Search[i]
		}
	}
	return nil
}

func rankingIndex(rows []RankingRow, id string) int {
	for index, row := range rows {
		if row.ID == id {
			return index
		}
	}
	return -1
}

func containsSearchUsername(usernames []SearchUsername, platform string, username string) bool {
	for _, item := range usernames {
		if item.Platform == platform && item.Username == username {
			return true
		}
	}
	return false
}
