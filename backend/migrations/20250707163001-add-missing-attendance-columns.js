'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Aggiunta colonne mancanti alla tabella Attendances...');
    
    try {
      // Aggiungi override_reason
      await queryInterface.addColumn('Attendances', 'override_reason', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Motivo modifica manuale'
      });
      console.log('✅ Aggiunta colonna override_reason');
    } catch (error) {
      console.log('⚠️ override_reason già esistente o errore:', error.message);
    }
    
    try {
      // Aggiungi arrival_time
      await queryInterface.addColumn('Attendances', 'arrival_time', {
        type: Sequelize.TIME,
        allowNull: true,
        comment: 'Ora di arrivo specifica'
      });
      console.log('✅ Aggiunta colonna arrival_time');
    } catch (error) {
      console.log('⚠️ arrival_time già esistente o errore:', error.message);
    }
    
    try {
      // Aggiungi review_notes
      await queryInterface.addColumn('Attendances', 'review_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Note di revisione'
      });
      console.log('✅ Aggiunta colonna review_notes');
    } catch (error) {
      console.log('⚠️ review_notes già esistente o errore:', error.message);
    }
    
    console.log('✅ Migrazione completata - Colonne mancanti aggiunte');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rimozione colonne aggiunte...');
    
    try {
      await queryInterface.removeColumn('Attendances', 'override_reason');
      await queryInterface.removeColumn('Attendances', 'arrival_time');
      await queryInterface.removeColumn('Attendances', 'review_notes');
      console.log('✅ Colonne rimosse');
    } catch (error) {
      console.log('⚠️ Errore rimozione colonne:', error.message);
    }
  }
};