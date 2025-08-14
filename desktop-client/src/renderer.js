const { ipcRenderer } = require('electron');
const path = require('path');

// משתני מצב
let localData = null;
let currentContentIndex = 0;
// currentRssIndex לא צריך כי RSS מובנה ב-HTML!
// let currentRssIndex = 0;
let contentRotationInterval = null;
// rssRotationInterval לא צריך כי RSS מובנה ב-HTML!
// let rssRotationInterval = null;
let isOnline = false;
let screenId = null;
// RSS ticker RAF state
let rssTickerRafId = null;
let rssTickerLastTs = null;
let rssTickerPosPx = 0;
let currentRssDirection = 'rtl';
let currentRssItemsCache = [];
let rssPixelsPerSecond = 12; // מהירות ברירת מחדל, תותאם לפי רזולוציה
let rssShowTitleOnly = true; // מצב להצגת כותרת בלבד
// Messages ticker RAF state
let messagesRafId = null;
let messagesLastTs = null;
let messagesPosPx = 0;

// משתני cursor
let cursorHideTimeout = null;
let lastActivity = Date.now();
const CURSOR_HIDE_DELAY = 3000; // 3 שניות

// משתני ניהול
let managementPanelVisible = false;
// currentRssSpeed לא צריך כי RSS מובנה ב-HTML!
// let currentRssSpeed = 90; // מהירות RSS ב-שניות (מהירות איטית מאוד לקריאה נוחה)
let currentRefreshRate = 30; // קצב ריענון ב-שניות

// DOM elements
const setupScreen = document.getElementById('setupScreen');
const mainScreen = document.getElementById('mainScreen');
const screenIdInput = document.getElementById('screenIdInput');
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');
const screenTitle = document.getElementById('screenTitle');
const currentTime = document.getElementById('currentTime');
const currentDate = document.getElementById('currentDate');
const dayName = document.getElementById('dayName');

const loadingMessage = document.getElementById('loadingMessage');
const contentContainer = document.getElementById('contentContainer');
const logoArea = document.getElementById('logoArea');

// New layout elements
const runningMessagesSidebar = document.getElementById('runningMessagesSidebar');
const messageScroller = document.getElementById('messageScroller');
const rssBottom = document.getElementById('rssBottom');
const rssTickerContent = document.getElementById('rssTickerContent');

// אתחול האפליקציה
async function initializeApp() {
    console.log('🚀 מאתחל אפליקציה Digitlex...');
    
    // אתחול מעקב cursor
    initializeCursorTracking();
    
    // אתחול תפריט ניהול
    initializeManagementPanel();
    
    // הצגת הודעות דוגמה מיד (לא לחכות לנתונים)
    console.log('🚀 מציג הודעות דוגמה מיד...');
    const immediateMessages = [
        { content: 'ברוכים הבאים למסך הדיגיטלי! ⭐', is_active: true, speed: 20 },
        { content: 'המערכת בהפעלה... 🚀', is_active: true, speed: 20 }
    ];
    displayRunningMessagesSidebar(immediateMessages);
    
    // הצגת RSS דוגמה מיד - ללא בדיקות
    console.log('🚀 מציג RSS דוגמה מיד...');
    // RSS כבר מוצג ב-HTML - אבל נעדכן אותו עם דוגמה!
    const demoRssItems = [
        { title: 'ברוכים הבאים למערכת Digitlex', description: 'מערכת דיגיטלית מתקדמת לניהול מסכים' },
        { title: 'חדשות נגללות בזמן אמת', description: 'עדכונים מתמידים ללא הפסקה' },
        { title: 'ממשק משתמש מתקדם', description: 'עיצוב מודרני ונוח לשימוש' }
    ];
    populateRssTicker(demoRssItems);
    console.log('✅ RSS מובנה ב-HTML עודכן עם דוגמה - עובד מיד!');
    
    // בדיקה מיידית שה-RSS המובנה ב-HTML עובד
    setTimeout(() => {
        const isVisible = rssBottom.style.display === 'block';
        const hasAnimation = rssTickerContent.style.animation.includes('rssScrollCenter');
        console.log(`🔍 RSS HTML Check:`, {
            isVisible,
            hasAnimation,
            animationStyle: rssTickerContent.style.animation
        });
        
        if (isVisible && hasAnimation) {
            console.log('✅ RSS מובנה ב-HTML עובד נהדר!');
        } else {
            console.log('📺 RSS מובנה ב-HTML צריך בדיקה נוספת');
        }
    }, 100);
    
    // בדיקת מזהה מסך קיים
    screenId = await ipcRenderer.invoke('get-screen-id');
    
    if (!screenId) {
        showSetupScreen();
        return;
    }

    // טוען נתונים לאחר עלייה מיידית של הממשק (כדי לא להפריע ל-RSS)
    setTimeout(() => {
        loadData();
    }, 150);
    
    // הפעלת עדכון זמן
    startTimeUpdates();
    
    // האזנה לשינויי גודל חלון כדי להתאים את ה-RSS לרזולוציה
    window.addEventListener('resize', () => {
        if (currentRssItemsCache && currentRssItemsCache.length > 0) {
            console.log('📐 שינוי רזולוציה - התאמת RSS');
            populateRssTicker(currentRssItemsCache, currentRssDirection || 'ltr');
        }
    }, { passive: true });
    
    // בדיקת חיבור ראשונית
    await checkConnection();
    
    // טעינת נתונים ברקע (לא מאפס את ה-RSS)
    console.log('🔄 טוען נתונים ברקע בלי לאפס RSS...');
    setTimeout(async () => {
        const serverData = await ipcRenderer.invoke('sync-with-server');
        if (serverData) {
            console.log('📡 קיבל נתונים חדשים מהשרת');
        }
    }, 1000); // אחרי שנייה כדי לא להפריע ל-RSS
    
    // האזנה לעדכוני לוגו בזמן אמת
    if (window.io) {
        window.io.on('screen_logo_updated', (data) => {
            if (data.id === screenId && localData && localData.screenData) {
                localData.screenData.logo_url = data.logo_url;
                if (data.logo_url) {
                    logoArea.innerHTML = `<img src="${data.logo_url}" alt="לוגו" style="max-height: 60px; max-width: 200px; object-fit: contain;">`;
                } else {
                    logoArea.innerHTML = '<span>מקום ללוגו</span>';
                }
            }
        });
    }
    
    hideSetupScreen();
}

// אתחול מעקב cursor
function initializeCursorTracking() {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    activityEvents.forEach(event => {
        document.addEventListener(event, handleUserActivity, true);
    });
    
    // התחלת מעקב cursor
    resetCursorHideTimer();
}

// טיפול בפעילות משתמש
function handleUserActivity() {
    lastActivity = Date.now();
    showCursor();
    resetCursorHideTimer();
}

// הצגת cursor
function showCursor() {
    document.body.classList.remove('cursor-hidden');
}

// הסתרת cursor
function hideCursor() {
    document.body.classList.add('cursor-hidden');
}

