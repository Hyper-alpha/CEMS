// Profile page JS
document.addEventListener('DOMContentLoaded', async () => {
    window.profileManager = {};

    try {
        const resp = await api.getProfile();
        const user = resp.user;
        if (!user) return;

        document.getElementById('profile-name').textContent = `${user.firstName} ${user.lastName}`;
        document.getElementById('profile-role').textContent = user.role;
        document.getElementById('profile-initials').textContent = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();

        document.getElementById('firstName').value = user.firstName || '';
        document.getElementById('lastName').value = user.lastName || '';
        document.getElementById('email').value = user.email || '';
        document.getElementById('department').value = user.department || '';
    } catch (error) {
        console.error('Failed to load profile:', error);
        alert('Failed to load profile');
    }

    const profileForm = document.getElementById('profile-form');
    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            department: document.getElementById('department').value
        };
        try {
            await api.updateProfile(data);
            alert('Profile updated successfully');
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Failed to update profile');
        }
    });

    const changePasswordForm = document.getElementById('change-password-form');
    changePasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        try {
            await api.changePassword(currentPassword, newPassword);
            alert('Password changed successfully');
            changePasswordForm.reset();
        } catch (error) {
            console.error('Failed to change password:', error);
            alert('Failed to change password');
        }
    });
});