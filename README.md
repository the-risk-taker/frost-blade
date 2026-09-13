# Mroźne Ostrze

Pixelartowa gra zręcznościowa w three.js.

## Instalacja

```bash
npm install
```

## Wersja dev

Serwer z automatycznym przeładowaniem na http://localhost:5173:

```bash
npm run dev
```

## Wersja prod

Build do katalogu `dist`, `npm run preview` pozwala go sprawdzić lokalnie:

```bash
npm run build
npm run preview
```

## Deploy na Cloudflare

Buduje grę i wrzuca ją na https://game.therisktaker.pl (wymaga `wrangler login`):

```bash
npm run deploy
```
