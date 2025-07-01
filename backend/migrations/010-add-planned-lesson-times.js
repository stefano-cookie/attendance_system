'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Lessons', 'planned_start_time', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Ora pianificata di inizio lezione'
    });

    await queryInterface.addColumn('Lessons', 'planned_end_time', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Ora pianificata di fine lezione'
    });

    console.log('✅ Colonne planned_start_time e planned_end_time aggiunte alla tabella Lessons');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Lessons', 'planned_start_time');
    await queryInterface.removeColumn('Lessons', 'planned_end_time');
    console.log('✅ Colonne planned_start_time e planned_end_time rimosse dalla tabella Lessons');
  }
};