/* eslint-disable no-undef */
// http://0.0.0.0:3002
let main_url = "https://news.almaconnect.com";
let karmabox_url = "https://karmabox.almaconnect.com";
let urlsToOpen = [];
let newstabCreation = false;
let isTabCreationInProgress = false;
let rss_source = null;
let data_selector_fields = null;
let primary_urls = [];
let current_primary_url= null;

async function getMessage(request, sender, sendResponse) {
  if (request.action === "generateNewTabs") {
    urlsToOpen = [];
    createTabs(request.urls);
  }
  else if (request.action === "getRssSourceAndSync") {
    primary_urls = [];
    current_primary_url = null;
    getRssSourceToSync();
  } else if (request.action === "sendInfoFromArticle") {
    sendSharableArticleData(request.data, request.url);
  }
  else if(request.action === "requestForRssSource"){
    sendResponse({ rss_data: rss_source, selectors_data: data_selector_fields });
  }
  else if(request.action === "fetchConfirmedUrls"){
    console.log("we are trying to get confirmed urls");
    chrome.storage.local.get({ confirmedURLs: [] }, function (data) {
      const confirmedURLs = data.confirmedURLs;
      sendResponse({links: confirmedURLs});
    });
    return true;
  }
}

function getRssSourceToSync() {
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      const url = karmabox_url + "/rss_sources/fetch_plugin_rss_source?api_key=" + apiKey;
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };

      fetch(url, { method: "GET", headers })
        .then(async (response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error("Request failed.");
          }
        })
        .then((data) => {
          rss_source = data.data;
          data_selector_fields = data.data_selector_fields;
          setPrimaryUrls();
        })
        .catch((error) => {
          console.log("An error occurred:", error);
        });
    } else {
      console.log("Cannot retrieve cookie!");
      chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        const tab = tabs[0];
        if (tab && tab.url) {
          chrome.tabs.sendMessage(tab.id, { action: "cookieMissingError" });
        }
      });
    }
  });
}

function sendSharableArticleData(data, tabUrl) {
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      data["api_key"] = apiKey;
      const url = karmabox_url + "/matching_articles/process_manual_sharable_article";
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      const flagToClose = getParameterByName("flagToClose",data["content"]["link"]);
      data["content"]["last_rss_article"] = (primary_urls.length == 0 && urlsToOpen.length == 0 && flagToClose)? true : false;
      fetch(url, { method: "POST", body: JSON.stringify(data), headers })
        .then(async (response) => {
          console.log(response);
          if (response.ok) {
            chrome.tabs.query({ url: tabUrl }, function (tabs) {
              const tab = tabs[0];
              if (tab && tab.url) {
                storeConfirmedURL(tab.url);
                closeTab(tab.url);
              }
            });
          } else if (response.status == 500) {
            chrome.tabs.query({ url: tabUrl }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                closeTab(tabUrl);
                chrome.tabs.sendMessage(tab.id, { action: "storeRssSourceNotFound", data: data.content.rss_source_url, url: tab.url });
              }
            });
          } else if (response.status == 409){
            chrome.tabs.query({ url: tabUrl }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                storeConfirmedURL(tab.url);
                closeTab(tab.url);
              }
            });
          }
          else {
            chrome.tabs.query({ url: tabUrl }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                chrome.tabs.sendMessage(tab.id, { action: "dataMissingMessage", data: data.content, url: tab.url }, function (response) {
                  if (response) {
                    closeTab(tabUrl);
                  } else {
                    console.log("No response from content script.");
                  }
                });
              }
            });            
          }
        })
        .catch((error) => {
          console.log("An error occurred:", error);
          openNextTab(); // Proceed to the next tab even if there's an error
        });
    } else {
      console.log("Cannot retrieve cookie!");
      chrome.tabs.query({ url: tabUrl }, async (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url) {
          chrome.tabs.sendMessage(tab.id, { action: "cookieMissingError" });
        }
      });
    }
  });
}

