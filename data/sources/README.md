# Source Archive

This directory stores local copies of every URL listed in the generated
`provenance` array. These files preserve the original contest sources if the
upstream websites move or remove them.

- `manifest.json` records the original URL, final URL, content type, byte
  count, SHA-256 hash, archive timestamp, and local file path for each source.
- `files/` contains one archived file per provenance source ID. Some sources
  with many concrete pages, such as public profile pages, also have a
  source-specific subdirectory with the individual archived files. Profile-page
  HTML is gzip-compressed to keep the archive small.

Refresh the archive from the current generated provenance list with:

```sh
node scripts/archive-sources.mjs
```
