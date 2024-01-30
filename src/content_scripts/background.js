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
let urlHash = {};
// const accessToken = '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';
const accessToken = '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'

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
  else if(request.action === "stopNewsSync") {
    console.log("Stopping News Sync");
    primary_urls = [];
    current_primary_url = null;
    resetData();
  }
}

function resetData() {
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      let data = {"api_key": apiKey};
      const url = karmabox_url + "/rss_sources/disable_manual_article_sync";
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

// Function to get Manual Article Sync
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
          console.log("data selector fields are : ",data_selector_fields);
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

function setPrimaryUrls(){
  primary_urls = rss_source.primary_urls;
  fetchUrlsFromPrimaryPage();
}

function getFilteredLinks(urls, current_primary_url) {
  return new Promise((resolve, reject) => {
    
    let new_url = current_primary_url;
    if(new_url.includes("flagToClose")){
      new_url = new_url.slice(0,-17);
    }
    console.log("FILTERING url : ", new_url);
    const p_url = new_url.replace(/:\/\//g, '_').replace(/\./g, '_').replace(/\//g, '_');
    const apiUrl = `https://api.github.com/repos/atul15anand/Urls-Storage/contents/${p_url}.md`;

    console.log("api is : ", apiUrl);

    const fetchOptions = {
      method: 'GET',
      headers: {
        'Authorization': `token ${accessToken}`,
      },
    };

    fetch(apiUrl, fetchOptions)
      .then(response => {
        if (response.ok) {
          return response.json();
        } else if (response.status === 404) {
          // File does not exist, create it
          return createFile(p_url);
        } else {
          throw new Error(`Failed to fetch file. Status: ${response.status}`);
        }
      })
      .then(data => {
        const existingContent = data.content.length > 6 ? atob(data.content) : "https://www.google.com";
        let storedUrls;
        try {
          storedUrls = existingContent ? existingContent.split(",") : [];
        } catch (splitError) {
          console.error('Error splitting existing content:', splitError);
          storedUrls = [];
        }
        const filteredUrls = urls.filter(url => !storedUrls.includes(url));
        resolve(filteredUrls);
      })
      .catch(error => {
        console.error('Error:', error);
        reject(error); // Reject the Promise with an error
      });
  });
}

function createFile(fileName) {

  if(fileName.includes("flagToClose")){
    fileName = fileName.slice(0, -17)
  }
  const apiUrl = 'https://api.github.com/repos/atul15anand/Urls-Storage/contents/';
  const content = "https://www.google.com"; // You can provide initial content for the new file if needed

  const fetchOptions = {
    method: 'PUT',
    headers: {
      'Authorization': `token ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Create ${fileName}.md`,
      content: btoa(content),
    }),
  };

  return fetch(apiUrl + `${fileName}.md`, fetchOptions)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(`Failed to create file. Status: ${response.status}`);
      }
    });
}

