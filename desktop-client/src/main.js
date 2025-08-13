const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

// הגדרות axios לביצועים מהירים יותר
axios.defaults.timeout = 10000;
axios.defaults.headers.common['Keep-Alive'] = 'timeout=5, max=1000';
axios.defaults.headers.common['Connection'] = 'keep-alive';
const Store = require('electron-store');
const cron = require('node-cron');
const { autoUpdater } = require('electron-updater');

// הגדרות אפליקציה
const isDev = process.env.NODE_ENV === 'development';

// אחסון מקומי
const store = new Store();

// קבלת כתובת שרת מהאחסון או ברירת מחדל
function getServerUrl() {
  return store.get('serverUrl') || process.env.SERVER_URL || 'https://screnn.onrender.com';
}

// עדכון כתובת שרת
function setServerUrl(url) {
  store.set('serverUrl', url);
  console.log(`🌐 כתובת שרת עודכנה: ${url}`);
}

// משתנה דינמי לכתובת שרת
let serverUrl = getServerUrl();

// תיקון בעיות GPU
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('disable-software-rasterizer');

// נתיבי קבצים מקומיים
const userDataPath = app.getPath('userData');
const mediaPath = path.join(userDataPath, 'media');
const dataPath = path.join(userDataPath, 'data');

// יצירת תיקיות אם לא קיימות
fs.ensureDirSync(mediaPath);
fs.ensureDirSync(dataPath);

let mainWindow;
let isOnline = false;
let screenId = null;
let syncInterval;

function createWindow() {
  // יצירת החלון הראשי
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    title: 'מסכים דיגיטליים',
    backgroundColor: '#000000',
    skipTaskbar: !isDev,
    alwaysOnTop: !isDev
  });

  // פותח את כלי המפתחים אוטומטית
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  // טעינת הממשק
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // הצגת החלון כשהוא מוכן
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // הסתרת תפריט וכלי עזר
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setAutoHideMenuBar(true);
    
    if (!isDev) {
      mainWindow.setFullScreen(true);
      mainWindow.setAlwaysOnTop(true);
    }
    
    console.log('Window ready and configured');
  });

  // מניעת סגירה בטעות - רק במצב פרודקשן
  mainWindow.on('close', (event) => {
    console.log('Window close event triggered');
    if (!isDev) {
      event.preventDefault();
      dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['ביטול', 'יציאה'],
        defaultId: 0,
        title: 'יציאה מהאפליקציה',
        message: 'האם אתה בטוח שברצונך לצאת מהאפליקציה?',
        detail: 'המסך הדיגיטלי יפסיק לעבוד.'
      }).then((result) => {
        if (result.response === 1) {
          console.log('User confirmed exit from close dialog');
          mainWindow.destroy();
          app.quit();
        }
      });
    } else {
      // במצב פיתוח - סגירה מיידית
      console.log('Development mode - allowing direct close');
      mainWindow.destroy();
      app.quit();
    }
  });

  // פתיחת קישורים חיצוניים בדפדפן
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // הוספת מקשי קיצור ליציאה
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // ESC ליציאה
    if (input.key === 'Escape') {
      console.log('ESC pressed - quitting app');
      mainWindow.destroy();
      app.quit();
      process.exit(0);
    }
    // Ctrl+Q ליציאה
    if (input.control && input.key === 'q') {
      console.log('Ctrl+Q pressed - quitting app');
      mainWindow.destroy();
      app.quit();
      process.exit(0);
    }
    // Alt+F4 ליציאה (Windows)
    if (input.alt && input.key === 'F4') {
      console.log('Alt+F4 pressed - quitting app');
      mainWindow.destroy();
      app.quit();
      process.exit(0);
    }
    // F11 למעבר בין fullscreen
    if (input.key === 'F11' && isDev) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// בדיקת חיבור לשרת
