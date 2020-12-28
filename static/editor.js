const mjml_autocompletes = [
    'mjml', 'mj-head', 'mj-body', 'mj-include', 'mj-attributes', 'mj-breakpoint', 'mj-font', 'mj-html-attributes', 'mj-preview', 'mj-style', 'mj-title', 'mj-accordion', 'mj-button', 'mj-carousel', 'mj-column', 'mj-divider', 'mj-group', 'mj-hero', 'mj-image', 'mj-navbar', 'mj-raw', 'mj-section', 'mj-social', 'mj-spacer', 'mj-table', 'mj-text', 'mj-wrapper'
]

const staticWordCompleter = {
    getCompletions: function(editor, session, pos, prefix, callback) {
        callback(null, [...mjml_autocompletes.map(word => {
            return {
                caption: word,
                value: word,
                meta: "static"
            }
        })])
    }
}



class EmailEditor {
    constructor() {
        this.attach()
        this.subject = document.querySelector('.editorpage__title').innerText

        this.dirty = false
    }

    attach() {
        // create autocompleter
        this.langtools = ace.require("ace/ext/language_tools");
        this.langtools.setCompleters([staticWordCompleter])

        // create editor
        this.editor = ace.edit("editor", {
            enableBasicAutocompletion: true,
            enableLiveAutocompletion: true,
            behavioursEnabled: true,
            wrapBehavioursEnabled: true,  // wrap text to view
            wrap: true
        });
        this.editor.session.setMode("ace/mode/xml")
        this.editor.setTheme("ace/theme/tomorrow")

        this.selectKeybinding(localStorage.getItem('editor__keybinding'))

        // editor event setup
        this.editor.on('change', () => {this.dirty = true})


        // renderer setup
        this.iframe = document.querySelector('#renderer')
        this.iframe.src = window.location.pathname + '/render'

        // modal setup
        this.assets_modal = document.querySelector('#assets_modal')
        this.metadata_modal = document.querySelector('#metadata_modal')
        document.querySelectorAll('.modal-close')
            .forEach(el => el.addEventListener('click', () => this.closeModals()))

        // button events and stuff
        this.save_btn = document.querySelector('#save_btn')
        this.render_btn = document.querySelector('#render_btn')
        this.metadata_btn = document.querySelector('#metadata_btn')
        this.assets_btn = document.querySelector('#assets_btn')

        this.save_btn
            .addEventListener('click', () => this.save())
        this.render_btn
            .addEventListener('click', () => this.render())
        this.assets_btn
            .addEventListener('click', () => this.openAssetsModal())
        this.metadata_btn
            .addEventListener('click', () => this.openMetadataModal())

        // metadata form
        this.metadata_form = document.querySelector('#metadata_form')
        this.metadata_form_submit = document.querySelector('#metadata_form_submit')
        this.metadata_form_submit
            .addEventListener('click', () => this.submitMetadata())

        // editor keybind
        this.keybind_select = document.querySelector('#keybind_select')
        this.keybind_select.value = localStorage.getItem('editor__keybinding') ?? 'normal'
        this.keybind_select
            .addEventListener('change', e => {
                this.selectKeybinding(this.keybind_select.value)
            })

        // navigate away events
        window.addEventListener('beforeunload', e => {
            if (this.dirty) {
                e.preventDefault()
                return `You have unsaved changes!`
            }
        })

        window.addEventListener('keyup', e => {
            if (e.key === 'Escape') {
                this.closeModals()
            }
        })

        // misc setup
        this.editor.session.on(':write', () => {
            console.log('writing...')
        })

        this.editor.commands.addCommand({
            name: 'save',
            bindKey: {win: "Ctrl-S", "mac": "Cmd-S"},
            exec: () => this.render()
        })
        this.editor.commands.addCommand({
            name: 'render',
            bindKey: {win: "Shift-Enter", "mac": "Shift-Enter"},
            exec: () => this.render()
        })
        ace.config.loadModule("ace/keyboard/vim", m => {
            var VimApi = require("ace/keyboard/vim").CodeMirror.Vim
            VimApi.defineEx("write", "w", (cm, input) => {
                cm.ace.execCommand("save")
            })
        })

    }

    async save() {
        const body = this.editor.getValue()
        const subject = this.subject

        this.save_btn.classList.add('is-loading')

        let res = await fetch(window.location.pathname + '/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({
                body,
                subject
            })
        })

        res = await res.json()

        this.dirty = false

        this.save_btn.classList.remove('is-loading')
        console.log(res)
    }

    async render() {
        await this.save()
        this.iframe.src = window.location.pathname + '/render'
    }

    openMetadataModal() {
        document.body.classList.add('is-clipped')
        this.metadata_modal.classList.add('is-active')
    }

    openAssetsModal() {
        document.body.classList.add('is-clipped')
        this.assets_modal.classList.add('is-active')
    }

    closeModals() {
        document.body.classList.remove('is-clipped')
        document.querySelectorAll('.modal')
            .forEach(el => el.classList.remove('is-active'))
    }

    async submitMetadata() {
        await this.save()

        this.metadata_form.submit()
    }

    selectKeybinding(binding) {
        if (binding === undefined || binding === 'normal') {
            this.editor.setKeyboardHandler('ace/keyboard/textinput')
            binding = 'normal'
        } else if (binding === 'vim') {
            this.editor.setKeyboardHandler('ace/keyboard/vim')
        } else if (binding === 'emacs') {
            this.editor.setKeyboardHandler('ace/keyboard/emacs')
        }

        localStorage.setItem('editor__keybinding', binding)
    }
}

window.ee = new EmailEditor()
