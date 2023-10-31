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
    // addMessageToDOM("Rss Source not found." + "Add "+ rssSourceUrl, "red");
    sendResponse({data: true});
  }
  else if(request.action === "dataMissingMessage") {
    let emptyKey = Object.keys(request.data).filter(key => (request.data[key] === "" || request.data[key] == null));
    let msg = emptyKey + " missing, request cannot be processed"
    sendResponse({data: true});
  }
  else if (request.action === "cookieMissingError") {
    sendResponse({data: true});
  }
  else if(request.action == "duplicateData"){
    sendResponse({data: true});
  }
  else if(request.action == "fetchLocalData"){
    const storedLinksData = JSON.parse(localStorage.getItem('articleLinksData')) || [];
    sendResponse({links: storedLinksData});
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
    case "textContent":
      return html_data.textContent;
    case "dateTime":
      return html_data.dateTime
    default:
      return html_data.getAttribute(html_attr)
  }
}

function buildQuery(link_data) {
  console.log(link_data.query_selector);
  console.log("buidl query");
  switch (link_data.query_selector) {
    case "getElementsByClassName":
      let obj = [], temp = document.getElementsByClassName(link_data.query_value);
      console.log("temp is : ", temp);
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
      return obj.join(" ");
    case "getElementsByTagName":
      let val = [], item = document.getElementsByTagName(link_data.query_value);
      console.log("item in tags value : ", item);
      for(let i=0;i<link_data.token_number.length;i++){
        console.log(item[link_data.token_number[i]]);
        let value = get_html_attr(link_data.html_attribute, item[link_data.token_number[i]].link_data);
        console.log("value is : ", value);
        if(value){
          val.push(value);
        }
      }
      return val.join(" ");
    case "getElementById":
      return get_html_attr(link_data.html_attribute, document.getElementById(link_data.query_value)) 
    case "querySelector":
      let result = get_html_attr(link_data.html_attribute, document.querySelector(link_data.query_value));
      if(link_data.json_parse == true){
        let json_data= JSON.parse(result);
        if(json_data){
          return json_data[link_data.json_value];
        }
      }
      return result;
    case "querySelectorAll":
      return get_html_attr(link_data.html_attribute, document.querySelectorAll(link_data.query_value));
  }
} 

function buildDate(){
  const currentDate = new Date();
  const day = currentDate.getDate();
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const hours = currentDate.getHours();
  const minutes = currentDate.getMinutes();
  const seconds = currentDate.getSeconds();

  const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  return formattedDate;
}

window.onload = function() {
  const rootElement = document.documentElement;

  console.log("root elementis ", rootElement);
  // Check if the page contains the text "Checking if the site connection is secure"
  const pageText = rootElement.innerText || rootElement.textContent;
  const isConnectionSecure = pageText.includes("Checking if the site connection is secure");
  console.log("isConnectionSecure is :", isConnectionSecure);
  let timeoutValue = 0; // Default timeout value

  // If the page contains the text, perform specific actions
  if (isConnectionSecure) {
    // Check for a button and click it (if present)
    const buttonElement = document.querySelector('button'); // Modify the selector as needed
    console.log("button element is :", buttonElement);
    if (buttonElement) {
      console.log("inside button");
      buttonElement.click();
    }

    // Check for a checkbox and mark it as checked (if present)
    const checkboxElement = document.querySelector('input[type="hidden"][name="cf-turnstile-response"]');// Modify the selector as needed
    console.log("checkboxElement : ",checkboxElement);
    if (checkboxElement) {
      console.log("checkbox inside :", checkboxElement);
      checkboxElement.checked = true;
    }

    // Set a shorter timeout if the conditions are met
    timeoutValue = 15000; // 15 seconds
  }
  
  setTimeout(() => {
    setTimeout(() => {
      window.location.reload();
    }, 5000); // in case article is not closed
    let rss_obj = null;
    console.log("in this page");
    chrome.runtime.sendMessage({ action: "requestForRssSource" }, function(response) {
      console.log("Message sent to background script");
      console.log(response);
      if (response && response.rss_data && response.selectors_data) {
        console.log("response is : ", response);
        rss_obj = response.rss_data;  
        selectors_data = response.selectors_data;

        console.log(rss_obj);
        console.log(selectors_data);
        
        console.log("DATE");

        let date = null;
        for(let i=0;i<selectors_data.published_at.length;i++){
          date ||= buildQuery(selectors_data.published_at[i]);
          console.log("date query is : ", date);
        }

        // const date = buildQuery(selectors_data.published_at[0]) || buildDate();
        let dateContent = date;

        console.log("dateContent : ", dateContent);

        let image_url;

        let link = window.location.href;
        const article_url = link.replace(/[?&]flagToClose=true/g, '');

        console.log("TITLE");
        let title = null;
        for(let i=0;i<selectors_data.title_elements.length; i++){
          // console.log(rss_obj.title[i]);
          let title_line = buildQuery(selectors_data.title_elements[i]);
          // console.log("title line is : ", title_line);
          title ||= title_line;
        }
        console.log("title is : ", title);

        console.log("ARTICLE CONTENT");

        let article_content = null;
        for(let i=0;i<selectors_data.article_content.length;i++){
          console.log("current query for article content : ", selectors_data.article_content[i]);
          article_content ||= buildQuery(selectors_data.article_content[i]);
          console.log("article content is: ", article_content);
        }

        console.log("final article content is : ", article_content);

        console.log("IMAGE URL");
        for(let i=0;i<selectors_data.image_url.length;i++){
          image_url ||= buildQuery(selectors_data.image_url[i]);
          console.log("current image url is : ", image_url);
        }
        console.log("image url is : ", image_url);

        const content = {
          article_url: article_url,
          article_content: article_content || "No Content",
          image_url: image_url || "https://picsum.photos/id/0/5000/3333",
          published_at: dateContent,
          title: title,
          link: link
        };

        console.log("CONTENT IS :", content);
        if (!content.title || !content.published_at) {
          // Reload the page
          window.location.reload();
        }
        const data = {
          content: content,
        };
        // Send the message to the background script

        chrome.runtime.sendMessage({ action: "sendInfoFromArticle", data: data, url: window.location.href });
      }
    });
  }, timeoutValue);
};
