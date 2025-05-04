document.addEventListener('DOMContentLoaded', () => {
  // Initialize the app
  initApp();
});

// Global variable to store the parsed CSV data
let allCsvData = [];
// Global variable to store the cleanup rules
let normalizationRules = {};

// Initialize the application
function initApp() {
  const app = document.getElementById('app');

  // Fetch the HTML template
  fetch('templates/app-template.html')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load template');
      }
      return response.text();
    })
    .then(template => {
      // Set the template HTML
      app.innerHTML = template;
      
      // Load the heatmap.js script
      const heatmapScript = document.createElement('script');
      heatmapScript.src = 'heatmap.js';
      document.head.appendChild(heatmapScript);
      
      // Initialize event listeners
      initEventListeners();
    })
    .catch(error => {
      console.error('Error loading template:', error);
      app.innerHTML = '<div class="error">Failed to load application. Please try again.</div>';
    });
}

// Initialize all event listeners
function initEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // File upload via click
  const fileInput = document.getElementById('file-input');
  const uploadArea = document.getElementById('upload-area');
  const clearFilesBtn = document.querySelector('#clear-files button');
  
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', handleFileUpload);
  
  // Clear files button
  clearFilesBtn.addEventListener('click', () => {
    allCsvData = [];
    document.getElementById('file-info').innerHTML = '';
    document.getElementById('clear-files').style.display = 'none';
    document.getElementById('unique-events-table').innerHTML = '<p class="text-muted-foreground">Upload CSV files to see unique events</p>';
    fileInput.value = '';
  });
  
  // Export to PDF button
  document.getElementById('export-pdf').addEventListener('click', exportStatsToPdf);
  
  // Export to PNG button
  document.getElementById('export-png').addEventListener('click', exportStatsToPng);
  
  // File upload via drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('border-primary');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('border-primary');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('border-primary');
    
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileUpload({ target: fileInput });
    }
  });
  
  // Test normalization rules button
  document.getElementById('test-normalization').addEventListener('click', testNormalization);
  
  // Apply cleanup rules button
  document.getElementById('apply-normalization').addEventListener('click', applyNormalization);
  
  // Save rules on textarea input
  const rulesTextarea = document.getElementById('normalization-rules');
  rulesTextarea.addEventListener('input', saveNormalizationRules);
  
  // Load saved cleanup rules if they exist
  chrome.storage.local.get(['normalizationRulesText', 'normalizationRules'], (data) => {
    console.log('Loading rules from storage:', data);
    
    // Prefer the raw text format if available
    if (data.normalizationRulesText) {
      document.getElementById('normalization-rules').value = data.normalizationRulesText;
      
      // Also parse the rules
      const rules = [];
      data.normalizationRulesText.split('\n').forEach(line => {
        if (!line.trim()) return;
        
        if (line.includes('=>')) {
          const [original, normalized] = line.split('=>').map(s => s.trim());
          if (original && normalized) {
            rules.push({
              pattern: original,
              normalized: normalized
            });
          }
        } else if (line.includes('<=')) {
          const [normalized, patterns] = line.split('<=').map(s => s.trim());
          if (normalized && patterns) {
            patterns.split(',').forEach(pattern => {
              const trimmedPattern = pattern.trim();
              if (trimmedPattern) {
                rules.push({
                  pattern: trimmedPattern,
                  normalized: normalized
                });
              }
            });
          }
        }
      });
      
      normalizationRules = rules;
    } 
    // Fall back to the old format if raw text is not available
    else if (data.normalizationRules) {
      document.getElementById('normalization-rules').value = Object.entries(data.normalizationRules)
        .map(([key, value]) => `${key}=>${value}`)
        .join('\n');
      
      // Convert to our internal rules format
      const rules = [];
      Object.entries(data.normalizationRules).forEach(([key, value]) => {
        rules.push({
          pattern: key,
          normalized: value
        });
      });
      
      normalizationRules = rules;
    }
  });

  // --- About Me Section --- 
  const aboutMeDisplay = document.getElementById('about-me-display');
  const aboutMeInput = document.getElementById('about-me-input');

  // Load saved notes
  chrome.storage.local.get(['aboutMeNotes'], (data) => {
    if (data.aboutMeNotes) {
      aboutMeDisplay.textContent = data.aboutMeNotes;
      aboutMeInput.value = data.aboutMeNotes;
      // Remove placeholder style if text exists
      aboutMeDisplay.classList.remove('text-muted-foreground');
    } else {
      aboutMeDisplay.textContent = 'Click to edit notes...';
      aboutMeDisplay.classList.add('text-muted-foreground');
    }
  });

  // Show textarea on click
  aboutMeDisplay.addEventListener('click', () => {
    aboutMeDisplay.style.display = 'none';
    aboutMeInput.style.display = 'block';
    aboutMeInput.focus();
  });

  // Save and hide textarea on blur
  aboutMeInput.addEventListener('blur', () => {
    const notes = aboutMeInput.value.trim();
    chrome.storage.local.set({ aboutMeNotes: notes });

    aboutMeInput.style.display = 'none';
    aboutMeDisplay.style.display = 'block';
    
    if (notes) {
      aboutMeDisplay.textContent = notes;
      aboutMeDisplay.classList.remove('text-muted-foreground');
    } else {
      aboutMeDisplay.textContent = 'Click to edit notes...';
      aboutMeDisplay.classList.add('text-muted-foreground');
    }
  });
  // --- End About Me Section ---
}