// איפוס טיימר הסתרת cursor
function resetCursorHideTimer() {
    if (cursorHideTimeout) {
        clearTimeout(cursorHideTimeout);
    }
    
    cursorHideTimeout = setTimeout(() => {
        const timeSinceLastActivity = Date.now() - lastActivity;
        if (timeSinceLastActivity >= CURSOR_HIDE_DELAY) {
            hideCursor();
        }
    }, CURSOR_HIDE_DELAY);
}

// אתחול תפריט ניהול
function initializeManagementPanel() {
    // יצירת תפריט ניהול
    createManagementPanel();
    
    // האזנה למקש F8
    document.addEventListener('keydown', (event) => {
        if (event.key === 'F8') {
            event.preventDefault();
            toggleManagementPanel();
        }
    });
}

// אתחול אנימציית RSS - לא צריך כי RSS מובנה ב-HTML!
function initializeRssAnimation() {
    console.log('📺 RSS מובנה ב-HTML - לא צריך initializeRssAnimation!');
    // ה-RSS המובנה ב-HTML עובד נהדר עם האנימציה שלו!
}

// יצירת תפריט ניהול
function createManagementPanel() {
    const panel = document.createElement('div');
    panel.id = 'managementPanel';
    panel.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        border: 2px solid #ffd700;
        border-radius: 10px;
        padding: 20px;
        color: white;
        font-family: Arial, sans-serif;
        z-index: 10000;
        display: none;
        min-width: 400px;
        max-width: 500px;
    `;
    
    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #ffd700;">ניהול מסך Digitlex</h2>
            <button id="closeManagementPanel" style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">✕</button>
        </div>
        
        <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid #ffd700; border-radius: 5px; padding: 10px; margin-bottom: 15px;">
            <small style="color: #ffd700; font-size: 0.9em;">✨ שיפורים חדשים: שעה ותאריך משופרים, חדשות במהירות איטית וקריאה</small>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: #ffd700;">כתובת שרת:</label>
            <input type="text" id="managementServerUrl" placeholder="https://screnn.onrender.com" style="width: 100%; padding: 8px; border: 1px solid #ffd700; background: #333; color: white; border-radius: 5px;">
            <small style="color: #ccc; font-size: 0.8em;">לדוגמה: https://screnn.onrender.com</small>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: #ffd700;">מזהה מסך:</label>
            <input type="text" id="managementScreenId" style="width: 100%; padding: 8px; border: 1px solid #ffd700; background: #333; color: white; border-radius: 5px;">
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: #ffd700;">מהירות חדשות (שניות):</label>
            <input type="number" id="managementRssSpeed" min="60" max="600" style="width: 100%; padding: 8px; border: 1px solid #ffd700; background: #333; color: white; border-radius: 5px;">
            <small style="color: #ccc; font-size: 0.8em;">60-120 שניות = מהירות קריאה, 180+ = איטי מאוד</small>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; color: #ffd700;">קצב ריענון מסך (שניות):</label>
            <input type="number" id="managementRefreshRate" min="10" max="120" style="width: 100%; padding: 8px; border: 1px solid #ffd700; background: #333; color: white; border-radius: 5px;">
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: center;">
            <button id="saveManagementSettings" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">שמור הגדרות</button>
            <button id="testConnectionBtn" style="background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">בדוק חיבור</button>
        </div>
        
        <div id="managementStatus" style="margin-top: 15px; padding: 10px; border-radius: 5px; display: none;"></div>
    `;
    
    document.body.appendChild(panel);
    
    // הוספת event listeners
    document.getElementById('closeManagementPanel').addEventListener('click', toggleManagementPanel);
    document.getElementById('saveManagementSettings').addEventListener('click', saveManagementSettings);
    document.getElementById('testConnectionBtn').addEventListener('click', testConnectionFromPanel);
}

// טעינת ערכים לתפריט ניהול
async function loadManagementPanelValues() {
    try {
        // טעינת כתובת שרת נוכחית
        const currentServerUrl = await ipcRenderer.invoke('get-server-url');
        document.getElementById('managementServerUrl').value = currentServerUrl || '';
        
        // טעינת ערכים אחרים
        document.getElementById('managementScreenId').value = screenId || '';
        // document.getElementById('managementRssSpeed').value = currentRssSpeed; // לא צריך כי RSS מובנה ב-HTML!
        document.getElementById('managementRefreshRate').value = currentRefreshRate;
    } catch (error) {
        console.error('שגיאה בטעינת ערכי ניהול:', error);
    }
}

// הצגה/הסתרה של תפריט ניהול
function toggleManagementPanel() {
    const panel = document.getElementById('managementPanel');
    if (!panel) return;
    
    if (managementPanelVisible) {
        panel.style.display = 'none';
        managementPanelVisible = false;
    } else {
        // טעינת ערכים נוכחיים
        loadManagementPanelValues();
        
        panel.style.display = 'block';
        managementPanelVisible = true;
    }
}

// שמירת הגדרות ניהול
async function saveManagementSettings() {
    const newServerUrl = document.getElementById('managementServerUrl').value.trim();
    const newScreenId = document.getElementById('managementScreenId').value.trim();
    const newRssSpeed = parseInt(document.getElementById('managementRssSpeed').value);
    const newRefreshRate = parseInt(document.getElementById('managementRefreshRate').value);
    
    const statusDiv = document.getElementById('managementStatus');
    
    try {
        // שמירת כתובת שרת חדשה
        if (newServerUrl) {
            await ipcRenderer.invoke('set-server-url', newServerUrl);
            console.log(`כתובת שרת עודכנה: ${newServerUrl}`);
            
            // הצגת כפתור הפעלה מחדש
            const statusDiv = document.getElementById('managementStatus');
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#ff9800';
            statusDiv.innerHTML = `
                כתובת שרת עודכנה בהצלחה! 
                <button id="restartAppBtn" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-left: 10px;">הפעל מחדש</button>
            `;
            
            document.getElementById('restartAppBtn').addEventListener('click', async () => {
                await ipcRenderer.invoke('restart-app');
            });
            
            return; // עצירת הפונקציה
        }
        
        // שמירת מזהה מסך חדש
        if (newScreenId && newScreenId !== screenId) {
            await ipcRenderer.invoke('set-screen-id', newScreenId);
            screenId = newScreenId;
            console.log(`מזהה מסך עודכן: ${screenId}`);
        }
        
        // עדכון מהירות RSS - לא צריך כי RSS מובנה ב-HTML!
        // if (newRssSpeed !== currentRssSpeed) { // לא צריך כי RSS מובנה ב-HTML!
        //     currentRssSpeed = newRssSpeed;
        //     console.log(`מהירות RSS עודכנה: ${currentRssSpeed} שניות - אבל RSS מובנה ב-HTML לא משתנה!`);
        // }
        
        // עדכון קצב ריענון
        if (newRefreshRate !== currentRefreshRate) {
            currentRefreshRate = newRefreshRate;
            updateRefreshRate();
            console.log(`קצב ריענון עודכן: ${currentRefreshRate} שניות`);
        }
        
        showManagementStatus('הגדרות נשמרו בהצלחה!', 'success');
        
        // ריענון נתונים אם מזהה מסך השתנה
        if (newScreenId && newScreenId !== screenId) {
            await loadData();
            await checkConnection();
        }
        
    } catch (error) {
        console.error('שגיאה בשמירת הגדרות:', error);
        showManagementStatus('שגיאה בשמירת הגדרות', 'error');
    }
}

