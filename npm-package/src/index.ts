/**
 * DefendAMinecraft reCAPTCHA Client Library
 * Advanced bot protection with superior performance and user experience
 */

export interface RecaptchaConfig {
  siteKey: string;
  apiUrl?: string;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
  callback?: (token: string) => void;
  expiredCallback?: () => void;
  errorCallback?: (error: Error) => void;
  badge?: 'bottomright' | 'bottomleft' | 'inline';
  tabindex?: number;
  isolated?: boolean;
}

export interface VerificationResponse {
  success: boolean;
  token?: string;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  verification_time?: number;
  error?: string;
}

export interface ChallengeData {
  token: string;
  type: string;
  expires_in: number;
}

export class DefendAMinecraftRecaptcha {
  private config: RecaptchaConfig;
  private apiUrl: string;
  private widgetId: string | null = null;
  private isReady: boolean = false;
  private readyCallbacks: (() => void)[] = [];
  private currentChallenge: ChallengeData | null = null;

  constructor(config: RecaptchaConfig) {
    this.config = {
      apiUrl: 'https://api.defendaminecraft.online',
      theme: 'auto',
      size: 'normal',
      badge: 'bottomright',
      tabindex: 0,
      isolated: false,
      ...config
    };
    
    this.apiUrl = this.config.apiUrl!;
    this.init();
  }

  /**
   * Initialize the reCAPTCHA system
   */
  private async init(): Promise<void> {
    try {
      // Load CSS styles
      this.loadStyles();
      
      // Set up global callback functions
      this.setupGlobalCallbacks();
      
      this.isReady = true;
      this.readyCallbacks.forEach(callback => callback());
      this.readyCallbacks = [];
    } catch (error) {
      console.error('DefendAMinecraft reCAPTCHA initialization failed:', error);
      this.config.errorCallback?.(error as Error);
    }
  }

  /**
   * Render reCAPTCHA widget in specified container
   */
  public render(container: string | HTMLElement, config?: Partial<RecaptchaConfig>): string {
    const finalConfig = { ...this.config, ...config };
    const element = typeof container === 'string' 
      ? document.getElementById(container) || document.querySelector(container)
      : container;

    if (!element) {
      throw new Error('Container element not found');
    }

    const widgetId = this.generateWidgetId();
    
    // Create widget HTML
    const widget = this.createWidget(widgetId, finalConfig);
    element.innerHTML = '';
    element.appendChild(widget);

    // Set up event listeners
    this.setupWidgetEvents(widgetId, finalConfig);

    this.widgetId = widgetId;
    return widgetId;
  }

  /**
   * Get response token from completed challenge
   */
  public getResponse(widgetId?: string): string | null {
    const id = widgetId || this.widgetId;
    if (!id) return null;

    const widget = document.querySelector(`[data-widget-id="${id}"]`);
    return widget?.getAttribute('data-response') || null;
  }

  /**
   * Reset the reCAPTCHA widget
   */
  public reset(widgetId?: string): void {
    const id = widgetId || this.widgetId;
    if (!id) return;

    const widget = document.querySelector(`[data-widget-id="${id}"]`) as HTMLElement;
    if (widget) {
      widget.removeAttribute('data-response');
      widget.classList.remove('verified', 'expired', 'error');
      
      const checkbox = widget.querySelector('.da-checkbox') as HTMLElement;
      const text = widget.querySelector('.da-text') as HTMLElement;
      
      if (checkbox && text) {
        checkbox.classList.remove('checked', 'loading');
        text.textContent = "I'm not a robot";
      }
    }

    this.currentChallenge = null;
  }

  /**
   * Execute reCAPTCHA (for invisible mode)
   */
  public async execute(action?: string): Promise<string> {
    if (!this.isReady) {
      await this.waitForReady();
    }

    try {
      const challenge = await this.getChallenge();
      const response = await this.performVerification(challenge, action);
      
      if (response.success && response.token) {
        return response.token;
      } else {
        throw new Error(response.error || 'Verification failed');
      }
    } catch (error) {
      this.config.errorCallback?.(error as Error);
      throw error;
    }
  }

