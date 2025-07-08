const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Rimozione vincolo unico attendance e aggiunta nuovi indici...');
    
    try {
      // Rimuovi il vincolo unico esistente
      await queryInterface.removeIndex('Attendances', 'attendance_user_lesson_unique');
      console.log('✅ Rimosso vincolo unico attendance_user_lesson_unique');
    } catch (error) {
      console.log('⚠️ Vincolo unico già rimosso o non esistente:', error.message);
    }
    
    try {
      // Aggiungi nuovo indice non unico per performance
      await queryInterface.addIndex('Attendances', ['userId', 'lessonId'], {
        name: 'attendance_user_lesson_index'
      });
      console.log('✅ Aggiunto indice attendance_user_lesson_index');
    } catch (error) {
      console.log('⚠️ Indice già esistente:', error.message);
    }
    
    try {
      // Aggiungi indice su timestamp per ordinamento
      await queryInterface.addIndex('Attendances', ['timestamp'], {
        name: 'attendance_timestamp_index'
      });
      console.log('✅ Aggiunto indice attendance_timestamp_index');
    } catch (error) {
      console.log('⚠️ Indice timestamp già esistente:', error.message);
    }
    
    console.log('✅ Migrazione completata - Ora sono permesse multiple presenze per studente/lezione');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Ripristino vincolo unico attendance...');
    
    try {
      // Rimuovi gli indici non unici
      await queryInterface.removeIndex('Attendances', 'attendance_user_lesson_index');
      await queryInterface.removeIndex('Attendances', 'attendance_timestamp_index');
    } catch (error) {
      console.log('⚠️ Errore rimozione indici:', error.message);
    }
    
    try {
      // Ripristina il vincolo unico (solo se non ci sono duplicati)
      await queryInterface.addIndex('Attendances', ['userId', 'lessonId'], {
        unique: true,
        name: 'attendance_user_lesson_unique'
      });
      console.log('✅ Ripristinato vincolo unico');
    } catch (error) {
      console.log('❌ Impossibile ripristinare vincolo unico (probabilmente ci sono duplicati):', error.message);
    }
  }
};