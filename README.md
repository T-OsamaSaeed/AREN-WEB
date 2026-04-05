# Alran Academy Website

## 1. Where to paste the Apps Script URL
Open [src/services/api.js](src/services/api.js) and replace the `API_BASE_URL` value if your Google Apps Script URL changes.

## 2. Where the logo is used
The landing-page wordmark is stored at [public/alran-wordmark.svg](public/alran-wordmark.svg).
The website and PWA icons are stored at [public/favicon.svg](public/favicon.svg), [public/favicon.png](public/favicon.png), [public/pwa-192.png](public/pwa-192.png), [public/pwa-512.png](public/pwa-512.png), and [public/apple-touch-icon.png](public/apple-touch-icon.png).

## 3. How to run locally
```bash
npm install
npm run dev
```

## 4. How to build
```bash
npm run build
```
The production files will be created in the `dist` folder.

## 5. How to deploy website to GitHub Pages
1. Push this project to a GitHub repository.
2. Run `npm run build`.
3. Create a branch named `gh-pages`.
4. Copy the contents of the `dist` folder into that `gh-pages` branch.
5. In GitHub, open `Settings -> Pages`, choose `Deploy from a branch`, then select the `gh-pages` branch and the root folder.
