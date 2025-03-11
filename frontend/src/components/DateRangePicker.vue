<!-- DateRangePicker.vue -->
<template>
  <div class="date-range-container">
    <div class="date-range-header">
      <div class="date-range-title">
        <i class="date-icon">📅</i>
        <span>{{ title }}</span>
      </div>
      
      <div class="date-range-presets">
        <button 
          v-for="preset in presets" 
          :key="preset.value"
          class="preset-btn"
          :class="{ active: selectedPreset === preset.value }"
          @click="selectPreset(preset.value)"
        >
          {{ preset.label }}
        </button>
      </div>
    </div>
    
    <div class="date-range-display" @click="toggleCalendar">
      <span>{{ formattedDateRange }}</span>
      <i class="toggle-icon">{{ isCalendarOpen ? '▲' : '▼' }}</i>
    </div>
    
    <div v-if="isCalendarOpen" class="calendar-dropdown">
      <div class="calendar-container">
        <div class="calendar-header">
          <div class="calendar-nav">
            <button class="nav-btn" @click="navigateMonth(-1)">&lt;</button>
            <span>{{ currentMonthName }} {{ currentYear }}</span>
            <button class="nav-btn" @click="navigateMonth(1)">&gt;</button>
          </div>
        </div>
        
        <div class="calendar-grid">
          <!-- Días de la semana -->
          <div class="calendar-weekdays">
            <div class="calendar-cell weekday" v-for="day in weekdays" :key="day">{{ day }}</div>
          </div>
          
          <!-- Días del mes -->
          <div class="calendar-days">
            <div 
              v-for="(day, index) in calendarDays" 
              :key="index"
              class="calendar-cell day"
              :class="{
                'empty': !day.date,
                'disabled': day.disabled,
                'selected-start': isStartDate(day.date),
                'selected-end': isEndDate(day.date),
                'in-range': isInRange(day.date),
                'today': isToday(day.date)
              }"
              @click="selectDate(day)"
            >
              {{ day.date ? day.date.getDate() : '' }}
            </div>
          </div>
        </div>
        
        <div class="calendar-actions">
          <button class="action-btn cancel" @click="cancelSelection">Cancelar</button>
          <button class="action-btn apply" @click="applySelection">Aplicar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DateRangePicker',
  props: {
    title: {
      type: String,
      default: 'Periodo de análisis'
    },
    initialStartDate: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setDate(date.getDate() - 7); // 1 semana por defecto
        return date;
      }
    },
    initialEndDate: {
      type: Date,
      default: () => new Date()
    },
    minDate: {
      type: Date,
      default: null
    },
    maxDate: {
      type: Date,
      default: null
    }
  },
  
  data() {
    return {
      startDate: this.initialStartDate,
      endDate: this.initialEndDate,
      tempStartDate: null,
      tempEndDate: null,
      isCalendarOpen: false,
      selectingSecondDate: false,
      currentMonth: new Date().getMonth(),
      currentYear: new Date().getFullYear(),
      selectedPreset: 'week',
      presets: [
        { value: 'day', label: '24h' },
        { value: 'week', label: '7 días' },
        { value: 'month', label: '30 días' },
        { value: 'year', label: 'Anual' },
        { value: 'custom', label: 'Personalizado' }
      ],
      weekdays: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
    };
  },
  
  computed: {
    formattedDateRange() {
      const options = { day: '2-digit', month: 'short', year: 'numeric' };
      const start = this.startDate.toLocaleDateString(undefined, options);
      const end = this.endDate.toLocaleDateString(undefined, options);
      return `${start} - ${end}`;
    },
    
    currentMonthName() {
      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return monthNames[this.currentMonth];
    },
    
    calendarDays() {
      const days = [];
      
      // Crear una fecha para el primer día del mes actual
      const firstDayOfMonth = new Date(this.currentYear, this.currentMonth, 1);
      const lastDayOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);
      
      // Calcular el día de la semana del primer día (0 = domingo, 1 = lunes, etc.)
      const firstDayWeekday = firstDayOfMonth.getDay();
      
      // Añadir días vacíos para rellenar hasta el primer día del mes
      for (let i = 0; i < firstDayWeekday; i++) {
        days.push({ date: null, disabled: true });
      }
      
      // Añadir todos los días del mes
      for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const date = new Date(this.currentYear, this.currentMonth, day);
        
        // Comprobar si el día está deshabilitado (fuera del rango min/max)
        const disabled = (this.minDate && date < this.minDate) || 
                        (this.maxDate && date > this.maxDate);
        
        days.push({ date, disabled });
      }
      
      return days;
    }
  },
  
  methods: {
    toggleCalendar() {
      this.isCalendarOpen = !this.isCalendarOpen;
      
      if (this.isCalendarOpen) {
        // Preparar fechas temporales
        this.tempStartDate = new Date(this.startDate);
        this.tempEndDate = new Date(this.endDate);
        
        // Establecer el mes/año actual al del inicio del rango
        this.currentMonth = this.startDate.getMonth();
        this.currentYear = this.startDate.getFullYear();
      }
    },
    
    navigateMonth(direction) {
      this.currentMonth += direction;
      
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      } else if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
    },
    
    selectDate(day) {
      if (!day.date || day.disabled) return;
      
      if (!this.selectingSecondDate) {
        // Seleccionando fecha inicial
        this.tempStartDate = new Date(day.date);
        this.tempEndDate = null;
        this.selectingSecondDate = true;
      } else {
        // Seleccionando fecha final
        if (day.date < this.tempStartDate) {
          // Si la segunda fecha es anterior a la primera, intercambiarlas
          this.tempEndDate = new Date(this.tempStartDate);
          this.tempStartDate = new Date(day.date);
        } else {
          this.tempEndDate = new Date(day.date);
        }
        this.selectingSecondDate = false;
        this.selectedPreset = 'custom';
      }
    },
    
    applySelection() {
      if (this.tempStartDate && this.tempEndDate) {
        this.startDate = new Date(this.tempStartDate);
        this.endDate = new Date(this.tempEndDate);
        
        this.$emit('update:start-date', this.startDate);
        this.$emit('update:end-date', this.endDate);
        this.$emit('date-range-changed', {
          start: this.startDate,
          end: this.endDate,
          preset: this.selectedPreset
        });
      }
      
      this.isCalendarOpen = false;
    },
    
    cancelSelection() {
      this.isCalendarOpen = false;
      this.selectingSecondDate = false;
    },
    
    selectPreset(preset) {
      this.selectedPreset = preset;
      const now = new Date();
      let newStartDate;
      
      switch (preset) {
        case 'day':
          newStartDate = new Date(now);
          newStartDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          newStartDate = new Date(now);
          newStartDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          newStartDate = new Date(now);
          newStartDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          newStartDate = new Date(now);
          newStartDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'custom':
          // No hacer nada, mantener las fechas actuales
          return;
      }
      
      this.startDate = newStartDate;
      this.endDate = new Date(now);
      
      this.$emit('update:start-date', this.startDate);
      this.$emit('update:end-date', this.endDate);
      this.$emit('date-range-changed', {
        start: this.startDate,
        end: this.endDate,
        preset: this.selectedPreset
      });
    },
    
    isStartDate(date) {
      if (!date || !this.tempStartDate) return false;
      return date.toDateString() === this.tempStartDate.toDateString();
    },
    
    isEndDate(date) {
      if (!date || !this.tempEndDate) return false;
      return date.toDateString() === this.tempEndDate.toDateString();
    },
    
    isInRange(date) {
      if (!date || !this.tempStartDate || !this.tempEndDate) return false;
      return date > this.tempStartDate && date < this.tempEndDate;
    },
    
    isToday(date) {
      if (!date) return false;
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }
  }
};
</script>

