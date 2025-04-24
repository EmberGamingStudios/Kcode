const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  chooseProjectFolder: () => ipcRenderer.invoke('choose-project-folder'),
  readFolderRecursive: (dirPath) => ipcRenderer.invoke('read-folder-recursive', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  createFile: (filePath) => ipcRenderer.invoke('create-file', filePath),
  createNewFileDialog: () => ipcRenderer.invoke('createNewFileDialog'),
  runBuildCommand: (projectPath) => ipcRenderer.invoke('run-build', projectPath),
  onBuildOutput: (callback) => ipcRenderer.on('build-output', (_event, message) => callback(message)),
  runBuild: (projectPath) => ipcRenderer.invoke('run-build', projectPath)
});
