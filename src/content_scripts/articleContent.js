/* eslint-disable no-undef */
function getMessage(request, sender, sendResponse) {
  if(!request.url === window.location.href){
    return;
  }
  if (request.action === "storeRssSourceNotFound") {
    let rss_sources_url = localStorage.getItem("rss_sources_url") ? JSON.parse(localStorage.getItem("rss_sources_url")) : [];
    const rssSourceUrl = request.data;
    if(!rss_sources_url.includes(rssSourceUrl)){
      rss_sources_url.push(rssSourceUrl);
      localStorage.setItem("rss_sources_url", JSON.stringify(rss_sources_url));
    }
    addMessageToDOM("Rss Source not found." + "Add "+ rssSourceUrl, "red");

    return "Returned"
  }
  else if(request.action === "storeConfirmedUrl") {
    const storedLinksData = JSON.parse(localStorage.getItem('articleLinksData')) || [];
    const urlToStore = request.url.replace('?flagToClose=true', '');
    if (!storedLinksData.includes(urlToStore)) {
      const updatedLinksData = [...storedLinksData, urlToStore];
      localStorage.setItem('articleLinksData', JSON.stringify(updatedLinksData));
    }
    if(request.message) {
      addMessageToDOM("Synced Successfully", "green");
    }
    sendResponse({ success: true });
  }
  else if(request.action === "dataMissingMessage") {
    let emptyKey = Object.keys(request.data).filter(key => (request.data[key] === "" || request.data[key] == null));
    let msg = emptyKey + " missing, request cannot be processed"
    addMessageToDOM(msg, "red");
  }
  else if (request.action === "cookieMissingError") {
    addMessageToDOM("You need to login in https://news.almaconnect.com.", "red");
  }
  else if(request.action = "duplicateData"){
    addMessageToDOM("News article already processed", "red");
    sendResponse({ success: true });
  }
}

function addMessageToDOM(message, color) {
  const headline_element = (window.location.href.includes("/inno/")) ? document.getElementById("navAccountDropdownDesktop") : document.getElementById('MarketNav');
  let newElement = document.createElement('div');
  newElement.innerHTML = message;
  newElement.style.color= color;
  newElement.style.fontSize = "20px";
  newElement.style.fontWeight = "700";
  newElement.style.position = "absolute";
  newElement.style.right = "350px";
  newElement.style.zIndex = "100";
  let parentElement = headline_element.parentNode;
  parentElement.insertBefore(newElement, headline_element);
}
chrome.runtime.onMessage.addListener(getMessage);

window.onload = function() {

  const article_url_info = document.querySelector('link[rel="canonical"]');
  const article_url = article_url_info ? article_url_info.href : null;

  const rss_source = document.querySelector('link[rel="alternate"][type="application/rss+xml"]');
  const alter_rss = "http://feeds.bizjournals.com/bizj_"+ document.querySelector('[name=market]').content;
  let rss_source_link = rss_source ? rss_source.href.replace(/^https:\/\//i, "http://") : alter_rss;

  const date = document.querySelector('meta[name="publish-date"]');
  const dateContent = date ? date.getAttribute("content") : null;

  let article_content, headlineText, image_url, baseUrl;
  baseUrl = "bizjournals.com";

  let link = window.location.href;
  if(link.includes("/inno/")) {
    console.log("we are inside inno");
    let headline = document.getElementsByTagName("h1")[0];
    headlineText = headline ? headline.innerHTML : "";

    let article_content_list = document.getElementsByClassName("article-content-item--paragraph");
    let article_data = null;
    for(let i=0; i< article_content_list.length; i++){
      article_data += article_content_list[0];
    }
    article_content = article_data;

    const image_data = document.getElementsByTagName("img")[0];
    image_url = image_data ? image_data.src : null;
  }
  else {
    const headline = document.querySelector(".detail__headline");
    headlineText = headline ? headline.innerText : (document.querySelector('meta[name="ta:title"]').getAttribute('content') || "")

    const content1 = document.getElementsByClassName("content")[0];
    const content2 = document.getElementsByClassName("content")[2];
    const contentText1 = content1 ? content1.innerText : "";
    const contentText2 = content2 ? content2.innerText : "";
    article_content = contentText1 + contentText2;

    // getting image url from thumbnail
    const image_data = document.querySelector('meta[property="og:image:secure_url"]');
    image_url = image_data ? image_data.content : null;
  }

  const content = {
    rss_source_url: rss_source_link,
    article_url: article_url,
    article_content: article_content,
    image_url: image_url,
    source: baseUrl,
    published_at: dateContent,
    title: headlineText.trim(),
    link: link
  };

  const data = {
    content: content,
  };

  // Send the message to the background script
  chrome.runtime.sendMessage({ action: "sendContentFromUrls", data: data, url: window.location.href });

};