<style scoped>
.date-range-container {
  position: relative;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  padding: 15px;
}

.date-range-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.date-range-title {
  display: flex;
  align-items: center;
  font-weight: 500;
  color: #2c3e50;
}

.date-icon {
  margin-right: 8px;
}

.date-range-presets {
  display: flex;
  gap: 5px;
}

.preset-btn {
  background-color: #f8f9fa;
  border: 1px solid #ced4da;
  color: #495057;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn.active {
  background-color: #3498db;
  color: white;
  border-color: #3498db;
}

.date-range-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background-color: #f8f9fa;
  cursor: pointer;
}

.toggle-icon {
  font-size: 0.8rem;
  color: #6c757d;
}

.calendar-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 5px;
  z-index: 1000;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.calendar-container {
  padding: 15px;
}

.calendar-header {
  margin-bottom: 15px;
}

.calendar-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #3498db;
  cursor: pointer;
}

.calendar-grid {
  margin-bottom: 15px;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 5px;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.calendar-cell {
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.9rem;
}

.calendar-cell.weekday {
  font-weight: 500;
  color: #6c757d;
}

.calendar-cell.day {
  border-radius: 4px;
  cursor: pointer;
}

.calendar-cell.day:hover:not(.empty):not(.disabled) {
  background-color: #e9ecef;
}

.calendar-cell.day.empty {
  cursor: default;
}

.calendar-cell.day.disabled {
  color: #ced4da;
  cursor: not-allowed;
}

.calendar-cell.day.selected-start,
.calendar-cell.day.selected-end {
  background-color: #3498db;
  color: white;
}

.calendar-cell.day.in-range {
  background-color: #e3f2fd;
}

.calendar-cell.day.today {
  border: 1px solid #3498db;
}

.calendar-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.action-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
}

.action-btn.cancel {
  background-color: #e9ecef;
  color: #495057;
}

.action-btn.apply {
  background-color: #3498db;
  color: white;
}
</style>