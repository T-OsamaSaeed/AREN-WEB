# Aren Academy Website

## 1. Where to paste the Apps Script URL
Open [src/services/api.js](C:\Users\Asus\Downloads\Aren web\src\services\api.js) and replace the `API_BASE_URL` value if your Google Apps Script URL changes.

## 2. Where the logo is used
The uploaded logo is stored at [src/assets/academy-logo.jpeg](C:\Users\Asus\Downloads\Aren web\src\assets\academy-logo.jpeg) and is shown on the landing page and in the teacher dashboard header.

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
