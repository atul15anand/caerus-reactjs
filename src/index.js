import React from 'react';
import ReactDOM from 'react-dom';
import './App.css';
import App from "./App.js";

const container = document.createElement("div");
container.className = "container";

document.body.appendChild(container);

ReactDOM.render(
  <App/>,
  container
);