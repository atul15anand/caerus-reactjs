/* eslint-disable no-undef */
// http://0.0.0.0:3002
let main_url = "http://localhost:3000";
let karmabox_url = "http://0.0.0.0:3002";
let urlsToOpen = {};
let newstabCreation = {};
let isTabCreationInProgress = false;
let rss_sources = [];
let primary_rss_sources = [];
let current_primary_url= null;
let tabsMap = {};
let newsArticleSourceMapping = {};
const parallel_rss_source_count = 4;
const TIMEOUT_THRESHOLD = 30 * 1000;

async function getMessage(request, sender, sendResponse) {
  if (request.action === "generateNewTabs") {
    urlsToOpen = {};
    createTabs(request.urls);
  }
  else if (request.action === "getRssSourceAndSync") {
    resetData();
    getRssSourceToSync();
  } else if (request.action === "sendInfoFromArticle") {
    sendSharableArticleData(request.data, request.url);
  }
}

function resetData() { 
  urlsToOpen = {};
  newsArticleSourceMapping = {};
  newstabCreation = {};
  isTabCreationInProgress = false;
  rss_sources = [];
  data_selector_fields = null;
  primary_rss_sources = [];
  tabsMap = {};
  current_primary_url = null;
}

// Function to get RssSource to Sync
function getRssSourceToSync() {
  const urls_keys = Object.keys(urlsToOpen);
  const matching_objects = primary_rss_sources.filter(obj => urls_keys.includes(obj._id) && urlsToOpen[obj._id].length === 0);
  const rss_candidate_ids = matching_objects.map(obj => obj.rss_candidate_id);
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      const url = `${karmabox_url}/rss_sources/fetch_rss_source_plugin?api_key=${apiKey}&rss_candidate_count=${parallel_rss_source_count}&rss_candidate_ids=${rss_candidate_ids.join(',')}`;
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
          console.log("data is : ", data);
          console.log("rss source length : ", rss_sources.length);
          if (rss_sources.length === 0) {
              rss_sources = data.data;
          } else {
              console.log(urlsToOpen);
              rss_sources = rss_sources.filter(source => urlsToOpen[source._id].length !== 0);
              console.log("after removal : ", rss_sources);
              
              let max_sources_to_fetch = Math.max(parallel_rss_source_count - rss_sources.length, 0);
              let additional_sources = data.data.slice(0, max_sources_to_fetch);
              rss_sources = rss_sources.concat(additional_sources);
          }
          console.log("Updated rss sources: ", rss_sources);
        
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
  primary_rss_sources = rss_sources;
  // console.log("primary_rss_sources is : ", primary_rss_sources);
  fetchUrlsFromPrimaryPage();
}