// Save normalization rules on input change
function saveNormalizationRules() {
  const rulesText = document.getElementById('normalization-rules').value;
  console.log("Saving rules:", rulesText); // Debug
  
  // Save the raw text first to preserve format
  chrome.storage.local.set({ normalizationRulesText: rulesText });
  
  const rules = {};
  
  // Parse the rules from the textarea
  rulesText.split('\n').forEach(line => {
    if (!line.trim()) return;
    
    console.log("Processing line:", line); // Debug
    
    if (line.includes('=>')) {
      // Original format: "pattern=>normalized"
      const [original, normalized] = line.split('=>').map(s => s.trim());
      if (original && normalized) {
        rules[original] = normalized;
        console.log(`Added rule: ${original} => ${normalized}`); // Debug
      }
    } else if (line.includes('<=')) {
      // New format: "normalized<=pattern1,pattern2,pattern3"
      const [normalized, patterns] = line.split('<=').map(s => s.trim());
      console.log(`Parsed: normalized=${normalized}, patterns=${patterns}`); // Debug
      
      if (normalized && patterns) {
        // Split the patterns and create a rule for each
        patterns.split(',').forEach(pattern => {
          const trimmedPattern = pattern.trim();
          if (trimmedPattern) {
            rules[trimmedPattern] = normalized;
            console.log(`Added rule: ${trimmedPattern} => ${normalized}`); // Debug
          }
        });
      }
    }
  });
  
  console.log("Final rules object:", rules); // Debug
  
  // Save to chrome storage
  chrome.storage.local.set({ normalizationRules: rules }, function() {
    console.log('Rules saved to storage'); // Debug callback
  });
}

// Switch between tabs
function switchTab(tabName) {
  // Update active tab
  document.querySelectorAll('.tab').forEach(tab => {
    if (tab.getAttribute('data-tab') === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Hide all tab content and show the selected one
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  document.getElementById(`${tabName}-tab`).style.display = 'block';
  
  // If cleanup tab is selected and we have data, update the unique events list
  if (tabName === 'cleanup' && allCsvData.length > 0) {
    updateUniqueEventsTable();
  }

  // If statistics tab is selected and we have data, apply cleanup and update the statistics
  if (tabName === 'statistics' && allCsvData.length > 0) {
    // Apply cleanup rules first (if not already applied)
    if (!allCsvData.some(event => 'NormalizedSummary' in event)) {
      applyNormalization();
    } else {
      // Otherwise just update the statistics
      updateStatistics();
    }
  }
}

// Handle file upload
function handleFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  const fileInfo = document.getElementById('file-info');
  const clearFiles = document.getElementById('clear-files');
  let filesProcessed = 0;
  let totalFiles = files.length;
  let fileInfoHtml = '';
  
  // Create a loading indicator
  fileInfo.innerHTML = `
    <div class="card w-full">
      <div class="card-content">
        <p>Processing ${totalFiles} files...</p>
      </div>
    </div>
  `;
  
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target.result;
      const parsedData = parseCSV(content);
      
      // Add source file name to each row
      parsedData.forEach(row => {
        row.SourceFile = file.name;
      });
      
      // Add to the global CSV data array
      allCsvData = [...allCsvData, ...parsedData];
      
      // Update progress
      filesProcessed++;
      
      // Update the display when all files are processed
      if (filesProcessed === totalFiles) {
        // Build file information
        fileInfoHtml = `
          <div class="card w-full">
            <div class="card-content">
              <h3>Files loaded: <strong>${totalFiles}</strong></h3>
              <p>Total events: <strong>${allCsvData.length}</strong></p>
              <div class="mt-2">
                <ul class="text-sm">
                ${Array.from(files).map(f => `
                  <li class="mb-1">${f.name} - ${allCsvData.filter(row => row.SourceFile === f.name).length} events</li>
                `).join('')}
                </ul>
              </div>
            </div>
          </div>
        `;
        
        // Update UI
        fileInfo.innerHTML = fileInfoHtml;
        clearFiles.style.display = 'block';
        
        // Enable the Cleanup tab
        document.querySelector('[data-tab="normalize"]').classList.remove('disabled');
        
        // Auto-switch to the cleanup tab
        switchTab('normalize');
      }
    };
    
    reader.readAsText(file);
  });
}

