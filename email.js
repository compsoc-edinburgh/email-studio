const express    = require('express')
const bodyparser = require('body-parser')
const open_db    = require('./db')
const mjml2html  = require('mjml')
const {v4: uuidv4} = require('uuid')
const {AssetsDB} = require('./assets')
const FormData   = require('form-data')
const qs         = require('qs')
const axios      = require('axios')

const json_parser = bodyparser.json()
const form_parser = bodyparser.urlencoded({extended: true})

class MailDB {
    constructor(db) {
        if (!db) {
            throw new Error('A database is required to construct the ORM!')
        }
        this.db = db
    }

    __format_email_row(row) {
        const email_obj = {...row}

        // force to bool
        email_obj.is_template = email_obj.is_template == 1
        email_obj.lastused = parseInt(email_obj.lastused)

        // create date
        const ldate = new Date(email_obj.lastused)
        email_obj['lastused_str'] = `${ldate.getUTCFullYear()}-${1 + ldate.getUTCMonth()}-${ldate.getUTCDate()}`

        return email_obj
    }
    
    async getEmail(uuid) {
        const row = await this.db.get(`
            SELECT uuid, lastused, body, subject, is_template
                FROM Emails
                WHERE uuid=?
        `, [uuid])

        return this.__format_email_row(row)
    }

    async createNewEmail(body, subject) {
        /**
         * Create a new email with the subject and body
         *
         * @param {str} body  MJML source string
         * @param {str} subject Subject line
         * @return {str} UUID of new email 
         */

        const new_id = uuidv4()
        const lastused = Date.now()

        const result = await this.db.run(`
            INSERT INTO Emails
                (uuid, lastused, body, subject, is_template)
                VALUES (?,?,?,?,?)
        `, [new_id, lastused, body, subject, 0]
        )

        return new_id
    }

    async saveEmail(uuid, body, subject) {
        /**
         * Update an existing email
         */

        const lastused = Date.now()
        await this.db.run(`
            UPDATE Emails
                SET lastused=?, body=?, subject=?
                WHERE uuid=?
        `, [lastused,body,subject,uuid])

        return uuid
    }

    async emailExists(uuid) {
        const row = await this.db.get(`
            SELECT * FROM Emails WHERE uuid=?
        `, [uuid])

        return row !== undefined
    }

    async deleteEmail(uuid) {
        if (!(await this.emailExists(uuid))) {
            return true
        }

        await this.db.run(`DELETE FROM Emails WHERE uuid=?`, [uuid])

        return true
    }

    async getAllEmails() {
        const rows = await this.db.all(`
            SELECT * FROM Emails ORDER BY lastused DESC
        `)

        const out = rows.map(this.__format_email_row)

        return out
    }

    async updateMetadata(uuid, subject, is_template) {
        const lastused = Date.now()
        await this.db.run(`
            UPDATE Emails
                SET lastused=?, is_template=?, subject=?
                WHERE uuid=?
        `, [lastused,is_template,subject,uuid])

        return uuid
    }

    async cloneEmail(uuid) {
        const email = await this.getEmail(uuid)

        return await this.createNewEmail(email.body, `${email.subject} (copy)`)
    }

    async renderEmail(uuid) {
        const email = await this.getEmail(uuid)
        const assets = new AssetsDB(this.db)

        try {
            let compiled = await assets.renderString(email.body)
            compiled = mjml2html(compiled).html

            return compiled
        } catch (e) {
            return 'compile failed--check your mjml!'
        }
    }
}

const mail_app = express()

const email_must_exist = async (req, res, next) => {
    const db = await open_db()
    const mail = new MailDB(db)
    
    req.db = db
    req.mail = mail
    
    if (!(await mail.emailExists(req.params.slug))) {
        res.redirect('/404')
    } else {
        req.email = await mail.getEmail(req.params.slug)
        next()
    }
}

mail_app.get('/edit/:slug',
    async (req, res) => {
        const db = await open_db()
        const mail = new MailDB(db)
        const assets = new AssetsDB(db)
        if (req.params.slug == 'new') {
            const id = await mail.createNewEmail('test', 'Hello World!');
            res.redirect(`/edit/${id}`)
        } else if (!(await mail.emailExists(req.params.slug))) {
            res.redirect('/dashboard')
        } else {
            const email = await mail.getEmail(req.params.slug)

            res.render('editor', {
                user: req.user,
                email,
                assets: await assets.listAssets()
            })
        }

    }
)

mail_app.get('/edit/:slug/clone',
    email_must_exist,
    async (req, res) => {

        const id = await req.mail.cloneEmail(req.params.slug)
        res.redirect(`/edit/${id}`)
    }
)

mail_app.get('/edit/:slug/delete',
    email_must_exist,
    async (req,res) => {

        res.render('delete', {
            user: req.user,
            email: req.email
        })
    }
)

mail_app.get('/edit/:slug/delete/confirm',
    email_must_exist,
    async (req,res) => {
        await mail.deleteEmail(req.email.uuid)

        res.redirect('/dashboard')
    }
)

mail_app.post('/edit/:slug/save',
    json_parser,
    async (req, res) => {
        const mail = new MailDB(await open_db())
        await mail.saveEmail(req.params.slug, req.body.body, req.body.subject)
        res.json({success: true})
    }
)

mail_app.post('/edit/:slug/metadata',
    form_parser,
    async (req, res) => {
        const mail = new MailDB(await open_db())
        console.log(req.body)
        await mail.updateMetadata(req.params.slug, req.body.subject, req.body.is_template === 'on')
        res.redirect(`/edit/${req.params.slug}`)
    }
)

mail_app.get('/edit/:slug/render',
    email_must_exist,
    async (req, res) => {
        res.send(await req.mail.renderEmail(req.email.uuid))
    }
)

mail_app.get('/edit/:slug/export',
    email_must_exist,
    async (req, res) => {
        const brands = process.env['SENDY_BRANDS']
            .split(',')
            .map(s => {
                const [id, name] = s.split(':')
                return {id, name}
            })

        res.render('export', {
            email: req.email,
            user: req.user,
            brands
        })
    }
)

mail_app.post('/edit/:slug/export',
    email_must_exist,
    form_parser,
    async (req, res) => {


        // create form data
        const form = new FormData()
        form.append('api_key', process.env['SENDY_API_KEY'])
        form.append('from_name', req.body.from_name)
        form.append('from_email', req.body.from_email)
        form.append('reply_to', req.body.reply_to)
        form.append('title', req.body.title)
        form.append('brand_id', req.body.brand_id)
        form.append('html_text', await req.mail.renderEmail(req.email.uuid))
        form.append('subject', req.email.subject)

        console.log('Exporting form...', form.getBuffer().toString())


        const resp = await axios.post(
            `${process.env['SENDY_SERVER']}/api/campaigns/create.php`,
            form.getBuffer(),
            {headers: form.getHeaders()}
        )

        console.log('stringifying resp', resp.data)

        const msg_str = qs.stringify({msg: resp.data})

        res.redirect(`/edit/${req.params.slug}/export/done?${msg_str}`)

    }
)

mail_app.get('/edit/:slug/export/done',
    email_must_exist,
    async (req, res) => {
        res.render('exported', {
            email: req.email,
            user: req.user,
            msg: req.query.msg,
            sendy_url: process.env['SENDY_SERVER']
        })
    }
)


module.exports = {MailDB, mail_app}