async function checkServerConnection() {
  console.log('🌐 בודק חיבור לשרת:', serverUrl);
  try {
    const response = await axios.get(`${serverUrl}/api/health`, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'DigitalSignage-Desktop/1.0',
        'Accept': 'application/json'
      }
    });
    console.log('✅ חיבור לשרת תקין:', response.data);
    isOnline = true;
    return true;
  } catch (error) {
    console.log('❌ חיבור לשרת נכשל:', error.message);
    if (error.response) {
      console.log('📊 פרטי שגיאה:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    isOnline = false;
    return false;
  }
}

// הורדת קבצי מדיה
async function downloadMediaFile(fileUrl, fileName) {
  try {
    const filePath = path.join(mediaPath, fileName);
    
    // בדיקה אם הקובץ כבר קיים ותקין
    if (await fs.pathExists(filePath)) {
      const stats = await fs.stat(filePath);
      if (stats.size > 0) {
        console.log(`קובץ ${fileName} כבר קיים מקומית`);
        return filePath;
      } else {
        // קובץ ריק - נמחק ונוריד מחדש
        await fs.remove(filePath);
      }
    }

    console.log(`מוריד קובץ: ${fileName} מ-${serverUrl}${fileUrl}`);
    const response = await axios({
      method: 'GET',
      url: `${serverUrl}${fileUrl}`,
      responseType: 'stream',
      timeout: 30000, // זמן חכייה מהיר יותר
      headers: {
        'Accept': '*/*',
        'User-Agent': 'DigitalSignage/1.0',
        'Cache-Control': 'max-age=3600'
      }
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        try {
          // וידוא שהקובץ נכתב כהלכה
          const stats = await fs.stat(filePath);
          if (stats.size > 0) {
            console.log(`קובץ ${fileName} הורד בהצלחה (${stats.size} bytes)`);
            resolve(filePath);
          } else {
            throw new Error('קובץ ריק');
          }
        } catch (err) {
          reject(new Error(`קובץ לא נכתב כהלכה: ${err.message}`));
        }
      });
      writer.on('error', (err) => {
        console.error(`שגיאה בכתיבת קובץ ${fileName}:`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error(`שגיאה בהורדת קובץ ${fileName}:`, error.message);
    console.error('URL שנוסה:', `${serverUrl}${fileUrl}`);
    return null;
  }
}

// סנכרון נתונים עם השרת
async function syncWithServer() {
  if (!isOnline || !screenId) {
    console.log('לא מחובר או אין מזהה מסך:', { isOnline, screenId });
    return;
  }

  try {
    console.log('מסנכרן נתונים עם השרת...', { screenId, serverUrl });

    // טעינת נתוני מסך (ללא cache)
    console.log('טוען נתוני מסך...');
    const screenResponse = await axios.get(`${serverUrl}/api/screens/${screenId}`, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    const screenData = screenResponse.data;
    console.log('נתוני מסך נטענו:', screenData);

    // טעינת תוכן (ללא cache) - משתמש ב-endpoint ציבורי
    console.log('טוען תוכן...');
    const contentResponse = await axios.get(`${serverUrl}/api/screens/${screenId}/content/public`, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    const content = contentResponse.data;
    console.log('תוכן נטען:', content.length, 'פריטים');

    // טעינת RSS (ללא cache)
    console.log('טוען RSS...');
    const rssResponse = await axios.get(`${serverUrl}/api/screens/${screenId}/rss-content`, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    const rssContent = rssResponse.data;
    console.log('RSS נטען:', rssContent.length, 'פריטים');

    // טעינת הודעות רצות (ללא cache)
    console.log('טוען הודעות...');
    const messagesResponse = await axios.get(`${serverUrl}/api/screens/${screenId}/messages`, {
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
    });
    const messages = messagesResponse.data;
    console.log('הודעות נטענו:', messages.length, 'הודעות');

    // הורדת קבצי מדיה
    for (const item of content) {
              if (item.file_path && (item.type === 'image' || item.type === 'video' || item.type === 'ad')) {
        const fileName = path.basename(item.file_path);
        const localPath = await downloadMediaFile(item.file_path, fileName);
        if (localPath) {
          item.local_path = localPath;
        }
      }
    }

    // שמירת נתונים מקומית
    const localData = {
      screenData,
      content,
      rssContent,
      messages,
      lastSync: new Date().toISOString()
    };

    await fs.writeJson(path.join(dataPath, 'screen-data.json'), localData);
    console.log('נתונים נשמרו מקומית');

    // עדכון ממשק המשתמש
    mainWindow.webContents.send('data-updated', localData);

    // שליחת heartbeat לעדכון סטטוס המסך
    await sendHeartbeat();
    
    console.log('סנכרון הושלם בהצלחה');

  } catch (error) {
    console.error('שגיאה בסנכרון:', error.message);
    console.error('פרטי השגיאה:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method
    });
  }
}

// שליחת heartbeat לעדכון סטטוס המסך
async function sendHeartbeat() {
  console.log('💓 מנסה לשלוח heartbeat:', { isOnline, screenId, serverUrl });
  
  if (!screenId) {
    console.log('❌ אין מזהה מסך, לא שולח heartbeat');
    return;
  }

  try {
    console.log(`📡 שולח heartbeat ל: ${serverUrl}/api/screens/${screenId}/heartbeat`);
    const response = await axios.post(`${serverUrl}/api/screens/${screenId}/heartbeat`, {}, {
      timeout: 5000,
      headers: {
        'User-Agent': 'DigitalSignage-Desktop/1.0',
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Heartbeat נשלח בהצלחה:', response.data);
    
    // אם הצלחנו לשלוח heartbeat, סימן שאנחנו מחוברים
    if (!isOnline) {
      console.log('🔄 חיבור לשרת חזר - מעדכן סטטוס');
      isOnline = true;
      mainWindow.webContents.send('connection-status', true);
    }
  } catch (error) {
    console.error('❌ שגיאה בשליחת heartbeat:', error.message);
    if (error.response) {
      console.error('📊 פרטי השגיאה:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    // אם נכשל heartbeat, סימן שאנחנו לא מחוברים
    if (isOnline) {
      console.log('🔄 חיבור לשרת אבד - מעדכן סטטוס');
      isOnline = false;
      mainWindow.webContents.send('connection-status', false);
    }
  }
}

// טעינת נתונים מקומיים
async function loadLocalData() {
  try {
    const dataFile = path.join(dataPath, 'screen-data.json');
    if (await fs.pathExists(dataFile)) {
      const localData = await fs.readJson(dataFile);
      console.log('נתונים מקומיים נטענו');
      return localData;
    }
  } catch (error) {
    console.error('שגיאה בטעינת נתונים מקומיים:', error);
  }
  return null;
}

// הגדרת מזהה מסך
function setupScreenId() {
  console.log('🔧 מגדיר מזהה מסך...');
  
  // ניסיון לטעון מזהה שמור
  screenId = store.get('screenId');
  console.log('📋 מזהה שמור:', screenId);
  
  if (!screenId) {
    console.log('❌ אין מזהה שמור, מבקש מהמשתמש');
    // בקשת מזהה מהמשתמש
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'הגדרת Digitlex',
      message: 'נא לפתוח את פאנל הניהול ביצירת מסך חדש',
      detail: 'לחץ OK כשאתה מוכן להזין את מזהה המסך'
    }).then(() => {
      console.log('📝 מבקש מזהה מהמשתמש');
      mainWindow.webContents.send('request-screen-id');
    });
  } else {
    console.log(`✅ מזהה מסך נטען: ${screenId}`);
    syncWithServer();
  }
}

// אירועי IPC
ipcMain.handle('set-screen-id', async (event, id) => {
  console.log('📝 IPC: set-screen-id נקרא עם:', id);
  
  screenId = id.trim();
  store.set('screenId', screenId);
  console.log(`✅ מזהה מסך נשמר: ${screenId}`);
  
  // שליחת heartbeat ראשוני
  console.log('💓 שולח heartbeat ראשוני...');
  await sendHeartbeat();
  
  // סנכרון ראשוני מיידי
  console.log('🔄 מתחיל סנכרון ראשוני...');
  await syncWithServer();
  
  // סנכרון נוסף אחרי 5 שניות לוודא שהכל עודכן
  setTimeout(async () => {
    console.log('🔄 סנכרון נוסף אחרי 5 שניות...');
    await syncWithServer();
  }, 5000);
  
  return true;
});

ipcMain.handle('get-local-data', async () => {
  return await loadLocalData();
});

// הוסר: clear-local-data - כדי לא למחוק נתונים מקומיים בלי חיבור

ipcMain.handle('sync-with-server', async () => {
  try {
    await syncWithServer();
    return true;
  } catch (error) {
    console.error('❌ שגיאה בסנכרון עם השרת:', error);
    return false;
  }
});

ipcMain.handle('check-connection', async () => {
  return await checkServerConnection();
});

ipcMain.handle('sync-now', async () => {
  await syncWithServer();
  return true;
});

ipcMain.handle('get-screen-id', () => {
  return screenId;
});

ipcMain.handle('quit-app', () => {
  console.log('quit-app IPC received - closing application');
  if (mainWindow) {
    mainWindow.destroy();
  }
  app.quit();
  return true;
});

ipcMain.handle('get-server-url', () => {
  return serverUrl;
});

ipcMain.handle('set-server-url', (event, url) => {
  setServerUrl(url);
  serverUrl = url; // עדכון המשתנה הנוכחי
  console.log(`🌐 כתובת שרת עודכנה: ${url}`);
  return true;
});

ipcMain.handle('restart-app', () => {
  console.log('🔄 הפעלה מחדש של האפליקציה...');
  app.relaunch();
  app.exit(0);
  return true;
});

// הפעלת האפליקציה
app.whenReady().then(() => {
  // הסתרת תפריט אפליקציה
  if (process.platform === 'darwin') {
    app.dock.hide();
  }
  
  createWindow();

  // בדיקת חיבור ראשונית
  checkServerConnection().then(() => {
    if (isOnline) {
      console.log('מחובר לשרת');
    } else {
      console.log('עובד במצב לא מקוון');
    }
    
    setupScreenId();
    
    // סנכרון מיידי לאחר ההפעלה
    if (isOnline && screenId) {
      setTimeout(() => {
        syncWithServer();
      }, 1000);
    }
  });

  // סנכרון תקופתי חכם (כל 60 שניות) - פחות אגרסיבי
  syncInterval = setInterval(async () => {
    const wasOnline = isOnline;
    await checkServerConnection();
    
    if (isOnline && screenId) {
      if (!wasOnline) {
        console.log('חיבור לשרת חזר - מסנכרן נתונים');
        await syncWithServer();
      } else {
        // סנכרון רגיל - רק אם יש שינויים
        console.log('🔄 בדיקת עדכונים תקופתית...');
        await syncWithServer();
      }
    }
    
    // עדכון סטטוס חיבור
    mainWindow.webContents.send('connection-status', isOnline);
  }, 60 * 1000); // 60 שניות במקום 30

  // בדיקת חיבור כל 15 שניות
  setInterval(checkServerConnection, 15 * 1000);

  // שליחת heartbeat כל 15 שניות
  setInterval(async () => {
    if (screenId) {
      await sendHeartbeat();
    }
  }, 15 * 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// עדכונים אוטומטיים (רק בגרסת production)
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
}

// טיפול בשגיאות
process.on('uncaughtException', (error) => {
  console.error('שגיאה לא צפויה:', error);
  // לא לסגור את האפליקציה בגלל שגיאות GPU
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejection לא מטופל:', reason);
});

// טיפול בשגיאות GPU
app.on('gpu-process-crashed', (event, killed) => {
  console.log('GPU process crashed, killed:', killed);
  // האפליקציה תמשיך לעבוד עם software rendering
});

app.on('renderer-process-crashed', (event, webContents, killed) => {
  console.log('Renderer process crashed, killed:', killed);
  // נסה ליצור מחדש את החלון
  if (mainWindow) {
    mainWindow.reload();
  }
}); 