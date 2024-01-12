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
    case "dateTime":
      return html_data.dateTime
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
      
      const storedLinksData = JSON.parse(localStorage.getItem('articleLinksData')) || [];
      console.log('request aae hai :', request);
      getArticleLinks(request.url_fetch_criteria, request.url_filter, storedLinksData)
        .then(links => {
          console.log("links are in content: ", links);
          links = links.filter(link => !storedLinksData.includes(link));
          console.log("filtered links are : ", links);
          sendResponse({ links, primary_url: window.location.href });
        })
        .catch(error => {
          console.error("Error fetching links: ", error);
          sendResponse({ error: "An error occurred while fetching links. from content.js" });
        });
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
      sendResponse({data: true});
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
  
  function getArticleLinks(url_fetch_criteria, url_filter, storedLinksData) {
    console.log("we are inside this");
    return new Promise((resolve, reject) => {
      const currentHostname = window.location.hostname;
      let query,links = new Set(), temp;
      console.log("url fetch criteria :", url_fetch_criteria);
      console.log("url filter is :", url_filter);
      if(url_fetch_criteria.length !== 0){
        console.log("Inside First");
        for(let i=0;i<url_fetch_criteria.length;i++){
          temp = buildQuery(url_fetch_criteria[i]);
          console.log("after build query : ", temp);
          temp = new Set(temp);
          temp = Array.from(temp);
          temp = temp.filter(item => item !== window.location.href);
        }
        query = temp;
      }else {
        console.log("we are 2nd");
        temp = document.querySelectorAll("a");
        console.log("temp is : ", temp);
        query = Array.from(temp).map((x) => x.href);
        console.log("query is : ", query);
        let links = query.filter((link) => link.includes(url_filter));
        links = new Set(links);
        links = Array.from(links);
        console.log("links are : ", links);
        query = links;
      }
      console.log(query);
      if (query) {
        console.log("after links ", query);
      }
      resolve(Array.from(query));
    });
  }

  chrome.runtime.onMessage.addListener(getMessage);