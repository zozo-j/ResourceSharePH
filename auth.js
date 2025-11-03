// Authentication System
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.users = [];
    }

    // Simple hash function (for demo - use proper hashing in production)
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Load users (hardcoded + localStorage)
    async loadUsers() {
        try {
            // Try to load users from the CSV assets via the CSVDatabase (if available)
            let csvUsers = [];
            if (typeof db !== 'undefined' && typeof db.loadTable === 'function') {
                const rows = await db.loadTable('users');
                csvUsers = rows.map(r => ({
                    ID: r.ID || r.Id || r.id || '',
                    Username: r.Username || r.username || '',
                    PasswordHash: r.PasswordHash || r.PasswordHash || '',
                    Role: r.Role || r.role || 'user',
                    FullName: r.FullName || r['Full Name'] || r.fullName || '',
                    Barangay: r.Barangay || r.barangay || '',
                    Phone: r.Phone || r.phone || '',
                    PhoneVerified: r.PhoneVerified === 'true' || r.PhoneVerified === true || false,
                    DateRegistered: r.DateRegistered || r['Date Registered'] || ''
                }));
            }

            const savedUsers = localStorage.getItem('registeredUsers');
            const registeredUsers = savedUsers ? JSON.parse(savedUsers) : [];

            // Merge CSV users and registeredUsers, avoiding duplicate usernames (registeredUsers take precedence)
            const usersByUsername = {};
            csvUsers.forEach(u => {
                if (u.Username) usersByUsername[u.Username] = u;
            });
            registeredUsers.forEach(u => {
                if (u.Username) usersByUsername[u.Username] = u;
            });

            this.users = Object.values(usersByUsername);
        } catch (err) {
            // Fallback: load from localStorage only
            const savedUsers = localStorage.getItem('registeredUsers');
            const registeredUsers = savedUsers ? JSON.parse(savedUsers) : [];
            this.users = [...registeredUsers];
            console.error('Error loading users from CSV, falling back to localStorage:', err);
        }
    }

    // Login function
    async login(username, password) {
        await this.loadUsers();
        const hashedPassword = await this.hashPassword(password);
        
        console.log('Login attempt:', username);
        console.log('Generated hash:', hashedPassword);
        console.log('Users loaded:', this.users.length);
        
        const user = this.users.find(u => {
            console.log('Checking user:', u.Username, 'Hash:', u.PasswordHash);
            return u.Username === username && u.PasswordHash === hashedPassword;
        });

        if (user) {

            
            this.currentUser = {
                id: user.ID,
                username: user.Username,
                role: user.Role,
                fullName: user.FullName,
                barangay: user.Barangay,
                phone: user.Phone || '',
                phoneVerified: user.PhoneVerified || user.Role === 'admin'
            };
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            return true;
        }
        return false;
    }

    // Logout function
    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        showLoginForm();
    }

    // Check if user is logged in
    isLoggedIn() {
        if (!this.currentUser) {
            const saved = localStorage.getItem('currentUser');
            if (saved) {
                this.currentUser = JSON.parse(saved);
            }
        }
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Update user profile
    async updateProfile(fullName, barangay, phone, currentPassword, newPassword) {
        if (!this.currentUser) return false;
        
        // Reload users to get latest data
        await this.loadUsers();
        
        // Verify current password
        const hashedCurrentPassword = await this.hashPassword(currentPassword);
        const user = this.users.find(u => 
            u.Username === this.currentUser.username && u.PasswordHash === hashedCurrentPassword
        );
        
        if (!user) return { success: false, message: 'Current password is incorrect' };
        
        // Update user data
        const userIndex = this.users.findIndex(u => u.Username === this.currentUser.username);
        if (userIndex !== -1) {
            this.users[userIndex].FullName = fullName;
            this.users[userIndex].Barangay = barangay;
            this.users[userIndex].Phone = phone;
            
            // Update password if provided
            if (newPassword) {
                this.users[userIndex].PasswordHash = await this.hashPassword(newPassword);
            }
            
            // Update current user session
            this.currentUser.fullName = fullName;
            this.currentUser.barangay = barangay;
            this.currentUser.phone = phone;
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            
            // Save updated user data to localStorage
            const savedUsers = localStorage.getItem('registeredUsers');
            if (savedUsers) {
                const registeredUsers = JSON.parse(savedUsers);
                const savedUserIndex = registeredUsers.findIndex(u => u.Username === this.currentUser.username);
                if (savedUserIndex !== -1) {
                    registeredUsers[savedUserIndex] = this.users[userIndex];
                    localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
                }
            }
            
            // Refresh Users table if visible
            if (typeof renderUsers === 'function') {
                renderUsers();
            }
            
            return { success: true, message: 'Profile updated successfully' };
        }
        
        return { success: false, message: 'Update failed' };
    }

    // Register new user
    async register(username, password, fullName, barangay, phone, role) {
        // Check if username already exists
        if (this.users.find(u => u.Username === username)) {
            return { success: false, message: 'Username already exists' };
        }
        
        const hashedPassword = await this.hashPassword(password);
        const newUser = {
            ID: Date.now().toString(),
            Username: username,
            PasswordHash: hashedPassword,
            Role: role || 'user',
            FullName: fullName,
            Barangay: barangay,
            Phone: phone,
            PhoneVerified: true,
            DateRegistered: new Date().toLocaleDateString()
        };
        
        this.users.push(newUser);
        
        // Save to localStorage
        const savedUsers = localStorage.getItem('registeredUsers');
        const registeredUsers = savedUsers ? JSON.parse(savedUsers) : [];
        registeredUsers.push(newUser);
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        
        // Add to appData.users for CSV export
        if (typeof appData !== 'undefined') {
            appData.users.push({
                id: newUser.ID,
                username: newUser.Username,
                fullName: newUser.FullName,
                role: newUser.Role,
                barangay: newUser.Barangay,
                phone: newUser.Phone,
                dateRegistered: newUser.DateRegistered
            });
        }
        
        // Refresh Users table if visible
        if (typeof renderUsers === 'function') {
            renderUsers();
        }
        
        // Add to Users.csv (download updated file)
        this.appendToUsersCSV(newUser);
        
        return { success: true, message: 'Registration successful' };
    }

    // Append new user to Users.csv
    async appendToUsersCSV(newUser) {
        try {
            // Read current Users.csv
            const response = await fetch('./assets/Users.csv');
            const csvContent = await response.text();
            
            // Append new user row
            const newRow = `\n${newUser.ID},${newUser.Username},${newUser.PasswordHash},${newUser.Role},${newUser.FullName},${newUser.Barangay},${newUser.DateRegistered}`;
            const updatedCSV = csvContent + newRow;
            
            // Download updated CSV file
            const blob = new Blob([updatedCSV], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Users_Updated.csv';
            a.click();
            
            window.URL.revokeObjectURL(url);
            
            console.log('Updated Users.csv downloaded with new user:', newUser.Username);
        } catch (error) {
            console.error('Error updating Users.csv:', error);
        }
    }
}

// Initialize auth system
const auth = new AuthSystem();

// Show login form
function showLoginForm() {
    document.body.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);">
            <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); width: 400px;">
                <h2 style="text-align: center; margin-bottom: 30px; color: #333;">🇵🇭 ResourceShare PH</h2>
                <div id="login-form">
                    <input type="text" id="username" placeholder="Username" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                    <input type="password" id="password" placeholder="Password" style="width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                    <button onclick="handleLogin()" style="width: 100%; padding: 15px; background: #ff6b6b; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 15px;">Login</button>
                    <button onclick="showRegisterForm()" style="width: 100%; padding: 15px; background: #feca57; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Register</button>
                </div>
                <div id="register-form" style="display: none;">
                    <input type="text" id="reg-username" placeholder="Username" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                    <input type="password" id="reg-password" placeholder="Password" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                    <input type="text" id="reg-fullname" placeholder="Full Name" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                    <input type="text" id="reg-barangay" placeholder="Barangay" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                    <input type="tel" id="reg-phone" placeholder="Phone Number (09xxxxxxxxx)" style="width: 100%; padding: 12px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                    <select id="reg-role" style="width: 100%; padding: 12px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px;">
                        <option value="">Select Role</option>
                        <option value="user">User</option>
                        <option value="volunteer">Volunteer</option>
                    </select>
                    <button onclick="handleRegister()" style="width: 100%; padding: 15px; background: #28a745; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 15px;">Register</button>
                    <button onclick="showLoginForm()" style="width: 100%; padding: 15px; background: #6c757d; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Back to Login</button>
                </div>

            </div>
        </div>
    `;
}

function showRegisterForm() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
}

// Handle login
async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }

    const success = await auth.login(username, password);
    if (success) {
        location.reload();
    } else {
        alert('Invalid username or password');
    }
}

// Handle registration
async function handleRegister() {
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const fullName = document.getElementById('reg-fullname').value;
    const barangay = document.getElementById('reg-barangay').value;
    const phone = document.getElementById('reg-phone').value;
    const role = document.getElementById('reg-role').value;

    if (!username || !password || !fullName || !barangay || !phone || !role) {
        alert('Please fill in all fields');
        return;
    }

    // Validate phone format
    if (!/^09\d{9}$/.test(phone)) {
        alert('Please enter a valid Philippine mobile number (09xxxxxxxxx)');
        return;
    }

    // Complete registration directly
    const result = await auth.register(username, password, fullName, barangay, phone, role);
    
    if (result.success) {
        alert(result.message + ' Please login.');
        showLoginForm();
    } else {
        alert(result.message);
    }
}



// Add logout button to main app
function addLogoutButton() {
    const header = document.querySelector('header');
    if (header && auth.isLoggedIn()) {
        const user = auth.getCurrentUser();
        header.innerHTML += `
            <div class="profile-dropdown" style="position: absolute; top: 20px; right: 20px;">
                <button class="profile-icon" onclick="toggleProfileDropdown()">👤</button>
                <div class="dropdown-content" id="profileDropdown">
                    <div style="text-align: center; margin-bottom: 15px; color: #333; padding-bottom: 15px; border-bottom: 1px solid #eee;">
                        <strong>${user.fullName}</strong><br>
                        <small>${user.barangay} • ${user.role}</small>
                    </div>
                    <div class="profile-menu">
                        <button onclick="showEditProfile()" style="width: 100%; padding: 10px; margin-bottom: 8px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">📝 Edit Profile</button>
                        <button onclick="showChangePassword()" style="width: 100%; padding: 10px; margin-bottom: 8px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">🔒 Change Password</button>
                        <button onclick="auth.logout()" style="width: 100%; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">🚪 Logout</button>
                    </div>
                    <div class="profile-form" id="editProfileForm" style="display: none;">
                        <h4 style="margin-bottom: 15px; color: #333;">Edit Profile</h4>
                        <input type="text" id="profile-fullname" placeholder="Full Name" value="${user.fullName}">
                        <input type="text" id="profile-barangay" placeholder="Barangay" value="${user.barangay}">
                        <input type="tel" id="profile-phone" placeholder="Phone Number" value="${user.phone || ''}">
                        <input type="password" id="profile-current-password" placeholder="Current Password">
                        <button onclick="updateProfileInfo()">Update Profile</button>
                        <button onclick="showProfileMenu()" style="background: #6c757d; margin-top: 5px;">Back</button>
                    </div>
                    <div class="profile-form" id="changePasswordForm" style="display: none;">
                        <h4 style="margin-bottom: 15px; color: #333;">Change Password</h4>
                        <input type="password" id="password-current" placeholder="Current Password">
                        <input type="password" id="password-new" placeholder="New Password">
                        <input type="password" id="password-confirm" placeholder="Confirm New Password">
                        <button onclick="updatePassword()">Change Password</button>
                        <button onclick="showProfileMenu()" style="background: #6c757d; margin-top: 5px;">Back</button>
                    </div>
                </div>
            </div>
        `;

    }
}

// Toggle profile dropdown
function toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.toggle('show');
    showProfileMenu();
}

// Show profile menu
function showProfileMenu() {
    document.querySelector('.profile-menu').style.display = 'block';
    document.getElementById('editProfileForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'none';
}

// Show edit profile form
function showEditProfile() {
    document.querySelector('.profile-menu').style.display = 'none';
    document.getElementById('editProfileForm').style.display = 'block';
    document.getElementById('changePasswordForm').style.display = 'none';
}

// Show change password form
function showChangePassword() {
    document.querySelector('.profile-menu').style.display = 'none';
    document.getElementById('editProfileForm').style.display = 'none';
    document.getElementById('changePasswordForm').style.display = 'block';
}

// Update profile info only
async function updateProfileInfo() {
    const fullName = document.getElementById('profile-fullname').value;
    const barangay = document.getElementById('profile-barangay').value;
    const phone = document.getElementById('profile-phone').value;
    const currentPassword = document.getElementById('profile-current-password').value;
    
    if (!fullName || !barangay || !currentPassword) {
        alert('Please fill in all required fields');
        return;
    }
    
    const result = await auth.updateProfile(fullName, barangay, phone, currentPassword, null);
    
    if (result.success) {
        alert(result.message);
        document.getElementById('profile-current-password').value = '';
        document.getElementById('profileDropdown').classList.remove('show');
        addLogoutButton();
    } else {
        alert(result.message);
    }
}

// Update password only
async function updatePassword() {
    const currentPassword = document.getElementById('password-current').value;
    const newPassword = document.getElementById('password-new').value;
    const confirmPassword = document.getElementById('password-confirm').value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }
    
    const user = auth.getCurrentUser();
    const result = await auth.updateProfile(user.fullName, user.barangay, user.phone, currentPassword, newPassword);
    
    if (result.success) {
        alert('Password changed successfully');
        document.getElementById('password-current').value = '';
        document.getElementById('password-new').value = '';
        document.getElementById('password-confirm').value = '';
        document.getElementById('profileDropdown').classList.remove('show');
    } else {
        alert(result.message);
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('profileDropdown');
    const profileIcon = document.querySelector('.profile-icon');
    
    if (dropdown && !dropdown.contains(event.target) && event.target !== profileIcon) {
        dropdown.classList.remove('show');
    }
});

// Update user profile
async function updateProfile() {
    const fullName = document.getElementById('profile-fullname').value;
    const barangay = document.getElementById('profile-barangay').value;
    const currentPassword = document.getElementById('profile-current-password').value;
    const newPassword = document.getElementById('profile-new-password').value;
    const confirmPassword = document.getElementById('profile-confirm-password').value;
    
    if (!fullName || !barangay || !currentPassword) {
        alert('Please fill in all required fields');
        return;
    }
    
    if (newPassword && newPassword !== confirmPassword) {
        alert('New passwords do not match');
        return;
    }
    
    const result = await auth.updateProfile(fullName, barangay, currentPassword, newPassword);
    
    if (result.success) {
        alert(result.message);
        // Clear password fields
        document.getElementById('profile-current-password').value = '';
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';
        // Close dropdown and update header
        document.getElementById('profileDropdown').classList.remove('show');
        addLogoutButton();
    } else {
        alert(result.message);
    }
}

// Show admin-only elements
function showAdminElements() {
    const user = auth.getCurrentUser();
    if (user && user.role === 'admin') {
        const adminElements = document.querySelectorAll('.admin-only');
        adminElements.forEach(element => {
            element.style.display = 'inline-block';
        });
        renderUsers();
    }
}

// Render users list (admin only)
function renderUsers() {
    const container = document.getElementById('users-container');
    if (!container) return;
    
    const users = auth.users;
    
    if (users.length === 0) {
        container.innerHTML = '<div class="empty-state">No users found.</div>';
        return;
    }
    
    container.innerHTML = users.map(user => `
        <div class="resource-item">
            <div class="item-header">
                <div class="item-title">${user.FullName}</div>
                <div class="item-category">${user.Role}</div>
            </div>
            <div class="item-details">
                <div class="item-location">📍 ${user.Barangay}</div>
                <div><strong>Username:</strong> ${user.Username}</div>
                ${user.Phone ? `<div><strong>Phone:</strong> ${user.Phone}</div>` : ''}
                <small>Registered on ${user.DateRegistered}</small>
            </div>
        </div>
    `).join('');
}