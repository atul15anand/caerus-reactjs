/* eslint-disable no-undef */
let main_url = "https://news.almaconnect.com";
let karmabox_url = "https://karmabox.almaconnect.com";
let urlsToOpen = [];
let rss_candidates_data = [];
let rss_urls = [];
let newstabCreation = false;

async function getMessage(request, sender, sendResponse) {
  if (request.action === "generateNewTabs") {
    urlsToOpen = [];
    createTabs(request.urls, true);
  }
  else if (request.action === "sendGetRssSourcesRequest") {
    rss_candidates_data = [];
    rss_urls = [];
    chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
      if (cookie) {
        const apiKey = cookie.value;
        const url = karmabox_url + "/rss_candidates/fetch_rss_candidate_plugin?api_key=" + apiKey;
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
            console.log("we got candidate data");
            console.log(data.data);
            processRssCandidate(data.data); // sending candidates
          })
          .catch((error) => {
            console.log("An error occurred:", error);
            // Handle error
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
  } else if (request.action === "sendContentFromUrls") {
    let data = request.data;
    chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
      if (cookie) {
        const apiKey = cookie.value;
        data["api_key"] = apiKey;
        const url = karmabox_url + "/matching_articles/fetch_sharable_article_data";
        const headers = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        };
        const flagToClose = getParameterByName("flagToClose",data["content"]["link"]);
        console.log("flag to close is ", flagToClose);
        console.log("urls length is ", urlsToOpen.length);
        data["content"]["last_rss_article"] = (urlsToOpen.length == 0 && flagToClose)? true : false;
        console.log("last wala", data["content"]["last_rss_article"]);
        fetch(url, { method: "POST", body: JSON.stringify(data), headers })
          .then(async (response) => {
            console.log(response);
            if (response.ok) {
              chrome.tabs.query({ url: request.url }, function (tabs) {
                const tab = tabs[0];
                if (tab && tab.url) {
                  chrome.tabs.sendMessage(tab.id, { action: "storeConfirmedUrl", url: tab.url, message: true },async (response) => {
                    if (response && response.success) {
                      closeTab(request.url);
                    }
                  });
                }
              });
            } else if (response.status == 500) {
              chrome.tabs.query({ url: request.url }, async (tabs) => {
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
}

function getParameterByName(name, url) {
  const searchParams = new URLSearchParams(new URL(url).search);
  return searchParams.get(name);
}

async function createTabs(urls, direct) {
  urlsToOpen = urls.filter(url => url && url.includes("/news/2023"));
  urlsToOpen.sort();
  newstabCreation = false;
  setTimeout(() => openNextTab(direct), 1000)
}

async function processRssCandidate(rss_candidates) {
  rss_candidates_data = rss_candidates;
  const candidate = rss_candidates_data.shift();
  fetchRssSources(candidate._id);
}

async function processRssSources(rss_source_urls) {
  rss_urls = rss_source_urls;
  isTabCreationInProgress = false;
  setTimeout(() => openNextNewPage(), 1000);
}

function fetchRssSources(candidate_id) {
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      const url = karmabox_url + "/rss_sources/fetch_rss_sources_plugin?api_key=" + apiKey + "&rss_candidate_id=" + candidate_id;
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
          console.log("fetched rss sources");
          console.log(data.data);
          processRssSources(data.data); // sending candidates
        })
        .catch((error) => {
          console.log("An error occurred:", error);
          // Handle error
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

let isTabCreationInProgress = false;
function openNextNewPage() {
  if (rss_urls.length > 0 && !isTabCreationInProgress) {
    const url = rss_urls.shift();
    const modifiedUrl = "https://www.bizjournals.com/" + url.split("_")[1] + "/news";
    isTabCreationInProgress = true; // Set flag to indicate tab creation is in progress

    chrome.tabs.create({ url: modifiedUrl }, function (tab) {
      const tabId = tab.id;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
        if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.tabs.sendMessage(tab.id, { action: "getLinks" }, async (response) => {
            if (response && response.links) {
              articleLinksData = response.links;
              console.log(response.links);
              chrome.tabs.remove(tabId, function () { });
              createTabs(response.links, false);
            }
          });
          isTabCreationInProgress = false; // Reset the flag after the tab creation is complete
        }
      });
    });
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
              // });
            } else {
              openNextTab(direct);
            }
          });
        }
      });
    });
  }
  else if(!direct) {
    if (rss_urls.length > 0) {
      openNextNewPage();
    } else {
      const candidate = rss_candidates_data.shift();
      fetchRssSources(candidate._id);
    }
  }
}

chrome.runtime.onMessage.addListener(getMessage);
