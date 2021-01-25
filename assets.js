const express      = require('express')
const bodyparser   = require('body-parser')
const open_db      = require('./db')
const multer       = require('multer')

const storage = multer.memoryStorage()
const upload  = multer({storage})

const AWS = require('aws-sdk')

const spacesEndpoint = new AWS.Endpoint("ams3.digitaloceanspaces.com");
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: process.env.S3_API_ACCESS_KEY,
    secretAccessKey: process.env.S3_API_SECRET_KEY,
    region: "ams3",
    signatureVersion: "v4"
});


class AssetsDB {
    constructor(db) {
        if (!db) {
            throw new Error('A database is required to construct the ORM!')
        }
        this.db = db
    }

    async listAssets() {
        const rows = await this.db.all(`
            SELECT * FROM Assets
        `)

        return rows
    }

    async getAsset(name) {
        const asset = await this.db.get(`
            SELECT * FROM Assets WHERE name=?
        `, [name])

        return asset
    }

    async registerAsset(name, url, size) {
        await this.db.run(`
            INSERT INTO Assets (name, url, size) VALUES (?,?,?)
        `, [name, url, size])
    }

    async deleteAsset(name) {
        const asset = await this.db.get(`
            DELETE FROM Assets WHERE name=?
        `, [name])
    }


    async renderString(source) {
        let assets = await this.listAssets()

        assets = assets.map(a => ({
            trigger: new RegExp(`@asset:${a.name}`, 'g'),
            ...a
        }))

        for (let asset of assets) {
            source = source.replace(asset.trigger, asset.url)            
        }

        return source
    }
}

assets_app = express()

assets_app.get('/',
    async (req, res) => {
        const db = await open_db()
        const assets = new AssetsDB(db)

        res.render('assets', {
            user: req.user,
            assets: await assets.listAssets()
        })
    }
)

assets_app.post('/upload',
    upload.single('assetfile'),
    async (req, res) => {
        const db = await open_db()
        const assets = new AssetsDB(db)

        if (undefined !== await assets.getAsset(req.body.assetname)) {
            res.send(`Asset name ${req.body.assetname} is not unique!`)
            return
        }
        console.log(req.file)
        console.log(req.body)



        const accepted_mimes = ['image/png', 'image/gif', 'image/jpeg']

        if (accepted_mimes.indexOf(req.file.mimetype) === -1) {
            res.send(`mime type ${req.file.mimetype} not in [${accepted_mimes.join(', ')}]`)
            return 
        }

        let params = {
            Bucket: process.env.S3_BUCKET,
            Key: `mail/${req.body.assetname}.${req.file.mimetype.slice(6)}`,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: "public-read"
        };


        s3.putObject(params, async (err, data) => {
            if (err) {
                console.log(err, err.stack);
                res.send(err)
                return
            }

            const url = `https://${process.env.S3_BUCKET}.${process.env.S3_API_ENDPOINT}/${params.Key}`

            await assets.registerAsset(req.body.assetname, url, req.file.size)

            res.redirect(`/assets/object/${req.body.assetname}`)
        });

    }
)

assets_app.get('/object/:name',
    async (req, res) => {

        const db = await open_db()
        const assets = new AssetsDB(db)

        const asset = await assets.getAsset(req.params.name)

        if (asset === undefined) {
            res.redirect('/')
        } else {
            res.render('asset', {
                user: req.user,
                asset
            })
        }
    }
)

assets_app.get('/object/:name/delete',
    async (req, res) => {

        const db = await open_db()
        const assets = new AssetsDB(db)

        await assets.deleteAsset(req.params.name)

        res.redirect('/assets')
    }
)
module.exports = {assets_app, AssetsDB}
