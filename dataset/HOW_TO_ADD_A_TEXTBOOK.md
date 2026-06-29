# How to Add a Textbook to Martha

> 🟢 **For teachers & subject experts. No coding, no JSON.** If you can scan a
> page and save a file, you can do this. Plan ~10 minutes per chapter.

When you add a textbook, Martha can *use* its content to answer questions for that
exact subject and class — grounded in the real book, not guessed. You give her
**plain text**; the app does the rest.

---

## The idea in one line

> **Get the words off the page → save them as a `.txt` file in the right folder → tell the team.**

That's it. Everything below is just detail.

---

## Step 1 — Turn the book pages into text

You need the **words** from the page as text you can copy. Pick whichever tool you
already know — they all work:

| If you have… | Do this |
| --- | --- |
| **A phone** | Use **Microsoft Office Lens** or **Google Drive** (free apps): photograph the page → it reads the text → share/export as text. |
| **A scanned PDF on your computer** | Upload it to **Google Drive** → right-click → **Open with Google Docs**. It converts the pages to editable text automatically. |
| **Adobe Acrobat** | Use **Scan & OCR** → export the text. |
| **A page with lots of maths/equations** | Use **Mathpix** — it reads formulas far better than ordinary scanners. |

> 💡 **OCR ("reading text from an image") is never perfect.** Quickly read through
> the result and fix obvious mistakes — a wrong letter here, a stray symbol there.
> Your subject knowledge is exactly what makes this content trustworthy.

Things to remove while you tidy up: page numbers, headers/footers, and picture
captions that make no sense on their own. Martha reads words, not diagrams — so if
a point depends on a picture, write a short sentence describing it instead.

## Step 2 — Save it as a `.txt` file with a clear name

Save the cleaned text as a **plain text file** (`.txt`). Name it after the **topic**,
in lowercase, using underscores instead of spaces:

```
living_and_non_living_things.txt
the_water_cycle.txt
simple_interest.txt
```

For a **past-questions** paper, end the name with `_past_questions`:

```
waec_bece_past_questions.txt
```

## Step 3 — Put it in the correct folder

Folders are organised **subject → level → class**. Drop your file into the folder
that matches the book:

```
dataset/nigerian/<subject>/<phase>/<class>/your_file.txt
```

- **`<subject>`** — `mathematics`, `english`, `basic_science`, (and for SS:
  `physics`, `chemistry`, `biology`, `economics`)
- **`<phase>`** — `primary`, `jss`, or `ss`
- **`<class>`** — `primary1`…`primary6`, `jss1`…`jss3`, `ss1`…`ss3`

**Example:** a JSS1 Basic Science chapter on living things goes in
`dataset/nigerian/basic_science/jss/jss1/living_and_non_living_things.txt`

> Putting it in the right class folder is what keeps Martha **level-accurate** — a
> JSS1 file is only ever used for JSS1, never mixed into SS3.

## Step 4 — Hand it over

Save, then let the team know (commit & push if you use Git, or send the file to
whoever manages the repo). The developer runs one command that loads every new
`.txt` into Martha's knowledge base — and from then on she can use your textbook.

---

## Two important notes

- **📚 Copyright.** Only add material you're allowed to use: your **own school's
  notes**, the **official NERDC syllabus**, **past questions**, or books you have
  rights to. Don't add a commercial textbook's text without permission.
- **✍️ Quality beats quantity.** One clean, correct chapter helps Martha more than
  ten messy ones. A quick read-through after scanning is the most valuable step.

---

## Prefer to do it all on the computer? (optional, for the technical helper)

If many pages need scanning at once, there's a helper that OCRs a whole PDF and
files the text for you. From the project folder:

```bash
python rag/ingest_textbook.py --input ~/scans/basic_science_jss1_ch3.pdf \
    --curriculum nigerian --subject basic_science --class-level jss1 \
    --topic "living and non-living things"
```

It writes the same `.txt` artifact into the right folder (review it, then it gets
ingested). Setup for that route is in [`../rag/requirements-ocr.txt`](../rag/requirements-ocr.txt).
You never *need* this — Steps 1–4 above work with tools you already have.

---

*Questions about the folder layout or what counts as a good example? See
[`README.md`](README.md) in this same folder.*
