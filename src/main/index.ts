import { app, BrowserWindow, shell, nativeImage, Menu, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipcHandlers'
import { getCollectionRoot, readGlobalConfig } from './globalConfig'

app.setName('Borges')

function send(win: BrowserWindow, action: string): void {
  if (!win.isDestroyed()) win.webContents.send('menu:action', action)
}

function buildAppMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? ([{
      label: 'Borges',
      submenu: [
        {
          label: 'About Borges',
          click: () => dialog.showMessageBox(win, { type: 'info', title: 'Borges', message: 'Borges', detail: `Version ${app.getVersion()}\n\nFlash fiction writing, analysis, and submission tracking.` })
        },
        { type: 'separator' },
        { label: 'Preferences…', accelerator: 'CmdOrCtrl+,', click: () => send(win, 'openSettings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] as Electron.MenuItemConstructorOptions[]) : []),

    {
      label: 'File',
      submenu: [
        { label: 'New Story', accelerator: 'CmdOrCtrl+N', click: () => send(win, 'newStory') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send(win, 'save') },
        { type: 'separator' },
        { label: 'Open Collection Folder in Finder', click: () => shell.openPath(getCollectionRoot()) },
        { type: 'separator' },
        ...(!isMac ? ([
          { label: 'Preferences…', accelerator: 'CmdOrCtrl+,', click: () => send(win, 'openSettings') },
          { type: 'separator' }
        ] as Electron.MenuItemConstructorOptions[]) : []),
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        { type: 'separator' }, { role: 'selectAll' }
      ]
    },

    {
      label: 'View',
      submenu: [
        { label: 'Focus Mode', accelerator: 'CmdOrCtrl+Shift+G', click: () => send(win, 'toggleFocusMode') },
        { type: 'separator' },
        { label: 'Toggle Story List', accelerator: 'CmdOrCtrl+Shift+1', click: () => send(win, 'toggleSidebar') },
        { label: 'Toggle Submission Panel', accelerator: 'CmdOrCtrl+Shift+2', click: () => send(win, 'toggleSubmissionPanel') },
        { label: 'Toggle AI Chat', accelerator: 'CmdOrCtrl+Shift+3', click: () => send(win, 'toggleChat') },
        { label: 'Toggle Revision History', accelerator: 'CmdOrCtrl+Shift+R', click: () => send(win, 'toggleRevisions') },
        { type: 'separator' },
        { label: 'Toggle Dark Mode', click: () => send(win, 'toggleTheme') },
        { type: 'separator' },
        { label: 'Increase Font Size', accelerator: 'CmdOrCtrl+=', click: () => send(win, 'fontIncrease') },
        { label: 'Decrease Font Size', accelerator: 'CmdOrCtrl+-', click: () => send(win, 'fontDecrease') },
        { label: 'Reset Font Size', accelerator: 'CmdOrCtrl+0', click: () => send(win, 'fontReset') },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', accelerator: 'CmdOrCtrl+Option+I', click: () => win.webContents.toggleDevTools() }
      ]
    },

    {
      label: 'Window',
      submenu: [
        { role: 'minimize' }, { role: 'zoom' },
        ...(isMac ? ([{ type: 'separator' }, { role: 'front' }] as Electron.MenuItemConstructorOptions[]) : [])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): BrowserWindow {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
  const config = readGlobalConfig()
  const isDark = config.theme !== 'light'
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Borges',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    backgroundColor: isDark ? '#1c1a18' : '#f5f0ea',
    icon,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())
mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.borges.editor')

  if (process.platform === 'darwin') {
    app.dock.setIcon(nativeImage.createFromPath(join(__dirname, '../../resources/icon.png')))
  }

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  registerIpcHandlers()
  const mainWindow = createWindow()
  buildAppMenu(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
