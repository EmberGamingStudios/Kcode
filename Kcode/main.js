const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('run-build', async (event, projectPath) => {
  return new Promise((resolve, reject) => {
    const localTheos = process.env.THEOS || path.join(__dirname, 'theos');

    console.log("Using THEOS at:", localTheos);
    console.log("PATH:", process.env.PATH);

    const build = spawn('make', ['package'], {
      cwd: projectPath,
      env: {
        ...process.env,
        THEOS: localTheos,
        PATH: process.env.PATH + ':/usr/local/bin:/usr/bin:/bin'
      }
    });

    build.stdout.on('data', (data) => {
      const msg = data.toString();
      console.log(`[stdout] ${msg}`);
      mainWindow.webContents.send('build-output', msg);
    });

    build.stderr.on('data', (data) => {
      const msg = data.toString();
      console.error(`[stderr] ${msg}`);
      mainWindow.webContents.send('build-output', msg);
    });

    build.on('close', async (code) => {
      if (code !== 0) {
        const errMsg = `Build failed with code ${code}`;
        console.error(errMsg);
        mainWindow.webContents.send('build-output', `❌ ${errMsg}`);
        return reject(new Error(errMsg));
      }

      try {
        const debugPath = path.join(projectPath, '.theos/obj/debug');
        const appFolder = fs.readdirSync(debugPath).find(name => name.endsWith('.app'));
        if (!appFolder) throw new Error('No .app found after build.');

        const appName = appFolder.replace('.app', '');
        const payloadPath = path.join(projectPath, 'Payload');
        const appPath = path.join(debugPath, appFolder);
        const ipaPath = path.join(projectPath, `${appName}.ipa`);

        if (!fs.existsSync(payloadPath)) fs.mkdirSync(payloadPath);
        await fs.promises.cp(appPath, path.join(payloadPath, appFolder), { recursive: true });

        const output = fs.createWriteStream(ipaPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.pipe(output);
        archive.directory(payloadPath, 'Payload');
        await archive.finalize();

        fs.rmSync(payloadPath, { recursive: true, force: true });

        const successMsg = `\n✅ IPA created: ${ipaPath}\n`;
        console.log(successMsg);
        mainWindow.webContents.send('build-output', successMsg);
        resolve(ipaPath);
      } catch (err) {
        const errMsg = `IPA packaging error: ${err.message}`;
        console.error(errMsg);
        mainWindow.webContents.send('build-output', `\n❌ ${errMsg}\n`);
        reject(err);
      }
    });
  });
});

ipcMain.handle('choose-project-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('read-folder-recursive', async (_event, dirPath) => {
  function walk(dir, depth = 0) {
    const entries = fs.readdirSync(dir);
    return entries.map(name => {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      return stat.isDirectory()
        ? { name, path: fullPath, type: 'folder', depth, children: walk(fullPath, depth + 1) }
        : { name, path: fullPath, type: 'file', depth };
    });
  }
  return walk(dirPath);
});

ipcMain.handle('read-file', async (_event, filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  return { content };
});

ipcMain.handle('save-file', async (_event, filePath, content) => {
  try {
    if (!fs.existsSync(filePath)) {
      const { canceled, filePaths } = await dialog.showSaveDialog({
        title: 'Save File',
        defaultPath: filePath,
        filters: [
          { name: 'Text Files', extensions: ['txt', 'rpy', 'js', 'py'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (canceled) return;
      filePath = filePaths[0];
    }

    fs.writeFileSync(filePath, content);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('create-file', async (_event, filePath) => {
  try {
    fs.writeFileSync(filePath, '');
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

ipcMain.handle('createNewFileDialog', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Create New File",
    defaultPath: path.join(__dirname, 'newfile.rpy'),
    filters: [
      { name: 'Text Files', extensions: ['txt', 'rpy', 'js', 'py'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (canceled) return null;
  return filePath;
});
