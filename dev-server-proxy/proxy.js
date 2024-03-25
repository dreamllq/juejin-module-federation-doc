const path = require('path');
const fs = require('fs')
const mime = require('mime');
const http = require('http');
const dotenv = require('dotenv');
const dotenvExpand = require('dotenv-expand');
const logProxyServerStatus = require('./log-proxy-server-status');

require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;
const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'manifest.json'), 'utf8'));

var myEnv = dotenv.config({ path: process.cwd() + '/.env.development' });
dotenvExpand.expand(myEnv);
const minimist = require('minimist')
const args = minimist(process.argv.slice(2));

let port = args.p || args.port || 8090;

const CLEAR_STYLE_CODE = '\033[0m';
const BASE_COLOR_MAP = {
  INFO_TAG_COLOR: '\033[44;30m',
  INFO_MSEEAGE_COLOR: '\033[0;34m',
  WARN_TAG_COLOR: '\033[43;30m',
  WARN_MSEEAGE_COLOR: '\033[0;33m',
  ERROR_TAG_COLOR: '\033[41;30m',
  ERROR_MSEEAGE_COLOR: '\033[0;31m',
  LOG_TAG_COLOR: '\033[42;30m',
  LOG_MSEEAGE_COLOR: '\033[0;32m',
}

const host = myEnv.parsed.PROXY_HOST;
 
const serviceStatus = {
  container: {
    name:manifest.container.name,
    local: false,
    localServer: false,
    remoteServer: true
  },
  apps:manifest.apps.reduce((acc, item)=>{
    acc[item.name] = {
      name: item.name,
      local: false,
      localServer: false,
      remoteServer: true
    }
    return acc;
  }, {})
}

const proxyInfo ={
  port,
  remoteHost: host
}

logProxyServerStatus(serviceStatus, proxyInfo)

const appLocalServerProxyMap = {}

const bonjourClient = require('bonjour')();
// app服务监听
const appBrowser = bonjourClient.find({type: 'app'})
appBrowser.on('up',  function(service){
  if(!serviceStatus.apps[service.name]) return;
  console.log(BASE_COLOR_MAP.LOG_MSEEAGE_COLOR, 'up',service.type,service.name, `http://127.0.0.1:${service.port}`, CLEAR_STYLE_CODE)
  serviceStatus.apps[service.name].localServer = true;
  serviceStatus.apps[service.name].localServerUrl = `http://127.0.0.1:${service.port}`
  appLocalServerProxyMap[service.name] = createProxyMiddleware({
    target: `http://127.0.0.1:${service.port}`,
    pathRewrite: { [`^/app/${service.name}`]: '' },
    logLevel: 'silent'
  })
  logProxyServerStatus(serviceStatus, proxyInfo)
});
appBrowser.on('down',  function(service){
  if(!serviceStatus.apps[service.name]) return;
  console.log(BASE_COLOR_MAP.ERROR_MSEEAGE_COLOR, 'down',service.type,service.name, `http://127.0.0.1:${service.port}`, CLEAR_STYLE_CODE)
  serviceStatus.apps[service.name].localServer = false;
  serviceStatus.apps[service.name].localServerUrl = undefined;
  appLocalServerProxyMap[service.name] = undefined
  logProxyServerStatus(serviceStatus, proxyInfo)
});

let localServerProxy;
let containerHost;

// container服务监听
const containerBrowser = bonjourClient.find({type: 'container'})
containerBrowser.on('up',  function(service){
  if(manifest.container.name !== service.name) return;
  console.log(BASE_COLOR_MAP.LOG_MSEEAGE_COLOR,'up',service.type,service.name, `http://127.0.0.1:${service.port}`, CLEAR_STYLE_CODE)
  serviceStatus.container.localServer = true;
  serviceStatus.container.localServerUrl = `http://127.0.0.1:${service.port}`;
  localServerProxy = createProxyMiddleware({
    target:`http://127.0.0.1:${service.port}`,
    logLevel: 'silent'
  })
  containerHost = `http://127.0.0.1:${service.port}`;
  logProxyServerStatus(serviceStatus, proxyInfo)
});
containerBrowser.on('down',  function(service){
  if(manifest.container.name !== service.name) return;
  console.log(BASE_COLOR_MAP.ERROR_MSEEAGE_COLOR,'down',service.type,service.name, `http://127.0.0.1:${service.port}`, CLEAR_STYLE_CODE)
  serviceStatus.container.localServer = false;
  serviceStatus.container.localServerUrl = undefined;
  localServerProxy = null
  logProxyServerStatus(serviceStatus, proxyInfo)
});

// 文件夹存在监听

(()=>{
  const dp = path.join(process.cwd(), 'public')
  const handle = ()=>{
    if(fs.existsSync(dp) !== serviceStatus.container.local){
      // console.log(fs.existsSync(dp)?BASE_COLOR_MAP.LOG_MSEEAGE_COLOR:BASE_COLOR_MAP.ERROR_MSEEAGE_COLOR,fs.existsSync(dp)?'up':'down', 'container', CLEAR_STYLE_CODE);
      serviceStatus.container.local = fs.existsSync(dp);
      logProxyServerStatus(serviceStatus, proxyInfo)
    }
  }
  setInterval(handle, 10*1000);
  handle()
})();

