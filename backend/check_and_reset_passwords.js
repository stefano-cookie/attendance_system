// backend/check_and_reset_passwords.js
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');
const { sequelize } = require('./src/config/database');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function checkAndResetPasswords() {
    console.log('\n🔐 GESTIONE PASSWORD UTENTI');
    console.log('='.repeat(50));

    try {
        await sequelize.authenticate();
        console.log('✅ Connesso al database\n');

        // Mostra tutti gli utenti esistenti
        const users = await User.findAll({
            attributes: ['id', 'email', 'name', 'surname', 'role', 'password'],
            order: [['id', 'ASC']]
        });

        console.log('📋 UTENTI NEL DATABASE:');
        console.log('-'.repeat(50));
        
        for (const user of users) {
            console.log(`\nID: ${user.id}`);
            console.log(`Email: ${user.email}`);
            console.log(`Nome: ${user.name} ${user.surname}`);
            console.log(`Ruolo: ${user.role}`);
            console.log(`Password hashata: ${user.password ? 'SÌ' : 'NO'}`);
            
            if (user.password) {
                // Verifica se è un hash bcrypt valido
                const isValidHash = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');
                console.log(`Hash valido: ${isValidHash ? 'SÌ' : 'NO'}`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('\n🔧 OPZIONI:');
        console.log('1. Reset password per admin@test.com');
        console.log('2. Reset password per teacher@university.it');
        console.log('3. Reset password per un utente specifico');
        console.log('4. Reset password per TUTTI gli utenti');
        console.log('5. Mostra credenziali di test');
        console.log('0. Esci\n');

        const choice = await question('Scegli un\'opzione (0-5): ');

        switch (choice) {
            case '1':
                await resetUserPassword('admin@test.com', 'Admin123!');
                break;
                
            case '2':
                await resetUserPassword('teacher@university.it', 'Teacher123!');
                break;
                
            case '3':
                const email = await question('Inserisci email utente: ');
                const newPass = await question('Inserisci nuova password: ');
                await resetUserPassword(email, newPass);
                break;
                
            case '4':
                console.log('\n⚠️  ATTENZIONE: Questo resetterà TUTTE le password!');
                const confirm = await question('Sei sicuro? (si/no): ');
                if (confirm.toLowerCase() === 'si' || confirm.toLowerCase() === 'yes') {
                    await resetAllPasswords();
                }
                break;
                
            case '5':
                showTestCredentials();
                break;
                
            case '0':
                console.log('👋 Arrivederci!');
                break;
                
            default:
                console.log('❌ Opzione non valida');
        }

    } catch (error) {
        console.error('❌ Errore:', error);
    } finally {
        rl.close();
        await sequelize.close();
    }
}

async function resetUserPassword(email, newPassword) {
    try {
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            console.log(`❌ Utente ${email} non trovato!`);
            return;
        }

        const hash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: hash });
        
        console.log(`✅ Password aggiornata per ${email}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${newPassword}`);
        
        // Test login
        const isValid = await bcrypt.compare(newPassword, hash);
        console.log(`   Test hash: ${isValid ? '✅ OK' : '❌ FALLITO'}`);
        
    } catch (error) {
        console.error(`❌ Errore reset password per ${email}:`, error.message);
    }
}

async function resetAllPasswords() {
    const defaultPasswords = {
        'admin@test.com': 'Admin123!',
        'teacher@university.it': 'Teacher123!',
        'stefanojpriolo@gmail.com': 'Student123!'
    };

    console.log('\n🔄 Reset password per tutti gli utenti...\n');

    for (const [email, password] of Object.entries(defaultPasswords)) {
        await resetUserPassword(email, password);
        console.log('');
    }

    // Per altri utenti usa una password di default
    const otherUsers = await User.findAll({
        where: { 
            email: { 
                [require('sequelize').Op.notIn]: Object.keys(defaultPasswords) 
            } 
        }
    });

    for (const user of otherUsers) {
        const defaultPass = `${user.role}123!`;
        await resetUserPassword(user.email, defaultPass);
        console.log('');
    }
}

function showTestCredentials() {
    console.log('\n📝 CREDENZIALI DI TEST CONSIGLIATE:');
    console.log('='.repeat(50));
    console.log('admin@test.com         | Admin123!');
    console.log('teacher@university.it  | Teacher123!');
    console.log('student (se presente)  | Student123!');
    console.log('='.repeat(50));
    console.log('\n💡 Usa opzione 4 per impostare queste password automaticamente');
}

// Esegui
checkAndResetPasswords();