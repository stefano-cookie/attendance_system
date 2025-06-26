// backend/fix_user_passwords.js
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function fixUserPasswords() {
    console.log('\n🔧 FIX CAMPO PASSWORD UTENTI');
    console.log('='.repeat(50));

    const defaultPasswords = {
        'admin@università.it': 'Admin123!',
        'mario.rossi@docenti.università.it': 'Teacher123!',
        'student1@università.it': 'Student123!',
        'tech@università.it': 'Tech123!'
    };

    try {
        await sequelize.authenticate();
        console.log('✅ Connesso al database');

        // Verifica se esiste il campo passwordHash
        const userAttributes = User.rawAttributes;
        const hasPasswordHash = !!userAttributes.passwordHash;
        const hasPassword = !!userAttributes.password;

        console.log(`\n📋 Campi password nella tabella Users:`);
        console.log(`  - password: ${hasPassword ? '✅ PRESENTE' : '❌ ASSENTE'}`);
        console.log(`  - passwordHash: ${hasPasswordHash ? '✅ PRESENTE' : '❌ ASSENTE'}`);

        if (!hasPasswordHash && !hasPassword) {
            console.error('\n❌ ERRORE: Nessun campo password trovato nel modello User!');
            console.log('Verifica il modello User.js');
            return;
        }

        // Aggiorna le password per gli utenti di test
        for (const [email, plainPassword] of Object.entries(defaultPasswords)) {
            try {
                const user = await User.findOne({ where: { email } });
                
                if (!user) {
                    console.log(`\n⚠️ Utente ${email} non trovato - creazione...`);
                    
                    const passwordHash = await bcrypt.hash(plainPassword, 10);
                    const newUser = await User.create({
                        email,
                        name: email.split('@')[0].split('.')[0],
                        surname: email.split('@')[0].split('.')[1] || 'User',
                        role: email.includes('admin') ? 'admin' : 
                              email.includes('docenti') ? 'teacher' : 
                              email.includes('tech') ? 'technician' : 'student',
                        passwordHash: hasPasswordHash ? passwordHash : undefined,
                        password: hasPassword ? passwordHash : undefined,
                        is_active: true
                    });
                    
                    console.log(`✅ Creato utente: ${email}`);
                    continue;
                }

                // Verifica se la password è già hashata
                const currentPassword = hasPasswordHash ? user.passwordHash : user.password;
                
                if (currentPassword && currentPassword.startsWith('$2')) {
                    // È già un hash bcrypt
                    console.log(`✅ ${email} - password già hashata`);
                    
                    // Verifica che l'hash sia corretto
                    const isValid = await bcrypt.compare(plainPassword, currentPassword);
                    if (!isValid) {
                        console.log(`  ⚠️ Ma l'hash non corrisponde alla password di default!`);
                        console.log(`  🔄 Aggiornamento password...`);
                        
                        const newHash = await bcrypt.hash(plainPassword, 10);
                        if (hasPasswordHash) {
                            await user.update({ passwordHash: newHash });
                        } else {
                            await user.update({ password: newHash });
                        }
                        console.log(`  ✅ Password aggiornata`);
                    }
                } else {
                    // Non è hashata o è vuota
                    console.log(`🔄 ${email} - hashing password...`);
                    const passwordHash = await bcrypt.hash(plainPassword, 10);
                    
                    if (hasPasswordHash) {
                        await user.update({ passwordHash });
                    } else {
                        await user.update({ password: passwordHash });
                    }
                    
                    console.log(`✅ Password hashata e salvata`);
                }

            } catch (error) {
                console.error(`❌ Errore per ${email}:`, error.message);
            }
        }

        // Test di login per verificare
        console.log('\n🧪 TEST LOGIN:');
        for (const [email, plainPassword] of Object.entries(defaultPasswords)) {
            try {
                const user = await User.findOne({ where: { email } });
                if (user) {
                    const passwordField = hasPasswordHash ? user.passwordHash : user.password;
                    const isValid = await bcrypt.compare(plainPassword, passwordField);
                    console.log(`  ${email}: ${isValid ? '✅ OK' : '❌ FALLITO'}`);
                }
            } catch (error) {
                console.log(`  ${email}: ❌ ERRORE - ${error.message}`);
            }
        }

        console.log('\n📝 Credenziali di test:');
        console.log('='.repeat(50));
        for (const [email, password] of Object.entries(defaultPasswords)) {
            console.log(`${email} | ${password}`);
        }

    } catch (error) {
        console.error('\n❌ Errore:', error);
    } finally {
        await sequelize.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui fix
fixUserPasswords();