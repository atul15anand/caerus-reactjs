/* eslint-disable no-undef */
function getMessage(request, sender, sendResponse) {

  if (request.action === "getLinks") {
    const storedUrlsData = JSON.parse(localStorage.getItem("articleLinksData")) || [];
    console.log("stored urls are", storedUrlsData);
    const linksData = getArticleLinks().filter(link => !storedUrlsData.includes(link));
    console.log("fetched links are", linksData);
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
    console.log(storedRssData);
    console.log(storedUrlsData);
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
