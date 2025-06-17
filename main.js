const { app, BrowserWindow, Tray, Menu, ipcMain } = require('electron')
const path = require('path')

let tray = null
let mainWindow = null
let settingsWindow = null
let store = null

// 初始化 electron-store
async function initStore() {
    const Store = await import('electron-store')
    store = new Store.default()
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 200,
        height: 35,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        transparent: true,
        frame: false,
        resizable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        backgroundColor: '#00ffffff',
        icon: path.join(__dirname, 'icon.png'),
        minWidth: 160,  // 最小宽度
        minHeight: 30,  // 最小高度
        maxWidth: 400,  // 最大宽度
        maxHeight: 80   // 最大高度
    })

    mainWindow.loadFile('index.html')
    mainWindow.setMovable(true)

    // 保存窗口位置和大小
    mainWindow.on('moved', saveWindowState)
    mainWindow.on('resized', saveWindowState)

    // 阻止窗口关闭，改为隐藏
    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault()
            mainWindow.hide()
        }
        return false
    })
}

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus()
        return
    }

    settingsWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        transparent: true,
        frame: false,
        resizable: false,
        backgroundColor: '#00ffffff',
        icon: path.join(__dirname, 'icon.png')
    })

    settingsWindow.loadFile('settings.html')
    settingsWindow.setMovable(true)

    settingsWindow.on('closed', () => {
        settingsWindow = null
    })
}

function toggleWindow() {
    if (!mainWindow) {
        createWindow()
    } else if (mainWindow.isVisible()) {
        mainWindow.hide()
    } else {
        mainWindow.show()
        mainWindow.focus()
    }
}

function createTray() {
    try {
        tray = new Tray(path.join(__dirname, 'icon.png'))
        
        const contextMenu = Menu.buildFromTemplate([
            { 
                label: '显示/隐藏', 
                click: toggleWindow
            },
            { 
                label: '工资设置', 
                click: createSettingsWindow
            },
            { type: 'separator' },
            { 
                label: '退出', 
                click: () => {
                    app.isQuitting = true
                    app.quit()
                }
            }
        ])
        
        tray.setToolTip('窝囊废Desk')
        tray.setContextMenu(contextMenu)
        
        // 点击托盘图标显示/隐藏主窗口
        tray.on('click', toggleWindow)
    } catch (error) {
        console.error('创建托盘图标失败:', error)
    }
}

// 监听来自渲染进程的窗口控制请求
ipcMain.on('hide-window', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
        win.hide()
    }
})

// 保存窗口状态（位置和大小）
function saveWindowState() {
    if (!mainWindow || !store) return;
    const bounds = mainWindow.getBounds();
    store.set('windowState', {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
    });
}

// 恢复窗口状态
function restoreWindowState() {
    try {
        if (!store) return;
        const state = store.get('windowState');
        if (state) {
            mainWindow.setBounds(state);
        }
    } catch (error) {
        console.error('恢复窗口状态失败:', error);
    }
}

app.whenReady().then(async () => {
    await initStore()
    createWindow()
    mainWindow.hide()
    createTray()
    restoreWindowState()

    app.on('activate', async function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            await initStore()
            createWindow()
            mainWindow.hide()
            restoreWindowState()
        }
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// 监听设置更新事件
ipcMain.on('settings-updated', () => {
    if (mainWindow) {
        mainWindow.webContents.send('reload-data')
    }
}) 