const sqlite3        = require('sqlite3')
const open           = require('sqlite').open
const { v4: uuidv4 } = require('uuid');

const open_db = async () => {
    return await open({
        filename: process.env['DATABASE'],
        driver: sqlite3.Database
    })
}

module.exports = open_db
