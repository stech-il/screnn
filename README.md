# Digitlex - מערכת מסכים דיגיטליים

## 🚀 הפעלה מהירה

יצרנו עבורך קבצי הפעלה אוטומטיים לנוחות מקסימלית:

### 📁 קבצי הפעלה זמינים:

1. **`start-server.bat`** - הפעלת השרת בלבד
   - השרת יהיה זמין ב: http://localhost:3001
   - פאנל ניהול: http://localhost:3001/admin
   - מסך לקוח: http://localhost:3001/client

2. **`start-admin.bat`** - הפעלת פאנל ניהול בלבד
   - הפאנל יהיה זמין ב: http://localhost:3000

3. **`start-client.bat`** - הפעלת אפליקציית לקוח בלבד
   - האפליקציה תהיה זמינה ב: http://localhost:3002/client

4. **`start-all.bat`** - הפעלת כל השירותים יחד
   - מפעיל את השרת, פאנל ניהול ואפליקציית לקוח במקביל

### 🎯 איך להשתמש:

1. **לפיתוח רגיל**: הפעל `start-all.bat` (הכי נוח)
2. **לבדיקת שרת בלבד**: הפעל `start-server.bat`
3. **לעריכת ניהול בלבד**: הפעל `start-admin.bat`
4. **לבדיקת לקוח בלבד**: הפעל `start-client.bat`

### ⚠️ הערות חשובות:

- **השרת חייב לרוץ** כדי שהפאנל ניהול ואפליקציית הלקוח יעבדו
- אם אתה רוצה רק לערוך ניהול, הפעל גם `start-server.bat` וגם `start-admin.bat`
- אם אתה רוצה רק לבדוק את המסך, הפעל גם `start-server.bat` וגם `start-client.bat`

### 🔧 פתרון בעיות:

- אם פורט 3001 תפוס, סגור את כל החלונות ונסה שוב
- אם יש שגיאות, בדוק שהתקנת את כל החבילות עם `npm install` בכל תיקייה

### 📞 תמיכה:

אם יש בעיות, בדוק את הלוגים בחלונות הטרמינל שפתחת. 