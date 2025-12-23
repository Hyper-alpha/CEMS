// Authentication JavaScript
class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkExistingAuth();
        this.setupPasswordStrength();
        this.setupRoleToggle();
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Password toggle buttons
        const passwordToggles = document.querySelectorAll('.password-toggle');
        passwordToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => this.togglePassword(e));
        });

        // Demo credential buttons
        const demoButtons = document.querySelectorAll('.demo-btn');
        demoButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.fillDemoCredentials(e));
        });

        // Password strength checker
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('input', (e) => this.checkPasswordStrength(e));
        }

        // Confirm password validation
        const confirmPasswordInput = document.getElementById('confirmPassword');
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', (e) => this.validatePasswordMatch(e));
        }

        // Role selection handler
        const roleSelect = document.getElementById('role');
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => this.handleRoleChange(e));
        }
    }

    checkExistingAuth() {
        const token = localStorage.getItem('token');
        if (token) {
            // Verify token is still valid
            api.getProfile()
                .then(() => {
                    // Token is valid, redirect to dashboard
                    this.redirectToDashboard();
                })
                .catch(() => {
                    // Token is invalid, remove it
                    localStorage.removeItem('token');
                });
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const email = formData.get('email');
        const password = formData.get('password');
        const rememberMe = formData.get('remember-me');

        if (!this.validateLoginForm(email, password)) {
            return;
        }

        const loginBtn = document.getElementById('login-btn');
        this.setButtonLoading(loginBtn, true);

        try {
            const response = await api.login(email, password);
            
            // Store token
            api.setToken(response.token);
            
            // Store user data
            localStorage.setItem('user', JSON.stringify(response.user));
            
            // Set remember me
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
            }

            this.showSuccess('Login successful! Redirecting...');
            
            // Redirect to appropriate dashboard
            setTimeout(() => {
                this.redirectToDashboard();
            }, 1500);

        } catch (error) {
            console.error('Login failed:', error);
            this.showError(error.message || 'Login failed. Please check your credentials.');
        } finally {
            this.setButtonLoading(loginBtn, false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const userData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role'),
            phone: formData.get('phone') || null
        };

        // Add role-specific fields
        if (userData.role === 'student') {
            userData.studentId = formData.get('studentId') || null;
            userData.department = formData.get('department') || null;
        }

        if (!this.validateRegisterForm(userData)) {
            return;
        }

        const registerBtn = document.getElementById('register-btn');
        this.setButtonLoading(registerBtn, true);

        try {
            const response = await api.register(userData);
            
            // Store token
            api.setToken(response.token);
            
            // Store user data
            localStorage.setItem('user', JSON.stringify(response.user));

            this.showSuccess('Registration successful! Redirecting...');
            
            // Redirect to appropriate dashboard
            setTimeout(() => {
                this.redirectToDashboard();
            }, 1500);

        } catch (error) {
            console.error('Registration failed:', error);
            this.showError(error.message || 'Registration failed. Please try again.');
        } finally {
            this.setButtonLoading(registerBtn, false);
        }
    }

    validateLoginForm(email, password) {
        let isValid = true;

        // Clear previous errors
        this.clearFormErrors();

        if (!email) {
            this.showFieldError('email', 'Email is required');
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!password) {
            this.showFieldError('password', 'Password is required');
            isValid = false;
        }

        return isValid;
    }

    validateRegisterForm(userData) {
        let isValid = true;

        // Clear previous errors
        this.clearFormErrors();

        // Required fields
        if (!userData.firstName) {
            this.showFieldError('firstName', 'First name is required');
            isValid = false;
        }

        if (!userData.lastName) {
            this.showFieldError('lastName', 'Last name is required');
            isValid = false;
        }

        if (!userData.email) {
            this.showFieldError('email', 'Email is required');
            isValid = false;
        } else if (!this.isValidEmail(userData.email)) {
            this.showFieldError('email', 'Please enter a valid email address');
            isValid = false;
        }

        if (!userData.role) {
            this.showFieldError('role', 'Please select an account type');
            isValid = false;
        }

        if (!userData.password) {
            this.showFieldError('password', 'Password is required');
            isValid = false;
        } else if (!this.isStrongPassword(userData.password)) {
            this.showFieldError('password', 'Password must be at least 6 characters long');
            isValid = false;
        }

        // Confirm password
        const confirmPassword = document.getElementById('confirmPassword')?.value;
        if (userData.password !== confirmPassword) {
            this.showFieldError('confirmPassword', 'Passwords do not match');
            isValid = false;
        }

        // Role-specific validation
        if (userData.role === 'student') {
            if (!userData.studentId) {
                this.showFieldError('studentId', 'Student ID is required for students');
                isValid = false;
            }
            if (!userData.department) {
                this.showFieldError('department', 'Department is required for students');
                isValid = false;
            }
        }

        // Terms agreement
        const termsChecked = document.getElementById('terms')?.checked;
        if (!termsChecked) {
            this.showError('Please agree to the Terms of Service and Privacy Policy');
            isValid = false;
        }

        return isValid;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    isStrongPassword(password) {
        return password.length >= 6;
    }

    showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('error');
            
            // Remove existing error message
            const existingError = formGroup.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }

            // Add new error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            formGroup.appendChild(errorDiv);
        }
    }

    clearFormErrors() {
        const errorGroups = document.querySelectorAll('.form-group.error');
        errorGroups.forEach(group => {
            group.classList.remove('error');
            const errorMessage = group.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        });
    }

    togglePassword(e) {
        const button = e.target.closest('.password-toggle');
        const input = button.parentElement.querySelector('input');
        const icon = button.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    }

    fillDemoCredentials(e) {
        const button = e.target.closest('.demo-btn');
        const email = button.dataset.email;
        const password = button.dataset.password;

        // Fill login form
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        if (emailInput && passwordInput) {
            emailInput.value = email;
            passwordInput.value = password;
            
            // Add visual feedback
            button.style.backgroundColor = 'var(--primary-color)';
            button.style.color = 'white';
            
            setTimeout(() => {
                button.style.backgroundColor = '';
                button.style.color = '';
            }, 1000);
        }
    }

    setupPasswordStrength() {
        const passwordInput = document.getElementById('password');
        if (!passwordInput) return;

        passwordInput.addEventListener('input', (e) => {
            this.checkPasswordStrength(e);
        });
    }

    checkPasswordStrength(e) {
        const password = e.target.value;
        const strengthBar = document.querySelector('.strength-fill');
        const strengthText = document.querySelector('.strength-text');

        if (!strengthBar || !strengthText) return;

        let strength = 0;
        let strengthLabel = '';

        if (password.length >= 6) strength += 1;
        if (password.length >= 8) strength += 1;
        if (/[A-Z]/.test(password)) strength += 1;
        if (/[0-9]/.test(password)) strength += 1;
        if (/[^A-Za-z0-9]/.test(password)) strength += 1;

        // Remove all strength classes
        strengthBar.classList.remove('weak', 'fair', 'good', 'strong');

        if (password.length === 0) {
            strengthText.textContent = 'Password strength';
            return;
        }

        if (strength <= 1) {
            strengthBar.classList.add('weak');
            strengthLabel = 'Weak';
        } else if (strength <= 2) {
            strengthBar.classList.add('fair');
            strengthLabel = 'Fair';
        } else if (strength <= 3) {
            strengthBar.classList.add('good');
            strengthLabel = 'Good';
        } else {
            strengthBar.classList.add('strong');
            strengthLabel = 'Strong';
        }

        strengthText.textContent = strengthLabel;
    }

    validatePasswordMatch(e) {
        const confirmPassword = e.target.value;
        const password = document.getElementById('password')?.value;
        const formGroup = e.target.closest('.form-group');

        if (confirmPassword && password && confirmPassword !== password) {
            this.showFieldError('confirmPassword', 'Passwords do not match');
        } else if (confirmPassword && password && confirmPassword === password) {
            formGroup?.classList.remove('error');
            const errorMessage = formGroup?.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.remove();
            }
        }
    }

    setupRoleToggle() {
        const roleSelect = document.getElementById('role');
        const studentFields = document.getElementById('student-fields');

        if (roleSelect && studentFields) {
            roleSelect.addEventListener('change', (e) => {
                this.handleRoleChange(e);
            });
        }
    }

    handleRoleChange(e) {
        const role = e.target.value;
        const studentFields = document.getElementById('student-fields');

        if (role === 'student' && studentFields) {
            studentFields.style.display = 'block';
        } else if (studentFields) {
            studentFields.style.display = 'none';
        }
    }

    setButtonLoading(button, loading) {
        if (!button) return;

        const text = button.querySelector('.btn-text');
        const spinner = button.querySelector('.btn-spinner');

        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            if (text) text.style.opacity = '0';
            if (spinner) spinner.style.display = 'inline-block';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            if (text) text.style.opacity = '1';
            if (spinner) spinner.style.display = 'none';
        }
    }

    redirectToDashboard() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const role = user.role;

        switch (role) {
            case 'admin':
                window.location.href = 'admin-dashboard.html';
                break;
            case 'organizer':
                window.location.href = 'organizer-dashboard.html';
                break;
            case 'student':
                window.location.href = 'student-dashboard.html';
                break;
            default:
                window.location.href = 'dashboard.html';
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 3000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 400px;
        `;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});


