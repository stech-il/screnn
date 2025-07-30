const { ipcRenderer } = require('electron');
const path = require('path');

// משתני מצב
let localData = null;
let currentContentIndex = 0;
let currentRssIndex = 0;
let contentRotationInterval = null;
let rssRotationInterval = null;
let isOnline = false;
let screenId = null;

// משתני cursor
let cursorHideTimeout = null;
let lastActivity = Date.now();
const CURSOR_HIDE_DELAY = 3000; // 3 שניות

// משתני ניהול
let managementPanelVisible = false;
let currentRssSpeed = 120; // מהירות RSS ב-שניות (שונה מ-60 ל-120 - מהירות איטית)
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
    
    // בדיקת מזהה מסך קיים
    screenId = await ipcRenderer.invoke('get-screen-id');
    
    if (!screenId) {
        showSetupScreen();
        return;
    }

    // טעינת נתונים מקומיים
    await loadData();
    
    // הפעלת עדכון זמן
    startTimeUpdates();
    
    // בדיקת חיבור ראשונית
    await checkConnection();
    
    // אתחול אנימציית RSS עם מהירות איטית
    initializeRssAnimation();
    console.log(`🚀 RSS initialized with speed: ${currentRssSpeed}s (slow speed)`);
    
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

// אתחול אנימציית RSS
function initializeRssAnimation() {
    if (rssTickerContent) {
        // הפעלת אנימציה מיד עם תוכן דוגמה אם אין תוכן RSS
        if (!rssTickerContent.children.length) {
            const demoContent = [
                { title: 'ברוכים הבאים ל-Digitlex', content: 'מסך דיגיטלי מתקדם עם חדשות ועדכונים בזמן אמת...' },
                { title: 'מערכת ניהול מתקדמת', content: 'ניהול תוכן, חדשות והודעות דרך פאנל ניהול מתקדם...' },
                { title: 'עדכונים בזמן אמת', content: 'כל העדכונים מוצגים בזמן אמת ללא צורך ברענון...' }
            ];
            
            const tickerItems = demoContent.map(item => {
                const tickerItem = document.createElement('div');
                tickerItem.className = 'rss-ticker-item';
                
                const title = document.createElement('div');
                title.className = 'rss-ticker-item-title';
                title.textContent = item.title;
                
                const content = document.createElement('div');
                content.className = 'rss-ticker-item-content';
                content.textContent = item.content;
                
                tickerItem.appendChild(title);
                tickerItem.appendChild(content);
                
                return tickerItem;
            });
            
            // יצירת לולאה אינסופית
            const infiniteItems = [...tickerItems, ...tickerItems, ...tickerItems];
            
            rssTickerContent.innerHTML = '';
            infiniteItems.forEach(item => {
                rssTickerContent.appendChild(item.cloneNode(true));
            });
            
            // הצגת RSS
            rssBottom.style.display = 'block';
        }
        
        // הפעלת אנימציה
        rssTickerContent.style.animation = `rssScroll ${currentRssSpeed}s linear infinite`;
        console.log(`🚀 RSS animation initialized with speed: ${currentRssSpeed}s`);
    }
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
            <input type="text" id="managementServerUrl" placeholder="http://127.0.0.1:3001" style="width: 100%; padding: 8px; border: 1px solid #ffd700; background: #333; color: white; border-radius: 5px;">
            <small style="color: #ccc; font-size: 0.8em;">לדוגמה: http://192.168.1.100:3001 או http://localhost:3001</small>
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
        document.getElementById('managementRssSpeed').value = currentRssSpeed;
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
            await ipcRenderer.invoke('save-screen-id', newScreenId);
            screenId = newScreenId;
            console.log(`מזהה מסך עודכן: ${screenId}`);
        }
        
        // עדכון מהירות RSS
        if (newRssSpeed !== currentRssSpeed) {
            currentRssSpeed = newRssSpeed;
            updateRssSpeed();
            console.log(`מהירות RSS עודכנה: ${currentRssSpeed} שניות`);
        }
        
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
        await testConnection();
        showManagementStatus('חיבור תקין!', 'success');
    } catch (error) {
        showManagementStatus('שגיאה בחיבור לשרת', 'error');
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

// עדכון מהירות RSS
function updateRssSpeed() {
    if (rssTickerContent) {
        rssTickerContent.style.animation = `rssScroll ${currentRssSpeed}s linear infinite`;
        console.log(`🔄 RSS speed updated to: ${currentRssSpeed}s`);
    }
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
        
        // טעינת נתונים מקומיים
        const newLocalData = await ipcRenderer.invoke('get-local-data');
        
        console.log('Raw local data received:', newLocalData);
        
        if (newLocalData) {
            console.log('נתונים מקומיים נטענו:');
            console.log('- screenData:', newLocalData.screenData);
            console.log('- content items:', newLocalData.content ? newLocalData.content.length : 0);
            console.log('- content details:', newLocalData.content);
            console.log('- rssContent items:', newLocalData.rssContent ? newLocalData.rssContent.length : 0);
            console.log('- messages items:', newLocalData.messages ? newLocalData.messages.length : 0);
            
            // בדיקה אם הנתונים השתנו
            const hasDataChanged = hasLocalDataChanged(localData, newLocalData);
            
            if (hasDataChanged) {
                console.log('נתונים השתנו - מעדכן תצוגה');
                localData = newLocalData;
                displayData(localData);
            } else {
                console.log('נתונים לא השתנו - לא מעדכן תצוגה');
                localData = newLocalData; // עדכון הנתונים אבל לא התצוגה
            }
        } else {
            console.log('No local data found - using demo data');
            displayDemoData();
        }
        
        loadingMessage.style.display = 'none';
    } catch (error) {
        console.error('שגיאה בטעינת נתונים:', error);
        console.log('Error loading data - falling back to demo data');
        displayDemoData();
        loadingMessage.style.display = 'none';
    }
}

