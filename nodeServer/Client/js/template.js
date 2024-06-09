import { watchTemplate }        from '../template/watchTemplate.js';
import { navigationTemplate}    from '../template/navigationTemplate.js'
import { moveLogTemplate }      from '../template/moveLogTemplate.js';
import { chatTemplate }         from '../template/chatTemplate.js';
import { checkMateTemplate }    from '../template/gameRModalTemplate.js';
import { staleMateTemplate }    from '../template/gameRModalTemplate.js';
import { themeTemplate }        from '../template/themeTemplate.js';
import { leaderTemplate }       from '../template/leaderTemplate.js';
import { personalTemplate }     from '../template/personalTemplate.js';
import { aichatTemplate }       from '../template/aichatTemplate.js';

class watchComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = watchTemplate;
    }
}

class navigationComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = navigationTemplate;
    }
}

class moveLogComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = moveLogTemplate;
    }
}

class chatComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = chatTemplate;
    }
}

class checkMateModalComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = checkMateTemplate;
    }
}

class staleMateModalComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = staleMateTemplate;
    }
}

class themeComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = themeTemplate;
    }
}

class leaderComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = leaderTemplate;
    }
}

class personalComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = personalTemplate;
    }
}

class aichatComponent extends HTMLElement {
    connectedCallback() {
        this.innerHTML = aichatTemplate;
    }
}

customElements.define('watch-component',            watchComponent);
customElements.define('navigation-component',       navigationComponent);
customElements.define('move-log-component',         moveLogComponent);
customElements.define('chat-component',             chatComponent);
customElements.define('checkmate-modal-component',  checkMateModalComponent);
customElements.define('stalemate-modal-component',  staleMateModalComponent);
customElements.define('theme-popup-component',      themeComponent);
customElements.define('leader-popup-component',     leaderComponent);
customElements.define('personal-popup-component',   personalComponent);
customElements.define('aichat-popup-component',     aichatComponent);