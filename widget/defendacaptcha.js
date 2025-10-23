class DefendaCaptcha {
    constructor(options = {}) {
        // Default options
        this.options = {
            sitekey: '',
            theme: 'light',
            size: 'normal',
            callback: null,
            'expired-callback': null,
            'error-callback': null,
            ...options
        };

        // State
        this.isVerified = false;
        this.widgetId = 'defenda-captcha-' + Math.random().toString(36).substr(2, 9);
        this.challenge = this.generateChallenge();
        
        // Bind methods
        this.render = this.render.bind(this);
        this.verify = this.verify.bind(this);
        this.reset = this.reset.bind(this);
        this.execute = this.execute.bind(this);
    }

    generateChallenge() {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        return {
            question: `What is ${a} + ${b}?`,
            answer: (a + b).toString()
        };
    }

    render(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        
        if (!container) {
            console.error('DefendaCaptcha: Container element not found');
            return;
        }

        // Create widget HTML
        const widgetHTML = `
            <div id="${this.widgetId}" class="defenda-captcha ${this.options.theme} ${this.options.size}">
                <div class="defenda-captcha-checkbox">
                    <div class="defenda-captcha-checkbox-checkmark">
                        <svg viewBox="0 0 24 24" width="28" height="28">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#fff"/>
                        </svg>
                    </div>
                </div>
                <div class="defenda-captcha-text">I'm not a robot</div>
                <div class="defenda-captcha-logo">
                    <span>Defenda</span>
                    <span>privacy</span>
                </div>
            </div>
            <div class="defenda-captcha-challenge" style="display: none;">
                <div class="defenda-captcha-challenge-question">${this.challenge.question}</div>
                <input type="text" class="defenda-captcha-challenge-input" placeholder="Type your answer">
                <button class="defenda-captcha-challenge-verify">Verify</button>
                <div class="defenda-captcha-error"></div>
            </div>
        `;

        // Add to container
        container.innerHTML = widgetHTML;
        
        // Add event listeners
        this.attachEvents();
    }

    attachEvents() {
        const widget = document.getElementById(this.widgetId);
        if (!widget) return;

        // Checkbox click
        const checkbox = widget.querySelector('.defenda-captcha-checkbox');
        if (checkbox) {
            checkbox.addEventListener('click', () => {
                if (this.isVerified) return;
                widget.classList.add('active');
                widget.nextElementSibling.style.display = 'block';
            });
        }

        // Verify button click
        const verifyBtn = widget.nextElementSibling?.querySelector('.defenda-captcha-challenge-verify');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', this.verify);
        }

        // Input enter key
        const input = widget.nextElementSibling?.querySelector('.defenda-captcha-challenge-input');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.verify();
                }
            });
        }
    }

    verify() {
        const widget = document.getElementById(this.widgetId);
        if (!widget) return;
        
        const input = widget.nextElementSibling?.querySelector('.defenda-captcha-challenge-input');
        const errorEl = widget.nextElementSibling?.querySelector('.defenda-captcha-error');
        
        if (!input) return;
        
        const answer = input.value.trim();
        
        if (answer === this.challenge.answer) {
            // Success
            this.isVerified = true;
            widget.classList.add('verified');
            widget.nextElementSibling.style.display = 'none';
            
            // Call the callback if provided
            if (typeof this.options.callback === 'function') {
                this.options.callback('defenda-captcha-token');
            }
        } else {
            // Show error
            if (errorEl) {
                errorEl.textContent = 'Incorrect answer. Please try again.';
                errorEl.style.display = 'block';
                
                // Shake animation
                const challenge = widget.nextElementSibling;
                challenge.style.animation = 'defenda-shake 0.5s';
                setTimeout(() => {
                    challenge.style.animation = '';
                }, 500);
                
                // Call error callback if provided
                if (typeof this.options['error-callback'] === 'function') {
                    this.options['error-callback']('incorrect-answer');
                }
            }
        }
    }

    reset() {
        this.isVerified = false;
        this.challenge = this.generateChallenge();
        
        const widget = document.getElementById(this.widgetId);
        if (!widget) return;
        
        widget.classList.remove('verified', 'active');
        
        const challenge = widget.nextElementSibling;
        if (challenge) {
            challenge.style.display = 'none';
            const input = challenge.querySelector('.defenda-captcha-challenge-input');
            const errorEl = challenge.querySelector('.defenda-captcha-error');
            if (input) input.value = '';
            if (errorEl) errorEl.textContent = '';
        }
        
        // Call expired callback if provided
        if (typeof this.options['expired-callback'] === 'function') {
            this.options['expired-callback']();
        }
    }

    execute() {
        if (this.isVerified) {
            return Promise.resolve('defenda-captcha-token');
        }
        
        return new Promise((resolve, reject) => {
            // Store the original callback
            const originalCallback = this.options.callback;
            
            // Set a new callback that resolves the promise
            this.options.callback = (token) => {
                if (originalCallback) {
                    originalCallback(token);
                }
                resolve(token);
            };
            
            // Show the challenge if not already shown
            const widget = document.getElementById(this.widgetId);
            if (widget && !widget.classList.contains('active')) {
                widget.classList.add('active');
                const challenge = widget.nextElementSibling;
                if (challenge) {
                    challenge.style.display = 'block';
                }
            }
        });
    }
}

// Auto-initialize widgets with data-sitekey attribute
document.addEventListener('DOMContentLoaded', () => {
    const captchaElements = document.querySelectorAll('[data-sitekey]');
    captchaElements.forEach((el) => {
        const options = {
            sitekey: el.getAttribute('data-sitekey'),
            theme: el.getAttribute('data-theme') || 'light',
            size: el.getAttribute('data-size') || 'normal',
            callback: window[el.getAttribute('data-callback')],
            'expired-callback': window[el.getAttribute('data-expired-callback')],
            'error-callback': window[el.getAttribute('data-error-callback')]
        };
        
        const captcha = new DefendaCaptcha(options);
        captcha.render(el);
        
        // Make captcha instance available on the element
        el.defendaCaptcha = captcha;
    });
});

// Make DefendaCaptcha available globally
window.DefendaCaptcha = DefendaCaptcha;
