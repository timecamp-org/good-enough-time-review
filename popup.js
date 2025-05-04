document.addEventListener('DOMContentLoaded', () => {
  // Initialize the app
  initApp();
});

// Global variable to store the parsed CSV data
let allCsvData = [];
// Global variable to store the normalization rules
let normalizationRules = {};

// Initialize the application
function initApp() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="">
      <div class="card-header">
        <h1 class="card-title">Calendar Events Analyzer</h1>
        <p class="card-description">Upload CSV files to analyze your calendar events</p>
      </div>
      <div class="card-content">
        <div class="tabs mb-4">
          <div class="tab active" data-tab="upload">Upload</div>
          <div class="tab" data-tab="normalize">Normalize</div>
          <div class="tab" data-tab="statistics">Statistics</div>
        </div>
        
        <div id="upload-tab" class="tab-content">
          <div class="upload-area" id="upload-area">
            <p>Drag and drop your CSV files here or click to browse</p>
            <p class="text-xs text-muted-foreground">You can select multiple files</p>
            <input type="file" id="file-input" accept=".csv" multiple style="display: none;" />
          </div>
          <div id="file-info" class="mt-4"></div>
          <div id="clear-files" class="mt-4" style="display: none;">
            <button class="button button-secondary">Clear Files</button>
          </div>
        </div>
        
        <div id="normalize-tab" class="tab-content" style="display: none;">
          <div class="mb-4">
            <label class="label" for="normalization-rules">Event Name Normalization Rules</label>
            <p class="text-xs text-muted-foreground mb-2">Support two formats:</p>
            <p class="text-xs text-muted-foreground mb-2">1. "Original Event Name=>Normalized Name" - maps a pattern to a name</p>
            <p class="text-xs text-muted-foreground mb-2">2. "Normalized Name<=pattern1,pattern2,pattern3" - maps multiple patterns to one name</p>
            <p class="text-xs text-muted-foreground mb-2">You can use * as wildcard: "*meeting*=>Meeting" or match by calendar ID: "id:email@example.com=>Work"</p>
            <p class="text-xs text-muted-foreground mb-2">Use <strong>IGNORE</strong> as the normalized name to exclude events from statistics: "*standup*=>IGNORE"</p>
            <textarea id="normalization-rules" class="textarea" placeholder="*meeting*=>Meeting&#10;One-on-One<=*1:1*,*one on one*&#10;id:personal@gmail.com=>Personal&#10;IGNORE<=*standup*,*status update*"></textarea>
          </div>
          <div class="mb-4 flex gap-2">
            <button id="test-normalization" class="button button-secondary">Test Rules</button>
            <button id="apply-normalization" class="button button-primary">Apply Normalization</button>
          </div>
          <div id="normalization-result" class="mt-4"></div>
          
          <div class="card mt-4">
            <div class="card-content">
              <div id="unique-events-table" class="unique-events-table">
                <p class="text-muted-foreground">Upload CSV files to see unique events</p>
              </div>
            </div>
          </div>
        </div>
        
        <div id="statistics-tab" class="tab-content" style="display: none;">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="stat-card">
              <h3>Total Events</h3>
              <div id="total-events" class="stat-value">0</div>
            </div>
            <div class="stat-card">
              <h3>Unique Event Types</h3>
              <div id="unique-events" class="stat-value">0</div>
            </div>
            <div class="stat-card">
              <h3>Total Hours</h3>
              <div id="total-hours" class="stat-value">0</div>
            </div>
            <div class="stat-card">
              <h3>Average Event Duration</h3>
              <div id="avg-duration" class="stat-value">0 min</div>
            </div>
          </div>
          
          <div class="card mb-4">
            <div class="card-header">
              <h3 class="card-title">Most Common Events</h3>
            </div>
            <div class="card-content">
              <div id="event-frequency"></div>
            </div>
          </div>
          
          <div class="card mb-4">
            <div class="card-header">
              <h3 class="card-title">Time Distribution by Day</h3>
            </div>
            <div class="card-content">
              <div id="day-distribution" class="chart-container"></div>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Time Distribution by Hour</h3>
            </div>
            <div class="card-content">
              <div id="hour-distribution" class="chart-container"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize event listeners
  initEventListeners();
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
  
  // Apply normalization rules button
  document.getElementById('apply-normalization').addEventListener('click', applyNormalization);
  
  // Save rules on textarea input
  const rulesTextarea = document.getElementById('normalization-rules');
  rulesTextarea.addEventListener('input', saveNormalizationRules);
  
  // Load saved normalization rules if they exist
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
  
  // If normalize tab is selected and we have data, update the unique events list
  if (tabName === 'normalize' && allCsvData.length > 0) {
    updateUniqueEventsTable();
  }

  // If statistics tab is selected and we have data, update the statistics
  if (tabName === 'statistics' && allCsvData.length > 0) {
    updateStatistics();
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
        
        // Enable the Normalize tab
        document.querySelector('[data-tab="normalize"]').classList.remove('disabled');
        
        // Auto-switch to the normalize tab
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
      <div>
        <button id="toggle-matched" class="button button-secondary">Hide Matched</button>
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
        row['Duration'] = (end - start) / (1000 * 60 * 60 * 24); // Duration in days for all-day events
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
          <p class="text-destructive">No valid normalization rules found</p>
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
          <p class="text-green-500">Normalization rules applied successfully!</p>
          <p>Events normalized: <strong>${normalizedCount}</strong> out of ${allCsvData.length}</p>
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

// Update statistics and charts
function updateStatistics() {
  if (allCsvData.length === 0) return;
  
  // Filter out ignored events
  const filteredData = allCsvData.filter(event => {
    const normalizedSummary = event.NormalizedSummary?.toUpperCase();
    return normalizedSummary !== 'IGNORE';
  });
  
  // Count total events (including ignored ones)
  document.getElementById('total-events').textContent = allCsvData.length;
  
  // Count events being analyzed (excluding ignored ones)
  const analyzedEventsElement = document.getElementById('analyzed-events');
  if (analyzedEventsElement) {
    analyzedEventsElement.textContent = filteredData.length;
  }
  
  // Count unique event types (excluding ignored ones)
  const eventTypes = new Set();
  filteredData.forEach(event => {
    const summary = event.NormalizedSummary || event.Summary || '';
    if (summary) eventTypes.add(summary.toLowerCase());
  });
  document.getElementById('unique-events').textContent = eventTypes.size;
  
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
  document.getElementById('total-hours').textContent = totalHours;
  
  // Calculate average event duration (excluding ignored ones)
  const avgDuration = eventCount > 0 ? totalMinutes / eventCount : 0;
  document.getElementById('avg-duration').textContent = formatMinutes(avgDuration);
  
  // Calculate event frequency (excluding ignored ones)
  const eventFrequency = {};
  filteredData.forEach(event => {
    const summary = (event.NormalizedSummary || event.Summary || 'Unknown').toLowerCase();
    eventFrequency[summary] = (eventFrequency[summary] || 0) + 1;
  });
  
  // Sort by frequency
  const sortedEvents = Object.entries(eventFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  // Display event frequency
  const eventFrequencyElement = document.getElementById('event-frequency');
  eventFrequencyElement.innerHTML = `
    <ul class="space-y-2">
      ${sortedEvents.map(([name, count]) => `
        <li class="flex justify-between">
          <span class="truncate mr-4">${name}</span>
          <span class="font-bold">${count}</span>
        </li>
      `).join('')}
    </ul>
  `;
  
  // Create a bar chart for day distribution (excluding ignored ones)
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayDistribution = Array(7).fill(0);
  
  filteredData.forEach(event => {
    if (event.StartDate) {
      const dayOfWeek = event.StartDate.getDay();
      dayDistribution[dayOfWeek]++;
    }
  });
  
  // Create the day distribution chart
  const dayDistributionElement = document.getElementById('day-distribution');
  const maxDayValue = Math.max(...dayDistribution);
  
  dayDistributionElement.innerHTML = `
    <div class="flex h-48 items-end space-x-2">
      ${dayDistribution.map((count, index) => `
        <div class="flex flex-col items-center flex-1">
          <div class="w-full bg-primary rounded-t" style="height: ${maxDayValue > 0 ? (count / maxDayValue) * 100 : 0}%"></div>
          <div class="text-xs mt-1">${daysOfWeek[index].slice(0, 3)}</div>
          <div class="text-xs text-muted-foreground">${count}</div>
        </div>
      `).join('')}
    </div>
  `;
  
  // Create a bar chart for hour distribution (excluding ignored ones)
  const hourDistribution = Array(24).fill(0);
  
  filteredData.forEach(event => {
    if (event.StartDate) {
      const hour = event.StartDate.getHours();
      hourDistribution[hour]++;
    }
  });
  
  // Create the hour distribution chart
  const hourDistributionElement = document.getElementById('hour-distribution');
  const maxHourValue = Math.max(...hourDistribution);
  
  hourDistributionElement.innerHTML = `
    <div class="flex h-48 items-end space-x-1">
      ${hourDistribution.map((count, index) => `
        <div class="flex flex-col items-center flex-1">
          <div class="w-full bg-primary rounded-t" style="height: ${maxHourValue > 0 ? (count / maxHourValue) * 100 : 0}%"></div>
          <div class="text-xs mt-1">${index}</div>
          <div class="text-xs text-muted-foreground">${count}</div>
        </div>
      `).join('')}
    </div>
  `;
} 