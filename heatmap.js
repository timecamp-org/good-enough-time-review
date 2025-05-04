// Time Heatmap Functionality
// This file contains functions to create a time heatmap visualization showing
// which category dominates each hour of each day

// Main function to generate time heatmap
function generateTimeHeatmap(data, targetElement) {
  if (!data || data.length === 0) {
    targetElement.innerHTML = '<p class="text-muted-foreground">No data available for time heatmap</p>';
    return;
  }

  // First, group events by normalized category
  const categorizedEvents = groupEventsByCategory(data);

  // Then, determine the time distribution for each day and hour
  const timeMatrix = buildTimeMatrix(categorizedEvents);

  // Create the HTML table for the heatmap
  const heatmapHtml = createHeatmapTable(timeMatrix);
  
  // Render the heatmap
  targetElement.innerHTML = heatmapHtml;
}

// Group events by their normalized category
function groupEventsByCategory(data) {
  const categorizedEvents = {};
  
  data.forEach(event => {
    // Skip events without proper data
    if (!event.StartDate || !event.EndDate || !event.NormalizedSummary) {
      return;
    }
    
    // Skip ignored events
    if (event.NormalizedSummary.toUpperCase() === 'IGNORE') {
      return;
    }
    
    // Skip all-day events
    if (event.IsAllDay === true) {
      return;
    }
    
    // Initialize category if it doesn't exist
    const category = event.NormalizedSummary;
    if (!categorizedEvents[category]) {
      categorizedEvents[category] = [];
    }
    
    // Add event to its category
    categorizedEvents[category].push(event);
  });
  
  return categorizedEvents;
}

// Build a matrix of time allocation for each day and hour
function buildTimeMatrix(categorizedEvents) {
  const timeMatrix = {};
  
  // Process each category and its events
  Object.entries(categorizedEvents).forEach(([category, events], categoryIndex) => {
    events.forEach(event => {
      const start = new Date(event.StartDate);
      const end = new Date(event.EndDate);
      
      // Skip events that span more than 24 hours (likely misconfigured)
      if ((end - start) > 24 * 60 * 60 * 1000) {
        return;
      }
      
      // Process each hour within the event
      let currentHour = new Date(start);
      currentHour.setMinutes(0, 0, 0); // Start at the beginning of the hour
      
      while (currentHour < end) {
        // Calculate minutes spent in this hour
        const hourEnd = new Date(currentHour);
        hourEnd.setHours(hourEnd.getHours() + 1);
        
        const timeInHour = Math.min(
          (hourEnd > end ? end : hourEnd) - (currentHour < start ? start : currentHour)
        ) / (1000 * 60); // Convert to minutes
        
        // Skip if no meaningful time was spent
        if (timeInHour <= 0) {
          currentHour = hourEnd;
          continue;
        }
        
        // Format the date key (YYYY-MM-DD)
        const dateKey = formatDateKey(currentHour);
        const hour = currentHour.getHours();
        
        // Initialize this date in the matrix if needed
        if (!timeMatrix[dateKey]) {
          timeMatrix[dateKey] = {
            date: dateKey,
            dayOfWeek: currentHour.getDay(),
            hours: Array(24).fill().map(() => ({ category: null, minutes: 0, categoryIndex: -1, count: 0 }))
          };
        }
        
        // Update time spent in this hour for this category
        const hourData = timeMatrix[dateKey].hours[hour];
        
        // If this category has more minutes than the current max, it becomes dominant
        if (timeInHour > hourData.minutes) {
          hourData.category = category;
          hourData.minutes = timeInHour;
          hourData.categoryIndex = categoryIndex;
        }
        
        // Increment event count for this hour
        hourData.count++;
        
        // Move to the next hour
        currentHour = hourEnd;
      }
    });
  });
  
  return timeMatrix;
}

