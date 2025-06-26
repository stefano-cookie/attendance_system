// backend/test_api_endpoints.js
const axios = require('axios');
const colors = require('colors');

const API_BASE = 'http://localhost:4321';

colors.setTheme({
  success: 'green',
  error: 'red',
  warning: 'yellow',
  info: 'blue'
});

async function testEndpoints() {
    console.log('\n🧪 TEST ENDPOINTS API'.info);
    console.log('='.repeat(50));

    // Lista endpoints da testare
    const endpoints = [
        { method: 'GET', path: '/api/test', description: 'Test base API' },
        { method: 'GET', path: '/api/auth/health', description: 'Auth health check' },
        { method: 'POST', path: '/api/auth/login', description: 'Login endpoint', 
          data: { email: 'admin@università.it', password: 'Admin123!' } },
        { method: 'GET', path: '/api/auth/me', description: 'Current user (needs auth)', requiresAuth: true }
    ];

    let authToken = null;

    for (const endpoint of endpoints) {
        console.log(`\n📍 Testing: ${endpoint.method} ${endpoint.path}`.info);
        console.log(`   ${endpoint.description}`);

        try {
            const config = {
                method: endpoint.method,
                url: `${API_BASE}${endpoint.path}`,
                headers: {}
            };

            if (endpoint.data) {
                config.data = endpoint.data;
            }

            if (endpoint.requiresAuth && authToken) {
                config.headers['Authorization'] = `Bearer ${authToken}`;
            }

            const response = await axios(config);
            
            console.log(`   ✅ Status: ${response.status}`.success);
            console.log(`   📦 Response:`, JSON.stringify(response.data, null, 2));

            // Se è il login, salva il token
            if (endpoint.path === '/api/auth/login' && response.data.token) {
                authToken = response.data.token;
                console.log(`   🔑 Token salvato per test successivi`.success);
            }

        } catch (error) {
            console.log(`   ❌ Status: ${error.response?.status || 'NETWORK ERROR'}`.error);
            
            if (error.response?.data) {
                console.log(`   📦 Error Response:`, error.response.data);
            } else {
                console.log(`   📦 Error:`, error.message);
            }

            if (error.response?.headers['content-type']?.includes('text/html')) {
                console.log(`   ⚠️ ATTENZIONE: Il server ha restituito HTML invece di JSON!`.warning);
                console.log(`   Questo indica che la route non esiste o c'è un errore di configurazione`.warning);
            }
        }
    }

    // Test specifico per verificare la struttura delle route
    console.log('\n\n🔍 VERIFICA ROUTING'.info);
    console.log('='.repeat(50));

    try {
        // Test route inesistente
        console.log('\n📍 Test route inesistente: GET /api/nonexistent'.info);
        try {
            await axios.get(`${API_BASE}/api/nonexistent`);
        } catch (error) {
            const contentType = error.response?.headers['content-type'];
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Content-Type: ${contentType}`);
            
            if (contentType?.includes('application/json')) {
                console.log(`   ✅ Corretto: restituisce JSON per 404`.success);
                console.log(`   Response:`, error.response.data);
            } else {
                console.log(`   ❌ ERRORE: restituisce ${contentType} invece di JSON!`.error);
            }
        }

    } catch (error) {
        console.error('Errore test routing:', error.message);
    }

    console.log('\n\n📋 RIEPILOGO'.info);
    console.log('='.repeat(50));
    console.log('Se vedi errori HTML invece di JSON, verifica:');
    console.log('1. Che app.js stia caricando correttamente le route');
    console.log('2. Che il 404 handler restituisca JSON');
    console.log('3. Che non ci siano errori di sintassi nei file delle route');
}

// Verifica che il server sia attivo
console.log('🔌 Verifico connessione al server...'.info);
axios.get(`${API_BASE}/api/test`)
    .then(() => {
        console.log('✅ Server attivo!'.success);
        testEndpoints();
    })
    .catch((error) => {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Server non raggiungibile!'.error);
            console.log('Assicurati che il backend sia in esecuzione su http://localhost:4321'.warning);
            console.log('Usa: cd backend && npm start'.info);
        } else {
            console.error('❌ Errore:', error.message);
        }
    });