// Function to filter out the Urls fetched from a Page
function filterUrlsFetched(tabId, urls){
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
      data["rss_source_id"] = tabsMap[tabId].source._id;
      // console.log("we are sending ", data);
      fetch(url, { method: "POST", body: JSON.stringify(data), headers })
        .then(async (response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error("Request failed.");
          }
        })
        .then((data) => {
          console.log("After Filter Urls ", data);
          urls = data.urls;
          if(urls.length> 0){
            createTabs(tabsMap[tabId].source, urls);
          }else{
            scheduleCurrentRssSourceSync(tabsMap[tabId].source); // if we do not get any urls we schedule it
            getRssSourceToSync(tabsMap[tabId]._id); // and move to next
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
  if (primary_rss_sources.length > 0) {
    if (isTabCreationInProgress) {
      return;
    }
    
    // Loop through each URL in primary_rss_sources and create a tab for each URL
    primary_rss_sources.forEach((source) => {
      isTabCreationInProgress = true;
      let new_url = buildUrl(source.url, "flagToClose");

      // Function to create a tab and execute logic
      function createPrimaryTab() {
        chrome.tabs.create({ url: new_url }, function (tab) {
          const tabId = tab.id;
          let listenerActive = true;
          const tabData = {
              id: tab.id,
              source: source
          };
          tabsMap[tab.id] = tabData;
          chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
            if (!listenerActive) {
              return;
            }
            if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
              let timer = 0;
              setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, { action: "getLoadInfo" }, async (response) => {
                  console.log("response is : ", response);
                  console.log("fully loaded is : ", response.fullyLoaded);
                  if (response === null || !response.fullyLoaded) {
                    timer = 60000;
                  }
                  setTimeout(() => {
                    chrome.tabs.sendMessage(
                      tab.id,
                      { action: "getLinks", rss_source_url: new_url },
                      async (response) => {
                        console.log("Response from articles:", response);
                        isTabCreationInProgress = false;
                        if (response && response.links) {
                          current_primary_url = response.primary_url;
                          closePrimaryUrl(current_primary_url, 0);
                          setTimeout(() => {
                            filterUrlsFetched(tab.id, response.links);
                          }, 5000);
                        } else {
                          primary_rss_sources.push(source);
                          closePrimaryUrl(new_url, 0);
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
      if (!urlsToOpen.hasOwnProperty(source._id) || urlsToOpen[source._id].length === 0) {
          delete urlsToOpen[source._id];
          createPrimaryTab();
      }
    });
  } else {
    getRssSourceToSync();
  }
}

function scheduleCurrentRssSourceSync(rss_source) {
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
      let article_url = tabUrl.replace(/[?&]flagArticle=true/g, '').replace(/[?&]flagToClose=true/g, '');
      data["article_url"] = article_url;
      let tabId = null;
      chrome.tabs.query({ url: tabUrl }, function (tabs) {
          const tab = tabs[0];
          if (tab && tab.url) {
              tabId = tab.id;
              let curr_rss_source = newsArticleSourceMapping[tabId];
              console.log("curr rss source is : ", curr_rss_source);
              newstabCreation[curr_rss_source._id] = false;
              data["rss_source_id"] = curr_rss_source._id;
              const url = karmabox_url + "/matching_articles/sync_manual_sharable_article";
              const headers = {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${apiKey}`
              };
              fetch(url, { method: "POST", body: JSON.stringify(data), headers })
                .then(async (response) => {
                    console.log(response);
                    if (response.ok) {
                        createTabs(curr_rss_source, urlsToOpen[curr_rss_source._id]);
                        closeTab(tabUrl);
                    } else if (response.status === 500) {
                        closeTab(tabUrl);
                        createTabs(curr_rss_source, urlsToOpen[curr_rss_source._id]);
                    } else if (response.status === 409) {
                        createTabs(curr_rss_source, urlsToOpen[curr_rss_source._id]);
                        closeTab(tabUrl);
                    }
                    else {
                        createTabs(curr_rss_source, urlsToOpen[curr_rss_source._id]);
                        closeTab(tabUrl);
                    }
                })
                .catch((error) => {
                    createTabs(curr_rss_source, urlsToOpen[curr_rss_source._id]);
                    closeTab(tabUrl);
                    console.log("An error occurred:", error);
                });
          }
      });
    } else {
      console.log("Cannot retrieve Cookie!");
    }
  });
}

async function createTabs(rss_source, urls) {
  urlsToOpen[rss_source._id] = urls;
  console.log(urlsToOpen[rss_source._id].length);
  console.log("12");
  setTimeout(() => openNextTab(rss_source), 1000);
}

function closeTab(url) {
  url = url.split("#")[0];
  chrome.tabs.query({ url: url }, function (tabs) {
    const tab = tabs[0];
    if (tab && tab.url) {
        delete newsArticleSourceMapping[tab.id];
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

function openNextTab(rss_source) {
  console.log("urls length is :", urlsToOpen[rss_source._id].length);
  if (urlsToOpen[rss_source._id].length > 0) {
    if (newstabCreation[rss_source._id] || Object.keys(newsArticleSourceMapping).length === parallel_rss_source_count) {
      return;
    }
    newstabCreation[rss_source._id] = true;
    let url = urlsToOpen[rss_source._id].shift();
    url = url.split('#')[0];
    url = removeQueryParam(url, "flagToClose");
    url = buildUrl(url, "flagArticle");
    chrome.tabs.create({ url: url }, function (tab) {
      const tabId = tab.id;
      newsArticleSourceMapping[tabId] = rss_source;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
        if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
        }
      });
    });
  }
  else{
    scheduleCurrentRssSourceSync(rss_source);
    getRssSourceToSync(rss_source); // passing rss source to remove from primary_rss_sources.
  }
}

function closePrimaryUrl(urlToClose, timeout) {
  chrome.tabs.query({ url: urlToClose }, async (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url) {
      setTimeout(() => {
        chrome.tabs.remove(tab.id);
      }, timeout);
    }
  });
}
chrome.runtime.onInstalled.addListener(function() {
  monitorTabs();
});
function monitorTabs() {
  setInterval(() => {
      chrome.tabs.query({}, function(tabs) {
          tabs.forEach(tab => {
              const currentTime = new Date().getTime();
              const tabOpenTime = new Date(tab.lastAccessed || tab.openerTabId).getTime();
              const elapsedTime = currentTime - tabOpenTime;

              if (elapsedTime > TIMEOUT_THRESHOLD) {
                if (newsArticleSourceMapping && urlsToOpen) {
                    source = newsArticleSourceMapping[tab.id];
                    if (source && urlsToOpen[source._id]) {
                        urls = urlsToOpen[source._id];
                        chrome.tabs.remove(tab.id, function() {
                            console.log("Closed tab: ", tab.id);
                        });
                        createTabs(source, urls);
                    } else {
                        console.log("Source or URLs not found for tab: ", tab.id);
                    }
                } else {
                    console.log("NewsArticleSourceMapping or URLsToOpen not initialized.");
                }
            }
          });
      });
  }, 1000); // Check every second
}
chrome.runtime.onMessage.addListener(getMessage);