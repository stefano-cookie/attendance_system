'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Update all existing lesson_date values to remove time component
    await queryInterface.sequelize.query(`
      UPDATE "Lessons" 
      SET lesson_date = lesson_date::date
      WHERE lesson_date IS NOT NULL
    `);

    console.log('✅ Removed time component from existing lesson_date values');

    // Step 2: Change the column type to DATE (which will store only date in PostgreSQL)
    await queryInterface.changeColumn('Lessons', 'lesson_date', {
      type: Sequelize.DATEONLY,
      allowNull: false,
      comment: 'Data della lezione (solo giorno, senza orario)'
    });

    console.log('✅ Changed lesson_date column type to DATEONLY');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to TIMESTAMP
    await queryInterface.changeColumn('Lessons', 'lesson_date', {
      type: Sequelize.DATE,
      allowNull: false
    });

    console.log('✅ Reverted lesson_date to DATE type');
  }
};