  /**
   * Check if reCAPTCHA is ready
   */
  public ready(callback: () => void): void {
    if (this.isReady) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  /**
   * Get challenge from API
   */
  private async getChallenge(): Promise<ChallengeData> {
    const response = await fetch(`${this.apiUrl}/api/v1/challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.siteKey
      },
      body: JSON.stringify({
        type: this.config.size === 'invisible' ? 'invisible' : 'checkbox',
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

  /**
   * Perform verification with API
   */
  private async performVerification(challenge: ChallengeData, action?: string): Promise<VerificationResponse> {
    const response = await fetch(`${this.apiUrl}/api/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.siteKey
      },
      body: JSON.stringify({
        token: challenge.token,
        response: 'user_interaction',
        action: action || 'submit',
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`Verification request failed: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create widget HTML element
   */
  private createWidget(widgetId: string, config: RecaptchaConfig): HTMLElement {
    const widget = document.createElement('div');
    widget.className = `da-recaptcha da-recaptcha-${config.size} da-theme-${config.theme}`;
    widget.setAttribute('data-widget-id', widgetId);
    widget.setAttribute('data-sitekey', config.siteKey);
    
    if (config.size === 'invisible') {
      widget.style.display = 'none';
      return widget;
    }

    widget.innerHTML = `
      <div class="da-recaptcha-container">
        <div class="da-checkbox" role="checkbox" aria-checked="false" tabindex="${config.tabindex}">
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

  /**
   * Set up widget event listeners
   */
  private setupWidgetEvents(widgetId: string, config: RecaptchaConfig): void {
    const widget = document.querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement;
    if (!widget) return;

    const checkbox = widget.querySelector('.da-checkbox') as HTMLElement;
    if (!checkbox) return;

    checkbox.addEventListener('click', async () => {
      if (checkbox.classList.contains('checked') || checkbox.classList.contains('loading')) {
        return;
      }

      try {
        checkbox.classList.add('loading');
        checkbox.setAttribute('aria-checked', 'false');
        
        const text = widget.querySelector('.da-text') as HTMLElement;
        if (text) text.textContent = 'Verifying...';

        // Simulate verification delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

        const challenge = await this.getChallenge();
        const response = await this.performVerification(challenge);

        if (response.success && response.token) {
          checkbox.classList.remove('loading');
          checkbox.classList.add('checked');
          checkbox.setAttribute('aria-checked', 'true');
          widget.setAttribute('data-response', response.token);
          widget.classList.add('verified');
          
          if (text) text.textContent = 'Verified';
          
          config.callback?.(response.token);
        } else {
          throw new Error(response.error || 'Verification failed');
        }
      } catch (error) {
        checkbox.classList.remove('loading');
        checkbox.classList.add('error');
        widget.classList.add('error');
        
        const text = widget.querySelector('.da-text') as HTMLElement;
        if (text) text.textContent = 'Verification failed';
        
        config.errorCallback?.(error as Error);
        
        // Reset after 3 seconds
        setTimeout(() => this.reset(widgetId), 3000);
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

  /**
   * Load CSS styles for the widget
   */
  private loadStyles(): void {
    if (document.getElementById('da-recaptcha-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'da-recaptcha-styles';
    styles.textContent = `
      .da-recaptcha {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        user-select: none;
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

    document.head.appendChild(styles);
  }

  /**
   * Set up global callback functions
   */
  private setupGlobalCallbacks(): void {
    (window as any).daRecaptchaOnLoad = () => {
      this.isReady = true;
      this.readyCallbacks.forEach(callback => callback());
      this.readyCallbacks = [];
    };
  }

  /**
   * Generate unique widget ID
   */
  private generateWidgetId(): string {
    return 'da-recaptcha-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Wait for reCAPTCHA to be ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isReady) {
        resolve();
      } else {
        this.readyCallbacks.push(resolve);
      }
    });
  }
}

// Global API for backwards compatibility
(window as any).DefendAMinecraft = {
  render: (container: string | HTMLElement, config: RecaptchaConfig) => {
    const instance = new DefendAMinecraftRecaptcha(config);
    return instance.render(container, config);
  },
  
  getResponse: (widgetId?: string) => {
    // This is a simplified version - in practice you'd need to track instances
    const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
    return widget?.getAttribute('data-response') || null;
  },
  
  reset: (widgetId?: string) => {
    const widget = document.querySelector(`[data-widget-id="${widgetId}"]`) as HTMLElement;
    if (widget) {
      widget.removeAttribute('data-response');
      widget.classList.remove('verified', 'expired', 'error');
      
      const checkbox = widget.querySelector('.da-checkbox') as HTMLElement;
      const text = widget.querySelector('.da-text') as HTMLElement;
      
      if (checkbox && text) {
        checkbox.classList.remove('checked', 'loading');
        text.textContent = "I'm not a robot";
      }
    }
  }
};

export default DefendAMinecraftRecaptcha;
