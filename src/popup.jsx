/* eslint-disable no-undef */
import React from 'react';
import './App.css';

const Popup = () => {
  const handleFetchRssAndUrlsClick = () => {
    chrome.runtime.sendMessage({ action: 'sendGetRssSourcesRequest' });
  };

  const handleFetchUrlsClick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const [tab] = tabs;
      chrome.tabs.sendMessage(tab.id, { action: "getLinks" }, function (response) {
        if (response && response.links) {
          articleLinksData = response.links;
          console.log(response.links);
          chrome.runtime.sendMessage({ action: "generateNewTabs", urls: articleLinksData }, function (response) {
            console.log(response);
          });
        }
      });
    });
  };

  const handleClearLocalDataClick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      // Send message to content script
      chrome.tabs.sendMessage(tabs[0].id, { action: "clearConfirmedUrls" }, function(response) {
        console.log("Message sent to content script to clear");
      });
    });
  };

  return (
    <div>
      <div className="heading" style={{ marginTop: '12px' }}>
        Article Scraper
      </div>

      <div className="description">
        Click on the button to fetch all data from the website
      </div>

      <button className="popup_btn" onClick={handleFetchRssAndUrlsClick} id="fetchRssAndUrls">
        Fetch Rss Sources for News
      </button>

      <div className="description">
        Click on the button below to fetch article links and data
      </div>

      <button className="popup_btn" onClick={handleFetchUrlsClick} id="fetchUrlsButton">
        Fetch Article Data
      </button>

      <div className="description">
        Click the button below to clear local data
      </div>

      <button
        className="popup_btn"
        onClick={handleClearLocalDataClick}
        id="clearLocalDataButton"
        style={{ marginBottom: '24px' }}
      >
        Clear Data
      </button>

      <p>
        <span id="message"></span>
      </p>
    </div>
  );
};

export default Popup;
