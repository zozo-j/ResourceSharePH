// Load data from localStorage
function loadData() {
    const saved = localStorage.getItem('resourceSharePH');
    if (saved) {
        appData = { ...appData, ...JSON.parse(saved) };
    }
}

// Save data to localStorage
function saveData() {
    localStorage.setItem('resourceSharePH', JSON.stringify(appData));
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    // Try to load from CSV first, fallback to localStorage
    loadDataFromCSV();
});

// Tab functionality test pre-hook minify
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const tabSelect = document.getElementById('tab-select');

    function activateTab(target) {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        const btn = Array.from(tabBtns).find(b => b.dataset.tab === target);
        if (btn) btn.classList.add('active');

        const content = document.getElementById(target);
        if (content) {
            // remove inline styles from other contents
            document.querySelectorAll('.tab-content').forEach(tc => {
                tc.style.transition = '';
                tc.style.opacity = '';
                tc.style.transform = '';
            });

            // Activate and animate the target content (fade + slide)
            content.classList.add('active');
            content.style.opacity = 0;
            content.style.transform = 'translateY(8px)';
            // force reflow then animate
            requestAnimationFrame(() => {
                content.style.transition = 'opacity 240ms ease, transform 240ms ease';
                content.style.opacity = 1;
                content.style.transform = 'translateY(0)';
            });
        }

        if (tabSelect) tabSelect.value = target;
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            activateTab(btn.dataset.tab);
        });
    });

    if (tabSelect) {
        // populate select options based on existing tab buttons (keeps labels in sync)
        // use small emoji icons in the label; hide admin-only option unless current user is admin
        const iconMap = {
            share: '🤝',
            request: '🆘',
            kitchen: '🍲',
            transport: '🚗',
            users: '👥'
        };

        // determine whether current user is admin
        const isAdmin = (typeof auth !== 'undefined' && auth.isLoggedIn() && auth.getCurrentUser() && auth.getCurrentUser().role === 'admin');

        if (tabSelect.options.length === 0) {
            tabBtns.forEach(b => {
                const isAdminOnly = b.classList.contains('admin-only');
                if (isAdminOnly && !isAdmin) return; // skip admin-only tabs for non-admins

                const opt = document.createElement('option');
                opt.value = b.dataset.tab;
                const icon = iconMap[b.dataset.tab] || '';
                opt.textContent = `${icon} ${b.textContent.trim()}`;
                tabSelect.appendChild(opt);
            });
        }

        tabSelect.addEventListener('change', () => {
            activateTab(tabSelect.value);
        });
    }

    // Ensure an active tab is set on init
    const activeBtn = document.querySelector('.tab-btn.active') || tabBtns[0];
    if (activeBtn) activateTab(activeBtn.dataset.tab);
}

