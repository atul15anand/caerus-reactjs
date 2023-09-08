/* eslint-disable no-undef */
// http://0.0.0.0:3002
let main_url = "http://localhost:3000";
let karmabox_url = "http://0.0.0.0:3002";
let urlsToOpen = [];
let newstabCreation = false;
let isTabCreationInProgress = false;
let rss_source = null;
let data_selector_fields = null;
let primary_urls = [];

async function getMessage(request, sender, sendResponse) {
  if (request.action === "generateNewTabs") {
    urlsToOpen = [];
    createTabs(request.urls, true);
  }
  else if (request.action === "getRssSourceAndSync") {
    getRssSourceToSync();
  } else if (request.action === "sendInfoFromArticle") {
    sendSharableArticleData(request.data, request.url);
  }
  else if(request.action === "requestForRssSource"){
    console.log("we are here to get rss data");
    console.log(rss_source);
    sendResponse({ rss_data: rss_source, selectors_data: data_selector_fields });
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
          console.log("we got our rss source data");
          rss_source = data.data;
          console.log("rss source value is set , ", rss_source);
          console.log("our response from manual article sync is : ", data);
          data_selector_fields = data.data_selector_fields;
          console.log("data selector fieds : ", data_selector_fields);
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
  console.log("data is : ", data);
  console.log("tabUrl : ", tabUrl);
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      data["api_key"] = apiKey;
      const url = karmabox_url + "/matching_articles/process_manual_sharable_article";
      console.log("url is : ", url);
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      console.log("headers is : ", headers);
      const flagToClose = getParameterByName("flagToClose",data["content"]["link"]);
      console.log("flag to close", flagToClose);
      console.log("we are sending article data");
      data["content"]["last_rss_article"] = (urlsToOpen.length == 0 && flagToClose)? true : false;
      fetch(url, { method: "POST", body: JSON.stringify(data), headers })
        .then(async (response) => {
          console.log(response);
          if (response.ok) {
            chrome.tabs.query({ url: tabUrl }, function (tabs) {
              const tab = tabs[0];
              if (tab && tab.url) {
                chrome.tabs.sendMessage(tab.id, { action: "storeConfirmedUrl", url: tab.url, message: true },async (response) => {
                  if (response && response.success) {
                    closeTab(tabUrl);
                  }
                });
              }
            });
          } else if (response.status == 500) {
            chrome.tabs.query({ url: tabUrl }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                chrome.tabs.sendMessage(tab.id, { action: "storeRssSourceNotFound", data: data.content.rss_source_url, url: tab.url });
              }
            });
          } else if (response.status == 409){
            chrome.tabs.query({ url: request.url }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                chrome.tabs.sendMessage(tab.id, { action: "storeConfirmedUrl", url: tab.url, message: false },async (response) => {});
                chrome.tabs.sendMessage(tab.id, { action: "duplicateData", url: tab.url }, async (response) => {
                  if (response && response.success) {
                    closeTab(request.url);
                  }
                });
              }
            });
          }
          else {
            chrome.tabs.query({ url: request.url }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                chrome.tabs.sendMessage(tab.id, { action: "dataMissingMessage", data: data.content, url: tab.url });
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
      chrome.tabs.query({ url: request.url }, async (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url) {
          chrome.tabs.sendMessage(tab.id, { action: "cookieMissingError" });
        }
      });
    }
  });
}

function getParameterByName(name, url) {
  const searchParams = new URLSearchParams(new URL(url).search);
  return searchParams.get(name);
}

async function createTabs(urls, direct) {
  urlsToOpen = urls
  urlsToOpen.sort();
  newstabCreation = false;
  setTimeout(() => openNextTab(direct), 1000)
}

function setPrimaryUrls(){
  primary_urls = rss_source.primary_urls;
  console.log("primary urls are : ", primary_urls);
  fetchUrlsFromPrimaryPage();
}

function fetchUrlsFromPrimaryPage() {
  if (primary_urls.length > 0) {
    const newsfeed_url = primary_urls.shift();
    console.log("primary url is:", newsfeed_url);
    isTabCreationInProgress = true;

    chrome.tabs.create({ url: newsfeed_url }, function (tab) {
      const tabId = tab.id;
      let responseReceived = false;

      const waitForResponse = new Promise((resolve) => {
        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
          if (!responseReceived && updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
            chrome.tabs.sendMessage(
              tab.id,
              { action: "getLinks", url_filter: rss_source.url_filter, url_fetch_criteria: data_selector_fields.url_fetch_criteria },
              async (response) => {
                if (response && response.links) {
                  console.log("response from getLinks:", response);
                  articleLinksData = response.links;
                  console.log("links aa gae");
                  console.log(response.links);
                  createTabs(response.links, false);
                } else {
                  console.log("No response or links in response.");
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
    // getRssSourceToSync();
  }
}

function closeTab(url) {
  chrome.tabs.query({ url: url }, function (tabs) {
    const tab = tabs[0];
    if (tab && tab.url) {
      const flagToClose = getParameterByName("flagToClose", tab.url);
      if (flagToClose === "true") {
        chrome.tabs.remove(tab.id, function () { });
      }
    }
  });
}

function openNextTab(direct) {
  if (urlsToOpen.length > 0) {
    if (newstabCreation) {
      return;
    }
    newstabCreation = true;
    const url = urlsToOpen.shift();
    const modifiedUrl = url + "?flagToClose=true";
    chrome.tabs.create({ url: modifiedUrl }, function (tab) {
      const tabId = tab.id;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
        if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.get(tabId, function (tab) {
            const flagToClose = getParameterByName("flagToClose", tab.url);
            newstabCreation = false;
            if (flagToClose === "true") {
                openNextTab(direct);
            } else {
              openNextTab(direct);
            }
          });
        }
      });
    });
  }
  else{
    // getRssSourceToSync();
    // fetchUrlsFromPrimaryPage();
  }
}

chrome.runtime.onMessage.addListener(getMessage);