// בדיקת חיבור מתפריט ניהול
async function testConnectionFromPanel() {
    const statusDiv = document.getElementById('managementStatus');
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#2196F3';
    statusDiv.textContent = 'בודק חיבור...';
    
    try {
        // קביעת כתובת שרת חדשה אם הוזנה
        const newServerUrl = document.getElementById('managementServerUrl').value.trim();
        if (newServerUrl) {
            await ipcRenderer.invoke('set-server-url', newServerUrl);
            console.log(`כתובת שרת עודכנה זמנית לבדיקה: ${newServerUrl}`);
        }
        
        const connected = await ipcRenderer.invoke('check-connection');
        if (connected) {
            showManagementStatus('חיבור תקין! ✅', 'success');
        } else {
            showManagementStatus('שגיאה בחיבור לשרת ❌', 'error');
        }
    } catch (error) {
        console.error('שגיאה בבדיקת חיבור:', error);
        showManagementStatus(`שגיאה בחיבור: ${error.message}`, 'error');
    }
}

// הצגת סטטוס בתפריט ניהול
function showManagementStatus(message, type) {
    const statusDiv = document.getElementById('managementStatus');
    statusDiv.style.display = 'block';
    statusDiv.textContent = message;
    
    if (type === 'success') {
        statusDiv.style.background = '#4CAF50';
    } else if (type === 'error') {
        statusDiv.style.background = '#f44336';
    }
    
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// עדכון מהירות RSS - לא צריך כי RSS מובנה ב-HTML!
function updateRssSpeed() {
    console.log('📺 RSS מובנה ב-HTML - לא צריך עדכון מהירות!');
    // ה-RSS המובנה ב-HTML עובד נהדר עם המהירות שלו!
}

// עדכון קצב ריענון
function updateRefreshRate() {
    // עצירת ריענון קיים
    if (contentRotationInterval) {
        clearInterval(contentRotationInterval);
    }
    
    // הפעלת ריענון חדש
    if (localData && localData.content && localData.content.length > 0) {
        contentRotationInterval = setInterval(() => {
            currentContentIndex = (currentContentIndex + 1) % localData.content.length;
            displayContent(localData.content[currentContentIndex]);
        }, currentRefreshRate * 1000);
    }
}

// הצגת מסך הגדרה
function showSetupScreen() {
    setupScreen.style.display = 'flex';
    mainScreen.style.display = 'none';
    showCursor(); // להבטיח שהcursor מוצג במסך הגדרה
}

// הסתרת מסך הגדרה
function hideSetupScreen() {
    setupScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    resetCursorHideTimer(); // התחלת מעקב cursor במסך הראשי
}

// שמירת מזהה מסך
async function saveScreenId() {
    const id = screenIdInput.value.trim();
    if (!id) {
        alert('אנא הזן מזהה מסך');
        return;
    }

    try {
        await ipcRenderer.invoke('set-screen-id', id);
        screenId = id;
        hideSetupScreen();
        await loadData();
        startTimeUpdates();
        await checkConnection();
    } catch (error) {
        alert('שגיאה בשמירת מזהה המסך: ' + error.message);
    }
}

// בדיקת חיבור
async function testConnection() {
    try {
        statusText.textContent = 'בודק חיבור...';
        const connected = await ipcRenderer.invoke('check-connection');
        if (connected) {
            statusText.textContent = '🟢 מחובר';
            statusText.className = 'status-online';
        } else {
            statusText.textContent = '🔴 לא מקוון';
            statusText.className = 'status-offline';
        }
    } catch (error) {
        statusText.textContent = 'שגיאה בבדיקת חיבור';
        statusText.className = 'status-offline';
    }
}

// בדיקת חיבור
async function checkConnection() {
    try {
        const connected = await ipcRenderer.invoke('check-connection');
        updateConnectionStatus(connected);
    } catch (error) {
        updateConnectionStatus(false);
    }
}

// עדכון סטטוס חיבור
function updateConnectionStatus(connected) {
    isOnline = connected;
    const statusDiv = connectionStatus;
    
    if (connected) {
        statusDiv.className = 'connection-status status-online';
        statusText.textContent = '🟢 מחובר';
    } else {
        statusDiv.className = 'connection-status status-offline';
        statusText.textContent = '🔴 לא מקוון';
    }
}

// טעינת נתונים
async function loadData() {
    try {
        loadingMessage.style.display = 'flex';
        
        console.log('🚀 מתחיל טעינת נתונים...');
        
            // RSS כבר מוצג ב-HTML - אין צורך ב-JavaScript!
            console.log('✅ RSS כבר מוצג ב-HTML - עובד מיד!');
            
            // הצגת נתוני דוגמה לתוכן
            displayDemoData();
        
        // טעינת נתונים מקומיים קיימים (אם יש) - לא מוחק אותם!
        console.log('📂 בודק נתונים מקומיים קיימים...');
        const existingLocalData = await ipcRenderer.invoke('get-local-data');
        
        if (existingLocalData) {
            console.log('💾 נמצאו נתונים מקומיים קיימים - מציג אותם תחילה');
            localData = existingLocalData;
                    // עדכון מלא כולל RSS - RSS מובנה ב-HTML!
        displayData(localData);
        }
        
        // מנסה לטעון נתונים חדשים מהשרת
        console.log('🌐 מנסה לטעון נתונים חדשים מהשרת...');
        
        try {
            const syncSuccess = await ipcRenderer.invoke('sync-with-server');
            
            if (syncSuccess) {
                console.log('✅ סנכרון עם השרת הצליח - טוען נתונים חדשים');
                
                // טעינת נתונים מקומיים חדשים (שזה עתה נשמרו)
                const newLocalData = await ipcRenderer.invoke('get-local-data');
                
                if (newLocalData && newLocalData.lastSync) {
                    console.log('🔄 מעדכן לנתונים חדשים מהשרת:');
            console.log('- screenData:', newLocalData.screenData);
            console.log('- content items:', newLocalData.content ? newLocalData.content.length : 0);
            console.log('- rssContent items:', newLocalData.rssContent ? newLocalData.rssContent.length : 0);
            console.log('- messages items:', newLocalData.messages ? newLocalData.messages.length : 0);
                    console.log('- lastSync:', newLocalData.lastSync);
            
                localData = newLocalData;
                        // עדכון מלא כולל RSS - RSS מובנה ב-HTML!
        displayData(newLocalData);
            } else {
                    console.log('⚠️ סנכרון הצליח אבל לא נמצאו נתונים חדשים');
            }
        } else {
                console.log('❌ סנכרון עם השרת נכשל');
                
                if (existingLocalData) {
                    console.log('💾 משתמש בנתונים מקומיים קיימים');
                } else {
                    console.log('📺 נשאר עם נתוני דוגמה');
                }
            }
        } catch (syncError) {
            console.error('❌ שגיאה בסנכרון עם השרת:', syncError);
            
            if (existingLocalData) {
                console.log('💾 אין חיבור לשרת - משתמש בנתונים מקומיים קיימים');
                // הנתונים המקומיים כבר מוצגים
                updateConnectionStatus(false); // עדכון סטטוס חיבור
            } else {
                console.log('📺 אין חיבור לשרת ואין נתונים מקומיים - נשאר עם נתוני דוגמה');
                // נתוני הדוגמה כבר מוצגים
                updateConnectionStatus(false); // עדכון סטטוס חיבור
            }
        }
        
        loadingMessage.style.display = 'none';
    } catch (error) {
        console.error('❌ שגיאה כללית בטעינת נתונים:', error);
        console.log('🔄 נשאר עם נתוני דוגמה');
        displayDemoData();
        loadingMessage.style.display = 'none';
    }
}

// פונקציה לבדיקה אם הנתונים השתנו
function hasLocalDataChanged(oldData, newData) {
    if (!oldData) return true; // אם אין נתונים קודמים, זה שינוי
    
    // בדיקת שינויים בתוכן
    if (!arraysEqual(oldData.content, newData.content)) return true;
    
    // בדיקת שינויים ב-RSS - לא בודק כי RSS מובנה ב-HTML!
    // if (!arraysEqual(oldData.rssContent, newData.rssContent)) return true;
    
    // בדיקת שינויים בהודעות
    if (!arraysEqual(oldData.messages, newData.messages)) return true;
    
    // בדיקת שינויים בנתוני המסך
    if (!objectsEqual(oldData.screenData, newData.screenData)) return true;
    
    return false;
}

// פונקציה להשוואת מערכים
function arraysEqual(arr1, arr2) {
    if (!arr1 && !arr2) return true;
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;
    
    for (let i = 0; i < arr1.length; i++) {
        if (!objectsEqual(arr1[i], arr2[i])) return false;
    }
    
    return true;
}

// פונקציה להשוואת אובייקטים
function objectsEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (!obj1 || !obj2) return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) return false;
    }
    
    return true;
}