// Update the unique events table in the Normalize tab
function updateUniqueEventsTable() {
  if (allCsvData.length === 0) {
    document.getElementById('unique-events-table').innerHTML = '<p class="text-muted-foreground">Upload CSV files to see unique events</p>';
    return;
  }

  // Get current normalization rules
  const rulesText = document.getElementById('normalization-rules').value;
  const rules = [];
  
  // Parse the rules from the textarea
  rulesText.split('\n').forEach(line => {
    if (!line.trim()) return;
    
    if (line.includes('=>')) {
      // Original format: "pattern=>normalized"
      const [original, normalized] = line.split('=>').map(s => s.trim());
      if (original && normalized) {
        rules.push({
          pattern: original,
          normalized: normalized
        });
      }
    } else if (line.includes('<=')) {
      // New format: "normalized<=pattern1,pattern2,pattern3"
      const [normalized, patterns] = line.split('<=').map(s => s.trim());
      if (normalized && patterns) {
        // Split the patterns and create a rule for each
        patterns.split(',').forEach(pattern => {
          const trimmedPattern = pattern.trim();
          if (trimmedPattern) {
            rules.push({
              pattern: trimmedPattern,
              normalized: normalized
            });
          }
        });
      }
    }
  });

  // Count occurrences of each event summary
  const eventCounts = {};
  const eventRules = {}; // Store matching rule for each event
  const eventNormalized = {}; // Store normalized values
  const eventIgnored = {}; // Store whether event is ignored
  
  allCsvData.forEach(event => {
    const summary = (event.Summary || '').toLowerCase();
    if (summary) {
      eventCounts[summary] = (eventCounts[summary] || 0) + 1;
      
      // Find matching rule for this event
      const calendarId = event['Calendar ID'] || '';
      
      for (const rule of rules) {
        if (testRule(rule.pattern, summary, calendarId)) {
          eventRules[summary] = rule.pattern;
          eventNormalized[summary] = rule.normalized;
          // Mark as ignored if normalized name is "IGNORE"
          eventIgnored[summary] = rule.normalized.toUpperCase() === 'IGNORE';
          break;
        }
      }
      
      // If no rule matched
      if (!eventRules[summary]) {
        eventRules[summary] = '-';
        eventNormalized[summary] = summary;
        eventIgnored[summary] = false;
      }
    }
  });

  // Also include calendar IDs in the table
  const calendarCounts = {};
  const calendarRules = {}; // Store matching rule for each calendar
  const calendarNormalized = {}; // Store normalized values
  const calendarIgnored = {}; // Store whether calendar is ignored
  
  allCsvData.forEach(event => {
    const calendarId = event['Calendar ID'] || '';
    if (calendarId) {
      const calKey = `id:${calendarId}`;
      calendarCounts[calKey] = (calendarCounts[calKey] || 0) + 1;
      
      // Find matching rule for this calendar
      for (const rule of rules) {
        if (rule.pattern.toLowerCase() === calKey.toLowerCase()) {
          calendarRules[calKey] = rule.pattern;
          calendarNormalized[calKey] = rule.normalized;
          // Mark as ignored if normalized name is "IGNORE"
          calendarIgnored[calKey] = rule.normalized.toUpperCase() === 'IGNORE';
          break;
        }
      }
      
      // If no rule matched
      if (!calendarRules[calKey]) {
        calendarRules[calKey] = '-';
        calendarNormalized[calKey] = calKey;
        calendarIgnored[calKey] = false;
      }
    }
  });

  // Sort events by occurrence count (descending)
  const sortedEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1]);

  // Sort calendar IDs by occurrence count (descending)
  const sortedCalendars = Object.entries(calendarCounts)
    .sort((a, b) => b[1] - a[1]);

  // Display the events in the UI
  const uniqueEventsElement = document.getElementById('unique-events-table');
  
  if (sortedEvents.length === 0 && sortedCalendars.length === 0) {
    uniqueEventsElement.innerHTML = '<p class="text-muted-foreground">No events found with Summary information</p>';
    return;
  }

  // Get count of ignored events
  const ignoredEventCount = sortedEvents.filter(([name]) => eventIgnored[name]).length;
  const ignoredCalendarCount = sortedCalendars.filter(([id]) => calendarIgnored[id]).length;
  const totalIgnored = ignoredEventCount + ignoredCalendarCount;

  // Create HTML for the unique events table
  uniqueEventsElement.innerHTML = `
    <div class="mb-4 flex justify-between items-center">
      <div>
        <p>Found <strong>${sortedEvents.length}</strong> unique events and <strong>${sortedCalendars.length}</strong> unique calendars</p>
        ${totalIgnored > 0 ? `<p class="text-xs text-muted-foreground">(<strong>${totalIgnored}</strong> will be ignored in statistics)</p>` : ''}
      </div>
      <div class="flex gap-2">
        <button id="toggle-matched" class="button button-secondary">Hide Matched</button>
        <button id="export-events" class="button button-primary">Export</button>
      </div>
    </div>
    <div class="table-wrapper">
      <table class="events-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Count</th>
            <th>Name/ID</th>
            <th>Matching Rule</th>
            <th>Normalized</th>
          </tr>
        </thead>
        <tbody>
          ${sortedEvents.map(([name, count], index) => `
            <tr data-has-rule="${eventRules[name] !== '-' ? 'true' : 'false'}" data-ignored="${eventIgnored[name] ? 'true' : 'false'}">
              <td>${index + 1}</td>
              <td>${count}</td>
              <td><div class="tooltip" data-tooltip="${name}">${name}</div></td>
              <td>${eventRules[name]}</td>
              <td><div class="tooltip" data-tooltip="${eventNormalized[name]}">${eventNormalized[name]}</div></td>
            </tr>
          `).join('')}
          ${sortedCalendars.map(([id, count], index) => `
            <tr data-has-rule="${calendarRules[id] !== '-' ? 'true' : 'false'}" data-ignored="${calendarIgnored[id] ? 'true' : 'false'}">
              <td>${sortedEvents.length + index + 1}</td>
              <td>${count}</td>
              <td><div class="tooltip" data-tooltip="${id}">${id}</div></td>
              <td>${calendarRules[id]}</td>
              <td><div class="tooltip" data-tooltip="${calendarNormalized[id]}">${calendarNormalized[id]}</div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Add click to select all functionality
  const tableWrapper = uniqueEventsElement.querySelector('.table-wrapper');
  tableWrapper.addEventListener('click', () => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(tableWrapper);
    selection.removeAllRanges();
    selection.addRange(range);
  });

  // Export to CSV functionality
  const exportButton = document.getElementById('export-events');
  exportButton.addEventListener('click', () => {
    exportEventsToCsv(allCsvData, eventRules, eventNormalized);
  });

  // Toggle matched/unmatched events
  const toggleButton = document.getElementById('toggle-matched');
  let showingMatched = true; // Default to showing matched items
  
  // Hide matched items by default
  const rows = uniqueEventsElement.querySelectorAll('tbody tr');
  rows.forEach(row => {
    if (row.getAttribute('data-has-rule') === 'true') {
      row.style.display = 'none';
    }
  });
  toggleButton.textContent = 'Show All';
  showingMatched = false;
  
  toggleButton.addEventListener('click', () => {
    const rows = uniqueEventsElement.querySelectorAll('tbody tr');
    
    if (showingMatched) {
      // Hide matched rows
      rows.forEach(row => {
        if (row.getAttribute('data-has-rule') === 'true') {
          row.style.display = 'none';
        }
      });
      toggleButton.textContent = 'Show All';
      showingMatched = false;
    } else {
      // Show all rows
      rows.forEach(row => {
        row.style.display = '';
      });
      toggleButton.textContent = 'Hide Matched';
      showingMatched = true;
    }
  });
}

