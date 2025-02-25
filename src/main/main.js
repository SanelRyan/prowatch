const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require('electron')
const path = require('path')
const Store = require('electron-store')
const store = new Store()
const { autoUpdater } = require('electron-updater')
const TimerManager = require('./timerManager')

let mainWindow
let tray
let timerManager

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore()
            }
            mainWindow.show()
            mainWindow.focus()
        }
    })

    app.whenReady().then(() => {
        createWindow()
        createTray()
        checkForUpdates()
    })
}

function createWindow() {
    const startMinimized = store.get('startMinimized') || false;
    
    mainWindow = new BrowserWindow({
        width: 800,
        height: 900,
        minWidth: 640,
        minHeight: 800,
        backgroundColor: '#18181b',
        frame: false,
        show: !startMinimized,
        icon: path.join(__dirname, '../../src/assets/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

    mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.minimize();
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            const notification = new Notification({
                title: 'Prowatch',
                body: 'App is running in system tray. To fully close, right-click the tray icon and select Quit.'
            });
            notification.show();
            mainWindow.webContents.send('show-notification', {
                title: 'Prowatch',
                body: 'App is running in system tray. To fully close, right-click the tray icon and select Quit.'
            });
        }
        return false;
    });

    timerManager = new TimerManager(mainWindow);
}

function createTray() {
    tray = new Tray(path.join(__dirname, '../../src/assets/icon.ico'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show Prowatch',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'Quit',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Prowatch');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
}

function checkForUpdates() {
    autoUpdater.checkForUpdatesAndNotify();

    autoUpdater.on('update-available', () => {
        mainWindow.webContents.send('update-available');
    });

    autoUpdater.on('update-downloaded', () => {
        mainWindow.webContents.send('update-downloaded');
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
})

function getAppPath() {
    if (process.platform === 'win32') {
        return app.getPath('exe');
    } else if (process.platform === 'darwin') {
        return path.join(app.getPath('exe'), '../../..');
    }
    return app.getPath('exe');
}

ipcMain.handle('get-startup-status', () => {
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('toggle-startup', (_, enable) => {
    if (process.platform === 'darwin') {
        app.setLoginItemSettings({
            openAtLogin: enable,
            path: getAppPath()
        });
    } else {
        app.setLoginItemSettings({
            openAtLogin: enable,
            path: getAppPath(),
            args: ['--processStart', `${app.getName()}`]
        });
    }
    return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('save-setting', (_, key, value) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('get-setting', (_, key) => {
    return store.get(key);
});

ipcMain.on('show-notification', (_, options) => {
    const notification = new Notification({
        title: options.title,
        body: options.body
    });
    notification.show();
});

ipcMain.handle('start-timer', (_, { id, remainingSeconds, taskName }) => {
    timerManager.startTimer(id, remainingSeconds, taskName);
});

ipcMain.handle('stop-timer', (_, { id }) => {
    timerManager.stopTimer(id);
});

ipcMain.handle('clear-settings', () => {
    store.clear();
    app.setLoginItemSettings({
        openAtLogin: false
    });
    return true;
});

app.on('before-quit', () => {
    if (timerManager) {
        timerManager.clearAllTimers();
    }
}); 