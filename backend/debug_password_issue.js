// backend/debug_password_issue.js
const bcrypt = require('bcryptjs');
const { User } = require('./src/models');
const { sequelize } = require('./src/config/database');

async function debugPasswordIssue() {
    console.log('\n🔍 DEBUG PASSWORD ISSUE');
    console.log('='.repeat(50));

    try {
        await sequelize.authenticate();
        console.log('✅ Database connected\n');

        // Test admin@test.com
        const email = 'admin@test.com';
        const testPassword = 'Admin123!';
        
        console.log(`📧 Testing: ${email}`);
        console.log(`🔑 Password to test: ${testPassword}\n`);

        // Get user
        const user = await User.findOne({ 
            where: { email },
            raw: true
        });

        if (!user) {
            console.log('❌ User not found!');
            return;
        }

        console.log('✅ User found:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Password field exists: ${user.password ? 'YES' : 'NO'}\n`);

        if (user.password) {
            console.log('🔐 Password field analysis:');
            console.log(`   Length: ${user.password.length} chars`);
            console.log(`   Starts with $2: ${user.password.startsWith('$2') ? 'YES (valid bcrypt)' : 'NO'}`);
            console.log(`   First 20 chars: ${user.password.substring(0, 20)}...`);
            
            // Test comparison
            console.log('\n🧪 Testing bcrypt.compare:');
            const isMatch = await bcrypt.compare(testPassword, user.password);
            console.log(`   Result: ${isMatch ? '✅ PASSWORD MATCHES!' : '❌ PASSWORD DOES NOT MATCH!'}`);
            
            if (!isMatch) {
                console.log('\n🔄 Let\'s create a new hash and update:');
                const newHash = await bcrypt.hash(testPassword, 10);
                console.log(`   New hash created: ${newHash.substring(0, 20)}...`);
                
                // Update with raw SQL to be sure
                await sequelize.query(
                    'UPDATE "Users" SET password = :hash WHERE id = :id',
                    {
                        replacements: { hash: newHash, id: user.id },
                        type: sequelize.QueryTypes.UPDATE
                    }
                );
                console.log('   ✅ Password updated in database');
                
                // Verify update
                const updatedUser = await User.findOne({ where: { email }, raw: true });
                const verifyMatch = await bcrypt.compare(testPassword, updatedUser.password);
                console.log(`   Verification: ${verifyMatch ? '✅ NOW IT WORKS!' : '❌ STILL NOT WORKING'}`);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await sequelize.close();
    }
}

debugPasswordIssue();