// Parse CSV content
function parseCSV(content) {
  // First, identify the header row
  const headerEndIndex = content.indexOf('\n');
  if (headerEndIndex === -1) return [];
  
  const headerRow = content.substring(0, headerEndIndex);
  const headers = parseCSVRow(headerRow);
  
  const csvData = [];
  
  // Process the rest of the file character by character
  let currentRow = {};
  let currentField = '';
  let currentColumn = 0;
  let inQuotes = false;
  let i = headerEndIndex + 1; // Start after header row
  
  // Initialize the first row
  headers.forEach(header => {
    currentRow[header] = '';
  });
  
  while (i < content.length) {
    const char = content[i];
    const nextChar = i + 1 < content.length ? content[i + 1] : '';
    
    // Handle quotes (start/end of quoted field or escaped quote)
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote within a quoted field
        currentField += '"';
        i += 2; // Skip the current and the next quote
        continue;
      } else {
        // Start or end of a quoted field
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }
    
    // Handle field separators (comma)
    if (char === ',' && !inQuotes) {
      // End of field, store value in current row
      currentRow[headers[currentColumn]] = currentField.trim();
      currentField = '';
      currentColumn++;
      i++;
      continue;
    }
    
    // Handle row separators (newline) - but only if not in quotes
    if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // End of the current field and row
      currentRow[headers[currentColumn]] = currentField.trim();
      
      // Process dates and add the row to results
      processRowDates(currentRow);
      csvData.push({...currentRow}); // Clone the row to avoid reference issues
      
      // Reset for next row
      currentField = '';
      currentColumn = 0;
      currentRow = {};
      headers.forEach(header => {
        currentRow[header] = '';
      });
      
      // Skip \r\n as a pair
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    
    // Regular character, add to current field
    currentField += char;
    i++;
  }
  
  // Handle the last row if needed
  if (currentField !== '' || currentColumn > 0) {
    currentRow[headers[currentColumn]] = currentField.trim();
    processRowDates(currentRow);
    csvData.push({...currentRow});
  }
  
  return csvData;
}

// Helper function to parse a single CSV row
function parseCSVRow(row) {
  const values = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = i + 1 < row.length ? row[i + 1] : '';
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote within a quoted field
        currentValue += '"';
        i++; // Skip the next quote
      } else {
        // Start or end of a quoted field
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      // Regular character
      currentValue += char;
    }
  }
  
  // Add the last value
  values.push(currentValue.trim());
  
  return values.map(value => value.replace(/^"(.*)"$/, '$1'));
}

// Helper function to process dates in a row
function processRowDates(row) {
  // Parse dates and calculate duration
  if (row['Start'] && row['End']) {
    try {
      const start = new Date(row['Start']);
      const end = new Date(row['End']);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        row['StartDate'] = start;
        row['EndDate'] = end;
        row['Duration'] = (end - start) / (1000 * 60); // Duration in minutes
        row['IsAllDay'] = false;
      }
    } catch (e) {
      console.error('Error parsing dates', e);
    }
  } else if (row['Start Date'] && row['End Date']) {
    try {
      const start = new Date(row['Start Date']);
      const end = new Date(row['End Date']);
      
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        row['StartDate'] = start;
        row['EndDate'] = end;
        row['Duration'] = (end - start) / (1000 * 60 * 60 * 24) * 24 * 60; // Convert to minutes for consistency
        row['IsAllDay'] = true; // Mark as all-day event
      }
    } catch (e) {
      console.error('Error parsing dates', e);
    }
  }
  
  return row;
}

// Test if a rule matches a string
function testRule(rule, string, calendarId) {
  // Handle calendar ID rules
  if (rule.startsWith('id:')) {
    return rule.toLowerCase() === `id:${calendarId.toLowerCase()}`;
  }
  
  const lowerString = string.toLowerCase();
  const lowerRule = rule.toLowerCase();
  
  // Handle special case for prefix patterns (ending with *)
  if (rule.endsWith('*') && rule.indexOf('*') === rule.length - 1) {
    // For patterns like "prefix*", just check if the string starts with "prefix"
    const prefix = lowerRule.substring(0, lowerRule.length - 1);
    return lowerString.startsWith(prefix);
  }
  
  // Handle patterns with wildcards (containing *)
  if (rule.includes('*')) {
    // Convert wildcards to regex and test
    return wildcardToRegExp(lowerRule).test(lowerString);
  }
  
  // Exact match
  return lowerString === lowerRule;
}