// Share Resource
function shareResource() {
    const name = document.getElementById('resource-name').value;
    const category = document.getElementById('resource-category').value;
    const location = document.getElementById('resource-location').value;
    const contact = document.getElementById('resource-contact').value;
    const notes = document.getElementById('resource-notes').value;

    if (!name || !category || !location || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    const resource = {
        id: Date.now(),
        name,
        category,
        location,
        contact,
        notes,
        dateShared: new Date().toLocaleDateString(),
        username: auth.getCurrentUser().username
    };

    appData.resources.push(resource);
    saveData();
    renderResources();
    clearResourceForm();
}

function clearResourceForm() {
    document.getElementById('resource-name').value = '';
    document.getElementById('resource-category').value = '';
    document.getElementById('resource-location').value = '';
    document.getElementById('resource-contact').value = '';
    document.getElementById('resource-notes').value = '';
}

function renderResources() {
    const container = document.getElementById('available-resources');
    
    if (appData.resources.length === 0) {
        container.innerHTML = '<div class="empty-state">No resources shared yet. Be the first to help your community!</div>';
        return;
    }

    const currentUser = auth.getCurrentUser();
    container.innerHTML = appData.resources.map(resource => `
        <div class="resource-item">
            <div class="item-header">
                <div class="item-title">${resource.name}</div>
                <div class="item-category">${getCategoryLabel(resource.category)}</div>
            </div>
            <div class="item-details">
                <div class="item-location">📍 ${resource.location}</div>
                ${resource.notes ? `<p>${resource.notes}</p>` : ''}
                <small>Shared on ${resource.dateShared} by ${resource.username}</small>
            </div>
            <div class="item-contact">📞 ${resource.contact}</div>
            ${(resource.username === currentUser.username || currentUser.role === 'admin') ? 
                `<div class="crud-buttons">
                    <button onclick="editResource(${resource.id})" class="edit-btn">Edit</button>
                    <button onclick="deleteResource(${resource.id})" class="delete-btn">Delete</button>
                </div>` : ''}
        </div>
    `).join('');
}

// Submit Request
function submitRequest() {
    const need = document.getElementById('request-need').value;
    const urgency = document.getElementById('request-urgency').value;
    const location = document.getElementById('request-location').value;
    const contact = document.getElementById('request-contact').value;
    const details = document.getElementById('request-details').value;

    if (!need || !urgency || !location || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    const request = {
        id: Date.now(),
        need,
        urgency,
        location,
        contact,
        details,
        dateRequested: new Date().toLocaleDateString(),
        username: auth.getCurrentUser().username
    };

    appData.requests.push(request);
    saveData();
    renderRequests();
    clearRequestForm();
}

function clearRequestForm() {
    document.getElementById('request-need').value = '';
    document.getElementById('request-urgency').value = '';
    document.getElementById('request-location').value = '';
    document.getElementById('request-contact').value = '';
    document.getElementById('request-details').value = '';
}

function renderRequests() {
    const container = document.getElementById('help-requests');
    
    if (appData.requests.length === 0) {
        container.innerHTML = '<div class="empty-state">No help requests at the moment.</div>';
        return;
    }

    // Sort by urgency
    const sortedRequests = appData.requests.sort((a, b) => {
        const urgencyOrder = { critical: 0, urgent: 1, moderate: 2, low: 3 };
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    const currentUser = auth.getCurrentUser();
    container.innerHTML = sortedRequests.map(request => `
        <div class="request-item">
            <div class="item-header">
                <div class="item-title">${request.need}</div>
                <div class="item-category urgency-${request.urgency}">${getUrgencyLabel(request.urgency)}</div>
            </div>
            <div class="item-details">
                <div class="item-location">📍 ${request.location}</div>
                ${request.details ? `<p>${request.details}</p>` : ''}
                <small>Requested on ${request.dateRequested} by ${request.username}</small>
            </div>
            <div class="item-contact">📞 ${request.contact}</div>
            ${(request.username === currentUser.username || currentUser.role === 'admin') ? 
                `<div class="crud-buttons">
                    <button onclick="editRequest(${request.id})" class="edit-btn">Edit</button>
                    <button onclick="deleteRequest(${request.id})" class="delete-btn">Delete</button>
                </div>` : ''}
        </div>
    `).join('');
}

// Register Kitchen
function registerKitchen() {
    const location = document.getElementById('kitchen-location').value;
    const date = document.getElementById('kitchen-date').value;
    const time = document.getElementById('kitchen-time').value;
    const capacity = document.getElementById('kitchen-capacity').value;
    const menu = document.getElementById('kitchen-menu').value;

    if (!location || !date || !time || !capacity) {
        alert('Please fill in all required fields');
        return;
    }

    const kitchen = {
        id: Date.now(),
        location,
        date,
        time,
        capacity: parseInt(capacity),
        menu,
        dateRegistered: new Date().toLocaleDateString(),
        username: auth.getCurrentUser().username
    };

    appData.kitchens.push(kitchen);
    saveData();
    renderKitchens();
    clearKitchenForm();
}

function clearKitchenForm() {
    document.getElementById('kitchen-location').value = '';
    document.getElementById('kitchen-date').value = '';
    document.getElementById('kitchen-time').value = '';
    document.getElementById('kitchen-capacity').value = '';
    document.getElementById('kitchen-menu').value = '';
}

function renderKitchens() {
    const container = document.getElementById('community-kitchens');
    
    if (appData.kitchens.length === 0) {
        container.innerHTML = '<div class="empty-state">No community kitchens registered yet.</div>';
        return;
    }

    const currentUser = auth.getCurrentUser();
    container.innerHTML = appData.kitchens.map(kitchen => `
        <div class="kitchen-item">
            <div class="item-header">
                <div class="item-title">🍲 ${kitchen.location}</div>
                <div class="item-category">Serves ${kitchen.capacity}</div>
            </div>
            <div class="item-details">
                <div><strong>📅 ${kitchen.date} at ${kitchen.time}</strong></div>
                ${kitchen.menu ? `<p>Menu: ${kitchen.menu}</p>` : ''}
                <small>Registered on ${kitchen.dateRegistered} by ${kitchen.username}</small>
            </div>
            ${(kitchen.username === currentUser.username || currentUser.role === 'admin') ? 
                `<div class="crud-buttons">
                    <button onclick="editKitchen(${kitchen.id})" class="edit-btn">Edit</button>
                    <button onclick="deleteKitchen(${kitchen.id})" class="delete-btn">Delete</button>
                </div>` : ''}
        </div>
    `).join('');
}

// Offer Transport
function offerTransport() {
    const type = document.getElementById('transport-type').value;
    const from = document.getElementById('transport-from').value;
    const to = document.getElementById('transport-to').value;
    const when = document.getElementById('transport-when').value;
    const seats = document.getElementById('transport-seats').value;
    const contact = document.getElementById('transport-contact').value;

    if (!type || !from || !to || !when || !seats || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    const transport = {
        id: Date.now(),
        type,
        from,
        to,
        when,
        seats: parseInt(seats),
        contact,
        dateOffered: new Date().toLocaleDateString(),
        username: auth.getCurrentUser().username
    };

    appData.transport.push(transport);
    saveData();
    renderTransport();
    clearTransportForm();
}

function clearTransportForm() {
    document.getElementById('transport-type').value = '';
    document.getElementById('transport-from').value = '';
    document.getElementById('transport-to').value = '';
    document.getElementById('transport-when').value = '';
    document.getElementById('transport-seats').value = '';
    document.getElementById('transport-contact').value = '';
}

function renderTransport() {
    const container = document.getElementById('transport-list');
    
    if (appData.transport.length === 0) {
        container.innerHTML = '<div class="empty-state">No transportation offers available.</div>';
        return;
    }

    const currentUser = auth.getCurrentUser();
    container.innerHTML = appData.transport.map(transport => `
        <div class="transport-item">
            <div class="item-header">
                <div class="item-title">${getTransportTypeLabel(transport.type)}</div>
                <div class="item-category">${transport.seats} seats</div>
            </div>
            <div class="item-details">
                <div><strong>🚗 ${transport.from} → ${transport.to}</strong></div>
                <div>📅 ${new Date(transport.when).toLocaleString()}</div>
                <small>Offered on ${transport.dateOffered} by ${transport.username}</small>
            </div>
            <div class="item-contact">📞 ${transport.contact}</div>
            ${(transport.username === currentUser.username || currentUser.role === 'admin') ? 
                `<div class="crud-buttons">
                    <button onclick="editTransport(${transport.id})" class="edit-btn">Edit</button>
                    <button onclick="deleteTransport(${transport.id})" class="delete-btn">Delete</button>
                </div>` : ''}
        </div>
    `).join('');
}

// Edit functions
function editResource(id) {
    const resource = appData.resources.find(r => r.id === id);
    if (!resource) return;
    
    document.getElementById('resource-name').value = resource.name;
    document.getElementById('resource-category').value = resource.category;
    document.getElementById('resource-location').value = resource.location;
    document.getElementById('resource-contact').value = resource.contact;
    document.getElementById('resource-notes').value = resource.notes;
    
    const form = document.querySelector('.resource-form button');
    form.onclick = () => updateResource(id);
    form.textContent = 'Update Resource';
}

function updateResource(id) {
    const name = document.getElementById('resource-name').value;
    const category = document.getElementById('resource-category').value;
    const location = document.getElementById('resource-location').value;
    const contact = document.getElementById('resource-contact').value;
    const notes = document.getElementById('resource-notes').value;

    if (!name || !category || !location || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    const resourceIndex = appData.resources.findIndex(r => r.id === id);
    if (resourceIndex !== -1) {
        appData.resources[resourceIndex] = {
            ...appData.resources[resourceIndex],
            name, category, location, contact, notes
        };
        saveData();
        renderResources();
        clearResourceForm();
        resetResourceForm();
    }
}

function resetResourceForm() {
    const form = document.querySelector('.resource-form button');
    form.onclick = shareResource;
    form.textContent = 'Share Resource';
}

function editRequest(id) {
    const request = appData.requests.find(r => r.id === id);
    if (!request) return;
    
    document.getElementById('request-need').value = request.need;
    document.getElementById('request-urgency').value = request.urgency;
    document.getElementById('request-location').value = request.location;
    document.getElementById('request-contact').value = request.contact;
    document.getElementById('request-details').value = request.details;
    
    const form = document.querySelector('.request-form button');
    form.onclick = () => updateRequest(id);
    form.textContent = 'Update Request';
}

function updateRequest(id) {
    const need = document.getElementById('request-need').value;
    const urgency = document.getElementById('request-urgency').value;
    const location = document.getElementById('request-location').value;
    const contact = document.getElementById('request-contact').value;
    const details = document.getElementById('request-details').value;

    if (!need || !urgency || !location || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    const requestIndex = appData.requests.findIndex(r => r.id === id);
    if (requestIndex !== -1) {
        appData.requests[requestIndex] = {
            ...appData.requests[requestIndex],
            need, urgency, location, contact, details
        };
        saveData();
        renderRequests();
        clearRequestForm();
        resetRequestForm();
    }
}

function resetRequestForm() {
    const form = document.querySelector('.request-form button');
    form.onclick = submitRequest;
    form.textContent = 'Submit Request';
}

function editKitchen(id) {
    const kitchen = appData.kitchens.find(k => k.id === id);
    if (!kitchen) return;
    
    document.getElementById('kitchen-location').value = kitchen.location;
    document.getElementById('kitchen-date').value = kitchen.date;
    document.getElementById('kitchen-time').value = kitchen.time;
    document.getElementById('kitchen-capacity').value = kitchen.capacity;
    document.getElementById('kitchen-menu').value = kitchen.menu;
    
    const form = document.querySelector('.kitchen-form button');
    form.onclick = () => updateKitchen(id);
    form.textContent = 'Update Kitchen';
}

function updateKitchen(id) {
    const location = document.getElementById('kitchen-location').value;
    const date = document.getElementById('kitchen-date').value;
    const time = document.getElementById('kitchen-time').value;
    const capacity = document.getElementById('kitchen-capacity').value;
    const menu = document.getElementById('kitchen-menu').value;

    if (!location || !date || !time || !capacity) {
        alert('Please fill in all required fields');
        return;
    }

    const kitchenIndex = appData.kitchens.findIndex(k => k.id === id);
    if (kitchenIndex !== -1) {
        appData.kitchens[kitchenIndex] = {
            ...appData.kitchens[kitchenIndex],
            location, date, time, capacity: parseInt(capacity), menu
        };
        saveData();
        renderKitchens();
        clearKitchenForm();
        resetKitchenForm();
    }
}

function resetKitchenForm() {
    const form = document.querySelector('.kitchen-form button');
    form.onclick = registerKitchen;
    form.textContent = 'Register Kitchen';
}

function editTransport(id) {
    const transport = appData.transport.find(t => t.id === id);
    if (!transport) return;
    
    document.getElementById('transport-type').value = transport.type;
    document.getElementById('transport-from').value = transport.from;
    document.getElementById('transport-to').value = transport.to;
    document.getElementById('transport-when').value = transport.when;
    document.getElementById('transport-seats').value = transport.seats;
    document.getElementById('transport-contact').value = transport.contact;
    
    const form = document.querySelector('.transport-form button');
    form.onclick = () => updateTransport(id);
    form.textContent = 'Update Transport';
}

function updateTransport(id) {
    const type = document.getElementById('transport-type').value;
    const from = document.getElementById('transport-from').value;
    const to = document.getElementById('transport-to').value;
    const when = document.getElementById('transport-when').value;
    const seats = document.getElementById('transport-seats').value;
    const contact = document.getElementById('transport-contact').value;

    if (!type || !from || !to || !when || !seats || !contact) {
        alert('Please fill in all required fields');
        return;
    }

    const transportIndex = appData.transport.findIndex(t => t.id === id);
    if (transportIndex !== -1) {
        appData.transport[transportIndex] = {
            ...appData.transport[transportIndex],
            type, from, to, when, seats: parseInt(seats), contact
        };
        saveData();
        renderTransport();
        clearTransportForm();
        resetTransportForm();
    }
}

function resetTransportForm() {
    const form = document.querySelector('.transport-form button');
    form.onclick = offerTransport;
    form.textContent = 'Offer Transport';
}

// Delete functions
function deleteResource(id) {
    if (confirm('Are you sure you want to delete this resource?')) {
        appData.resources = appData.resources.filter(r => r.id !== id);
        saveData();
        renderResources();
    }
}

function deleteRequest(id) {
    if (confirm('Are you sure you want to delete this request?')) {
        appData.requests = appData.requests.filter(r => r.id !== id);
        saveData();
        renderRequests();
    }
}

function deleteKitchen(id) {
    if (confirm('Are you sure you want to delete this kitchen?')) {
        appData.kitchens = appData.kitchens.filter(k => k.id !== id);
        saveData();
        renderKitchens();
    }
}

function deleteTransport(id) {
    if (confirm('Are you sure you want to delete this transport offer?')) {
        appData.transport = appData.transport.filter(t => t.id !== id);
        saveData();
        renderTransport();
    }
}

// Helper functions
function getCategoryLabel(category) {
    const labels = {
        power: 'Power & Electricity',
        water: 'Water & Food',
        shelter: 'Shelter & Supplies',
        medical: 'Medical Supplies',
        tools: 'Tools & Equipment'
    };
    return labels[category] || category;
}

function getUrgencyLabel(urgency) {
    const labels = {
        critical: 'CRITICAL',
        urgent: 'URGENT',
        moderate: 'MODERATE',
        low: 'LOW'
    };
    return labels[urgency] || urgency;
}

function getTransportTypeLabel(type) {
    const labels = {
        evacuation: '🚨 Evacuation Transport',
        supplies: '📦 Supply Delivery',
        medical: '🏥 Medical Emergency',
        general: '🚗 General Transport'
    };
    return labels[type] || type;
}