(()=>{
  manifest.apps.forEach((item)=>{
    const dp = path.join(process.cwd(), 'public', 'app', item.name)
    const handle = ()=>{
      if(fs.existsSync(dp) !== serviceStatus.apps[item.name].local){
        // console.log(fs.existsSync(dp)?BASE_COLOR_MAP.LOG_MSEEAGE_COLOR:BASE_COLOR_MAP.ERROR_MSEEAGE_COLOR, fs.existsSync(dp)?'up':'down', 'app', item.name, CLEAR_STYLE_CODE);
        serviceStatus.apps[item.name].local = fs.existsSync(dp);
        logProxyServerStatus(serviceStatus, proxyInfo)
      }
    }
    setInterval(handle, 10*1000);
    handle()
  })
})();

// 代理服务
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
var compression = require('compression')

const app = express();
app.use(compression());

const envProxy = createProxyMiddleware({
  target:host,
  changeOrigin: true,
  headers:{
    'cache-control':'no-store'
  },
  logLevel: 'silent'
})

app.use('/env.js', (req, res, next)=>{
  const fp = path.join(process.cwd(), 'env.js')
  if(fs.existsSync(fp)){
    const content = fs.readFileSync(fp, 'utf8').toString();
    res.setHeader('Content-Type',`application/javascript; charset=utf-8`)
    res.send(content)
  } else {
    res.setHeader('cache-control',`no-store`)
    return envProxy(req, res, next)
  }
})

app.use('/version.js', (req, res)=>{
  let appVersions = {};
  const appFp = path.join(process.cwd(), 'app-versions.json');
  if(fs.existsSync(appFp)){
    appVersions = JSON.parse(fs.readFileSync(appFp, 'utf8'))
  } else {
    appVersions = manifest.apps.reduce((acc, item)=>{
      acc[item.name]=item.version;
      return acc;
    },{})
  }

  let containerVersion = {};
  const containerFp = path.join(process.cwd(), 'container-version.json');
  if(fs.existsSync(containerFp)){
    containerVersion = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'container-version.json'), 'utf8'))
  } else {
    containerVersion = manifest.container.version;
  }

  res.setHeader('Content-Type',`application/javascript; charset=utf-8`)
  res.send(`
    window.NODE_ENV = 'development';
    window.__APP_VERSIONS__ = ${JSON.stringify(appVersions)};
    window.__VERSION__ = ${JSON.stringify(containerVersion)};
    window.__APPS__ = ${JSON.stringify(manifest.apps)};
  `)
})

app.use('/common.js', (req, res)=>{
  res.setHeader('Content-Type',`application/javascript; charset=utf-8`)
  res.send(String(fs.readFileSync(path.join(__dirname, '..', 'common.js'), 'utf8')))
})

const appRemoteServerProxyMap={}

manifest.apps.forEach(item=>{
  const localProxy = express.static(path.join(process.cwd(), 'public', 'app', item.name))

  app.use(`/app/${item.name}`, (req, res, next)=>{
    if(serviceStatus.apps[item.name].localServer){
       appLocalServerProxyMap[item.name](req, res, next)
    } else if(serviceStatus.apps[item.name].local){
      localProxy(req, res, next);
    } else if(serviceStatus.apps[item.name].remoteServer) {
      if(!appRemoteServerProxyMap[item.name]){
        appRemoteServerProxyMap[item.name] = createProxyMiddleware({
          target: host,
          changeOrigin: true,
          logLevel: 'silent'
        })
      }
      appRemoteServerProxyMap[item.name](req, res, next)
    }
  });
})

const localProxy = express.static(path.join(process.cwd(), 'public'))
let remoteServerProxy = null;

app.use('/', (req, res, next)=>{
  if(serviceStatus.container.localServer){
    const filePath = path.join(process.cwd() , 'public', req.path);
    const mimeType = mime.getType(filePath);
    if(mimeType){
      return localServerProxy(req, res, next)
    } else {
      http.get(`${containerHost}/entry.json`, (entryJsonRes)=>{
        let entryJson = ''
        entryJsonRes.on('data', (chunk) => { entryJson += chunk; });
        entryJsonRes.on('end', () => {
          http.get(`${containerHost}/index.html`, response=>{
            let rawData = '';
            response.on('data', (chunk) => { rawData += chunk; });
            response.on('end', () => {
              res.setHeader('Content-Type',`text/html; charset=utf-8`);
              const v = Date.now()
              res.send(rawData);
            });
          })
        })
      })
      
    }
  } else if(serviceStatus.container.local){
    const filePath = path.join(process.cwd() , 'public', req.path);
    const mimeType = mime.getType(filePath);
    if(mimeType){
      return localProxy(req, res, next)
    } else {
      const entryFp = path.join(process.cwd(), 'public', 'entry.json')
      const fp = path.join(process.cwd(), 'public', 'index.html')
      let entry = fs.readFileSync(entryFp, 'utf8')
      let html = fs.readFileSync(fp, 'utf8')
      res.setHeader('Content-Type',`text/html; charset=utf-8`);
      res.send(html);
    }
  } else if(serviceStatus.container.remoteServer) {
    if(!remoteServerProxy){
      remoteServerProxy = createProxyMiddleware({
        target:host,
        changeOrigin: true,
        logLevel: 'silent'
      })
    }
    return remoteServerProxy(req, res, next)
  }
})

app.listen(port);

// console.log('启动完成');
// console.log(BASE_COLOR_MAP.LOG_MSEEAGE_COLOR, 'local:',`http://127.0.0.1:${port}`, CLEAR_STYLE_CODE)