// Create the HTML table for the heatmap
function createHeatmapTable(timeMatrix) {
  // Get sorted dates
  const dates = Object.values(timeMatrix)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (dates.length === 0) {
    return '<p class="text-muted-foreground">No data available for time heatmap</p>';
  }
  
  // Get category colors - these should match colors in updateStatistics()
  const categoryColors = [
    '#4285f4', // Blue
    '#ea4335', // Red
    '#fbbc05', // Yellow
    '#34a853', // Green
    '#aa46bb', // Purple
    '#f57c00', // Orange
    '#0097a7', // Teal
    '#757575'  // Gray
  ];
  
  // Extract unique categories from the matrix
  const categoryMap = {};
  const categoryHours = {};
  
  Object.values(timeMatrix).forEach(day => {
    day.hours.forEach(hourData => {
      if (hourData.category && hourData.categoryIndex >= 0) {
        categoryMap[hourData.categoryIndex] = hourData.category;
        
        // Track hours for each category
        if (!categoryHours[hourData.categoryIndex]) {
          categoryHours[hourData.categoryIndex] = 0;
        }
        categoryHours[hourData.categoryIndex] += hourData.minutes / 60; // Convert minutes to hours
      }
    });
  });
  
  // Create category labels
  const categoryLabels = Object.entries(categoryMap)
    .map(([categoryIndex, categoryName]) => {
      const index = parseInt(categoryIndex);
      const hours = categoryHours[index] || 0;
      return {
        index,
        name: categoryName,
        hours
      };
    })
    .sort((a, b) => b.hours - a.hours) // Sort by hours (descending)
    .map(({index, name, hours}) => {
      const color = categoryColors[index % categoryColors.length];
      const textColor = isLightColor(color) ? '#000000' : '#ffffff';
      
      return `
        <span class="category-label-pill" 
              style="background-color: ${color}; color: ${textColor};">
          ${index + 1} - ${name} (${hours.toFixed(1)}h)
        </span>
      `;
    }).join('');
  
  // Create the day names header
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Build table HTML
  let tableHtml = `
    <div class="category-labels mb-2">
      ${categoryLabels}
    </div>
    <div class="heatmap-wrapper">
      <table class="heatmap-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Day</th>
            ${Array.from({ length: 24 }).map((_, i) => 
              `<th>${i}</th>`
            ).join('')}
          </tr>
        </thead>
        <tbody>
  `;
  
  // Add rows for each date
  dates.forEach(day => {
    tableHtml += `
      <tr>
        <td>${formatDisplayDate(day.date)}</td>
        <td>${dayNames[day.dayOfWeek]}</td>
    `;
    
    // Add cells for each hour
    day.hours.forEach(hourData => {
      const cellColor = hourData.categoryIndex >= 0 ? 
        categoryColors[hourData.categoryIndex % categoryColors.length] : 
        '#f2f2f2'; // Default light gray for no events
      
      // Adjust text color for readability (white on dark cells, black on light cells)
      const textColor = isLightColor(cellColor) ? '#000000' : '#ffffff';
      
      // Calculate opacity based on minutes (30 minutes = full opacity)
      const opacity = Math.min(1, hourData.minutes / 30);
      
      // Format cell with style
      tableHtml += `
        <td class="heatmap-cell" 
            style="background-color: ${cellColor}; opacity: ${opacity}; color: ${textColor};" 
            title="${hourData.category || 'No events'}: ${Math.round(hourData.minutes)} minutes, ${hourData.count} event(s)">
          ${hourData.count > 0 ? 
            `<span class="heatmap-value">${hourData.categoryIndex + 1}</span>` : ''}
        </td>
      `;
    });
    
    tableHtml += '</tr>';
  });
  
  tableHtml += `
        </tbody>
      </table>
    </div>
    <div class="heatmap-legend mt-3">
      <p class="text-xs text-muted-foreground">Numbers represent category ID - opacity indicates time intensity</p>
    </div>
  `;
  
  return tableHtml;
}

// Helper function to format date as YYYY-MM-DD
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to format date for display (MM/DD/YYYY)
function formatDisplayDate(dateStr) {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}/${date.getFullYear()}`;
}

// Helper function to determine if a color is light or dark
function isLightColor(color) {
  // Convert hex to RGB
  let r, g, b;
  
  if (color.startsWith('#')) {
    const hex = color.substring(1);
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (color.startsWith('rgb')) {
    const rgb = color.match(/\d+/g);
    r = parseInt(rgb[0]);
    g = parseInt(rgb[1]);
    b = parseInt(rgb[2]);
  } else {
    return true; // Default to "light" if color format is unknown
  }
  
  // Calculate luminance (perceived brightness)
  // Using the formula from WCAG 2.0
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true for light colors, false for dark
  return luminance > 0.5;
} 