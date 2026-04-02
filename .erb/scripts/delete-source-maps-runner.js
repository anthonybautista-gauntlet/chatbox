const fs = require('fs')
const path = require('path')
const { rimrafSync } = require('rimraf')

function removeMapsIn(dir) {
  if (!fs.existsSync(dir)) {
    return
  }

  rimrafSync(path.join(dir, '*.js.map'), { glob: true })
}

const rootPath = path.join(__dirname, '../..')
const distPath = path.join(rootPath, 'release/app/dist')

removeMapsIn(path.join(distPath, 'main'))
removeMapsIn(path.join(distPath, 'renderer'))
removeMapsIn(path.join(distPath, 'preload'))