// הצגת נתוני דוגמה
function displayDemoData() {
    console.log('מציג נתוני דוגמה');
    
    // הודעות דוגמה
    const demoMessages = [
        { content: 'ברוכים הבאים למסך הדיגיטלי! ⭐', is_active: true, speed: 20 },
        { content: 'המערכת עובדת במצב הדגמה 🚀', is_active: true, speed: 20 }
    ];
    displayRunningMessagesSidebar(demoMessages);
    
    // RSS מובנה ב-HTML - מציג RSS דוגמה!
    console.log('📺 RSS מובנה ב-HTML - מציג RSS דוגמה!');
    const demoRssItems = [
        { title: 'ברוכים הבאים למערכת Digitlex', description: 'מערכת דיגיטלית מתקדמת לניהול מסכים' },
        { title: 'חדשות נגללות בזמן אמת', description: 'עדכונים מתמידים ללא הפסקה' },
        { title: 'ממשק משתמש מתקדם', description: 'עיצוב מודרני ונוח לשימוש' }
    ];
    populateRssTicker(demoRssItems);
    
    // תוכן דוגמה - נציג תוכן ממש במקום הודעת "אין תוכן"
    const demoContent = [
        { 
            type: 'code', 
            content: '<h1 style="color: #ffd700; text-align: center; font-size: 3em;">🖥️ Digitlex</h1><p style="text-align: center; font-size: 1.5em; margin-top: 20px;">ברוכים הבאים למערכת הניהול הדיגיטלית</p>', 
            is_active: true,
            display_duration: 5000,
            title: 'ברכה'
        },
        { 
            type: 'code', 
            content: '<div style="text-align: center;"><h2 style="color: #ffd700; font-size: 2.5em;">📊 סטטיסטיקות</h2><div style="display: flex; justify-content: space-around; margin-top: 30px;"><div style="background: rgba(255,215,0,0.1); padding: 20px; border-radius: 15px; border: 2px solid #ffd700;"><h3>100+</h3><p>לקוחות מרוצים</p></div><div style="background: rgba(255,215,0,0.1); padding: 20px; border-radius: 15px; border: 2px solid #ffd700;"><h3>24/7</h3><p>זמינות</p></div></div></div>', 
            is_active: true,
            display_duration: 7000,
            title: 'סטטיסטיקות'
        },
        { 
            type: 'code', 
            content: '<div style="text-align: center;"><h2 style="color: #ffd700; font-size: 2.5em;">⏰ השעה הנוכחית</h2><div style="font-size: 4em; color: #fff; margin: 20px 0; font-family: monospace;" id="liveClock"></div><p style="font-size: 1.2em;">מעודכן בזמן אמת</p></div><script>function updateClock(){const now = new Date(); document.getElementById("liveClock").textContent = now.toLocaleTimeString("he-IL");} setInterval(updateClock, 1000); updateClock();</script>', 
            is_active: true,
            display_duration: 6000,
            title: 'שעון חי'
        }
    ];
    displayContent(demoContent);
}

// הצגת נתונים (ללא RSS - RSS מובנה ב-HTML!)
function displayData(data) {
    if (!data) {
        // נתוני דוגמה אם אין נתונים
        console.log('אין נתונים - מציג נתוני דוגמה');
        displayDemoData();
        return;
    }
    
    // עדכון כותרת מסך ולוגו
    if (data.screenData) {
        screenTitle.textContent = data.screenData.name || 'Digitlex';
        
        // הצגת לוגו אם קיים
        if (data.screenData.logo_url) {
            logoArea.innerHTML = `<img src="${data.screenData.logo_url}" alt="לוגו" style="max-height: 60px; max-width: 200px; object-fit: contain;">`;
        } else {
            logoArea.innerHTML = '<span>מקום ללוגו</span>';
        }
    }
    
    // הצגת תוכן
    if (data.content && data.content.length > 0) {
        displayContent(data.content);
    } else {
        showDemoContent();
    }
    
    // RSS מובנה ב-HTML - מעדכן עם תוכן מהשרת!
    if (data.rssContent && data.rssContent.length > 0) {
        console.log(`📡 יש RSS מהשרת: ${data.rssContent.length} פריטים - מעדכן RSS מובנה ב-HTML!`);
        populateRssTicker(data.rssContent);
    } else {
        console.log('📺 אין RSS מהשרת - משאיר RSS דוגמה מובנה ב-HTML');
    }
    
    // הצגת הודעות רצות בצד
    if (data.messages && data.messages.length > 0) {
        console.log('מציג הודעות:', data.messages);
        displayRunningMessagesSidebar(data.messages);
    } else {
        console.log('אין הודעות - מציג הודעות דוגמה');
        // הצגת הודעות דוגמה
        const demoMessages = [
            { content: 'ברוכים הבאים למסך הדיגיטלי!', is_active: true, speed: 30 },
            { content: 'זהו מסך ניסיון עם הודעות רצות', is_active: true, speed: 30 }
        ];
        displayRunningMessagesSidebar(demoMessages);
    }
}

