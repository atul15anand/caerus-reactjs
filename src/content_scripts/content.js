/* eslint-disable no-undef */
import importedLinks from './url_import.js';
  function getMessage(request, sender, sendResponse) {
  
    if (request.action === "getLinks") {
      
      getArticleLinks(request.url_fetch_criteria, request.url_filter, request.website_data)
        .then(links => {
          console.log("links are in content: ", links);
          links = links.map(link => link.split("#")[0]);
          links = links.filter(link => !importedLinks.includes(link));
          links = links.filter((url, index, array) => array.indexOf(url) === index);
          if(window.location.href.includes("chronicle.com")){
            links = []
          }
          sendResponse({ links, primary_url: window.location.href });
        })
        .catch(error => {
          console.error("Error fetching links: ", error);
          sendResponse({ error: "An error occurred while fetching links. from content.js" });
        });
    }
    else if(request.action === "getLoadInfo"){
      let pageText = document.body.innerText;
      if(pageText.includes("Checking if the site connection is secure")){
        sendResponse({fullyLoaded: false});
      } else{
        sendResponse({fullyLoaded: true});
      }
      return true;
    }
  }

  function filterUrlsByHost(mainUrl, urls) {
    try {
      const mainHost = new URL(mainUrl).host;
      const filteredUrls = urls.filter(url => {
        try {
          const urlHost = new URL(url).host;
          return urlHost === mainHost;
        } catch (urlError) {
          console.error(`Error parsing URL '${url}':`, urlError);
          return false; // Exclude URLs with parsing errors
        }
      });
      return filteredUrls;
    } catch (mainUrlError) {
      console.error(`Error parsing main URL '${mainUrl}':`, mainUrlError);
      return []; // Return an empty array if there's an error with the main URL
    }
  }

  function getArticleLinks(url_fetch_criteria, url_filter, website_data) {
    return new Promise((resolve, reject) => {
      let query = [],links = new Set(), temp;
      temp = document.querySelectorAll("a");
      query = Array.from(temp).map((x) => x.href);
      links = filterUrlsByHost(website_data, query);
      links = Array.from(new Set(links)).filter(url => (!url.includes("flagToClose") && !url.includes("#guestbook") &&  !url.includes("pdf")));
      if(url_filter != null){
        links = Array.from(new Set(links)).filter(url => (url.includes(url_filter)))
      }
      if (links.length) {
        console.log("after links", links);
      }
      resolve(links);
    });
  }

  chrome.runtime.onMessage.addListener(getMessage);