// Convert wildcard pattern to RegExp
function wildcardToRegExp(pattern) {
  // Escape special regex characters except * which we'll convert to .*
  const escapedPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*'); // Convert * to .*
  
  return new RegExp(`^${escapedPattern}$`, 'i');
}

// Test normalization rules without applying them permanently
function testNormalization() {
  const rulesText = document.getElementById('normalization-rules').value;
  const rules = [];
  
  // Parse the rules from the textarea
  rulesText.split('\n').forEach(line => {
    if (!line.trim()) return;
    
    if (line.includes('=>')) {
      // Original format: "pattern=>normalized"
      const [original, normalized] = line.split('=>').map(s => s.trim());
      if (original && normalized) {
        rules.push({
          pattern: original,
          normalized: normalized
        });
      }
    } else if (line.includes('<=')) {
      // New format: "normalized<=pattern1,pattern2,pattern3"
      const [normalized, patterns] = line.split('<=').map(s => s.trim());
      if (normalized && patterns) {
        // Split the patterns and create a rule for each
        patterns.split(',').forEach(pattern => {
          const trimmedPattern = pattern.trim();
          if (trimmedPattern) {
            rules.push({
              pattern: trimmedPattern,
              normalized: normalized
            });
          }
        });
      }
    }
  });
  
  if (rules.length === 0) {
    const resultElement = document.getElementById('normalization-result');
    resultElement.innerHTML = `
      <div class="card mt-4">
        <div class="card-content">
          <p class="text-destructive">No valid cleanup rules found</p>
          <p>Please enter rules in one of the supported formats.</p>
        </div>
      </div>
    `;
    return;
  }
  
  // Store the rules temporarily (don't save to storage)
  normalizationRules = rules;
  
  // Clear any previous messages
  document.getElementById('normalization-result').innerHTML = '';
  
  // Show notification
  showNotification('Applied');
  
  // Update the unique events table to show matching rules
  updateUniqueEventsTable();
}

// Helper function to show notifications
function showNotification(message, duration = 3000) {
  // Remove any existing notification
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create new notification
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  
  // Append to body
  document.body.appendChild(notification);
  
  // Trigger animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Auto remove after duration
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, duration);
}

// Apply normalization rules from the textarea
function applyNormalization() {
  const rulesText = document.getElementById('normalization-rules').value;
  const rules = [];
  
  // Parse the rules from the textarea
  rulesText.split('\n').forEach(line => {
    if (!line.trim()) return;
    
    if (line.includes('=>')) {
      // Original format: "pattern=>normalized"
      const [original, normalized] = line.split('=>').map(s => s.trim());
      if (original && normalized) {
        rules.push({
          pattern: original,
          normalized: normalized
        });
      }
    } else if (line.includes('<=')) {
      // New format: "normalized<=pattern1,pattern2,pattern3"
      const [normalized, patterns] = line.split('<=').map(s => s.trim());
      if (normalized && patterns) {
        // Split the patterns and create a rule for each
        patterns.split(',').forEach(pattern => {
          const trimmedPattern = pattern.trim();
          if (trimmedPattern) {
            rules.push({
              pattern: trimmedPattern,
              normalized: normalized
            });
          }
        });
      }
    }
  });
  
  // Store the rules for later use
  normalizationRules = rules;
  
  // Save rules to storage
  const rulesMap = {};
  rules.forEach(rule => {
    rulesMap[rule.pattern] = rule.normalized;
  });
  chrome.storage.local.set({ normalizationRules: rulesMap });
  
  // Apply the rules to the data
  if (allCsvData.length > 0) {
    let normalizedCount = 0;
    
    allCsvData = allCsvData.map(event => {
      const summary = event.Summary || '';
      const calendarId = event['Calendar ID'] || '';
      
      // Try to match each rule against the event summary or calendar ID
      for (const rule of rules) {
        if (testRule(rule.pattern, summary, calendarId)) {
          normalizedCount++;
          return { ...event, NormalizedSummary: rule.normalized };
        }
      }
      
      // If no rule matched, keep the original summary
      return { ...event, NormalizedSummary: summary };
    });
    
    // Show success message
    const resultElement = document.getElementById('normalization-result');
    resultElement.innerHTML = `
      <div class="card mt-4">
        <div class="card-content">
          <p class="text-green-500">Cleanup rules applied successfully!</p>
          <p>Events cleaned: <strong>${normalizedCount}</strong> out of ${allCsvData.length}</p>
        </div>
      </div>
    `;
    
    // Show notification
    showNotification('Applied');
    
    // Enable statistics tab
    document.querySelector('[data-tab="statistics"]').classList.remove('disabled');
    
    // Auto-switch to statistics tab
    switchTab('statistics');
  }
}

// Helper function to format minutes as hours and minutes
function formatMinutes(minutes) {
  if (isNaN(minutes)) return '0 min';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours === 0) {
    return `${mins} min`;
  } else if (mins === 0) {
    return `${hours} hr`;
  } else {
    return `${hours} hr ${mins} min`;
  }
}