// הצגת תוכן מרכזי
function displayContent(content) {
    console.log('displayContent called with:', content);
    contentContainer.innerHTML = '';
    
    if (!content || content.length === 0) {
        console.log('No content provided');
        showNoContentMessage();
        return;
    }
    
    const activeContent = content.filter(item => item.is_active);
    console.log('Active content items:', activeContent.length);
    
    if (activeContent.length === 0) {
        console.log('No active content found');
        showNoContentMessage();
        return;
    }
    
    activeContent.forEach((item, index) => {
        console.log(`Processing content item ${index}:`, item);
        const contentDiv = document.createElement('div');
        contentDiv.className = 'content-item';
        if (index === 0) contentDiv.classList.add('active');
        
        switch (item.type) {
            case 'image':
            case 'ad':
                console.log('Processing image/ad:', item.local_path || item.file_path);
                if (item.local_path || item.file_path) {
                    const img = document.createElement('img');
                    img.src = `file://${item.local_path || item.file_path}`;
                    img.alt = item.title || (item.type === 'ad' ? 'פירסומת' : 'תמונה');
                                         img.onerror = async (e) => {
                         console.error('Image/ad failed to load:', img.src);
                         console.error('Error details:', e);
                         console.error('Item details:', item);
                         
                         // ניסיון טעינה מהשרת ישירות אם הקובץ המקומי נכשל
                         if (item.file_path && !img.src.includes('localhost:3001')) {
                             // קבלת כתובת השרת הנכונה
                             const serverUrl = await window.electronAPI?.getServerUrl?.() || 'http://localhost:3001';
                             const newSrc = `${serverUrl}${item.file_path}`;
                             console.log('Trying to load from server:', newSrc);
                             img.src = newSrc;
                         } else {
                             contentDiv.innerHTML = '<div class="loading">שגיאה בטעינת ' + (item.type === 'ad' ? 'פירסומת' : 'תמונה') + ' - ' + (item.file_path || 'אין נתיב קובץ') + '</div>';
                         }
                     };
                    img.onload = () => {
                        console.log('Image/ad loaded successfully:', img.src);
                    };
                    contentDiv.appendChild(img);
                } else {
                    console.log('No image/ad path provided');
                    contentDiv.innerHTML = '<div class="loading">' + (item.type === 'ad' ? 'פירסומת' : 'תמונה') + ' לא זמינה</div>';
                }
                break;
                
            case 'video':
                console.log('Processing video:', item.local_path || item.file_path);
                if (item.local_path || item.file_path) {
                    const video = document.createElement('video');
                    video.src = `file://${item.local_path || item.file_path}`;
                    video.autoplay = false; // לא להפעיל מראש
                    video.muted = true;
                    video.loop = true;
                    video.controls = false;
                    video.preload = 'metadata';
                    video.onerror = () => {
                        console.error('Video failed to load:', video.src);
                        contentDiv.innerHTML = '<div class="loading">שגיאה בטעינת וידאו</div>';
                    };
                    video.onloadstart = () => {
                        console.log('Video started loading (metadata):', video.src);
                    };
                    // הפעלה רק כשהפריט הופך ל-active
                    const observer = new MutationObserver(() => {
                        const isActive = contentDiv.classList.contains('active');
                        if (isActive) {
                            if (video.paused) {
                                video.play().catch(err => console.warn('Video play blocked:', err));
                            }
                        } else {
                            if (!video.paused) {
                                video.pause();
                                video.currentTime = 0;
                            }
                        }
                    });
                    observer.observe(contentDiv, { attributes: true, attributeFilter: ['class'] });
                    contentDiv.appendChild(video);
                } else {
                    console.log('No video path provided');
                    contentDiv.innerHTML = '<div class="loading">וידאו לא זמין</div>';
                }
                break;
                
            case 'code':
                console.log('Processing custom code content');
                const customDiv = document.createElement('div');
                customDiv.className = 'custom-content';
                customDiv.innerHTML = item.content || '<p>תוכן מותאם אישית</p>';
                
                // הוספת CSS מותאם אישית אם קיים
                if (item.css) {
                    const style = document.createElement('style');
                    style.textContent = item.css;
                    document.head.appendChild(style);
                }
                
                contentDiv.appendChild(customDiv);
                break;
                
            default:
                console.log('Processing default content type:', item.type);
                const defaultDiv = document.createElement('div');
                defaultDiv.className = 'custom-content';
                defaultDiv.innerHTML = `<h2>${item.title || 'תוכן'}</h2><p>${item.content || ''}</p>`;
                contentDiv.appendChild(defaultDiv);
        }
        
        contentContainer.appendChild(contentDiv);
    });
    
    console.log(`Added ${activeContent.length} content items to container`);
    
    // הפעלת רוטציה אם יש יותר מפריט אחד
    if (activeContent.length > 1) {
        console.log('Starting content rotation');
        startContentRotation(activeContent);
    } else {
        console.log('Single content item - no rotation needed');
    }
}

// הפעלת רוטציה של תוכן
function startContentRotation(content) {
    if (contentRotationInterval) {
        clearInterval(contentRotationInterval);
    }
    
    currentContentIndex = 0;
    
    // פונקציה לסיבוב תוכן שמכבדת את זמן הצגה הפרטני של כל פריט
    function rotateToNext() {
        const currentItem = contentContainer.children[currentContentIndex];
        if (currentItem) {
            currentItem.classList.remove('active');
        }
        
        currentContentIndex = (currentContentIndex + 1) % content.length;
        
        const nextItem = contentContainer.children[currentContentIndex];
        if (nextItem) {
            nextItem.classList.add('active');
        }
        
        // קביעת זמן הצגה לפריט הנוכחי - בשניות או במילישניות
        let currentDisplayDuration = content[currentContentIndex]?.display_duration || 5000;
        
        // אם הזמן קטן מ-100, אז זה כנראה בשניות ולא במילישניות
        if (currentDisplayDuration < 100) {
            currentDisplayDuration = currentDisplayDuration * 1000;
        }
        
        console.log(`⏱️ מציג פריט ${currentContentIndex}, זמן הצגה: ${currentDisplayDuration}ms (${currentDisplayDuration/1000}s)`);
        
        // קביעת timeout חדש עם זמן הצגה של הפריט הנוכחי
        clearTimeout(contentRotationInterval);
        contentRotationInterval = setTimeout(rotateToNext, currentDisplayDuration);
    }
    
    // הפעלת הפריט הראשון מיד
    const firstItem = contentContainer.children[0];
    if (firstItem) {
        firstItem.classList.add('active');
    }
    
    // אם יש יותר מפריט אחד, התחל סיבוב
    if (content.length > 1) {
        let firstDisplayDuration = content[0]?.display_duration || 5000;
        
        // אם הזמן קטן מ-100, אז זה כנראה בשניות ולא במילישניות
        if (firstDisplayDuration < 100) {
            firstDisplayDuration = firstDisplayDuration * 1000;
        }
        
        console.log(`⏱️ מציג פריט ראשון, זמן הצגה: ${firstDisplayDuration}ms (${firstDisplayDuration/1000}s)`);
        contentRotationInterval = setTimeout(rotateToNext, firstDisplayDuration);
    }
}

