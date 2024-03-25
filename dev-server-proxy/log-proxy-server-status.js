const cliTable = require('./cli-table')

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

const getServerType = ({local,localServer,remoteServer}, remoteHost)=>{
  if(localServer){
    return '本地代理服务'
  } else if(local){
    return '本地文件'
  } else {
    return '远程服务'
  }
}

const getServerUrl = ({local,localServer,remoteServer, localServerUrl}, remoteHost)=>{
  if(localServer){
    return localServerUrl;
  } else if(local){
    return ''
  } else {
    return remoteHost
  }
}


module.exports = (serviceStatus, options)=>{
  console.clear()
  const headerOptions = {head: ['名称', '服务类型','服务地址']};
  const data = []

  if(serviceStatus.container.localServer){
    data.push([`container-${serviceStatus.container.name}`, getServerType(serviceStatus.container, options.remoteHost), getServerUrl(serviceStatus.container, options.remoteHost)]);
  }
    
  Object.keys(serviceStatus.apps).forEach(key=>{
    const item = serviceStatus.apps[key];
    if(item.localServer){
      data.push([`app-${item.name}`, getServerType(item, options.remoteHost), getServerUrl(item, options.remoteHost)]);
    }
  })
  console.log(BASE_COLOR_MAP.LOG_MSEEAGE_COLOR, 'local:',`http://127.0.0.1:${options.port}`, CLEAR_STYLE_CODE)
  cliTable(headerOptions, data)
}