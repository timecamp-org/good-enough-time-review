// Open the app in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'index.html' });
}); 