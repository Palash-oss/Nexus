/**
 * A lightweight page content extractor that mimics basic Readability behavior.
 */
export function extractMainContent(doc) {
  // Clone the document body to avoid modifying the active DOM page
  const bodyClone = doc.body.cloneNode(true);

  // Tags to completely remove from consideration
  const removeSelectors = [
    'script', 'style', 'nav', 'footer', 'header', 'aside', 
    'iframe', 'noscript', 'canvas', 'svg', 'form', 'button'
  ];

  removeSelectors.forEach(selector => {
    const elements = bodyClone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Try to find the main content element
  const mainSelectors = ['article', 'main', '[role="main"]'];
  let mainElement = null;

  for (const selector of mainSelectors) {
    const found = bodyClone.querySelector(selector);
    if (found) {
      mainElement = found;
      break;
    }
  }

  // Fallback to the whole cleaned body if no semantic main section is found
  if (!mainElement) {
    mainElement = bodyClone;
  }

  // Get raw text content, strip HTML tags, collapse whitespace, truncate
  const rawText = mainElement.textContent || mainElement.innerText || '';
  const collapsedText = rawText
    .replace(/\s+/g, ' ')
    .trim();

  return collapsedText.substring(0, 3000);
}