// Function to export calendar events to CSV
function exportEventsToCsv(data, eventRules, eventNormalized) {
  // Apply the same filtering as in updateStatistics
  const filteredData = data.filter(event => {
    const normalizedSummary = event.NormalizedSummary?.toUpperCase();
    
    // Skip ignored events
    if (normalizedSummary === 'IGNORE') return false;
    
    // Skip all-day events
    if (event.IsAllDay === true) return false;
    
    // Skip events longer than 20 hours (1200 minutes)
    if (event.Duration && !isNaN(event.Duration) && event.Duration > 1200) return false;
    
    return true;
  });
  
  // Prepare the data for export
  const exportData = filteredData.map(event => {
    const summary = (event.Summary || '').toLowerCase();
    const matchingRule = eventRules[summary] || '-';
    const normalized = eventNormalized[summary] || summary;
    const hours = event.Duration ? (event.Duration / 60).toFixed(1) : '0.0';
    
    // Format the date in YYYY-MM-DD format
    let dateStr = '';
    if (event.StartDate) {
      const date = event.StartDate;
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dateStr = `${year}-${month}-${day}`;
    }
    
    return {
      Date: dateStr,
      Event: event.Summary || '',
      'Matching Rule': matchingRule,
      Normalized: normalized,
      Hours: hours
    };
  });
  
  // Create CSV content
  let csvContent = 'Date,Event,Matching Rule,Normalized,Hours\n';
  
  exportData.forEach(row => {
    // Properly escape fields for CSV
    const escapedRow = [
      escapeCsvField(row.Date),
      escapeCsvField(row.Event),
      escapeCsvField(row['Matching Rule']),
      escapeCsvField(row.Normalized),
      row.Hours
    ];
    
    csvContent += escapedRow.join(',') + '\n';
  });
  
  // Create a download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  // Set up the download link
  link.setAttribute('href', url);
  link.setAttribute('download', 'calendar_events_export.csv');
  link.style.display = 'none';
  
  // Add to the document, trigger download, and clean up
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showNotification('Export completed!');
  }, 100);
}

// Helper function to escape CSV fields
function escapeCsvField(field) {
  if (field === null || field === undefined) return '';
  
  // Convert to string
  const str = String(field);
  
  // If the field contains quotes, commas, or newlines, wrap it in quotes
  // and escape any quotes within it by doubling them
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}

