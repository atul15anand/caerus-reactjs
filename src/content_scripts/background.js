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
const parallel_rss_source_count = 2;

async function getMessage(request, sender, sendResponse) {
  if (request.action === "generateNewTabs") {
    urlsToOpen = [];
    createTabs(request.urls);
  }
  else if (request.action === "getRssSourceAndSync") {
    resetData();
    getRssSourceToSync();
  } else if (request.action === "sendInfoFromArticle") {
    sendSharableArticleData(request.data, request.url);
  }
  else if(request.action === "requestForRssSource"){
    sendResponse({ rss_data: rss_source, selectors_data: data_selector_fields });
  }
}

function resetData() { 
  urlsToOpen = [];
  newstabCreation = false;
  isTabCreationInProgress = false;
  rss_source = null;
  data_selector_fields = null;
  primary_urls = [];
  current_primary_url = null;
}

// Function to get RssSource to Sync
function getRssSourceToSync() {
  if(urlsToOpen.length>0) return;
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      const url = karmabox_url + "/rss_sources/fetch_rss_source_plugin?api_key=" + apiKey;
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
          isTabCreationInProgress = false;
          setPrimaryUrls();
        })
        .catch((error) => {
          console.log("An error occurred:", error);
        });
    } else {
      console.log("Cannot retrieve Cookie!");
    }
  });
}

// We set the rss source URL in primaryUrls list.
function setPrimaryUrls(){
  primary_urls = [rss_source.url];
  console.log("primary urls is : ", primary_urls);
  fetchUrlsFromPrimaryPage();
}

// Function to filter out the Urls fetched from a Page
function filterUrlsFetched(urls){
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      const url = karmabox_url + "/rss_sources/urls_filtering_plugin?api_key=" + apiKey;
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      let data = {};
      data["urls"] = urls;
      data["rss_source_id"] = rss_source._id;
      console.log("we are sending ", data);
      fetch(url, { method: "POST", body: JSON.stringify(data), headers })
        .then(async (response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error("Request failed.");
          }
        })
        .then((data) => {
          console.log("we got this ", data);
          urls = data.urls;
          if(urls.length> 0){
            createTabs(urls);
          }else{
            scheduleCurrentRssSourceSync(); // if we do not get any urls we schedule it
            getRssSourceToSync(); // and move to next
          }
        })
        .catch((error) => {
          console.log("An error occurred:", error);
        });
    } else {
      console.log("Cannot retrieve Cookie!");
    }
  });
}
// function opens a New tab from Rss Source Url
function fetchUrlsFromPrimaryPage() {
  if (primary_urls.length > 0 && urlsToOpen.length === 0) {
    if(isTabCreationInProgress){
      return;
    }
    current_primary_url = primary_urls.shift();
    isTabCreationInProgress = true;
    let new_url = buildUrl(current_primary_url, "flagToClose");
    
    // Moving the tab creation logic inside a separate function
    function createPrimaryTab() {
      chrome.tabs.create({ url: new_url }, function (tab) {
        const tabId = tab.id;
        let listenerActive = true;
        chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
          if (!listenerActive) {
            return;
          }
          if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
            let timer = 0;
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, {action: "getLoadInfo"}, // This tells if page needed verification
              async (response) => {
                console.log("response is : ", response);
                console.log("fully loaded is : ", response.fullyLoaded);
                if(response === null ||  !response.fullyLoaded){
                  timer = 60000;
                }
                setTimeout(() => {
                  chrome.tabs.sendMessage(
                    tab.id,
                    { action: "getLinks", rss_source_url: current_primary_url},
                    async (response) => {
                      console.log("Response from articles:", response);
                      isTabCreationInProgress = false;
                      if (response && response.links) {
                        console.log("we are here");
                        current_primary_url = response.primary_url;
                        closePrimaryUrl(0);
                        setTimeout(() => {
                          filterUrlsFetched(response.links);
                        }, 5000);
                      } else {
                        primary_urls.push(current_primary_url);
                        closePrimaryUrl(0);
                        setTimeout(() => {
                          fetchUrlsFromPrimaryPage();
                        }, 30000);
                      }
                    }
                  );
                  listenerActive = false;
                  chrome.tabs.onUpdated.removeListener(listener);
                }, timer);
              })
            }, 5000);
          }
        });
      });
    }
    createPrimaryTab();
  } else {
    scheduleCurrentRssSourceSync();
    setTimeout(() => {
      getRssSourceToSync();
    }, 2000);
  }
}

