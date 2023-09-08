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
    const storedUrlsData = JSON.parse(localStorage.getItem("articleLinksData")) || [];
    console.log(request);
    getArticleLinks(request.url_fetch_criteria, request.url_filter, storedUrlsData)
      .then(links => {
        console.log("links are : ", links);
        sendResponse({ links: links });
      })
      .catch(error => {
        console.error("Error fetching links: ", error);
        sendResponse({ error: "An error occurred while fetching links." });
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

async function getArticleLinks(url_fetch_criteria, url_filter, storedUrlsData) {
  console.log("we are here to fetch all the links");
  let links = new Set();

  async function fetchLinks() {
    for (let i = 0; i < url_fetch_criteria.length; i++) {
      let step = url_fetch_criteria[i];
      if (step.pre_action != null) {
        performPreAction(step);
      } else {
        await new Promise(resolve => {
          setTimeout(() => {
            const inter_data = buildQuery(url_fetch_criteria[i]);
            console.log("inter data :", inter_data);
            inter_data.forEach(link => {
              links.add(extractUrlAndParams(link));
            });
            resolve();
          }, 20000); // Delay each iteration by 20 seconds (adjust as needed)
        });
      }
    }
  }

  await fetchLinks();

  console.log("url filter is ", url_filter);
  const filteredLinks = [...links].filter(link => link.includes(url_filter));
  console.log("filtered links:", filteredLinks);
  return filteredLinks;
}

chrome.runtime.onMessage.addListener(getMessage);
