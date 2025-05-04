# Calendar Events Analyzer

A Chrome extension for uploading, normalizing, and analyzing calendar event data from CSV files.

## Overview

Calendar Events Analyzer helps you gain insights from your calendar by:
- Importing calendar events from CSV files
- Cleaning up and normalizing event names
- Generating statistics and visualizations
- Identifying patterns in your calendar usage

## Features

- **CSV Import**: Upload any number of calendar CSV files
- **Event Normalization**: Create rules to clean up and standardize event names
- **Analytics Dashboard**: View charts showing event distribution by day and hour
- **Event Statistics**: See which events take up most of your time
- **Data Export**: Export cleaned data for further analysis

## How to Use

1. Click on the extension icon to open the popup
2. Upload your calendar CSV files by dragging them or clicking the upload area
3. Create normalization rules to clean up your event names
4. Apply the rules and view statistics
5. Export normalized data if needed

## Normalization Rules

Rules can be specified in two formats:
- `pattern=>normalized` - Maps a specific pattern to a normalized name
- `normalized<=pattern1,pattern2,pattern3` - Maps multiple patterns to a single normalized name

Special features:
- Use `*` as a wildcard in patterns
- Use `id:calendar-id` to match specific calendars
- Use `IGNORE` as the normalized name to exclude events from statistics

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation

1. Download the latest release
2. Extract the zip file
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the extracted folder

## Development

### Building the Extension

To create a distributable package:

```bash
zip -r calendar-events-analyzer.zip manifest.json popup.html popup.js styles.css images/ templates/ background.js
```

### Project Structure

- `manifest.json` - Extension configuration
- `popup.html` - Main popup interface
- `popup.js` - Core functionality
- `styles.css` - Styling
- `images/` - Extension icons
- `templates/` - HTML templates

## License

GNU General Public License (GPL)