function scheduleCurrentRssSourceSync() {
  if(urlsToOpen.length>0) return;
  console.log("schedule method");
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      let data = {"api_key": apiKey};
      data["rss_source_id"] = rss_source._id;
      const url = karmabox_url + "/rss_sources/schedule_current_rss_source_sync";
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      fetch(url, { method: "POST", body: JSON.stringify(data), headers })
        .then(async (response) => {
        })
        .catch((error) => {
          console.log("An error occurred:", error);
        })
    } else {
      console.log("Cannot retrieve Cookie!");
    }
  });
}

function sendSharableArticleData(data, tabUrl) {
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      data["api_key"] = apiKey;
      data["article_url"] = tabUrl.replace(/[?&]flagArticle=true/g, '').replace(/[?&]flagToClose=true/g, '');
      data["rss_source_id"] = rss_source._id;
      const url = karmabox_url + "/matching_articles/sync_manual_sharable_article";
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      fetch(url, { method: "POST", body: JSON.stringify(data), headers })
        .then(async (response) => {
          console.log(response);
          if (response.ok) {
            newstabCreation = false;
            createTabs(urlsToOpen);
            chrome.tabs.query({ url: tabUrl }, function (tabs) {
              const tab = tabs[0];
              if (tab && tab.url) {
                closeTab(tab.url);
              }
            });
          } else if (response.status === 500) {
              closeTab(tabUrl);
              newstabCreation = false;
              createTabs(urlsToOpen);
          } else if (response.status === 409){
            newstabCreation = false;
            createTabs(urlsToOpen);
            chrome.tabs.query({ url: tabUrl }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                closeTab(tab.url);
              }
            });
          }
          else {
            newstabCreation = false;
            closeTab(tabUrl);
            createTabs(urlsToOpen);    
          }
        })
        .catch((error) => {
          console.log("An error occurred:", error);
          newstabCreation = false;
          openNextTab(); // Proceed to the next tab even if there's an error
        })
    } else {
      console.log("Cannot retrieve Cookie!");
    }
  });
}

async function createTabs(urls) {
  urlsToOpen = urls;
  console.log(urlsToOpen.length);
  setTimeout(() => openNextTab(), 1000);
}

function closeTab(url) {
  url = url.split("#")[0];
  chrome.tabs.query({ url: url }, function (tabs) {
    const tab = tabs[0];
    if (tab && tab.url) {
        chrome.tabs.remove(tab.id, function () {});
    }
  });
}

function buildUrl(url, param){
  const separator = url.includes('?') ? '&' : '?';
  const updatedUrl = `${url}${separator}${param}=true`;
  return updatedUrl;
}

function removeQueryParam(url, paramName) {
  let Newurl = url.replace(new RegExp(`[?&]${paramName}=true(&|$)`), "");
  console.log(Newurl);
  return Newurl;
}

function openNextTab() {
  console.log("urls length is :", urlsToOpen.length);
  if (urlsToOpen.length > 0) {
    if (newstabCreation) {
      return;
    }
    newstabCreation = true;
    let url = urlsToOpen.shift();
    url = url.split('#')[0];
    url = removeQueryParam(url, "flagToClose");
    url = buildUrl(url, "flagArticle");
    chrome.tabs.create({ url: url }, function (tab) {
      const tabId = tab.id;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
        if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    });
  }
  else{
    closePrimaryUrl(2000);
    setTimeout(() => {
      fetchUrlsFromPrimaryPage();
    }, 5000);
  }
}

function closePrimaryUrl(timeout) {
  chrome.tabs.query({ url: current_primary_url }, async (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url) {
      setTimeout(() => {
        console.log("closing the tab");
        chrome.tabs.remove(tab.id);
      }, timeout);
    }
  });
}

chrome.runtime.onMessage.addListener(getMessage);