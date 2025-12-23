// Admin Dashboard JavaScript
class AdminDashboard extends DashboardManager {
    constructor() {
        super();
        this.events = [];
        this.users = [];
        this.venues = [];
        this.currentEventId = null;
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreEvents = true;
        this.currentFilter = 'all';
        // User-specific filters
        this.userSearchTerm = '';
        this.userRoleFilter = 'all';
        // User pagination
    this.currentUserPage = 1;
    this.totalUserPages = 1;
    this.usersPageSize = 20;
    this.usersSortBy = 'created_at';
    this.usersSortDir = 'desc';
        this.searchTerm = '';
    }

    setupEventListeners() {
        super.setupEventListeners();
        this.setupAdminSpecificListeners();
    }

    setupAdminSpecificListeners() {
        // Event search
        const searchInput = document.getElementById('event-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchTerm = e.target.value;
                    this.resetAndLoadEvents();
                }, 300);
            });
        }

        // User search (separate from event search)
        const userSearchInput = document.getElementById('user-search');
        if (userSearchInput) {
            let searchTimeout;
            userSearchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.userSearchTerm = e.target.value;
                    this.currentPage = 1;
                    this.loadUsers();
                }, 300);
            });
        }

        // Column filters
        const filterEmail = document.getElementById('filter-email');
        if (filterEmail) {
            let t;
            filterEmail.addEventListener('input', (e) => {
                clearTimeout(t);
                t = setTimeout(() => {
                    this.emailFilter = e.target.value;
                    this.currentUserPage = 1;
                    this.loadUsers();
                }, 300);
            });
        }

        const filterDept = document.getElementById('filter-department');
        if (filterDept) {
            let t;
            filterDept.addEventListener('input', (e) => {
                clearTimeout(t);
                t = setTimeout(() => {
                    this.departmentFilter = e.target.value;
                    this.currentUserPage = 1;
                    this.loadUsers();
                }, 300);
            });
        }

        const filterRole = document.getElementById('filter-role');
        if (filterRole) {
            filterRole.addEventListener('change', (e) => {
                this.userRoleFilter = e.target.value;
                this.currentUserPage = 1;
                this.loadUsers();
            });
        }

        // Table header sorting (click and keyboard Enter)
        document.querySelectorAll('.users-table thead th[data-sort]').forEach(th => {
            const key = th.getAttribute('data-sort');
            th.addEventListener('click', () => {
                if (this.usersSortBy === key) {
                    this.usersSortDir = this.usersSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this.usersSortBy = key;
                    this.usersSortDir = 'asc';
                }
                this.currentUserPage = 1;
                this.loadUsers();
            });
            th.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    th.click();
                }
            });
        });

        // Page size selector
        const pageSizeSelect = document.getElementById('users-page-size');
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.usersPageSize = parseInt(e.target.value, 10) || 20;
                this.currentUserPage = 1;
                this.loadUsers();
            });
        }

        // User role filter buttons (inside users section)
        const userFilterButtons = document.querySelectorAll('#users .filter-buttons .filter-btn');
        userFilterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                userFilterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const role = e.target.dataset.filter || 'all';
                this.userRoleFilter = role;
                this.currentPage = 1;
                this.loadUsers();
            });
        });

        // Event filters
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.resetAndLoadEvents();
            });
        });

        // Event card clicks
        document.addEventListener('click', (e) => {
            const eventCard = e.target.closest('.event-card');
            if (eventCard) {
                const eventId = eventCard.dataset.eventId;
                this.showEventApprovalModal(eventId);
            }
        });

        // Event approval form
        const approvalForm = document.getElementById('approval-form');
        if (approvalForm) {
            approvalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleEventApproval(e);
            });
        }

        // Delegated handler for user action buttons in the users table (edit / toggle / delete)
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest && e.target.closest('[data-action]');
            if (!actionBtn) return;
            const action = actionBtn.getAttribute('data-action');
            const userId = actionBtn.getAttribute('data-user-id');

            if (!userId) return;

            if (action === 'edit') {
                editUser(userId);
            } else if (action === 'toggle') {
                const isActive = actionBtn.getAttribute('data-user-active') === 'true' || actionBtn.getAttribute('data-user-active') === '1';
                toggleUserStatus(userId, isActive);
            } else if (action === 'delete') {
                deleteUser(userId);
            }
        });

        // Announcement form
        const announcementForm = document.getElementById('announcement-form');
        if (announcementForm) {
            announcementForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendAnnouncement(e);
            });
        }

        // Create venue form
        const createVenueForm = document.getElementById('create-venue-form');
        if (createVenueForm) {
            createVenueForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createVenue(e);
            });
        }

        // Settings forms
        const generalSettingsForm = document.getElementById('general-settings-form');
        if (generalSettingsForm) {
            generalSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveGeneralSettings(e);
            });
        }

        const notificationSettingsForm = document.getElementById('notification-settings-form');
        if (notificationSettingsForm) {
            notificationSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveNotificationSettings(e);
            });
        }
    }

    async loadDashboardStats() {
        try {
            const response = await api.getDashboardStats();
            const stats = response.stats;

            this.updateStatDisplay('total-users', stats.totalUsers || 0);
            this.updateStatDisplay('total-events', stats.totalEvents || 0);
            this.updateStatDisplay('total-venues', stats.totalVenues || 0);
            this.updateStatDisplay('total-registrations', stats.totalRegistrations || 0);

            // Load pending events
            this.loadPendingEvents(stats.pendingEvents || []);

        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
            const pendingList = document.getElementById('pending-events');
            if (pendingList) {
                pendingList.innerHTML = `
                    <div class="error-card">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to load pending events. Please try again.</p>
                    </div>
                `;
            }
        }
    }

    loadPendingEvents(pendingEvents) {
        const pendingList = document.getElementById('pending-events');
        if (!pendingList) return;

        if (pendingEvents.length === 0) {
            pendingList.innerHTML = `
                <div class="no-pending">
                    <i class="fas fa-check-circle"></i>
                    <h3>No pending approvals</h3>
                    <p>All events are up to date</p>
                </div>
            `;
            return;
        }

        const pendingHTML = pendingEvents.map(event => this.createPendingEventCard(event)).join('');
        pendingList.innerHTML = pendingHTML;
    }

    createPendingEventCard(event) {
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        return `
            <div class="pending-event-card" data-event-id="${event.id}">
                <div class="event-info">
                    <h4>${event.title}</h4>
                    <p>by ${event.organizer_first_name} ${event.organizer_last_name}</p>
                    <div class="event-meta">
                        <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                        <span><i class="fas fa-users"></i> ${event.capacity} capacity</span>
                    </div>
                </div>
                <div class="event-actions">
                    <button class="btn btn-success btn-sm" onclick="approveEvent(${event.id})">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="rejectEvent(${event.id})">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            </div>
        `;
    }

    async loadRecentActivity() {
        try {
            const response = await api.getDashboardStats();
            const recentEvents = response.stats.recentEvents || [];

            const activityList = document.getElementById('recent-activity');
            if (!activityList) return;

            if (recentEvents.length === 0) {
                activityList.innerHTML = `
                    <div class="no-activity">
                        <i class="fas fa-calendar-times"></i>
                        <p>No recent activity</p>
                    </div>
                `;
                return;
            }

            const activityHTML = recentEvents.map(event => {
                const eventDate = new Date(event.event_date);
                const timeAgo = this.getTimeAgo(event.created_at);
                
                return `
                    <div class="activity-item">
                        <div class="activity-icon">
                            <i class="fas fa-calendar-plus"></i>
                        </div>
                        <div class="activity-content">
                            <div class="activity-title">${event.title} created</div>
                            <div class="activity-description">by ${event.organizer_first_name} ${event.organizer_last_name}</div>
                            <div class="activity-time">${timeAgo}</div>
                        </div>
                    </div>
                `;
            }).join('');

            activityList.innerHTML = activityHTML;

        } catch (error) {
            console.error('Failed to load recent activity:', error);
            const activityList = document.getElementById('recent-activity');
            if (activityList) {
                activityList.innerHTML = `
                    <div class="error-card">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Failed to load activity. Please try again.</p>
                    </div>
                `;
            }
        }
    }

    async loadEvents() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading('events-grid');

        try {
            const params = {
                page: this.currentPage,
                limit: 6
            };

            if (this.searchTerm) {
                params.search = this.searchTerm;
            }

            if (this.currentFilter !== 'all') {
                params.status = this.currentFilter;
            }

            const response = await api.getAdminEvents(params);
            const newEvents = response.events || [];

            if (this.currentPage === 1) {
                this.events = newEvents;
            } else {
                this.events = [...this.events, ...newEvents];
            }

            this.hasMoreEvents = response.pagination?.hasNext || false;
            this.renderEvents();
            this.updateLoadMoreButton();

        } catch (error) {
            console.error('Failed to load events:', error);
            this.showError('Failed to load events. Please try again.');
        } finally {
            this.isLoading = false;
            this.hideLoading('events-grid');
        }
    }

    renderEvents() {
        const eventsGrid = document.getElementById('events-grid');
        if (!eventsGrid) return;

        if (this.events.length === 0) {
            eventsGrid.innerHTML = `
                <div class="no-events">
                    <i class="fas fa-calendar-times"></i>
                    <h3>No events found</h3>
                    <p>Try adjusting your search or filters</p>
                </div>
            `;
            return;
        }

        const eventsHTML = this.events.map(event => this.createEventCard(event)).join('');
        eventsGrid.innerHTML = eventsHTML;
    }

    createEventCard(event) {
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        const startTime = new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const statusColors = {
            'pending': 'var(--warning-color)',
            'approved': 'var(--success-color)',
            'rejected': 'var(--error-color)',
            'completed': 'var(--primary-color)',
            'cancelled': 'var(--text-muted)'
        };

        return `
            <div class="event-card" data-event-id="${event.id}">
                <div class="event-image">
                    ${event.banner_image ? 
                        `<img src="/uploads/events/${event.banner_image}" alt="${event.title}">` :
                        `<i class="fas fa-calendar-alt"></i>`
                    }
                </div>
                <div class="event-content">
                    <div class="event-header">
                        <h3 class="event-title">${event.title}</h3>
                        <span class="event-status" style="background-color: ${statusColors[event.status] || 'var(--text-muted)'}">
                            ${event.status}
                        </span>
                    </div>
                    <p class="event-description">${event.description}</p>
                    <div class="event-meta">
                        <div class="meta-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formattedDate}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-clock"></i>
                            <span>${startTime}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${event.venue_name || 'TBA'}</span>
                        </div>
                        <div class="meta-item">
                            <i class="fas fa-user"></i>
                            <span>${event.organizer_first_name} ${event.organizer_last_name}</span>
                        </div>
                    </div>
                    <div class="event-actions">
                        ${event.status !== 'approved' ? `
                            <button class="btn btn-success btn-sm" onclick="approveEvent(${event.id})">
                                <i class="fas fa-check"></i> Approve
                            </button>
                        ` : ''}
                        ${event.status !== 'rejected' ? `
                            <button class="btn btn-danger btn-sm" onclick="rejectEvent(${event.id})">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        ` : ''}
                        <button class="btn btn-primary btn-sm" onclick="viewEventDetails(${event.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async loadUsers() {
        try {
            const params = {
                page: this.currentUserPage,
                limit: this.usersPageSize,
                sort_by: this.usersSortBy,
                sort_dir: this.usersSortDir
            };

            if (this.userSearchTerm) params.search = this.userSearchTerm;
            if (this.userRoleFilter && this.userRoleFilter !== 'all') params.role = this.userRoleFilter;
            if (this.emailFilter) params.email = this.emailFilter;
            if (this.departmentFilter) params.department = this.departmentFilter;
            if (this.studentIdFilter) params.student_id = this.studentIdFilter;

            const response = await api.getUsers(params);
            // Server now excludes admin users; still defensively filter on client
            this.users = (response.users || []).filter(u => u.role !== 'admin');
            // Update pagination info (response.pagination provided by server)
            if (response.pagination) {
                this.currentUserPage = response.pagination.currentPage || this.currentUserPage;
                this.totalUserPages = response.pagination.totalPages || this.totalUserPages;
                this.totalUsersCount = response.pagination.totalUsers || this.totalUsersCount || 0;
            }

            this.renderUsers();
            this.updateUsersPaginationUI();

        } catch (error) {
            console.error('Failed to load users:', error);
            this.showError('Failed to load users.');
        }
    }

    renderUsers() {
        const usersTableBody = document.getElementById('users-table-body');
        if (!usersTableBody) return;

        if (this.users.length === 0) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="no-users">
                        <i class="fas fa-users"></i>
                        <p>No users found</p>
                    </td>
                </tr>
            `;
            return;
        }

        const usersHTML = this.users.map(user => this.createUserRow(user)).join('');
        usersTableBody.innerHTML = usersHTML;
    }

    updateUsersPaginationUI() {
        const prevBtn = document.getElementById('users-prev-btn');
        const nextBtn = document.getElementById('users-next-btn');
        const indicator = document.getElementById('users-page-indicator');
        if (indicator) indicator.textContent = `Page ${this.currentUserPage} of ${this.totalUserPages} — ${this.totalUsersCount || 0} users`;
        if (prevBtn) prevBtn.disabled = this.currentUserPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentUserPage >= this.totalUserPages;
        // Keyboard accessibility: allow Enter/Space to activate
        [prevBtn, nextBtn].forEach(btn => {
            if (!btn) return;
            btn.setAttribute('tabindex', '0');
            btn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    btn.click();
                }
            });
        });
    }

    createUserRow(user) {
        const statusClass = user.is_active ? 'active' : 'inactive';
        const statusText = user.is_active ? 'Active' : 'Inactive';

        return `
            <tr>
                <td class="user-email">${user.email || ''}</td>
                <td class="user-role"><span class="role-badge ${user.role}">${user.role}</span></td>
                <td class="user-dept">${user.department || 'N/A'}</td>
                <td class="user-status"><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td class="user-actions">
                    <button class="btn btn-sm btn-outline" data-action="edit" data-user-id="${user.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm ${user.is_active ? 'btn-warning' : 'btn-success'}" data-action="toggle" data-user-id="${user.id}" data-user-active="${user.is_active}" title="Toggle Active">
                        <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                    </button>
                    ${user.role !== 'admin' ? `<button class="btn btn-sm btn-danger" data-action="delete" data-user-id="${user.id}" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `;
    }

    async loadVenues() {
        try {
            const response = await api.getVenues();
            this.venues = response.venues || [];
            this.renderVenues();
        } catch (error) {
            console.error('Failed to load venues:', error);
            this.showError('Failed to load venues.');
        }
    }

    renderVenues() {
        const tbody = document.getElementById('venues-table-body');
        if (!tbody) return;

        if (this.venues.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="no-venues" style="padding:18px;text-align:center;">
                        <i class="fas fa-map-marker-alt"></i>
                        <p>No venues found — add your first venue to get started</p>
                    </td>
                </tr>
            `;
            return;
        }

        const rows = this.venues.map(v => this.createVenueRow(v)).join('');
        tbody.innerHTML = rows;
    }

    createVenueCard(venue) {
        // kept for backward compatibility but not used by table view
        return `
            <div class="venue-card">
                <div class="venue-header">
                    <h3>${venue.name}</h3>
                    <span class="venue-capacity">${venue.capacity} capacity</span>
                </div>
            </div>
        `;
    }

    createVenueRow(venue) {
        const facilities = venue.facilities ? (venue.facilities.length > 60 ? venue.facilities.substr(0,57) + '...' : venue.facilities) : '';
        return `
            <tr data-venue-id="${venue.id}">
                <td style="padding:10px;border-bottom:1px solid var(--border-light);">${venue.name}</td>
                <td style="padding:10px;border-bottom:1px solid var(--border-light);">${venue.location || ''}</td>
                <td style="padding:10px;border-bottom:1px solid var(--border-light);">${venue.capacity || ''}</td>
                <td style="padding:10px;border-bottom:1px solid var(--border-light);">${facilities}</td>
                <td style="padding:10px;border-bottom:1px solid var(--border-light);">
                    <button class="btn btn-sm btn-outline venue-edit-btn" data-venue-id="${venue.id}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn btn-sm btn-danger venue-delete-btn" data-venue-id="${venue.id}"><i class="fas fa-trash"></i> Delete</button>
                </td>
            </tr>
        `;
    }

    // Toggle the inline create venue form visibility
    toggleInlineVenueForm() {
        const el = document.getElementById('inline-create-venue');
        if (!el) return;
        el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
        const firstInput = document.getElementById('inline-venue-name');
        if (firstInput && el.style.display === 'block') firstInput.focus();
    }

    async loadAnalytics() {
        try {
            const response = await api.getAnalytics();
            const analytics = response.analytics;

            // Update feedback analysis
            const feedbackAnalysis = document.getElementById('feedback-analysis');
            if (feedbackAnalysis && analytics.feedbackStats) {
                const stats = analytics.feedbackStats;
                feedbackAnalysis.innerHTML = `
                    <div class="feedback-stats">
                        <div class="stat-item">
                            <span class="stat-value">${(stats.avg_rating || 0).toFixed(1)}</span>
                            <span class="stat-label">Average Rating</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${stats.total_feedback || 0}</span>
                            <span class="stat-label">Total Feedback</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${stats.positive_feedback || 0}</span>
                            <span class="stat-label">Positive Reviews</span>
                        </div>
                    </div>
                `;
            }

            // Update venue stats
            const venueStats = document.getElementById('venue-stats');
            if (venueStats && analytics.venueStats) {
                const venues = analytics.venueStats.slice(0, 5); // Top 5 venues
                venueStats.innerHTML = venues.map(venue => `
                    <div class="venue-stat-item">
                        <span class="venue-name">${venue.name}</span>
                        <span class="venue-count">${venue.event_count} events</span>
                    </div>
                `).join('');
            }

        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    async loadSettings() {
        try {
            const response = await api.getSettings();
            const settings = response.settings;

            // Populate general settings
            const siteNameInput = document.getElementById('site-name');
            const maxRegistrationsInput = document.getElementById('max-registrations');
            const registrationDeadlineInput = document.getElementById('registration-deadline');

            if (siteNameInput) siteNameInput.value = settings.site_name?.value || '';
            if (maxRegistrationsInput) maxRegistrationsInput.value = settings.max_registration_per_student?.value || '';
            if (registrationDeadlineInput) registrationDeadlineInput.value = settings.registration_deadline_hours?.value || '';

            // Populate notification settings
            const emailNotificationsInput = document.getElementById('email-notifications');
            if (emailNotificationsInput) {
                emailNotificationsInput.checked = settings.email_notifications?.value === 'true';
            }

        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async showEventApprovalModal(eventId) {
        try {
            // Use admin-specific endpoint so admins can load events regardless of status
            const response = await api.getAdminEvent(eventId);
            const event = response.event;

            if (!event) {
                throw new Error('Event not found');
            }

            this.populateEventApprovalModal(event);
            this.showModal('event-approval-modal');
            this.currentEventId = eventId;

        } catch (error) {
            console.error('Failed to load event details:', error);
            const msg = error?.response?.message || error.message || 'Failed to load event details.';
            this.showError(msg);
        }
    }

    populateEventApprovalModal(event) {
        const eventDate = new Date(event.event_date);
        const formattedDate = eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const startTime = new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const endTime = new Date(`2000-01-01T${event.end_time}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const eventDetails = document.getElementById('approval-event-details');
        eventDetails.innerHTML = `
            <div class="event-approval-details">
                <h4>${event.title}</h4>
                <p><strong>Organizer:</strong> ${event.organizer_first_name} ${event.organizer_last_name}</p>
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${startTime} - ${endTime}</p>
                <p><strong>Venue:</strong> ${event.venue_name || 'TBA'}</p>
                <p><strong>Capacity:</strong> ${event.capacity}</p>
                <p><strong>Description:</strong> ${event.description}</p>
            </div>
        `;

        // Pre-select radio based on current status and fill admin notes if any
        setTimeout(() => {
            try {
                const decisionRadio = document.querySelector(`input[name="decision"][value="${event.status}"]`);
                if (decisionRadio) decisionRadio.checked = true;
                const notesEl = document.getElementById('admin-notes');
                if (notesEl) notesEl.value = event.admin_notes || '';
            } catch (e) {
                // ignore
            }
        }, 50);
    }

    async handleEventApproval(e) {
        const formData = new FormData(e.target);
        const decision = formData.get('decision');
        const adminNotes = formData.get('adminNotes');

        if (!decision) {
            this.showError('Please select a decision.');
            return;
        }

        try {
            await api.updateEventStatus(this.currentEventId, decision, adminNotes);
            this.showSuccess(`Event ${decision} successfully!`);
            this.hideModal('event-approval-modal');
            this.loadEvents();
            this.loadDashboardStats();

        } catch (error) {
            console.error('Failed to update event status:', error);
            this.showError('Failed to update event status.');
        }
    }

    async sendAnnouncement(e) {
        const formData = new FormData(e.target);
        const title = formData.get('title');
        const message = formData.get('message');
        const targetRole = formData.get('targetRole');

        try {
            await api.sendAnnouncement(title, message, targetRole);
            this.showSuccess('Announcement sent successfully!');
            this.hideModal('announcement-modal');
            e.target.reset();

        } catch (error) {
            console.error('Failed to send announcement:', error);
            this.showError('Failed to send announcement.');
        }
    }

    async createVenue(e) {
        // Ensure user is authenticated client-side before attempting admin action
        if (!api.token) {
            this.showError('You must be logged in as an admin to create a venue. Please login and try again.');
            return;
        }
        const formData = new FormData(e.target);
        const venueData = {
            name: formData.get('name'),
            location: formData.get('location'),
            capacity: parseInt(formData.get('capacity'), 10) || 0,
            facilities: formData.get('facilities') || null
        };

        try {
            const resp = await api.createVenue(venueData);
            // Backend returns { venueId } on success — fetch the created venue to get full data
            let created = null;
            if (resp && resp.venue) {
                created = resp.venue;
            } else if (resp && resp.venueId) {
                const fetched = await api.getVenue(resp.venueId);
                created = fetched.venue || fetched;
            } else if (resp && resp.success && resp.venueId) {
                const fetched = await api.getVenue(resp.venueId);
                created = fetched.venue || fetched;
            }

            if (!created) {
                // fallback: reload venues
                this.loadVenues();
            } else {
                this.venues = this.venues || [];
                this.venues.unshift(created);
                this.renderVenues();
            }

            this.showSuccess('Venue created successfully!');
            this.hideModal('create-venue-modal');
            e.target.reset();

        } catch (error) {
            console.error('Failed to create venue:', error);
            const status = error?.status || error?.response?.status;
            if (status === 401) {
                this.showError('Authentication required. Please login as an admin.');
                return;
            }
            if (status === 403) {
                this.showError('Insufficient permissions to create venues.');
                return;
            }
            const msg = error?.response?.message || error?.message || 'Failed to create venue.';
            this.showError(msg);
        }
    }

    async saveGeneralSettings(e) {
        const formData = new FormData(e.target);
        const settings = {
            site_name: formData.get('site_name'),
            max_registration_per_student: formData.get('max_registration_per_student'),
            registration_deadline_hours: formData.get('registration_deadline_hours')
        };

        try {
            await api.updateSettings(settings);
            this.showSuccess('Settings saved successfully!');

        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showError('Failed to save settings.');
        }
    }

    async saveNotificationSettings(e) {
        const formData = new FormData(e.target);
        const settings = {
            email_notifications: formData.get('email_notifications') ? 'true' : 'false'
        };

        try {
            await api.updateSettings(settings);
            this.showSuccess('Notification settings saved successfully!');

        } catch (error) {
            console.error('Failed to save notification settings:', error);
            this.showError('Failed to save notification settings.');
        }
    }

    resetAndLoadEvents() {
        this.currentPage = 1;
        this.events = [];
        this.hasMoreEvents = true;
        this.loadEvents();
    }

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container && this.currentPage === 1) {
            container.innerHTML = `
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading...</p>
                </div>
            `;
        }
    }

    hideLoading(containerId) {
        // Loading is handled by render methods
    }

    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (loadMoreBtn) {
            if (this.hasMoreEvents) {
                loadMoreBtn.style.display = 'block';
                loadMoreBtn.disabled = this.isLoading;
                loadMoreBtn.textContent = this.isLoading ? 'Loading...' : 'Load More Events';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    }
}

// Global functions for HTML onclick handlers
function approveEvent(eventId) {
    if (window.dashboardManager) {
        window.dashboardManager.currentEventId = eventId;
        window.dashboardManager.showEventApprovalModal(eventId);
        // Pre-select approve option
        setTimeout(() => {
            const approveRadio = document.querySelector('input[value="approved"]');
            if (approveRadio) approveRadio.checked = true;
        }, 100);
    }
}

function rejectEvent(eventId) {
    if (window.dashboardManager) {
        window.dashboardManager.currentEventId = eventId;
        window.dashboardManager.showEventApprovalModal(eventId);
        // Pre-select reject option
        setTimeout(() => {
            const rejectRadio = document.querySelector('input[value="rejected"]');
            if (rejectRadio) rejectRadio.checked = true;
        }, 100);
    }
}

function viewEventDetails(eventId) {
    // Implementation for viewing event details
    window.dashboardManager?.showSuccess('Event details feature coming soon!');
}

function editUser(userId) {
    // Populate and show edit user modal
    (async () => {
        try {
            const res = await api.getUser(userId);
            const user = res.user;
            if (!user) return window.dashboardManager?.showError('User not found');

            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('edit-first-name').value = user.first_name || '';
            document.getElementById('edit-last-name').value = user.last_name || '';
            document.getElementById('edit-phone').value = user.phone || '';
            document.getElementById('edit-department').value = user.department || '';
            document.getElementById('edit-is-active').checked = !!user.is_active;

            window.dashboardManager?.showModal('edit-user-modal');
        } catch (err) {
            console.error('Failed to fetch user:', err);
            window.dashboardManager?.showError('Failed to fetch user details');
        }
    })();
}

function toggleUserStatus(userId, isActive) {
    const action = isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;
    (async () => {
        try {
            await api.updateUser(userId, { isActive: !isActive });
            window.dashboardManager?.showSuccess(`User ${action}d successfully!`);
            window.dashboardManager?.loadUsers();
        } catch (err) {
            console.error('Toggle user status failed:', err);
            window.dashboardManager?.showError('Failed to update user status');
        }
    })();
}

function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    (async () => {
        try {
            await api.deleteUser(userId);
            window.dashboardManager?.showSuccess('User deleted successfully!');
            window.dashboardManager?.loadUsers();
        } catch (err) {
            console.error('Delete user failed:', err);
            window.dashboardManager?.showError(err.message || 'Failed to delete user');
        }
    })();
}

function editVenue(venueId) {
    // Populate and show edit venue modal
    (async () => {
        try {
            console.debug('editVenue called with id=', venueId);
            const res = await api.getVenue(venueId);
            const venue = res.venue;
            if (!venue) return window.dashboardManager?.showError('Venue not found');

            document.getElementById('edit-venue-id').value = venue.id;
            document.getElementById('edit-venue-name').value = venue.name || '';
            document.getElementById('edit-venue-location').value = venue.location || '';
            document.getElementById('edit-venue-capacity').value = venue.capacity || '';
            document.getElementById('edit-venue-facilities').value = venue.facilities || '';

            window.dashboardManager?.showModal('edit-venue-modal');
        } catch (err) {
            console.error('Failed to fetch venue:', err);
            window.dashboardManager?.showError('Failed to fetch venue details');
        }
    })();
}

function deleteVenue(venueId) {
    if (!confirm('Are you sure you want to delete this venue? This action cannot be undone.')) return;
    if (!api.token) {
        window.dashboardManager?.showError('You must be logged in as an admin to delete a venue. Please login and try again.');
        return;
    }
    (async () => {
        try {
            await api.deleteVenue(venueId);
            // Remove from local list and re-render for instant UI update
            if (window.dashboardManager && Array.isArray(window.dashboardManager.venues)) {
                window.dashboardManager.venues = window.dashboardManager.venues.filter(v => String(v.id) !== String(venueId));
                window.dashboardManager.renderVenues();
            } else {
                window.dashboardManager?.loadVenues();
            }
            window.dashboardManager?.showSuccess('Venue deleted successfully!');
        } catch (err) {
            console.error('Delete venue failed:', err);
            const status = err?.status || err?.response?.status;
            if (status === 401) {
                window.dashboardManager?.showError('Authentication required. Please login as an admin.');
                return;
            }
            if (status === 403) {
                window.dashboardManager?.showError('Insufficient permissions to delete venues.');
                return;
            }
            window.dashboardManager?.showError(err?.response?.message || err?.message || 'Failed to delete venue');
        }
    })();
}

// Global helper for inline toggle (used by HTML button)
function toggleInlineVenueForm() {
    if (window.dashboardManager && typeof window.dashboardManager.toggleInlineVenueForm === 'function') {
        window.dashboardManager.toggleInlineVenueForm();
    } else {
        const el = document.getElementById('inline-create-venue');
        if (el) el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
    }
}

function showAnnouncementModal() {
    if (window.dashboardManager) {
        window.dashboardManager.showModal('announcement-modal');
    }
}

function showCreateVenueModal() {
    if (window.dashboardManager) {
        window.dashboardManager.showModal('create-venue-modal');
    }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Always create an AdminDashboard instance for admin pages
    window.dashboardManager = new AdminDashboard();

    // Load initial data
    window.dashboardManager.loadVenues();
    window.dashboardManager.loadAnalytics();
    window.dashboardManager.loadSettings();
    // Ensure admin-specific dashboard sections load
    window.dashboardManager.loadDashboardStats();
    window.dashboardManager.loadRecentActivity();
    window.dashboardManager.loadEvents();
    // Preload users so Users table is available without clicking the nav
    window.dashboardManager.loadUsers();

    // Wire users pagination controls
    const usersPrevBtn = document.getElementById('users-prev-btn');
    const usersNextBtn = document.getElementById('users-next-btn');
    if (usersPrevBtn) {
        usersPrevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.dashboardManager.currentUserPage > 1) {
                window.dashboardManager.currentUserPage -= 1;
                window.dashboardManager.loadUsers();
            }
        });
    }
    if (usersNextBtn) {
        usersNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.dashboardManager.currentUserPage < window.dashboardManager.totalUserPages) {
                window.dashboardManager.currentUserPage += 1;
                window.dashboardManager.loadUsers();
            }
        });
    }

    // Wire user menu toggle
    const userMenuToggle = document.getElementById('user-menu-toggle');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuToggle && userDropdown) {
        userMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = userMenuToggle.getAttribute('aria-expanded') === 'true';
            userMenuToggle.setAttribute('aria-expanded', String(!expanded));
            // Toggle dropdown visibility by toggling class
            userDropdown.classList.toggle('open');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target)) {
                userDropdown.classList.remove('open');
                userMenuToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Delegated handler for venue edit/delete buttons in the venues table
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest && e.target.closest('.venue-edit-btn');
        const delBtn = e.target.closest && e.target.closest('.venue-delete-btn');

        if (editBtn) {
            const vid = editBtn.getAttribute('data-venue-id');
            if (vid) editVenue(vid);
        }

        if (delBtn) {
            const vid = delBtn.getAttribute('data-venue-id');
            if (vid) deleteVenue(vid);
        }
    });

    // Wire the non-inline Add Venue toggle and inline cancel button (to satisfy CSP)
    const btnToggleInline = document.getElementById('btn-toggle-inline-venue');
    if (btnToggleInline) {
        btnToggleInline.addEventListener('click', (e) => {
            e.preventDefault();
            toggleInlineVenueForm();
        });
    }

    const inlineCancel = document.getElementById('inline-create-venue-cancel');
    if (inlineCancel) {
        inlineCancel.addEventListener('click', (e) => {
            e.preventDefault();
            const el = document.getElementById('inline-create-venue');
            if (el) el.style.display = 'none';
        });
    }

    // Delegated handler for quick action buttons and stat-card clicks (data-section)
    document.addEventListener('click', (e) => {
        const actionBtn = e.target.closest && e.target.closest('.action-card');
        const statCard = e.target.closest && e.target.closest('.stat-card');
        if (actionBtn) {
            const section = actionBtn.dataset.section;
            if (section) showSection(section);
        }
        if (statCard) {
            const section = statCard.dataset.section;
            if (section) showSection(section);
        }
    });

    // Keyboard accessibility for elements with data-section: activate on Enter/Space
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const active = document.activeElement;
            if (active && active.dataset && active.dataset.section) {
                e.preventDefault();
                showSection(active.dataset.section);
            }
        }
    });

    // Announcement button
    const btnAnnouncement = document.getElementById('btn-open-announcement');
    if (btnAnnouncement) btnAnnouncement.addEventListener('click', (e) => { e.preventDefault(); showAnnouncementModal(); });

    // Delegated handler for modal cancel buttons (data-modal)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('.btn-cancel-modal');
        if (btn) {
            const modalId = btn.dataset.modal;
            if (modalId) hideModal(modalId);
        }
    });

    // Edit user form submit
    const editUserForm = document.getElementById('edit-user-form');
    if (editUserForm) {
        editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit-user-id').value;
            const payload = {
                firstName: document.getElementById('edit-first-name').value,
                lastName: document.getElementById('edit-last-name').value,
                phone: document.getElementById('edit-phone').value || null,
                department: document.getElementById('edit-department').value || null,
                isActive: document.getElementById('edit-is-active').checked
            };

            try {
                await api.updateUser(userId, payload);
                window.dashboardManager?.showSuccess('User updated successfully');
                window.dashboardManager?.hideModal('edit-user-modal');
                window.dashboardManager?.loadUsers();
            } catch (err) {
                console.error('Failed to update user:', err);
                window.dashboardManager?.showError('Failed to update user');
            }
        });
    }
    // Edit venue form submit
    const editVenueForm = document.getElementById('edit-venue-form');
    if (editVenueForm) {
        editVenueForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!api.token) {
                window.dashboardManager?.showError('You must be logged in as an admin to update a venue. Please login and try again.');
                return;
            }
            const venueId = document.getElementById('edit-venue-id').value;
            const payload = {
                name: document.getElementById('edit-venue-name').value,
                location: document.getElementById('edit-venue-location').value,
                capacity: parseInt(document.getElementById('edit-venue-capacity').value, 10) || 0,
                facilities: document.getElementById('edit-venue-facilities').value || null
            };

            try {
                await api.updateVenue(venueId, payload);
                // Fetch the updated venue to obtain full data (server returns only message)
                let updated = null;
                try {
                    const fetched = await api.getVenue(venueId);
                    updated = fetched.venue || fetched;
                } catch (fetchErr) {
                    console.error('Failed to fetch updated venue:', fetchErr);
                }

                if (updated && window.dashboardManager && Array.isArray(window.dashboardManager.venues)) {
                    const idx = window.dashboardManager.venues.findIndex(v => String(v.id) === String(venueId));
                    if (idx !== -1) {
                        window.dashboardManager.venues[idx] = updated;
                        window.dashboardManager.renderVenues();
                    } else {
                        window.dashboardManager.loadVenues();
                    }
                } else {
                    // If we couldn't fetch updated data, reload list as fallback
                    window.dashboardManager?.loadVenues();
                }

                window.dashboardManager?.showSuccess('Venue updated successfully');
                window.dashboardManager?.hideModal('edit-venue-modal');
            } catch (err) {
                console.error('Failed to update venue:', err);
                const status = err?.status || err?.response?.status;
                if (status === 401) {
                    window.dashboardManager?.showError('Authentication required. Please login as an admin.');
                    return;
                }
                if (status === 403) {
                    window.dashboardManager?.showError('Insufficient permissions to update venues.');
                    return;
                }
                const m = err?.response?.message || err?.message || 'Failed to update venue';
                window.dashboardManager?.showError(m);
            }
        });
    }

    // Inline create venue form submit (table inline form)
    const inlineCreateForm = document.getElementById('inline-create-venue-form');
    if (inlineCreateForm) {
        inlineCreateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!api.token) {
                window.dashboardManager?.showError('You must be logged in as an admin to create a venue. Please login and try again.');
                return;
            }
            const fd = new FormData(inlineCreateForm);
            const venueData = {
                name: fd.get('name'),
                location: fd.get('location'),
                capacity: parseInt(fd.get('capacity'), 10) || 0,
                facilities: fd.get('facilities') || null
            };
            try {
                const resp = await api.createVenue(venueData);
                let created = null;
                if (resp && resp.venue) {
                    created = resp.venue;
                } else if (resp && resp.venueId) {
                    const fetched = await api.getVenue(resp.venueId);
                    created = fetched.venue || fetched;
                }

                if (created && window.dashboardManager && Array.isArray(window.dashboardManager.venues)) {
                    window.dashboardManager.venues.unshift(created);
                    window.dashboardManager.renderVenues();
                } else {
                    window.dashboardManager?.loadVenues();
                }
                inlineCreateForm.reset();
                document.getElementById('inline-create-venue').style.display = 'none';
                window.dashboardManager?.showSuccess('Venue created successfully!');
            } catch (err) {
                console.error('Failed to create venue (inline):', err);
                const status = err?.status || err?.response?.status;
                if (status === 401) {
                    window.dashboardManager?.showError('Authentication required. Please login as an admin.');
                    return;
                }
                if (status === 403) {
                    window.dashboardManager?.showError('Insufficient permissions to create venues.');
                    return;
                }
                window.dashboardManager?.showError(err?.response?.message || err?.message || 'Failed to create venue');
            }
        });
    }

    // Small helper to allow inline onclicks to hide modals
    window.hideModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
});

