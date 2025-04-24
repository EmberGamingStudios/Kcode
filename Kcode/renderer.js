let currentProjectPath = null;
let editor = null;

window.addEventListener('DOMContentLoaded', () => {
  initEditor();
  setupButtons();
});

window.api.onBuildOutput((message) => {
  const outputDiv = document.getElementById('build-log');
  outputDiv.value += message;
  outputDiv.scrollTop = consoleOutput.scrollHeight;
});


function initEditor() {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: 'Kcode INDEV',
    language: 'plaintext',
    theme: 'vs-dark',
    automaticLayout: true
  });
}

function setupButtons() {
  document.getElementById('open-folder-btn').addEventListener('click', async () => {
    const folderPath = await window.api.chooseProjectFolder();
    if (folderPath) {
      currentProjectPath = folderPath;
      loadFolderTree(folderPath);
      logOutput(`📂 Project loaded: ${folderPath}`);
    }
  });

  document.getElementById('new-file-btn').addEventListener('click', async () => {
    if (!currentProjectPath) {
      return alert('Please open a project first.');
    }

    const filePath = await window.api.createNewFileDialog();
    if (!filePath) return;

    try {
      await window.api.createFile(filePath);
      const { content } = await window.api.readFile(filePath);
      const model = monaco.editor.createModel(content, undefined, monaco.Uri.file(filePath));
      editor.setModel(model);
      loadFolderTree(currentProjectPath);
      updateOpenFileName(filePath);
      logOutput(`🆕 Created and opened: ${filePath}`);
    } catch (err) {
      alert(`Could not create file: ${err.message}`);
    }
  });

  document.getElementById('save-file-btn').addEventListener('click', async () => {
    if (!editor) return;
    const content = editor.getValue();
    const filePath = editor.getModel().uri.fsPath;
    const result = await window.api.saveFile(filePath, content);
    if (result.success) {
      logOutput(`💾 Saved: ${result.filePath}`);
    } else {
      alert(`Error saving file: ${result.message}`);
    }
  });

  document.getElementById('build-btn').addEventListener('click', async () => {
    logOutput("🔨 Build started...");
    if (!currentProjectPath) {
      return alert('Please open a project first.');
    }

    const buildResult = await window.api.runBuildCommand(currentProjectPath);
    logOutput(`✅ The build appears to have completed sucessfully. `);
  });
}

async function loadFolderTree(folderPath) {
  const tree = await window.api.readFolderRecursive(folderPath);
  const container = document.getElementById('file-tree');
  container.innerHTML = '';
  buildTree(tree, container);
  enableFileSearch();
}

function buildTree(nodes, container) {
  for (const node of nodes) {
    const el = document.createElement('div');
    el.textContent = node.name;
    el.style.paddingLeft = `${node.depth * 20}px`;
    el.className = `tree-item ${node.type}`;
    el.dataset.path = node.path;
    el.dataset.type = node.type;
    el.dataset.search = node.name.toLowerCase();
    container.appendChild(el);

    if (node.children) buildTree(node.children, container);
  }
}

function enableFileSearch() {
  const searchInput = document.getElementById('file-search');
  searchInput.addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const items = document.querySelectorAll('#file-tree .tree-item');

    items.forEach(item => {
      const match = item.dataset.search.includes(search);
      item.style.display = match ? 'block' : 'none';
    });
  });
}

document.getElementById('file-tree').addEventListener('click', async (e) => {
  const el = e.target;
  if (el.dataset.type === 'file') {
    const filePath = el.dataset.path;
    const { content } = await window.api.readFile(filePath);
    const model = monaco.editor.createModel(content, undefined, monaco.Uri.file(filePath));
    editor.setModel(model);
    updateOpenFileName(filePath);
    logOutput(`📄 Opened: ${filePath}`);
  }
});

function updateOpenFileName(filePath) {
  const nameOnly = filePath.split(/[\\/]/).pop();
  document.getElementById('open-file-name').textContent = `📝 Editing: ${nameOnly}`;
}

function logOutput(message) {
  const output = document.getElementById('build-log');
  output.value += message + '\n';
  output.scrollTop = output.scrollHeight;
}
