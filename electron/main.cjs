const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const entry = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
app.setName('EntrenarIA');
let win;
function open() {
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 880, minHeight: 640, backgroundColor: '#f5f6fa', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname,'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadURL(entry);
}
ipcMain.handle('ollama:generate', async (event, payload) => {
  if (event.sender !== win?.webContents || event.senderFrame?.url !== entry) throw new Error('Origen no autorizado');
  if (!payload || typeof payload.model !== 'string' || !/^[a-zA-Z0-9_.:/-]{1,120}$/.test(payload.model) || typeof payload.prompt !== 'string' || payload.prompt.length > 160000) throw new Error('Solicitud inválida');
  const response = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({model:payload.model,system:payload.system,prompt:payload.prompt,stream:false,format:'json',options:{temperature:0.1}}),signal:AbortSignal.timeout(240000) });
  if (!response.ok) throw new Error('Ollama no pudo evaluar. Comprueba que el modelo esté instalado.');
  return (await response.json()).response;
});
ipcMain.handle('file:export', async (event, payload) => {
 if (event.sender !== win?.webContents || event.senderFrame?.url !== entry) throw new Error('Origen no autorizado');
 if (!payload || !['EntrenarIA-respaldo.json','Evaluacion-articulo.md'].includes(payload.name) || typeof payload.data !== 'string' || payload.data.length > 50000000) throw new Error('Exportación inválida o demasiado grande');
 const result = await dialog.showSaveDialog(win, {defaultPath:payload.name,filters:[{name:'Documento',extensions:[payload.name.split('.').pop()]}]});
 if(result.canceled || !result.filePath) return false;
 await require('node:fs/promises').writeFile(result.filePath,payload.data,'utf8');
 return true;
});
ipcMain.handle('report:pdf', async (event, payload) => {
 if(event.sender!==win?.webContents || event.senderFrame?.url!==entry)throw new Error('Origen no autorizado.');
 if(!payload||typeof payload.html!=='string'||payload.html.length>350000||!payload.html.startsWith('<!doctype html>'))throw new Error('Informe inválido.');
 const printWindow=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false}});
 try{
  await printWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(payload.html));
  const buffer=await printWindow.webContents.printToPDF({printBackground:true,pageSize:'A4'});
  const answer=await dialog.showSaveDialog(win,{defaultPath:'Informe-EntrenarIA.pdf',filters:[{name:'PDF',extensions:['pdf']}]});
  if(answer.canceled||!answer.filePath)return false;
  await require('node:fs/promises').writeFile(answer.filePath,buffer);
  return true;
 }finally{if(!printWindow.isDestroyed())printWindow.destroy();}
});
app.whenReady().then(() => {
 session.defaultSession.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 open(); app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length) open();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
