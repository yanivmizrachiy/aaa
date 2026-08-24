# חוברת משפט פיתגורס

חוברת עבודה דיגיטלית בגאומטריה (כיתה ז׳) — **53 דפי A4** בעברית (RTL), עם נוסחאות MathJax מקומיות.
אתר סטטי נטו, **ללא שלב build**, שנפרס אוטומטית ל-Vercel.

**Production:** https://aaa-pythagoras.vercel.app/

---

## מקור האמת היחיד

[`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md) הוא **מקור האמת היחיד והעליון לכל דרישות הפרויקט** — תוכן, פדגוגיה, ניסוח, עיצוב, מבנה, סדר דפים, טכנולוגיה, בדיקות ופרסום.

- [`WORKBOOK_MANIFEST.json`](WORKBOOK_MANIFEST.json) הוא רישום runtime מכונה לסדר, לזהות ולמספור הדפים, והוא כפוף ל־`SOURCE_OF_TRUTH.md`.
- [`DESIGN.md`](DESIGN.md) הוא מדריך יישום מפורט לעיצוב ופדגוגיה, והוא כפוף ל־`SOURCE_OF_TRUTH.md`.
- אם יש סתירה בין קובץ אחר לבין `SOURCE_OF_TRUTH.md` — `SOURCE_OF_TRUTH.md` גובר.
- כל דף הוא `עמוד-<מספר-מקור>.html` עם `<main class="a4-page">` יחיד.
- [`pythagoras-workbook.js`](pythagoras-workbook.js) קורא את המניפסט, מחלץ מכל דף את ה-`main`, טוען את ה-CSS הייעודי שלו ומרכיב חוברת אחת.
- מספר הדפים בפועל מנוהל במניפסט בהתאם לכללי מקור האמת.
- [`index.html`](index.html) היא נקודת הכניסה היחידה.

---

## מבנה הריפו

```
SOURCE_OF_TRUTH.md              מקור האמת היחיד לכל דרישות הפרויקט
index.html                      נקודת כניסה — מעטפת החוברת
pythagoras-workbook.js          ה-loader: מרכיב את הדפים מהמניפסט
WORKBOOK_MANIFEST.json          רישום runtime: סדר, זהות ומספור דפים
עמוד-<N>.html                   דפי מקור (כל אחד עצמאי + נטען בחוברת)
styles/
  a4-base.css                   בסיס A4 משותף לכל הדפים
  pythagoras-workbook.css       מעטפת החוברת (טולבר, ניווט, גלילה) — לא נוגעת בתוכן דפים
  topics/*.css                  סגנון לפי נושא, עטוף @layer topic (ה-CSS של דף תמיד גובר)
  pages/עמוד-<N>.css            CSS ייעודי לכל דף (תחום ל-.page-N)
vendor/                         MathJax + גופן Rubik (מקומיים, ללא CDN)
tools/
  validate.js                   בדיקת תקינות — השער היחיד
  dev-server.js                 שרת תצוגה מקדימה מקומי
vercel.json                     פרוקסי ל-branch release ב-GitHub
DESIGN.md                       מדריך יישום עיצוב ופדגוגיה, כפוף למקור האמת
```

---

## עבודה מקומית

דרוש **Node.js 18+**. אין תלויות — אין `npm install`.

```bash
npm run dev        # שרת מקומי → http://localhost:8080
npm run validate   # בדיקת תקינות מלאה
```

> החוברת מרכיבה את עצמה עם `fetch()`, ולכן חייבים לפתוח אותה דרך שרת (http) — פתיחת `index.html`
> כ-`file://` לא תעבוד. לכן `npm run dev`.

---

## עריכות נפוצות

**לפני כל שינוי מהותי**
קראו תחילה את [`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md). אם דרישה חדשה סותרת כלל קיים, יש לפתור את הסתירה מול המשתמש לפני שממשיכים.

**לשנות דף קיים**
ערכו את `עמוד-<N>.html` ו/או `styles/pages/עמוד-<N>.css`, הריצו `npm run dev` וצפו.
ה-CSS של דף חייב להיות **תחום ל-`.page-<N>`** (הוולידטור אוכף זאת כדי למנוע דליפת סגנון בין דפים).

**להוסיף / להסיר דף**
1. עדכנו תחילה את הכלל/החלטה ב־`SOURCE_OF_TRUTH.md` אם מדובר בשינוי דרישה או מבנה.
2. צרו/מחקו את `עמוד-<N>.html` ואת `styles/pages/עמוד-<N>.css`.
3. הוסיפו/הסירו את הרשומה במערך `pages` שב-`WORKBOOK_MANIFEST.json`.
4. עדכנו את `totalPages` שיהיה שווה למספר הדפים בפועל.

`workbookNumber` (המספור בחוברת) נקבע לפי המיקום במערך המניפסט.

**לשנות סדר**
עדכנו את החלטת הסדר ב־`SOURCE_OF_TRUTH.md` אם זה שינוי דרישה, ואז סדרו מחדש את מערך `pages` במניפסט.

**לפני push:** הריצו `npm run validate` — הוא בודק שהמניפסט, כל דף, ה-CSS והמעטפת עקביים.

---

## פרסום

```
עריכה → push ל-main → GitHub Actions מריץ tools/validate.js
        ├─ עבר   → main מקודם אוטומטית ל-release → Vercel מגיש למשתמש
        └─ נכשל  → release נשאר על הגרסה התקינה האחרונה; המשתמש לא נחשף לשבר
```

Production (Vercel, דרך [`vercel.json`](vercel.json)) קורא **רק** מענף `release`.
ענף `main` הוא ענף עבודה.

---

## עקרונות עיצוב

הסמכות העליונה היא [`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md).
[`DESIGN.md`](DESIGN.md) מפרט את דרך היישום: Exact A4 Preview, ניצול דף חכם, פתרון אנכי ושאר עקרונות הפדגוגיה והפריסה — כל עוד הם אינם סותרים את מקור האמת.
