// backend/final_diagnostic.js
const fs = require('fs');
const path = require('path');
const { User } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function runDiagnostic() {
    console.log('\n🔍 DIAGNOSTICA FINALE SISTEMA AUTH'.info);
    console.log('='.repeat(60));

    const issues = [];
    const fixes = [];

    // 1. Verifica file authRoutes.js
    console.log('\n1️⃣ Verifica authRoutes.js...'.info);
    try {
        const authRoutesPath = path.join(__dirname, 'src/routes/authRoutes.js');
        const authRoutesContent = fs.readFileSync(authRoutesPath, 'utf8');
        
        if (authRoutesContent.includes('passwordHash')) {
            issues.push('authRoutes.js cerca "passwordHash" ma il campo si chiama "password"');
            fixes.push('Copia il file dall\'artifact "fix-auth-routes-real"');
            console.log('  ❌ File non aggiornato - usa passwordHash invece di password'.error);
        } else if (authRoutesContent.includes('user.password')) {
            console.log('  ✅ File corretto - usa user.password'.success);
        } else {
            console.log('  ⚠️ Non riesco a verificare il campo password'.warning);
        }

        if (authRoutesContent.includes('router.get(\'/me\'')) {
            console.log('  ✅ Route /me presente'.success);
        } else {
            issues.push('Route /api/auth/me mancante');
            fixes.push('Aggiungi la route GET /me in authRoutes.js');
            console.log('  ❌ Route /me mancante'.error);
        }
    } catch (error) {
        console.log('  ❌ Errore lettura file:'.error, error.message);
        issues.push('Impossibile leggere authRoutes.js');
    }

    // 2. Verifica database
    console.log('\n2️⃣ Verifica database...'.info);
    try {
        await sequelize.authenticate();
        console.log('  ✅ Connessione database OK'.success);
        
        // Verifica struttura User
        const userAttributes = User.rawAttributes;
        if (userAttributes.password) {
            console.log('  ✅ Campo "password" presente nel modello User'.success);
        } else {
            console.log('  ❌ Campo "password" NON trovato nel modello User'.error);
            issues.push('Campo password mancante nel modello User');
            fixes.push('Verifica il file src/models/User.js');
        }

        // Conta utenti
        const userCount = await User.count();
        console.log(`  ℹ️ Totale utenti: ${userCount}`.info);

        // Verifica admin
        const admin = await User.findOne({ where: { email: 'admin@test.com' }});
        if (admin) {
            console.log('  ✅ Admin trovato: admin@test.com'.success);
            console.log(`     Password hashata: ${admin.password ? 'SÌ' : 'NO'}`);
        } else {
            console.log('  ❌ Admin admin@test.com non trovato'.error);
            issues.push('Utente admin mancante');
            fixes.push('Esegui node check_and_reset_passwords.js');
        }

    } catch (error) {
        console.log('  ❌ Errore database:'.error, error.message);
        issues.push('Errore connessione database');
        fixes.push('Verifica che PostgreSQL sia in esecuzione');
    }

    // 3. Verifica variabili ambiente
    console.log('\n3️⃣ Verifica configurazione...'.info);
    if (process.env.JWT_SECRET) {
        console.log('  ✅ JWT_SECRET configurato'.success);
    } else {
        console.log('  ⚠️ JWT_SECRET non configurato (userà default)'.warning);
    }

    if (process.env.PORT) {
        console.log(`  ✅ PORT configurata: ${process.env.PORT}`.success);
    } else {
        console.log('  ℹ️ PORT non configurata (userà 4321)'.info);
    }

    // 4. Verifica file frontend
    console.log('\n4️⃣ Verifica frontend...'.info);
    try {
        const authServicePath = path.join(__dirname, '../frontend/src/services/authService.ts');
        if (fs.existsSync(authServicePath)) {
            const authServiceContent = fs.readFileSync(authServicePath, 'utf8');
            if (authServiceContent.includes('/api/auth/login')) {
                console.log('  ✅ authService.ts usa endpoint corretto'.success);
            } else {
                console.log('  ❌ authService.ts potrebbe usare endpoint sbagliato'.error);
                issues.push('Frontend authService.ts potrebbe essere non aggiornato');
                fixes.push('Copia il file dall\'artifact "fix-frontend-auth-service"');
            }
        } else {
            console.log('  ⚠️ Non riesco a verificare authService.ts'.warning);
        }
    } catch (error) {
        console.log('  ⚠️ Verifica frontend saltata'.warning);
    }

    // Riepilogo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RIEPILOGO DIAGNOSTICA'.info);
    console.log('='.repeat(60));

    if (issues.length === 0) {
        console.log('\n✅ TUTTO OK! Il sistema dovrebbe funzionare correttamente.'.success);
        console.log('\n🎯 Prossimi passi:');
        console.log('1. Riavvia il backend: npm start');
        console.log('2. Riavvia il frontend: cd ../frontend && npm start');
        console.log('3. Login con: admin@test.com / Admin123!');
    } else {
        console.log('\n❌ PROBLEMI TROVATI:'.error);
        issues.forEach((issue, i) => {
            console.log(`${i + 1}. ${issue}`.error);
        });
        
        console.log('\n🔧 SOLUZIONI CONSIGLIATE:'.warning);
        fixes.forEach((fix, i) => {
            console.log(`${i + 1}. ${fix}`.warning);
        });
        
        console.log('\n💡 Dopo aver applicato i fix:');
        console.log('- Esegui di nuovo questo script per verificare');
        console.log('- Poi esegui: node test_real_credentials.js');
    }

    await sequelize.close();
}

// Esegui
runDiagnostic().catch(error => {
    console.error('❌ Errore diagnostica:'.error, error);
    process.exit(1);
});