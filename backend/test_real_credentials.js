// backend/test_real_credentials.js - VERSIONE SENZA COLORS
const axios = require('axios');

const API_BASE_URL = 'http://localhost:4321/api';

async function testRealCredentials() {
    console.log('\n🧪 TEST LOGIN CON CREDENZIALI REALI');
    console.log('='.repeat(50));

    // Credenziali basate sugli utenti reali nel database
    const testCredentials = [
        { 
            email: 'admin@test.com', 
            password: 'Admin123!', 
            expectedRole: 'admin',
            description: 'Admin esistente nel DB'
        },
        { 
            email: 'teacher@university.it', 
            password: 'Teacher123!', 
            expectedRole: 'teacher',
            description: 'Teacher esistente nel DB'
        },
        {
            email: 'stefanojpriolo@gmail.com',
            password: 'Student123!',
            expectedRole: 'student',
            description: 'Studente Stefano Priolo'
        }
    ];

    console.log('\n📋 Utenti da testare:');
    testCredentials.forEach(cred => {
        console.log(`  - ${cred.email} (${cred.description})`);
    });
    console.log('');

    for (const cred of testCredentials) {
        console.log(`\n🔐 Test login: ${cred.email}`);
        console.log('-'.repeat(40));

        try {
            // Test login
            const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
                email: cred.email,
                password: cred.password
            });

            if (loginResponse.data.success) {
                console.log('✅ Login riuscito!');
                console.log('👤 Utente:', JSON.stringify({
                    id: loginResponse.data.user.id,
                    email: loginResponse.data.user.email,
                    role: loginResponse.data.user.role,
                    name: `${loginResponse.data.user.name} ${loginResponse.data.user.surname}`
                }, null, 2));
                console.log('🔑 Token:', loginResponse.data.token.substring(0, 50) + '...');

                // Test /auth/me con il token
                console.log('\n📡 Test /auth/me con il token...');
                try {
                    const meResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${loginResponse.data.token}`
                        }
                    });

                    if (meResponse.data.success) {
                        console.log('✅ /auth/me riuscito!');
                        console.log('Ruolo verificato:', meResponse.data.user.role);
                    }
                } catch (meError) {
                    console.error('❌ /auth/me fallito:', meError.response?.data || meError.message);
                }

            } else {
                console.log('❌ Login fallito:', loginResponse.data.message);
            }

        } catch (error) {
            console.error('❌ Errore login:');
            
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Messaggio:', error.response.data?.message || error.response.data);
                
                if (error.response.status === 401) {
                    console.log('\n⚠️ Password non corretta!');
                    console.log('Usa check_and_reset_passwords.js per resettare la password');
                }
            } else {
                console.log('Errore:', error.message);
            }
        }
    }

    console.log('\n\n📊 RIEPILOGO');
    console.log('='.repeat(50));
    console.log('\nSe i login falliscono con errore 401:');
    console.log('1. Esegui: node check_and_reset_passwords.js');
    console.log('2. Scegli opzione 4 per resettare tutte le password');
    console.log('3. Riprova questo test');
    console.log('\nSe continui ad avere problemi:');
    console.log('- Verifica che il backend sia in esecuzione');
    console.log('- Controlla i log del backend per errori');
}

// Test connessione e struttura API
async function testAPIStructure() {
    console.log('\n🔍 VERIFICA STRUTTURA API');
    console.log('='.repeat(50));

    const endpoints = [
        '/api/test',
        '/api/auth/health',
        '/api/auth/login',
        '/api/auth/me'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`\n📡 Test ${endpoint}:`);
            
            if (endpoint.includes('login')) {
                // Skip, testato sopra
                console.log('  (testato nella sezione login)');
                continue;
            }
            
            if (endpoint.includes('/me')) {
                // Richiede auth
                console.log('  (richiede autenticazione, testato sopra)');
                continue;
            }

            const response = await axios.get(`http://localhost:4321${endpoint}`);
            console.log('  ✅ Endpoint attivo');
            console.log('  Response:', response.data);
            
        } catch (error) {
            console.log(`  ❌ Endpoint non disponibile`);
            if (error.response) {
                console.log('  Status:', error.response.status);
                console.log('  Type:', error.response.headers['content-type']);
            }
        }
    }
}

// Main
async function main() {
    try {
        // Prima verifica che il server sia attivo
        console.log('🔌 Verifica connessione server...');
        await axios.get('http://localhost:4321/api/test');
        console.log('✅ Server attivo!\n');

        // Test struttura API
        await testAPIStructure();

        // Test credenziali
        await testRealCredentials();

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Server non raggiungibile!');
            console.log('Assicurati che il backend sia in esecuzione:');
            console.log('cd backend && npm start');
        } else {
            console.error('❌ Errore:', error.message);
        }
    }
}

// Esegui
main();