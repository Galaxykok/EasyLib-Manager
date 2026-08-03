const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("startupAPI", {
  onStatus: (callback: (status: unknown) => void) => {
    if (typeof callback !== "function") return;
    ipcRenderer.on("startup:status", (_event: unknown, status: unknown) => callback(status));
  },
  tentarNovamente: () => ipcRenderer.send("startup:retry"),
  fechar: () => ipcRenderer.send("startup:close"),
});
