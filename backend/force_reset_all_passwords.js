// backend/force_reset_all_passwords.js
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function forceResetAllPasswords() {
    console.log('\n🔧 FORCE RESET DI TUTTE LE PASSWORD');
    console.log('='.repeat(50));

    const passwords = {
        'admin@test.com': 'Admin123!',
        'teacher@university.it': 'Teacher123!',
        'stefanojpriolo@gmail.com': 'Student123!'
    };

    try {
        await sequelize.authenticate();
        console.log('✅ Connesso al database\n');

        for (const [email, newPassword] of Object.entries(passwords)) {
            console.log(`\n📧 Reset password per: ${email}`);
            console.log('-'.repeat(40));

            try {
                // Trova utente
                const user = await User.findOne({ where: { email } });
                
                if (!user) {
                    console.log('❌ Utente non trovato!');
                    continue;
                }

                console.log('✅ Utente trovato');
                
                // Genera nuovo hash
                console.log(`🔐 Generazione nuovo hash per: ${newPassword}`);
                const hash = await bcrypt.hash(newPassword, 10);
                console.log(`   Hash: ${hash.substring(0, 30)}...`);
                
                // Aggiorna direttamente con query SQL raw per sicurezza
                console.log('💾 Aggiornamento database...');
                await sequelize.query(
                    'UPDATE "Users" SET password = :hash, "updatedAt" = NOW() WHERE email = :email',
                    {
                        replacements: { hash, email },
                        type: sequelize.QueryTypes.UPDATE
                    }
                );
                console.log('✅ Password aggiornata con query diretta');
                
                // Verifica
                console.log('🧪 Verifica password...');
                const updatedUser = await User.findOne({ where: { email } });
                const isValid = await bcrypt.compare(newPassword, updatedUser.password);
                console.log(`   Test: ${isValid ? '✅ PASSWORD OK!' : '❌ ERRORE!'}`);
                
                if (isValid) {
                    console.log(`   ✅ CREDENZIALI FUNZIONANTI: ${email} / ${newPassword}`);
                }

            } catch (error) {
                console.error(`❌ Errore per ${email}:`, error.message);
            }
        }

        console.log('\n\n📋 RIEPILOGO CREDENZIALI:');
        console.log('='.repeat(50));
        for (const [email, password] of Object.entries(passwords)) {
            console.log(`${email.padEnd(30)} | ${password}`);
        }
        console.log('='.repeat(50));

        // Test finale di login simulato
        console.log('\n🧪 TEST FINALE:');
        for (const [email, password] of Object.entries(passwords)) {
            const user = await User.findOne({ where: { email } });
            if (user && user.password) {
                const valid = await bcrypt.compare(password, user.password);
                console.log(`${email}: ${valid ? '✅ OK' : '❌ FALLITO'}`);
            }
        }

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        await sequelize.close();
        console.log('\n✅ Processo completato');
    }
}

// Esegui
forceResetAllPasswords();