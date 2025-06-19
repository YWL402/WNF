const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron')
const path = require('path')

// 确保只有一个实例在运行
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
    app.quit()
    return
}

let tray = null
let mainWindow = null
let settingsWindow = null
let store = null
let currentEarnings = 0
let workStatus = 'Offline'
let trayUpdateInterval = null

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
        if (settingsWindow.isMinimized()) {
            settingsWindow.restore()
        }
        settingsWindow.show()
        settingsWindow.focus()
        settingsWindow.moveTop()
        return
    }

    settingsWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        transparent: false,  // 改为不透明，确保窗口可见
        frame: false,
        resizable: false,
        backgroundColor: '#ffffff',  // 设置白色背景，确保可见
        icon: path.join(__dirname, 'icon.png'),
        show: false,  // 先不显示，等加载完成后再显示
        skipTaskbar: false,  // 显示在任务栏
        alwaysOnTop: true,  // 置顶显示
        center: true  // 居中显示
    })

    settingsWindow.loadFile('settings.html')
    settingsWindow.setMovable(true)

    settingsWindow.once('ready-to-show', () => {
        settingsWindow.show()
        settingsWindow.focus()
        settingsWindow.moveTop()
    })

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

// 将英文工作状态翻译为中文显示
function translateWorkStatus(status) {
    const statusMap = {
        'Not Configured': '未配置',
        'Weekend': '休息日',
        'Before Work': '未上班',
        'After Work': '已下班',
        'Lunch Break': '午休中',
        'Working': '工作中',
        'Offline': '离线'
    }
    return statusMap[status] || status
}

// 更新托盘工具提示
function updateTrayTooltip() {
    if (!tray) return
    
    const tooltip = `窝囊废Desk
工作状态: ${translateWorkStatus(workStatus)}
今日收入: ¥${currentEarnings.toFixed(2)}
点击显示/隐藏窗口
双击打开设置`
    
    tray.setToolTip(tooltip)
}

// 更新托盘菜单
function updateTrayMenu() {
    if (!tray) return
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: `💰 今日收入: ¥${currentEarnings.toFixed(2)}`,
            enabled: false
        },
        {
            label: `📊 状态: ${translateWorkStatus(workStatus)}`,
            enabled: false
        },
        { type: 'separator' },
        { 
            label: '🏠 显示/隐藏主窗口', 
            click: toggleWindow,
            accelerator: 'Ctrl+H'
        },
        { 
            label: '⚙️ 工资设置', 
            click: createSettingsWindow,
            accelerator: 'Ctrl+S'
        },
        { type: 'separator' },
        {
            label: '🎨 切换风格',
            submenu: [
                {
                    label: '🌌 紫色渐变',
                    click: () => changeWindowStyle(1)
                },
                {
                    label: '🌅 橙色渐变',
                    click: () => changeWindowStyle(2)
                },
                { type: 'separator' },
                {
                    label: '🌊 深蓝纯色',
                    click: () => changeWindowStyle(3)
                },
                {
                    label: '🌑 深灰纯色',
                    click: () => changeWindowStyle(4)
                },
                {
                    label: '🌿 薄荷纯色',
                    click: () => changeWindowStyle(5)
                },
                {
                    label: '☁️ 天蓝纯色',
                    click: () => changeWindowStyle(6)
                },
                {
                    label: '🔮 紫色纯色',
                    click: () => changeWindowStyle(7)
                }
            ]
        },
        { type: 'separator' },
        {
            label: '📈 统计信息',
            click: () => showStatsWindow()
        },
        { type: 'separator' },
        { 
            label: '❌ 退出应用', 
            click: () => {
                app.isQuitting = true
                app.quit()
            },
            accelerator: 'Ctrl+Q'
        }
    ])
    
    tray.setContextMenu(contextMenu)
}

function createTray() {
    try {
        tray = new Tray(path.join(__dirname, 'icon.png'))
        
        // 初始设置托盘工具提示
        updateTrayTooltip()
        
        // 创建动态菜单
        updateTrayMenu()
        
        // 点击托盘图标显示/隐藏主窗口
        tray.on('click', toggleWindow)
        
        // 双击托盘图标打开设置
        tray.on('double-click', createSettingsWindow)
        
        // 开始定期更新托盘信息
        startTrayUpdates()
        
        console.log('Tray created successfully')
    } catch (error) {
        console.error('Failed to create tray icon:', error)
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
        console.error('Failed to restore window state:', error);
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
    // 清理托盘定时器
    stopTrayUpdates()
    
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    // 清理托盘定时器
    stopTrayUpdates()
    
    // 销毁托盘
    if (tray) {
        tray.destroy()
        tray = null
    }
})

// 监听设置更新事件
ipcMain.on('settings-updated', () => {
    if (mainWindow) {
        mainWindow.webContents.send('reload-data')
    }
})

// 处理第二个实例启动
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore()
        }
        mainWindow.show()
        mainWindow.focus()
    }
})

// 切换窗口风格的辅助函数
function changeWindowStyle(styleNumber) {
    if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`changeStyle(${styleNumber})`)
        showNotification('风格切换', `已切换到风格 ${styleNumber}`)
    }
}

// 开始托盘更新定时器
function startTrayUpdates() {
    // 每30秒更新一次托盘信息
    trayUpdateInterval = setInterval(() => {
        updateTrayTooltip()
        updateTrayMenu()
    }, 30000)
}

// 停止托盘更新定时器
function stopTrayUpdates() {
    if (trayUpdateInterval) {
        clearInterval(trayUpdateInterval)
        trayUpdateInterval = null
    }
}

// 显示系统通知 (暂时禁用)
function showNotification(title, body, urgent = false) {
    // 暂时禁用系统通知功能
    return;
    
    if (!Notification.isSupported()) return
    
    const notification = new Notification({
        title: title,
        body: body,
        icon: path.join(__dirname, 'icon.png'),
        urgency: urgent ? 'critical' : 'normal',
        timeoutType: 'default'
    })
    
    notification.show()
    
    // 点击通知显示主窗口
    notification.on('click', () => {
        if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
        }
    })
}

// 显示统计窗口
function showStatsWindow() {
    // 这里可以创建一个统计窗口，显示详细的收入统计
    showNotification('统计信息', `今日收入: ¥${currentEarnings.toFixed(2)}\n工作状态: ${translateWorkStatus(workStatus)}`)
}

// 监听收入更新
ipcMain.on('earnings-update', (event, earnings) => {
    currentEarnings = earnings
    updateTrayTooltip()
    updateTrayMenu()
    
    // 当收入达到整数时显示通知
    if (earnings > 0 && earnings % 10 === 0) {
        showNotification('收入更新', `恭喜！今日收入已达到 ¥${earnings.toFixed(2)}`, false)
    }
})

// 监听工作状态更新
ipcMain.on('work-status-update', (event, status) => {
    const oldStatus = workStatus
    workStatus = status
    updateTrayTooltip()
    updateTrayMenu()
    
    // 状态变化时显示通知
    if (oldStatus !== status) {
        showNotification('状态变化', `工作状态: ${translateWorkStatus(oldStatus)} → ${translateWorkStatus(status)}`)
    }
}) 