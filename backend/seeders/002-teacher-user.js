'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('👨‍🏫 Creando utenti teacher di test...');
    
    try {
      const hashedPassword = await bcrypt.hash('teacher123', 8);
      const [existingTeacher] = await queryInterface.sequelize.query(
        `SELECT id FROM "Users" WHERE email = 'teacher@university.it'`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      
      if (existingTeacher) {
        console.log('ℹ️ Utente teacher già presente - Aggiornamento ruolo...');
        await queryInterface.sequelize.query(
          `UPDATE "Users" SET role = 'teacher' WHERE email = 'teacher@university.it'`,
          { type: Sequelize.QueryTypes.UPDATE }
        );
        
        console.log('✅ Ruolo teacher aggiornato per utente esistente');
      } else {
        console.log('📝 Creando nuovo utente teacher...');
        
        await queryInterface.bulkInsert('Users', [
          {
            name: 'Mario',
            surname: 'Rossi',
            email: 'teacher@university.it',
            password: hashedPassword,
            role: 'teacher',
            matricola: 'TCH001',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]);
        
        console.log('✅ Utente teacher creato: teacher@university.it');
      }
      
      const [teacher] = await queryInterface.sequelize.query(
        `SELECT id FROM "Users" WHERE email = 'teacher@university.it'`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      
      if (teacher) {
        console.log(`👨‍🏫 Teacher ID: ${teacher.id}`);
        
        const [lessonCount] = await queryInterface.sequelize.query(
          `SELECT COUNT(*) as count FROM "Lessons" WHERE teacher_id IS NULL`,
          { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (lessonCount.count > 0) {
          console.log(`📚 Assegnando ${Math.min(3, lessonCount.count)} lezioni al teacher...`);
          
          await queryInterface.sequelize.query(`
            UPDATE "Lessons" 
            SET teacher_id = :teacherId, status = 'draft'
            WHERE teacher_id IS NULL 
            AND id IN (
              SELECT id FROM "Lessons" 
              WHERE teacher_id IS NULL 
              LIMIT 3
            )
          `, {
            replacements: { teacherId: teacher.id },
            type: Sequelize.QueryTypes.UPDATE
          });
          
          console.log('✅ Lezioni assegnate al teacher');
        } else {
          console.log('ℹ️ Nessuna lezione disponibile da assegnare');
        }
        
        const [totalLessons] = await queryInterface.sequelize.query(
          `SELECT COUNT(*) as count FROM "Lessons"`,
          { type: Sequelize.QueryTypes.SELECT }
        );
        
        if (totalLessons.count === 0) {
          console.log('📝 Creando lezione di test...');
          
          const [course] = await queryInterface.sequelize.query(
            `SELECT id FROM "Courses" LIMIT 1`,
            { type: Sequelize.QueryTypes.SELECT }
          );
          
          const [classroom] = await queryInterface.sequelize.query(
            `SELECT id FROM "Classrooms" LIMIT 1`,
            { type: Sequelize.QueryTypes.SELECT }
          );
          
          if (course && classroom) {
            await queryInterface.bulkInsert('Lessons', [
              {
                name: 'Lezione Test Teacher',
                lesson_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Domani
                course_id: course.id,
                classroom_id: classroom.id,
                teacher_id: teacher.id,
                status: 'draft',
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ]);
            
            console.log('✅ Lezione di test creata');
          }
        }
      }
      
      console.log('🎉 Seeder teacher completato con successo!');
      console.log('');
      console.log('📋 CREDENZIALI TEACHER:');
      console.log('   Email: teacher@university.it');
      console.log('   Password: teacher123');
      console.log('');
      
    } catch (error) {
      console.error('❌ Errore durante creazione teacher:', error);
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rimuovendo dati teacher...');
    
    try {
      await queryInterface.sequelize.query(`
        UPDATE "Lessons" SET teacher_id = NULL 
        WHERE teacher_id IN (
          SELECT id FROM "Users" WHERE email = 'teacher@university.it'
        )
      `);
      
      await queryInterface.bulkDelete('Users', {
        email: 'teacher@university.it'
      });
      
      console.log('✅ Dati teacher rimossi');
      
    } catch (error) {
      console.error('❌ Errore durante rimozione teacher:', error);
      throw error;
    }
  }
};