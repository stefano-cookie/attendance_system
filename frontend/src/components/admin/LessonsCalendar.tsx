import React, { useState, useEffect } from 'react';
import { Lesson } from '../../services/api';
import { useTranslation } from 'react-i18next';

interface LessonsCalendarProps {
  lessons: Lesson[];
  onLessonClick: (lesson: Lesson) => void;
  onTimeSlotClick: (date: Date, hour: number) => void;
  onCreateLesson: (data: Partial<Lesson>) => void;
}

const LessonsCalendar: React.FC<LessonsCalendarProps> = ({
  lessons,
  onLessonClick,
  onTimeSlotClick,
  onCreateLesson
}) => {
  const { t } = useTranslation();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay() + 1);
    const days = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 19; hour++) {
      slots.push(hour);
    }
    return slots;
  };

  const weekDays = getWeekDays(currentWeek);
  const timeSlots = getTimeSlots();

  const getLessonsForDay = (day: Date) => {
    return lessons.filter(lesson => {
      const lessonDate = new Date(lesson.lesson_date);
      return (
        lessonDate.getDate() === day.getDate() &&
        lessonDate.getMonth() === day.getMonth() &&
        lessonDate.getFullYear() === day.getFullYear()
      );
    });
  };

  // Helper function to calculate lesson duration in hours
  const getLessonDuration = (lesson: Lesson) => {
    if (!lesson.lesson_start || !lesson.lesson_end) {
      return 1; // Default to 1 hour
    }
    
    const startTime = new Date(`2000-01-01T${lesson.lesson_start}`);
    const endTime = new Date(`2000-01-01T${lesson.lesson_end}`);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = Math.ceil(durationMs / (1000 * 60 * 60)); // Round up to next hour
    
    return Math.max(1, durationHours); // Minimum 1 hour
  };

  // Helper function to get course color for lesson
  const getCourseColor = (lesson: Lesson) => {
    if (lesson.course?.color) {
      return lesson.course.color;
    }
    // Default colors based on course name or fallback
    const defaultColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    const index = lesson.course_id ? lesson.course_id % defaultColors.length : 0;
    return defaultColors[index];
  };

  // Helper function to check if a time slot is occupied by a lesson that started earlier
  const isSlotOccupiedByEarlierLesson = (day: Date, hour: number) => {
    const dayLessons = getLessonsForDay(day);
    
    return dayLessons.some(lesson => {
      if (!lesson.lesson_start || !lesson.lesson_end) {
        return false;
      }
      
      const lessonStartHour = parseInt(lesson.lesson_start.split(':')[0]);
      const duration = getLessonDuration(lesson);
      const lessonEndHour = lessonStartHour + duration;
      
      // Check if this hour is within the lesson's time range (but not the starting hour)
      return lessonStartHour < hour && hour < lessonEndHour;
    });
  };

  const getAllLessonsForTimeSlot = (day: Date, hour: number) => {
    const dayLessons = getLessonsForDay(day);
    return dayLessons.filter(lesson => {
      // Use lesson_start if available, otherwise skip this lesson
      if (!lesson.lesson_start) {
        return false;
      }
      
      const lessonStartHour = parseInt(lesson.lesson_start.split(':')[0]);
      // Include lezioni che iniziano ESATTAMENTE in questo slot orario
      return lessonStartHour === hour;
    }).sort((a, b) => {
      // Sort by lesson start time, then by course name for consistency
      const timeA = a.lesson_start || '00:00';
      const timeB = b.lesson_start || '00:00';
      if (timeA !== timeB) {
        return timeA.localeCompare(timeB);
      }
      return (a.course?.name || '').localeCompare(b.course?.name || '');
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  // Helper functions for slot expansion
  const getSlotKey = (day: Date, hour: number) => {
    return `${day.toISOString().split('T')[0]}-${hour}`;
  };

  const isSlotExpanded = (day: Date, hour: number) => {
    return expandedSlots.has(getSlotKey(day, hour));
  };

  const toggleSlotExpansion = (day: Date, hour: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const slotKey = getSlotKey(day, hour);
    const newExpandedSlots = new Set(expandedSlots);
    
    if (newExpandedSlots.has(slotKey)) {
      newExpandedSlots.delete(slotKey);
    } else {
      newExpandedSlots.add(slotKey);
    }
    
    setExpandedSlots(newExpandedSlots);
  };

  return (
    <div className="calendar-container bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6 relative">
      {/* Overlay when lessons are expanded */}
      {expandedSlots.size > 0 && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
          onClick={() => setExpandedSlots(new Set())}
        />
      )}
      <div className="calendar-header flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigateWeek('prev')}
            className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
            title={t('admin.lessons.calendar.previous')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md font-medium"
          >
            {t('admin.lessons.calendar.today')}
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="flex items-center justify-center w-10 h-10 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-full transition-all duration-200 shadow-sm hover:shadow-md"
            title={t('admin.lessons.calendar.next')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <h2 className="text-xl font-semibold text-white">
          {weekDays[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} - {' '}
          {weekDays[4].toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
        </h2>
      </div>

      <div className="calendar-grid">
        <div className="grid grid-cols-6 gap-2 relative">
          <div className="time-column bg-gray-700 p-3 font-semibold text-center text-gray-200 border border-gray-600 rounded-lg shadow-sm">
            {t('admin.lessons.calendar.hour')}
          </div>
          {weekDays.map(day => {
            const isToday = new Date().toDateString() === day.toDateString();
            return (
              <div key={day.toISOString()} className={`day-header bg-gray-700 p-3 font-semibold text-center border border-gray-600 rounded-lg shadow-sm transition-colors ${
                isToday ? 'bg-blue-700/50 border-blue-500 text-blue-200' : 'text-gray-200'
              }`}>
                <div className="text-sm">{day.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
                <div className={`text-xs mt-1 ${
                  isToday ? 'text-blue-300' : 'text-gray-400'
                }`}>
                  {day.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                </div>
                {isToday && (
                  <div className="w-2 h-2 bg-blue-400 rounded-full mx-auto mt-1"></div>
                )}
              </div>
            );
          })}

          {timeSlots.map(hour => {
            const isCurrentHour = new Date().getHours() === hour;
            return (
              <React.Fragment key={hour}>
                <div className={`time-slot bg-gray-700 p-3 text-center text-sm font-medium border border-gray-600 rounded-lg shadow-sm transition-colors ${
                  isCurrentHour ? 'bg-blue-700/30 border-blue-500 text-blue-300' : 'text-gray-200'
                }`}>
                  {hour}:00
                  {isCurrentHour && (
                    <div className="w-1 h-1 bg-blue-400 rounded-full mx-auto mt-1"></div>
                  )}
                </div>
              {weekDays.map(day => {
                const lessonsInSlot = getAllLessonsForTimeSlot(day, hour);
                const mainLesson = lessonsInSlot[0]; // Prendi la prima lezione se ce ne sono multiple
                const hasMultipleLessons = lessonsInSlot.length > 1;
                const isOccupiedByEarlier = isSlotOccupiedByEarlierLesson(day, hour);
                
                // Calculate lesson duration for spanning multiple slots
                const lessonDuration = mainLesson ? getLessonDuration(mainLesson) : 1;
                const cellHeight = mainLesson ? `${80 * lessonDuration + (lessonDuration - 1) * 8}px` : '80px'; // 8px is gap between cells
                
                // Calculate stacked positioning for overlapping lessons
                const stackOffset = hasMultipleLessons ? 3 : 0;
                const isExpanded = isSlotExpanded(day, hour);
                
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className={`time-cell border border-gray-600 relative cursor-pointer transition-all duration-200 group ${
                      isOccupiedByEarlier 
                        ? 'bg-gray-700/30 border-gray-600/50' // Occupied by earlier lesson
                        : 'hover:bg-gray-700/50 bg-gray-800 rounded-lg'
                    }`}
                    style={{ 
                      minHeight: '80px',
                      height: '80px'
                    }}
                    onClick={(e) => {
                      // Only handle click if not clicking on a lesson card
                      const target = e.target as HTMLElement;
                      if (!target.closest('.lesson-card')) {
                        if (!isOccupiedByEarlier) {
                          const clickDate = new Date(day);
                          clickDate.setHours(hour, 0, 0, 0);
                          onTimeSlotClick(clickDate, hour);
                        }
                      }
                    }}
                    title={
                      mainLesson ? t('admin.lessons.calendar.clickToEdit') : 
                      isOccupiedByEarlier ? 'Slot occupato da lezione precedente' :
                      t('admin.lessons.calendar.clickToCreate')
                    }
                  >
                    {mainLesson ? (
                      <div className={`lessons-stack relative w-full transition-all duration-300 ${isExpanded ? 'z-50 absolute left-0 top-0 right-0 bg-gray-900/95 backdrop-blur-sm rounded-lg border border-gray-600 p-2 shadow-xl' : 'h-full'}`}>
                        {lessonsInSlot.map((lesson, index) => {
                          const courseColor = getCourseColor(lesson);
                          const isMainLesson = index === 0;
                          
                          // Positioning logic based on expansion state
                          let positioning;
                          if (isExpanded) {
                            // Expanded: stack vertically with proper spacing
                            positioning = {
                              position: 'relative' as const,
                              marginBottom: index < lessonsInSlot.length - 1 ? '8px' : '0px',
                              zIndex: 10 + index,
                              height: 'auto',
                              minHeight: '60px'
                            };
                          } else {
                            // Collapsed: stack with offset
                            const rightOffset = index * stackOffset;
                            const bottomOffset = index * stackOffset;
                            const zIndex = lessonsInSlot.length - index + 10;
                            
                            positioning = {
                              position: 'absolute' as const,
                              left: '0px',
                              top: '0px',
                              right: `${rightOffset}px`,
                              bottom: `${bottomOffset}px`,
                              height: cellHeight,
                              zIndex: zIndex
                            };
                          }
                          
                          return (
                            <div
                              key={lesson.id}
                              className={`lesson-card ${hasMultipleLessons && !isExpanded ? 'p-2' : 'p-3'} rounded-lg text-xs shadow-lg transition-all duration-300 ${
                                lesson.is_completed 
                                  ? 'opacity-75 cursor-not-allowed' 
                                  : 'cursor-pointer'
                              } text-white ${isExpanded && !lesson.is_completed ? 'hover:scale-[1.02]' : ''}`}
                              style={{
                                ...positioning,
                                backgroundColor: courseColor,
                                boxShadow: isExpanded 
                                  ? `0 8px 16px -4px rgba(0, 0, 0, 0.2), 0 4px 8px -2px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.1)`
                                  : `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.1)`
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!lesson.is_completed) {
                                  onLessonClick(lesson);
                                }
                              }}
                              title={lesson.is_completed 
                                ? `${lesson.name} - Lezione completata (non modificabile)` 
                                : `${lesson.name} - ${lesson.course?.name || ''} (${lesson.lesson_start?.substring(0, 5)} - ${lesson.lesson_end?.substring(0, 5)})`
                              }
                            >
                              {/* Effetto luminoso */}
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                              
                              <div className="relative z-10">
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-white text-sm leading-tight truncate flex items-center">
                                      {isExpanded && hasMultipleLessons && (
                                        <span className="bg-white/20 rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold mr-2 flex-shrink-0">
                                          {index + 1}
                                        </span>
                                      )}
                                      {lesson.name}
                                    </div>
                                    <div className="text-xs mt-1 opacity-90">
                                      {lesson.lesson_start 
                                        ? `${lesson.lesson_start.substring(0, 5)}${lesson.lesson_end ? ' - ' + lesson.lesson_end.substring(0, 5) : ''}`
                                        : new Date(lesson.lesson_date).toLocaleTimeString('it-IT', { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                          })
                                      }
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end ml-2">
                                    {lesson.is_completed && (
                                      <div className="bg-white/20 rounded-full p-1 mb-1">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    )}
                                    {hasMultipleLessons && isMainLesson && !isExpanded && (
                                      <button
                                        className="bg-white/20 hover:bg-white/30 rounded-full px-2 py-1 text-[9px] font-medium transition-colors duration-200"
                                        onClick={(e) => toggleSlotExpansion(day, hour, e)}
                                        title={`Mostra tutte le ${lessonsInSlot.length} lezioni`}
                                      >
                                        +{lessonsInSlot.length - 1}
                                      </button>
                                    )}
                                    {hasMultipleLessons && isExpanded && index === 0 && (
                                      <button
                                        className="bg-white/20 hover:bg-white/30 rounded-full p-1 transition-colors duration-200"
                                        onClick={(e) => toggleSlotExpansion(day, hour, e)}
                                        title="Comprimi lezioni"
                                      >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                        </svg>
                                      </button>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="space-y-1">
                                  {/* Show course only for lessons > 1 hour or when expanded */}
                                  {lesson.course?.name && (lessonDuration > 1 || isExpanded) && (
                                    <div className="text-[10px] opacity-90 truncate flex items-center">
                                      <svg className="w-2.5 h-2.5 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.84L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.84l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
                                      </svg>
                                      {lesson.course.name}
                                    </div>
                                  )}
                                  
                                  {/* Show classroom only when expanded or as fallback if no course */}
                                  {lesson.classroom?.name && (isExpanded || (!lesson.course?.name && lessonDuration <= 1)) && (
                                    <div className="text-[10px] opacity-90 truncate flex items-center">
                                      <svg className="w-2.5 h-2.5 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                      </svg>
                                      {lesson.classroom.name}
                                    </div>
                                  )}
                                  
                                  {lesson.subject?.name && (
                                    <div className="text-[10px] opacity-90 truncate flex items-center">
                                      <svg className="w-2.5 h-2.5 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                      </svg>
                                      {lesson.subject.name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : isOccupiedByEarlier ? (
                      <div className="occupied-slot flex items-center justify-center h-full">
                        <div className="text-gray-500 text-xs text-center p-2">
                          <div className="text-[10px] text-gray-500 font-medium opacity-60">
                            Lezione in corso
                          </div>
                          <div className="w-full h-1 bg-gray-600/50 rounded mt-1"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-slot opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center h-full">
                        <div className="text-gray-500 text-xs text-center p-3 rounded-lg bg-gray-700/30 border border-dashed border-gray-600">
                          <svg className="w-5 h-5 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <div className="text-[10px] text-gray-400 font-medium">
                            {t('admin.lessons.calendar.addLesson')}
                          </div>
                          <div className="text-[9px] text-gray-500 mt-1">
                            {hour}:00
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LessonsCalendar;