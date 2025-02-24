const { app, BrowserWindow, ipcMain, Tray, Menu, Notification } = require('electron')
const path = require('path')
const Store = require('electron-store')
const store = new Store()

let mainWindow
let tray

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

app.whenReady().then(() => {
    createWindow();
    createTray();
})

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