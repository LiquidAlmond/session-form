# Session Link Helper

A small static page that fills in the shared parts of a therapy session
(date, start/end time, session type) once, then generates a separate
pre-filled link to a Google Form for each student in that session — so only
the student name has to be entered per form.

It's generic: anyone can use it by connecting their own Google Form, as long
as that form has the same seven questions in the same order (see below).
No account, server, or build step is required — everything is a static file
plus the browser's local storage.

## Connecting your Google Form

Open **⚙ Settings → Form connection**. Your form needs these questions, in
this exact order:

1. Therapy Date
2. Start Time
3. End Time
4. Duration in Minutes
5. Session Type
6. Number in Session
7. Student Name

Then:

1. Fill your form out once with sample answers.
2. Click the form's **⋮ menu → Get pre-filled link**.
3. Copy the resulting URL and paste it into the "Pre-filled link" box in
   Settings, then click **Parse link**.
4. Check the preview table — it shows which question each detected field
   was matched to, plus the sample value from your link, so you can confirm
   the order lines up. If the count doesn't match, the form is likely
   missing a question or has them in the wrong order.
5. Click **Save connection**. Use **Send test link** afterward to confirm a
   generated link actually opens your real form correctly.

The connection (base form URL + field IDs) is stored in the browser's local
storage alongside your roster and session types — nothing is hardcoded in
the source anymore.

## Using the page

1. Fill in the session date, start/end time, and session type (duration and
   the "number in session" count are calculated automatically).
2. Check off which students were in this session.
3. Click **Generate links**, then click each "Open form: <name>" link — it
   opens that student's pre-filled form in a new tab. Opened links turn
   green so you can track which ones are done.

## Managing roster, session types, and backups

Everything else lives under **⚙ Settings**:

- **Roster** — add, remove, and reorder students.
- **Session types** — add, remove, and reorder the options shown in the
  session type dropdown.
- **Backup & restore** — since roster, session types, and your form
  connection only live in this browser's local storage, use **Export
  settings** to download a JSON backup (e.g. before switching devices or
  clearing browser data), and **Import settings** to restore one. The page
  tracks when you last changed vs. last exported settings and shows a
  reminder banner on the main page when there are un-exported changes.

## Hosting on GitHub Pages

1. Push this repo to GitHub.
2. In the repo settings, go to **Pages**, set the source to the `main`
   branch, root folder.
3. GitHub will give you a URL like `https://<user>.github.io/<repo>/` —
   bookmark that for daily use.

No build step is required; it's plain HTML/CSS/JS.
