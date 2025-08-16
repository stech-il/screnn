@echo off
REM Script להכנת גרסת הפצה של Digitlex Viewer
REM =========================================

echo 🚀 מכין Digitlex Viewer להפצה...
echo.

REM נקה build קודמים
echo 🧹 מנקה קבצים קודמים...
if exist "bin\Release" rmdir /s /q "bin\Release"
if exist "obj\Release" rmdir /s /q "obj\Release"
if exist "publish" rmdir /s /q "publish"

echo.
echo 📦 בונה אפליקציה...

REM בניית האפליקציה עם אופטימיזציות
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:PublishReadyToRun=true -p:IncludeNativeLibrariesForSelfExtract=true -o publish/win-x64

if %ERRORLEVEL% neq 0 (
    echo ❌ שגיאה בבניית האפליקציה!
    pause
    exit /b 1
)

echo.
echo ✅ הבנייה הושלמה בהצלחה!
echo.

REM יצירת חבילת הפצה
echo 📁 יוצר חבילת הפצה...
mkdir "publish\DigitlexViewer-Package" 2>nul

REM העתקת הקובץ הראשי
copy "publish\win-x64\DigitlexViewer.exe" "publish\DigitlexViewer-Package\"

REM יצירת קובץ README
(
echo Digitlex Viewer - מסך דיגיטלי
echo =============================
echo.
echo הוראות התקנה:
echo 1. הורד את הקובץ DigitlexViewer.exe למיקום קבוע במחשב
echo 2. הפעל את הקובץ בלחיצה כפולה
echo 3. בהפעלה הראשונה - הזן כתובת שרת ומזהה מסך
echo 4. האפליקציה תתחיל לעבוד אוטומטית
echo.
echo אם Windows Defender חוסם את הקובץ:
echo 1. לחץ על "More info"
echo 2. לחץ על "Run anyway"
echo.
echo תמיכה: טל 052-4521527
echo © 2025 שי טכנולוגיות
) > "publish\DigitlexViewer-Package\README.txt"

REM יצירת קובץ התקנה פשוט
(
echo @echo off
echo echo 🖥️ מתקין Digitlex Viewer...
echo if not exist "C:\Program Files\DigitlexViewer" mkdir "C:\Program Files\DigitlexViewer"
echo copy "DigitlexViewer.exe" "C:\Program Files\DigitlexViewer\"
echo echo ✅ התקנה הושלמה!
echo echo הפעל את האפליקציה מתפריט התחל או מ:
echo echo "C:\Program Files\DigitlexViewer\DigitlexViewer.exe"
echo pause
) > "publish\DigitlexViewer-Package\install.bat"

REM הצגת מידע על הקובץ שנוצר
echo.
echo 📊 מידע על הקובץ שנוצר:
dir "publish\DigitlexViewer-Package\DigitlexViewer.exe" | findstr "DigitlexViewer.exe"

echo.
echo 🎉 חבילת ההפצה מוכנה!
echo 📍 מיקום: publish\DigitlexViewer-Package\
echo.
echo הקבצים בחבילה:
echo - DigitlexViewer.exe (הקובץ הראשי)
echo - README.txt (הוראות התקנה)
echo - install.bat (התקנה אוטומטית)
echo.

REM פתיחת התיקייה
echo 📂 פותח את תיקיית ההפצה...
start explorer "publish\DigitlexViewer-Package"

echo ✅ סיום! החבילה מוכנה להפצה ללקוחות.
pause
