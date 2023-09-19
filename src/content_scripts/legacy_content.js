/* eslint-disable no-undef */
function get_html_attr(html_attr, html_data){
  if(html_data == null){
    return null;
  }
  switch(html_attr){
    case "innerHTML":
      return html_data.innerHTML
    case "innerText":
      return html_data.innerText;
    case "content":
      return html_data.content;
    case "src":
      return html_data.src;
    case "href":
      return html_data.href;
  }
}

function buildQuery(link_data) {
  switch (link_data.query_selector) {
    case "getElementsByClassName":
      let obj = [], temp = document.getElementsByClassName(link_data.query_value);
      console.log("class name temp is : ", temp);
      const index_list = link_data.token_number;
      console.log("index list is : ", index_list);
      console.log("condition is : ", (index_list.length > 0 && index_list[0] == -1));
      if(index_list.length > 0 && index_list[0] == -1){
        for(let i=0; i<temp.length; i++){
          let value = get_html_attr(link_data.html_attribute, temp[i]);
          if(value){
            obj.push(value);
          }
        }
      } else if(index_list.length >0) {
        for(let i=0; i<link_data.token_number.length; i++){
          let value = get_html_attr(link_data.html_attribute, temp[link_data.token_number[i]]);
          console.log("value is : ", value);
          if(value){
            obj.push(value);
          }
        }
      }
      return obj;
    case "getElementsByTagName":
      let val = [], item = document.getElementsByTagName(link_data.query_value);
      console.log("tag name item in tags value : ", item);
      for(let i=0;i<link_data.token_number.length;i++){
        console.log(item[link_data.token_number[i]]);
        let value = get_html_attr(link_data.html_attribute, item[link_data.token_number[i]].link_data);
        console.log("value is : ", value);
        if(value){
          val.push(value);
        }
      }
      return val;
    case "getElementById":
      return document.getElementById(link_data.query_value)  
    case "querySelector":
      return get_html_attr(link_data.html_attribute, document.querySelector(link_data.query_value));
    case "querySelectorAll":
      console.log("all query");
      let list_all = [], all_data = document.querySelectorAll(link_data.query_value);
      if(link_data.token_number.length>0 && link_data.token_number[0] == -1){
        for(let i=0; i<all_data.length; i++){
          let value = get_html_attr(link_data.html_attribute,all_data[i]);
          if(value){
            list_all.push(value);
          }
        }
      }
      return list_all;
  }
}

function getMessage(request, sender, sendResponse) {

  if (request.action === "getLinks") {
    fetchArticleLinksAndSendResponse(request.url_fetch_criteria, request.url_filter, sendResponse);
    return true;
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
  else if(request.action === "storeConfirmedUrl") {
    console.log("store confirmed");
    const storedLinksData = JSON.parse(localStorage.getItem('articleLinksData')) || [];
    console.log("links already :", storedLinksData);
    const urlToStore = request.url.replace(/[?&]flagToClose=true/g, '');
    console.log("modified url is :", urlToStore);
    if (!storedLinksData.includes(urlToStore)) {
      const updatedLinksData = [...storedLinksData, urlToStore];
      localStorage.setItem('articleLinksData', JSON.stringify(updatedLinksData));
    }
    if(request.message) {
    }
    sendResponse({data: true});
  }
}

async function fetchArticleLinksAndSendResponse(url_fetch_criteria, url_filter, sendResponse) {
  console.log("Fetching article links...");
  let links = await getArticleLinks(url_fetch_criteria, url_filter);
  if (links && links.length > 0) {
    const storedLinksData = JSON.parse(localStorage.getItem('articleLinksData')) || [];
    links = links.filter(link => !storedLinksData.includes(link));  // mandatory to send links variable only
    sendResponse({ links, primary_url: window.location.href });
  } else {
    console.log("No links found. Waiting for 12 seconds and retrying...");
    setTimeout(async () => {
      const retryLinks = await getArticleLinks(url_fetch_criteria, url_filter);
      sendResponse({ links: retryLinks || [], primary_url: window.location.href });
    }, 12000); // Wait for 12 seconds before retrying
  }
}
function scrollToBottomSmoothly() {
  const totalHeight = document.body.scrollHeight;
  const windowHeight = window.innerHeight;
  const scrollStep = 40; // Adjust the scroll step as needed
  const scrollInterval = 10; // Adjust the scroll interval as needed

  let currentScroll = 0;

  function scroll() {
    if (currentScroll < totalHeight) {
      window.scrollBy(0, scrollStep);
      currentScroll += scrollStep;
      setTimeout(scroll, scrollInterval);
    }
  }
  scroll();
}

function performPreAction(step) {
  console.log("pre action perform");
  switch (step.pre_action) {
    case "scroll":
      scrollToBottomSmoothly();
      break;
  }
}

function extractUrlAndParams(url) {
  try {
    const parts = url.split('#');
    return parts[0];
  } catch (error) {
    return url;
  }
}

async function getArticleLinks(url_fetch_criteria, url_filter) {
  console.log("we are here to fetch all the links");

  let v = document.querySelector('script[type="application/json"][data-hypernova-key="ListingPage"]') || document.querySelector('script[type="application/json"][data-hypernova-key="CommunityPage"]');
  v = v.textContent;
  jsonContent = v.substring(4, v.length - 3);
  let j_v= JSON.parse(jsonContent);
  const obituaryLinks = [];

  if (j_v && j_v.obituaryList && j_v.obituaryList.obituaries) {
    const obituaries = j_v.obituaryList.obituaries;
    
    for (let i = 0; i < obituaries.length; i++) {
      const obituary = obituaries[i];
      const obituaryUrl = obituary.links && obituary.links.obituaryUrl;

      console.log(obituaryUrl.href);
      if (obituaryUrl && obituaryUrl.href) {
        const href = obituaryUrl.href;
        obituaryLinks.push(href);
      }
    }
  } else {
    console.log("Obituaries data not found in JSON.");
  }
  return obituaryLinks;
}

window.onload = function() {
  console.log("we are inside this");
  if (window.location.href.endsWith("/today")) {
    // Redirect to the "/browse" page by replacing "/today" with "/browse"
    const newUrl = window.location.href.replace("/today", "/browse");
    window.location.href = newUrl;
  }
}

chrome.runtime.onMessage.addListener(getMessage);
