
'use strict';
//正式产品发布首页
const appUrl = 'https://im.justep.com:9072/x5/UI2/chat/bex5/pc/index.w';
//为了提升通用app体验的首页
//const appUrl = 'file://'+ __dirname+'/index.html';
//开发测试地址
//const appUrl = 'http://192.168.1.87:8080/x5/UI2/chat/bex5/pc/index.w';
const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const MenuItem = electron.MenuItem;
const Tray = electron.Tray;
const shell = electron.shell;
const clipboard = electron.clipboard;
const dialog = electron.dialog;
const path = require('path');
const execFile = require('child_process').execFile;
const exec = require('child_process').exec;

const os = require('os');

const notifier = require('node-notifier');

console.log(process.platform);


var appTray = null;
var appName = "铛铛";

var mainWindow;
app.setPath("userData", path.join(__dirname, "userData"));
app.commandLine.appendSwitch("disable-renderer-backgrounding");

// Quit when all windows are closed.
app.on('window-all-closed', function() {
});

app.on('quit', function() {
    if(null != mainWindow) {
        mainWindow = null;
    }
});
var isRequestQuit = false;
app.on('before-quit', function() {
    isRequestQuit = true;
});


//保证只有一个msg运行
var shouldQuit = app.makeSingleInstance(function (commandLine, workingDirectory) {
    // 当另一个实例运行的时候，这里将会被调用，我们需要激活应用的窗口
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.focus();
    }
    return true;
});
// 这个实例是多余的实例，需要退出
if (shouldQuit) {
    app.quit();
    return;
}

var windowStateKeeper = require('electron-window-state');

