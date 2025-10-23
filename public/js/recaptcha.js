class RecaptchaWidget {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' 
            ? document.getElementById(container) 
            : container;
            
        this.options = {
            callback: null,
            'expired-callback': null,
            'error-callback': null,
            ...options
        };

        this.isVerified = false;
        this.widgetId = 'recaptcha-widget-' + Math.random().toString(36).substr(2, 9);
        
        this.init();
    }

    init() {
        if (!this.container) return;

        // Create widget HTML
        this.container.innerHTML = `
            <div id="${this.widgetId}" class="recaptcha-container">
                <div class="recaptcha-widget" tabindex="0" role="checkbox" aria-checked="false" aria-label="I'm not a robot">
                    <div class="recaptcha-checkbox">
                        <div class="recaptcha-checkbox-checkmark">✓</div>
                    </div>
                    <div class="recaptcha-text">I'm not a robot</div>
                    <div class="recaptcha-logo">
                        <span>reCAPTCHA</span>
                        <span>Privacy - Terms</span>
                    </div>
                </div>
            </div>
        `;

        // Cache DOM elements
        this.widget = this.container.querySelector('.recaptcha-widget');
        this.checkbox = this.container.querySelector('.recaptcha-checkbox');
        this.text = this.container.querySelector('.recaptcha-text');
        
        // Add event listeners
        this.addEventListeners();
    }

    addEventListeners() {
        if (!this.widget) return;

        // Widget click
        this.widget.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleVerification();
        });
        
        // Handle keyboard navigation
        this.widget.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleVerification();
            }
        });
    }

    toggleVerification() {
        if (this.isVerified) return;
        this.verify();
    }

    verify() {
        if (this.isVerified) return;
        
        // Show loading state
        this.widget.classList.add('recaptcha-loading');
        this.widget.setAttribute('aria-busy', 'true');
        
        // Simulate verification delay
        setTimeout(() => {
            this.isVerified = true;
            this.checkbox.classList.add('checked');
            this.widget.classList.remove('recaptcha-loading');
            this.widget.setAttribute('aria-checked', 'true');
            this.widget.setAttribute('aria-busy', 'false');
            
            // Call the success callback
            if (typeof this.options.callback === 'function') {
                this.options.callback(this.getResponse());
            }
        }, 1000);
    }

    // Reset the reCAPTCHA widget
    reset() {
        this.isVerified = false;
        this.checkbox.classList.remove('checked');
        this.widget.classList.remove('recaptcha-loading');
        this.widget.setAttribute('aria-checked', 'false');
        this.widget.setAttribute('aria-busy', 'false');
        
        // Call the expired callback
        if (typeof this.options['expired-callback'] === 'function') {
            this.options['expired-callback']();
        }
    }

    getResponse() {
        return this.isVerified 
            ? 'recaptcha-token-' + Math.random().toString(36).substr(2, 10) 
            : '';
    }
}

// Auto-initialization
document.addEventListener('DOMContentLoaded', () => {
    const captchaElements = document.querySelectorAll('[data-sitekey]');
    captchaElements.forEach((el) => {
        const options = {
            callback: window[el.getAttribute('data-callback')],
            'expired-callback': window[el.getAttribute('data-expired-callback')],
            'error-callback': window[el.getAttribute('data-error-callback')]
        };
        
        const captcha = new RecaptchaWidget(el, options);
        el.recaptchaWidget = captcha;
    });
});

// Make RecaptchaWidget available globally
window.RecaptchaWidget = RecaptchaWidget;
