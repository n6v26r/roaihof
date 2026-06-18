# ROAIHOF

>[!NOTE]
> this site was mostly vibecoded. don't look to much into it besides functionality and data.

Romanian AI Hall Of Fame

This is a mostly static site, made with React.
All data is generated with Go from the entries extracted from official sources.

## Commands

```bash
npm install
npm run data:generate
npm run dev -- --port 5173
npm run test
npm run build
npm run build:with-data
```

## Data Pipeline

- Raw official ONIA JSON files live in `data/raw/onia/`.
- Manual provenance-preserving supplements live in `data/manual/`.
- `cmd/roaihof-data` normalizes names, schools, counties, contests, and results.
- Generated app data is written to `src/generated/app-data.json` and `public/data/app.json`.

The current dataset includes:

- ONIA 2026 national rankings + Lot IOAI+CEOAI
- ROAI 2026 national finals and Lot IAIO/CEOAI rankings
- ROAI 2025 national rankings and Lot IOAI/IAIO rankings
- 2024-2025 international results from the official ONIA Hall of Fame
- Official IOAI 2024 team scoreboard ranks/scores and IOAI 2025 individual scoreboard ranks/scores

Result rows track `score`, `scoreMax`, `place`, `prize`, `medal`, and international `qualification`. Rankings are sorted by medal table, prizes, best place, selections, and international results by filter.

## TODO:

Mabye an elo system thingy?

## Deployment

vercel stuff go brrr

## License

This sofware provided under [The Unlicense](https://unlicense.org). If for whatever reason you prefer a different license, consider it under Zero Clause BSD.