// הצגת RSS בפורמט רץ למטה עם לולאה אינסופית - לא צריך כי RSS מובנה ב-HTML!
function displayRSSTickerContent(rssContent) {
    console.log('📺 RSS מובנה ב-HTML - לא צריך displayRSSTickerContent!');
    // ה-RSS המובנה ב-HTML עובד נהדר - לא נשנה אותו!
}

// פונקציה חדשה - עדכון RSS מובנה ב-HTML עם תוכן מהשרת
function populateRssTicker(rssItems, direction = 'rtl') {
    if (!rssItems || rssItems.length === 0) {
        console.log('📺 אין RSS מהשרת - משאיר RSS דוגמה מובנה ב-HTML');
        return;
    }
    
    console.log(`📡 מעדכן RSS מובנה ב-HTML עם ${rssItems.length} פריטים מהשרת`);
    
    // ניקוי RSS הקיים
    if (rssTickerContent) {
    rssTickerContent.innerHTML = '';

        const makeItem = (item) => {
            const rssItem = document.createElement('div');
            rssItem.className = 'rss-ticker-item';
            rssItem.style.cssText = `
                margin-left: 60px !important;
                padding: 8px 15px !important;
                background: rgba(255, 215, 0, 0.1) !important;
                border-radius: 8px !important;
                border: 1px solid #ffd700 !important;
                white-space: nowrap !important;
                flex-shrink: 0 !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                max-height: 60px !important;
                font-size: 0.95em !important;
                line-height: 1.2 !important;
            `;
            const title = item.title || 'חדשות';
            const description = item.description || item.content || '';
            if (rssShowTitleOnly) {
                rssItem.innerHTML = `<div style="font-weight: bold !important;">📰 ${title}</div>`;
            } else {
                rssItem.innerHTML = `
                    <div style="font-weight: bold !important; margin-bottom: 2px !important;">📰 ${title}</div>
                    <div style="font-size: 0.8em !important; opacity: 0.9 !important;">${description}</div>
                `;
            }
            return rssItem;
        };

        // הוספת פריטי RSS חדשים מהשרת לפי סדר (ראשונות->אחרונות)
        const ordered = direction === 'ltr' ? [...rssItems] : [...rssItems].reverse();
        ordered.forEach((item) => rssTickerContent.appendChild(makeItem(item)));
        // שכפול התוכן ללולאה אינסופית רציפה
        ordered.forEach((item) => rssTickerContent.appendChild(makeItem(item)));
        
        // שמירת כיוון ו-cache
        currentRssDirection = direction;
        currentRssItemsCache = rssItems;

        // חישוב משך לפי אורך הטיקר בפיקסלים לקריאות טובה לפי רזולוציה
        try {
            const viewportWidth = rssBottom?.clientWidth || document.documentElement.clientWidth || window.innerWidth || 1920;
            // כפילות פריטים כבר קיימת – למדוד אחרי הוספה כדי לקבל רוחב אמיתי
            let contentWidth = rssTickerContent.scrollWidth || (viewportWidth * 2);
        // אם לא נמדד עדיין (early), נסה למדוד שוב אחרי פריים
        if (!contentWidth || contentWidth <= 0) {
            requestAnimationFrame(() => {
                    const vw = rssBottom?.clientWidth || document.documentElement.clientWidth || window.innerWidth || 1920;
                    const cw = rssTickerContent.scrollWidth || (vw * 2);
                    // עדכון משתנים גלובליים לתחילת ריצה מדויקת
                    rssTickerPosPx = direction === 'ltr' ? -cw : vw;
            });
        }
            // אם אין רוחב (display:none/חסר), ודא שהאלמנט גלוי לחישוב
            if (!contentWidth || contentWidth <= 0) {
                rssBottom.style.display = 'block';
                rssTickerContent.style.display = 'flex';
                contentWidth = rssTickerContent.scrollWidth || (viewportWidth * 2);
            }
            const distancePx = contentWidth + viewportWidth; // כניסה מהצד עד יציאה מהצד השני
            // מהירות מותאמת לפי רוחב: מסכים רחבים יותר = px/s מעט גבוה יותר
            const basePps = 12;
            rssPixelsPerSecond = Math.round(basePps * Math.min(1.6, Math.max(1.0, viewportWidth / 1920)));
            const durationSeconds = Math.max(60, Math.round(distancePx / rssPixelsPerSecond));
            // הפעלה נקייה של האנימציה (איפוס + הפעלה מחדש) למניעת מצבי קצה
            rssTickerContent.style.animation = 'none';
            // טריק לרענן חישובי layout כדי לאתחל את האנימציה
            // eslint-disable-next-line no-unused-expressions
            rssTickerContent.offsetWidth;
            const animName = direction === 'ltr' ? 'scroll-ltr' : 'scroll-rtl';
            rssTickerContent.style.animation = `${animName} ${durationSeconds}s linear infinite`;
            console.log(`🕒 RSS dynamic duration set to ${durationSeconds}s (${animName}) distance=${distancePx}px, pps=${rssPixelsPerSecond}, vw=${viewportWidth}`);
        } catch (e) {
            // גיבוי אם משהו נכשל
            const animName = direction === 'ltr' ? 'scroll-ltr' : 'scroll-rtl';
            rssTickerContent.style.animation = `${animName} 120s linear infinite`;
            console.log('🕒 RSS fallback duration set to 120s');
        }

        console.log('✅ RSS מובנה ב-HTML עודכן עם תוכן מהשרת (לולאה אינסופית)');
    } else {
        console.error('❌ לא נמצא אלמנט rssTickerContent');
    }
}

// פונקציות RSS - לא צריך כי RSS מובנה ב-HTML!
function getCurrentRSSContent() {
    console.log('📺 RSS מובנה ב-HTML - לא צריך getCurrentRSSContent!');
    return [];
}

function isRSSContentEqual(content1, content2) {
    console.log('📺 RSS מובנה ב-HTML - לא צריך isRSSContentEqual!');
    return true;
}

function updateRSSContentSmoothly(newItems) {
    console.log('📺 RSS מובנה ב-HTML - לא צריך updateRSSContentSmoothly!');
    // ה-RSS המובנה ב-HTML עובד נהדר - לא נשנה אותו!
}

