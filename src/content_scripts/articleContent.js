/* eslint-disable no-undef */
function getMessage(request, sender, sendResponse) {
  if(!request.url === window.location.href){
    return;
  }
  if (request.action === "storeRssSourceNotFound") {
    let rss_sources_url = localStorage.getItem("rss_sources_url") ? JSON.parse(localStorage.getItem("rss_sources_url")) : [];
    const rssSourceUrl = request.data;
    if(!rss_sources_url.includes(rssSourceUrl)){
      rss_sources_url.push(rssSourceUrl);
      localStorage.setItem("rss_sources_url", JSON.stringify(rss_sources_url));
    }
    addMessageToDOM("Rss Source not found." + "Add "+ rssSourceUrl, "red");

    return "Returned"
  }
  else if(request.action === "storeConfirmedUrl") {
    const storedLinksData = JSON.parse(localStorage.getItem('articleLinksData')) || [];
    const urlToStore = request.url.replace('?flagToClose=true', '');
    if (!storedLinksData.includes(urlToStore)) {
      const updatedLinksData = [...storedLinksData, urlToStore];
      localStorage.setItem('articleLinksData', JSON.stringify(updatedLinksData));
    }
    if(request.message) {
      addMessageToDOM("Synced Successfully", "green");
    }
    sendResponse({ success: true });
  }
  else if(request.action === "dataMissingMessage") {
    let emptyKey = Object.keys(request.data).filter(key => (request.data[key] === "" || request.data[key] == null));
    let msg = emptyKey + " missing, request cannot be processed"
    addMessageToDOM(msg, "red");
  }
  else if (request.action === "cookieMissingError") {
    addMessageToDOM("You need to login in https://news.almaconnect.com.", "red");
  }
  else if(request.action == "duplicateData"){
    addMessageToDOM("News article already processed", "red");
    sendResponse({ success: true });
  }
}

function addMessageToDOM(message, color) {
  const headline_element = document.getElementById("navAccountDropdownDesktop") || document.getElementById('MarketNav');
  let newElement = document.createElement('div');
  newElement.innerHTML = message;
  newElement.style.color= color;
  newElement.style.fontSize = "20px";
  newElement.style.fontWeight = "700";
  newElement.style.position = "absolute";
  newElement.style.right = "350px";
  newElement.style.zIndex = "100";
  let parentElement = headline_element.parentNode;
  parentElement.insertBefore(newElement, headline_element);
}
chrome.runtime.onMessage.addListener(getMessage);

function get_html_attr(html_attr, html_data){
  console.log("data is : ", html_data);
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
  }
}

function buildQuery(link_data) {
  switch (link_data.query_selector) {
    case "getElementsByClassName":
      let obj = [], temp = document.getElementsByClassName(link_data.query_value)
      for(let i=0;i<link_data.token_number.length;i++){
        obj.push(item[link_data.token_number[i]]);
      }
      return obj.join(" ");
    case "getElementsByTagName":
      let val = [], item = document.getElementsByTagName(link_data.query_value);
      console.log("item in tags value : ", item);
      for(let i=0;i<link_data.token_number.length;i++){
        console.log(item[link_data.token_number[i]]);
        let value = get_html_attr(link_data.html_attribute, item[link_data.token_number[i]].link_data);
        console.log("value is : ", value);
        if(value){
          val.push(get_html_attr(link_data.html_attribute, item[link_data.token_number[i]].link_data));
        }
      }
      return val.join(" ");
    case "getElementById":
      return document.getElementById(link_data.query_value)  
    case "querySelector":
      return get_html_attr(link_data.html_attribute, document.querySelector(link_data.query_value));
    case "querySelectorAll":
      return get_html_attr(link_data.html_attribute, document.querySelectorAll(link_data.query_value));
  }
} 

window.onload = function() {

  let rss_obj = null;
  chrome.runtime.sendMessage({ action: "requestForRssSource" }, function(response) {
    console.log("Message sent to background script");
    
    if (response && response.data) {
      console.log("response is : ", response);
      rss_obj = response.data;  

      console.log(rss_obj);
      // const date = document.querySelector('meta[name="publish-date"]');
      const date = buildQuery(rss_obj.published_at);
      let dateContent = date;

      console.log("dateContent : ", dateContent);

      let titleText, image_url, baseUrl;

      let link = window.location.href;
      const article_url = window.location.href.replace("?flatToClose=true","");
      console.log("tab url is : ", article_url);

      let title = null;
      for(let i=0;i<rss_obj.title.length; i++){
        console.log(rss_obj.title[i]);
        let title_line = buildQuery(rss_obj.title[i]);
        console.log("title line is : ", title_line);
        title ||= title_line;
      }
      console.log("title is : ", title);

      let article_content = null;
      for(let i=0;i<rss_obj.article_content.length;i++){
        let content_line = buildQuery(rss_obj.article_content[i]);
        // if(rss_obj.article_content)
        let html_attr = rss_obj.article_content[i].html_attribute;
        if(html_attr == "all"){
          for(let j=0;j<content_line.length;j++){
            article_content += content_line[j];
          }
        }
      }

      if(link.includes("/inno/")) {
        let article_content_list = document.getElementsByClassName("article-content-item--paragraph");
        let article_data = null;
        for(let i=0; i< article_content_list.length; i++){
          article_data += article_content_list[0];
        }
        article_content = article_data;

        const image_data = document.getElementsByTagName("img")[0];
        image_url = image_data ? image_data.src : null;
      }
      else {
        const content1 = document.getElementsByClassName("content")[0];
        const content2 = document.getElementsByClassName("content")[2];
        const contentText1 = content1 ? content1.innerText : "";
        const contentText2 = content2 ? content2.innerText : "";
        article_content = contentText1 + contentText2;

        // getting image url from thumbnail
        const image_data = document.querySelector('meta[property="og:image:secure_url"]');
        image_url = image_data ? image_data.content : null;
      }

      const content = {
        article_url: article_url,
        article_content: article_content,
        image_url: image_url,
        source: "bizjournals.com",
        published_at: dateContent,
        title: titleText
      };

      const data = {
        content: content,
      };

      // Send the message to the background script
      chrome.runtime.sendMessage({ action: "sendInfoFromArticle", data: data, url: window.location.href });
    }
  });
};
