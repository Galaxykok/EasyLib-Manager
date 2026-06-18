import { app, BrowserWindow } from 'electron';
import path from 'path';
app.on('ready', () => {
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 720, 
        minWidth: 1280,
        minHeight: 720,
        icon: path.join(app.getAppPath(), '/src/ui/assets/icontask.png') 
    });
    mainWindow.maximize()
    mainWindow.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'));
});