const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
})

const semver = require('semver')
if(!/^[0-9]+\.[0-9]\.[0-9]+$/.test(process.env.npm_old_version) && process.env.npm_new_version === semver.inc(process.env.npm_old_version, 'prerelease')) {
  readline.close()
} else {
  readline.on('SIGINT', ()=>{
    process.exit(1);
  })
  readline.question(`当前版本${process.env.npm_old_version}，升级至 ${process.env.npm_new_version},是否确认执行？(yes/YES)`, function(q){
    if(q !== 'yes' && q!=='YES'){
      process.exit(1);
    }
    readline.close()
  })
}
