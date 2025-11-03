// CSV Database Handler for ResourceShare PH
class CSVDatabase {
    constructor() {
        this.baseUrl = './assets/';
        this.tables = {
            resources: 'ShareResources.csv',
            requests: 'RequestHelp.csv',
            kitchens: 'CommunityKitchen.csv',
            transport: 'Transportation.csv',
            users: 'Users.csv'
        };
    }

    // Load CSV data
    async loadTable(tableName) {
        try {
            // Prefer files in the records folder if present (e.g. ./assets/records/ShareResources.csv)
            const recordPath = this.baseUrl + 'records/' + this.tables[tableName];
            let response = await fetch(recordPath);

            if (!response.ok) {
                // Fallback to the standard assets path
                response = await fetch(this.baseUrl + this.tables[tableName]);
            }

            if (!response.ok) {
                console.error(`Failed to load ${tableName} from both records and assets:`, response.status);
                return [];
            }

            const csvText = await response.text();
            return this.parseCSV(csvText);
        } catch (error) {
            console.error(`Error loading ${tableName}:`, error);
            return [];
        }
    }

    // Parse CSV to JSON
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index]?.trim() || '';
            });
            return obj;
        });
    }

    // Convert JSON to CSV
    toCSV(data, headers) {
        if (data.length === 0) return headers.join(',') + '\n';
        
        const csvRows = [headers.join(',')];
        data.forEach(row => {
            const values = headers.map(header => row[header] || '');
            csvRows.push(values.join(','));
        });
        return csvRows.join('\n');
    }

    // Save data (for download - browser limitation)
    downloadCSV(data, filename, headers) {
        const csvContent = this.toCSV(data, headers);
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        window.URL.revokeObjectURL(url);
    }

    // Export to Excel format
    downloadExcel(data, filename, headers) {
        const csvContent = this.toCSV(data, headers);
        const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace('.csv', '.xlsx');
        a.click();
        
        window.URL.revokeObjectURL(url);
    }

    // Load all tables
    async loadAllData() {
        const [resources, requests, kitchens, transport, users] = await Promise.all([
            this.loadTable('resources'),
            this.loadTable('requests'),
            this.loadTable('kitchens'),
            this.loadTable('transport'),
            this.loadTable('users')
        ]);

        return { resources, requests, kitchens, transport, users };
    }
}

// Initialize database
const db = new CSVDatabase();

// Enhanced app data with CSV integration
let appData = {
    resources: [],
    requests: [],
    kitchens: [],
    transport: [],
    users: []
};

// Load data from CSV files
async function loadDataFromCSV() {
    // Check authentication first
    if (!auth.isLoggedIn()) {
        showLoginForm();
        return;
    }
    
    try {
        const csvData = await db.loadAllData();
        
        // Load existing localStorage data first
        loadData();
        
        // Load users from localStorage and add to auth.users
        const savedUsers = localStorage.getItem('registeredUsers');
        if (savedUsers) {
            const registeredUsers = JSON.parse(savedUsers);
            auth.users = [...auth.users, ...registeredUsers];
        }
        
        // Convert CSV data to app format and merge with existing data
        const csvResources = csvData.resources.map(row => ({
            id: parseInt(row.ID),
            name: row['Resource Name'],
            category: row.Category,
            location: row.Location,
            contact: row.Contact,
            notes: row.Notes,
            dateShared: row['Date Shared'],
            username: row.Username
        }));

        const csvRequests = csvData.requests.map(row => ({
            id: parseInt(row.ID),
            need: row.Need,
            urgency: row.Urgency,
            location: row.Location,
            contact: row.Contact,
            details: row.Details,
            dateRequested: row['Date Requested'],
            username: row.Username
        }));

        const csvKitchens = csvData.kitchens.map(row => ({
            id: parseInt(row.ID),
            location: row.Location,
            date: row.Date,
            time: row.Time,
            capacity: parseInt(row.Capacity),
            menu: row.Menu,
            dateRegistered: row['Date Registered'],
            username: row.Username
        }));

        const csvTransport = csvData.transport.map(row => ({
            id: parseInt(row.ID),
            type: row.Type,
            from: row.From,
            to: row.To,
            when: row.When,
            seats: parseInt(row.Seats),
            contact: row.Contact,
            dateOffered: row['Date Offered'],
            username: row.Username
        }));

        // Merge CSV data with existing localStorage data (avoid duplicates)
        const existingResourceIds = appData.resources.map(r => r.id);
        const existingRequestIds = appData.requests.map(r => r.id);
        const existingKitchenIds = appData.kitchens.map(k => k.id);
        const existingTransportIds = appData.transport.map(t => t.id);

        appData.resources = [...appData.resources, ...csvResources.filter(r => !existingResourceIds.includes(r.id))];
        appData.requests = [...appData.requests, ...csvRequests.filter(r => !existingRequestIds.includes(r.id))];
        appData.kitchens = [...appData.kitchens, ...csvKitchens.filter(k => !existingKitchenIds.includes(k.id))];
        appData.transport = [...appData.transport, ...csvTransport.filter(t => !existingTransportIds.includes(t.id))];

        // Add logout button and render all data
        addLogoutButton();
        showAdminElements();
        renderResources();
        renderRequests();
        renderKitchens();
        renderTransport();
        
    } catch (error) {
        console.error('Error loading CSV data:', error);
        // Fallback to localStorage only
        loadData();
    }
}

