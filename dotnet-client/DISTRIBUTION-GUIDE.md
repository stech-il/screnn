# 📦 מדריך הפצה - Digitlex Viewer

## 🚀 בנייה להפצה

### בנייה מהירה (לבדיקות)
```bash
# בנייה מהירה לבדיקה
build-quick.bat
```

### בנייה מלאה (לייצור)
```bash
# בנייה מלאה עם אופטימיזציות
build-release.bat
```

### בנייה לכל הפלטפורמות
```bash
# בנייה עבור Windows x64, x86, ARM64
build-all-platforms.bat
```

## 📋 סוגי חבילות

### 1. **Self-Contained** (מומלץ)
- ✅ לא דורש התקנת .NET על המחשב של הלקוח
- ✅ קובץ EXE יחיד
- ✅ פשוט להפצה
- ❌ גודל קובץ גדול יותר (~100MB)

### 2. **Framework-Dependent**
- ✅ קובץ קטן (~10MB)
- ❌ דורש התקנת .NET Runtime על מחשב הלקוח

## 🎯 המלצות להפצה

### לקוחות עסקיים
- השתמש ב-**Windows x64** (מחשבים מודרניים)
- השתמש ב-**Windows x86** (מחשבים ישנים)

### התקנה קלה
1. העתק את `DigitlexViewer.exe` לתיקייה קבועה
2. צור קיצור דרך על שולחן העבודה
3. הגדר הפעלה אוטומטית עם Windows (אופציונלי)

## 🔧 הגדרות מתקדמות

### שינוי הגדרות בנייה
ערוך את `DigitlexViewer.csproj`:

```xml
<!-- גרסה חדשה -->
<AssemblyVersion>1.1.0.0</AssemblyVersion>
<FileVersion>1.1.0.0</FileVersion>

<!-- הוספת אייקון -->
<ApplicationIcon>assets\icon.ico</ApplicationIcon>

<!-- אופטימיזציה נוספת -->
<PublishTrimmed>true</PublishTrimmed>
```

### בנייה ידנית מ-Command Line
```bash
# Windows x64
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist/win-x64

# Windows x86  
dotnet publish -c Release -r win-x86 --self-contained true -p:PublishSingleFile=true -o dist/win-x86
```

## 📊 גדלי קבצים צפויים

- **Windows x64**: ~80-120MB
- **Windows x86**: ~70-100MB
- **Windows ARM64**: ~80-120MB

## 🔐 אבטחה

### Windows Defender
הקובץ עלול להיחסם על ידי Windows Defender:
1. הלקוח יראה "Windows protected your PC"
2. לחץ על "More info"
3. לחץ על "Run anyway"

### חתימה דיגיטלית (מתקדם)
לקבלת אמון גבוה יותר:
1. רכוש תעודת חתימה דיגיטלית
2. חתום על הקובץ EXE
3. זה ימנע התרעות אבטחה

## 📱 הפצה ללקוחות

### אפשרויות הפצה

1. **במייל**
   - דחוס את הקובץ (ZIP)
   - שלח עם הוראות התקנה

2. **דרך אתר**
   - העלה לשרת
   - צור קישור הורדה

3. **USB/CD**
   - הפצה פיזית
   - כולל הוראות מודפסות

4. **שירותי Cloud**
   - Google Drive / OneDrive
   - שיתוף קישור

### תיעוד ללקוח

כלול בכל חבילה:
- ✅ README.txt
- ✅ הוראות התקנה
- ✅ פרטי תמיכה
- ✅ דרישות מערכת

## 🆔 ניהול גרסאות

### מספור גרסאות
```
1.0.0.0 - גרסה ראשונית
1.1.0.0 - תכונות חדשות  
1.0.1.0 - תיקוני באגים
1.0.0.1 - תיקונים קטנים
```

### מעקב גרסאות
- עדכן את `AssemblyVersion` בכל שינוי
- שמור היסטוריית שינויים
- תייג בגיט: `git tag v1.0.0`

## 🔄 עדכונים אוטומטיים (עתידי)

אפשרות להוסיף בעתיד:
- בדיקת גרסה חדשה בהפעלה
- הורדה והתקנה אוטומטית
- התראות על עדכונים

## 📞 תמיכה

**שי טכנולוגיות**  
📱 טלפון: 052-4521527  
📧 אימייל: [כתובת המייל שלך]  
🌐 אתר: [כתובת האתר שלך]

---
*מעודכן: ינואר 2025*