function fetchUrlsFromPrimaryPage() {
  if (primary_urls.length > 0 && urlsToOpen.length === 0) {
    if(isTabCreationInProgress){
      return;
    }
    current_primary_url = primary_urls.shift();
    isTabCreationInProgress = true;
    let new_url = buildUrl(current_primary_url);
    
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
              chrome.tabs.sendMessage(tab.id, {action: "getLoadInfo"},
              async (response) => {
                if(!response.fullyLoaded){
                  timer = 60000;
                }
                setTimeout(() => {
                  chrome.tabs.sendMessage(
                    tab.id,
                    { action: "getLinks", url_filter: rss_source.url_filter, url_fetch_criteria: data_selector_fields.url_fetch_criteria, website_data: current_primary_url },
                    async (response) => {
                      console.log("Response from articles:", response);
                      if (response && response.links) {
                        console.log("we are here");
                        current_primary_url = response.primary_url;
                        closePrimaryUrl(0);
                        console.log("now here");
                        setTimeout(() => {
                          createTabs(response.links);
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
                  isTabCreationInProgress = false;
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
    scheduleCurrentManualArticleSync();
    setTimeout(() => {
      getRssSourceToSync();
    }, 2000);
  }
}

function scheduleCurrentManualArticleSync() {
  console.log("schedule method");
  chrome.cookies.get({ url: main_url, name: "api_key" }, async function (cookie) {
    if (cookie) {
      const apiKey = cookie.value;
      let data = {"api_key": apiKey};
      const url = karmabox_url + "/rss_sources/schedule_current_manual_article_sync";
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
      const url = karmabox_url + "/matching_articles/process_manual_sharable_article";
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      };
      fetch(url, { method: "POST", body: JSON.stringify(data), headers })
        .then(async (response) => {
          console.log(response);
          if (response.ok) {
            createTabs(urlsToOpen);
            chrome.tabs.query({ url: tabUrl }, function (tabs) {
              const tab = tabs[0];
              if (tab && tab.url) {
                closeTab(tab.url);
              }
            });
          } else if (response.status === 500) {
            if(urlHash[tabUrl]){
              urlHash[tabUrl]++;
            }
            else{
              urlHash[tabUrl]=1;
            }
            if(urlHash[tabUrl] > 1){
              closeTab(tabUrl);
              delete urlHash[tabUrl];
              createTabs(urlsToOpen);
            }
          } else if (response.status === 409){
            createTabs(urlsToOpen);
            chrome.tabs.query({ url: tabUrl }, async (tabs) => {
              const tab = tabs[0];
              if (tab && tab.url) {
                closeTab(tab.url);
              }
            });
          }
          else {
            if(urlHash[tabUrl]){
              urlHash[tabUrl]++;
            }
            else{
              urlHash[tabUrl]=1;
            }
            if(urlHash[tabUrl] >= 2){
              console.log("tab url is : ", tabUrl);
              closeTab(tabUrl);
              createTabs(urlsToOpen);
              delete urlHash[tabUrl];
            }      
          }
        })
        .catch((error) => {
          console.log("An error occurred:", error);
          openNextTab(); // Proceed to the next tab even if there's an error
        })
    } else {
      console.log("Cannot retrieve Cookie!");
    }
  });
}

function storeConfirmedURL(article_url) {
  if (article_url.includes("?flagToClose=true") || article_url.includes("&flagToClose=true")) {
    article_url = article_url.slice(0, -17);
  }

  let new_url = current_primary_url;
  if(new_url.includes("flagToClose")){
    new_url = new_url.slice(0,-17);
  }
  console.log("STORING url is : ", new_url);
  const p_url = new_url.replace(/:\/\//g, '_').replace(/\./g, '_').replace(/\//g, '_');
  const apiUrl = `https://api.github.com/repos/atul15anand/Urls-Storage/contents/${p_url}.md`;

  console.log("Storing api is : ", apiUrl);
  const fetchOptions = {
    method: 'GET',
    headers: {
      'Authorization': `token ${accessToken}`,
    },
  };

  fetch(apiUrl, fetchOptions)
    .then(response => {
      if (response.ok) {
        return response.json();
      } else if (response.status === 404) {
        // File does not exist, create it
        console.log("File not found. Creating a new file.");
        return createFile(p_url);
      } else {
        throw new Error(`Failed to fetch file. Status: ${response.status}`);
      }
    })
    .then(data => {
      if (data.content) {
        let existingContent = atob(data.content); // Decode base64 content
        console.log("currently there are : ", existingContent.split(",").length + " urls");
        try {
          let urlArray = existingContent.split(",");
          if (urlArray.length > 800) {
            urlArray = urlArray.slice(0, 200).concat(urlArray.slice(400));
          }
          existingContent = urlArray.join(",");
        } catch (error) {
          console.error("An error occurred:", error.message);
        }
        const newContent = article_url; // Update with the content you want to append
        const appendedContent = existingContent + ',' + newContent;

        const updateOptions = {
          method: 'PUT',
          headers: {
            'Authorization': `token ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Append content to file ' + article_url,
            content: btoa(appendedContent), // Encode the concatenated content in base64
            sha: data.sha,
          }),
        };

        fetch(apiUrl, updateOptions)
          .then(updateResponse => {
            if (updateResponse.ok) {
              console.log('File content appended successfully.');
            } else {
              console.error('Failed to append content to the file. Status:', updateResponse.status);
            }
          })
          .catch(updateError => console.error('Error updating file:', updateError));
      } else {
        console.error('File content not retrieved.');
      }
    })
    .catch(error => console.error('Error fetching file:', error));
}

async function createTabs(urls) {
  urlsToOpen = urls;
  newstabCreation = false;
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
    let url = urlsToOpen.shift();
    url = url.split('#')[0];
    console.log("url is : ", url);
    chrome.tabs.create({ url: url }, function (tab) {
      const tabId = tab.id;
      chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo, updatedTab) {
        if (updatedTabId === tabId && changeInfo.status === "complete" && updatedTab.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          newstabCreation = false;
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