function storeConfirmedURL(article_url) {
  chrome.tabs.query({ url: current_primary_url }, async (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url) {
      chrome.tabs.sendMessage(tab.id, { action: "storeConfirmedUrl", url: article_url });
    }
  });
}

function getParameterByName(name, url) {
  const searchParams = new URLSearchParams(new URL(url).search);
  return searchParams.get(name);
}

async function createTabs(urls) {
  urlsToOpen = urls
  newstabCreation = false;
  setTimeout(() => openNextTab(), 1000)
}

function setPrimaryUrls(){
  primary_urls = rss_source.primary_urls;
  fetchUrlsFromPrimaryPage();
}

function fetchUrlsFromPrimaryPage() {
  console.log("now primary urls are :", primary_urls.length);
  if (primary_urls.length > 0) {
    current_primary_url = primary_urls.shift();
    isTabCreationInProgress = true;

      chrome.tabs.create({ url: current_primary_url }, function (tab) {
        const tabId = tab.id;
        let responseReceived = false;

        const waitForResponse = new Promise((resolve) => {
          chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
            if (!responseReceived && updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
              chrome.tabs.sendMessage(
                tab.id,
                { action: "getLinks", url_filter: rss_source.url_filter, url_fetch_criteria: data_selector_fields.url_fetch_criteria },
                async (response) => {
                  console.log("resposne from articles : ",response);
                  if (response && response.links) {
                    articleLinksData = response.links;
                    current_primary_url = response.primary_url;
                    console.log(response.links);
                    if(articleLinksData.length == 0){
                      console.log("ZERO links--------");
                      closePrimaryUrl(0);
                      fetchUrlsFromPrimaryPage();
                    }else {
                      createTabs(response.links);
                    }
                  } else {
                    console.log("No response or links in response.");
                    primary_urls.push(current_primary_url);
                    console.log("we pushed primary again");
                    console.log("now primary urls are : ", primary_urls);
                    closePrimaryUrl(0);

                    fetchUrlsFromPrimaryPage();
                  }
                  responseReceived = true;
                  resolve(response); // Resolve the promise with the response
                }
              );
              isTabCreationInProgress = false; // Reset the flag after the tab creation is complete
              chrome.tabs.onUpdated.removeListener(listener);
            }
          });
        });
        waitForResponse.then((resolvedResponse) => {
          console.log("Promise resolved with response:", resolvedResponse);
        });
      });
  } else {
    getRssSourceToSync();
  }
}

function closeTab(url) {
  chrome.tabs.query({ url: url }, function (tabs) {
    const tab = tabs[0];
    if (tab && tab.url) {
      const flagToClose = getParameterByName("flagToClose", tab.url);
      if (flagToClose === "true") {
        chrome.tabs.remove(tab.id, function () {});
      }
    }
  });
}

function buildUrl(url){
  const separator = url.includes('?') ? '&' : '?';
  const updatedUrl = `${url}${separator}flagToClose=true`;
  return updatedUrl;
}

function openNextTab() {
  console.log("urls length is :", urlsToOpen.length);
  if (urlsToOpen.length > 0) {
    if (newstabCreation) {
      return;
    }
    newstabCreation = true;
    const url = urlsToOpen.shift();
    const modifiedUrl =  buildUrl(url);
    chrome.tabs.create({ url: modifiedUrl }, function (tab) {
      const tabId = tab.id;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
        if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.get(tabId, function (tab) {
            newstabCreation = false;
            openNextTab();
          });
        }
      });
    });
  }
  else{
    closePrimaryUrl(3000); 
    setTimeout(() => {
      fetchUrlsFromPrimaryPage();
    }, 2000);
  }
}

function closePrimaryUrl(timeout) {
  chrome.tabs.query({ url: current_primary_url }, async (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url) {
      setTimeout(() => {
        chrome.tabs.remove(tab.id);
      }, 1000); // 3 seconds (3000 milliseconds) timeout
    }
  });
}

chrome.runtime.onMessage.addListener(getMessage);
