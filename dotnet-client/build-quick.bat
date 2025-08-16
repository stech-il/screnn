@echo off
REM Build מהיר לבדיקות
REM ===================

echo 🚀 בניית גרסת בדיקה מהירה...

REM נקה build קודמים
if exist "bin\Release" rmdir /s /q "bin\Release"
if exist "publish-quick" rmdir /s /q "publish-quick"

REM בניה מהירה ללא אופטימיזציות כבדות
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish-quick

if %ERRORLEVEL% neq 0 (
    echo ❌ שגיאה בבנייה!
    pause
    exit /b 1
)

echo ✅ בנייה מהירה הושלמה!
echo 📍 מיקום: publish-quick\DigitlexViewer.exe

REM הפעלה אוטומטית
set /p run="האם להפעיל את האפליקציה? (y/n): "
if /i "%run%"=="y" start "DigitlexViewer" "publish-quick\DigitlexViewer.exe"

pause
