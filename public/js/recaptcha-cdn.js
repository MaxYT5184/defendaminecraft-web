/**
 * DefendAMinecraft reCAPTCHA CDN Library
 * Easy-to-use client library for web integration
 * Version: 1.0.0
 */

(function(window, document) {
    'use strict';

    // Configuration
    const API_BASE_URL = window.location.origin;
    
    // Global state
    let isReady = false;
    let readyCallbacks = [];
    let widgets = new Map();
    let widgetCounter = 0;

    // CSS Styles
    const CSS_STYLES = `
        .da-recaptcha {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.4;
            user-select: none;
            display: inline-block;
        }

        .da-recaptcha-container {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 8px;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
            cursor: pointer;
            min-width: 280px;
        }

        .da-recaptcha-container:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: #00d4ff;
        }

        .da-checkbox {
            position: relative;
            width: 24px;
            height: 24px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            background: transparent;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .da-checkbox:hover {
            border-color: #00d4ff;
            background: rgba(0, 212, 255, 0.1);
        }

        .da-checkbox.loading {
            border-color: #00d4ff;
            background: rgba(0, 212, 255, 0.1);
        }

        .da-checkbox.checked {
            background: linear-gradient(135deg, #00d4ff 0%, #5b73ff 100%);
            border-color: #00d4ff;
        }

        .da-checkbox.error {
            background: #ef4444;
            border-color: #ef4444;
        }

        .da-checkbox-checkmark {
            opacity: 0;
            transform: scale(0.5);
            transition: all 0.3s ease;
        }

        .da-checkbox.checked .da-checkbox-checkmark {
            opacity: 1;
            transform: scale(1);
        }

        .da-checkbox-spinner {
            position: absolute;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .da-checkbox.loading .da-checkbox-spinner {
            opacity: 1;
        }

        .da-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(0, 212, 255, 0.3);
            border-top: 2px solid #00d4ff;
            border-radius: 50%;
            animation: da-spin 1s linear infinite;
        }

        @keyframes da-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .da-text {
            flex: 1;
            color: rgba(255, 255, 255, 0.8);
            font-weight: 500;
        }

        .da-logo {
            text-align: right;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            line-height: 1.2;
        }

        .da-logo-text {
            font-weight: 600;
            color: #00d4ff;
        }

        .da-recaptcha-compact .da-recaptcha-container {
            padding: 8px 12px;
            min-width: 200px;
        }

        .da-recaptcha-compact .da-checkbox {
            width: 20px;
            height: 20px;
            margin-right: 8px;
        }

        .da-recaptcha-compact .da-text {
            font-size: 12px;
        }

        .da-theme-light .da-recaptcha-container {
            background: rgba(255, 255, 255, 0.9);
            border-color: rgba(0, 0, 0, 0.2);
            color: #333;
        }

        .da-theme-light .da-text {
            color: #333;
        }

        .da-theme-light .da-checkbox {
            border-color: rgba(0, 0, 0, 0.3);
        }

        .da-recaptcha.verified .da-recaptcha-container {
            background: rgba(34, 197, 94, 0.1);
            border-color: #22c55e;
        }

        .da-recaptcha.error .da-recaptcha-container {
            background: rgba(239, 68, 68, 0.1);
            border-color: #ef4444;
        }
    `;

    // Load CSS
    function loadStyles() {
        if (document.getElementById('da-recaptcha-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'da-recaptcha-styles';
        style.textContent = CSS_STYLES;
        document.head.appendChild(style);
    }

    // Generate widget ID
    function generateWidgetId() {
        return 'da-widget-' + (++widgetCounter);
    }

    // API calls
    async function getChallenge(siteKey) {
        const response = await fetch(`${API_BASE_URL}/api/v1/challenge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': siteKey
            },
            body: JSON.stringify({
                type: 'checkbox',
                difficulty: 'medium'
            })
        });

        if (!response.ok) {
            throw new Error(`Challenge request failed: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to get challenge');
        }

        return data.challenge;
    }

    async function verifyChallenge(siteKey, challenge) {
        const response = await fetch(`${API_BASE_URL}/api/v1/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': siteKey
            },
            body: JSON.stringify({
                token: challenge.token,
                response: 'user_interaction',
                userAgent: navigator.userAgent,
                timestamp: Date.now()
            })
        });

        if (!response.ok) {
            throw new Error(`Verification request failed: ${response.statusText}`);
        }

        return await response.json();
    }

    // Create widget HTML
    function createWidget(widgetId, config) {
        const widget = document.createElement('div');
        widget.className = `da-recaptcha da-recaptcha-${config.size || 'normal'} da-theme-${config.theme || 'dark'}`;
        widget.setAttribute('data-widget-id', widgetId);
        widget.setAttribute('data-sitekey', config.sitekey);
        
        widget.innerHTML = `
            <div class="da-recaptcha-container">
                <div class="da-checkbox" role="checkbox" aria-checked="false" tabindex="${config.tabindex || 0}">
                    <div class="da-checkbox-checkmark">
                        <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                            <path d="M1 5.5L5 9.5L13 1.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="da-checkbox-spinner">
                        <div class="da-spinner"></div>
                    </div>
                </div>
                <div class="da-text">I'm not a robot</div>
                <div class="da-logo">
                    <div class="da-logo-text">DefendAMinecraft</div>
                    <div class="da-logo-subtext">reCAPTCHA</div>
                </div>
            </div>
        `;

        return widget;
    }

    // Set up widget events
    function setupWidgetEvents(widgetId, config) {
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widget) return;

        const checkbox = widget.querySelector('.da-checkbox');
        if (!checkbox) return;

        checkbox.addEventListener('click', async () => {
            if (checkbox.classList.contains('checked') || checkbox.classList.contains('loading')) {
                return;
            }

            try {
                checkbox.classList.add('loading');
                checkbox.setAttribute('aria-checked', 'false');
                
                const text = widget.querySelector('.da-text');
                if (text) text.textContent = 'Verifying...';

                // Simulate verification delay
                await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

                const challenge = await getChallenge(config.sitekey);
                const response = await verifyChallenge(config.sitekey, challenge);

                if (response.success && response.token) {
                    checkbox.classList.remove('loading');
                    checkbox.classList.add('checked');
                    checkbox.setAttribute('aria-checked', 'true');
                    widget.setAttribute('data-response', response.token);
                    widget.classList.add('verified');
                    
                    if (text) text.textContent = 'Verified';
                    
                    // Store widget data
                    widgets.set(widgetId, {
                        ...config,
                        token: response.token,
                        verified: true
                    });
                    
                    if (config.callback) {
                        config.callback(response.token);
                    }
                } else {
                    throw new Error(response.error || 'Verification failed');
                }
            } catch (error) {
                checkbox.classList.remove('loading');
                checkbox.classList.add('error');
                widget.classList.add('error');
                
                const text = widget.querySelector('.da-text');
                if (text) text.textContent = 'Verification failed';
                
                if (config['error-callback']) {
                    config['error-callback'](error);
                }
                
                // Reset after 3 seconds
                setTimeout(() => {
                    DefendAMinecraft.reset(widgetId);
                }, 3000);
            }
        });

        // Keyboard support
        checkbox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                checkbox.click();
            }
        });
    }

    // Main DefendAMinecraft object
    window.DefendAMinecraft = {
        render: function(container, config) {
            if (!config || !config.sitekey) {
                throw new Error('sitekey is required');
            }

            const element = typeof container === 'string' 
                ? document.getElementById(container) || document.querySelector(container)
                : container;

            if (!element) {
                throw new Error('Container element not found');
            }

            const widgetId = generateWidgetId();
            const widget = createWidget(widgetId, config);
            
            element.innerHTML = '';
            element.appendChild(widget);

            setupWidgetEvents(widgetId, config);

            widgets.set(widgetId, {
                ...config,
                element: element,
                verified: false
            });

            return widgetId;
        },

        getResponse: function(widgetId) {
            if (widgetId) {
                const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
                return widget ? widget.getAttribute('data-response') : null;
            }
            
            // If no widgetId provided, get first verified widget
            for (const [id, data] of widgets) {
                if (data.verified) {
                    const widget = document.querySelector(`[data-widget-id="${id}"]`);
                    return widget ? widget.getAttribute('data-response') : null;
                }
            }
            
            return null;
        },

        reset: function(widgetId) {
            const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
            if (!widget) return;

            widget.removeAttribute('data-response');
            widget.classList.remove('verified', 'expired', 'error');
            
            const checkbox = widget.querySelector('.da-checkbox');
            const text = widget.querySelector('.da-text');
            
            if (checkbox && text) {
                checkbox.classList.remove('checked', 'loading', 'error');
                checkbox.setAttribute('aria-checked', 'false');
                text.textContent = "I'm not a robot";
            }

            // Update widget data
            const widgetData = widgets.get(widgetId);
            if (widgetData) {
                widgets.set(widgetId, {
                    ...widgetData,
                    token: null,
                    verified: false
                });
            }
        },

        ready: function(callback) {
            if (isReady) {
                callback();
            } else {
                readyCallbacks.push(callback);
            }
        }
    };

    // Initialize when DOM is ready
    function init() {
        loadStyles();
        isReady = true;
        
        // Execute ready callbacks
        readyCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('DefendAMinecraft ready callback error:', error);
            }
        });
        readyCallbacks = [];

        // Auto-render widgets with data attributes
        document.querySelectorAll('[data-sitekey]').forEach(element => {
            if (element.hasAttribute('data-auto-render')) {
                const config = {
                    sitekey: element.getAttribute('data-sitekey'),
                    theme: element.getAttribute('data-theme') || 'dark',
                    size: element.getAttribute('data-size') || 'normal',
                    tabindex: parseInt(element.getAttribute('data-tabindex')) || 0
                };

                // Get callback functions from global scope
                const callbackName = element.getAttribute('data-callback');
                const errorCallbackName = element.getAttribute('data-error-callback');
                const expiredCallbackName = element.getAttribute('data-expired-callback');

                if (callbackName && window[callbackName]) {
                    config.callback = window[callbackName];
                }
                if (errorCallbackName && window[errorCallbackName]) {
                    config['error-callback'] = window[errorCallbackName];
                }
                if (expiredCallbackName && window[expiredCallbackName]) {
                    config['expired-callback'] = window[expiredCallbackName];
                }

                DefendAMinecraft.render(element, config);
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Execute onload callback if defined
    if (window.daRecaptchaOnLoad) {
        window.daRecaptchaOnLoad();
    }

})(window, document);
