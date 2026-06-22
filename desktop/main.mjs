import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpServer } from '../dist/server/http-server.js';
import { createWsServer } from '../dist/server/ws-server.js';
import { startFileWatcher } from '../dist/server/file-watcher.js';
import { findDtRoot, getDtPaths, readTreeConfig } from '../dist/core/project.js';
import { listProjects } from '../dist/core/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let httpServer = null;
let wsServer = null;
let fileWatcher = null;

function buildWatchList() {
  const registeredProjects = listProjects().filter((project) => project.reachable);
  const watchList = registeredProjects.map((project) => ({
    projectId: project.id,
    paths: getDtPaths(path.join(project.path, '.dt')),
  }));

  if (watchList.length === 0) {
    const currentDtRoot = findDtRoot(process.cwd());
    if (currentDtRoot) {
      watchList.push({
        projectId: '_default',
        paths: getDtPaths(currentDtRoot),
      });
    }
  }

  return { registeredProjects, watchList };
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: 'dt',
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadURL(url);
  mainWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    shell.openExternal(nextUrl);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startDesktopServer() {
  const { registeredProjects, watchList } = buildWatchList();
  if (watchList.length === 0) {
    throw new Error('未找到可用的 dt 项目。请先运行 dt init 或 dt register。');
  }

  httpServer = createHttpServer({ port: 0, host: '127.0.0.1' });
  const firstProjectName = registeredProjects[0]?.name ?? 'dt';
  wsServer = createWsServer(httpServer, firstProjectName);
  fileWatcher = startFileWatcher(watchList, wsServer);

  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error('无法获取本地服务端口'));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function shutdown() {
  if (fileWatcher) {
    await fileWatcher.close().catch(() => {});
    fileWatcher = null;
  }
  if (wsServer) {
    await wsServer.close().catch(() => {});
    wsServer = null;
  }
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(() => resolve()));
    httpServer = null;
  }
}

app.whenReady().then(async () => {
  try {
    const url = await startDesktopServer();
    createWindow(url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    createWindow(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #000; color: #e8e8e8; font: 14px system-ui, sans-serif; }
        main { max-width: 560px; padding: 32px; border: 1px solid #333; background: #111; }
        h1 { margin: 0 0 12px; font-size: 20px; }
        code { background: #1a1a1a; padding: 2px 6px; border: 1px solid #333; }
      </style>
      <main>
        <h1>dt desktop could not start</h1>
        <p>${detail}</p>
        <p>Run <code>dt init</code> in a project or <code>dt register &lt;path&gt;</code>, then reopen the app.</p>
      </main>
    `)}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', async (event) => {
  event.preventDefault();
  await shutdown();
  app.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