function showWindow() {
    if (mainWindow) {
        return;
    }

    var mainWindowState = windowStateKeeper({
        defaultWidth: 1100,
        defaultHeight: 800
    });

    // Create the window using the state information
    mainWindow = new BrowserWindow({
        'x': mainWindowState.x,
        'y': mainWindowState.y,
        'width': mainWindowState.width,
        'height': mainWindowState.height,
        title: appName,
        icon: __dirname + '/assets/im.ico'
    });

    mainWindowState.manage(mainWindow);

    mainWindow.loadURL(appUrl);
    if(process.argv[2] === "--dev"){
        mainWindow.webContents.openDevTools();
    }

    //mainWindow.loadURL('http://m.taobao.com');
    //mainWindow.loadURL("https://im.justep.com:9072/x5/UI2/chat/pc/index.w?inElectron=1");

    mainWindow.on('close', function (e) {
        if(!isRequestQuit){
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', function() {
    });

    mainWindow.on('focus', function() {
        mainWindow.webContents.send('window', 'focus');
    });

    mainWindow.on('blur', function() {
        mainWindow.webContents.send('window', 'blur');
    });

    mainWindow.on('minimize', function() {
        mainWindow.hide();
        mainWindow.webContents.send('window', 'minimize');
    });

    mainWindow.on('restore', function() {
        mainWindow.webContents.send('window', 'restore');
    });




    mainWindow.webContents.on('will-navigate', function(e, url) {
        if(!/^(http|https)/g.test(url)){
            e.preventDefault();
        }
    });

    mainWindow.webContents.on('new-window', function(e, url) {
        e.preventDefault();
        shell.openExternal(url);
    });


    //支持下载
    mainWindow.webContents.session.on('will-download', function(e, item) {
        // By default electron doesn't
        var savePath = dialog.showSaveDialog(mainWindow, { defaultPath: item.getFilename() });
        if (savePath != undefined) {
            item.setSavePath(savePath)
        } else {
            item.cancel()
            return
        }
        console.log(savePath);
        console.log(item.getMimeType());
        console.log(item.getFilename());
        console.log(item.getTotalBytes());
        item.on('updated', function() {
            //mainWindow.setProgressBar(item.getReceivedBytes() / item.getTotalBytes());
            console.log('Received bytes: ' + item.getReceivedBytes());
        });
        item.on('done', function(e, state) {
            if (state == "completed") {
                //mainWindow.setProgressBar(0);
                var nf = new notifier.Notification({
                    withFallback: true
                });
                nf.notify({
                    title: appName,
                    message: '文件下载完毕,点击打开查看',
                    icon: path.join(__dirname,'/images/im.png'),
                    sound: true, // Only Notification Center or Windows Toasters
                    wait: true // Wait with callback, until user action is taken against notification
                });
                nf.on('click', function (notifierObject, options) {
                    console.log("savePath:" + savePath);
                    var opened = shell.openItem(savePath);
                    console.log("open success:" + opened);
                });
            } else {
                console.log("Download is cancelled or interrupted that can't be resumed");
            }
        })
    })
}

app.on('activate-with-no-open-windows', showWindow);



app.on('ready', function () {
    appTray = new Tray(__dirname + '/images/im.png');
    appTray.on('click', function (event, bounds) {
        mainWindow.show();
    });

    appTray.setToolTip(appName);
    var ctxMenu = Menu.buildFromTemplate([
        {
            label: '打开' + appName, type: 'normal', click: function () {
            mainWindow.show();
        }
        },
        {type: 'separator'},
        {
            label: '退出' + appName, type: 'normal', click: function () {
            app.exit(0);
        }
        }
    ]);
    appTray.setContextMenu(ctxMenu);
    showWindow();
});

// 消息通信
var ipcMain = require('electron').ipcMain;
ipcMain.on('notification', function (event, arg) {
    arg = JSON.parse(arg);
    arg.icon = path.join(__dirname,"images/im.png");
    var nf = new notifier.Notification({
        withFallback: true
    });
    nf.notify({
        icon:arg.icon,
        subtitle:arg.title,
        title:arg.title,
        contentImage:arg.icon,
        wait:true,
        message:arg.body || " "
    });
    nf.on('click',function(){
        console.log('notification click');
        mainWindow.show();
    });
});

ipcMain.on('newMessage', function (event, arg) {
    console.log("arg:" + arg);
    arg = JSON.parse(arg);
    if(arg.counter > 0 && !appTray.interval){
        appTray.interval = setInterval(function(){
            if(appTray.isBlank){
                appTray.setImage(__dirname + '/images/im.png');
                appTray.isBlank = false;
            }else{
                appTray.setImage(__dirname + '/images/blank.png');
                appTray.isBlank = true;
            }
        },600);
    }else if(arg.counter == 0){
        appTray.setImage(__dirname + '/images/im.png');
        appTray.isBlank = false;
        clearInterval(appTray.interval);
        appTray.interval = undefined;
    }
    if (process.platform == 'darwin') {
        app.dock.bounce();
        app.dock.setBadge(arg.counter == 0?"": arg.counter + "");
    }
});

ipcMain.on('screenCapture', function (event, arg) {
    clipboard.writeText('铛铛截屏失败...');
    mainWindow.hide();
    if(process.platform == "win32"){
        execFile(path.join(__dirname,'360screener.exe'), function(err, data) {
            if(!err){
                console.log("capture end no err");
                var text = clipboard.readText();
                if(text !== '铛铛截屏失败...'){
                    mainWindow.show();
                    event.returnValue = true;
                    return;
                }
            }
            mainWindow.show();
            event.returnValue = false;
        });
    }else if(process.platform == "darwin"){
        console.log("exec screencapture ");
        exec("screencapture -i -c", function(err, data) {
            if(!err){
                var text = clipboard.readText();
                if(text !== '铛铛截屏失败...'){
                    mainWindow.show();
                    event.returnValue = true;
                    return;
                }
            }
            mainWindow.show();
            event.returnValue = false;
        });
    }

});

// Adding tray
ipcMain.on('new-messages-show', function(event, arg) {
    if (process.platform == 'darwin') {
        app.dock.bounce();
        app.dock.setBadge('.');
    }
});

ipcMain.on('tray-badge', function(event, arg) {
    if (process.platform == 'darwin') {
        app.dock.bounce();
        app.dock.setBadge(arg.count.toString());
    }
});

ipcMain.on('new-messages-hide', function(event, arg) {
    if (process.platform == 'darwin') {
        app.dock.setBadge('');
    }
});

ipcMain.on('tray-bounce', function(event, arg) {
    if (process.platform == 'darwin') {
        app.dock.bounce();
    }
});
