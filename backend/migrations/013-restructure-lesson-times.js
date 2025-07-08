'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add new TIME columns for lesson start and end
    await queryInterface.addColumn('Lessons', 'lesson_start', {
      type: Sequelize.TIME,
      allowNull: true,
      comment: 'Ora di inizio lezione (solo orario)'
    });

    await queryInterface.addColumn('Lessons', 'lesson_end', {
      type: Sequelize.TIME,
      allowNull: true,
      comment: 'Ora di fine lezione (solo orario)'
    });

    console.log('✅ Colonne lesson_start e lesson_end aggiunte');

    // Step 2: Migrate data from planned_start_time and planned_end_time to new columns
    // For existing lessons with planned times, extract the time portion
    await queryInterface.sequelize.query(`
      UPDATE "Lessons" 
      SET lesson_start = planned_start_time::time 
      WHERE planned_start_time IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Lessons" 
      SET lesson_end = planned_end_time::time 
      WHERE planned_end_time IS NOT NULL
    `);

    console.log('✅ Dati migrati dalle colonne planned_*_time alle nuove colonne');

    // Step 3: Update lesson_date to remove time component (keep only date)
    await queryInterface.sequelize.query(`
      UPDATE "Lessons" 
      SET lesson_date = lesson_date::date 
      WHERE lesson_date IS NOT NULL
    `);

    console.log('✅ lesson_date aggiornato per contenere solo la data');

    // Step 4: Remove old planned_start_time and planned_end_time columns
    await queryInterface.removeColumn('Lessons', 'planned_start_time');
    await queryInterface.removeColumn('Lessons', 'planned_end_time');

    console.log('✅ Colonne planned_start_time e planned_end_time rimosse');
    console.log('✅ Ristrutturazione tempi lezioni completata');
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse the migration
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

    // Migrate data back
    await queryInterface.sequelize.query(`
      UPDATE "Lessons" 
      SET planned_start_time = (lesson_date + lesson_start::time)::timestamp 
      WHERE lesson_start IS NOT NULL AND lesson_date IS NOT NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE "Lessons" 
      SET planned_end_time = (lesson_date + lesson_end::time)::timestamp 
      WHERE lesson_end IS NOT NULL AND lesson_date IS NOT NULL
    `);

    await queryInterface.removeColumn('Lessons', 'lesson_start');
    await queryInterface.removeColumn('Lessons', 'lesson_end');

    console.log('✅ Rollback della ristrutturazione tempi lezioni completato');
  }
};