// פונקציה לבדיקה אם הנתונים השתנו
function hasLocalDataChanged(oldData, newData) {
    if (!oldData) return true; // אם אין נתונים קודמים, זה שינוי
    
    // בדיקת שינויים בתוכן
    if (!arraysEqual(oldData.content, newData.content)) return true;
    
    // בדיקת שינויים ב-RSS
    if (!arraysEqual(oldData.rssContent, newData.rssContent)) return true;
    
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
        { content: 'ברוכים הבאים למסך הדיגיטלי!', is_active: true, speed: 25 },
        { content: 'המערכת עובדת במצב הדגמה', is_active: true, speed: 25 }
    ];
    displayRunningMessagesSidebar(demoMessages);
    
    // RSS דוגמה
    const demoRSS = [
        { title: 'חדשות דוגמה', description: 'זהו פריט חדשות לדוגמה' },
        { title: 'עדכון מערכת', description: 'המערכת עובדת תקין' }
    ];
    displayRSSTickerContent(demoRSS);
    
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

// הצגת נתונים
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
        showNoContentMessage();
    }
    
    // הצגת RSS בפורמט רץ
    if (data.rssContent && data.rssContent.length > 0) {
        displayRSSTickerContent(data.rssContent);
    } else {
        showNoRSSMessage();
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
                                         img.onerror = (e) => {
                         console.error('Image/ad failed to load:', img.src);
                         console.error('Error details:', e);
                         console.error('Item details:', item);
                         
                         // ניסיון טעינה מהשרת ישירות אם הקובץ המקומי נכשל
                         if (item.file_path && !img.src.includes('localhost:3001')) {
                             console.log('Trying to load from server:', `http://localhost:3001${item.file_path}`);
                             img.src = `http://localhost:3001${item.file_path}`;
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
                    video.autoplay = true;
                    video.muted = true;
                    video.loop = true;
                    video.controls = false;
                    video.onerror = () => {
                        console.error('Video failed to load:', video.src);
                        contentDiv.innerHTML = '<div class="loading">שגיאה בטעינת וידאו</div>';
                    };
                    video.onloadstart = () => {
                        console.log('Video started loading:', video.src);
                    };
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
    
    contentRotationInterval = setInterval(() => {
        const currentItem = contentContainer.children[currentContentIndex];
        if (currentItem) {
            currentItem.classList.remove('active');
        }
        
        currentContentIndex = (currentContentIndex + 1) % content.length;
        
        const nextItem = contentContainer.children[currentContentIndex];
        if (nextItem) {
            nextItem.classList.add('active');
        }
    }, content[currentContentIndex]?.display_duration || 5000);
}

// הצגת RSS בפורמט רץ למטה עם לולאה אינסופית
function displayRSSTickerContent(rssContent) {
    if (!rssContent || rssContent.length === 0) {
        showNoRSSMessage();
        return;
    }
    
    // יצירת תוכן RSS חדש
    const newContent = rssContent.map(item => {
        const title = item.title || 'כותרת לא זמינה';
        const content = (item.description || item.content || '').substring(0, 100) + '...';
        return { title, content };
    });
    
    // בדיקה אם התוכן השתנה
    const currentContent = getCurrentRSSContent();
    if (isRSSContentEqual(currentContent, newContent)) {
        console.log('תוכן RSS לא השתנה - לא מעדכן');
        return;
    }
    
    console.log('תוכן RSS השתנה - מעדכן...');
    
    // יצירת פריטי RSS עבור הטיקר
    const tickerItems = newContent.map(item => {
        const tickerItem = document.createElement('div');
        tickerItem.className = 'rss-ticker-item';
        
        const title = document.createElement('div');
        title.className = 'rss-ticker-item-title';
        title.textContent = item.title;
        
        const content = document.createElement('div');
        content.className = 'rss-ticker-item-content';
        content.textContent = item.content;
        
        tickerItem.appendChild(title);
        tickerItem.appendChild(content);
        
        return tickerItem;
    });
    
    // יצירת לולאה אינסופית - כפילות הפריטים
    const infiniteItems = [...tickerItems, ...tickerItems, ...tickerItems];
    
    // שמירת המיקום הנוכחי של האנימציה
    const currentTransform = rssTickerContent.style.transform;
    const isCurrentlyVisible = rssBottom.style.display !== 'none';
    
    // הצגת הRSS אם לא היה מוצג קודם
    if (!isCurrentlyVisible) {
        rssBottom.style.display = 'block';
        console.log('🚀 מציג RSS ticker חדש');
    }
    
    // עדכון תוכן הטיקר
    rssTickerContent.innerHTML = '';
    infiniteItems.forEach(item => {
        rssTickerContent.appendChild(item.cloneNode(true));
    });
    
    // הפעלת אנימציה מיד עם המהירות הנוכחית
    startInfiniteRSSAnimation();
}

// פונקציה לקבלת התוכן הנוכחי של RSS
function getCurrentRSSContent() {
    const items = rssTickerContent.querySelectorAll('.rss-ticker-item');
    const content = [];
    
    // לוקח רק את הפריטים הראשונים (ללא הכפילויות)
    const uniqueItems = Math.floor(items.length / 3);
    
    for (let i = 0; i < uniqueItems; i++) {
        const item = items[i];
        const title = item.querySelector('.rss-ticker-item-title')?.textContent || '';
        const contentText = item.querySelector('.rss-ticker-item-content')?.textContent || '';
        content.push({ title, content: contentText });
    }
    
    return content;
}

// פונקציה להשוואת תוכן RSS
function isRSSContentEqual(content1, content2) {
    if (content1.length !== content2.length) return false;
    
    for (let i = 0; i < content1.length; i++) {
        if (content1[i].title !== content2[i].title || 
            content1[i].content !== content2[i].content) {
            return false;
        }
    }
    
    return true;
}

// פונקציה לעדכון חלק של תוכן RSS
function updateRSSContentSmoothly(newItems) {
    // שמירת המיקום הנוכחי
    const currentTransform = rssTickerContent.style.transform;
    
    // עדכון התוכן בצורה חלקה
    rssTickerContent.innerHTML = '';
    newItems.forEach(item => {
        rssTickerContent.appendChild(item.cloneNode(true));
    });
    
    // החזרת המיקום הנוכחי
    if (currentTransform) {
        rssTickerContent.style.transform = currentTransform;
    }
}

// פונקציה להפעלת אנימציה אינסופית ל-RSS
function startInfiniteRSSAnimation() {
    if (rssTickerContent) {
        // הסרת אנימציה קיימת
        rssTickerContent.style.animation = 'none';
        
        // הפעלת אנימציה חדשה מיד
        rssTickerContent.style.animation = `rssScroll ${currentRssSpeed}s linear infinite`;
        
        console.log(`🚀 RSS animation started with speed: ${currentRssSpeed}s (slow speed)`);
    }
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
    
    // יצירת טקסט מכל ההודעות
    const allMessages = activeMessages.map(msg => msg.content).join('\n\n');
    console.log('Combined messages text:', allMessages);
    
    if (messageScroller) {
        messageScroller.textContent = allMessages;
        
        // הגדרת מהירות אנימציה לפי המהירות הראשונה (איטי יותר)
        const speed = activeMessages[0]?.speed || 40;
        messageScroller.style.animationDuration = `${speed}s`;
        console.log('Set animation duration to:', speed + 's');
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

function showNoRSSMessage() {
    rssTickerContent.innerHTML = '<div class="loading">אין חדשות זמינות</div>';
    rssBottom.style.display = 'block';
}

function showErrorMessage(message) {
    contentContainer.innerHTML = `<div class="loading">שגיאה: ${message}</div>`;
}

// אירועי IPC מהתהליך הראשי
ipcRenderer.on('data-updated', (event, data) => {
    console.log('נתונים עודכנו מהשרת');
    localData = data;
    displayData(data);
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
    if (rssRotationInterval) {
        clearInterval(rssRotationInterval);
    }
    if (cursorHideTimeout) {
        clearTimeout(cursorHideTimeout);
    }
});

console.log('🖥️ אפליקציית Digitlex מוכנה!'); 