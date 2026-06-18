package generator

import "roaihof/pkg/appdata"

const (
	sourceONIANational = "onia-national-2026"
	sourceONIALot      = "onia-lot-largit-2026"
	sourceROAI2026     = "roai-2026"
)

const oniaLotParticipantCount = 30
const mlcompeteScoreTolerance = 0.05

type Dataset = appdata.Dataset
type Summary = appdata.Summary
type Source = appdata.Source
type SourceStatus = appdata.SourceStatus
type Stats = appdata.Stats
type Person = appdata.Person
type ExternalUsernames = appdata.ExternalUsernames
type School = appdata.School
type County = appdata.County
type Contest = appdata.Contest
type Result = appdata.Result
type Rankings = appdata.Rankings
type RankingRow = appdata.RankingRow
type SearchItem = appdata.SearchItem
type SearchUsername = appdata.SearchUsername
