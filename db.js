const sqlite3 = require('sqlite3')
const open    = require('sqlite').open
 
const open_db = async () => {
    return open({
        filename: process.env['DATABASE'],
        driver: sqlite3.Database
    })
}

module.exports = open_db
