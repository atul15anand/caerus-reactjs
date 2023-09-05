/* eslint-disable no-undef */
function buildQuery(link_data) {
  switch (link_data.query_selector) {
    case "class":
      return document.getElementsByClassName(link_data.query_value)[link_data.token_number]
    case "tag":
      return document.getElementsByTagName(link_data.query_value)[link_data.token_number]
    case "id":
      return document.getElementById(link_data.query_value)  
    case "querySelector":
      return document.querySelector(link_data.query_value);
    case "querySelectorAll":
      return document.querySelectorAll(link_data.query_value);
  }
}

function getMessage(request, sender, sendResponse) {

  if (request.action === "getLinks") {
    const storedUrlsData = JSON.parse(localStorage.getItem("articleLinksData")) || [];
    const linksData = getArticleLinks().filter(link => !storedUrlsData.includes(link));
    sendResponse({ links: linksData });
  }
  else if(request.action === "clearConfirmedUrls"){
    let updatedLinksData = [];
    localStorage.setItem("articleLinksData", JSON.stringify(updatedLinksData));
    localStorage.setItem("rss_sources_url", JSON.stringify(updatedLinksData));
  }
  else if(request.action === "fetchRssSources") {
    const storedRssData = JSON.parse(localStorage.getItem("rss_sources_url")) || [];
    const storedUrlsData = JSON.parse(localStorage.getItem("articleLinksData")) || [];
    sendResponse({data: storedRssData});
  }
}

function getArticleLinks() {
  const links = Array.from(
    new Set(Array.from(document.querySelectorAll("a")).map((x) => x.href))
  ).filter((cleanlink) => cleanlink.includes("/news/2023/") && !cleanlink.includes("subscriber-only"));
  return links;
}

chrome.runtime.onMessage.addListener(getMessage);
