# SHOWCASE

Screenshots of three key screens (Today, Subjects, Tasks) belong here, captured
at 1440×900 against a clean dataset.

**Deferred** in this session: capturing them headlessly requires Playwright
+ a Chromium download (~150 MB), which I didn't want to install without
checking. Two ways to fill this folder:

1. Run the dev server and screenshot in your browser:

   ```bash
   npm run dev
   # → open http://localhost:5173
   # → screenshot Today, Subjects, Tasks
   # → save into this folder as 01-today.png, 02-subjects.png, 03-tasks.png
   ```

2. Or tell me to install Playwright and I'll capture them myself.

The dev server boots in ~210 ms and `npm run build` produces a clean dist
(see PROGRESS.md for bundle sizes).
