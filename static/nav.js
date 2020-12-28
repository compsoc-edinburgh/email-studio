document.querySelectorAll('.navbar-burger')
    .forEach(el => {
        el.addEventListener('click', e => {
            el.classList.toggle('is-active')
            document.querySelector('.navbar-menu')
                .classList.toggle('is-active')
        })
    })
