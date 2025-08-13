# מדריך פתרון בעיות התחברות - מערכת Digitlex

## בעיות שתוקנו

### 1. הגדרות Axios
- ✅ הוספת axios instance מותאם אישית
- ✅ הגדרת withCredentials: true
- ✅ הוספת interceptors לטיפול בשגיאות
- ✅ הגדרת timeout וטיפול בשגיאות רשת

### 2. הגדרות השרת
- ✅ שיפור הגדרות CORS
- ✅ תיקון הגדרות Session
- ✅ הוספת שמירה מפורשת של session
- ✅ שיפור הגדרות Socket.IO

### 3. תיקוני באגים
- ✅ הוספת logging מפורט
- ✅ טיפול טוב יותר בשגיאות
- ✅ הוספת debugging לחיבורים

## איך לבדוק אם המערכת עובדת

### שלב 1: הפעלת השרת
```bash
# מתיקיית הפרויקט
start-server.bat
```

### שלב 2: הפעלת פאנל הניהול
```bash
# בטרמינל נפרד
start-admin.bat
```

### שלב 3: בדיקת חיבור
1. פתח את הקובץ `test-connection.html` בדפדפן
2. בדוק שכל הבדיקות עוברות בהצלחה:
   - ✅ בדיקת זמינות השרת
   - ✅ בדיקת התחברות
   - ✅ בדיקת Socket.IO

### שלב 4: התחברות לפאנל
1. פתח: http://localhost:3000
2. השתמש בפרטים:
   - שם משתמש: `admin`
   - סיסמה: `admin123`

## אבחון בעיות נפוצות

### "לא ניתן להתחבר לשרת"
1. ודא שהשרת רץ על פורט 3001
2. בדוק ב-Terminal שאין שגיאות
3. בדוק ש-Windows Firewall לא חוסם

### "שגיאה בהתחברות"
1. ודא שהמשתמש admin קיים:
```bash
cd server
node check-users.js
```

### "Socket.IO לא מתחבר"
1. בדוק את קונסול הדפדפן
2. ודא שאין חסימת CORS
3. נסה לרפרש את העמוד

## פקודות debugging שימושיות

### בדיקת בסיס הנתונים
```bash
cd server
node check-db.js
node check-users.js
```

### בדיקת אימות
```bash
cd server
node test-auth.js
```

### איפוס מערכת
```bash
# מחיקת sessions
rm server/sessions.db
# הפעלה מחדש של השרת
```

## משתמשים במערכת

| שם משתמש | סיסמה | תפקיד |
|----------|--------|-------|
| admin | admin123 | super_admin |
| saia | [לא ידוע] | user |
| בדיקה | [לא ידוע] | user |

## קבצים שהשתנו

### Client-side
- `admin-panel/src/utils/axios.js` - אקסיוס מותאם אישית
- `admin-panel/src/components/Login.js` - שיפור טיפול בשגיאות
- `admin-panel/src/App.js` - עדכון לאקסיוס החדש

### Server-side
- `server/index.js` - שיפור CORS, Sessions, Socket.IO

### קבצי עזר
- `test-connection.html` - כלי בדיקת חיבור
- `DEBUG_LOGIN.md` - המדריך הזה

## הערות חשובות

1. **Credentials**: כל הבקשות נשלחות עם `withCredentials: true`
2. **CORS**: השרת מקבל בקשות מ-localhost:3000 ו-localhost:3001
3. **Sessions**: נשמרות ב-SQLite עם תוקף של 24 שעות
4. **Logging**: כל הפעולות נרשמות בקונסול לdebugging

אם הבעיה עדיין קיימת, בדוק את הקונסול בדפדפן ואת הלוגים בטרמינל השרת.
