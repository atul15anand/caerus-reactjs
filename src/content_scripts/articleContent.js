/* eslint-disable no-undef */

function getMessage(request, sender, sendResponse) {
  if(!request.url === window.location.href){
    return;
  }
}

chrome.runtime.onMessage.addListener(getMessage);

window.onload = function() {
  const rootElement = document.documentElement;

  const pageText = rootElement.innerText || rootElement.textContent;
  const isConnectionSecure = pageText.includes("Checking if the site connection is secure");
  let timeoutValue = 0;

  if (isConnectionSecure) {
    const buttonElement = document.querySelector('button'); // Modify the selector as needed
    if (buttonElement) {
      buttonElement.click();
    }

    const checkboxElement = document.querySelector('input[type="hidden"][name="cf-turnstile-response"]');// Modify the selector as needed
    if (checkboxElement) {
      checkboxElement.checked = true;
    }
    timeoutValue = 15000; // 15 seconds
  }
  
  setTimeout(() => {
      const content = {
        html: document.documentElement.outerHTML,
        link: window.location.href
      };

      console.log("CONTENT IS :", content);
  
    chrome.runtime.sendMessage({ action: "sendInfoFromArticle", data: content, url: window.location.href });
  }, timeoutValue);
};
