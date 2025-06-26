// backend/verify_db_structure.js
const { User, Course, UserToken } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function verifyDatabaseStructure() {
    console.log('\n🔍 VERIFICA STRUTTURA DATABASE');
    console.log('='.repeat(50));

    try {
        // Test connessione
        await sequelize.authenticate();
        console.log('✅ Connessione al database OK');

        // Verifica struttura tabella Users
        console.log('\n📋 Struttura tabella Users:');
        const userAttributes = User.rawAttributes;
        const importantFields = ['id', 'email', 'password', 'passwordHash', 'name', 'surname', 'role'];
        
        for (const field of importantFields) {
            if (userAttributes[field]) {
                console.log(`  ✅ ${field}: ${userAttributes[field].type.constructor.name}`);
            } else {
                console.log(`  ❌ ${field}: NON TROVATO`);
            }
        }

        // Verifica associazioni
        console.log('\n🔗 Associazioni User:');
        const userAssociations = User.associations;
        for (const [name, assoc] of Object.entries(userAssociations)) {
            console.log(`  - ${name}: ${assoc.associationType} con ${assoc.target.name}`);
        }

        // Conta utenti esistenti
        const userCount = await User.count();
        console.log(`\n👥 Totale utenti nel database: ${userCount}`);

        // Verifica utente admin
        const adminUser = await User.findOne({ 
            where: { email: 'admin@università.it' }
        });
        
        if (adminUser) {
            console.log('\n👤 Utente admin trovato:');
            console.log(`  - ID: ${adminUser.id}`);
            console.log(`  - Email: ${adminUser.email}`);
            console.log(`  - Nome: ${adminUser.name} ${adminUser.surname}`);
            console.log(`  - Ruolo: ${adminUser.role}`);
            console.log(`  - Ha password hash: ${!!adminUser.passwordHash}`);
            console.log(`  - Campo password (legacy): ${adminUser.password ? 'PRESENTE' : 'assente'}`);
        } else {
            console.log('\n❌ Utente admin non trovato!');
        }

        // Lista tutti gli utenti
        console.log('\n📋 Lista utenti:');
        const users = await User.findAll({
            attributes: ['id', 'email', 'role', 'name', 'surname'],
            order: [['id', 'ASC']]
        });

        users.forEach(user => {
            console.log(`  ${user.id}. ${user.email} (${user.role}) - ${user.name} ${user.surname}`);
        });

    } catch (error) {
        console.error('\n❌ Errore:', error.message);
        if (error.original) {
            console.error('Dettagli:', error.original.message);
        }
    } finally {
        await sequelize.close();
        console.log('\n✅ Connessione chiusa');
    }
}

// Esegui verifica
verifyDatabaseStructure();