// Settings page JS
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // load system settings (admin-only)
        const resp = await api.getSettings();
        const settings = resp.settings || {};

        document.getElementById('site-name').value = settings.site_name?.value || '';
        document.getElementById('max-registration-per-student').value = settings.max_registration_per_student?.value || '';
        document.getElementById('email-notifications').checked = settings.email_notifications?.value === 'true';
    } catch (error) {
        // ignore non-admin viewing
        console.debug('Settings load:', error);
    }

    const accountForm = document.getElementById('account-settings-form');
    accountForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        // This demo only toggles local preference
        alert('Account settings saved (demo)');
    });

    const systemForm = document.getElementById('system-settings-form');
    systemForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const settings = {
            site_name: document.getElementById('site-name').value,
            max_registration_per_student: document.getElementById('max-registration-per-student').value
        };
        try {
            await api.updateSettings(settings);
            alert('System settings saved');
        } catch (error) {
            console.error('Failed to save system settings:', error);
            alert('Failed to save system settings');
        }
    });
});