// Dashboard Base JavaScript
class DashboardManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.checkAuthentication();
        this.setupEventListeners();
        this.loadUserProfile();
    }

    async checkAuthentication() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        try {
            const response = await api.getProfile();
            this.currentUser = response.user;
        } catch (error) {
            console.error('Authentication failed:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    }

    setupEventListeners() {
        // Navigation
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        // Mobile menu toggle
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
            });
        }

        // Close mobile menu when clicking on links
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger?.classList.remove('active');
                navMenu?.classList.remove('active');
            });
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }

        // User menu toggle (works for admin/student/organizer)
        document.querySelectorAll('#user-menu-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                // find parent .user-menu and its .user-dropdown
                const menu = btn.closest('.user-menu');
                if (!menu) return;
                const dropdown = menu.querySelector('.user-dropdown');
                if (!dropdown) return;
                dropdown.classList.toggle('open');
                const expanded = btn.getAttribute('aria-expanded') === 'true';
                btn.setAttribute('aria-expanded', String(!expanded));
            });
        });

        // Close any open user dropdown when clicking outside
        document.addEventListener('click', (e) => {
            document.querySelectorAll('.user-dropdown.open').forEach(d => {
                if (!d.contains(e.target)) {
                    d.classList.remove('open');
                    const toggle = d.querySelector('#user-menu-toggle');
                    if (toggle) toggle.setAttribute('aria-expanded', 'false');
                }
            });
        });

        // Delegated handler: if HTML uses .user-avatar without id, handle clicks here
        document.addEventListener('click', (e) => {
            const avatar = e.target.closest('.user-avatar');
            if (!avatar) return;
            // if avatar is inside a .user-menu, toggle its dropdown
            const menu = avatar.closest('.user-menu');
            if (!menu) return;
            const dropdown = menu.querySelector('.user-dropdown');
            if (!dropdown) return;
            e.stopPropagation();
            dropdown.classList.toggle('open');
            const toggle = menu.querySelector('#user-menu-toggle') || avatar;
            if (toggle) {
                const expanded = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!expanded));
            }
        });

        // Modal close handlers
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close') || e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });

        // Delegated click handler for elements using data-section or data-action
        document.addEventListener('click', (e) => {
            const secEl = e.target.closest && e.target.closest('[data-section]');
            if (secEl) {
                const section = secEl.dataset.section;
                if (section) {
                    e.preventDefault();
                    this.showSection(section);
                    return;
                }
            }

            const actionEl = e.target.closest && e.target.closest('[data-action]');
            if (actionEl) {
                const action = actionEl.dataset.action;
                const modalId = actionEl.dataset.modal;
                if (action && typeof this[action] === 'function') {
                    e.preventDefault();
                    if (modalId) this[action](modalId); else this[action]();
                } else if (action && window[action] && typeof window[action] === 'function') {
                    e.preventDefault();
                    if (modalId) window[action](modalId); else window[action]();
                }
            }
        });

        // Keyboard activation for elements with data-section or data-action (Enter/Space)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const active = document.activeElement;
                if (!active) return;
                if (active.dataset && active.dataset.section) {
                    e.preventDefault();
                    this.showSection(active.dataset.section);
                } else if (active.dataset && active.dataset.action) {
                    e.preventDefault();
                    const action = active.dataset.action;
                    const modalId = active.dataset.modal;
                    if (action && typeof this[action] === 'function') {
                        if (modalId) this[action](modalId); else this[action]();
                    } else if (action && window[action] && typeof window[action] === 'function') {
                        if (modalId) window[action](modalId); else window[action]();
                    }
                }
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    loadUserProfile() {
        if (this.currentUser) {
            const userName = document.getElementById('user-name');
            if (userName) {
                userName.textContent = `${this.currentUser.firstName} ${this.currentUser.lastName}`;
            }
            const userInitials = document.getElementById('user-initials');
            if (userInitials) {
                const initials = `${this.currentUser.firstName?.[0] || ''}${this.currentUser.lastName?.[0] || ''}`.toUpperCase();
                userInitials.textContent = initials;
            }
        }
    }

    showSection(sectionId) {
        // Hide all sections
        const sections = document.querySelectorAll('.dashboard-section');
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update navigation
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });

        // Load section-specific content
        this.loadSectionContent(sectionId);
    }

    loadSectionContent(sectionId) {
        switch (sectionId) {
            case 'dashboard':
                this.loadDashboardStats();
                this.loadRecentActivity();
                break;
            case 'events':
                this.loadEvents();
                break;
            case 'users':
                // Admin dashboard implements loadUsers
                if (typeof this.loadUsers === 'function') this.loadUsers();
                break;
            case 'venues':
                if (typeof this.loadVenues === 'function') this.loadVenues();
                break;
            case 'registrations':
                this.loadRegistrations();
                break;
            case 'certificates':
                this.loadCertificates();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    // Load analytics content with sample data for demo purposes
    loadAnalytics() {
        // Sample datasets
        const months = ['May','Jun','Jul','Aug','Sep','Oct'];
        const registrations = [12, 22, 18, 29, 34, 28];
        const studentAttended = 8; // sample
        const studentCertificates = 3; // sample

        // Student analytics (if present)
        const studentChart = document.getElementById('student-registrations-chart');
        if (studentChart) {
            // build labeled bars with small labels below
            const container = document.createElement('div');
            container.className = 'analytics-bar';
            const max = Math.max(...registrations, 1);
            registrations.forEach((val, idx) => {
                const bar = document.createElement('div');
                bar.className = 'bar';
                const h = Math.round((val / max) * 100);
                bar.style.height = `${h}%`;
                const valSpan = document.createElement('span');
                valSpan.textContent = val;
                bar.appendChild(valSpan);
                bar.title = `${months[idx]}: ${val}`;
                container.appendChild(bar);
            });
            // labels row
            const labels = document.createElement('div');
            labels.className = 'analytics-labels';
            months.forEach(m => {
                const l = document.createElement('div');
                l.textContent = m;
                labels.appendChild(l);
            });
            studentChart.innerHTML = '';
            studentChart.appendChild(container);
            studentChart.appendChild(labels);
        }

        const studentAttEl = document.getElementById('student-attended');
        if (studentAttEl) {
            studentAttEl.innerHTML = `<div style="text-align:center;"><div style="font-size:28px;color:var(--primary-color);">${studentAttended}</div><div style="color:var(--text-secondary);font-size:0.9rem;">Events Attended</div></div>`;
        }

        const studentCertEl = document.getElementById('student-certificates');
        if (studentCertEl) {
            studentCertEl.innerHTML = `<div style="text-align:center;"><div style="font-size:28px;color:var(--primary-color);">${studentCertificates}</div><div style="color:var(--text-secondary);font-size:0.9rem;">Certificates</div></div>`;
        }

        // Organizer analytics
        const feedbackSummary = document.getElementById('feedback-summary');
        if (feedbackSummary) {
            const sample = { excellent: 24, good: 52, average: 18, poor: 6 };
            feedbackSummary.innerHTML = `<div style="width:100%;display:flex;flex-direction:column;gap:8px;">${Object.entries(sample).map(([k,v])=>`<div style="display:flex;justify-content:space-between;align-items:center;"><div style="text-transform:capitalize;color:var(--text-secondary);">${k}</div><div style="font-weight:700;color:var(--primary-color);">${v}</div></div>`).join('')}</div>`;
        }

        // Organizer charts if present — render a compact performance card (sparkline + stats) and updated feedback summary
        const orgPerf = document.getElementById('organizer-performance-chart');
        const orgPart = document.getElementById('organizer-participant-chart');
        if (orgPerf) {
            // build sparkline SVG from registrations data and show summary stats
            const totalEvents = registrations.length;
            const totalRegistrations = registrations.reduce((s, v) => s + v, 0);
            const avgPerEvent = totalEvents ? Math.round(totalRegistrations / totalEvents) : 0;
            // compute simple trend: compare last month to previous
            const last = registrations[registrations.length - 1] || 0;
            const prev = registrations[registrations.length - 2] || 0;
            const trendUp = last >= prev;

            function createSparklineSVG(data, width = 300, height = 60) {
                const max = Math.max(...data, 1);
                const step = width / Math.max(data.length - 1, 1);
                const points = data.map((v, i) => `${i * step},${height - Math.round((v / max) * (height - 8))}`).join(' ');
                // small filled area + polyline
                const pathPoints = data.map((v, i) => `${i * step} ${height - Math.round((v / max) * (height - 8))}`);
                const areaPath = `M0 ${height} L ${pathPoints.join(' L ')} L ${width} ${height} Z`;
                const polylinePoints = data.map((v, i) => `${i * step},${height - Math.round((v / max) * (height - 8))}`).join(' ');
                return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" width="100%" height="60" xmlns="http://www.w3.org/2000/svg"><path d="${areaPath}" fill="var(--primary-color)" fill-opacity="0.12"></path><polyline points="${polylinePoints}" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
            }

            const spark = createSparklineSVG(registrations);
            orgPerf.innerHTML = `
                <div class="perf-card">
                    <!-- inner bordered card to match design -->
                    <div class="perf-inner">
                        <div class="perf-header"><div class="perf-title">Event Performance</div><div class="perf-sub">Last ${registrations.length} months</div></div>
                        <div class="perf-body">
                            <div class="perf-spark">${spark}</div>
                            <div class="perf-stats">
                                <div class="stat-block"><div class="stat-num">${totalEvents}</div><div class="stat-label">Events</div></div>
                                <div class="stat-block"><div class="stat-num">${totalRegistrations}</div><div class="stat-label">Total Registrations</div></div>
                                <div class="stat-block"><div class="stat-num">${avgPerEvent}</div><div class="stat-label">Avg / Event</div></div>
                                <div class="stat-trend ${trendUp ? 'up' : 'down'}">${trendUp ? '▲' : '▼'} ${Math.abs(last - prev)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        if (orgPart) {
            orgPart.innerHTML = `<div style="text-align:center;color:var(--text-secondary);">Average Participants per Event: <strong style='color:var(--primary-color)'>${Math.round(registrations.reduce((a,b)=>a+b,0)/registrations.length)}</strong></div>`;
        }

        // Feedback summary: show small sample comments and an average rating badge
        const feedbackSummaryEl = document.getElementById('feedback-summary');
        if (feedbackSummaryEl) {
            const sample = { excellent: 24, good: 52, average: 18, poor: 6 };
            const avgRating = ((5 * sample.excellent + 4 * sample.good + 3 * sample.average + 2 * sample.poor) / Math.max((sample.excellent+sample.good+sample.average+sample.poor),1)).toFixed(1);
            const comments = [
                { name: 'Aisha K', text: 'Great coordination and venue facilities. Well managed!', rating: 5 },
                { name: 'Rohan P', text: 'Good event, timings could be better.', rating: 4 },
                { name: 'Neha S', text: 'Informative sessions, enjoyed the workshops.', rating: 5 }
            ];
            feedbackSummaryEl.innerHTML = `
                <div class="feedback-summary-grid">
                    <div class="feedback-overview">
                        <div class="rating-badge">${avgRating}</div>
                        <div class="rating-label">Average Rating</div>
                        <div class="rating-sub">Based on ${sample.excellent+sample.good+sample.average+sample.poor} responses</div>
                    </div>
                    <div class="feedback-list">
                        ${comments.map(c=>`<div class="feedback-item"><div class="fb-name">${c.name}</div><div class="fb-text">${c.text}</div><div class="fb-stars">${'★'.repeat(c.rating)}${'☆'.repeat(5-c.rating)}</div></div>`).join('')}
                    </div>
                </div>
            `;
        }

        // Admin analytics
        const feedbackAnalysis = document.getElementById('feedback-analysis');
        if (feedbackAnalysis) {
            // sample averages + totals
            const avgRating = 4.3;
            const totalFeedback = 198;
            const positiveReviews = 162;
            feedbackAnalysis.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:8px;width:100%;">
                    <div class="metric-row"><div class="label">Average Rating</div><div class="value">${avgRating.toFixed(1)}</div></div>
                    <div class="metric-row"><div class="label">Total Feedback</div><div class="value">${totalFeedback}</div></div>
                    <div class="metric-row"><div class="label">Positive Reviews</div><div class="value">${positiveReviews}</div></div>
                </div>
            `;
        }

        const venueStats = document.getElementById('venue-stats');
        if (venueStats) {
            const venues = [
                { name: 'Main Auditorium', uses: 124 },
                { name: 'Open Air Theater', uses: 98 },
                { name: 'Conference Hall 1', uses: 76 },
                { name: 'Computer Lab 1', uses: 50 },
                { name: 'Seminar Hall', uses: 38 }
            ];
            venueStats.innerHTML = `
                <ul>
                    ${venues.map(v=>`<li><span>${v.name}</span><strong>${v.uses} events</strong></li>`).join('')}
                </ul>
            `;
        }

        // Admin charts (participation and dept breakdown)
        const adminPart = document.getElementById('admin-participation-chart');
        if (adminPart) {
            // show months + registrations (reuse sample)
            const c = document.createElement('div');
            c.className = 'analytics-bar';
            const max3 = Math.max(...registrations, 1);
            registrations.forEach((val, idx) => {
                const bar = document.createElement('div');
                bar.className = 'bar';
                const h = Math.round((val / max3) * 100);
                bar.style.height = `${h}%`;
                const span = document.createElement('span'); span.textContent = val;
                bar.appendChild(span);
                c.appendChild(bar);
            });
            adminPart.innerHTML = '';
            adminPart.appendChild(c);
            const labs = document.createElement('div'); labs.className = 'analytics-labels'; months.forEach(m=>{ const l=document.createElement('div'); l.textContent=m; labs.appendChild(l);}); adminPart.appendChild(labs);
        }

        const adminDept = document.getElementById('admin-dept-chart');
        if (adminDept) {
            // sample department distribution
            const depts = [
                { name: 'Computer Science', value: 42 },
                { name: 'Electronics', value: 28 },
                { name: 'Mechanical', value: 18 },
                { name: 'Business', value: 12 }
            ];
            const total = depts.reduce((s,d)=>s+d.value,0) || 1;
            const list = document.createElement('div');
            list.style.width = '100%';
            list.style.display = 'flex';
            list.style.flexDirection = 'column';
            list.style.gap = '8px';
            depts.forEach(d => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '8px';
                const name = document.createElement('div'); name.textContent = d.name; name.style.flex = '1'; name.style.color = 'var(--text-secondary)';
                const percent = Math.round((d.value/total)*100);
                const barWrap = document.createElement('div'); barWrap.style.width='140px'; barWrap.style.background='var(--bg-secondary)'; barWrap.style.borderRadius='6px'; barWrap.style.overflow='hidden';
                const inner = document.createElement('div'); inner.style.width = `${percent}%`; inner.style.height='10px'; inner.style.background = 'linear-gradient(135deg,var(--primary-color),var(--accent-color))';
                barWrap.appendChild(inner);
                const val = document.createElement('div'); val.textContent = `${percent}%`; val.style.width = '40px'; val.style.textAlign = 'right'; val.style.color = 'var(--primary-color)';
                row.appendChild(name); row.appendChild(barWrap); row.appendChild(val);
                list.appendChild(row);
            });
            adminDept.innerHTML = '';
            adminDept.appendChild(list);
        }
    }

    async loadDashboardStats() {
        try {
            const response = await api.getUserStats(this.currentUser.id);
            const stats = response.stats;

            this.updateStatDisplay('total-registrations', stats.total_registrations || 0);
            this.updateStatDisplay('attended-events', stats.attended_events || 0);
            this.updateStatDisplay('upcoming-events', stats.upcoming_events || 0);
            this.updateStatDisplay('average-rating', (stats.average_rating || 0).toFixed(1));

        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    updateStatDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            this.animateCounter(element, 0, value, 2000);
        }
    }

    animateCounter(element, start, end, duration) {
        const startTime = performance.now();
        const isNumber = !isNaN(end);
        
        const updateCounter = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            if (isNumber) {
                const current = Math.floor(start + (end - start) * progress);
                element.textContent = current.toLocaleString();
            } else {
                element.textContent = end;
            }
            
            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        };
        
        requestAnimationFrame(updateCounter);
    }

    async loadRecentActivity() {
        try {
            const response = await api.getMyRegistrations({ limit: 5 });
            const registrations = response.registrations || [];

            const activityList = document.getElementById('recent-activity');
            if (!activityList) return;

            if (registrations.length === 0) {
                activityList.innerHTML = `
                    <div class="no-activity">
                        <i class="fas fa-calendar-times"></i>
                        <p>No recent activity</p>
                    </div>
                `;
                return;
            }

            const activityHTML = registrations.map(registration => {
                const eventDate = new Date(registration.event_date);
                const timeAgo = this.getTimeAgo(registration.registration_date);
                
                return `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title">Registered for ${registration.title}</div>
                            <div class="activity-description">${registration.venue_name || 'TBA'}</div>
                            <div class="activity-time">${timeAgo}</div>
                        </div>
                    </div>
                `;
            }).join('');

            activityList.innerHTML = activityHTML;

        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    getTimeAgo(dateString) {
        const now = new Date();
        const date = new Date(dateString);
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) {
            return 'Just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    }

    async loadEvents() {
        // This will be implemented in the specific dashboard classes
    }

    async loadRegistrations() {
        // This will be implemented in the specific dashboard classes
    }

    async loadCertificates() {
        // This will be implemented in the specific dashboard classes
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // If modal is nested inside a section that may be hidden, move it to document.body
            if (modal.parentNode !== document.body) {
                document.body.appendChild(modal);
            }
            // Ensure modal displays above everything and covers viewport
            modal.style.display = 'block';
            modal.style.position = modal.style.position || 'fixed';
            modal.style.top = modal.style.top || '0';
            modal.style.left = modal.style.left || '0';
            modal.style.width = modal.style.width || '100%';
            modal.style.height = modal.style.height || '100%';
            modal.style.zIndex = modal.style.zIndex || '9999';
            document.body.style.overflow = 'hidden';
            try {
                console.debug(`showModal: displayed modal '${modalId}', parent now:`, modal.parentNode);
            } catch (e) {
                // ignore
            }
        }
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    hideAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
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
            top: 100px;
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

// Global functions for HTML onclick handlers
function showSection(sectionId) {
    if (window.dashboardManager) {
        window.dashboardManager.showSection(sectionId);
    }
}

function showModal(modalId) {
    if (window.dashboardManager) {
        window.dashboardManager.showModal(modalId);
    }
}

function hideModal(modalId) {
    if (window.dashboardManager) {
        window.dashboardManager.hideModal(modalId);
    }
}

function showQRScanner() {
    if (window.dashboardManager) {
        window.dashboardManager.showModal('qr-scanner-modal');
    }
}

// Initialize dashboard manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // If an AdminDashboard class is available (admin page), instantiate it; otherwise use base DashboardManager
    if (typeof AdminDashboard !== 'undefined') {
        window.dashboardManager = new AdminDashboard();
    } else {
        window.dashboardManager = new DashboardManager();
    }
});