// פונקציה להפעלת אנימציה אינסופית ל-RSS - לא צריך כי RSS מובנה ב-HTML!
function startInfiniteRSSAnimation() {
    console.log('📺 RSS מובנה ב-HTML - לא צריך אנימציה נוספת!');
    // ה-RSS המובנה ב-HTML עובד נהדר עם האנימציה שלו!
}

// פונקציה להצגת RSS מיד ללא בדיקות - לא צריך כי RSS מובנה ב-HTML!
function forceDisplayRSS(rssContent) {
    console.log('📺 RSS מובנה ב-HTML - לא צריך forceDisplayRSS!');
    // ה-RSS המובנה ב-HTML עובד נהדר - לא נשנה אותו!
}

// הצגת הודעות רצות בצד
function displayRunningMessagesSidebar(messages) {
    console.log('displayRunningMessagesSidebar called with:', messages);
    
    const activeMessages = messages.filter(msg => msg.is_active);
    console.log('Active messages:', activeMessages);
    
    if (activeMessages.length === 0) {
        console.log('No active messages - hiding sidebar');
        hideRunningMessagesSidebar();
        return;
    }
    
    // יצירת טקסט מכל ההודעות עם שורה ריקה בין הודעות
    const allMessages = activeMessages.map(msg => (msg.content || '').trim()).join('\n\n');
    console.log('Combined messages text:', allMessages);
    
    if (messageScroller) {
        messageScroller.textContent = allMessages;
        
        // לולאה אינסופית חלקה ב-RAF (מניעת כפילות/קפיצות)
        const base = activeMessages[0]?.speed || 25;
        const speed = Math.max(5, base - 10); // להאיץ בעוד 10 שניות

        // מדידת גובה תוכן והוספת ריווח בין הודעות
        messageScroller.style.transform = 'translateY(0)';
        const withSpacing = allMessages.replace(/\n\n/g, "\n\n\n");
        messageScroller.textContent = withSpacing;
        // ודא מדידה נכונה של קונטיינר התוכן הצדדי
        const messagesContainer = document.querySelector('#runningMessagesSidebar .running-messages-content') || runningMessagesSidebar;
        const viewportHeight = messagesContainer.clientHeight || runningMessagesSidebar.clientHeight || 400;
        const contentHeight = messageScroller.scrollHeight || viewportHeight * 2;
        const pixelsPerSecond = Math.max(40, Math.round((contentHeight + viewportHeight) / speed));
        // איפוס מצב
        if (messagesRafId) cancelAnimationFrame(messagesRafId);
        messagesLastTs = null;
        messagesPosPx = viewportHeight;
        
        const step = (ts) => {
            if (messagesLastTs == null) messagesLastTs = ts;
            const dt = (ts - messagesLastTs) / 1000;
            messagesLastTs = ts;
            messagesPosPx -= pixelsPerSecond * dt;
            // כשעבר לגמרי למעלה, חוזרים להתחלה (מתחת)
            if (messagesPosPx <= -contentHeight) {
                // כניסה מחדש מתחת לתחתית הקונטיינר
                messagesPosPx = viewportHeight;
            }
            messageScroller.style.transform = `translateY(${messagesPosPx}px)`;
            messagesRafId = requestAnimationFrame(step);
        };
        messagesRafId = requestAnimationFrame(step);
        console.log('Messages RAF loop started at', { pixelsPerSecond, viewportHeight, contentHeight });
    } else {
        console.error('messageScroller element not found');
    }
    
    // הצגת הודעות רצות
    if (runningMessagesSidebar) {
        runningMessagesSidebar.style.display = 'flex';
        console.log('Running messages sidebar shown');
    } else {
        console.error('runningMessagesSidebar element not found');
    }
}

// הסתרת הודעות רצות בצד
function hideRunningMessagesSidebar() {
    console.log('hideRunningMessagesSidebar called');
    if (runningMessagesSidebar) {
        runningMessagesSidebar.style.display = 'none';
        console.log('Running messages sidebar hidden');
    } else {
        console.error('runningMessagesSidebar element not found in hide function');
    }
}

// הפעלת עדכוני זמן
function startTimeUpdates() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// עדכון תאריך ושעה
function updateDateTime() {
    const now = new Date();
    
    // שעה
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    const timeString = now.toLocaleTimeString('he-IL', timeOptions);
    
    // תאריך לועזי בפורמט DD/MM/YYYY
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const shortDate = `${day}/${month}/${year}`;
    
    // יום בשבוע בעברית
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayName = 'יום ' + dayNames[now.getDay()];
    
    // עדכון הDOM - אלמנטים ישנים (למקרה של תאימות לאחור)
    currentTime.textContent = timeString;
    currentDate.textContent = shortDate;
    
    const dayNameElement = document.getElementById('dayName');
    if (dayNameElement) {
        dayNameElement.textContent = dayName;
    }
    
    // עדכון אלמנטים חדשים - שורה אחת
    const currentTimeSingle = document.getElementById('currentTimeSingle');
    const currentDateSingle = document.getElementById('currentDateSingle');
    
    if (currentTimeSingle) {
        currentTimeSingle.textContent = timeString;
    }
    if (currentDateSingle) {
        currentDateSingle.textContent = shortDate;
    }
}



// הצגת הודעות שגיאה וסטטוס
function showNoDataMessage() {
    contentContainer.innerHTML = '<div class="loading">אין נתונים זמינים</div>';
}

function showNoContentMessage() {
    contentContainer.innerHTML = '<div class="loading">אין תוכן זמין להצגה</div>';
}

// הצגת תוכן דוגמה (כאשר אין תוכן מהשרת)
function showDemoContent() {
    console.log('📺 מציג תוכן דוגמה כי RSS מובנה ב-HTML עובד נהדר!');
    
    // RSS דוגמה
    const demoRssItems = [
        { title: 'ברוכים הבאים למערכת Digitlex', description: 'מערכת דיגיטלית מתקדמת לניהול מסכים' },
        { title: 'חדשות נגללות בזמן אמת', description: 'עדכונים מתמידים ללא הפסקה' },
        { title: 'ממשק משתמש מתקדם', description: 'עיצוב מודרני ונוח לשימוש' }
    ];
    populateRssTicker(demoRssItems);
    
    // תוכן דוגמה - נציג תוכן ממש במקום הודעת "אין תוכן"
    const demoContent = [
        { 
            type: 'code', 
            content: '<h1 style="color: #ffd700; text-align: center; font-size: 3em;">🖥️ Digitlex</h1><p style="text-align: center; font-size: 1.5em; margin-top: 20px;">ברוכים הבאים למערכת הניהול הדיגיטלית</p>', 
            is_active: true,
            display_duration: 5000,
            title: 'ברכה'
        },
        { 
            type: 'code', 
            content: '<div style="text-align: center;"><h2 style="color: #ffd700; font-size: 2.5em;">📊 סטטיסטיקות</h2><div style="display: flex; justify-content: space-around; margin-top: 30px;"><div style="background: rgba(255,215,0,0.1); padding: 20px; border-radius: 15px; border: 2px solid #ffd700;"><h3>100+</h3><p>לקוחות מרוצים</p></div><div style="background: rgba(255,215,0,0.1); padding: 20px; border-radius: 15px; border: 2px solid #ffd700;"><h3>24/7</h3><p>זמינות</p></div></div></div>', 
            is_active: true,
            display_duration: 7000,
            title: 'סטטיסטיקות'
        },
        { 
            type: 'code', 
            content: '<div style="text-align: center;"><h2 style="color: #ffd700; font-size: 2.5em;">⏰ השעה הנוכחית</h2><div style="font-size: 4em; color: #fff; margin: 20px 0; font-family: monospace;" id="liveClock"></div><p style="font-size: 1.2em;">מעודכן בזמן אמת</p></div><script>function updateClock(){const now = new Date(); document.getElementById("liveClock").textContent = now.toLocaleTimeString("he-IL");} setInterval(updateClock, 1000); updateClock();</script>', 
            is_active: true,
            display_duration: 6000,
            title: 'שעון חי'
        }
    ];
    displayContent(demoContent);
}

