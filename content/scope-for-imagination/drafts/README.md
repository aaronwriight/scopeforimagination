# Entry 0002: life update

Edit `0002-life-update.html`, replacing or removing every bracketed prompt. The section headings are only scaffolding; keep whichever ones help.

Publish it with:

```sh
pnpm sfi:new \
  --doc="content/scope-for-imagination/drafts/0002-life-update.html" \
  --title="scope for imagination" \
  --subtitle="life lately" \
  --tags="life update" \
  --location="Cambridge, MA" \
  --entry=0002
```

Then validate and preview it:

```sh
pnpm sfi:check --entry=0002
```

For future entries with a music tagline, pass the song metadata when creating the draft:

```sh
pnpm sfi:draft \
  --subtitle="Post subtitle" \
  --music-title="Song title" \
  --music-artist="Artist" \
  --music-url="https://example.com/song"
```

The URL is optional, but the title and artist must be provided together. The draft command includes the same flags in the `sfi:new` command it prints.
