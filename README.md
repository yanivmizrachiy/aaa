# חוברת משפט פיתגורס

חוברת עבודה דיגיטלית בגאומטריה (כיתה ז׳) — **53 דפי A4** בעברית (RTL), עם נוסחאות MathJax מקומיות.
אתר סטטי נטו, **ללא שלב build**, שנפרס אוטומטית ל-Vercel.

**Production:** https://aaa-pythagoras.vercel.app/

---

## מקור אמת יחיד

[`WORKBOOK_MANIFEST.json`](WORKBOOK_MANIFEST.json) הוא המקור היחיד לסדר, לזהות ולמספור של הדפים.
כל השאר נגזר ממנו:

- כל דף הוא `עמוד-<מספר-מקור>.html` עם `<main class="a4-page">` יחיד.
- [`pythagoras-workbook.js`](pythagoras-workbook.js) (ה-loader) קורא את המניפסט, מחלץ מכל דף את ה-`main`,
  טוען את ה-CSS הייעודי שלו, ומרכיב חוברת גלילה אחת עם ניווט, מד-התקדמות והדפסה.
- מספר הדפים נקבע מהמניפסט בלבד — אין מספר קבוע בקוד.
- [`index.html`](index.html) היא נקודת הכניסה היחידה.

---

## מבנה הריפו

```
index.html                      נקודת כניסה — מעטפת החוברת
pythagoras-workbook.js          ה-loader: מרכיב את הדפים מהמניפסט
WORKBOOK_MANIFEST.json          מקור האמת: סדר וזהות הדפים
עמוד-<N>.html                   דפי מקור (כל אחד עצמאי + נטען בחוברת)
styles/
  a4-base.css                   בסיס A4 משותף לכל הדפים
  pythagoras-workbook.css       מעטפת החוברת (טולבר, ניווט, גלילה)
  workbook-canonical-locks.css  שכבת אכיפה חזותית (נטענת אחרונה)
  topics/*.css                  סגנון לפי נושא (pythagoras, geometry7, …)
  pages/עמוד-<N>.css            CSS ייעודי לכל דף (תחום ל-.page-N)
vendor/                         MathJax + גופן Rubik (מקומיים, ללא CDN)
tools/
  validate.js                   בדיקת תקינות — השער היחיד
  dev-server.js                 שרת תצוגה מקדימה מקומי
vercel.json                     פרוקסי ל-branch release ב-GitHub
DESIGN.md                       עקרונות A4 ופדגוגיה
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

**לשנות דף קיים**
ערכו את `עמוד-<N>.html` ו/או `styles/pages/עמוד-<N>.css`, הריצו `npm run dev` וצפו.
ה-CSS של דף חייב להיות **תחום ל-`.page-<N>`** (הוולידטור אוכף זאת כדי למנוע דליפת סגנון בין דפים).

**להוסיף / להסיר דף** — עריכת מניפסט בלבד:
1. צרו/מחקו את `עמוד-<N>.html` ואת `styles/pages/עמוד-<N>.css`.
2. הוסיפו/הסירו את הרשומה במערך `pages` שב-`WORKBOOK_MANIFEST.json`.
3. עדכנו את `totalPages` שיהיה שווה למספר הדפים בפועל.

`workbookNumber` (המספור בחוברת) נקבע אוטומטית לפי המיקום במערך.

**לשנות סדר**
סדרו מחדש את מערך `pages` במניפסט. זהו הכול.

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

ראו [`DESIGN.md`](DESIGN.md) — Exact A4 Preview (אותו דף בדיוק בנייד/טאבלט/מחשב ובהדפסה),
ניצול דף חכם, פתרון אנכי, ושאר עקרונות הפדגוגיה והפריסה.
