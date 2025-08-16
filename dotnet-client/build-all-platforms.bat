@echo off
REM Script להכנת גרסאות להפצה בפלטפורמות שונות
REM =================================================

echo 🚀 Digitlex Viewer - Build All Platforms
echo ==========================================
echo.

REM נקה build קודמים
echo 🧹 מנקה קבצים קודמים...
if exist "bin\Release" rmdir /s /q "bin\Release"
if exist "obj\Release" rmdir /s /q "obj\Release"
if exist "publish-all" rmdir /s /q "publish-all"

mkdir "publish-all" 2>nul

echo.
echo 📦 בונה גרסאות לפלטפורמות שונות...
echo.

REM Windows x64 (מומלץ)
echo 🖥️ בונה עבור Windows x64...
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:PublishReadyToRun=true -o publish-all/win-x64
if %ERRORLEVEL% neq 0 (
    echo ❌ שגיאה בבניית Windows x64!
    pause
    exit /b 1
)

REM Windows x86 (מחשבים ישנים)
echo 🖥️ בונה עבור Windows x86...
dotnet publish -c Release -r win-x86 --self-contained true -p:PublishSingleFile=true -p:PublishReadyToRun=true -o publish-all/win-x86
if %ERRORLEVEL% neq 0 (
    echo ❌ שגיאה בבניית Windows x86!
    pause
    exit /b 1
)

REM Windows ARM64 (מחשבי ARM חדשים)
echo 🖥️ בונה עבור Windows ARM64...
dotnet publish -c Release -r win-arm64 --self-contained true -p:PublishSingleFile=true -o publish-all/win-arm64
if %ERRORLEVEL% neq 0 (
    echo ⚠️ אזהרה: שגיאה בבניית Windows ARM64 (לא חיוני)
)

echo.
echo ✅ הבנייה הושלמה!
echo.

REM יצירת חבילות הפצה
echo 📁 יוצר חבילות הפצה...

REM Windows x64 Package
mkdir "publish-all\DigitlexViewer-Windows-x64" 2>nul
copy "publish-all\win-x64\DigitlexViewer.exe" "publish-all\DigitlexViewer-Windows-x64\"

REM Windows x86 Package  
mkdir "publish-all\DigitlexViewer-Windows-x86" 2>nul
copy "publish-all\win-x86\DigitlexViewer.exe" "publish-all\DigitlexViewer-Windows-x86\"

REM יצירת README לכל חבילה
(
echo Digitlex Viewer - Windows x64
echo =============================
echo.
echo גרסה זו מיועדת למחשבי Windows 64-bit מודרניים
echo ^(רוב המחשבים החדשים^)
echo.
echo הוראות התקנה:
echo 1. הורד את הקובץ DigitlexViewer.exe למיקום קבוע
echo 2. הפעל בלחיצה כפולה
echo 3. הזן כתובת שרת ומזהה מסך בהפעלה הראשונה
echo.
echo דרישות מערכת:
echo - Windows 10/11 ^(64-bit^)
echo - אין צורך להתקין .NET
echo.
echo תמיכה: 052-4521527
) > "publish-all\DigitlexViewer-Windows-x64\README.txt"

(
echo Digitlex Viewer - Windows x86
echo =============================
echo.
echo גרסה זו מיועדת למחשבי Windows 32-bit או ישנים
echo.
echo הוראות התקנה:
echo 1. הורד את הקובץ DigitlexViewer.exe למיקום קבוע
echo 2. הפעל בלחיצה כפולה
echo 3. הזן כתובת שרת ומזהה מסך בהפעלה הראשונה
echo.
echo דרישות מערכת:
echo - Windows 7/8/10/11 ^(32-bit או 64-bit^)
echo - אין צורך להתקין .NET
echo.
echo תמיכה: 052-4521527
) > "publish-all\DigitlexViewer-Windows-x86\README.txt"

REM הצגת סיכום
echo.
echo 📊 סיכום הבנייה:
echo ================
echo.

if exist "publish-all\win-x64\DigitlexViewer.exe" (
    echo ✅ Windows x64: 
    dir "publish-all\win-x64\DigitlexViewer.exe" | findstr "DigitlexViewer.exe"
)

if exist "publish-all\win-x86\DigitlexViewer.exe" (
    echo ✅ Windows x86:
    dir "publish-all\win-x86\DigitlexViewer.exe" | findstr "DigitlexViewer.exe"
)

if exist "publish-all\win-arm64\DigitlexViewer.exe" (
    echo ✅ Windows ARM64:
    dir "publish-all\win-arm64\DigitlexViewer.exe" | findstr "DigitlexViewer.exe"
)

echo.
echo 🎉 כל החבילות מוכנות להפצה!
echo 📍 מיקום: publish-all\
echo.
echo חבילות זמינות:
echo - DigitlexViewer-Windows-x64 ^(מחשבים מודרניים^)
echo - DigitlexViewer-Windows-x86 ^(מחשבים ישנים^)
echo.

REM פתיחת התיקייה
start explorer "publish-all"

echo ✅ סיום! החבילות מוכנות להפצה.
pause
