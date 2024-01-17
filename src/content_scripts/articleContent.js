/* eslint-disable no-undef */

const dateData = [{query_value: 'meta[itemprop="datePublished"]', query_selector: 'querySelector', html_attribute: 'content', token_number: []},
{query_value: 'meta[property="article:published_time"]', query_selector: 'querySelector', token_number: [], html_attribute: 'content'},
{query_value: 'article_date', query_selector: 'getElementsByClassName', token_number: [0], html_attribute: 'innerText'},
{query_value: 'time', query_selector: 'querySelector', token_number: [], html_attribute: 'dateTime'},
{query_value: 'meta[name="timestamp"]', query_selector: 'querySelector', token_number: [], html_attribute: 'content'},
{query_value: 'meta[name="parsely-pub-date"]', query_selector: 'querySelector', token_number: [], html_attribute: 'content'},
{query_value: 'meta[name="date"]', query_selector: 'querySelector', token_number: [], html_attribute: 'content'},
{query_value: 'meta[name="dc.date"]', query_selector: 'querySelector', token_number: [], html_attribute: 'content'},
{query_value: 'time.index-module_storyDatelineText__26r5', query_selector: 'querySelector', token_number: [], html_attribute: 'dateTime'},
{query_value: 'meta[name="citation_online_date"]', query_selector: 'querySelector', token_number: [], html_attribute: 'content'},
{query_value: 'meta[name="DC.Date"]', query_selector: 'querySelector', html_attribute: 'content', token_number: []},]

const dateFormats = [
  /\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/,
  /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
  /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/
];

function getMessage(request, sender, sendResponse) {
  if(!request.url === window.location.href){
    return;
  }
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
  // eslint-disable-next-line default-case
  switch (link_data.query_selector) {
    case "getElementsByClassName":
      let obj = [], temp = document.getElementsByClassName(link_data.query_value);
      console.log("temp is : ", temp);
      const index_list = link_data.token_number;
      console.log("index list is : ", index_list);
      console.log("condition is : ", (index_list.length > 0 && index_list[0] === -1));
      if(index_list.length > 0 && index_list[0] === -1){
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
      if(link_data.json_parse === true){
        try {
          let json_data = JSON.parse(result !== null ? result.replace(/\n/g, '') : null) || null;
          if(json_data && typeof json_data === 'string'){
            json_data = json_data.replace(/,,/g, ',');
          }
          console.log("json data is : ", json_data);
        
          if (link_data.token_number.length > 0 && link_data.token_number[0] !== -1) {
            json_data = json_data[link_data.token_number[0]];
          }
        
          if (json_data) {
            return json_data[link_data.json_value];
          }
        } catch (error) {
          console.error("Error processing JSON data:", error);
          // Handle the error as needed, e.g., return a default value or throw a custom error.
        }        
      }
      return result;
    case "querySelectorAll":
      try {
        let tp = get_html_attr(link_data.html_attribute, document.querySelectorAll(link_data.query_value)[link_data.token_number[0]]);
        console.log("tp after html attribute : ", tp);
      
        if (tp && link_data.json_parse) {
          try {
            tp = JSON.parse(tp.replace(/\n/g, '').replace(/,,/g, ',')) || null;
            console.log("tp is : ", tp);
      
            if (tp && link_data.json_value) {
              tp = tp[link_data.json_value];
              return tp;
            } else {
              throw new Error("Invalid json_value or tp structure.");
            }
          } catch (jsonParseError) {
            console.error("Error parsing JSON:", jsonParseError);
            return null;
          }
        } else {
          return null;
        }
      } catch (error) {
        console.error("An error occurred:", error);
        return null;
      }      
  }
}

function extractDateFromHtml(htmlContent) {
  for (const format of dateFormats) {
    const match = htmlContent.match(format);
    if (match) {
      // Return the first match
      return match.slice(1).join('-');
    }
  }

  // Return null if no date is found
  return null;
}

window.onload = function() {
  const rootElement = document.documentElement;

  const pageText = rootElement.innerText || rootElement.textContent;
  const isConnectionSecure = pageText.includes("Checking if the site connection is secure");
  let timeoutValue = 0;

  if (isConnectionSecure) {
    const buttonElement = document.querySelector('button'); // Modify the selector as needed
    if (buttonElement) {
      buttonElement.click();
    }

    const checkboxElement = document.querySelector('input[type="hidden"][name="cf-turnstile-response"]');// Modify the selector as needed
    if (checkboxElement) {
      checkboxElement.checked = true;
    }
    timeoutValue = 15000; // 15 seconds
  }
  
  setTimeout(() => {
    setTimeout(() => {
      // window.location.reload();
    }, 2000); 

      const datePublished = extractDateFromHtml(document.documentElement.outerHTML);
      console.log("dateContent : ", datePublished);
      const currentDate = new Date();

      const content = {
        published_at: datePublished || currentDate,
        html: document.documentElement.outerHTML,
        link: window.location.href
      };

      console.log("CONTENT IS :", content);
  
    chrome.runtime.sendMessage({ action: "sendInfoFromArticle", data: content, url: window.location.href });
  }, timeoutValue);
};
