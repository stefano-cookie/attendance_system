const { Lesson } = require('../models');
const { Op } = require('sequelize');

class LessonSchedulerService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.checkInterval = 60000; // Check every minute
    }

    start() {
        if (this.isRunning) {
            console.log('🕐 Lesson scheduler is already running');
            return;
        }

        console.log('🚀 Starting lesson scheduler service...');
        this.isRunning = true;
        
        // Run initial check
        this.checkLessonsForCompletion();
        
        // Set up interval
        this.intervalId = setInterval(() => {
            this.checkLessonsForCompletion();
        }, this.checkInterval);
        
        console.log(`✅ Lesson scheduler started with ${this.checkInterval/1000}s interval`);
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        console.log('🛑 Stopping lesson scheduler service...');
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.isRunning = false;
        console.log('✅ Lesson scheduler stopped');
    }

    async checkLessonsForCompletion() {
        try {
            // Find all lessons that are not completed and should be completed
            const lessons = await Lesson.findAll({
                where: {
                    is_completed: false,
                    lesson_date: {
                        [Op.lte]: new Date() // Only check lessons on or before today
                    },
                    lesson_end: {
                        [Op.not]: null // Must have an end time
                    }
                }
            });

            let completedCount = 0;
            
            for (const lesson of lessons) {
                if (lesson.shouldBeCompleted()) {
                    try {
                        await lesson.markAsCompleted();
                        completedCount++;
                        console.log(`⏰ Auto-completed lesson: ${lesson.name} (ID: ${lesson.id})`);
                        
                        // Send email notifications
                        try {
                            const emailService = require('./emailService');
                            const emailResult = await emailService.sendAttendanceReportToAllStudents(lesson.id);
                            if (emailResult.success) {
                                console.log(`📧 Email reports sent for lesson ${lesson.id}: ${emailResult.results.sent} successful, ${emailResult.results.failed} failed`);
                            } else {
                                console.warn(`⚠️ Email sending failed for lesson ${lesson.id}:`, emailResult.error);
                            }
                        } catch (emailError) {
                            console.warn(`⚠️ Email service error for lesson ${lesson.id}:`, emailError.message);
                        }
                        
                    } catch (error) {
                        console.error(`❌ Error auto-completing lesson ${lesson.id}:`, error.message);
                    }
                }
            }

            if (completedCount > 0) {
                console.log(`✅ Auto-completed ${completedCount} lessons`);
            }

        } catch (error) {
            console.error('❌ Error in lesson scheduler:', error.message);
        }
    }

    // Method to manually trigger a check (useful for testing)
    async triggerCheck() {
        console.log('🔄 Manual trigger of lesson completion check...');
        await this.checkLessonsForCompletion();
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            nextCheck: this.intervalId ? new Date(Date.now() + this.checkInterval) : null
        };
    }
}

// Export singleton instance
const lessonScheduler = new LessonSchedulerService();
module.exports = lessonScheduler;