function showNoRSSMessage() {
    console.log('📺 RSS מובנה ב-HTML - לא צריך showNoRSSMessage!');
    // ה-RSS המובנה ב-HTML עובד נהדר - לא נשנה אותו!
}

function showErrorMessage(message) {
    contentContainer.innerHTML = `<div class="loading">שגיאה: ${message}</div>`;
}

// עדכון חלקי חכם - מעדכן רק את החלקים שהשתנו
function updateDataSelectively(oldData, newData) {
    // בדיקת שינויי תוכן
    if (!oldData || JSON.stringify(oldData.content) !== JSON.stringify(newData.content)) {
        console.log('🎬 מעדכן תוכן...');
        if (newData.content && newData.content.length > 0) {
            displayContent(newData.content);
        } else {
            showNoContentMessage();
        }
    }
    
    // בדיקת שינויי RSS - מעדכן RSS מובנה ב-HTML!
    if (!oldData || JSON.stringify(oldData.rssContent) !== JSON.stringify(newData.rssContent)) {
        console.log('📡 RSS השתנה - מעדכן RSS מובנה ב-HTML!');
        if (newData.rssContent && newData.rssContent.length > 0) {
            populateRssTicker(newData.rssContent);
        }
    }
    
    // בדיקת שינויי הודעות
    if (!oldData || JSON.stringify(oldData.messages) !== JSON.stringify(newData.messages)) {
        console.log('📝 מעדכן הודעות...');
        if (newData.messages && newData.messages.length > 0) {
            displayRunningMessagesSidebar(newData.messages);
        }
    }
    
    // בדיקת שינויי כותרת ולוגו
    if (!oldData || 
        oldData.screenData?.name !== newData.screenData?.name ||
        oldData.screenData?.logo_url !== newData.screenData?.logo_url) {
        console.log('🏷️ מעדכן כותרת ולוגו...');
        
        if (newData.screenData) {
            if (newData.screenData.name !== screenTitle.textContent) {
                screenTitle.textContent = newData.screenData.name || 'Digitlex';
            }
            
            // עדכון לוגו רק אם השתנה
            if (oldData?.screenData?.logo_url !== newData.screenData?.logo_url) {
                if (newData.screenData.logo_url) {
                    logoArea.innerHTML = `<img src="${newData.screenData.logo_url}" alt="לוגו" style="max-height: 60px; max-width: 200px; object-fit: contain;">`;
                } else {
                    logoArea.innerHTML = '<span>מקום ללוגו</span>';
                }
            }
        }
    }
    
    console.log('✅ עדכון חלקי הושלם - RSS ופירסומות ממשיכים ללא הפרעה');
}

// אירועי IPC מהתהליך הראשי - עדכון חכם בלי רענון מלא
ipcRenderer.on('data-updated', (event, data) => {
    console.log('📢 קיבלתי עדכון נתונים מהשרת');
    
    // בדיקה אם יש שינויים אמיתיים שדורשים עדכון - כולל RSS!
    const hasRealChanges = !localData || 
        JSON.stringify(localData.content) !== JSON.stringify(data.content) ||
        JSON.stringify(localData.rssContent) !== JSON.stringify(data.rssContent) ||
        JSON.stringify(localData.messages) !== JSON.stringify(data.messages) ||
        (localData.screenData?.name !== data.screenData?.name) ||
        (localData.screenData?.logo_url !== data.screenData?.logo_url);
    
    if (hasRealChanges) {
        console.log('🔄 יש שינויים אמיתיים - מעדכן חלקית...');
        const oldLocalData = localData;
    localData = data;
        
        // עדכון חלקי חכם
        updateDataSelectively(oldLocalData, data);
    } else {
        console.log('✅ אין שינויים - שומר על המצב הנוכחי (RSS ממשיך לרוץ)');
        // עדכון רק timestamp
        if (localData) {
            localData.lastSync = data.lastSync;
        }
    }
});

ipcRenderer.on('connection-status', (event, status) => {
    updateConnectionStatus(status);
});

ipcRenderer.on('request-screen-id', () => {
    showSetupScreen();
});

// פונקציית יציאה
function exitApp() {
    console.log('exitApp called');
    if (confirm('האם אתה בטוח שברצונך לצאת?')) {
        console.log('User confirmed exit');
        try {
            ipcRenderer.invoke('quit-app').then(() => {
                console.log('quit-app IPC sent successfully');
            }).catch(error => {
                console.error('Error sending quit-app IPC:', error);
                // fallback - יציאה ישירה
                window.close();
            });
        } catch (error) {
            console.error('Error in exitApp:', error);
            window.close();
        }
    }
}

// פונקציות גלובליות לשימוש בHTML
window.saveScreenId = saveScreenId;
window.testConnection = testConnection;
window.exitApp = exitApp;

// הגדרת API לחיבור עם Electron
window.electronAPI = {
    getServerUrl: () => ipcRenderer.invoke('get-server-url'),
    setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
    getScreenId: () => ipcRenderer.invoke('get-screen-id'),
    setScreenId: (id) => ipcRenderer.invoke('set-screen-id', id)
};

// מניעת תפריט הקשר ימני
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// מניעת פתיחת DevTools
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
    }
});

// אתחול כשהדף נטען
document.addEventListener('DOMContentLoaded', initializeApp);

// סיפור נתונים בעת סגירה
window.addEventListener('beforeunload', () => {
    if (contentRotationInterval) {
        clearInterval(contentRotationInterval);
    }
    // rssRotationInterval לא קיים כי RSS מובנה ב-HTML!
    // if (rssRotationInterval) {
    //     clearInterval(rssRotationInterval);
    // }
    if (cursorHideTimeout) {
        clearTimeout(cursorHideTimeout);
    }
});

console.log('🖥️ אפליקציית Digitlex מוכנה!'); 