// Update statistics and charts
function updateStatistics() {
  if (allCsvData.length === 0) return;
  
  // Filter out ignored events, all-day events, and events longer than 20 hours
  const filteredData = allCsvData.filter(event => {
    const normalizedSummary = event.NormalizedSummary?.toUpperCase();
    
    // Skip ignored events
    if (normalizedSummary === 'IGNORE') return false;
    
    // Skip all-day events
    if (event.IsAllDay === true) return false;
    
    // Skip events longer than 20 hours (1200 minutes)
    if (event.Duration && !isNaN(event.Duration) && event.Duration > 1200) return false;
    
    return true;
  });
  
  // Count total events (including ignored ones)
  document.getElementById('total-events').textContent = allCsvData.length;
  
  // Show information about filtered events
  const ignoredCount = allCsvData.filter(event => event.NormalizedSummary?.toUpperCase() === 'IGNORE').length;
  const allDayCount = allCsvData.filter(event => event.IsAllDay === true).length;
  const longEventsCount = allCsvData.filter(event => 
    event.Duration && !isNaN(event.Duration) && event.Duration > 1200 && event.IsAllDay !== true
  ).length;
  const totalFilteredOut = allCsvData.length - filteredData.length;
  
  // Count events being analyzed (excluding ignored ones)
  const analyzedEventsElement = document.getElementById('analyzed-events');
  if (analyzedEventsElement) {
    analyzedEventsElement.textContent = filteredData.length;
  }
  
  // Calculate date range (timeframe)
  let earliestDate = null;
  let latestDate = null;
  
  filteredData.forEach(event => {
    if (event.StartDate) {
      if (!earliestDate || event.StartDate < earliestDate) {
        earliestDate = event.StartDate;
      }
      if (!latestDate || event.StartDate > latestDate) {
        latestDate = event.StartDate;
      }
    }
  });
  
  // Format and display the date range
  const dateRangeElement = document.getElementById('date-range');
  if (earliestDate && latestDate) {
    const formatDate = (date) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    };
    
    dateRangeElement.innerHTML = `${formatDate(earliestDate)} - ${formatDate(latestDate)}`;
  } else {
    dateRangeElement.textContent = 'No date range';
  }
  
  // Calculate total duration in hours (excluding ignored ones)
  let totalMinutes = 0;
  let eventCount = 0;
  
  filteredData.forEach(event => {
    if (event.Duration && !isNaN(event.Duration)) {
      totalMinutes += event.Duration;
      eventCount++;
    }
  });
  
  const totalHours = Math.round(totalMinutes / 60);
  
  // Calculate days in range (default to 1 if can't determine)
  let daysInRange = 1;
  if (earliestDate && latestDate) {
    daysInRange = Math.max(1, Math.ceil((latestDate - earliestDate) / (1000 * 60 * 60 * 24)));
  }
  
  const hoursPerDay = daysInRange > 0 ? (totalHours / daysInRange).toFixed(1) : 0;
  document.getElementById('total-hours').textContent = `${totalHours} (${hoursPerDay} per day)`;
  
  // Calculate event frequency and hours per event type (excluding ignored ones)
  const eventStats = {};
  let totalEventMinutes = 0;
  
  // Calculate total minutes for all events first (for percentage calculation)
  filteredData.forEach(event => {
    if (event.Duration && !isNaN(event.Duration)) {
      totalEventMinutes += event.Duration;
    }
  });
  
  // Now calculate stats for each event type
  filteredData.forEach(event => {
    const summary = (event.NormalizedSummary || event.Summary || 'Unknown').toLowerCase();
    
    // Initialize if not exists
    if (!eventStats[summary]) {
      eventStats[summary] = {
        name: summary,
        count: 0,
        totalMinutes: 0,
        dayDistribution: Array(7).fill(0),
        hourDistribution: Array(24).fill(0),
        timelineData: {} // Track time spent over dates
      };
    }
    
    // Increment count
    eventStats[summary].count += 1;
    
    // Add duration if available
    if (event.Duration && !isNaN(event.Duration)) {
      eventStats[summary].totalMinutes += event.Duration;
      
      // Track hours over time
      if (event.StartDate) {
        const dateKey = formatDateKey(event.StartDate);
        if (!eventStats[summary].timelineData[dateKey]) {
          eventStats[summary].timelineData[dateKey] = 0;
        }
        eventStats[summary].timelineData[dateKey] += event.Duration / 60; // Convert to hours
      }
    }
    
    // Add to day and hour distribution if date is available
    if (event.StartDate) {
      const dayOfWeek = event.StartDate.getDay();
      const hour = event.StartDate.getHours();
      eventStats[summary].dayDistribution[dayOfWeek]++;
      eventStats[summary].hourDistribution[hour]++;
    }
  });
  
  // Convert to array and sort by hours (totalMinutes)
  const sortedEventStats = Object.values(eventStats)
    .sort((a, b) => b.totalMinutes - a.totalMinutes); // Sort by hours without limiting to top 10
  
  // Display event frequency table
  const eventFrequencyElement = document.getElementById('event-frequency');
  eventFrequencyElement.innerHTML = `
    <table class="stats-events-table">
      <thead>
        <tr>
          <th class="text-left">Event</th>
          <th class="text-right">Hours</th>
          <th class="text-right">Per Day</th>
          <th class="text-right">Percentage</th>
          <th class="text-right">Number of events</th>
        </tr>
      </thead>
      <tbody>
        ${sortedEventStats.map(event => {
          const hours = event.totalMinutes / 60;
          const perDay = hours / daysInRange;
          const percentage = totalEventMinutes > 0 ? (event.totalMinutes / totalEventMinutes) * 100 : 0;
          
          return `
            <tr>
              <td class="text-left"><strong>${event.name}</strong></td>
              <td class="text-right">${hours.toFixed(1)}</td>
              <td class="text-right">${perDay.toFixed(1)}</td>
              <td class="text-right" style="position: relative;">
                <div style="position: absolute; top: 0; left: 0; bottom: 0; width: ${percentage}%; background-color: rgba(66, 133, 244, 0.15); z-index: 0;"></div>
                <span style="position: relative; z-index: 1;">${percentage.toFixed(1)}%</span>
              </td>
              <td class="text-right">${event.count}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  
  // Take top categories for visualization
  const topEventsByMinutes = sortedEventStats.slice(0, 8);
  
  // Color palette for the categories
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
  
  // Create hours-over-time charts
  const hoursOverTimeElement = document.getElementById('hours-over-time');
  if (hoursOverTimeElement) {
    let hoursOverTimeHTML = '';
    
    // Get the date range from the filtered data
    const dateMap = {};
    filteredData.forEach(event => {
      if (event.StartDate) {
        const dateKey = formatDateKey(event.StartDate);
        dateMap[dateKey] = true;
      }
    });
    
    // Convert to sorted array
    const allDates = Object.keys(dateMap).sort();
    
    // Group dates by week
    const weekDataByCategory = {};
    
    // For each category, group its data by week
    topEventsByMinutes.forEach(eventStat => {
      const weekData = groupByWeek(eventStat.timelineData, allDates);
      weekDataByCategory[eventStat.name] = weekData;
    });
    
    // Find the maximum weekly hours across all categories for consistent scale
    let maxWeeklyHours = 0;
    Object.values(weekDataByCategory).forEach(weekData => {
      const categoryMax = Math.max(...Object.values(weekData));
      if (categoryMax > maxWeeklyHours) {
        maxWeeklyHours = categoryMax;
      }
    });
    
    // If maxWeeklyHours is zero, set a default minimum
    if (maxWeeklyHours === 0) {
      maxWeeklyHours = 1;
    }
    
    // Generate HTML for all categories
    topEventsByMinutes.forEach((eventStat, index) => {
      const weekData = weekDataByCategory[eventStat.name];
      if (Object.keys(weekData).length > 0) {
        hoursOverTimeHTML += `
          <div class="category-chart">
            <div class="category-name">
              <span class="category-label">${eventStat.name}</span>
              <span class="category-stats">${(eventStat.totalMinutes / 60).toFixed(1)}h total</span>
            </div>
            <div class="time-distribution-chart">
              <div class="chart-row single-category">
                <div class="chart-area-container hours-over-time">
                  <div class="chart-area" 
                       style="background-color: ${categoryColors[index % categoryColors.length]}; 
                              opacity: 0.8;">
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });
    
    hoursOverTimeElement.innerHTML = hoursOverTimeHTML || '<p class="text-muted-foreground">No hours over time data available</p>';
    
    // Create the timeline charts for each category
    document.querySelectorAll('#hours-over-time .category-chart').forEach((chartElement, index) => {
      const eventStat = topEventsByMinutes[index];
      if (!eventStat) return;
      
      const chartArea = chartElement.querySelector('.chart-area');
      if (!chartArea) return;
      
      const weekData = weekDataByCategory[eventStat.name];
      const weekValues = Object.values(weekData);
      
      // Use the same scale for all categories
      const normalizedValues = weekValues.map(value => 
        100 - (value / maxWeeklyHours * 70) // Invert and scale to keep waves visible
      );
      
      // Create polygon points with a smooth wave-like pattern
      let points = [];
      
      // Start and end at the bottom
      points.push('0 100%');
      
      // Add points for each week
      const weekCount = weekValues.length;
      const step = weekCount > 1 ? 100 / (weekCount - 1) : 100;
      
      weekValues.forEach((value, i) => {
        const x = i * step;
        const y = normalizedValues[i];
        points.push(`${x}% ${y}%`);
      });
      
      // End at the right bottom
      points.push('100% 100%');
      
      // Apply the custom polygon
      chartArea.style.clipPath = `polygon(${points.join(', ')})`;
    });
  }

  // Generate time heatmap if the function exists
  const timeHeatmapElement = document.getElementById('time-heatmap');
  if (timeHeatmapElement && typeof generateTimeHeatmap === 'function') {
    generateTimeHeatmap(filteredData, timeHeatmapElement);
  } else if (timeHeatmapElement) {
    // If the heatmap.js is not loaded yet, try again in a moment
    setTimeout(() => {
      if (typeof generateTimeHeatmap === 'function') {
        generateTimeHeatmap(filteredData, timeHeatmapElement);
      } else {
        timeHeatmapElement.innerHTML = '<p class="text-muted-foreground">Time heatmap functionality not available</p>';
      }
    }, 1000);
  }
}

// Helper function to format date as YYYY-MM-DD
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to get the week number
function getWeekNumber(dateStr) {
  const date = new Date(dateStr);
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// Helper function to group data by week
function groupByWeek(timelineData, allDates) {
  const weekData = {};
  
  // Process all dates to group by week
  allDates.forEach(dateStr => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const weekNum = getWeekNumber(dateStr);
    const weekKey = `W${weekNum}`;
    
    if (!weekData[weekKey]) {
      weekData[weekKey] = 0;
    }
    
    // Add hours for this date to the week total
    weekData[weekKey] += timelineData[dateStr] || 0;
  });
  
  return weekData;
}

// Export statistics to PDF
function exportStatsToPdf() {
  // Show loading notification
  showNotification('Preparing PDF export...', 2000);
  
  // Get the statistics tab content
  const statsTab = document.getElementById('statistics-tab');
  
  // Create a clone of the statistics tab to modify for PDF
  const statsClone = statsTab.cloneNode(true);
  
  // Remove the export button from the clone (we don't need it in the PDF)
  const exportButtonDiv = statsClone.querySelector('.mb-4.text-right');
  if (exportButtonDiv) {
    exportButtonDiv.remove();
  }
  
  // Create a container with some styling for better PDF output
  const container = document.createElement('div');
  container.style.padding = '20px';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.appendChild(statsClone);
  
  // Set PDF export options
  const opt = {
    margin: [5, 5, 5, 5],
    filename: 'calendar-statistics.pdf',
    image: { type: 'png', quality: 1.0 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: false
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  // Generate the PDF
  html2pdf()
    .set(opt)
    .from(container)
    .save()
    .then(() => {
      // Show success notification
      showNotification('PDF export complete!');
    })
    .catch(error => {
      console.error('PDF export error:', error);
      showNotification('Error exporting PDF', 5000);
    });
}

// Export statistics to PNG
function exportStatsToPng() {
  // Show loading notification
  showNotification('Preparing PNG export...', 2000);
  
  // Get the statistics tab content directly
  const statsTab = document.getElementById('statistics-tab');
  
  // Temporarily hide the export buttons for cleaner screenshot
  const exportButtonDiv = statsTab.querySelector('.mb-4.text-right');
  const originalDisplay = exportButtonDiv ? exportButtonDiv.style.display : 'block';
  if (exportButtonDiv) {
    exportButtonDiv.style.display = 'none';
  }
  
  // Create a temporary wrapper with padding to add margins
  const wrapper = document.createElement('div');
  wrapper.style.padding = '20px';
  wrapper.style.backgroundColor = '#ffffff';
  
  // Clone the statsTab to avoid removing it from the DOM
  const statsClone = statsTab.cloneNode(true);
  wrapper.appendChild(statsClone);
  
  // Temporarily add the wrapper to the body but make it invisible
  wrapper.style.position = 'absolute';
  wrapper.style.left = '-9999px';
  document.body.appendChild(wrapper);
  
  // Set PNG export options
  const opt = {
    scale: 2,
    useCORS: true,
    logging: true,
    allowTaint: true,
    backgroundColor: '#ffffff'
  };
  
  // Generate the PNG
  html2canvas(wrapper, opt)
    .then(canvas => {
      // Restore the export buttons display
      if (exportButtonDiv) {
        exportButtonDiv.style.display = originalDisplay;
      }
      
      // Remove the temporary wrapper
      document.body.removeChild(wrapper);
      
      // Convert canvas to image
      const image = canvas.toDataURL('image/png');
      
      // Create a download link
      const link = document.createElement('a');
      link.setAttribute('href', image);
      link.setAttribute('download', 'calendar-statistics.png');
      link.style.display = 'none';
      
      // Add to the document, trigger download, and clean up
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        showNotification('PNG export completed!');
      }, 100);
    })
    .catch(error => {
      // Restore the export buttons display
      if (exportButtonDiv) {
        exportButtonDiv.style.display = originalDisplay;
      }
      
      // Remove the temporary wrapper if it exists
      if (document.body.contains(wrapper)) {
        document.body.removeChild(wrapper);
      }
      
      console.error('PNG export error:', error);
      showNotification('Error exporting PNG', 5000);
    });
} 