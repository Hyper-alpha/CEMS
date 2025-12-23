// Theme Management
class ThemeManager {
    constructor() {
        // Prefer saved preference; otherwise use system preference if available
        const saved = localStorage.getItem('theme');
        if (saved) {
            this.theme = saved;
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.theme = 'dark';
        } else {
            this.theme = 'light';
        }
        this.init();
    }

    init() {
        this.applyTheme(this.theme);
        this.setupEventListeners();
    }

    applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            // remove attribute for light theme so :root variables apply
            document.documentElement.removeAttribute('data-theme');
        }
        this.theme = theme;
        localStorage.setItem('theme', theme);
        // Debug: print current theme and attribute to console
        try {
            console.debug('[ThemeManager] applied theme:', theme, 'data-theme attribute:', document.documentElement.getAttribute('data-theme'));
        } catch (e) {
            // ignore in older browsers
        }
        this.updateThemeButton();
    }

    toggleTheme() {
        const newTheme = this.theme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
    }

    updateThemeButton() {
        const themeButton = document.getElementById('theme-toggle');
        if (themeButton) {
            const icon = themeButton.querySelector('i');
            if (icon) {
                if (this.theme === 'dark') {
                    icon.className = 'fas fa-sun';
                } else {
                    icon.className = 'fas fa-moon';
                }
            }
            themeButton.setAttribute('aria-pressed', this.theme === 'dark' ? 'true' : 'false');
            themeButton.title = this.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
        }
    }

    setupEventListeners() {
        const themeButton = document.getElementById('theme-toggle');
        if (themeButton) {
            themeButton.addEventListener('click', () => {
                this.toggleTheme();
            });

            // Allow toggle via Enter/Space when focused
            themeButton.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleTheme();
                }
            });
        }
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThemeManager();
});


