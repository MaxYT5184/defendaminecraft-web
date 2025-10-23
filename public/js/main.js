document.addEventListener('DOMContentLoaded', () => {
    // Initialize modern homepage animations
    initHeroAnimations();
    initScrollEffects();
    
    // DOM Elements for verification page (if exists)
    const continueBtn = document.getElementById('continue-btn');
    const resetBtn = document.getElementById('reset-btn');
    const verificationContent = document.querySelector('.verification-content');
    const verificationSuccess = document.getElementById('verification-success');
    const recaptchaWidget = document.getElementById('recaptcha-widget');
    
    // Initialize reCAPTCHA widget if on verification page
    if (recaptchaWidget) {
        const widget = new RecaptchaWidget(recaptchaWidget, {
            callback: onRecaptchaSuccess,
            'expired-callback': onRecaptchaExpired,
            'error-callback': onRecaptchaError
        });
    }
    
    // Event Listeners
    if (continueBtn) {
        continueBtn.addEventListener('click', handleContinue);
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', resetVerification);
    }
    
    // reCAPTCHA callback functions (only if verification elements exist)
    if (continueBtn) {
        window.onRecaptchaSuccess = function(token) {
            console.log('reCAPTCHA verified:', token);
            continueBtn.disabled = false;
            continueBtn.classList.add('verified');
        };
    }
    
    window.onRecaptchaExpired = function() {
        console.log('reCAPTCHA expired');
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.classList.remove('verified');
        }
    };
    
    window.onRecaptchaError = function() {
        console.log('reCAPTCHA error');
        showNotification('reCAPTCHA verification failed. Please try again.', 'error');
    };
    
    // Handle continue button
    function handleContinue() {
        if (continueBtn.disabled) return;
        
        // Add loading state
        continueBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        continueBtn.disabled = true;
        
        // Simulate processing delay
        setTimeout(() => {
            showSuccess();
        }, 1500);
    }
    
    // Show success state
    function showSuccess() {
        verificationContent.style.transform = 'translateY(-20px)';
        verificationContent.style.opacity = '0';
        
        setTimeout(() => {
            verificationContent.classList.add('hidden');
            verificationSuccess.classList.remove('hidden');
            verificationSuccess.style.animation = 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        }, 300);
    }
    
    // Reset verification
    function resetVerification() {
        verificationSuccess.classList.add('hidden');
        verificationContent.classList.remove('hidden');
        verificationContent.style.transform = 'translateY(0)';
        verificationContent.style.opacity = '1';
        
        // Reset reCAPTCHA
        if (recaptchaWidget && recaptchaWidget.recaptchaWidget) {
            recaptchaWidget.recaptchaWidget.reset();
        }
        
        // Reset continue button
        if (continueBtn) {
            continueBtn.disabled = true;
            continueBtn.classList.remove('verified');
            continueBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Continue';
        }
    }
    
    // Show notification
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Style notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: type === 'error' ? 'var(--error-500)' : 'var(--primary-600)',
            color: 'white',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--border-radius)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: '1000',
            animation: 'slideIn 0.3s ease-out'
        });
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }
    
    // Add shake animation for errors
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);
});

// Modern Homepage Animations
function initHeroAnimations() {
    const heroTitle = document.querySelector('.hero-title');
    const heroDescription = document.querySelector('.hero-description');
    const heroActions = document.querySelector('.hero-actions');
    const heroStats = document.querySelector('.hero-stats');
    const dashboardMockup = document.querySelector('.dashboard-mockup');
    
    // Animate elements on load
    if (heroTitle) {
        heroTitle.style.opacity = '0';
        heroTitle.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            heroTitle.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
            heroTitle.style.opacity = '1';
            heroTitle.style.transform = 'translateY(0)';
        }, 200);
    }
    
    if (heroDescription) {
        heroDescription.style.opacity = '0';
        heroDescription.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            heroDescription.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
            heroDescription.style.opacity = '1';
            heroDescription.style.transform = 'translateY(0)';
        }, 400);
    }
    
    if (heroActions) {
        heroActions.style.opacity = '0';
        heroActions.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            heroActions.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
            heroActions.style.opacity = '1';
            heroActions.style.transform = 'translateY(0)';
        }, 600);
    }
    
    if (heroStats) {
        heroStats.style.opacity = '0';
        heroStats.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            heroStats.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
            heroStats.style.opacity = '1';
            heroStats.style.transform = 'translateY(0)';
        }, 800);
    }
    
    if (dashboardMockup) {
        dashboardMockup.style.opacity = '0';
        dashboardMockup.style.transform = 'translateX(50px) scale(0.95)';
        
        setTimeout(() => {
            dashboardMockup.style.transition = 'all 1s cubic-bezier(0.16, 1, 0.3, 1)';
            dashboardMockup.style.opacity = '1';
            dashboardMockup.style.transform = 'translateX(0) scale(1)';
        }, 400);
    }
}

function initScrollEffects() {
    const featureCards = document.querySelectorAll('.feature-card');
    
    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    // Set initial state and observe feature cards
    featureCards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(50px)';
        card.style.transition = `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.1}s`;
        observer.observe(card);
    });
    
    // Parallax effect for gradient orbs
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const orbs = document.querySelectorAll('.gradient-orb');
        
        orbs.forEach((orb, index) => {
            const speed = 0.5 + (index * 0.1);
            orb.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
}