// Export data to CSV
function exportToCSV(tableName) {
    const headers = {
        resources: ['ID', 'Resource Name', 'Category', 'Location', 'Contact', 'Notes', 'Date Shared', 'Username'],
        requests: ['ID', 'Need', 'Urgency', 'Location', 'Contact', 'Details', 'Date Requested', 'Username'],
        kitchens: ['ID', 'Location', 'Date', 'Time', 'Capacity', 'Menu', 'Date Registered', 'Username'],
        transport: ['ID', 'Type', 'From', 'To', 'When', 'Seats', 'Contact', 'Date Offered', 'Username'],
        users: ['ID', 'Username', 'Full Name', 'Role', 'Barangay', 'Phone', 'Date Registered']
    };

    const dataMap = {
        resources: appData.resources.map(item => ({
            'ID': item.id,
            'Resource Name': item.name,
            'Category': item.category,
            'Location': item.location,
            'Contact': item.contact,
            'Notes': item.notes,
            'Date Shared': item.dateShared,
            'Username': item.username
        })),
        requests: appData.requests.map(item => ({
            'ID': item.id,
            'Need': item.need,
            'Urgency': item.urgency,
            'Location': item.location,
            'Contact': item.contact,
            'Details': item.details,
            'Date Requested': item.dateRequested,
            'Username': item.username
        })),
        kitchens: appData.kitchens.map(item => ({
            'ID': item.id,
            'Location': item.location,
            'Date': item.date,
            'Time': item.time,
            'Capacity': item.capacity,
            'Menu': item.menu,
            'Date Registered': item.dateRegistered,
            'Username': item.username
        })),
        transport: appData.transport.map(item => ({
            'ID': item.id,
            'Type': item.type,
            'From': item.from,
            'To': item.to,
            'When': item.when,
            'Seats': item.seats,
            'Contact': item.contact,
            'Date Offered': item.dateOffered,
            'Username': item.username
        })),
        users: auth.users.map(user => ({
            'ID': user.ID,
            'Username': user.Username,
            'Full Name': user.FullName,
            'Role': user.Role,
            'Barangay': user.Barangay,
            'Phone': user.Phone,
            'Date Registered': user.DateRegistered
        }))
    };

    db.downloadCSV(dataMap[tableName], `${tableName}.csv`, headers[tableName]);
}

// Export data to Excel
function exportToExcel(tableName) {
    const headers = {
        resources: ['ID', 'Resource Name', 'Category', 'Location', 'Contact', 'Notes', 'Date Shared', 'Username'],
        requests: ['ID', 'Need', 'Urgency', 'Location', 'Contact', 'Details', 'Date Requested', 'Username'],
        kitchens: ['ID', 'Location', 'Date', 'Time', 'Capacity', 'Menu', 'Date Registered', 'Username'],
        transport: ['ID', 'Type', 'From', 'To', 'When', 'Seats', 'Contact', 'Date Offered', 'Username'],
        users: ['ID', 'Username', 'Full Name', 'Role', 'Barangay', 'Phone', 'Date Registered']
    };

    const dataMap = {
        resources: appData.resources.map(item => ({
            'ID': item.id,
            'Resource Name': item.name,
            'Category': item.category,
            'Location': item.location,
            'Contact': item.contact,
            'Notes': item.notes,
            'Date Shared': item.dateShared,
            'Username': item.username
        })),
        requests: appData.requests.map(item => ({
            'ID': item.id,
            'Need': item.need,
            'Urgency': item.urgency,
            'Location': item.location,
            'Contact': item.contact,
            'Details': item.details,
            'Date Requested': item.dateRequested,
            'Username': item.username
        })),
        kitchens: appData.kitchens.map(item => ({
            'ID': item.id,
            'Location': item.location,
            'Date': item.date,
            'Time': item.time,
            'Capacity': item.capacity,
            'Menu': item.menu,
            'Date Registered': item.dateRegistered,
            'Username': item.username
        })),
        transport: appData.transport.map(item => ({
            'ID': item.id,
            'Type': item.type,
            'From': item.from,
            'To': item.to,
            'When': item.when,
            'Seats': item.seats,
            'Contact': item.contact,
            'Date Offered': item.dateOffered,
            'Username': item.username
        })),
        users: auth.users.map(user => ({
            'ID': user.ID,
            'Username': user.Username,
            'Full Name': user.FullName,
            'Role': user.Role,
            'Barangay': user.Barangay,
            'Phone': user.Phone,
            'Date Registered': user.DateRegistered
        }))
    };

    db.downloadExcel(dataMap[tableName], `${tableName}.xlsx`, headers[tableName]);
}