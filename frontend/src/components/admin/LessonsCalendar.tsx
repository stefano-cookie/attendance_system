import React, { useState, useEffect } from 'react';
import { Lesson } from '../../services/api';

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
  const [currentWeek, setCurrentWeek] = useState(new Date());

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
    for (let hour = 8; hour <= 18; hour++) {
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

  const getLessonForTimeSlot = (day: Date, hour: number) => {
    const dayLessons = getLessonsForDay(day);
    return dayLessons.find(lesson => {
      const lessonDate = new Date(lesson.lesson_date);
      return lessonDate.getHours() === hour;
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

  return (
    <div className="calendar-container bg-white rounded-lg shadow-lg p-6">
      <div className="calendar-header flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateWeek('prev')}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            &#8249; Precedente
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Oggi
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Successivo &#8250;
          </button>
        </div>
        <h2 className="text-xl font-semibold">
          {weekDays[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} - {' '}
          {weekDays[4].toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
        </h2>
      </div>

      <div className="calendar-grid">
        <div className="grid grid-cols-6 gap-1">
          <div className="time-column bg-gray-50 p-2 font-semibold text-center">Ora</div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="day-header bg-gray-50 p-2 font-semibold text-center">
              <div>{day.toLocaleDateString('it-IT', { weekday: 'short' })}</div>
              <div className="text-sm text-gray-600">
                {day.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              </div>
            </div>
          ))}

          {timeSlots.map(hour => (
            <React.Fragment key={hour}>
              <div className="time-slot bg-gray-50 p-2 text-center text-sm font-medium border-r">
                {hour}:00
              </div>
              {weekDays.map(day => {
                const lesson = getLessonForTimeSlot(day, hour);
                return (
                  <div
                    key={`${day.toISOString()}-${hour}`}
                    className="time-cell border border-gray-200 min-h-[60px] relative cursor-pointer hover:bg-blue-50"
                    onClick={() => {
                      if (lesson) {
                        onLessonClick(lesson);
                      } else {
                        const clickDate = new Date(day);
                        clickDate.setHours(hour, 0, 0, 0);
                        onTimeSlotClick(clickDate, hour);
                      }
                    }}
                  >
                    {lesson && (
                      <div className="lesson-card bg-blue-500 text-white p-2 rounded m-1 text-xs">
                        <div className="font-semibold truncate">{lesson.name}</div>
                        <div className="text-blue-100 truncate">
                          {lesson.course?.name || 'Corso non specificato'}
                        </div>
                        {lesson.classroom?.name && (
                          <div className="text-blue-200 text-[10px] truncate">
                            📍 {lesson.classroom.name}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LessonsCalendar;