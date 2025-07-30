# Digitlex - מערכת מסך דיגיטלי

מערכת מסך דיגיטלי מתקדמת הכוללת שרת Node.js, פאנל ניהול React, ואפליקציית דסקטופ Electron.

## 🚀 תכונות עיקריות

- **מסך דיגיטלי מתקדם** עם תצוגת זמן ותאריך
- **פאנל ניהול** לניהול תוכן ומסכים
- **חדשות RSS** עם גלילה אינסופית
- **עדכונים בזמן אמת** באמצעות Socket.IO
- **ניהול הרשאות** מתקדם
- **אפליקציית דסקטופ** עם ניהול מקומי

## 📋 דרישות מערכת

- Node.js (גרסה 16 ומעלה)
- npm או yarn
- Git (להתקנה)

## 🛠️ התקנה

### 1. הורדת הפרויקט

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 2. התקנת תלויות

```bash
# התקנת תלויות שרת
cd server
npm install

# התקנת תלויות פאנל ניהול
cd ../admin-panel
npm install

# התקנת תלויות אפליקציית דסקטופ
cd ../desktop-client
npm install
```

### 3. הגדרת בסיס נתונים

```bash
cd ../server
npm run init-db
```

## 🚀 הפעלה

### שימוש בקבצי .bat (מומלץ)

1. **הפעלת כל השירותים:**
   ```bash
   start-all.bat
   ```

2. **או הפעלה נפרדת:**
   ```bash
   start-server.bat      # הפעלת שרת
   start-admin.bat       # הפעלת פאנל ניהול
   start-client.bat      # הפעלת אפליקציית דסקטופ
   ```

### הפעלה ידנית

```bash
# הפעלת שרת (פורט 3001)
cd server
npm start

# הפעלת פאנל ניהול (פורט 3000)
cd admin-panel
npm start

# הפעלת אפליקציית דסקטופ
cd desktop-client
npm start
```

## 📱 שימוש במערכת

### פאנל ניהול
- **כתובת:** http://localhost:3000
- **פונקציות:**
  - ניהול מסכים ותוכן
  - הגדרת חדשות RSS
  - ניהול הודעות
  - ניהול משתמשים והרשאות

### אפליקציית דסקטופ
- **F8:** פתיחת פאנל ניהול מקומי
- **ESC:** יציאה מהאפליקציה
- **תכונות:**
  - תצוגת זמן ותאריך
  - חדשות RSS עם גלילה אוטומטית
  - חיבור לשרת מרחוק
  - ניהול הגדרות מקומי

## ⚙️ הגדרות

### שרת
- **פורט ברירת מחדל:** 3001
- **בסיס נתונים:** SQLite
- **אימות:** Sessions עם SQLite

### פאנל ניהול
- **פורט ברירת מחדל:** 3000
- **עדכונים בזמן אמת:** Socket.IO

### אפליקציית דסקטופ
- **ניהול מקומי:** F8
- **חדשות RSS:** גלילה אוטומטית
- **חיבור לשרת:** ניתן להגדרה בפאנל הניהול

## 🔧 פתרון בעיות

### בעיות נפוצות

1. **פורט תפוס:**
   ```bash
   netstat -ano | findstr :3001
   taskkill /F /PID [PID]
   ```

2. **בעיות הרשאות:**
   ```bash
   cd server
   node fix-permissions.js
   ```

3. **בעיות חיבור:**
   - בדוק שהשרת רץ
   - בדוק הגדרות Firewall
   - בדוק כתובת שרת באפליקציית הדסקטופ

## 📁 מבנה הפרויקט

```
digitlex/
├── server/                 # שרת Node.js
│   ├── index.js           # שרת ראשי
│   ├── database.js        # ניהול בסיס נתונים
│   └── fix-permissions.js # תיקון הרשאות
├── admin-panel/           # פאנל ניהול React
│   ├── src/
│   │   ├── components/    # רכיבי React
│   │   └── App.js         # אפליקציה ראשית
│   └── package.json
├── desktop-client/        # אפליקציית Electron
│   ├── src/
│   │   ├── main.js        # תהליך ראשי
│   │   ├── renderer.js    # תהליך רינדור
│   │   └── index.html     # ממשק משתמש
│   └── package.json
├── start-*.bat           # קבצי הפעלה אוטומטיים
└── README.md             # קובץ זה
```

## 🤝 תרומה

1. Fork את הפרויקט
2. צור branch חדש (`git checkout -b feature/AmazingFeature`)
3. Commit את השינויים (`git commit -m 'Add some AmazingFeature'`)
4. Push ל-branch (`git push origin feature/AmazingFeature`)
5. פתח Pull Request

## 📄 רישיון

פרויקט זה מוגן תחת רישיון MIT.

## 📞 תמיכה

לשאלות ותמיכה, אנא צור Issue ב-GitHub או פנה למפתח.

---

**Digitlex** - מערכת מסך דיגיטלי מתקדמת 